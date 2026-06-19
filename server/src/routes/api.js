const express = require("express");
const { nanoid } = require("nanoid");
const prisma = require("../utils/prisma");

const router = express.Router();

function generateRoomCode() {
  return nanoid(6).toUpperCase().replace(/[^A-Z0-9]/g, "X");
}

// Create a new auction room. Called once by the Host.
router.post("/rooms", async (req, res) => {
  try {
    const { name } = req.body;
    let roomCode = generateRoomCode();

    // ensure uniqueness (extremely unlikely collision, but be safe)
    let existing = await prisma.AuctionRoom.findUnique({ where: { roomCode } });
    while (existing) {
      roomCode = generateRoomCode();
      existing = await prisma.AuctionRoom.findUnique({ where: { roomCode } });
    }

    const room = await prisma.AuctionRoom.create({
      data: { name: name || "IPL Live Auction", roomCode },
    });
    res.json({ ok: true, room });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "Failed to create room." });
  }
});

// Fetch room by code (used by join page to validate link + list teams before joining)
router.get("/rooms/:roomCode", async (req, res) => {
  const room = await prisma.AuctionRoom.findUnique({
    where: { roomCode: req.params.roomCode },
    include: { teams: { include: { owner: true } } },
  });
  if (!room) return res.status(404).json({ ok: false, error: "Room not found." });
  res.json({
    ok: true,
    room: {
      id: room.id,
      roomCode: room.roomCode,
      name: room.name,
      status: room.status,
      teams: room.teams.map((t) => ({
        id: t.id,
        name: t.name,
        shortName: t.shortName,
        logoColor: t.logoColor,
        totalPurse: t.totalPurse,
        remainingPurse: t.remainingPurse,
        taken: !!t.owner,
      })),
    },
  });
});

// Host creates a team
router.post("/rooms/:roomId/teams", async (req, res) => {
  try {
    const { name, shortName, totalPurse, logoColor } = req.body;
    const team = await prisma.Team.create({
      data: {
        roomId: req.params.roomId,
        name,
        shortName,
        totalPurse: totalPurse || 10000,
        remainingPurse: totalPurse || 10000,
        logoColor: logoColor || "#1d4ed8",
      },
    });
    res.json({ ok: true, team });
  } catch (err) {
    console.error(err);
    res.status(400).json({ ok: false, error: "Failed to create team. Short name might already exist in this room." });
  }
});

router.delete("/teams/:teamId", async (req, res) => {
  try {
    await prisma.Team.delete({ where: { id: req.params.teamId } });
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ ok: false, error: "Failed to delete team." });
  }
});

// Host updates a team's purse before auction starts
router.patch("/teams/:teamId", async (req, res) => {
  try {
    const { totalPurse } = req.body;
    const team = await prisma.Team.update({
      where: { id: req.params.teamId },
      data: { totalPurse, remainingPurse: totalPurse },
    });
    res.json({ ok: true, team });
  } catch (err) {
    res.status(400).json({ ok: false, error: "Failed to update purse." });
  }
});

// Host adds a player to the auction pool
router.post("/rooms/:roomId/players", async (req, res) => {
  try {
    const { name, role, country, basePrice, imageUrl } = req.body;
    const maxOrder = await prisma.Player.aggregate({
      where: { roomId: req.params.roomId },
      _max: { auctionOrder: true },
    });
    const player = await prisma.Player.create({
      data: {
        roomId: req.params.roomId,
        name,
        role: role || "Batsman",
        country,
        basePrice: basePrice || 20,
        imageUrl,
        auctionOrder: (maxOrder._max.auctionOrder || 0) + 1,
      },
    });
    res.json({ ok: true, player });
  } catch (err) {
    console.error(err);
    res.status(400).json({ ok: false, error: "Failed to add player." });
  }
});

// Bulk add players (CSV-style paste from host)
router.post("/rooms/:roomId/players/bulk", async (req, res) => {
  try {
    const { players } = req.body; // [{name, role, country, basePrice}]
    const maxOrder = await prisma.Player.aggregate({
      where: { roomId: req.params.roomId },
      _max: { auctionOrder: true },
    });
    let order = maxOrder._max.auctionOrder || 0;

    const created = [];
    for (const p of players) {
      order += 1;
      const player = await prisma.Player.create({
        data: {
          roomId: req.params.roomId,
          name: p.name,
          role: p.role || "Batsman",
          country: p.country || null,
          basePrice: p.basePrice || 20,
          auctionOrder: order,
        },
      });
      created.push(player);
    }
    res.json({ ok: true, players: created });
  } catch (err) {
    console.error(err);
    res.status(400).json({ ok: false, error: "Failed to bulk add players." });
  }
});

router.delete("/players/:playerId", async (req, res) => {
  try {
    await prisma.Player.delete({ where: { id: req.params.playerId } });
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ ok: false, error: "Failed to delete player." });
  }
});

router.get("/rooms/:roomId/players", async (req, res) => {
  const players = await prisma.Player.findMany({
    where: { roomId: req.params.roomId },
    orderBy: { auctionOrder: "asc" },
  });
  res.json({ ok: true, players });
});

module.exports = router;
