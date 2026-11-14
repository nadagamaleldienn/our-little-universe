// Pure tic-tac-toe rules shared by every backend. Her = X, Him = O. X always starts.
export const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];

export function freshGame(scores) {
  return { board: Array(9).fill(null), turn: 'X', winner: null, line: null, scores: scores || { X: 0, O: 0, draw: 0 }, rev: 0, updatedAt: Date.now() };
}

// Returns the new game state, or null if the move is illegal.
export function applyMove(g, i, mark) {
  if (g.winner || g.board[i] || g.turn !== mark || i < 0 || i > 8) return null;
  const board = g.board.slice();
  board[i] = mark;
  let winner = null;
  let line = null;
  for (const l of LINES) {
    if (board[l[0]] && board[l[0]] === board[l[1]] && board[l[1]] === board[l[2]]) { winner = board[l[0]]; line = l; break; }
  }
  if (!winner && board.every(Boolean)) winner = 'draw';
  const scores = { ...g.scores };
  if (winner) scores[winner]++;
  return { ...g, board, turn: mark === 'X' ? 'O' : 'X', winner, line, scores, rev: (g.rev || 0) + 1, updatedAt: Date.now() };
}
