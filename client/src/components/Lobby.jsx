import React from "react";

function Lobby({ room }) {
  return (
    <div className="retro-card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <span className="form-label" style={{ fontSize: "0.8rem", color: "var(--metallic-silver)" }}>Lobby Code</span>
          <h2 style={{ fontSize: "2rem", border: "none", padding: 0, margin: 0 }}>
            {room.code}
          </h2>
        </div>
        
        <div style={{ flex: 1, minWidth: "250px" }}>
          <span className="form-label" style={{ fontSize: "0.8rem", color: "var(--metallic-silver)" }}>Connected Players</span>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginTop: "0.5rem" }}>
            {room.players.map((player) => {
              const isHost = player.playerId === room.hostPlayerID;
              return (
                <div
                  key={player.playerId}
                  style={{
                    backgroundColor: "rgba(11, 11, 22, 0.6)",
                    border: `1.5px solid ${isHost ? "var(--hot-pink)" : "var(--neon-blue)"}`,
                    borderRadius: "0.5rem",
                    padding: "0.5rem 1rem",
                    fontSize: "0.9rem",
                    color: isHost ? "var(--hot-pink)" : "var(--cyan)",
                    textShadow: isHost ? "var(--shadow-pink)" : "var(--shadow-cyan)",
                    fontWeight: "bold",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem"
                  }}
                >
                  <span>{player.nickname}</span>
                  {isHost && (
                    <span style={{ fontSize: "0.7rem", opacity: 0.8, color: "var(--hot-pink)" }}>
                      [HOST]
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Lobby;
