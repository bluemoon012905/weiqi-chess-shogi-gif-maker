const FILES = ["a", "b", "c", "d", "e", "f", "g", "h", "i"];
const RANKS = ["9", "8", "7", "6", "5", "4", "3", "2", "1", "0"];
const START_FEN =
  "rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w";
const PIECE_META = {
  K: { side: "red", glyph: "帅", label: "Red General" },
  A: { side: "red", glyph: "仕", label: "Red Advisor" },
  B: { side: "red", glyph: "相", label: "Red Elephant" },
  N: { side: "red", glyph: "马", label: "Red Horse" },
  R: { side: "red", glyph: "車", label: "Red Chariot" },
  C: { side: "red", glyph: "炮", label: "Red Cannon" },
  P: { side: "red", glyph: "兵", label: "Red Soldier" },
  k: { side: "black", glyph: "将", label: "Black General" },
  a: { side: "black", glyph: "士", label: "Black Advisor" },
  b: { side: "black", glyph: "象", label: "Black Elephant" },
  n: { side: "black", glyph: "马", label: "Black Horse" },
  r: { side: "black", glyph: "車", label: "Black Chariot" },
  c: { side: "black", glyph: "砲", label: "Black Cannon" },
  p: { side: "black", glyph: "卒", label: "Black Soldier" },
};

const PALETTE_ORDER = ["K", "A", "B", "N", "R", "C", "P", "k", "a", "b", "n", "r", "c", "p", "."];

const state = {
  mode: "edit",
  turn: "w",
  board: createEmptyBoard(),
  baseBoard: createEmptyBoard(),
  baseTurn: "w",
  history: [],
  playbackIndex: 0,
  selectedSquare: null,
  legalTargets: [],
  paletteSelection: ".",
  generatedGifBlob: null,
  generatedGifUrl: "",
  previewTimer: null,
};

const LISHU_FONT_FAMILY =
  '"STLiti", "LiSu", "Baoli SC", "Songti SC", "Bitter", serif';
const PIECE_FONT_FAMILY = LISHU_FONT_FAMILY;
const RIVER_FONT_FAMILY = LISHU_FONT_FAMILY;
const UI_FONT_FAMILY = LISHU_FONT_FAMILY;

const boardElement = document.querySelector("#board");
const paletteElement = document.querySelector("#palette");
const modePill = document.querySelector("#mode-pill");
const turnPill = document.querySelector("#turn-pill");
const selectionLabel = document.querySelector("#selection-label");
const moveLogSummary = document.querySelector("#move-log-summary");
const playbackSummary = document.querySelector("#playback-summary");
const fenInput = document.querySelector("#fen-input");
const movesInput = document.querySelector("#moves-input");
const sideSelect = document.querySelector("#side-select");
const delayInput = document.querySelector("#delay-input");
const endDelayInput = document.querySelector("#end-delay-input");
const gifStatus = document.querySelector("#gif-status");
const gifPreview = document.querySelector("#gif-preview");
const playToggleButton = document.querySelector("#play-toggle");
const undoMoveButton = document.querySelector("#undo-move");
const stepBackButton = document.querySelector("#step-back");
const stepForwardButton = document.querySelector("#step-forward");
const playSequenceButton = document.querySelector("#play-sequence");
const downloadGifButton = document.querySelector("#download-gif");
const copyGifButton = document.querySelector("#copy-gif");

void init();

async function init() {
  buildCoordinateLabels();
  buildPalette();
  buildBoard();
  loadFen(START_FEN);
  attachEventListeners();
  syncInputsFromState();
  await ensureFontsReady();
  render();
}

async function ensureFontsReady() {
  if (!document.fonts?.load) {
    return;
  }

  await Promise.allSettled([
    document.fonts.load(`700 32px ${PIECE_FONT_FAMILY}`, "帅"),
    document.fonts.load(`700 32px ${PIECE_FONT_FAMILY}`, "砲"),
    document.fonts.load(`700 32px ${RIVER_FONT_FAMILY}`, "楚河"),
    document.fonts.load(`600 16px ${UI_FONT_FAMILY}`, "a9"),
  ]);
}

function createEmptyBoard() {
  return Array.from({ length: 10 }, () => Array(9).fill(null));
}

function cloneBoard(board) {
  return board.map((row) => [...row]);
}

function buildCoordinateLabels() {
  const top = document.querySelector("#files-top");
  const left = document.querySelector("#ranks-left");

  FILES.forEach((file) => {
    top.append(createCoord(file));
  });

  RANKS.forEach((rank) => {
    left.append(createCoord(rank));
  });
}

function createCoord(text) {
  const span = document.createElement("span");
  span.textContent = text;
  return span;
}

