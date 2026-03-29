import { useState, useEffect, useRef } from "react";
import HomeScreen from "./components/HomeScreen";
import Lobby from "./components/Lobby";

function App() {
  const [nickname, setNickname] = useState("");
  const [code, setCode] = useState("");
  const wsRef = useRef(null);
  const pendingAction = useRef(null);
  const codeRef = useRef(code);

  useEffect(() => {
    codeRef.current = code;
  }, [code]);
  const [room, setRoom] = useState(null);

  const [playerID, setPlayerID] = useState("");

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
        default:
          console.log("Unknown message type:", msg.type);
      }
    };
    ws.onclose = () => {
      console.log("WebSocket connection closed");
    };
    ws.onerror = () => {
      console.log("WebSocket error");
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
  return (
    <>
      <h1>Hello </h1>

      {room ? (
        <Lobby room={room} />
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
    </>
  );
}

export default App;
