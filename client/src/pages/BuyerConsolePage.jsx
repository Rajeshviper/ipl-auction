import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useSocket } from "../context/SocketContext";
import { useAuction } from "../context/AuctionContext";
import { useVoiceChat } from "../hooks/useVoiceChat";
import CurrentPlayerCard from "../components/CurrentPlayerCard";
import BottomNav from "../components/BottomNav";
import EventToast from "../components/EventToast";

const TABS = [
  { id: "live", label: "Live", icon: "🔥" },
  { id: "squad", label: "My Squad", icon: "👥" },
  { id: "teams", label: "All Teams", icon: "🏆" },
];

function nextMinBid(currentAmount) {
  if (currentAmount < 100) return currentAmount + 5;
  if (currentAmount < 200) return currentAmount + 10;
  if (currentAmount < 500) return currentAmount + 20;
  if (currentAmount < 1000) return currentAmount + 25;
  return currentAmount + 50;
}

export default function BuyerConsolePage() {
  const navigate = useNavigate();
  const { socket } = useSocket();
  const { room, session, lastEvent, timerSeconds } = useAuction();
  const { isVoiceOn, startVoice, stopVoice } = useVoiceChat(room?.id);
  const [tab, setTab] = useState("live");
  const [bidError, setBidError] = useState("");
  const [bidding, setBidding] = useState(false);

  if (!room || !session) {
    navigate("/");
    return null;
  }

  const myTeam = room.teams.find((t) => t.id === session.teamId);
  const myPlayers = room.players.filter((p) => p.teamId === session.teamId);
  const canBid = room.status === "LIVE" && room.currentPlayer;
  const currentAmount = room.currentHighestBid ? room.currentHighestBid.amount : room.currentPlayer?.basePrice;
  const minNext = currentAmount ? nextMinBid(currentAmount) : 0;
  const isTopBidder = room.currentHighestBid?.teamId === session.teamId;
  const canAfford = myTeam ? myTeam.remainingPurse >= minNext : false;

  const quickBidOptions = useMemo(() => {
    if (!currentAmount) return [];
    const opts = [];
    let amt = minNext;
    for (let i = 0; i < 3; i++) {
      opts.push(amt);
      amt = nextMinBid(amt);
    }
    return opts;
  }, [currentAmount, minNext]);

  function placeBid(amount) {
    if (!myTeam) return;
    setBidding(true);
    setBidError("");
    socket.emit(
      "buyer:placeBid",
      { roomId: room.id, playerId: room.currentPlayer.id, teamId: myTeam.id, amount },
      (res) => {
        setBidding(false);
        if (!res.ok) setBidError(res.error);
      }
    );
  }

  async function toggleVoice() {
    if (isVoiceOn) stopVoice();
    else {
      try {
        await startVoice();
      } catch {
        setBidError("Microphone permission denied.");
      }
    }
  }

  return (
    <div className="screen" style={{ paddingBottom: 0 }}>
      <EventToast event={lastEvent} />

      <div className="row" style={{ marginBottom: 12 }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 16 }}>{myTeam?.name || session.name}</div>
          <div className="text-dim" style={{ fontSize: 12 }}>
            Purse: <span style={{ color: "var(--accent-2)", fontWeight: 700 }}>₹{myTeam?.remainingPurse}L</span> / ₹{myTeam?.totalPurse}L
          </div>
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

          {isTopBidder && (
            <div className="card" style={{ marginTop: 12, textAlign: "center", background: "rgba(0,212,170,0.1)", border: "1px solid var(--accent-2)" }}>
              <span style={{ fontWeight: 700, color: "var(--accent-2)" }}>✅ You're the highest bidder!</span>
            </div>
          )}

          {bidError && (
            <p style={{ color: "var(--danger)", fontSize: 13, marginTop: 10, textAlign: "center" }}>{bidError}</p>
          )}

          {canBid && !isTopBidder && (
            <div style={{ marginTop: 16 }}>
              <p className="text-dim" style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, textAlign: "center" }}>
                TAP TO BID
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {quickBidOptions.map((amt, idx) => (
                  <button
                    key={amt}
                    className="btn-primary"
                    style={{
                      fontSize: idx === 0 ? 19 : 16,
                      padding: idx === 0 ? 20 : 16,
                      opacity: myTeam && myTeam.remainingPurse >= amt ? 1 : 0.4,
                    }}
                    disabled={bidding || !myTeam || myTeam.remainingPurse < amt}
                    onClick={() => placeBid(amt)}
                  >
                    💰 Bid ₹{amt}L
                  </button>
                ))}
              </div>
              {!canAfford && (
                <p style={{ color: "var(--danger)", fontSize: 12, marginTop: 8, textAlign: "center" }}>
                  Insufficient purse to bid further
                </p>
              )}
            </div>
          )}

          {!canBid && (
            <div className="card" style={{ marginTop: 12, textAlign: "center" }}>
              <p className="text-dim" style={{ fontSize: 13, margin: 0 }}>
                {room.status === "PAUSED" ? "Auction is paused" : "Waiting for host to start..."}
              </p>
            </div>
          )}

          <button
            className="btn-secondary"
            style={{ marginTop: 16, background: isVoiceOn ? "rgba(255,71,87,0.15)" : "var(--bg-card-2)" }}
            onClick={toggleVoice}
          >
            {isVoiceOn ? "🔴 Leave Voice Chat" : "🎙️ Join Voice Chat"}
          </button>
        </div>
      )}

      {tab === "squad" && (
        <div className="scroll-list">
          {myPlayers.length === 0 && <p className="text-dim" style={{ textAlign: "center", marginTop: 30 }}>No players purchased yet</p>}
          {myPlayers.map((p) => (
            <div key={p.id} className="card row" style={{ marginBottom: 8 }}>
              <span>
                <div style={{ fontWeight: 700 }}>{p.name}</div>
                <div className="text-dim" style={{ fontSize: 12 }}>{p.role}</div>
              </span>
              <span style={{ fontWeight: 800, color: "var(--accent-2)" }}>₹{p.soldPrice}L</span>
            </div>
          ))}
        </div>
      )}

      {tab === "teams" && (
        <div className="scroll-list">
          {room.teams.map((t) => (
            <div key={t.id} className="card" style={{ marginBottom: 10, border: t.id === session.teamId ? `2px solid ${t.logoColor}` : undefined }}>
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
