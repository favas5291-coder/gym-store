let currentPlayer;

export function claimHomeVideo(player) {
  if (currentPlayer !== player) currentPlayer?.pause();
  currentPlayer = player;
}

export function releaseHomeVideo(player) {
  player?.pause();
  if (currentPlayer === player) currentPlayer = null;
}
