import React from "react";

function GameScreen({ payload }) {
  const { game, onStartGame } = payload;
  console.log(game);
  // console.log(turn);
  return (
    <>
      GameScreen
      <p>{game ? game.status : "No game available"}</p>
      <p>{game ? game.currentRound : 0} : Rounds</p>
      <p>{game ? game.currentDrawerPlayerId : 0} : Drawer</p>
      <p>{game && (game.word ? game.word : game.maskedWord)}</p>
      <button onClick={onStartGame}>Start Game</button>
    </>
  );
}

export default GameScreen;
