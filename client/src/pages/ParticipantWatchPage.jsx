import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuction } from "../context/AuctionContext";
import { useVoiceChat } from "../hooks/useVoiceChat";
import CurrentPlayerCard from "../components/CurrentPlayerCard";
import BottomNav from "../components/BottomNav";
import EventToast from "../components/EventToast";

const TABS = [
  { id: "live", label: "Live", icon: "👀" },
  { id: "sold", label: "Sold", icon: "✅" },
  { id: "teams", label: "Teams", icon: "🏆" },
];

export default function ParticipantWatchPage() {
  const navigate = useNavigate();
  const { room, session, lastEvent, timerSeconds } = useAuction();
  const { isVoiceOn, startVoice, stopVoice } = useVoiceChat(room?.id);
  const [tab, setTab] = useState("live");
  const [voiceError, setVoiceError] = useState("");

  if (!room || !session) {
    navigate("/");
    return null;
  }

  const soldPlayers = room.players.filter((p) => p.status === "SOLD");

  async function toggleVoice() {
    if (isVoiceOn) stopVoice();
    else {
      try {
        await startVoice();
      } catch {
        setVoiceError("Microphone permission denied.");
      }
    }
  }

  return (
    <div className="screen" style={{ paddingBottom: 0 }}>
      <EventToast event={lastEvent} />

      <div className="row" style={{ marginBottom: 12 }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 16 }}>{room.name}</div>
          <div className="text-dim" style={{ fontSize: 12 }}>👀 Watching as {session.name}</div>
        </div>
        <span className={`pill ${room.status === "LIVE" ? "pill-live" : "pill-unsold"}`}>{room.status}</span>
      </div>

      {tab === "live" && (
        <div className="scroll-list">
          <CurrentPlayerCard
            player={room.currentPlayer}
            highestBid={room.currentHighestBid}
            timerSeconds={timerSeconds}
            timerStatus={room.timerStatus}
          />
          {voiceError && <p style={{ color: "var(--danger)", fontSize: 13, marginTop: 10, textAlign: "center" }}>{voiceError}</p>}
          <button
            className="btn-secondary"
            style={{ marginTop: 16, background: isVoiceOn ? "rgba(255,71,87,0.15)" : "var(--bg-card-2)" }}
            onClick={toggleVoice}
          >
            {isVoiceOn ? "🔴 Leave Voice Chat" : "🎙️ Listen to Voice Chat"}
          </button>
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
                  <div className="text-dim" style={{ fontSize: 12 }}>{team?.name}</div>
                </span>
                <span style={{ fontWeight: 800, color: "var(--accent-2)" }}>₹{p.soldPrice}L</span>
              </div>
            );
          })}
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
                <span style={{ fontWeight: 700, color: "var(--accent-2)", fontSize: 13 }}>₹{t.remainingPurse}L left</span>
              </div>
              <div className="text-dim" style={{ fontSize: 12, marginTop: 6 }}>{t.playersCount} players bought</div>
            </div>
          ))}
        </div>
      )}

      <BottomNav tabs={TABS} active={tab} onChange={setTab} />
    </div>
  );
}
