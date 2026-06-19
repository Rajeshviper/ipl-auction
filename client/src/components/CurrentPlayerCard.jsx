export default function CurrentPlayerCard({ player, highestBid, timerSeconds, timerStatus }) {
  if (!player) {
    return (
      <div className="card" style={{ textAlign: "center", padding: 32 }}>
        <div style={{ fontSize: 36 }}>⏳</div>
        <p className="text-dim" style={{ marginTop: 8 }}>Waiting for next player...</p>
      </div>
    );
  }

  const urgent = timerSeconds !== null && timerSeconds <= 10;

  return (
    <div className="card pop-in" style={{ textAlign: "center", position: "relative", overflow: "hidden" }}>
      <span className="pill pill-live" style={{ position: "absolute", top: 14, left: 14 }}>● LIVE</span>
      {timerStatus === "RUNNING" && (
        <div
          className={urgent ? "pulse" : ""}
          style={{
            position: "absolute",
            top: 12,
            right: 14,
            fontSize: 22,
            fontWeight: 800,
            color: urgent ? "var(--danger)" : "var(--gold)",
          }}
        >
          {timerSeconds}s
        </div>
      )}

      <div style={{ marginTop: 28 }}>
        <div
          style={{
            width: 84,
            height: 84,
            borderRadius: "50%",
            background: "var(--bg-card-2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 36,
            margin: "0 auto",
          }}
        >
          🏏
        </div>
        <h2 style={{ fontSize: 22, fontWeight: 800, margin: "12px 0 2px" }}>{player.name}</h2>
        <div className="text-dim" style={{ fontSize: 13 }}>
          {player.role} {player.country ? `· ${player.country}` : ""}
        </div>
        {player.reauctionCount > 0 && (
          <span className="pill pill-unsold" style={{ marginTop: 6 }}>RE-AUCTION #{player.reauctionCount}</span>
        )}
      </div>

      <div style={{ display: "flex", justifyContent: "space-around", marginTop: 20, borderTop: "1px solid var(--border)", paddingTop: 16 }}>
        <div>
          <div className="text-dim" style={{ fontSize: 11, fontWeight: 700 }}>BASE PRICE</div>
          <div style={{ fontSize: 17, fontWeight: 800 }}>₹{player.basePrice}L</div>
        </div>
        <div>
          <div className="text-dim" style={{ fontSize: 11, fontWeight: 700 }}>
            {highestBid ? "HIGHEST BID" : "NO BIDS YET"}
          </div>
          <div style={{ fontSize: 17, fontWeight: 800, color: highestBid ? "var(--accent-2)" : "var(--text)" }}>
            {highestBid ? `₹${highestBid.amount}L` : "—"}
          </div>
          {highestBid && (
            <div className="text-dim" style={{ fontSize: 11 }}>{highestBid.teamShortName}</div>
          )}
        </div>
      </div>
    </div>
  );
}
