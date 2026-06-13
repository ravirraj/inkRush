import { useState, useEffect, useRef } from "react";
import HomeScreen from "./components/HomeScreen";
import Lobby from "./components/Lobby";
import GameScreen from "./components/GameScreen";

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
  // const [turn, setTurn] = useState(null);

  const [playerID, setPlayerID] = useState("");
  const [guess, setGuess] = useState("");
  const [revealedWord, setRevealedWord] = useState("");

  useEffect(() => {
    let ws = new WebSocket("ws://localhost:8080/ws");

    wsRef.current = ws;

    ws.onopen = () => {
      console.log("WebSocket connection established");
    };

    ws.onmessage = (e) => {
      console.log(e);

      let msg = JSON.parse(e.data);
      console.log(msg.type);

      switch (msg.type) {
        case "session:ready":
          console.log("Session is ready");
          const newPlayer = msg.payload.playerId;
          setPlayerID(newPlayer);
          console.log(playerID);
          if (pendingAction.current === "create") {
            console.log("in create");
            // Handle create room logic
            ws.send(
              JSON.stringify({
                type: "room:create",
                payload: { playerId: newPlayer },
              }),
            );
          }

          if (pendingAction.current === "join") {
            // Handle join room logic
            console.log("in join");
            console.log("new player ID:", newPlayer);

            console.log("code", codeRef.current);

            ws.send(
              JSON.stringify({
                type: "room:join",
                payload: { code: codeRef.current, playerId: newPlayer },
              }),
            );
          }
          break;
        case "room:ready":
          setRoom(msg.payload);
          setChatMessages([]);
          setWordOptions([]);
          setTurnSummary(null);
          setGameSummary(null);
          setHasGuessedCorrectly(false);
          console.log("Room is ready:", msg.payload);
          pendingAction.current = null;
          // Push room code into URL so the host can share the invite link
          window.history.replaceState({}, "", `?room=${msg.payload.code}`);
          break;

        case "game:started":
          console.log("Game has started:", msg.payload);
          setGame(msg.payload);
          setGameSummary(null);
          setHasGuessedCorrectly(false);
          break;

        case "turn:started":
          console.log("Turn has started:", msg.payload);
          setGame(msg.payload);
          setWordOptions([]);
          setTurnSummary(null);
          setGameSummary(null);
          setHasGuessedCorrectly(false);
          setRevealedWord("");
          setChatMessages([]);
          break;

        case "word:options":
          console.log("Word options received:", msg.payload);
          setGame(msg.payload);
          setWordOptions(msg.payload.words || []);
          setTurnSummary(null);
          setGameSummary(null);
          setHasGuessedCorrectly(false);
          break;

        case "word:selecting":
          console.log("Drawer is selecting a word:", msg.payload);
          setGame(msg.payload);
          setTurnSummary(null);
          setGameSummary(null);
          setHasGuessedCorrectly(false);
          setRevealedWord("");
          // Note: do NOT clear chat here — wait for turn:started
          break;

        case "system:error":
          console.log("Error from server:", msg.payload);
          setError(msg.payload.ErrorMessage);
          // Auto-dismiss the error after 5 seconds
          setTimeout(() => setError(null), 5000);
          break;

        case "guess:result":
          console.log("Guess result:", msg.payload);
          if (msg.payload.playerId === playerID && msg.payload.isCorrect) {
            setHasGuessedCorrectly(true);
            // Store the revealed word for this player
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
          console.log("Game has ended:", msg.payload);
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
          console.log("Turn ended summary:", msg.payload);
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
          console.log("Chat message received:", msg.payload);
          setChatMessages((prev) => {
            const next = [...prev, msg.payload];
            // Keep at most 80 messages — trim oldest from the top
            return next.length > 80 ? next.slice(next.length - 80) : next;
          });
          break;
        default:
          console.log("Unknown message type:", msg.type);
      }
    };
    ws.onclose = () => {
      console.log("WebSocket connection closed");
    };
    ws.onerror = (e) => {
      console.log("WebSocket error");
      setError("WebSocket error occurred");
      console.log(e);
    };

    return () => {
      ws.close();
    };
  }, []);

  function onCreateRoom() {
    console.log("Creating room");

    if (playerID) {
      console.log("Player ID already set:", playerID);
      wsRef.current.send(
        JSON.stringify({
          type: "room:create",
          payload: { playerId: playerID },
        }),
      );
      return;
    }
    pendingAction.current = "create";
    console.log(pendingAction.current);

    wsRef.current.send(
      JSON.stringify({
        type: "session:init",
        payload: { nickname: nickname },
      }),
    );
  }
  function onJoinRoom() {
    if (playerID) {
      console.log("Player ID already set:", playerID);
      wsRef.current.send(
        JSON.stringify({
          type: "room:join",
          payload: { code: codeRef.current, playerId: playerID },
        }),
      );
      return;
    }
    pendingAction.current = "join";
    wsRef.current.send(
      JSON.stringify({
        type: "session:init",
        payload: { nickname: nickname },
      }),
    );
  }
  function onStartGame() {
    console.log("gamr sretfdfedfefgrfsgfdf");
    wsRef.current.send(
      JSON.stringify({
        type: "game:start",
        payload: { playerId: playerID },
      }),
    );
  }

  function onSubmitGuess() {
    console.log("Submitting guess:", guess);
    wsRef.current.send(
      JSON.stringify({
        type: "guess:submit",
        payload: { playerId: playerID, guess: guess },
      }),
    );
    setGuess("");
  }
  return (
    <div className="app-terminal">
      {room ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          <GameScreen
            payload={{ room, game, onStartGame, guess, setGuess, onSubmitGuess, onDrawStrokeRef, onDrawClearRef, wsRef, playerID, chatMessages, wordOptions, turnSummary, gameSummary, hasGuessedCorrectly, revealedWord }}
          />
          <Lobby room={room} />
        </div>
      ) : (
        <>
          <header className="glitch-logo">
            inkRush
          </header>
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