function buildPalette() {
  paletteElement.innerHTML = "";

  PALETTE_ORDER.forEach((piece) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "palette-option";
    button.dataset.piece = piece;

    if (piece === ".") {
      const badge = document.createElement("span");
      badge.className = "palette-piece erase-piece";
      badge.setAttribute("aria-hidden", "true");
      button.append(badge);
    } else {
      const badge = document.createElement("span");
      badge.className = "palette-piece";
      badge.classList.add(PIECE_META[piece].side);
      badge.textContent = PIECE_META[piece].glyph;
      button.append(badge);
    }

    button.addEventListener("click", () => {
      state.paletteSelection = piece;
      renderPalette();
      selectionLabel.textContent =
        piece === "."
          ? "Erase mode active. Click an intersection to remove its piece."
          : `${PIECE_META[piece].label} selected. Click an intersection to place it.`;
    });

    paletteElement.append(button);
  });
}

function buildBoard() {
  boardElement.innerHTML = "";

  for (let y = 0; y < 10; y += 1) {
    for (let x = 0; x < 9; x += 1) {
      const square = document.createElement("button");
      square.type = "button";
      square.className = "square";
      square.dataset.x = String(x);
      square.dataset.y = String(y);
      square.addEventListener("click", () => handleSquareClick(x, y));
      boardElement.append(square);
    }
  }
}

function attachEventListeners() {
  playToggleButton.addEventListener("click", () => {
    state.mode = state.mode === "edit" ? "play" : "edit";
    clearSelection();
    render();
  });

  turnPill.addEventListener("click", () => {
    state.turn = state.turn === "w" ? "b" : "w";
    state.baseTurn = state.turn;
    clearSelection();
    render();
  });

  document.querySelector("#clear-board").addEventListener("click", () => {
    state.board = createEmptyBoard();
    state.baseBoard = createEmptyBoard();
    state.history = [];
    state.playbackIndex = 0;
    state.turn = "w";
    state.baseTurn = "w";
    clearSelection();
    syncInputsFromState();
    render();
  });

  document.querySelector("#reset-start").addEventListener("click", () => {
    loadFen(START_FEN);
    state.history = [];
    state.playbackIndex = 0;
    render();
  });

  document.querySelector("#load-fen").addEventListener("click", () => {
    try {
      loadFen(`${fenInput.value.trim()} ${sideSelect.value}`.trim());
      state.history = [];
      state.playbackIndex = 0;
      clearSelection();
      render();
    } catch (error) {
      window.alert(error.message);
    }
  });

  document.querySelector("#import-game").addEventListener("click", () => {
    try {
      importGame();
      clearSelection();
      render();
    } catch (error) {
      window.alert(error.message);
    }
  });

  undoMoveButton.addEventListener("click", () => undoLastMove());
  stepBackButton.addEventListener("click", () => stepPlayback(-1));
  stepForwardButton.addEventListener("click", () => stepPlayback(1));

  playSequenceButton.addEventListener("click", async () => {
    if (!state.history.length) {
      window.alert("Import a game or play some moves first.");
      return;
    }

    if (state.previewTimer) {
      window.clearInterval(state.previewTimer);
      state.previewTimer = null;
      playSequenceButton.textContent = "Preview Sequence";
      return;
    }

    const delay = Math.max(100, Number(delayInput.value) || 650);
    playSequenceButton.textContent = "Stop Preview";
    state.playbackIndex = 0;
    applyPlaybackIndex();

    state.previewTimer = window.setInterval(() => {
      if (state.playbackIndex >= state.history.length) {
        window.clearInterval(state.previewTimer);
        state.previewTimer = null;
        playSequenceButton.textContent = "Preview Sequence";
        return;
      }

      state.playbackIndex += 1;
      applyPlaybackIndex();
    }, delay);
  });

  document.querySelector("#render-gif").addEventListener("click", () => renderGif());
  downloadGifButton.addEventListener("click", downloadGif);
  copyGifButton.addEventListener("click", copyGif);
}

function render() {
  renderPalette();
  renderBoard();
  renderStatus();
  syncInputsFromState();
}

function renderPalette() {
  paletteElement.querySelectorAll(".palette-option").forEach((button) => {
    button.classList.toggle("active", button.dataset.piece === state.paletteSelection);
  });
}

function renderBoard() {
  const squares = boardElement.querySelectorAll(".square");

  squares.forEach((square) => {
    const x = Number(square.dataset.x);
    const y = Number(square.dataset.y);
    const piece = state.board[y][x];
    square.classList.toggle(
      "selected",
      state.selectedSquare && state.selectedSquare.x === x && state.selectedSquare.y === y
    );
    square.classList.toggle(
      "legal",
      state.legalTargets.some((target) => target.x === x && target.y === y)
    );
    square.innerHTML = "";

    if (piece) {
      const token = document.createElement("span");
      token.className = `piece ${PIECE_META[piece].side}`;
      token.textContent = PIECE_META[piece].glyph;
      token.title = PIECE_META[piece].label;
      square.append(token);
    }
  });
}

