import React from "react";

function Lobby({ room }) {
  console.log("ROOM IN LOBBY", room);

  return (
    <>
      <h3>ROOM CODE {room.code}</h3>
      <h3>HOST PLAYER ID {room.hostPlayerID}</h3>
      <ul>
        <li>
          {room.players.map((player) => (
            <li key={player}> Player : {player}</li>
          ))}
        </li>
      </ul>
    </>
  );
}

export default Lobby;
