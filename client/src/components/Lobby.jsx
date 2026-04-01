import React from "react";

function Lobby({ room }) {
  console.log("ROOM IN LOBBY", room.players[0]);

  return (
    <>
      console.log(room)
      <h3>ROOM CODE {room.code}</h3>
      <h3>HOST PLAYER ID {room.hostPlayerID}</h3>
      <ul>
        
        {room.players.map((player) => (
          <li key={player.playerId}>{player.nickname}</li>
        ))}
      </ul>
    </>
  );
}

export default Lobby;
