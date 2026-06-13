import { useState, useEffect, useRef } from "react";
import HomeScreen from "./components/HomeScreen";
import Lobby from "./components/Lobby";
import GameScreen from "./components/GameScreen";

function App() {
  const [nickname, setNickname] = useState("");
  const [code, setCode] = useState("");
  const wsRef = useRef(null);
  const pendingAction = useRef(null);
  const codeRef = useRef(code);
  const onDrawStrokeRef = useRef(null);
  const onDrawClearRef = useRef(null);

  useEffect(() => {
    codeRef.current = code;
  }, [code]);
  const [room, setRoom] = useState(null);
  const [game, setGame] = useState(null);
  const [error, setError] = useState(null);
  // const [turn, setTurn] = useState(null);

  const [playerID, setPlayerID] = useState("");
  const [guess, setGuess] = useState("");

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
          console.log("Room is ready:", msg.payload);
          pendingAction.current = null;
          break;

        case "game:started":
          console.log("Game has started:", msg.payload);
          setGame(msg.payload);
          break;

        case "turn:started":
          console.log("Turn has started:", msg.payload);
          setGame(msg.payload);
          break;

        case "system:error":
          console.log("Error from server:", msg.payload);
          setError(msg.payload.ErrorMessage);
          break;

        case "guess:result":
          console.log("Guess result:", msg.payload);
          setGame(msg.payload);
          break;

        case "game:ended":
          console.log("Game has ended:", msg.payload);
          // setGame(msg.payload);
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
    <>
      <h1>Hello </h1>

      {room ? (
        <>
          <Lobby room={room} />
          <GameScreen
            payload={{ room, game, onStartGame, guess, setGuess, onSubmitGuess, onDrawStrokeRef, onDrawClearRef, wsRef, playerID }}
          />
        </>
      ) : (
        <HomeScreen
          payload={{
            nickname,
            setNickname,
            code,
            setCode,
            onCreateRoom,
            onJoinRoom,
          }}
        />
      )}

      {error && <p style={{ color: "red" }}>{error}</p>}
    </>
  );
}

export default App;
