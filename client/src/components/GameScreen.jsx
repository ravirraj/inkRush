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
  } = payload;

  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [prevCoord, setPrevCoord] = useState(null);

  const isDrawer = game && game.currentDrawerPlayerId === playerID;
  const isHost = room && room.hostPlayerID === playerID;
  const gameStatus = game && game.status ? game.status : "wating";

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

      <div style={{ margin: "15px 0" }}>
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
