export default function SoldResultCard({ result }) {
  if (!result) return null;

  const isSold = result.type === "SOLD";

  return (
    <div
      className="card pop-in"
      style={{
        textAlign: "center",
        padding: "28px 16px",
        border: isSold ? "2px solid var(--accent-2)" : "2px solid var(--text-dim)",
        background: isSold ? "rgba(0, 212, 170, 0.08)" : "rgba(154, 164, 191, 0.06)",
      }}
    >
      <div style={{ fontSize: 42 }}>{isSold ? "🎉" : "❌"}</div>
      <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: 1, marginTop: 8, color: isSold ? "var(--accent-2)" : "var(--text-dim)" }}>
        {isSold ? "SOLD!" : "UNSOLD"}
      </div>

      <div style={{ fontSize: 19, fontWeight: 800, marginTop: 14 }}>{result.playerName}</div>
      {result.playerRole && (
        <div className="text-dim" style={{ fontSize: 13, marginTop: 2 }}>{result.playerRole}</div>
      )}

      {isSold ? (
        <div style={{ display: "flex", justifyContent: "space-around", marginTop: 18, borderTop: "1px solid var(--border)", paddingTop: 16 }}>
          <div>
            <div className="text-dim" style={{ fontSize: 11, fontWeight: 700 }}>SOLD TO</div>
            <div style={{ fontSize: 16, fontWeight: 800, marginTop: 4 }}>
              {result.teamName} {result.teamShortName ? `(${result.teamShortName})` : ""}
            </div>
          </div>
          <div>
            <div className="text-dim" style={{ fontSize: 11, fontWeight: 700 }}>FINAL PRICE</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: "var(--accent-2)", marginTop: 4 }}>
              ₹{result.amount}L
            </div>
          </div>
        </div>
      ) : (
        <p className="text-dim" style={{ fontSize: 13, marginTop: 16 }}>
          No bids were placed. This player can be re-auctioned later.
        </p>
      )}
    </div>
  );
}