require("dotenv").config();
const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const apiRoutes = require("./routes/api");
const { setIO } = require("./sockets/io");
const { registerSocketHandlers } = require("./sockets/handlers");

const app = express();
const server = http.createServer(app);

const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "*";

const io = new Server(server, {
  cors: {
    origin: CLIENT_ORIGIN,
    methods: ["GET", "POST"],
  },
  // Mobile networks (especially Indian carrier 4G/5G) can be flaky -
  // generous ping settings prevent false disconnects on screen-lock/background.
  pingTimeout: 30000,
  pingInterval: 10000,
});

setIO(io);
registerSocketHandlers(io);

app.use(cors({ origin: CLIENT_ORIGIN }));
app.use(express.json());

app.get("/health", (req, res) => res.json({ ok: true, status: "running" }));
app.use("/api", apiRoutes);

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`IPL Auction server running on port ${PORT}`);
});
