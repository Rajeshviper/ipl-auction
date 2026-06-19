import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuction } from "../context/AuctionContext";
import { api } from "../utils/api";

const ROLES = [
  { id: "HOST", label: "Host", desc: "Create & control the auction", icon: "🎙️" },
  { id: "BUYER", label: "Buyer", desc: "Bid & buy players for your team", icon: "💰" },
  { id: "PARTICIPANT", label: "Participant", desc: "Watch the live auction", icon: "👀" },
];

export default function LoginPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { joinRoom } = useAuction();

  const linkRoomCode = params.get("room") || "";
  const [step, setStep] = useState(linkRoomCode ? "role" : "code"); // code -> role -> name/team -> joining
  const [roomCode, setRoomCode] = useState(linkRoomCode.toUpperCase());
  const [roomInfo, setRoomInfo] = useState(null);
  const [role, setRole] = useState(null);
  const [name, setName] = useState("");
  const [teamId, setTeamId] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (linkRoomCode) {
      validateRoomCode(linkRoomCode.toUpperCase());
    }
  }, []); // eslint-disable-line

  async function validateRoomCode(code) {
    setError("");
    setLoading(true);
    try {
      const { room } = await api.getRoom(code);
      setRoomInfo(room);
      setRoomCode(code);
      setStep("role");
    } catch (err) {
      setError("Auction not found. Check the link or code and try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleCreateAsHost() {
    navigate("/host/setup");
  }

  function selectRole(r) {
    setRole(r);
    setError("");
    setStep("details");
  }

  async function handleJoin() {
    if (!name.trim()) return setError("Please enter your name.");
    if (role === "BUYER" && !teamId) return setError("Please select a team.");
    setLoading(true);
    setError("");
    const res = await joinRoom({ roomCode, name: name.trim(), role, teamId });
    setLoading(false);
    if (!res.ok) {
      setError(res.error || "Could not join. Try again.");
      return;
    }
    if (role === "HOST") navigate("/host");
    else if (role === "BUYER") navigate("/buyer");
    else navigate("/watch");
  }

  return (
    <div className="screen" style={{ justifyContent: "center" }}>
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <div style={{ fontSize: 52 }}>🏏</div>
        <h1 style={{ fontSize: 26, margin: "8px 0 4px", fontWeight: 800 }}>IPL Live Auction</h1>
        <p className="text-dim" style={{ fontSize: 14, margin: 0 }}>
          Join the auction room from your phone
        </p>
      </div>

      {step === "code" && (
        <div className="card pop-in">
          <label style={{ fontSize: 13, fontWeight: 700, color: "var(--text-dim)" }}>
            ENTER AUCTION CODE
          </label>
          <input
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
            placeholder="e.g. AB12CD"
            maxLength={8}
            style={{
              width: "100%",
              marginTop: 8,
              padding: "14px",
              borderRadius: 12,
              border: "1px solid var(--border)",
              background: "var(--bg-card-2)",
              color: "var(--text)",
              fontSize: 20,
              letterSpacing: 4,
              textAlign: "center",
              fontWeight: 700,
            }}
          />
          {error && <p style={{ color: "var(--danger)", fontSize: 13, marginTop: 8 }}>{error}</p>}
          <button
            className="btn-primary"
            style={{ marginTop: 16 }}
            disabled={!roomCode || loading}
            onClick={() => validateRoomCode(roomCode)}
          >
            {loading ? "Checking..." : "Join Auction"}
          </button>
          <div style={{ textAlign: "center", margin: "18px 0 8px", color: "var(--text-dim)", fontSize: 13 }}>
            — or —
          </div>
          <button className="btn-secondary" onClick={handleCreateAsHost}>
            🎙️ Create New Auction as Host
          </button>
        </div>
      )}

      {step === "role" && roomInfo && (
        <div className="pop-in">
          <div className="card" style={{ marginBottom: 16, textAlign: "center" }}>
            <div className="text-dim" style={{ fontSize: 12, fontWeight: 700 }}>JOINING</div>
            <div style={{ fontSize: 18, fontWeight: 800, marginTop: 2 }}>{roomInfo.name}</div>
            <div className="text-dim" style={{ fontSize: 13, marginTop: 2 }}>Code: {roomInfo.roomCode}</div>
          </div>
          <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-dim)", marginBottom: 10 }}>
            SELECT YOUR ROLE
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {ROLES.map((r) => (
              <button
                key={r.id}
                className="card"
                style={{ display: "flex", alignItems: "center", gap: 14, textAlign: "left", width: "100%" }}
                onClick={() => selectRole(r.id)}
              >
                <span style={{ fontSize: 28 }}>{r.icon}</span>
                <span>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>{r.label}</div>
                  <div className="text-dim" style={{ fontSize: 12 }}>{r.desc}</div>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {step === "details" && (
        <div className="card pop-in">
          <label style={{ fontSize: 13, fontWeight: 700, color: "var(--text-dim)" }}>YOUR NAME</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter your name"
            style={{
              width: "100%",
              marginTop: 8,
              marginBottom: 16,
              padding: "14px",
              borderRadius: 12,
              border: "1px solid var(--border)",
              background: "var(--bg-card-2)",
              color: "var(--text)",
              fontSize: 16,
            }}
          />

          {role === "BUYER" && (
            <>
              <label style={{ fontSize: 13, fontWeight: 700, color: "var(--text-dim)" }}>SELECT YOUR TEAM</label>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
                {roomInfo.teams.length === 0 && (
                  <p className="text-dim" style={{ fontSize: 13 }}>No teams created yet. Ask the host to add teams.</p>
                )}
                {roomInfo.teams.map((t) => (
                  <button
                    key={t.id}
                    disabled={t.taken}
                    onClick={() => setTeamId(t.id)}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: 14,
                      borderRadius: 12,
                      border: teamId === t.id ? `2px solid ${t.logoColor}` : "1px solid var(--border)",
                      background: t.taken ? "rgba(255,255,255,0.03)" : "var(--bg-card-2)",
                      opacity: t.taken ? 0.5 : 1,
                      color: "var(--text)",
                    }}
                  >
                    <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ width: 10, height: 10, borderRadius: "50%", background: t.logoColor }} />
                      <span style={{ fontWeight: 700 }}>{t.name}</span>
                    </span>
                    <span className="text-dim" style={{ fontSize: 12 }}>
                      {t.taken ? "Taken" : `₹${t.totalPurse}L`}
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}

          {error && <p style={{ color: "var(--danger)", fontSize: 13, marginTop: 12 }}>{error}</p>}

          <button className="btn-primary" style={{ marginTop: 18 }} onClick={handleJoin} disabled={loading}>
            {loading ? "Joining..." : "Enter Auction Room →"}
          </button>
        </div>
      )}
    </div>
  );
}
