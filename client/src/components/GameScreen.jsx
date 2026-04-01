import React from "react";

function GameScreen({ payload }) {
  const { game, onStartGame } = payload;
  return (
    <>
      GameScreen
      <p>{game ? game.status : "No game available"}</p>
      <p>{game ? game.currentRound : 0} Rounds</p>
      <p>{game ? game.currentDrawerId : 0} Drawer</p>
      <button onClick={onStartGame}>Start Game</button>
    </>
  );
}

export default GameScreen;
