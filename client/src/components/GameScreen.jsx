import React, { useState, useEffect, useRef } from "react";

function GameScreen({ payload }) {
  const {
    room,
    game,
    onStartGame,
    onDrawStrokeRef,
    onDrawClearRef,
    wsRef,
    playerID,
    chatMessages,
    wordOptions,
    turnSummary,
    gameSummary,
    hasGuessedCorrectly,
  } = payload;

  const canvasRef = useRef(null);
  const chatEndRef = useRef(null);

  const [isDrawing, setIsDrawing] = useState(false);
  const [prevCoord, setPrevCoord] = useState(null);
  const [chatInput, setChatInput] = useState("");
  const [brushColor, setBrushColor] = useState("#000000");
  const [brushSize, setBrushSize] = useState(3);
  const [timeLeft, setTimeLeft] = useState(null);

  const isDrawer = game && game.currentDrawerPlayerId === playerID;
  const isHost = room && room.hostPlayerID === playerID;
  const gameStatus = game && game.status ? game.status : "wating";

  // Auto-scroll chat to the bottom
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatMessages]);

  // Handle local turn countdown (DESIGN.md Section 3 - micro-animations/motion)
  useEffect(() => {
    let duration = 0;
    if (gameStatus === "selecting_word") {
      duration = 15;
    } else if (gameStatus === "in_progress") {
      duration = 80;
    } else if (gameStatus === "turn_transition") {
      duration = turnSummary?.duration || 8;
    } else {
      setTimeLeft(null);
      return;
    }

    setTimeLeft(duration);
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [gameStatus, game?.turnNumber, turnSummary]);

  // Clear canvas on new turn
  useEffect(() => {
    if (game && game.currentDrawerPlayerId) {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
  }, [game?.currentDrawerPlayerId]);

  // Hook up WebSocket draw/clear event listeners
  useEffect(() => {
    if (onDrawStrokeRef) {
      onDrawStrokeRef.current = (stroke) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");

        const x1 = stroke.prevX * canvas.width;
        const y1 = stroke.prevY * canvas.height;
        const x2 = stroke.currentX * canvas.width;
        const y2 = stroke.currentY * canvas.height;

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = stroke.color || "black";
        ctx.lineWidth = stroke.lineWidth || 3;
        ctx.lineCap = "round";
        ctx.stroke();
      };
    }

    if (onDrawClearRef) {
      onDrawClearRef.current = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      };
    }

    return () => {
      if (onDrawStrokeRef) onDrawStrokeRef.current = null;
      if (onDrawClearRef) onDrawClearRef.current = null;
    };
  }, [onDrawStrokeRef, onDrawClearRef]);

  const getCoords = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();

    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    const relativeX = (clientX - rect.left) / rect.width;
    const relativeY = (clientY - rect.top) / rect.height;

    return {
      x: relativeX * canvas.width,
      y: relativeY * canvas.height,
      normalizedX: relativeX,
      normalizedY: relativeY,
    };
  };

  const handleStartDraw = (e) => {
    if (!isDrawer) return;
    const coords = getCoords(e);
    if (!coords) return;
    setIsDrawing(true);
    setPrevCoord({
      x: coords.x,
      y: coords.y,
      normalizedX: coords.normalizedX,
      normalizedY: coords.normalizedY,
    });
  };

  const handleDraw = (e) => {
    if (!isDrawer || !isDrawing || !prevCoord) return;
    const coords = getCoords(e);
    if (!coords) return;

    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      ctx.beginPath();
      ctx.moveTo(prevCoord.x, prevCoord.y);
      ctx.lineTo(coords.x, coords.y);
      ctx.strokeStyle = brushColor;
      ctx.lineWidth = brushSize;
      ctx.lineCap = "round";
      ctx.stroke();
    }

    if (wsRef && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: "draw:stroke",
          payload: {
            playerId: playerID,
            prevX: prevCoord.normalizedX,
            prevY: prevCoord.normalizedY,
            currentX: coords.normalizedX,
            currentY: coords.normalizedY,
            color: brushColor,
            lineWidth: brushSize,
          },
        }),
      );
    }

    setPrevCoord({
      x: coords.x,
      y: coords.y,
      normalizedX: coords.normalizedX,
      normalizedY: coords.normalizedY,
    });
  };

  const handleEndDraw = () => {
    setIsDrawing(false);
    setPrevCoord(null);
  };

  const handleClearCanvas = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    if (wsRef && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: "draw:clear",
          payload: {
            playerId: playerID,
          },
        }),
      );
    }
  };

  const handleSendChat = (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    if (wsRef && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      if (gameStatus === "in_progress" && !isDrawer) {
        // Transmit guess through the chat box
        wsRef.current.send(
          JSON.stringify({
            type: "guess:submit",
            payload: {
              playerId: playerID,
              guess: chatInput,
            },
          }),
        );
      } else {
        // Transmit regular chat message
        wsRef.current.send(
          JSON.stringify({
            type: "chat:message",
            payload: {
              playerId: playerID,
              message: chatInput,
            },
          }),
        );
      }
    }
    setChatInput("");
  };

  const handleSelectWord = (word) => {
    if (wsRef && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: "word:select",
          payload: {
            playerId: playerID,
            word: word,
          },
        }),
      );
    }
  };

  const handlePlayAgain = () => {
    if (wsRef && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: "game:reset",
          payload: { playerId: playerID },
        }),
      );
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* HUD status dashboard */}
      <div className="retro-card" style={{ padding: "1.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <span className="form-label" style={{ fontSize: "0.75rem", color: "var(--metallic-silver)" }}>Match State</span>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.25rem" }}>
              <span 
                style={{
                  backgroundColor: gameStatus === "in_progress" ? "rgba(0, 255, 255, 0.15)" : "rgba(255, 0, 110, 0.15)",
                  border: `1.5px solid ${gameStatus === "in_progress" ? "var(--cyan)" : "var(--hot-pink)"}`,
                  color: gameStatus === "in_progress" ? "var(--cyan)" : "var(--hot-pink)",
                  textShadow: gameStatus === "in_progress" ? "var(--shadow-cyan)" : "var(--shadow-pink)",
                  padding: "0.25rem 0.75rem",
                  borderRadius: "4px",
                  fontSize: "0.85rem",
                  fontWeight: "bold",
                  textTransform: "uppercase"
                }}
              >
                {gameStatus.replace("_", " ")}
              </span>
              <span style={{ fontSize: "0.9rem", opacity: 0.8 }}>
                Round {game ? game.currentRound : 0}
              </span>
            </div>
          </div>

          {timeLeft !== null && (
            <div style={{ textAlign: "center" }}>
              <span className="form-label" style={{ fontSize: "0.75rem", color: "var(--metallic-silver)" }}>Time Remaining</span>
              <div 
                style={{ 
                  fontSize: "1.8rem", 
                  color: timeLeft <= 10 ? "var(--hot-pink)" : "var(--cyan)", 
                  textShadow: timeLeft <= 10 ? "var(--shadow-pink)" : "var(--shadow-cyan)",
                  fontWeight: "bold",
                  marginTop: "0.25rem",
                  animation: timeLeft <= 10 ? "flicker 0.5s infinite alternate" : "none"
                }}
              >
                {timeLeft}s
              </div>
            </div>
          )}

          {gameStatus === "in_progress" && (
            <div style={{ textAlign: "center" }}>
              <span className="form-label" style={{ fontSize: "0.75rem", color: "var(--metallic-silver)" }}>Active Secret Word</span>
              <div 
                style={{ 
                  fontSize: "1.5rem", 
                  color: "var(--cyan)", 
                  textShadow: "var(--shadow-cyan)", 
                  letterSpacing: "0.15rem", 
                  fontWeight: "bold",
                  marginTop: "0.25rem"
                }}
              >
                {game && (game.word ? game.word : game.maskedWord)}
              </div>
            </div>
          )}

          <div>
            {isHost && gameStatus === "wating" && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.5rem" }}>
                <button 
                  className="btn btn-primary" 
                  onClick={onStartGame}
                  disabled={room.players.length < 3}
                >
                  Start Game
                </button>
                {room.players.length < 3 && (
                  <span style={{ fontSize: "0.8rem", color: "var(--hot-pink)", textShadow: "var(--shadow-pink)" }}>
                    Need at least 3 players
                  </span>
                )}
              </div>
            )}
            {gameStatus !== "wating" && gameStatus !== "ended" && (
              <div style={{ fontSize: "0.9rem", opacity: 0.8, textAlign: "right" }}>
                Drawer: <span style={{ color: "var(--hot-pink)", fontWeight: "bold" }}>{isDrawer ? "YOU" : (game ? game.currentDrawerPlayerId : "None")}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Game Interface Workspace */}
      <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap", alignItems: "stretch" }}>
        {/* Left Side: Game Active Screen (Canvas, Word choice, summaries, results) */}
        {gameStatus !== "wating" && (
          <div style={{ flex: "3 1 900px", minWidth: "320px", display: "flex", flexDirection: "column", gap: "1rem" }}>
            {gameStatus === "selecting_word" ? (
              <div
                className="retro-card"
                style={{
                  height: "400px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  alignItems: "center",
                  backgroundColor: "rgba(11, 11, 22, 0.4)",
                  textAlign: "center"
                }}
              >
                {isDrawer ? (
                  <div>
                    <h3 style={{ marginBottom: "1.5rem" }}>Choose a word to draw</h3>
                    <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", justifyContent: "center" }}>
                      {wordOptions &&
                        wordOptions.map((word) => (
                          <button
                            key={word}
                            className="btn btn-secondary"
                            onClick={() => handleSelectWord(word)}
                            style={{ padding: "1rem 2rem", fontSize: "1.1rem" }}
                          >
                            {word}
                          </button>
                        ))}
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={{ animation: "flicker 1.5s infinite alternate", fontSize: "1.2rem", color: "var(--hot-pink)", textShadow: "var(--shadow-pink)" }}>
                      DRAWER IS SELECTING WORD...
                    </div>
                  </div>
                )}
              </div>
            ) : gameStatus === "turn_transition" ? (
              <div
                className="retro-card"
                style={{
                  height: "400px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  alignItems: "center",
                  backgroundColor: "rgba(11, 11, 22, 0.4)",
                  fontFamily: "var(--font-mono)"
                }}
              >
                <h3 style={{ marginBottom: "0.5rem" }}>Round Summary</h3>
                <h4 style={{ margin: "0.5rem 0", color: "var(--metallic-silver)", textShadow: "none" }}>
                  The word was: <span style={{ color: "var(--cyan)", textShadow: "var(--shadow-cyan)", fontSize: "1.6rem" }}>{turnSummary?.correctWord}</span>
                </h4>

                <div
                  style={{
                    margin: "1.5rem 0",
                    width: "100%",
                    maxWidth: "320px",
                    border: "1.5px solid var(--neon-blue)",
                    borderRadius: "0.5rem",
                    padding: "1rem",
                    backgroundColor: "rgba(11, 11, 22, 0.6)"
                  }}
                >
                  <span className="form-label" style={{ display: "block", borderBottom: "1px solid rgba(0, 128, 255, 0.2)", paddingBottom: "0.25rem", marginBottom: "0.5rem" }}>
                    Scores this turn
                  </span>
                  {room &&
                    room.players.map((p) => {
                      const points = turnSummary?.gainedPoints?.[p.playerId] || 0;
                      return (
                        <div
                          key={p.playerId}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            margin: "0.25rem 0",
                            fontSize: "0.95rem"
                          }}
                        >
                          <span>{p.nickname}</span>
                          <span
                            style={{
                              fontWeight: "bold",
                              color: points > 0 ? "var(--cyan)" : "var(--metallic-silver)",
                              textShadow: points > 0 ? "var(--shadow-cyan)" : "none"
                            }}
                          >
                            {points > 0 ? `+${points}` : "0"}
                          </span>
                        </div>
                      );
                    })}
                </div>

                <p style={{ fontSize: "0.9rem", color: "var(--metallic-silver)" }}>
                  Next drawer: <span style={{ color: "var(--hot-pink)", fontWeight: "bold" }}>{turnSummary?.nextDrawerNickname}</span>
                </p>
              </div>
            ) : gameStatus === "ended" ? (
              <div
                className="retro-card"
                style={{
                  minHeight: "400px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  alignItems: "center",
                  backgroundColor: "rgba(11, 11, 22, 0.4)",
                  fontFamily: "var(--font-mono)"
                }}
              >
                <h2 style={{ color: "var(--hot-pink)", textShadow: "var(--shadow-pink)", border: "none", marginBottom: "0.5rem" }}>
                  GAME OVER
                </h2>
                {gameSummary && gameSummary.winners && (
                  <h3 style={{ margin: "0.5rem 0", color: "var(--gold)", textShadow: "0 0 10px rgba(255, 215, 0, 0.5)", fontSize: "1.6rem" }}>
                    WINNER: {gameSummary.winners.join(", ")}
                  </h3>
                )}

                <div
                  style={{
                    margin: "1.5rem 0",
                    width: "100%",
                    maxWidth: "400px",
                    border: "1.5px solid var(--neon-blue)",
                    borderRadius: "0.5rem",
                    padding: "1rem",
                    backgroundColor: "rgba(11, 11, 22, 0.6)"
                  }}
                >
                  <span className="form-label" style={{ display: "block", borderBottom: "1px solid rgba(0, 128, 255, 0.2)", paddingBottom: "0.25rem", marginBottom: "0.5rem" }}>
                    Final Standings
                  </span>
                  {gameSummary && gameSummary.leaderboard &&
                    gameSummary.leaderboard.map((entry, index) => {
                      let rankText = `${index + 1}th`;
                      let entryColor = "var(--metallic-silver)";
                      let entryShadow = "none";
                      if (index === 0) {
                        rankText = "1st 🥇";
                        entryColor = "var(--gold)";
                        entryShadow = "0 0 5px rgba(255, 215, 0, 0.3)";
                      } else if (index === 1) {
                        rankText = "2nd 🥈";
                      } else if (index === 2) {
                        rankText = "3rd 🥉";
                      }

                      return (
                        <div
                          key={entry.playerId}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            padding: "0.5rem 0",
                            borderBottom: "1px dashed rgba(192, 192, 192, 0.15)",
                            color: entryColor,
                            textShadow: entryShadow,
                            fontWeight: index === 0 ? "bold" : "normal"
                          }}
                        >
                          <span>{rankText} - {entry.nickname}</span>
                          <span>{entry.score} pts</span>
                        </div>
                      );
                    })
                  }
                </div>

                {isHost && (
                  <button className="btn btn-success" onClick={handlePlayAgain} style={{ marginTop: "1rem" }}>
                    Play Again
                  </button>
                )}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                <canvas
                  ref={canvasRef}
                  width={600}
                  height={400}
                  style={{
                    border: "1.5px solid var(--neon-blue)",
                    boxShadow: "var(--shadow-blue)",
                    borderRadius: "0.5rem",
                    backgroundColor: "#fff",
                    cursor: isDrawer ? "crosshair" : "not-allowed",
                    display: "block",
                    width: "100%",
                    height: "auto",
                    aspectRatio: "3/2",
                    touchAction: "none"
                  }}
                  onMouseDown={handleStartDraw}
                  onMouseMove={handleDraw}
                  onMouseUp={handleEndDraw}
                  onMouseLeave={handleEndDraw}
                  onTouchStart={handleStartDraw}
                  onTouchMove={handleDraw}
                  onTouchEnd={handleEndDraw}
                />
                {isDrawer && (
                  <div className="retro-card" style={{ display: "flex", flexDirection: "column", gap: "1rem", marginTop: "1rem", padding: "1rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
                      {/* Color swatches selector */}
                      <div>
                        <span className="form-label" style={{ fontSize: "0.75rem", marginBottom: "0.5rem", display: "block" }}>Color Palette</span>
                        <div style={{ display: "flex", gap: "0.5rem" }}>
                          {[
                            "#000000", // Black
                            "#ff006e", // Pink
                            "#00ffff", // Cyan
                            "#0080ff", // Blue
                            "#4caf50", // Green
                            "#ffd700", // Gold
                            "#5d34d0", // Purple
                            "#ffffff"  // Eraser / White
                          ].map((color) => (
                            <button
                              key={color}
                              type="button"
                              onClick={() => setBrushColor(color)}
                              style={{
                                width: "28px",
                                height: "28px",
                                backgroundColor: color,
                                border: brushColor === color ? "2px solid #fff" : "1.5px solid rgba(192, 192, 192, 0.4)",
                                borderRadius: "4px",
                                cursor: "pointer",
                                boxShadow: brushColor === color ? "0 0 8px rgba(255, 255, 255, 0.8)" : "none",
                                transform: brushColor === color ? "scale(1.15)" : "scale(1)",
                                transition: "all 0.15s ease-out"
                              }}
                              title={color === "#ffffff" ? "Eraser" : color}
                            />
                          ))}
                        </div>
                      </div>

                      {/* Brush sizes selector */}
                      <div>
                        <span className="form-label" style={{ fontSize: "0.75rem", marginBottom: "0.5rem", display: "block" }}>Brush Size</span>
                        <div style={{ display: "flex", gap: "0.5rem" }}>
                          {[
                            { label: "S", size: 3 },
                            { label: "M", size: 6 },
                            { label: "L", size: 12 }
                          ].map((b) => (
                            <button
                              key={b.size}
                              type="button"
                              className={brushSize === b.size ? "btn btn-primary" : "btn btn-secondary"}
                              onClick={() => setBrushSize(b.size)}
                              style={{ padding: "0.25rem 0.75rem", fontSize: "0.8rem", height: "28px", borderRadius: "4px" }}
                            >
                              {b.label} ({b.size}px)
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Clear action */}
                      <div style={{ alignSelf: "flex-end" }}>
                        <button type="button" className="btn btn-secondary" onClick={handleClearCanvas} style={{ height: "32px", padding: "0 1rem", fontSize: "0.85rem" }}>
                          Clear Board
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Right Side: Chat Panel Feed (DESIGN.md Section 11) */}
        {gameStatus !== "wating" && (
          <div
            className="retro-card"
            style={{
              flex: "1 1 300px",
              minWidth: "250px",
              height: "450px",
              display: "flex",
              flexDirection: "column",
              padding: "1.25rem",
              backgroundColor: "rgba(11, 11, 22, 0.6)"
            }}
          >
            <span className="form-label" style={{ borderBottom: "1.5px solid rgba(0, 128, 255, 0.2)", paddingBottom: "0.5rem", marginBottom: "0.5rem" }}>
              Comms Feed
            </span>
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: "0.5rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
                fontSize: "0.9rem"
              }}
            >
              {chatMessages &&
                chatMessages.map((msg, index) => {
                  let color = "var(--metallic-silver)";
                  let fontWeight = "normal";
                  let fontStyle = "normal";
                  let prefix = "";

                  if (msg.type === "system") {
                    color = "var(--neon-blue)";
                    fontWeight = "bold";
                  } else if (msg.type === "correct") {
                    color = "var(--cyan)";
                    fontWeight = "bold";
                  } else if (msg.type === "join" || msg.type === "leave") {
                    color = "rgba(192, 192, 192, 0.5)";
                    fontStyle = "italic";
                  }

                  return (
                    <div key={index} style={{ wordBreak: "break-word", color, fontWeight, fontStyle }}>
                      {msg.type === "chat" ? (
                        <>
                          <strong style={{ color: "var(--hot-pink)" }}>{msg.nickname}:</strong> {msg.message}
                        </>
                      ) : (
                        msg.message
                      )}
                    </div>
                  );
                })}
              <div ref={chatEndRef} />
            </div>

            <form
              onSubmit={handleSendChat}
              style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem", borderTop: "1px solid rgba(0, 128, 255, 0.15)", paddingTop: "0.75rem" }}
            >
              <input
                className="retro-input"
                type="text"
                placeholder={
                  isDrawer 
                    ? "Drawer cannot chat..." 
                    : hasGuessedCorrectly 
                      ? "You guessed correct!" 
                      : "Transmit message..."
                }
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                disabled={isDrawer || hasGuessedCorrectly}
                style={{ flex: 1, padding: "0.5rem", fontSize: "0.9rem" }}
              />
              <button
                className="btn btn-primary"
                type="submit"
                disabled={isDrawer || hasGuessedCorrectly}
                style={{ padding: "0.5rem 1rem", fontSize: "0.9rem" }}
              >
                Send
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

export default GameScreen;
