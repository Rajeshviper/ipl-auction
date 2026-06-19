import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../utils/api";
import { useAuction } from "../context/AuctionContext";

const TEAM_COLORS = ["#1d4ed8", "#facc15", "#dc2626", "#7c3aed", "#06b6d4", "#16a34a", "#ec4899", "#f97316"];
const PLAYER_ROLES = ["Batsman", "Bowler", "All-Rounder", "Wicketkeeper"];

export default function HostSetupPage() {
  const navigate = useNavigate();
  const { joinRoom } = useAuction();

  const [room, setRoom] = useState(null);
  const [tab, setTab] = useState("teams"); // teams | players
  const [teams, setTeams] = useState([]);
  const [players, setPlayers] = useState([]);
  const [hostName, setHostName] = useState("");
  const [auctionName, setAuctionName] = useState("My IPL Auction");
  const [creating, setCreating] = useState(false);

  // team form
  const [teamName, setTeamName] = useState("");
  const [teamShort, setTeamShort] = useState("");
  const [teamPurse, setTeamPurse] = useState(10000);

  // player form
  const [playerName, setPlayerName] = useState("");
  const [playerRole, setPlayerRole] = useState("Batsman");
  const [playerCountry, setPlayerCountry] = useState("");
  const [playerBase, setPlayerBase] = useState(20);
  const [bulkText, setBulkText] = useState("");

  async function handleCreateRoom() {
    if (!auctionName.trim()) return;
    setCreating(true);
    const { room: newRoom } = await api.createRoom(auctionName.trim());
    setRoom(newRoom);
    setCreating(false);
  }

  async function addTeam() {
    if (!teamName.trim() || !teamShort.trim()) return;
    const color = TEAM_COLORS[teams.length % TEAM_COLORS.length];
    const { team } = await api.createTeam(room.id, {
      name: teamName.trim(),
      shortName: teamShort.trim().toUpperCase(),
      totalPurse: Number(teamPurse),
      logoColor: color,
    });
    setTeams((prev) => [...prev, team]);
    setTeamName("");
    setTeamShort("");
  }

  async function removeTeam(id) {
    await api.deleteTeam(id);
    setTeams((prev) => prev.filter((t) => t.id !== id));
  }

  async function addPlayer() {
    if (!playerName.trim()) return;
    const { player } = await api.createPlayer(room.id, {
      name: playerName.trim(),
      role: playerRole,
      country: playerCountry.trim() || null,
      basePrice: Number(playerBase),
    });
    setPlayers((prev) => [...prev, player]);
    setPlayerName("");
    setPlayerCountry("");
  }

  async function removePlayer(id) {
    await api.deletePlayer(id);
    setPlayers((prev) => prev.filter((p) => p.id !== id));
  }

  async function addBulkPlayers() {
    // Expected format: Name, Role, Country, BasePrice  (one per line)
    const lines = bulkText.split("\n").map((l) => l.trim()).filter(Boolean);
    const parsed = lines.map((line) => {
      const [name, role, country, basePrice] = line.split(",").map((s) => s.trim());
      return {
        name,
        role: role || "Batsman",
        country: country || null,
        basePrice: basePrice ? Number(basePrice) : 20,
      };
    });
    if (parsed.length === 0) return;
    const { players: created } = await api.bulkCreatePlayers(room.id, parsed);
    setPlayers((prev) => [...prev, ...created]);
    setBulkText("");
  }

  async function goLive() {
    if (!hostName.trim()) return;
    const res = await joinRoom({ roomCode: room.roomCode, name: hostName.trim(), role: "HOST" });
    if (res.ok) navigate("/host");
  }

  const shareLink = room ? `${window.location.origin}/?room=${room.roomCode}` : "";

  if (!room) {
    return (
      <div className="screen" style={{ justifyContent: "center" }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 48 }}>🎙️</div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: "8px 0" }}>Create Auction</h1>
          <p className="text-dim" style={{ fontSize: 14 }}>You'll be the host & auctioneer</p>
        </div>
        <div className="card">
          <label style={{ fontSize: 13, fontWeight: 700, color: "var(--text-dim)" }}>AUCTION NAME</label>
          <input
            value={auctionName}
            onChange={(e) => setAuctionName(e.target.value)}
            style={inputStyle}
          />
          <button className="btn-primary" style={{ marginTop: 16 }} onClick={handleCreateRoom} disabled={creating}>
            {creating ? "Creating..." : "Create Auction Room"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="screen">
      <div style={{ textAlign: "center", marginBottom: 12 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, margin: "4px 0" }}>{room.name}</h1>
        <div className="card" style={{ padding: 10, marginTop: 8 }}>
          <div className="text-dim" style={{ fontSize: 11, fontWeight: 700 }}>SHARE THIS LINK TO INVITE</div>
          <div style={{ fontWeight: 700, fontSize: 14, marginTop: 4, wordBreak: "break-all" }}>{shareLink}</div>
          <button
            className="btn-secondary"
            style={{ marginTop: 8, fontSize: 13, padding: 10 }}
            onClick={() => navigator.clipboard?.writeText(shareLink)}
          >
            📋 Copy Link
          </button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button
          className={tab === "teams" ? "btn-primary" : "btn-secondary"}
          style={{ fontSize: 14, padding: 12 }}
          onClick={() => setTab("teams")}
        >
          Teams ({teams.length})
        </button>
        <button
          className={tab === "players" ? "btn-primary" : "btn-secondary"}
          style={{ fontSize: 14, padding: 12 }}
          onClick={() => setTab("players")}
        >
          Players ({players.length})
        </button>
      </div>

      <div className="scroll-list">
        {tab === "teams" && (
          <>
            <div className="card" style={{ marginBottom: 12 }}>
              <input placeholder="Team name e.g. Mumbai Indians" value={teamName} onChange={(e) => setTeamName(e.target.value)} style={inputStyle} />
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <input placeholder="Short (MI)" value={teamShort} onChange={(e) => setTeamShort(e.target.value)} style={{ ...inputStyle, marginTop: 0, flex: 1 }} maxLength={4} />
                <input
                  type="number"
                  placeholder="Purse (L)"
                  value={teamPurse}
                  onChange={(e) => setTeamPurse(e.target.value)}
                  style={{ ...inputStyle, marginTop: 0, flex: 1 }}
                />
              </div>
              <button className="btn-primary" style={{ marginTop: 10 }} onClick={addTeam}>+ Add Team</button>
            </div>
            {teams.map((t) => (
              <div key={t.id} className="card row" style={{ marginBottom: 8 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ width: 12, height: 12, borderRadius: "50%", background: t.logoColor }} />
                  <span>
                    <div style={{ fontWeight: 700 }}>{t.name} ({t.shortName})</div>
                    <div className="text-dim" style={{ fontSize: 12 }}>Purse: ₹{t.totalPurse}L</div>
                  </span>
                </span>
                <button onClick={() => removeTeam(t.id)} style={{ background: "none", color: "var(--danger)", fontSize: 18 }}>✕</button>
              </div>
            ))}
          </>
        )}

        {tab === "players" && (
          <>
            <div className="card" style={{ marginBottom: 12 }}>
              <input placeholder="Player name" value={playerName} onChange={(e) => setPlayerName(e.target.value)} style={inputStyle} />
              <select value={playerRole} onChange={(e) => setPlayerRole(e.target.value)} style={{ ...inputStyle, marginTop: 8 }}>
                {PLAYER_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <input placeholder="Country" value={playerCountry} onChange={(e) => setPlayerCountry(e.target.value)} style={{ ...inputStyle, marginTop: 0, flex: 1 }} />
                <input type="number" placeholder="Base (L)" value={playerBase} onChange={(e) => setPlayerBase(e.target.value)} style={{ ...inputStyle, marginTop: 0, flex: 1 }} />
              </div>
              <button className="btn-primary" style={{ marginTop: 10 }} onClick={addPlayer}>+ Add Player</button>
            </div>

            <div className="card" style={{ marginBottom: 12 }}>
              <div className="text-dim" style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                BULK ADD (one per line: Name, Role, Country, Base)
              </div>
              <textarea
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                placeholder={"Virat Kohli, Batsman, India, 200\nJasprit Bumrah, Bowler, India, 150"}
                rows={4}
                style={{ ...inputStyle, resize: "vertical" }}
              />
              <button className="btn-secondary" style={{ marginTop: 8 }} onClick={addBulkPlayers}>Add Bulk Players</button>
            </div>

            {players.map((p) => (
              <div key={p.id} className="card row" style={{ marginBottom: 8 }}>
                <span>
                  <div style={{ fontWeight: 700 }}>{p.name}</div>
                  <div className="text-dim" style={{ fontSize: 12 }}>{p.role} · {p.country || "—"} · Base ₹{p.basePrice}L</div>
                </span>
                <button onClick={() => removePlayer(p.id)} style={{ background: "none", color: "var(--danger)", fontSize: 18 }}>✕</button>
              </div>
            ))}
          </>
        )}
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <input placeholder="Your name (Host)" value={hostName} onChange={(e) => setHostName(e.target.value)} style={inputStyle} />
        <button
          className="btn-primary"
          style={{ marginTop: 10 }}
          onClick={goLive}
          disabled={teams.length === 0 || players.length === 0 || !hostName.trim()}
        >
          🚀 Enter Host Console
        </button>
        {(teams.length === 0 || players.length === 0) && (
          <p className="text-dim" style={{ fontSize: 12, marginTop: 6, textAlign: "center" }}>
            Add at least 1 team and 1 player to continue
          </p>
        )}
      </div>
    </div>
  );
}

const inputStyle = {
  width: "100%",
  marginTop: 8,
  padding: "12px",
  borderRadius: 10,
  border: "1px solid var(--border)",
  background: "var(--bg-card-2)",
  color: "var(--text)",
  fontSize: 15,
};