function renderStatus() {
  modePill.textContent = state.mode === "edit" ? "Editor" : "Play";
  turnPill.textContent = state.turn === "w" ? "Red To Move" : "Black To Move";
  turnPill.classList.toggle("turn-red", state.turn === "w");
  turnPill.classList.toggle("turn-black", state.turn === "b");
  playToggleButton.textContent =
    state.mode === "edit" ? "Switch To Play Mode" : "Switch To Edit Mode";

  moveLogSummary.textContent = state.history.length
    ? `${state.history.length} move${state.history.length === 1 ? "" : "s"} recorded. Latest: ${state.history[state.history.length - 1].notation}.`
    : "No moves recorded.";

  playbackSummary.textContent = state.history.length
    ? `Viewing ply ${state.playbackIndex} of ${state.history.length}.`
    : "The current board is the live working position.";

  stepBackButton.disabled = state.playbackIndex <= 0;
  stepForwardButton.disabled = state.playbackIndex >= state.history.length;
  undoMoveButton.disabled = state.history.length === 0;
}

function syncInputsFromState() {
  fenInput.value = boardToFen(state.baseBoard);
  sideSelect.value = state.baseTurn;
  movesInput.value = state.history.map((move) => move.notation).join(" ");
}

function handleSquareClick(x, y) {
  if (state.mode === "edit") {
    applyEditorAction(x, y);
    return;
  }

  const piece = state.board[y][x];

  if (state.selectedSquare) {
    const isLegalTarget = state.legalTargets.some((target) => target.x === x && target.y === y);

    if (isLegalTarget) {
      const move = {
        from: { ...state.selectedSquare },
        to: { x, y },
      };
      applyMove(move, true);
      clearSelection();
      render();
      return;
    }
  }

  if (!piece) {
    clearSelection();
    render();
    return;
  }

  const side = PIECE_META[piece].side === "red" ? "w" : "b";
  if (side !== state.turn) {
    return;
  }

  state.selectedSquare = { x, y };
  state.legalTargets = getLegalMovesForPiece(state.board, x, y);
  render();
}

function applyEditorAction(x, y) {
  const nextBoard = cloneBoard(state.board);
  nextBoard[y][x] = state.paletteSelection === "." ? null : state.paletteSelection;
  state.board = nextBoard;
  state.baseBoard = cloneBoard(nextBoard);
  state.history = [];
  state.playbackIndex = 0;
  state.baseTurn = state.turn;
  state.turn = state.baseTurn;
  render();
}

function clearSelection() {
  state.selectedSquare = null;
  state.legalTargets = [];
}

function loadFen(rawFen) {
  const fen = rawFen.trim();
  if (!fen) {
    throw new Error("Paste a FEN string first.");
  }

  const parts = fen.split(/\s+/);
  const placement = parts[0];
  const turn = parts[1] === "b" ? "b" : "w";
  const rows = placement.split("/");

  if (rows.length !== 10) {
    throw new Error("Xiangqi FEN must contain 10 ranks.");
  }

  const board = createEmptyBoard();
  rows.forEach((row, y) => {
    let x = 0;
    for (const char of row) {
      if (/\d/.test(char)) {
        x += Number(char);
      } else {
        if (!PIECE_META[char]) {
          throw new Error(`Unknown piece in FEN: ${char}`);
        }
        board[y][x] = char;
        x += 1;
      }
    }
    if (x !== 9) {
      throw new Error(`Rank ${10 - y} does not contain 9 files.`);
    }
  });

  state.board = board;
  state.baseBoard = cloneBoard(board);
  state.turn = turn;
  state.baseTurn = turn;
}

function boardToFen(board) {
  const rows = board.map((row) => {
    let emptyCount = 0;
    let output = "";

    row.forEach((piece) => {
      if (!piece) {
        emptyCount += 1;
      } else {
        if (emptyCount) {
          output += String(emptyCount);
          emptyCount = 0;
        }
        output += piece;
      }
    });

    if (emptyCount) {
      output += String(emptyCount);
    }

    return output;
  });

  return rows.join("/");
}

function importGame() {
  const hasFen = fenInput.value.trim().length > 0;
  loadFen(hasFen ? `${fenInput.value.trim()} ${sideSelect.value}` : START_FEN);

  const tokens = movesInput.value
    .trim()
    .split(/[\s,]+/)
    .map((token) => token.trim())
    .filter(Boolean);

  const board = cloneBoard(state.board);
  const importedHistory = [];
  let turn = state.turn;

  tokens.forEach((token, index) => {
    const move = parseCoordinateMove(token);
    const movingPiece = board[move.from.y]?.[move.from.x];

    if (!movingPiece) {
      throw new Error(`Move ${index + 1} (${token}) starts from an empty square.`);
    }

    const pieceTurn = PIECE_META[movingPiece].side === "red" ? "w" : "b";
    if (pieceTurn !== turn) {
      throw new Error(`Move ${index + 1} (${token}) is not ${turn === "w" ? "red" : "black"} to move.`);
    }

    const legalMoves = getLegalMovesForPiece(board, move.from.x, move.from.y);
    if (!legalMoves.some((candidate) => candidate.x === move.to.x && candidate.y === move.to.y)) {
      throw new Error(`Move ${index + 1} (${token}) is illegal in the current position.`);
    }

    const capture = board[move.to.y][move.to.x];
    board[move.to.y][move.to.x] = movingPiece;
    board[move.from.y][move.from.x] = null;
    importedHistory.push({
      notation: normalizeMoveNotation(move),
      from: move.from,
      to: move.to,
      piece: movingPiece,
      capture,
    });
    turn = turn === "w" ? "b" : "w";
  });

  state.baseTurn = hasFen ? sideSelect.value : "w";
  state.turn = state.baseTurn;
  state.history = importedHistory;
  state.playbackIndex = importedHistory.length;
  applyPlaybackIndex();
}

