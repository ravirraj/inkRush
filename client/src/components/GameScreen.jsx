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
    revealedWord,
  } = payload;

  const canvasRef = useRef(null);
  const chatEndRef = useRef(null);
  const strokeHistoryRef = useRef([]);  // undo: array of stroke batches
  const currentBatchRef = useRef([]);   // undo: current stroke batch in progress

  const [isDrawing, setIsDrawing] = useState(false);
  const [prevCoord, setPrevCoord] = useState(null);
  const [chatInput, setChatInput] = useState("");
  const [brushColor, setBrushColor] = useState("#000000");
  const [brushSize, setBrushSize] = useState(3);
  const [isEraserMode, setIsEraserMode] = useState(false);
  const [timeLeft, setTimeLeft] = useState(null);

  const isDrawer = game && game.currentDrawerPlayerId === playerID;
  const isHost = room && room.hostPlayerID === playerID;
  const gameStatus = game && game.status ? game.status : "wating";

  // Fix: look up the drawer's nickname from room.players instead of showing raw player ID
  const drawerNickname =
    room?.players?.find((p) => p.playerId === game?.currentDrawerPlayerId)?.nickname ||
    "—";

  // Computed display word: drawer sees real word, correct guesser sees revealed word, others see masked
  const displayedWord = (() => {
    if (!game) return "";
    if (game.word) return game.word;
    if (hasGuessedCorrectly && revealedWord) return revealedWord;
    return game.maskedWord || "";
  })();

  // Number of letters in the word from the masked form (e.g. "_ _ _ _ _" → 5)
  const letterCount = game?.maskedWord
    ? (game.maskedWord.match(/_/g) || []).length
    : 0;

  const transitionDuration = turnSummary?.duration || 8;
  const transitionProgress = timeLeft !== null ? (timeLeft / transitionDuration) * 100 : 0;

  // ── Auto-scroll chat ────────────────────────────────────────────────────────
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatMessages]);

  // ── Local countdown timer ───────────────────────────────────────────────────
  useEffect(() => {
    let duration = 0;
    if (gameStatus === "selecting_word") {
      duration = 15;
    } else if (gameStatus === "in_progress") {
      duration = 80;
    } else if (gameStatus === "turn_transition") {
      duration = transitionDuration;
    } else {
      setTimeLeft(null);
      return;
    }
    setTimeLeft(duration);
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev === null || prev <= 1) { clearInterval(interval); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [gameStatus, game?.turnNumber, turnSummary]);

  // ── Clear canvas + stroke history on new turn ───────────────────────────────
  useEffect(() => {
    if (game && game.currentDrawerPlayerId) {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      strokeHistoryRef.current = [];
      currentBatchRef.current = [];
      setIsEraserMode(false);
    }
  }, [game?.currentDrawerPlayerId]);

  // ── Segment drawing helper (handles both pen and destination-out eraser) ────
  const drawSegment = (ctx, seg) => {
    ctx.beginPath();
    ctx.moveTo(seg.prevX, seg.prevY);
    ctx.lineTo(seg.currX, seg.currY);
    ctx.lineWidth = seg.lineWidth || 3;
    ctx.lineCap = "round";
    if (seg.isEraser) {
      ctx.save();
      ctx.globalCompositeOperation = "destination-out";
      ctx.strokeStyle = "rgba(0,0,0,1)";
      ctx.stroke();
      ctx.restore();
    } else {
      ctx.strokeStyle = seg.color || "#000000";
      ctx.stroke();
    }
  };

  // ── Hook up WebSocket draw / clear event listeners ──────────────────────────
  useEffect(() => {
    if (onDrawStrokeRef) {
      onDrawStrokeRef.current = (stroke) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        drawSegment(ctx, {
          prevX: stroke.prevX * canvas.width,
          prevY: stroke.prevY * canvas.height,
          currX: stroke.currentX * canvas.width,
          currY: stroke.currentY * canvas.height,
          color: stroke.color,
          lineWidth: stroke.lineWidth,
          isEraser: stroke.isEraser || false,
        });
      };
    }
    if (onDrawClearRef) {
      onDrawClearRef.current = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        strokeHistoryRef.current = [];
      };
    }
    return () => {
      if (onDrawStrokeRef) onDrawStrokeRef.current = null;
      if (onDrawClearRef) onDrawClearRef.current = null;
    };
  }, [onDrawStrokeRef, onDrawClearRef]);

  // ── Ctrl+Z keyboard shortcut for undo ──────────────────────────────────────
  useEffect(() => {
    if (!isDrawer) return;
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        e.preventDefault();
        triggerUndo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isDrawer]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Canvas coord helper ─────────────────────────────────────────────────────
  const getCoords = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const relX = (clientX - rect.left) / rect.width;
    const relY = (clientY - rect.top) / rect.height;
    return {
      x: relX * canvas.width,
      y: relY * canvas.height,
      normalizedX: relX,
      normalizedY: relY,
    };
  };

  // ── Drawing handlers ────────────────────────────────────────────────────────
  const handleStartDraw = (e) => {
    if (!isDrawer) return;
    const coords = getCoords(e);
    if (!coords) return;
    setIsDrawing(true);
    currentBatchRef.current = [];
    setPrevCoord({ x: coords.x, y: coords.y, normalizedX: coords.normalizedX, normalizedY: coords.normalizedY });
  };

  const handleDraw = (e) => {
    if (!isDrawer || !isDrawing || !prevCoord) return;
    const coords = getCoords(e);
    if (!coords) return;

    const canvas = canvasRef.current;
    if (canvas) {
      drawSegment(canvas.getContext("2d"), {
        prevX: prevCoord.x, prevY: prevCoord.y,
        currX: coords.x, currY: coords.y,
        color: brushColor, lineWidth: brushSize, isEraser: isEraserMode,
      });
    }

    // Store segment for undo replay (local canvas coords + normalized for broadcast)
    currentBatchRef.current.push({
      prevX: prevCoord.x, prevY: prevCoord.y,
      currX: coords.x, currY: coords.y,
      normPrevX: prevCoord.normalizedX, normPrevY: prevCoord.normalizedY,
      normCurrX: coords.normalizedX, normCurrY: coords.normalizedY,
      color: brushColor, lineWidth: brushSize, isEraser: isEraserMode,
    });

    if (wsRef?.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: "draw:stroke",
        payload: {
          playerId: playerID,
          prevX: prevCoord.normalizedX, prevY: prevCoord.normalizedY,
          currentX: coords.normalizedX, currentY: coords.normalizedY,
          color: brushColor, lineWidth: brushSize, isEraser: isEraserMode,
        },
      }));
    }

    setPrevCoord({ x: coords.x, y: coords.y, normalizedX: coords.normalizedX, normalizedY: coords.normalizedY });
  };

  const handleEndDraw = () => {
    if (currentBatchRef.current.length > 0) {
      strokeHistoryRef.current = [...strokeHistoryRef.current, [...currentBatchRef.current]];
      currentBatchRef.current = [];
    }
    setIsDrawing(false);
    setPrevCoord(null);
  };

  // ── Undo: pop last batch, re-draw rest locally, broadcast clear + replay ────
  const triggerUndo = () => {
    if (strokeHistoryRef.current.length === 0) return;
    strokeHistoryRef.current = strokeHistoryRef.current.slice(0, -1);

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const batch of strokeHistoryRef.current) {
      for (const seg of batch) drawSegment(ctx, seg);
    }

    if (wsRef?.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "draw:clear", payload: { playerId: playerID } }));
      // Re-broadcast remaining strokes after clear arrives
      setTimeout(() => {
        for (const batch of strokeHistoryRef.current) {
          for (const seg of batch) {
            if (wsRef.current?.readyState === WebSocket.OPEN) {
              wsRef.current.send(JSON.stringify({
                type: "draw:stroke",
                payload: {
                  playerId: playerID,
                  prevX: seg.normPrevX, prevY: seg.normPrevY,
                  currentX: seg.normCurrX, currentY: seg.normCurrY,
                  color: seg.color, lineWidth: seg.lineWidth, isEraser: seg.isEraser,
                },
              }));
            }
          }
        }
      }, 60);
    }
  };

  // ── Clear board ─────────────────────────────────────────────────────────────
  const handleClearCanvas = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    strokeHistoryRef.current = [];
    currentBatchRef.current = [];
    if (wsRef?.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "draw:clear", payload: { playerId: playerID } }));
    }
  };

  // ── Chat / guess send ───────────────────────────────────────────────────────
  const handleSendChat = (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    if (wsRef?.current?.readyState === WebSocket.OPEN) {
      if (gameStatus === "in_progress" && !isDrawer) {
        wsRef.current.send(JSON.stringify({ type: "guess:submit", payload: { playerId: playerID, guess: chatInput } }));
      } else {
        wsRef.current.send(JSON.stringify({ type: "chat:message", payload: { playerId: playerID, message: chatInput } }));
      }
    }
    setChatInput("");
  };

  const handleSelectWord = (word) => {
    if (wsRef?.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "word:select", payload: { playerId: playerID, word } }));
    }
  };

  const handlePlayAgain = () => {
    if (wsRef?.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "game:reset", payload: { playerId: playerID } }));
    }
  };

  // ── Color palette definition ────────────────────────────────────────────────
  const COLORS = ["#000000", "#ff006e", "#00ffff", "#0080ff", "#4caf50", "#ffd700", "#5d34d0", "#ff6b00"];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

      {/* ═══ TOP HUD BAR ═════════════════════════════════════════════════════ */}
      <div className="retro-card" style={{ padding: "1.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1.5rem" }}>

          {/* Logo */}
          <div style={{ display: "flex", alignItems: "center" }}>
            <span className="glitch-logo" style={{ fontSize: "1.8rem", margin: 0, paddingRight: "1.5rem", borderRight: "1.5px solid rgba(0, 128, 255, 0.25)", display: "inline-block" }}>
              inkRush
            </span>
          </div>

          {/* Match state badge + round */}
          <div>
            <span className="form-label" style={{ fontSize: "0.75rem", color: "var(--metallic-silver)" }}>Match State</span>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.25rem" }}>
              <span style={{
                backgroundColor: gameStatus === "in_progress" ? "rgba(0, 255, 255, 0.15)" : "rgba(255, 0, 110, 0.15)",
                border: `1.5px solid ${gameStatus === "in_progress" ? "var(--cyan)" : "var(--hot-pink)"}`,
                color: gameStatus === "in_progress" ? "var(--cyan)" : "var(--hot-pink)",
                textShadow: gameStatus === "in_progress" ? "var(--shadow-cyan)" : "var(--shadow-pink)",
                padding: "0.25rem 0.75rem", borderRadius: "4px", fontSize: "0.85rem",
                fontWeight: "bold", textTransform: "uppercase"
              }}>
                {gameStatus.replace(/_/g, " ")}
              </span>
              <span style={{ fontSize: "0.9rem", opacity: 0.8 }}>
                Round {game ? game.currentRound : 0}
              </span>
            </div>
          </div>

          {/* Countdown timer (only during active phases, not transition) */}
          {timeLeft !== null && gameStatus !== "turn_transition" && (
            <div style={{ textAlign: "center" }}>
              <span className="form-label" style={{ fontSize: "0.75rem", color: "var(--metallic-silver)" }}>Time Remaining</span>
              <div style={{
                fontSize: "1.8rem", fontWeight: "bold", marginTop: "0.25rem",
                color: timeLeft <= 10 ? "var(--hot-pink)" : "var(--cyan)",
                textShadow: timeLeft <= 10 ? "var(--shadow-pink)" : "var(--shadow-cyan)",
                animation: timeLeft <= 10 ? "flicker 0.5s infinite alternate" : "none"
              }}>
                {timeLeft}s
              </div>
            </div>
          )}

          {/* Word display — different for drawer / correct guesser / active guesser */}
          {gameStatus === "in_progress" && (
            <div style={{ textAlign: "center" }}>
              <span className="form-label" style={{ fontSize: "0.75rem", color: "var(--metallic-silver)" }}>
                {isDrawer
                  ? "Your Word"
                  : hasGuessedCorrectly
                    ? "✓ You Guessed It!"
                    : `Guess the Word · ${letterCount} letters`}
              </span>
              <div style={{
                fontSize: "1.5rem", color: "var(--cyan)", textShadow: "var(--shadow-cyan)",
                letterSpacing: "0.15rem", fontWeight: "bold", marginTop: "0.25rem"
              }}>
                {displayedWord}
              </div>
              {hasGuessedCorrectly && !isDrawer && (
                <div style={{ fontSize: "0.75rem", color: "rgba(192,192,192,0.6)", marginTop: "0.15rem" }}>
                  Waiting for others...
                </div>
              )}
            </div>
          )}

          {/* Host start / drawer info */}
          <div>
            {isHost && gameStatus === "wating" && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.5rem" }}>
                <button className="btn btn-primary" onClick={onStartGame} disabled={room.players.length < 3}>
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
                Drawer: <span style={{ color: "var(--hot-pink)", fontWeight: "bold" }}>
                  {isDrawer ? "YOU" : drawerNickname}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ═══ MAIN WORKSPACE ══════════════════════════════════════════════════ */}
      <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap", alignItems: "stretch" }}>

        {/* ─── WAITING ROOM PLACEHOLDER ─────────────────────────────────────── */}
        {gameStatus === "wating" && (
          <div className="retro-card" style={{
            flex: "3 1 1000px", minWidth: "320px", minHeight: "420px",
            display: "flex", flexDirection: "column", justifyContent: "center",
            alignItems: "center", gap: "1.5rem",
            backgroundColor: "rgba(11, 11, 22, 0.4)", textAlign: "center"
          }}>
            <div style={{
              fontSize: "clamp(2rem, 4vw, 3rem)", color: "var(--hot-pink)",
              textShadow: "var(--shadow-pink)", animation: "flicker 2s infinite alternate",
              fontFamily: "var(--font-mono)", letterSpacing: "0.1rem"
            }}>
              STAND BY
            </div>
            <p style={{ color: "var(--metallic-silver)", fontSize: "1rem", maxWidth: "380px", lineHeight: 1.8 }}>
              {isHost
                ? "You are the host. Share the invite link with friends, then click Start Game when everyone has joined."
                : `Waiting for ${room?.players?.find(p => p.playerId === room.hostPlayerID)?.nickname || "the host"} to start the match...`}
            </p>
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              {[0, 1, 2].map((i) => (
                <div key={i} style={{
                  width: "10px", height: "10px", borderRadius: "50%",
                  backgroundColor: "var(--cyan)", boxShadow: "var(--shadow-cyan)",
                  animation: `flicker ${0.8 + i * 0.3}s ${i * 0.25}s infinite alternate`,
                }} />
              ))}
            </div>
            {isHost && room && (
              <div style={{
                border: "1.5px solid rgba(0, 128, 255, 0.3)", borderRadius: "0.5rem",
                padding: "0.75rem 1.5rem", color: "var(--neon-blue)", fontSize: "0.85rem"
              }}>
                {room.players.length} / ∞ players connected
                {room.players.length < 3 && (
                  <span style={{ color: "var(--hot-pink)", marginLeft: "0.5rem" }}>
                    — need {3 - room.players.length} more
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {/* ─── GAME ACTIVE AREA ──────────────────────────────────────────────── */}
        {gameStatus !== "wating" && (
          <div style={{ flex: "3 1 1000px", minWidth: "320px", display: "flex", flexDirection: "column", gap: "1rem" }}>

            {/* WORD SELECTION */}
            {gameStatus === "selecting_word" ? (
              <div className="retro-card" style={{
                height: "400px", display: "flex", flexDirection: "column",
                justifyContent: "center", alignItems: "center",
                backgroundColor: "rgba(11, 11, 22, 0.4)", textAlign: "center"
              }}>
                {isDrawer ? (
                  <div>
                    <h3 style={{ marginBottom: "1.5rem" }}>Choose a word to draw</h3>
                    <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", justifyContent: "center" }}>
                      {wordOptions && wordOptions.map((word) => (
                        <button key={word} className="btn btn-secondary"
                          onClick={() => handleSelectWord(word)}
                          style={{ padding: "1rem 2rem", fontSize: "1.1rem" }}>
                          {word}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize: "1rem", color: "var(--metallic-silver)", marginBottom: "1.25rem" }}>
                      <span style={{ color: "var(--hot-pink)", fontWeight: "bold" }}>{drawerNickname}</span> is choosing a word...
                    </div>
                    <div style={{ animation: "flicker 1.5s infinite alternate", fontSize: "1.2rem", color: "var(--hot-pink)", textShadow: "var(--shadow-pink)" }}>
                      GET READY
                    </div>
                  </div>
                )}
              </div>

            ) : gameStatus === "turn_transition" ? (
              /* TURN TRANSITION SCOREBOARD */
              <div className="retro-card" style={{
                minHeight: "400px", display: "flex", flexDirection: "column",
                justifyContent: "center", alignItems: "center",
                backgroundColor: "rgba(11, 11, 22, 0.4)", fontFamily: "var(--font-mono)"
              }}>
                <h3 style={{ marginBottom: "0.5rem" }}>Round Summary</h3>
                <h4 style={{ margin: "0.5rem 0", color: "var(--metallic-silver)", textShadow: "none" }}>
                  The word was: <span style={{ color: "var(--cyan)", textShadow: "var(--shadow-cyan)", fontSize: "1.6rem" }}>{turnSummary?.correctWord}</span>
                </h4>

                <div style={{
                  margin: "1.5rem 0", width: "100%", maxWidth: "360px",
                  border: "1.5px solid var(--neon-blue)", borderRadius: "0.5rem",
                  padding: "1rem", backgroundColor: "rgba(11, 11, 22, 0.6)"
                }}>
                  <div style={{
                    display: "flex", justifyContent: "space-between",
                    borderBottom: "1px solid rgba(0, 128, 255, 0.2)",
                    paddingBottom: "0.25rem", marginBottom: "0.5rem"
                  }}>
                    <span className="form-label" style={{ margin: 0 }}>Player</span>
                    <div style={{ display: "flex", gap: "1rem" }}>
                      <span className="form-label" style={{ margin: 0 }}>Gained</span>
                      <span className="form-label" style={{ margin: 0, minWidth: "60px", textAlign: "right" }}>Total</span>
                    </div>
                  </div>
                  {room && [...(room.players || [])]
                    .sort((a, b) => (turnSummary?.totalScores?.[b.playerId] || 0) - (turnSummary?.totalScores?.[a.playerId] || 0))
                    .map((p) => {
                      const points = turnSummary?.gainedPoints?.[p.playerId] || 0;
                      const total = turnSummary?.totalScores?.[p.playerId] || 0;
                      return (
                        <div key={p.playerId} style={{
                          display: "flex", justifyContent: "space-between",
                          alignItems: "center", margin: "0.4rem 0", fontSize: "0.95rem"
                        }}>
                          <span>{p.nickname}</span>
                          <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
                            <span style={{
                              fontWeight: "bold", fontSize: "0.85rem", width: "35px", textAlign: "right",
                              color: points > 0 ? "var(--hot-pink)" : "rgba(192, 192, 192, 0.4)",
                              textShadow: points > 0 ? "var(--shadow-pink)" : "none",
                            }}>
                              {points > 0 ? `+${points}` : "0"}
                            </span>
                            <span style={{
                              fontWeight: "bold", minWidth: "60px", textAlign: "right",
                              color: "var(--cyan)", textShadow: "var(--shadow-cyan)",
                            }}>
                              {total} pts
                            </span>
                          </div>
                        </div>
                      );
                    })}
                </div>

                {/* Transition countdown bar */}
                <div style={{ width: "100%", maxWidth: "360px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
                    <p style={{ fontSize: "0.85rem", color: "var(--metallic-silver)", margin: 0 }}>
                      Next drawer: <span style={{ color: "var(--hot-pink)", fontWeight: "bold" }}>{turnSummary?.nextDrawerNickname}</span>
                    </p>
                    <span style={{ fontSize: "0.8rem", color: "rgba(192,192,192,0.5)" }}>{timeLeft}s</span>
                  </div>
                  <div style={{
                    background: "rgba(0, 128, 255, 0.12)", borderRadius: "4px",
                    height: "5px", overflow: "hidden", border: "1px solid rgba(0, 128, 255, 0.2)"
                  }}>
                    <div style={{
                      background: "var(--cyan)", boxShadow: "var(--shadow-cyan)",
                      height: "100%", borderRadius: "4px",
                      width: `${transitionProgress}%`, transition: "width 1s linear"
                    }} />
                  </div>
                </div>
              </div>

            ) : gameStatus === "ended" ? (
              /* GAME OVER */
              <div className="retro-card" style={{
                minHeight: "400px", display: "flex", flexDirection: "column",
                justifyContent: "center", alignItems: "center",
                backgroundColor: "rgba(11, 11, 22, 0.4)", fontFamily: "var(--font-mono)"
              }}>
                <h2 style={{ color: "var(--hot-pink)", textShadow: "var(--shadow-pink)", border: "none", marginBottom: "0.5rem" }}>
                  GAME OVER
                </h2>
                {gameSummary?.winners && (
                  <h3 style={{ margin: "0.5rem 0", color: "var(--gold)", textShadow: "0 0 10px rgba(255, 215, 0, 0.5)", fontSize: "1.6rem" }}>
                    WINNER: {gameSummary.winners.join(", ")}
                  </h3>
                )}
                <div style={{
                  margin: "1.5rem 0", width: "100%", maxWidth: "400px",
                  border: "1.5px solid var(--neon-blue)", borderRadius: "0.5rem",
                  padding: "1rem", backgroundColor: "rgba(11, 11, 22, 0.6)"
                }}>
                  <span className="form-label" style={{
                    display: "block", borderBottom: "1px solid rgba(0, 128, 255, 0.2)",
                    paddingBottom: "0.25rem", marginBottom: "0.5rem"
                  }}>
                    Final Standings
                  </span>
                  {gameSummary?.leaderboard?.map((entry, index) => {
                    const rankLabel = ["1st 🥇", "2nd 🥈", "3rd 🥉"][index] ?? `${index + 1}th`;
                    const entryColor = index === 0 ? "var(--gold)" : "var(--metallic-silver)";
                    const shadow = index === 0 ? "0 0 5px rgba(255, 215, 0, 0.3)" : "none";
                    return (
                      <div key={entry.playerId} style={{
                        display: "flex", justifyContent: "space-between",
                        padding: "0.5rem 0", borderBottom: "1px dashed rgba(192, 192, 192, 0.15)",
                        color: entryColor, textShadow: shadow, fontWeight: index === 0 ? "bold" : "normal"
                      }}>
                        <span>{rankLabel} — {entry.nickname}</span>
                        <span>{entry.score} pts</span>
                      </div>
                    );
                  })}
                </div>
                {isHost && (
                  <button className="btn btn-success" onClick={handlePlayAgain} style={{ marginTop: "1rem" }}>
                    Play Again
                  </button>
                )}
              </div>

            ) : (
              /* DRAWING CANVAS */
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {/* Canvas wrapper with GUESS MODE badge for non-drawers */}
                <div style={{ position: "relative" }}>
                  <canvas
                    ref={canvasRef}
                    width={1000}
                    height={650}
                    style={{
                      border: "1.5px solid var(--neon-blue)",
                      boxShadow: "var(--shadow-blue)",
                      borderRadius: "0.5rem",
                      backgroundColor: "#fff",
                      cursor: isDrawer ? (isEraserMode ? "cell" : "crosshair") : "default",
                      display: "block",
                      width: "100%",
                      height: "auto",
                      aspectRatio: "1000/650",
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
                  {/* Subtle mode badge for non-drawers */}
                  {!isDrawer && (
                    <div style={{
                      position: "absolute", top: "0.75rem", right: "0.75rem",
                      backgroundColor: "rgba(11, 11, 22, 0.8)",
                      border: `1px solid ${hasGuessedCorrectly ? "var(--cyan)" : "rgba(255,0,110,0.4)"}`,
                      borderRadius: "4px", padding: "0.25rem 0.6rem",
                      fontSize: "0.72rem",
                      color: hasGuessedCorrectly ? "var(--cyan)" : "var(--hot-pink)",
                      fontFamily: "var(--font-mono)", pointerEvents: "none",
                      textShadow: hasGuessedCorrectly ? "var(--shadow-cyan)" : "var(--shadow-pink)"
                    }}>
                      {hasGuessedCorrectly ? "✓ GUESSED" : "● GUESS MODE"}
                    </div>
                  )}
                </div>

                {/* Drawer toolbar */}
                {isDrawer && (
                  <div className="retro-card" style={{ display: "flex", flexDirection: "column", gap: "0.75rem", padding: "1rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "1rem" }}>
                      {/* Color palette + eraser */}
                      <div>
                        <span className="form-label" style={{ fontSize: "0.75rem", marginBottom: "0.5rem", display: "block" }}>Color Palette</span>
                        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
                          {COLORS.map((color) => (
                            <button
                              key={color}
                              type="button"
                              onClick={() => { setBrushColor(color); setIsEraserMode(false); }}
                              style={{
                                width: "28px", height: "28px", backgroundColor: color,
                                border: (!isEraserMode && brushColor === color) ? "2px solid #fff" : "1.5px solid rgba(192, 192, 192, 0.4)",
                                borderRadius: "4px", cursor: "pointer",
                                boxShadow: (!isEraserMode && brushColor === color) ? "0 0 8px rgba(255,255,255,0.8)" : "none",
                                transform: (!isEraserMode && brushColor === color) ? "scale(1.15)" : "scale(1)",
                                transition: "all 0.15s ease-out"
                              }}
                              title={color}
                            />
                          ))}
                          {/* Eraser tool */}
                          <button
                            type="button"
                            onClick={() => setIsEraserMode(true)}
                            title="Eraser (removes pixels)"
                            style={{
                              width: "32px", height: "28px",
                              backgroundColor: isEraserMode ? "rgba(255,255,255,0.15)" : "rgba(11,11,22,0.6)",
                              border: isEraserMode ? "2px solid #fff" : "1.5px solid rgba(192,192,192,0.4)",
                              borderRadius: "4px", cursor: "pointer",
                              boxShadow: isEraserMode ? "0 0 8px rgba(255,255,255,0.8)" : "none",
                              transform: isEraserMode ? "scale(1.15)" : "scale(1)",
                              transition: "all 0.15s ease-out",
                              color: "var(--metallic-silver)", fontSize: "13px",
                              display: "flex", alignItems: "center", justifyContent: "center"
                            }}
                          >
                            ⌫
                          </button>
                        </div>
                      </div>

                      {/* Brush size */}
                      <div>
                        <span className="form-label" style={{ fontSize: "0.75rem", marginBottom: "0.5rem", display: "block" }}>Brush Size</span>
                        <div style={{ display: "flex", gap: "0.5rem" }}>
                          {[{ label: "S", size: 3 }, { label: "M", size: 6 }, { label: "L", size: 12 }].map((b) => (
                            <button
                              key={b.size}
                              type="button"
                              className={brushSize === b.size ? "btn btn-primary" : "btn btn-secondary"}
                              onClick={() => setBrushSize(b.size)}
                              style={{ padding: "0.25rem 0.75rem", fontSize: "0.8rem", height: "28px", borderRadius: "4px" }}
                            >
                              {b.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Actions: Undo + Clear */}
                      <div style={{ display: "flex", gap: "0.5rem" }}>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={triggerUndo}
                          style={{ height: "32px", padding: "0 0.75rem", fontSize: "0.85rem" }}
                          title="Undo last stroke (Ctrl+Z)"
                        >
                          ↩ Undo
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={handleClearCanvas}
                          style={{ height: "32px", padding: "0 0.75rem", fontSize: "0.85rem" }}
                        >
                          Clear
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ─── CHAT PANEL ────────────────────────────────────────────────────── */}
        {gameStatus !== "wating" && (
          <div className="retro-card" style={{
            flex: "1 1 300px", minWidth: "250px",
            height: "100%", maxHeight: "720px",
            display: "flex", flexDirection: "column",
            padding: "1.25rem", overflow: "hidden",
            backgroundColor: "rgba(11, 11, 22, 0.6)"
          }}>
            <span className="form-label" style={{ borderBottom: "1.5px solid rgba(0, 128, 255, 0.2)", paddingBottom: "0.5rem", marginBottom: "0.5rem" }}>
              Comms Feed
            </span>
            <div style={{
              flex: 1, overflowY: "auto", overflowX: "hidden",
              padding: "0.5rem", display: "flex", flexDirection: "column",
              gap: "0.5rem", fontSize: "0.9rem", minHeight: 0
            }}>
              {chatMessages && chatMessages.map((msg, index) => {
                let color = "var(--metallic-silver)";
                let fontWeight = "normal";
                let fontStyle = "normal";
                if (msg.type === "system") { color = "var(--neon-blue)"; fontWeight = "bold"; }
                else if (msg.type === "correct") { color = "var(--cyan)"; fontWeight = "bold"; }
                else if (msg.type === "join" || msg.type === "leave") { color = "rgba(192, 192, 192, 0.5)"; fontStyle = "italic"; }
                return (
                  <div key={index} style={{ wordBreak: "break-word", color, fontWeight, fontStyle }}>
                    {msg.type === "chat"
                      ? <><strong style={{ color: "var(--hot-pink)" }}>{msg.nickname}:</strong> {msg.message}</>
                      : msg.message}
                  </div>
                );
              })}
              <div ref={chatEndRef} />
            </div>

            <form onSubmit={handleSendChat} style={{
              display: "flex", gap: "0.5rem", marginTop: "0.75rem",
              borderTop: "1px solid rgba(0, 128, 255, 0.15)", paddingTop: "0.75rem"
            }}>
              <input
                className="retro-input"
                type="text"
                placeholder={
                  isDrawer ? "Drawer cannot chat..."
                    : hasGuessedCorrectly ? "✓ You guessed it!"
                      : gameStatus === "in_progress" ? "Type your guess..."
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
