const prisma = require("../utils/prisma");
const { getNextMinimumBid } = require("../utils/bidIncrement");

// One in-memory timer loop per room. Room state (truth) still lives in DB,
// but the live countdown tick is kept in memory for performance —
// we don't want to hit the DB every second for every room.
const roomTimers = new Map(); // roomId -> { intervalHandle, secondsLeft }

const INITIAL_TIMER = 90;
const RESET_TIMER = 60;

function getIO() {
  return require("../sockets/io").getIO();
}

function broadcastRoomState(roomId, room) {
  getIO().to(roomId).emit("room:state", room);
}

async function getFullRoomState(roomId) {
  const room = await prisma.AuctionRoom.findUnique({
    where: { id: roomId },
    include: {
      teams: {
        include: {
          players: true,
          owner: true,
        },
      },
      players: {
        orderBy: { auctionOrder: "asc" },
      },
    },
  });
  if (!room) return null;

  const currentPlayer = room.players.find((p) => p.id === room.currentPlayerId) || null;
  let currentBids = [];
  if (currentPlayer) {
    currentBids = await prisma.Bid.findMany({
      where: { playerId: currentPlayer.id },
      include: { team: true },
      orderBy: { createdAt: "desc" },
      take: 1,
    });
  }

  const timerState = roomTimers.get(roomId);

  return {
    id: room.id,
    roomCode: room.roomCode,
    name: room.name,
    status: room.status,
    timerStatus: room.timerStatus,
    timerSeconds: timerState ? timerState.secondsLeft : room.timerSeconds,
    teams: room.teams.map((t) => ({
      id: t.id,
      name: t.name,
      shortName: t.shortName,
      logoColor: t.logoColor,
      totalPurse: t.totalPurse,
      remainingPurse: t.remainingPurse,
      ownerName: t.owner ? t.owner.name : null,
      playersCount: t.players.length,
    })),
    players: room.players,
    currentPlayer: currentPlayer || null,
    currentHighestBid: currentBids[0]
      ? {
          amount: currentBids[0].amount,
          teamId: currentBids[0].teamId,
          teamName: currentBids[0].team.name,
          teamShortName: currentBids[0].team.shortName,
        }
      : null,
  };
}

function stopTimer(roomId) {
  const t = roomTimers.get(roomId);
  if (t && t.intervalHandle) {
    clearInterval(t.intervalHandle);
  }
  roomTimers.delete(roomId);
}

async function startTimer(roomId, seconds) {
  stopTimer(roomId);
  const state = { secondsLeft: seconds, intervalHandle: null };
  roomTimers.set(roomId, state);

  await prisma.AuctionRoom.update({
    where: { id: roomId },
    data: { timerStatus: "RUNNING", timerSeconds: seconds },
  });

  state.intervalHandle = setInterval(async () => {
    state.secondsLeft -= 1;
    getIO().to(roomId).emit("timer:tick", { secondsLeft: state.secondsLeft });

    if (state.secondsLeft <= 0) {
      stopTimer(roomId);
      await finalizeCurrentPlayer(roomId);
    }
  }, 1000);
}

function pauseTimer(roomId) {
  const t = roomTimers.get(roomId);
  if (t && t.intervalHandle) {
    clearInterval(t.intervalHandle);
    t.intervalHandle = null;
  }
}

async function resumeTimer(roomId) {
  const t = roomTimers.get(roomId);
  if (!t) return;
  await startTimer(roomId, t.secondsLeft);
}

// Moves to the next PENDING player and starts the countdown fresh.
async function moveToNextPlayer(roomId) {
  const nextPlayer = await prisma.Player.findFirst({
    where: { roomId, status: "PENDING" },
    orderBy: { auctionOrder: "asc" },
  });

  if (!nextPlayer) {
    await prisma.AuctionRoom.update({
      where: { id: roomId },
      data: { currentPlayerId: null, status: "ENDED", timerStatus: "STOPPED" },
    });
    stopTimer(roomId);
    const room = await getFullRoomState(roomId);
    broadcastRoomState(roomId, room);
    getIO().to(roomId).emit("auction:ended");
    return room;
  }

  await prisma.Player.update({
    where: { id: nextPlayer.id },
    data: { status: "LIVE" },
  });

  await prisma.AuctionRoom.update({
    where: { id: roomId },
    data: { currentPlayerId: nextPlayer.id, status: "LIVE" },
  });

  await startTimer(roomId, INITIAL_TIMER);

  const room = await getFullRoomState(roomId);
  broadcastRoomState(roomId, room);
  return room;
}