function parseCoordinateMove(token) {
  const cleaned = token.toLowerCase().replace(/[^a-i0-9]/g, "");
  if (!/^[a-i][0-9][a-i][0-9]$/.test(cleaned)) {
    throw new Error(`Unsupported move format: ${token}`);
  }

  return {
    from: iccsToCoords(cleaned.slice(0, 2)),
    to: iccsToCoords(cleaned.slice(2, 4)),
  };
}

function iccsToCoords(square) {
  const file = square[0];
  const rank = Number(square[1]);
  return {
    x: FILES.indexOf(file),
    y: 9 - rank,
  };
}

function coordsToIccs(x, y) {
  return `${FILES[x]}${9 - y}`;
}

function normalizeMoveNotation(move) {
  return `${coordsToIccs(move.from.x, move.from.y)}${coordsToIccs(move.to.x, move.to.y)}`;
}

function applyMove(move, shouldRecord) {
  const nextBoard = cloneBoard(state.board);
  const movingPiece = nextBoard[move.from.y][move.from.x];
  const capture = nextBoard[move.to.y][move.to.x];
  nextBoard[move.to.y][move.to.x] = movingPiece;
  nextBoard[move.from.y][move.from.x] = null;
  state.board = nextBoard;

  if (shouldRecord) {
    if (state.playbackIndex < state.history.length) {
      state.history = state.history.slice(0, state.playbackIndex);
    }

    state.history.push({
      notation: normalizeMoveNotation(move),
      from: move.from,
      to: move.to,
      piece: movingPiece,
      capture,
    });
    state.playbackIndex = state.history.length;
    state.turn = state.turn === "w" ? "b" : "w";
  }
}

function stepPlayback(direction) {
  const nextIndex = Math.min(state.history.length, Math.max(0, state.playbackIndex + direction));
  if (nextIndex === state.playbackIndex) {
    return;
  }

  state.playbackIndex = nextIndex;
  applyPlaybackIndex();
}

function undoLastMove() {
  if (!state.history.length) {
    return;
  }

  if (state.previewTimer) {
    window.clearInterval(state.previewTimer);
    state.previewTimer = null;
    playSequenceButton.textContent = "Preview Sequence";
  }

  state.history = state.history.slice(0, -1);
  state.playbackIndex = state.history.length;
  applyPlaybackIndex();
}

function applyPlaybackIndex() {
  state.board = cloneBoard(state.baseBoard);
  state.turn = state.baseTurn;

  for (let i = 0; i < state.playbackIndex; i += 1) {
    const move = state.history[i];
    applyMove(
      {
        from: move.from,
        to: move.to,
      },
      false
    );
    state.turn = state.turn === "w" ? "b" : "w";
  }

  clearSelection();
  render();
}

function parseFenToBoard(fen) {
  const parts = fen.trim().split(/\s+/);
  const rows = parts[0].split("/");
  const board = createEmptyBoard();

  rows.forEach((row, y) => {
    let x = 0;
    for (const char of row) {
      if (/\d/.test(char)) {
        x += Number(char);
      } else {
        board[y][x] = char;
        x += 1;
      }
    }
  });

  return board;
}

