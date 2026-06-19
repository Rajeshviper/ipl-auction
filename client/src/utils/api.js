const SERVER_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:4000";

async function request(path, options = {}) {
  const res = await fetch(`${SERVER_URL}/api${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await res.json();
  if (!res.ok || !data.ok) {
    throw new Error(data.error || "Request failed");
  }
  return data;
}

export const api = {
  createRoom: (name) => request("/rooms", { method: "POST", body: JSON.stringify({ name }) }),
  getRoom: (roomCode) => request(`/rooms/${roomCode}`),
  createTeam: (roomId, team) =>
    request(`/rooms/${roomId}/teams`, { method: "POST", body: JSON.stringify(team) }),
  deleteTeam: (teamId) => request(`/teams/${teamId}`, { method: "DELETE" }),
  updateTeamPurse: (teamId, totalPurse) =>
    request(`/teams/${teamId}`, { method: "PATCH", body: JSON.stringify({ totalPurse }) }),
  createPlayer: (roomId, player) =>
    request(`/rooms/${roomId}/players`, { method: "POST", body: JSON.stringify(player) }),
  bulkCreatePlayers: (roomId, players) =>
    request(`/rooms/${roomId}/players/bulk`, { method: "POST", body: JSON.stringify({ players }) }),
  deletePlayer: (playerId) => request(`/players/${playerId}`, { method: "DELETE" }),
  getPlayers: (roomId) => request(`/rooms/${roomId}/players`),
};
