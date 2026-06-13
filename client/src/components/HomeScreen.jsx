import React, { useState } from "react";

function HomeScreen({ payload }) {
  const { nickname, setNickname, code, setCode, onCreateRoom, onJoinRoom, inviteCode } = payload;
  const isInviteFlow = Boolean(inviteCode);
  const [copied, setCopied] = useState(false);

  function handleCopyLink() {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="retro-card" style={{ maxWidth: "460px", margin: "2rem auto" }}>
      <h2 style={{ marginBottom: "0.25rem" }}>
        {isInviteFlow ? "You've been invited!" : "Access Terminal"}
      </h2>

      {isInviteFlow && (
        <div
          style={{
            backgroundColor: "rgba(0, 128, 255, 0.08)",
            border: "1.5px solid var(--neon-blue)",
            borderRadius: "0.5rem",
            padding: "0.75rem 1rem",
            marginBottom: "1.5rem",
            display: "flex",
            alignItems: "center",
            gap: "0.75rem"
          }}
        >
          <span style={{ fontSize: "1.2rem" }}>🎨</span>
          <div>
            <div style={{ fontSize: "0.75rem", color: "var(--metallic-silver)", textTransform: "uppercase", letterSpacing: "0.05rem" }}>
              Room Code
            </div>
            <div
              style={{
                fontSize: "1.4rem",
                fontWeight: "bold",
                color: "var(--cyan)",
                textShadow: "var(--shadow-cyan)",
                letterSpacing: "0.2rem"
              }}
            >
              {inviteCode}
            </div>
          </div>
        </div>
      )}

      <div className="form-group">
        <label className="form-label">Enter Nickname</label>
        <input
          className="retro-input"
          type="text"
          placeholder="e.g. CyberPainter"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              isInviteFlow ? onJoinRoom() : (code ? onJoinRoom() : onCreateRoom());
            }
          }}
          autoFocus
        />
      </div>

      {!isInviteFlow && (
        <div className="form-group" style={{ marginBottom: "1.5rem" }}>
          <label className="form-label">Room Code (to join existing)</label>
          <input
            className="retro-input"
            type="text"
            placeholder="e.g. X8Y2ZP — leave blank to create"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
          />
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginTop: isInviteFlow ? "0.5rem" : "0" }}>
        {isInviteFlow ? (
          <button
            className="btn btn-primary"
            onClick={onJoinRoom}
            disabled={!nickname.trim()}
            style={{ width: "100%" }}
          >
            ⚡ Join Room
          </button>
        ) : (
          <>
            <button
              className="btn btn-primary"
              onClick={code.trim() ? onJoinRoom : onCreateRoom}
              disabled={!nickname.trim()}
            >
              {code.trim() ? "⚡ Join Room" : "✦ Create Room"}
            </button>
            {code.trim() && (
              <button
                className="btn btn-secondary"
                onClick={onCreateRoom}
                disabled={!nickname.trim()}
                style={{ fontSize: "0.85rem" }}
              >
                Create a new room instead
              </button>
            )}
          </>
        )}
      </div>

      {!isInviteFlow && !code.trim() && (
        <p style={{ marginTop: "1rem", fontSize: "0.8rem", color: "rgba(192,192,192,0.5)", textAlign: "center" }}>
          Create a room, then share the link with friends to let them join instantly.
        </p>
      )}
    </div>
  );
}

export default HomeScreen;
