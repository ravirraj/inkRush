import React from "react";

function HomeScreen({ payload }) {
  return (
    <div className="retro-card" style={{ maxWidth: "450px", margin: "2rem auto" }}>
      <h2>Access Terminal</h2>
      
      <div className="form-group">
        <label className="form-label">Enter Nickname</label>
        <input
          className="retro-input"
          type="text"
          placeholder="e.g. CyberPainter"
          value={payload.nickname}
          onChange={(e) => payload.setNickname(e.target.value)}
        />
      </div>

      <div className="form-group" style={{ marginBottom: "2rem" }}>
        <label className="form-label">Enter Room Code</label>
        <input
          className="retro-input"
          type="text"
          placeholder="e.g. X8Y2ZP"
          value={payload.code}
          onChange={(e) => payload.setCode(e.target.value)}
        />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <button className="btn btn-primary" onClick={payload.onCreateRoom}>
          Create Room
        </button>
        <button className="btn btn-secondary" onClick={payload.onJoinRoom}>
          Join Room
        </button>
      </div>
    </div>
  );
}

export default HomeScreen;
