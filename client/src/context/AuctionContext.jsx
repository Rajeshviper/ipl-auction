import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useSocket } from "./SocketContext";

const AuctionContext = createContext(null);

const STORAGE_KEY = "ipl_auction_session";

function loadSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveSession(session) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // ignore storage errors (e.g. private browsing mode)
  }
}

export function AuctionProvider({ children }) {
  const { socket } = useSocket();
  const [session, setSession] = useState(loadSession()); // { userId, roomCode, name, role, teamId }
  const [room, setRoom] = useState(null);
  const [presence, setPresence] = useState([]);
  const [lastEvent, setLastEvent] = useState(null); // for toast-style notifications (sold/unsold/bid)
  const [auctionResult, setAuctionResult] = useState(null);
  const [timerSeconds, setTimerSeconds] = useState(null);

  useEffect(() => {
    function onRoomState(updatedRoom) {
      const newPlayerId = updatedRoom.currentPlayer?.id || null;
      setRoom((prevRoom) => {
        const prevPlayerId = prevRoom?.currentPlayer?.id || null;
        if (newPlayerId && newPlayerId !== prevPlayerId) {
          setAuctionResult(null);
        }
        return updatedRoom;
      });
      setTimerSeconds(updatedRoom.timerSeconds);
    }

    function onTick({ secondsLeft }) {
      setTimerSeconds(secondsLeft);
    }

    function onBidPlaced(payload) {
      setLastEvent({ type: "bid", ...payload, ts: Date.now() });
    }

    function onSold(payload) {
      setLastEvent({ type: "sold", ...payload, ts: Date.now() });
      setAuctionResult({ type: "SOLD", ...payload, ts: Date.now() });
    }

    function onUnsold(payload) {
      setLastEvent({ type: "unsold", ...payload, ts: Date.now() });
      setAuctionResult({ type: "UNSOLD", ...payload, ts: Date.now() });
    }

    function onPresence(list) {
      setPresence(list);
    }

    function onEnded() {
      setLastEvent({ type: "ended", ts: Date.now() });
    }

    socket.on("room:state", onRoomState);
    socket.on("timer:tick", onTick);
    socket.on("bid:placed", onBidPlaced);
    socket.on("player:sold", onSold);
    socket.on("player:unsold", onUnsold);
    socket.on("presence:update", onPresence);
    socket.on("auction:ended", onEnded);

    return () => {
      socket.off("room:state", onRoomState);
      socket.off("timer:tick", onTick);
      socket.off("bid:placed", onBidPlaced);
      socket.off("player:sold", onSold);
      socket.off("player:unsold", onUnsold);
      socket.off("presence:update", onPresence);
      socket.off("auction:ended", onEnded);
    };
  }, [socket]);

  // Auto rejoin on reconnect (e.g. phone screen was locked / tab backgrounded)
  useEffect(() => {
    function tryRejoin() {
      const s = loadSession();
      if (s && s.roomCode) {
        socket.emit(
          "room:join",
          { roomCode: s.roomCode, name: s.name, role: s.role, teamId: s.teamId, userId: s.userId },
          (res) => {
            if (res.ok) {
              setRoom(res.room);
              setTimerSeconds(res.room.timerSeconds);
            }
          }
        );
      }
    }
    socket.on("connect", tryRejoin);
    if (socket.connected) tryRejoin();
    return () => socket.off("connect", tryRejoin);
  }, [socket]);

  const joinRoom = useCallback(
    ({ roomCode, name, role, teamId }) =>
      new Promise((resolve) => {
        socket.emit("room:join", { roomCode, name, role, teamId }, (res) => {
          if (res.ok) {
            const newSession = {
              userId: res.user.id,
              roomCode,
              name,
              role,
              teamId: teamId || null,
              roomId: res.room.id,
            };
            setSession(newSession);
            saveSession(newSession);
            setRoom(res.room);
            setTimerSeconds(res.room.timerSeconds);
          }
          resolve(res);
        });
      }),
    [socket]
  );

  const leaveSession = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setSession(null);
    setRoom(null);
  }, []);

  return (
    <AuctionContext.Provider
      value={{ session, room, presence, lastEvent, auctionResult, timerSeconds, joinRoom, leaveSession, setRoom }}
    >
      {children}
    </AuctionContext.Provider>
  );
}

export function useAuction() {
  const ctx = useContext(AuctionContext);
  if (!ctx) throw new Error("useAuction must be used within AuctionProvider");
  return ctx;
}
