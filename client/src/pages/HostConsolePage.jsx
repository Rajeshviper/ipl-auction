import SoldResultCard from "../components/SoldResultCard";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSocket } from "../context/SocketContext";
import { useAuction } from "../context/AuctionContext";
import { useVoiceChat } from "../hooks/useVoiceChat";
import CurrentPlayerCard from "../components/CurrentPlayerCard";
import BottomNav from "../components/BottomNav";
import EventToast from "../components/EventToast";

const TABS = [
  { id: "live", label: "Live", icon: "🎙️" },
  { id: "teams", label: "Teams", icon: "🏆" },
  { id: "sold", label: "Sold", icon: "✅" },
  { id: "unsold", label: "Unsold", icon: "❌" },
];

export default function HostConsolePage() {
  const navigate = useNavigate();
  const { socket } = useSocket();
  const { room, session, lastEvent, auctionResult, timerSeconds } = useAuction();
  const { isVoiceOn, startVoice, stopVoice } = useVoiceChat(room?.id);
  const [tab, setTab] = useState("live");
  const [actionError, setActionError] = useState("");

  if (!room || !session) {
    navigate("/");
    return null;
  }

  function emitAction(event, payload = {}) {
    setActionError("");
    socket.emit(event, { roomId: room.id, ...payload }, (res) => {
      if (!res?.ok) setActionError(res?.error || "Action failed");
    });
  }

  const soldPlayers = room.players.filter((p) => p.status === "SOLD");
  const unsoldPlayers = room.players.filter((p) => p.status === "UNSOLD");
  const pendingCount = room.players.filter((p) => p.status === "PENDING").length;

  async function toggleVoice() {
    if (isVoiceOn) stopVoice();
    else {
      try {
        await startVoice();
      } catch {
        setActionError("Microphone permission denied.");
      }
    }
  }

  return (
    <div className="screen" style={{ paddingBottom: 0 }}>
      <EventToast event={lastEvent} />

      <div className="row" style={{ marginBottom: 12 }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 16 }}>{room.name}</div>
          <div className="text-dim" style={{ fontSize: 12 }}>
            Code: {room.roomCode} · <span style={{ color: "var(--gold)" }}>HOST</span>
          </div>
        </div>
        <span className={`pill ${room.status === "LIVE" ? "pill-live" : "pill-unsold"}`}>{room.status}</span>
      </div>

      {tab === "live" && (
        <div className="scroll-list">
          {auctionResult ? (
  <SoldResultCard result={auctionResult} />
) : (
  <CurrentPlayerCard
    player={room.currentPlayer}
    highestBid={room.currentHighestBid}
    timerSeconds={timerSeconds}
    timerStatus={room.timerStatus}
  />
)}

          <div className="card" style={{ marginTop: 12, textAlign: "center" }}>
            <div className="text-dim" style={{ fontSize: 12 }}>
              {pendingCount} players remaining in queue
            </div>
          </div>

          {actionError && (
            <p style={{ color: "var(--danger)", fontSize: 13, marginTop: 10, textAlign: "center" }}>{actionError}</p>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 14 }}>
            {room.status === "LOBBY" && (
              <button className="btn-primary" onClick={() => emitAction("host:startAuction")}>
                ▶️ Start Auction
              </button>
            )}

            {!auctionResult && room.status === "LIVE" && room.currentPlayer && (
              <>
                <button className="btn-secondary" onClick={() => emitAction("host:pauseAuction")}>
                  ⏸️ Pause Auction
                </button>

                {room.currentHighestBid && (
                  <button
                  className="btn-primary"
                  style={{ background: "linear-gradient(135deg, var(--accent-2), #00b894)", boxShadow: "0 6px 18px rgba(0,212,170,0.35)" }}
                  onClick={() => emitAction("host:markSold")}
                  >
                    ✅ Sell Now to {room.currentHighestBid.teamShortName} — ₹{room.currentHighestBid.amount}L
                    </button>
                  )}
                  
                <button className="btn-danger" onClick={() => emitAction("host:markUnsold")}>
                  ❌ Mark Unsold Now
                </button>
              </>
            )}

            {!auctionResult && room.status === "LIVE" && !room.currentPlayer && pendingCount > 0 && (
              <button className="btn-primary" onClick={() => emitAction("host:nextPlayer")}>
                ⏭️ Bring Next Player
              </button>
            )}

            
            {auctionResult && room.status === "LIVE" && (
              <button className="btn-primary" onClick={() => emitAction("host:nextPlayer")}>
                {pendingCount > 0 
                ? "⏭️ Start Next Player Auction" 
                : "🏁 No Players Left — End Auction"}
                </button>
              )}

            {room.status === "PAUSED" && (
              <button className="btn-primary" onClick={() => emitAction("host:resumeAuction")}>
                ▶️ Resume Auction
              </button>
            )}

            <button
              className="btn-secondary"
              style={{ background: isVoiceOn ? "rgba(255,71,87,0.15)" : "var(--bg-card-2)" }}
              onClick={toggleVoice}
            >
              {isVoiceOn ? "🔴 Stop Voice Announcement" : "🎙️ Start Voice Announcement"}
            </button>

            {(room.status === "LIVE" || room.status === "PAUSED") && (
              <button className="btn-danger" onClick={() => emitAction("host:endAuction")}>
                🏁 End Auction
              </button>
            )}
          </div>
        </div>
      )}

      {tab === "teams" && (
        <div className="scroll-list">
          {room.teams.map((t) => (
            <div key={t.id} className="card" style={{ marginBottom: 10 }}>
              <div className="row">
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 12, height: 12, borderRadius: "50%", background: t.logoColor }} />
                  <span style={{ fontWeight: 700 }}>{t.name}</span>
                </span>
                <span className="text-dim" style={{ fontSize: 12 }}>{t.ownerName ? `👤 ${t.ownerName}` : "No buyer yet"}</span>
              </div>
              <div className="row" style={{ marginTop: 8 }}>
                <span className="text-dim" style={{ fontSize: 12 }}>Remaining Purse</span>
                <span style={{ fontWeight: 700, color: "var(--accent-2)" }}>₹{t.remainingPurse}L / ₹{t.totalPurse}L</span>
              </div>
              <div className="row" style={{ marginTop: 4 }}>
                <span className="text-dim" style={{ fontSize: 12 }}>Players Bought</span>
                <span style={{ fontWeight: 700 }}>{t.playersCount}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "sold" && (
        <div className="scroll-list">
          {soldPlayers.length === 0 && <p className="text-dim" style={{ textAlign: "center", marginTop: 30 }}>No players sold yet</p>}
          {soldPlayers.map((p) => {
  const team = room.teams.find((t) => t.id === p.teamId);

  return (
    <div key={p.id} className="card row" style={{ marginBottom: 8 }}>
      <span>
        <div style={{ fontWeight: 700 }}>{p.name}</div>
        <div className="text-dim" style={{ fontSize: 12 }}>
          {p.role} · Sold to {team ? team.name : "—"}
        </div>
      </span>

      <span style={{ textAlign: "right" }}>
        <div style={{ fontWeight: 800, color: "var(--accent-2)" }}>
          ₹{p.soldPrice}L
        </div>
      </span>
    </div>
  );
})}
</div>
      )}


      {tab === "unsold" && (
        <div className="scroll-list">
          {unsoldPlayers.length === 0 && <p className="text-dim" style={{ textAlign: "center", marginTop: 30 }}>No unsold players</p>}
          {unsoldPlayers.map((p) => (
            <div key={p.id} className="card row" style={{ marginBottom: 8 }}>
              <span>
                <div style={{ fontWeight: 700 }}>{p.name}</div>
                <div className="text-dim" style={{ fontSize: 12 }}>{p.role} · Base ₹{p.basePrice}L</div>
              </span>
              <button
                className="btn-secondary"
                style={{ width: "auto", padding: "8px 14px", fontSize: 13 }}
                onClick={() => emitAction("host:reauction", { playerId: p.id })}
              >
                🔁 Re-auction
              </button>
            </div>
          ))}
        </div>
      )}

      <BottomNav tabs={TABS} active={tab} onChange={setTab} />
    </div>
  );
}