// Called when timer hits zero: decides SOLD vs UNSOLD based on highest bid.
async function finalizeCurrentPlayer(roomId) {
  const room = await prisma.AuctionRoom.findUnique({ where: { id: roomId } });
  if (!room || !room.currentPlayerId) return;

  const topBid = await prisma.Bid.findFirst({
    where: { playerId: room.currentPlayerId },
    orderBy: { amount: "desc" },
    include: { team: true },
  });

  if (topBid) {
    await prisma.Player.update({
      where: { id: room.currentPlayerId },
      data: { status: "SOLD", soldPrice: topBid.amount, teamId: topBid.teamId },
    });
    await prisma.Team.update({
      where: { id: topBid.teamId },
      data: { remainingPurse: { decrement: topBid.amount } },
    });

    getIO().to(roomId).emit("player:sold", {
      playerId: room.currentPlayerId,
      teamId: topBid.teamId,
      teamName: topBid.team.name,
      amount: topBid.amount,
    });
  } else {
    await prisma.Player.update({
      where: { id: room.currentPlayerId },
      data: { status: "UNSOLD" },
    });
    getIO().to(roomId).emit("player:unsold", { playerId: room.currentPlayerId });
  }

  await prisma.AuctionRoom.update({
    where: { id: roomId },
    data: { currentPlayerId: null, timerStatus: "STOPPED" },
  });
}

// A buyer places a bid. Validates: auction must be LIVE, amount must meet minimum,
// team must have enough remaining purse.
async function placeBid({ roomId, playerId, teamId, amount }) {
  const room = await prisma.AuctionRoom.findUnique({ where: { id: roomId } });
  if (!room || room.status !== "LIVE" || room.currentPlayerId !== playerId) {
    return { ok: false, error: "Auction is not live for this player." };
  }

  const team = await prisma.Team.findUnique({ where: { id: teamId } });
  if (!team) return { ok: false, error: "Team not found." };

  const topBid = await prisma.Bid.findFirst({
    where: { playerId },
    orderBy: { amount: "desc" },
  });

  const player = await prisma.Player.findUnique({ where: { id: playerId } });
  const currentAmount = topBid ? topBid.amount : player.basePrice;
  const minNext = topBid ? getNextMinimumBid(topBid.amount) : player.basePrice;

  if (amount < minNext) {
    return { ok: false, error: `Minimum next bid is ${minNext}.` };
  }
  if (topBid && topBid.teamId === teamId) {
    return { ok: false, error: "You already hold the highest bid." };
  }
  if (team.remainingPurse < amount) {
    return { ok: false, error: "Insufficient purse remaining." };
  }

  await prisma.Bid.create({
    data: { roomId, playerId, teamId, amount },
  });

  // Reset timer to 60s on every valid bid (per spec)
  await startTimer(roomId, RESET_TIMER);

  const updatedRoom = await getFullRoomState(roomId);
  broadcastRoomState(roomId, updatedRoom);
  getIO().to(roomId).emit("bid:placed", {
    playerId,
    teamId,
    teamName: team.name,
    teamShortName: team.shortName,
    amount,
  });

  return { ok: true, room: updatedRoom };
}

// Puts an UNSOLD player back into the queue for re-auction.
async function reauctionPlayer(roomId, playerId) {
  const player = await prisma.Player.findUnique({ where: { id: playerId } });
  if (!player || player.status !== "UNSOLD") {
    return { ok: false, error: "Only unsold players can be re-auctioned." };
  }

  const maxOrder = await prisma.Player.aggregate({
    where: { roomId },
    _max: { auctionOrder: true },
  });

  await prisma.Player.update({
    where: { id: playerId },
    data: {
      status: "PENDING",
      auctionOrder: (maxOrder._max.auctionOrder || 0) + 1,
      reauctionCount: { increment: 1 },
    },
  });

  const room = await getFullRoomState(roomId);
  broadcastRoomState(roomId, room);
  return { ok: true, room };
}

async function pauseAuction(roomId) {
  pauseTimer(roomId);
  await prisma.AuctionRoom.update({ where: { id: roomId }, data: { status: "PAUSED", timerStatus: "PAUSED" } });
  const room = await getFullRoomState(roomId);
  broadcastRoomState(roomId, room);
  return room;
}

async function resumeAuction(roomId) {
  await prisma.AuctionRoom.update({ where: { id: roomId }, data: { status: "LIVE" } });
  await resumeTimer(roomId);
  const room = await getFullRoomState(roomId);
  broadcastRoomState(roomId, room);
  return room;
}

module.exports = {
  getFullRoomState,
  moveToNextPlayer,
  finalizeCurrentPlayer,
  placeBid,
  reauctionPlayer,
  pauseAuction,
  resumeAuction,
  stopTimer,
  startTimer,
  INITIAL_TIMER,
  RESET_TIMER,
};