function getLegalMovesForPiece(board, x, y) {
  const piece = board[y][x];
  if (!piece) {
    return [];
  }

  const side = PIECE_META[piece].side;
  const addMove = (moves, nx, ny) => {
    if (!isOnBoard(nx, ny)) {
      return;
    }
    const target = board[ny][nx];
    if (!target || PIECE_META[target].side !== side) {
      moves.push({ x: nx, y: ny });
    }
  };

  const moves = [];

  switch (piece.toLowerCase()) {
    case "k":
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => {
        const nx = x + dx;
        const ny = y + dy;
        if (isInPalace(nx, ny, side)) {
          addMove(moves, nx, ny);
        }
      });
      addFlyingGeneralMoves(board, x, y, side, moves);
      break;
    case "a":
      [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([dx, dy]) => {
        const nx = x + dx;
        const ny = y + dy;
        if (isInPalace(nx, ny, side)) {
          addMove(moves, nx, ny);
        }
      });
      break;
    case "b":
      [[2, 2], [2, -2], [-2, 2], [-2, -2]].forEach(([dx, dy]) => {
        const eyeX = x + dx / 2;
        const eyeY = y + dy / 2;
        const nx = x + dx;
        const ny = y + dy;
        if (!isOnBoard(nx, ny) || board[eyeY][eyeX]) {
          return;
        }
        if (side === "red" && ny < 5) {
          return;
        }
        if (side === "black" && ny > 4) {
          return;
        }
        addMove(moves, nx, ny);
      });
      break;
    case "n":
      [
        { leg: [0, -1], jump: [-1, -2] },
        { leg: [0, -1], jump: [1, -2] },
        { leg: [1, 0], jump: [2, -1] },
        { leg: [1, 0], jump: [2, 1] },
        { leg: [0, 1], jump: [-1, 2] },
        { leg: [0, 1], jump: [1, 2] },
        { leg: [-1, 0], jump: [-2, -1] },
        { leg: [-1, 0], jump: [-2, 1] },
      ].forEach(({ leg, jump }) => {
        const legX = x + leg[0];
        const legY = y + leg[1];
        if (!isOnBoard(legX, legY) || board[legY][legX]) {
          return;
        }
        addMove(moves, x + jump[0], y + jump[1]);
      });
      break;
    case "r":
      addSlidingMoves(board, x, y, side, moves, false);
      break;
    case "c":
      addSlidingMoves(board, x, y, side, moves, true);
      break;
    case "p": {
      const forward = side === "red" ? -1 : 1;
      addMove(moves, x, y + forward);
      const crossedRiver = side === "red" ? y <= 4 : y >= 5;
      if (crossedRiver) {
        addMove(moves, x + 1, y);
        addMove(moves, x - 1, y);
      }
      break;
    }
    default:
      break;
  }

  return moves.filter((move) => isLegalBoardAfterMove(board, piece, { from: { x, y }, to: move }));
}

function addSlidingMoves(board, x, y, side, moves, isCannon) {
  const directions = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];

  directions.forEach(([dx, dy]) => {
    let nx = x + dx;
    let ny = y + dy;
    let screenFound = false;

    while (isOnBoard(nx, ny)) {
      const target = board[ny][nx];
      if (!isCannon) {
        if (!target) {
          moves.push({ x: nx, y: ny });
        } else {
          if (PIECE_META[target].side !== side) {
            moves.push({ x: nx, y: ny });
          }
          break;
        }
      } else if (!screenFound) {
        if (!target) {
          moves.push({ x: nx, y: ny });
        } else {
          screenFound = true;
        }
      } else if (target) {
        if (PIECE_META[target].side !== side) {
          moves.push({ x: nx, y: ny });
        }
        break;
      }

      nx += dx;
      ny += dy;
    }
  });
}

function addFlyingGeneralMoves(board, x, y, side, moves) {
  let ny = y + (side === "red" ? -1 : 1);

  while (isOnBoard(x, ny)) {
    const piece = board[ny][x];
    if (piece) {
      if (piece.toLowerCase() === "k" && PIECE_META[piece].side !== side) {
        moves.push({ x, y: ny });
      }
      break;
    }
    ny += side === "red" ? -1 : 1;
  }
}

function wouldLeaveGeneralsFacing(board, move) {
  const nextBoard = cloneBoard(board);
  const piece = nextBoard[move.from.y][move.from.x];
  nextBoard[move.to.y][move.to.x] = piece;
  nextBoard[move.from.y][move.from.x] = null;

  let redGeneral = null;
  let blackGeneral = null;
  for (let y = 0; y < 10; y += 1) {
    for (let x = 0; x < 9; x += 1) {
      if (nextBoard[y][x] === "K") {
        redGeneral = { x, y };
      }
      if (nextBoard[y][x] === "k") {
        blackGeneral = { x, y };
      }
    }
  }

  if (!redGeneral || !blackGeneral || redGeneral.x !== blackGeneral.x) {
    return false;
  }

  const file = redGeneral.x;
  const start = Math.min(redGeneral.y, blackGeneral.y) + 1;
  const end = Math.max(redGeneral.y, blackGeneral.y);
  for (let y = start; y < end; y += 1) {
    if (nextBoard[y][file]) {
      return false;
    }
  }

  return true;
}

function isLegalBoardAfterMove(board, piece, move) {
  const nextBoard = cloneBoard(board);
  nextBoard[move.to.y][move.to.x] = piece;
  nextBoard[move.from.y][move.from.x] = null;
  if (areGeneralsFacing(nextBoard)) {
    return false;
  }

  const side = PIECE_META[piece].side;
  return !isGeneralInCheck(nextBoard, side);
}

function areGeneralsFacing(board) {
  let redGeneral = null;
  let blackGeneral = null;
  for (let y = 0; y < 10; y += 1) {
    for (let x = 0; x < 9; x += 1) {
      if (board[y][x] === "K") {
        redGeneral = { x, y };
      }
      if (board[y][x] === "k") {
        blackGeneral = { x, y };
      }
    }
  }

  if (!redGeneral || !blackGeneral || redGeneral.x !== blackGeneral.x) {
    return false;
  }

  const file = redGeneral.x;
  const start = Math.min(redGeneral.y, blackGeneral.y) + 1;
  const end = Math.max(redGeneral.y, blackGeneral.y);
  for (let y = start; y < end; y += 1) {
    if (board[y][file]) {
      return false;
    }
  }

  return true;
}

