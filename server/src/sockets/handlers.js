const prisma = require("../utils/prisma");
const engine = require("./auctionEngine");

function registerSocketHandlers(io) {
  io.on("connection", (socket) => {
    // ---------- JOIN ROOM ----------
    // Every client (Host/Buyer/Participant) calls this on connecting.
    socket.on("room:join", async ({ roomCode, name, role, teamId, userId }, callback) => {
      try {
        const room = await prisma.AuctionRoom.findUnique({ where: { roomCode } });
        if (!room) return callback?.({ ok: false, error: "Room not found. Check the link." });

        let user;
        if (userId) {
          // Reconnect case - same user rejoining (e.g. phone screen lock, refresh)
          user = await prisma.User.update({
            where: { id: userId },
            data: { socketId: socket.id, isOnline: true },
          });
        } else {
          if (role === "HOST") {
            const existingHost = await prisma.User.findFirst({ where: { roomId: room.id, role: "HOST" } });
            if (existingHost) {
              return callback?.({ ok: false, error: "A host already exists for this auction." });
            }
          }
          if (role === "BUYER") {
            if (!teamId) return callback?.({ ok: false, error: "Select a team to join as Buyer." });
            const team = await prisma.Team.findUnique({ where: { id: teamId }, include: { owner: true } });
            if (!team) return callback?.({ ok: false, error: "Team not found." });
            if (team.owner) return callback?.({ ok: false, error: `${team.name} is already taken by another buyer.` });
          }

          user = await prisma.User.create({
            data: {
              name,
              role,
              roomId: room.id,
              teamId: role === "BUYER" ? teamId : null,
              socketId: socket.id,
              isOnline: true,
            },
          });
        }

        socket.data.userId = user.id;
        socket.data.roomId = room.id;
        socket.join(room.id);

        const fullState = await engine.getFullRoomState(room.id);
        callback?.({ ok: true, user, room: fullState });

        io.to(room.id).emit("presence:update", await getPresenceList(room.id));
      } catch (err) {
        console.error("room:join error", err);
        callback?.({ ok: false, error: "Something went wrong joining the room." });
      }
    });

    // ---------- HOST ACTIONS ----------
    socket.on("host:startAuction", async ({ roomId }, cb) => {
      if (!(await isHost(socket))) return cb?.({ ok: false, error: "Only host can start the auction." });
      const room = await engine.moveToNextPlayer(roomId);
      cb?.({ ok: true, room });
    });

    socket.on("host:nextPlayer", async ({ roomId }, cb) => {
      if (!(await isHost(socket))) return cb?.({ ok: false, error: "Only host can advance players." });
      const room = await engine.moveToNextPlayer(roomId);
      cb?.({ ok: true, room });
    });

    socket.on("host:pauseAuction", async ({ roomId }, cb) => {
      if (!(await isHost(socket))) return cb?.({ ok: false, error: "Only host can pause." });
      const room = await engine.pauseAuction(roomId);
      cb?.({ ok: true, room });
    });

    socket.on("host:resumeAuction", async ({ roomId }, cb) => {
      if (!(await isHost(socket))) return cb?.({ ok: false, error: "Only host can resume." });
      const room = await engine.resumeAuction(roomId);
      cb?.({ ok: true, room });
    });

    socket.on("host:endAuction", async ({ roomId }, cb) => {
      if (!(await isHost(socket))) return cb?.({ ok: false, error: "Only host can end the auction." });
      engine.stopTimer(roomId);
      await prisma.AuctionRoom.update({ where: { id: roomId }, data: { status: "ENDED", timerStatus: "STOPPED" } });
      const room = await engine.getFullRoomState(roomId);
      io.to(roomId).emit("room:state", room);
      io.to(roomId).emit("auction:ended");
      cb?.({ ok: true, room });
    });

    socket.on("host:markUnsold", async ({ roomId }, cb) => {
      // Host can force-mark current player UNSOLD immediately (skip timer)
      if (!(await isHost(socket))) return cb?.({ ok: false, error: "Only host can do this." });
      engine.stopTimer(roomId);
      await engine.finalizeCurrentPlayer(roomId);
      const room = await engine.getFullRoomState(roomId);
      io.to(roomId).emit("room:state", room);
      cb?.({ ok: true, room });
    });

    socket.on("host:reauction", async ({ roomId, playerId }, cb) => {
      if (!(await isHost(socket))) return cb?.({ ok: false, error: "Only host can re-auction players." });
      const result = await engine.reauctionPlayer(roomId, playerId);
      cb?.(result);
    });

    // ---------- BUYER ACTIONS ----------
    socket.on("buyer:placeBid", async ({ roomId, playerId, teamId, amount }, cb) => {
      const user = await prisma.User.findUnique({ where: { id: socket.data.userId } });
      if (!user || user.role !== "BUYER") {
        return cb?.({ ok: false, error: "Only buyers can place bids." });
      }
      if (user.teamId !== teamId) {
        return cb?.({ ok: false, error: "You can only bid for your own team." });
      }
      const result = await engine.placeBid({ roomId, playerId, teamId, amount });
      cb?.(result);
    });

    socket.on("buyer:quickBid", async ({ roomId, playerId, teamId }, cb) => {
      // "Quick bid" button: auto-bids the next minimum increment, large-button friendly for mobile.
      const user = await prisma.User.findUnique({ where: { id: socket.data.userId } });
      if (!user || user.role !== "BUYER" || user.teamId !== teamId) {
        return cb?.({ ok: false, error: "Only the team's buyer can bid." });
      }
      const { getNextMinimumBid } = require("../utils/bidIncrement");
      const topBid = await prisma.Bid.findFirst({ where: { playerId }, orderBy: { amount: "desc" } });
      const player = await prisma.Player.findUnique({ where: { id: playerId } });
      const nextAmount = topBid ? getNextMinimumBid(topBid.amount) : player.basePrice;
      const result = await engine.placeBid({ roomId, playerId, teamId, amount: nextAmount });
      cb?.(result);
    });

    // ---------- VOICE CHAT SIGNALING (future support, WebRTC mesh-ready) ----------
    socket.on("voice:join", ({ roomId }) => {
      socket.join(`voice:${roomId}`);
      socket.to(`voice:${roomId}`).emit("voice:peer-joined", { socketId: socket.id, userId: socket.data.userId });
    });

    socket.on("voice:leave", ({ roomId }) => {
      socket.leave(`voice:${roomId}`);
      socket.to(`voice:${roomId}`).emit("voice:peer-left", { socketId: socket.id });
    });

    socket.on("voice:signal", ({ targetSocketId, signal }) => {
      io.to(targetSocketId).emit("voice:signal", { fromSocketId: socket.id, signal });
    });

    // ---------- DISCONNECT ----------
    socket.on("disconnect", async () => {
      try {
        if (socket.data.userId) {
          await prisma.User.update({
            where: { id: socket.data.userId },
            data: { isOnline: false },
          });
          if (socket.data.roomId) {
            io.to(socket.data.roomId).emit("presence:update", await getPresenceList(socket.data.roomId));
            socket.to(`voice:${socket.data.roomId}`).emit("voice:peer-left", { socketId: socket.id });
          }
        }
      } catch (err) {
        console.error("disconnect cleanup error", err);
      }
    });
  });
}

async function isHost(socket) {
  if (!socket.data.userId) return false;
  const user = await prisma.User.findUnique({ where: { id: socket.data.userId } });
  return user && user.role === "HOST";
}

async function getPresenceList(roomId) {
  const users = await prisma.User.findMany({ where: { roomId }, include: { team: true } });
  return users.map((u) => ({
    id: u.id,
    name: u.name,
    role: u.role,
    isOnline: u.isOnline,
    teamName: u.team ? u.team.name : null,
  }));
}

module.exports = { registerSocketHandlers };
