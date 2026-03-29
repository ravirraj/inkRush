import React from "react";

function HomeScreen({ payload }) {
  return (
    <>
      <div>HomeScreen</div>
      Enter your nickname:
      <input
        type="text"
        value={payload.nickname}
        onChange={(e) => payload.setNickname(e.target.value)}
      />
      Enter room code:
      <input
        type="text"
        value={payload.code}
        onChange={(e) => payload.setCode(e.target.value)}
      />
      {console.log(payload.code)}
      <br />
      <br />
      <button onClick={payload.onCreateRoom}>Create Room</button>
      <br />
      <br />
      <button onClick={payload.onJoinRoom}>Join Room</button>
    </>
  );
}

export default HomeScreen;