function isGeneralInCheck(board, side) {
  const general = findGeneral(board, side);
  if (!general) {
    return false;
  }

  const enemySide = side === "red" ? "black" : "red";
  for (let y = 0; y < 10; y += 1) {
    for (let x = 0; x < 9; x += 1) {
      const piece = board[y][x];
      if (!piece || PIECE_META[piece].side !== enemySide) {
        continue;
      }
      if (pieceAttacksSquare(board, piece, x, y, general.x, general.y)) {
        return true;
      }
    }
  }

  return false;
}

function findGeneral(board, side) {
  const target = side === "red" ? "K" : "k";
  for (let y = 0; y < 10; y += 1) {
    for (let x = 0; x < 9; x += 1) {
      if (board[y][x] === target) {
        return { x, y };
      }
    }
  }
  return null;
}

function pieceAttacksSquare(board, piece, fromX, fromY, toX, toY) {
  const side = PIECE_META[piece].side;
  const dx = toX - fromX;
  const dy = toY - fromY;

  switch (piece.toLowerCase()) {
    case "k":
      if (Math.abs(dx) + Math.abs(dy) === 1 && isInPalace(toX, toY, side)) {
        return true;
      }
      if (fromX === toX) {
        const step = fromY < toY ? 1 : -1;
        for (let y = fromY + step; y !== toY; y += step) {
          if (board[y][fromX]) {
            return false;
          }
        }
        return true;
      }
      return false;
    case "a":
      return Math.abs(dx) === 1 && Math.abs(dy) === 1 && isInPalace(toX, toY, side);
    case "b": {
      if (Math.abs(dx) !== 2 || Math.abs(dy) !== 2) {
        return false;
      }
      const eyeX = fromX + dx / 2;
      const eyeY = fromY + dy / 2;
      if (board[eyeY][eyeX]) {
        return false;
      }
      if (side === "red" && toY < 5) {
        return false;
      }
      if (side === "black" && toY > 4) {
        return false;
      }
      return true;
    }
    case "n": {
      const patterns = [
        { leg: [0, -1], jump: [-1, -2] },
        { leg: [0, -1], jump: [1, -2] },
        { leg: [1, 0], jump: [2, -1] },
        { leg: [1, 0], jump: [2, 1] },
        { leg: [0, 1], jump: [-1, 2] },
        { leg: [0, 1], jump: [1, 2] },
        { leg: [-1, 0], jump: [-2, -1] },
        { leg: [-1, 0], jump: [-2, 1] },
      ];
      return patterns.some(({ leg, jump }) => {
        if (fromX + jump[0] !== toX || fromY + jump[1] !== toY) {
          return false;
        }
        return !board[fromY + leg[1]][fromX + leg[0]];
      });
    }
    case "r":
      return lineAttack(board, fromX, fromY, toX, toY, false);
    case "c":
      return lineAttack(board, fromX, fromY, toX, toY, true);
    case "p":
      if (side === "red") {
        if (dx === 0 && dy === -1) {
          return true;
        }
        return fromY <= 4 && Math.abs(dx) === 1 && dy === 0;
      }
      if (dx === 0 && dy === 1) {
        return true;
      }
      return fromY >= 5 && Math.abs(dx) === 1 && dy === 0;
    default:
      return false;
  }
}

function lineAttack(board, fromX, fromY, toX, toY, isCannon) {
  if (fromX !== toX && fromY !== toY) {
    return false;
  }

  const dx = Math.sign(toX - fromX);
  const dy = Math.sign(toY - fromY);
  let x = fromX + dx;
  let y = fromY + dy;
  let blockers = 0;

  while (x !== toX || y !== toY) {
    if (board[y][x]) {
      blockers += 1;
    }
    x += dx;
    y += dy;
  }

  return isCannon ? blockers === 1 : blockers === 0;
}

function isInPalace(x, y, side) {
  const fileOk = x >= 3 && x <= 5;
  if (!fileOk) {
    return false;
  }
  return side === "red" ? y >= 7 && y <= 9 : y >= 0 && y <= 2;
}

function isOnBoard(x, y) {
  return x >= 0 && x < 9 && y >= 0 && y < 10;
}

