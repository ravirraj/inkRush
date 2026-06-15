import { useState, useEffect, useRef } from "react";
import HomeScreen from "./components/HomeScreen";
import Lobby from "./components/Lobby";
import GameScreen from "./components/GameScreen";
import { useWebSocket } from "./hooks/useWebSocket";

function App() {
  const [nickname, setNickname] = useState("");

  // Read invite code from URL on first load (?room=XXXXXX)
  const urlParams = new URLSearchParams(window.location.search);
  const urlRoomCode = urlParams.get("room") || "";

  const [code, setCode] = useState(urlRoomCode);
  const wsRef = useRef(null);
  const pendingAction = useRef(null);
  const codeRef = useRef(urlRoomCode);
  const onDrawStrokeRef = useRef(null);
  const onDrawClearRef = useRef(null);

  useEffect(() => {
    codeRef.current = code;
  }, [code]);

  const [room, setRoom] = useState(null);
  const [game, setGame] = useState(null);
  const [error, setError] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [wordOptions, setWordOptions] = useState([]);
  const [turnSummary, setTurnSummary] = useState(null);
  const [gameSummary, setGameSummary] = useState(null);
  const [hasGuessedCorrectly, setHasGuessedCorrectly] = useState(false);

  const [playerID, setPlayerID] = useState("");
  const [guess, setGuess] = useState("");
  const [revealedWord, setRevealedWord] = useState("");

  const handleWebSocketEvent = (msg) => {
    switch (msg.type) {
      case "session:ready":
        console.log("Session is ready");
        const newPlayer = msg.payload.playerId;
        setPlayerID(newPlayer);

        sessionStorage.setItem("inkrush_player_id", newPlayer);
        sessionStorage.setItem(
          "inkrush_nickname",
          msg.payload.nickname || nickname,
        );

        if (pendingAction.current === "create") {
          sendEvent("room:create", { playerId: newPlayer });
        }
        if (pendingAction.current === "join") {
          sendEvent("room:join", {
            code: codeRef.current,
            playerId: newPlayer,
          });
        }
        break;

      case "room:ready":
        setRoom(msg.payload);

        sessionStorage.setItem("inkrush_room_code", msg.payload.code);

        if (!game || game.status === "wating") {
          setChatMessages([]);
          setWordOptions([]);
          setTurnSummary(null);
          setGameSummary(null);
          setHasGuessedCorrectly(false);
        }
        pendingAction.current = null;
        window.history.replaceState({}, "", `?room=${msg.payload.code}`);
        break;

      case "game:started":
        setGame(msg.payload);
        setGameSummary(null);
        setHasGuessedCorrectly(false);
        break;

      case "turn:started":
        setGame(msg.payload);
        setWordOptions([]);
        setTurnSummary(null);
        setGameSummary(null);
        setHasGuessedCorrectly(false);
        setRevealedWord("");
        setChatMessages([]);
        break;

      case "word:options":
        setGame(msg.payload);
        setWordOptions(msg.payload.words || []);
        setTurnSummary(null);
        setGameSummary(null);
        setHasGuessedCorrectly(false);
        break;

      case "word:selecting":
        setGame(msg.payload);
        setTurnSummary(null);
        setGameSummary(null);
        setHasGuessedCorrectly(false);
        setRevealedWord("");
        break;

      case "system:error":
        setError(msg.payload.ErrorMessage);
        if (
          msg.payload.ErrorMessage.includes("invalid") ||
          msg.payload.ErrorMessage.includes("does not exist") ||
          msg.payload.ErrorMessage.includes("Not Present")
        ) {
          sessionStorage.removeItem("inkrush_room_code");
          sessionStorage.removeItem("inkrush_player_id");
          sessionStorage.removeItem("inkrush_nickname");
          setRoom(null);
          setGame(null);
        }
        setTimeout(() => setError(null), 5000);
        break;

      case "guess:result":
        if (msg.payload.playerId === playerID && msg.payload.isCorrect) {
          setHasGuessedCorrectly(true);
          if (msg.payload.correctWord) setRevealedWord(msg.payload.correctWord);
        }
        setGame((prevGame) => {
          if (!prevGame) return null;
          return {
            ...prevGame,
            scores: msg.payload.score,
          };
        });
        break;

      case "game:ended":
        setGame((prevGame) => {
          if (!prevGame) return null;
          return {
            ...prevGame,
            status: "ended",
          };
        });
        setGameSummary(msg.payload);
        break;

      case "turn:ended":
        setGame((prevGame) => {
          if (!prevGame) return null;
          return {
            ...prevGame,
            status: "turn_transition",
            scores: msg.payload.totalScores,
          };
        });
        setTurnSummary(msg.payload);
        break;

      case "draw:stroke":
        console.log("RECEIVED DRAW", msg.payload);
        if (onDrawStrokeRef.current) {
          onDrawStrokeRef.current(msg.payload);
        }
        break;

      case "draw:clear":
        if (onDrawClearRef.current) {
          onDrawClearRef.current(msg.payload);
        }
        break;

      case "chat:message":
        setChatMessages((prev) => {
          const next = [...prev, msg.payload];
          return next.length > 80 ? next.slice(next.length - 80) : next;
        });
        break;

      case "hint:reveal":
        setGame((prevGame) => {
          if (!prevGame) return null;
          return { ...prevGame, maskedWord: msg.payload.maskedWord };
        });
        break;

      default:
        console.log("Unknown message type:", msg.type);
    }
  };

  const { sendEvent, ws, isOpen } = useWebSocket(
    import.meta.env.VITE_WS_URL,
    handleWebSocketEvent,
  );

  // Sync the raw ws Ref and trigger reconnection if saved state exists and socket is fully OPEN
  useEffect(() => {
    if (ws) {
      wsRef.current = ws;
    } else {
      wsRef.current = null;
    }

    if (isOpen) {
      const savedPlayerID = sessionStorage.getItem("inkrush_player_id");
      const savedNickname = sessionStorage.getItem("inkrush_nickname");
      const savedRoomCode = sessionStorage.getItem("inkrush_room_code");

      if (savedPlayerID && savedNickname) {
        console.log("Reconnecting session:", savedPlayerID, savedRoomCode);
        sendEvent("session:reconnect", {
          playerId: savedPlayerID,
          nickname: savedNickname,
          code: savedRoomCode || "",
        });
      }
    }
  }, [ws, isOpen]);

  function onCreateRoom() {
    if (playerID) {
      sendEvent("room:create", { playerId: playerID });
      return;
    }
    pendingAction.current = "create";
    sendEvent("session:init", { nickname: nickname });
  }

  function onJoinRoom() {
    if (playerID) {
      sendEvent("room:join", { code: codeRef.current, playerId: playerID });
      return;
    }
    pendingAction.current = "join";
    sendEvent("session:init", { nickname: nickname });
  }

  function onStartGame() {
    sendEvent("game:start", { playerId: playerID });
  }

  function onSubmitGuess() {
    sendEvent("guess:submit", { playerId: playerID, guess: guess });
    setGuess("");
  }
  return (
    <div className="app-terminal">
      {room ? (
        <div
          style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}
        >
          <GameScreen
            payload={{
              room,
              game,
              onStartGame,
              guess,
              setGuess,
              onSubmitGuess,
              onDrawStrokeRef,
              onDrawClearRef,
              wsRef,
              sendEvent,
              playerID,
              chatMessages,
              wordOptions,
              turnSummary,
              gameSummary,
              hasGuessedCorrectly,
              revealedWord,
            }}
          />
          <Lobby room={room} />
        </div>
      ) : (
        <>
          <header className="glitch-logo">inkRush</header>
          <HomeScreen
            payload={{
              nickname,
              setNickname,
              code,
              setCode,
              onCreateRoom,
              onJoinRoom,
              inviteCode: urlRoomCode,
            }}
          />
        </>
      )}

      {error && <div className="error-alert">WARNING: {error}</div>}
    </div>
  );
}

export default App;
