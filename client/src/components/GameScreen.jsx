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
  } = payload;

  const canvasRef = useRef(null);
  const chatEndRef = useRef(null);

  const [isDrawing, setIsDrawing] = useState(false);
  const [prevCoord, setPrevCoord] = useState(null);
  const [chatInput, setChatInput] = useState("");

  const isDrawer = game && game.currentDrawerPlayerId === playerID;
  const isHost = room && room.hostPlayerID === playerID;
  const gameStatus = game && game.status ? game.status : "wating";

  // Auto-scroll chat to the bottom
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatMessages]);

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
      ctx.strokeStyle = "black";
      ctx.lineWidth = 3;
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
            color: "black",
            lineWidth: 3,
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
    setChatInput("");
  };

  return (
    <div>
      <h3>Game Screen</h3>
      <p>Status: {gameStatus}</p>
      <p>Round: {game ? game.currentRound : 0}</p>
      <p>Drawer Player: {game ? game.currentDrawerPlayerId : "None"}</p>
      <p>Word: {game && (game.word ? game.word : game.maskedWord)}</p>

      {isHost && gameStatus === "wating" && (
        <button onClick={onStartGame}>Start Game</button>
      )}

      <div style={{ display: "flex", gap: "20px", marginTop: "15px" }}>
        {/* Canvas panel */}
        <div>
          <canvas
            ref={canvasRef}
            width={600}
            height={400}
            style={{
              border: "2px solid #333",
              backgroundColor: "#fff",
              cursor: isDrawer ? "crosshair" : "not-allowed",
              display: "block",
              touchAction: "none",
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
            <button onClick={handleClearCanvas} style={{ marginTop: "10px" }}>
              Clear Canvas
            </button>
          )}
        </div>

        {/* Chat Feed & Input panel */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: "300px",
            height: "400px",
            border: "2px solid #333",
          }}
        >
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "10px",
              backgroundColor: "#fafafa",
              fontFamily: "sans-serif",
              fontSize: "14px",
            }}
          >
            {chatMessages &&
              chatMessages.map((msg, index) => {
                let style = { margin: "6px 0", wordBreak: "break-word" };
                if (msg.type === "system") {
                  style.color = "blue";
                  style.fontWeight = "bold";
                } else if (msg.type === "correct") {
                  style.color = "green";
                  style.fontWeight = "bold";
                } else if (msg.type === "join" || msg.type === "leave") {
                  style.color = "gray";
                  style.fontStyle = "italic";
                }
                return (
                  <div key={index} style={style}>
                    {msg.type === "chat" ? (
                      <>
                        <strong>{msg.nickname}:</strong> {msg.message}
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
            style={{ display: "flex", borderTop: "2px solid #333" }}
          >
            <input
              type="text"
              placeholder={
                isDrawer ? "Drawer cannot chat..." : "Type chat message..."
              }
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              disabled={isDrawer}
              style={{
                flex: 1,
                padding: "8px",
                border: "none",
                outline: "none",
              }}
            />
            <button
              type="submit"
              disabled={isDrawer}
              style={{ padding: "8px", cursor: "pointer" }}
            >
              Send
            </button>
          </form>
        </div>
      </div>

      <div style={{ marginTop: "15px" }}>
        <input
          type="text"
          placeholder="Submit Guess"
          value={payload.guess}
          onChange={(e) => payload.setGuess(e.target.value)}
          disabled={isDrawer}
        />
        <button onClick={payload.onSubmitGuess} disabled={isDrawer}>
          Submit Guess
        </button>
      </div>
    </div>
  );
}

export default GameScreen;