async function renderGif() {
  await ensureFontsReady();
  const delay = Math.max(100, Number(delayInput.value) || 650);
  const endDelay = Math.max(0, Number(endDelayInput.value) || 0);
  const frames = buildGifFrames();
  if (!frames.length) {
    window.alert("There are no frames to render.");
    return;
  }

  gifStatus.textContent = "Rendering GIF...";
  downloadGifButton.disabled = true;
  copyGifButton.disabled = true;

  const gif = new window.GIF({
    workers: 2,
    quality: 8,
    width: 720,
    height: 800,
    workerScript: "./vendor-gif.worker.js",
  });

  frames.forEach((frame, index) => {
    const isFirst = index === 0;
    const isLast = index === frames.length - 1;
    gif.addFrame(frame, {
      delay: isFirst ? 900 : isLast ? delay + endDelay : delay,
      copy: true,
    });
  });

  gif.on("finished", (blob) => {
    if (state.generatedGifUrl) {
      URL.revokeObjectURL(state.generatedGifUrl);
    }
    state.generatedGifBlob = blob;
    state.generatedGifUrl = URL.createObjectURL(blob);
    gifPreview.src = state.generatedGifUrl;
    gifPreview.style.display = "block";
    gifStatus.textContent = `GIF ready. ${frames.length} frame${frames.length === 1 ? "" : "s"} rendered.`;
    downloadGifButton.disabled = false;
    copyGifButton.disabled = false;
  });

  gif.render();
}

function buildGifFrames() {
  let board = cloneBoard(state.baseBoard);
  let turn = state.baseTurn;
  const frames = [drawBoardFrame(board, turn)];

  state.history.forEach((move) => {
    board = cloneBoard(board);
    board[move.to.y][move.to.x] = board[move.from.y][move.from.x];
    board[move.from.y][move.from.x] = null;
    turn = turn === "w" ? "b" : "w";
    frames.push(drawBoardFrame(board, turn, move));
  });

  return frames;
}

function drawBoardFrame(board, turn, highlightMove = null) {
  const canvas = document.createElement("canvas");
  canvas.width = 720;
  canvas.height = 800;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const metrics = getBoardRenderMetrics(canvas.width, canvas.height);

  ctx.fillStyle = "#f3e2ba";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, "#f5dfb0");
  gradient.addColorStop(1, "#d5b06f");
  ctx.fillStyle = gradient;
  ctx.fillRect(metrics.frameX, metrics.frameY, metrics.frameWidth, metrics.frameHeight);

  ctx.strokeStyle = "#5a3417";
  ctx.lineWidth = metrics.lineWidth;
  ctx.strokeRect(metrics.frameX, metrics.frameY, metrics.frameWidth, metrics.frameHeight);
  for (let file = 0; file < 9; file += 1) {
    const x = metrics.originX + file * metrics.cell;
    ctx.beginPath();
    if (file === 0 || file === 8) {
      ctx.moveTo(x, metrics.originY);
      ctx.lineTo(x, metrics.originY + 9 * metrics.cell);
    } else {
      ctx.moveTo(x, metrics.originY);
      ctx.lineTo(x, metrics.originY + 4 * metrics.cell);
      ctx.moveTo(x, metrics.originY + 5 * metrics.cell);
      ctx.lineTo(x, metrics.originY + 9 * metrics.cell);
    }
    ctx.stroke();
  }

  for (let rank = 0; rank < 10; rank += 1) {
    const y = metrics.originY + rank * metrics.cell;
    ctx.beginPath();
    ctx.moveTo(metrics.originX, y);
    ctx.lineTo(metrics.originX + 8 * metrics.cell, y);
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.moveTo(metrics.originX + 3 * metrics.cell, metrics.originY);
  ctx.lineTo(metrics.originX + 5 * metrics.cell, metrics.originY + 2 * metrics.cell);
  ctx.moveTo(metrics.originX + 5 * metrics.cell, metrics.originY);
  ctx.lineTo(metrics.originX + 3 * metrics.cell, metrics.originY + 2 * metrics.cell);
  ctx.moveTo(metrics.originX + 3 * metrics.cell, metrics.originY + 7 * metrics.cell);
  ctx.lineTo(metrics.originX + 5 * metrics.cell, metrics.originY + 9 * metrics.cell);
  ctx.moveTo(metrics.originX + 5 * metrics.cell, metrics.originY + 7 * metrics.cell);
  ctx.lineTo(metrics.originX + 3 * metrics.cell, metrics.originY + 9 * metrics.cell);
  ctx.stroke();

  ctx.font = `700 ${metrics.riverFontSize}px ${RIVER_FONT_FAMILY}`;
  ctx.fillStyle = "rgba(35, 24, 21, 0.65)";
  ctx.textAlign = "center";
  ctx.fillText("楚河", canvas.width / 2 - metrics.riverGap, metrics.originY + 4.55 * metrics.cell);
  ctx.fillText("汉界", canvas.width / 2 + metrics.riverGap, metrics.originY + 4.55 * metrics.cell);

  ctx.font = `600 ${metrics.coordFontSize}px ${UI_FONT_FAMILY}`;
  FILES.forEach((file, index) => {
    ctx.fillText(file, metrics.originX + index * metrics.cell, metrics.topCoordY);
    ctx.fillText(file, metrics.originX + index * metrics.cell, metrics.bottomCoordY);
  });
  RANKS.forEach((rank, index) => {
    ctx.fillText(rank, metrics.leftCoordX, metrics.originY + index * metrics.cell + metrics.coordOffsetY);
    ctx.fillText(rank, metrics.rightCoordX, metrics.originY + index * metrics.cell + metrics.coordOffsetY);
  });

  if (highlightMove) {
    drawMoveHighlight(ctx, metrics, highlightMove);
  }

  for (let y = 0; y < 10; y += 1) {
    for (let x = 0; x < 9; x += 1) {
      const piece = board[y][x];
      if (!piece) {
        continue;
      }
      drawPiece(ctx, metrics.originX + x * metrics.cell, metrics.originY + y * metrics.cell, metrics, piece);
    }
  }

  ctx.font = `600 ${metrics.statusFontSize}px ${UI_FONT_FAMILY}`;
  ctx.fillStyle = "#2b1d13";
  ctx.textAlign = "left";
  ctx.fillText(`Turn: ${turn === "w" ? "Red" : "Black"}`, metrics.statusX, metrics.statusY);

  return canvas;
}

function getBoardRenderMetrics(canvasWidth, canvasHeight) {
  const cell = Math.min(canvasWidth / 10.2857, canvasHeight / 11.4286);
  const frameX = cell * 0.5714;
  const frameY = cell * 0.8571;
  const frameWidth = cell * 9.1429;
  const frameHeight = cell * 9.7143;

  return {
    cell,
    frameX,
    frameY,
    frameWidth,
    frameHeight,
    originX: frameX + cell * 0.5714,
    originY: frameY + cell * 0.5714,
    lineWidth: Math.max(2.2, cell * 0.043),
    riverFontSize: cell * 0.86,
    riverGap: cell * 1.486,
    coordFontSize: cell * 0.343,
    topCoordY: frameY - cell * 0.057,
    bottomCoordY: frameY + frameHeight - cell * 0.029,
    leftCoordX: frameX + cell * 0.114,
    rightCoordX: frameX + frameWidth - cell * 0.114,
    coordOffsetY: cell * 0.086,
    statusFontSize: cell * 0.314,
    statusX: frameX,
    statusY: frameY - cell * 0.371,
    highlightWidth: Math.max(4, cell * 0.086),
    highlightRadius: cell * 0.4,
    pieceRadius: cell * 0.514,
    pieceGradientInnerX: cell * 0.257,
    pieceGradientInnerY: cell * 0.314,
    pieceGradientInnerR: cell * 0.143,
    pieceGradientOuterR: cell * 0.557,
    pieceBorderWidth: Math.max(2.2, cell * 0.043),
    pieceFontSize: cell * 0.671,
  };
}

function drawMoveHighlight(ctx, metrics, move) {
  const fromX = metrics.originX + move.from.x * metrics.cell;
  const fromY = metrics.originY + move.from.y * metrics.cell;
  const toX = metrics.originX + move.to.x * metrics.cell;
  const toY = metrics.originY + move.to.y * metrics.cell;

  ctx.strokeStyle = "rgba(65, 97, 80, 0.8)";
  ctx.lineWidth = metrics.highlightWidth;
  ctx.beginPath();
  ctx.moveTo(fromX, fromY);
  ctx.lineTo(toX, toY);
  ctx.stroke();

  ctx.fillStyle = "rgba(159, 31, 31, 0.2)";
  ctx.beginPath();
  ctx.arc(toX, toY, metrics.highlightRadius, 0, Math.PI * 2);
  ctx.fill();
}

function drawPiece(ctx, x, y, metrics, piece) {
  const radial = ctx.createRadialGradient(
    x - metrics.pieceGradientInnerX,
    y - metrics.pieceGradientInnerY,
    metrics.pieceGradientInnerR,
    x,
    y,
    metrics.pieceGradientOuterR
  );
  radial.addColorStop(0, "#fff8eb");
  radial.addColorStop(0.72, "#ead39d");
  radial.addColorStop(1, "#d5ae69");
  ctx.fillStyle = radial;
  ctx.strokeStyle = "#5a3417";
  ctx.lineWidth = metrics.pieceBorderWidth;
  ctx.beginPath();
  ctx.arc(x, y, metrics.pieceRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = PIECE_META[piece].side === "red" ? "#9f1f1f" : "#23272f";
  ctx.font = `700 ${metrics.pieceFontSize}px ${PIECE_FONT_FAMILY}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(PIECE_META[piece].glyph, x, y + metrics.cell * 0.014);
}

function downloadGif() {
  if (!state.generatedGifBlob || !state.generatedGifUrl) {
    return;
  }

  const link = document.createElement("a");
  link.href = state.generatedGifUrl;
  link.download = "xiangqi-sequence.gif";
  link.click();
}

async function copyGif() {
  if (!state.generatedGifBlob) {
    return;
  }

  if (!navigator.clipboard || typeof window.ClipboardItem === "undefined") {
    gifStatus.textContent = "Clipboard copy is not supported in this browser. Download the GIF instead.";
    return;
  }

  try {
    await navigator.clipboard.write([
      new window.ClipboardItem({
        "image/gif": state.generatedGifBlob,
      }),
    ]);
    gifStatus.textContent = "GIF copied to the clipboard.";
  } catch (error) {
    gifStatus.textContent = "Clipboard copy failed. Download the GIF instead.";
  }
}
