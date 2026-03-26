import {
  UI_FONT_FAMILY,
  XIANGQI_PIECE_FONT_FAMILY,
  clamp,
  createEmptyGrid,
  formatMoveList,
  normalizeRange,
  renderGif,
  syncRangeInputs,
} from "../../core/shared.js";

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h", "i"];
const RANKS = ["9", "8", "7", "6", "5", "4", "3", "2", "1", "0"];
const START_FEN = "rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w";
const PIECE_META = {
  K: { side: "red", glyph: "帥", label: "Red General" },
  A: { side: "red", glyph: "仕", label: "Red Advisor" },
  B: { side: "red", glyph: "相", label: "Red Elephant" },
  N: { side: "red", glyph: "馬", label: "Red Horse" },
  R: { side: "red", glyph: "車", label: "Red Chariot" },
  C: { side: "red", glyph: "炮", label: "Red Cannon" },
  P: { side: "red", glyph: "兵", label: "Red Soldier" },
  k: { side: "black", glyph: "將", label: "Black General" },
  a: { side: "black", glyph: "士", label: "Black Advisor" },
  b: { side: "black", glyph: "象", label: "Black Elephant" },
  n: { side: "black", glyph: "馬", label: "Black Horse" },
  r: { side: "black", glyph: "車", label: "Black Chariot" },
  c: { side: "black", glyph: "砲", label: "Black Cannon" },
  p: { side: "black", glyph: "卒", label: "Black Soldier" },
};
const PALETTE_ORDER = ["K", "A", "B", "N", "R", "C", "P", "k", "a", "b", "n", "r", "c", "p", "."];

export function mountXiangqi(root) {
  root.innerHTML = `
    <div class="mode-shell mode-shell-xiangqi">
      <section class="board-panel">
        <div class="board-toolbar">
          <div class="toolbar-group">
            <button data-id="play-toggle" class="primary-button">Switch To Play Mode</button>
            <button data-id="clear-board">Clear Board</button>
            <button data-id="reset-start">Reset Start Position</button>
          </div>
          <div class="toolbar-group">
            <span class="status-pill" data-id="mode-pill">Editor</span>
            <button data-id="turn-pill" class="status-pill turn-red" type="button">Red To Move</button>
          </div>
        </div>
        <div class="board-wrap">
          <div class="board-coords files top" data-id="files-top"></div>
          <div class="board-row">
            <div class="board-coords ranks left" data-id="ranks-left"></div>
            <div data-id="board" class="board board-xiangqi" aria-label="Xiangqi board"></div>
          </div>
        </div>
        <div class="board-footer">
          <p data-id="selection-label">Erase mode active. Click an intersection to remove its piece.</p>
          <p data-id="move-log-summary">No moves recorded.</p>
        </div>
        <section class="card board-subpanel">
          <h2>Playback</h2>
          <div class="toolbar-group wrap">
            <button data-id="undo-move">Undo Last Move</button>
            <button data-id="step-back">Step Back</button>
            <button data-id="step-forward">Step Forward</button>
            <button data-id="play-sequence">Preview Sequence</button>
          </div>
          <label class="field-label">
            Preview Ply
            <input data-id="preview-slider" type="range" min="0" max="0" value="0" />
          </label>
          <p class="helper-copy" data-id="playback-summary">The current board is the live working position.</p>
        </section>
      </section>
      <aside class="control-panel">
        <section class="card">
          <h2>Editor Palette</h2>
          <div data-id="palette" class="palette"></div>
        </section>
        <section class="card">
          <h2>Game Import</h2>
          <label class="field-label">
            FEN
            <textarea data-id="fen-input" rows="3"></textarea>
          </label>
          <label class="field-label">
            Moves
            <textarea data-id="moves-input" rows="6" placeholder="Example: h2e2 h9g7 e2e7"></textarea>
          </label>
          <div class="inline-fields">
            <label>
              Side To Move
              <select data-id="side-select">
                <option value="w">Red</option>
                <option value="b">Black</option>
              </select>
            </label>
            <label>
              Frame Delay (ms)
              <input data-id="delay-input" type="number" min="100" step="50" value="650" />
            </label>
          </div>
          <div class="toolbar-group">
            <button data-id="load-fen">Load FEN</button>
            <button data-id="import-game">Import Game</button>
          </div>
          <p class="helper-copy">Supported moves use ICCS/UCCI coordinates such as <code>h2e2</code>.</p>
        </section>
        <section class="card">
          <h2>Export Range</h2>
          <div class="inline-fields">
            <label>
              Start Ply
              <input data-id="range-start" type="number" min="0" step="1" value="0" />
            </label>
            <label>
              End Ply
              <input data-id="range-end" type="number" min="0" step="1" value="0" />
            </label>
          </div>
          <p class="helper-copy" data-id="range-summary">Exporting the current full move list.</p>
          <label class="field-label">
            Move List
            <textarea data-id="move-list-preview" rows="8" readonly></textarea>
          </label>
        </section>
        <section class="card">
          <h2>GIF Export</h2>
          <div class="inline-fields">
            <label>
              End Delay (ms)
              <input data-id="end-delay-input" type="number" min="0" step="100" value="1200" />
            </label>
          </div>
          <div class="toggle-list">
            <label class="toggle-option"><input data-id="show-coords" type="checkbox" /> <span>Show Coordinates</span></label>
            <label class="toggle-option"><input data-id="show-turn" type="checkbox" /> <span>Show Turn Indicator</span></label>
          </div>
          <div class="toolbar-group wrap">
            <button data-id="render-gif" class="primary-button">Render GIF</button>
            <button data-id="download-gif" disabled>Download GIF</button>
            <button data-id="copy-gif" disabled>Copy GIF</button>
          </div>
          <p data-id="gif-status" class="helper-copy">No GIF rendered yet.</p>
          <img data-id="gif-preview" class="gif-preview" alt="Generated Xiangqi GIF preview" />
        </section>
      </aside>
    </div>
  `;

  const get = (id) => root.querySelector(`[data-id="${id}"]`);
  const boardElement = get("board");
  const paletteElement = get("palette");
  const modePill = get("mode-pill");
  const turnPill = get("turn-pill");
  const selectionLabel = get("selection-label");
  const moveLogSummary = get("move-log-summary");
  const playbackSummary = get("playback-summary");
  const fenInput = get("fen-input");
  const movesInput = get("moves-input");
  const sideSelect = get("side-select");
  const delayInput = get("delay-input");
  const endDelayInput = get("end-delay-input");
  const showCoordsToggle = get("show-coords");
  const showTurnToggle = get("show-turn");
  const gifStatus = get("gif-status");
  const gifPreview = get("gif-preview");
  const playToggleButton = get("play-toggle");
  const undoMoveButton = get("undo-move");
  const stepBackButton = get("step-back");
  const stepForwardButton = get("step-forward");
  const playSequenceButton = get("play-sequence");
  const previewSlider = get("preview-slider");
  const rangeStartInput = get("range-start");
  const rangeEndInput = get("range-end");
  const rangeSummary = get("range-summary");
  const moveListPreview = get("move-list-preview");
  const downloadGifButton = get("download-gif");
  const copyGifButton = get("copy-gif");

  const state = {
    mode: "edit",
    turn: "w",
    board: createBoard(),
    baseBoard: createBoard(),
    baseTurn: "w",
    history: [],
    playbackIndex: 0,
    selectedSquare: null,
    legalTargets: [],
    paletteSelection: ".",
    previewTimer: null,
  };

  buildCoordinateLabels(get("files-top"), get("ranks-left"));
  buildPalette();
  buildBoard();
  loadFen(START_FEN);
  attachEventListeners();
  syncInputsFromState();
  render();

  return {
    getSummary() {
      return {
        moves: state.history.length,
        description: "Xiangqi editor, playback, and GIF export ready.",
      };
    },
  };

  function createBoard() {
    return createEmptyGrid(10, 9, null);
  }

  function cloneBoard(board) {
    return board.map((row) => [...row]);
  }

  function buildCoordinateLabels(top, left) {
    FILES.forEach((file) => top.append(createCoord(file)));
    RANKS.forEach((rank) => left.append(createCoord(rank)));
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
        button.append(badge);
      } else {
        const badge = document.createElement("span");
        badge.className = `palette-piece ${PIECE_META[piece].side}`;
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

    get("clear-board").addEventListener("click", () => {
      state.board = createBoard();
      state.baseBoard = createBoard();
      state.baseTurn = "w";
      state.turn = "w";
      state.history = [];
      state.playbackIndex = 0;
      clearSelection();
      render();
    });

    get("reset-start").addEventListener("click", () => {
      loadFen(START_FEN);
      state.history = [];
      state.playbackIndex = 0;
      render();
    });

    get("load-fen").addEventListener("click", () => {
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

    get("import-game").addEventListener("click", () => {
      try {
        importGame();
        clearSelection();
        render();
      } catch (error) {
        window.alert(error.message);
      }
    });

    undoMoveButton.addEventListener("click", undoLastMove);
    stepBackButton.addEventListener("click", () => stepPlayback(-1));
    stepForwardButton.addEventListener("click", () => stepPlayback(1));
    previewSlider.addEventListener("input", () => {
      state.playbackIndex = clamp(Number(previewSlider.value) || 0, 0, state.history.length);
      applyPlaybackIndex();
    });

    [rangeStartInput, rangeEndInput].forEach((input) =>
      input.addEventListener("input", () => {
        normalizeExportRange();
        renderStatus();
      })
    );

    playSequenceButton.addEventListener("click", () => {
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

    get("render-gif").addEventListener("click", async () => {
      const frames = buildGifFrames();
      if (!frames.length) {
        gifStatus.textContent = "No frames available for export.";
        return;
      }
      try {
        await renderGif({
          frames,
          delay: Math.max(100, Number(delayInput.value) || 650),
          endDelay: Math.max(0, Number(endDelayInput.value) || 0),
          filename: "xiangqi-sequence.gif",
          statusElement: gifStatus,
          previewElement: gifPreview,
          downloadButton: downloadGifButton,
          copyButton: copyGifButton,
        });
      } catch (error) {
        gifStatus.textContent = error.message;
      }
    });
  }

  function render() {
    renderPalette();
    renderBoardState();
    renderStatus();
    syncInputsFromState();
  }

  function renderPalette() {
    paletteElement.querySelectorAll(".palette-option").forEach((button) => {
      button.classList.toggle("active", button.dataset.piece === state.paletteSelection);
    });
  }

  function renderBoardState() {
    boardElement.querySelectorAll(".square").forEach((square) => {
      const x = Number(square.dataset.x);
      const y = Number(square.dataset.y);
      const piece = state.board[y][x];
      square.classList.toggle("selected", state.selectedSquare?.x === x && state.selectedSquare?.y === y);
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
    playToggleButton.textContent = state.mode === "edit" ? "Switch To Play Mode" : "Switch To Edit Mode";
    moveLogSummary.textContent = state.history.length
      ? `${state.history.length} move${state.history.length === 1 ? "" : "s"} recorded. Latest: ${state.history[state.history.length - 1].notation}.`
      : "No moves recorded.";
    playbackSummary.textContent = state.history.length
      ? `Viewing ply ${state.playbackIndex} of ${state.history.length}.`
      : "The current board is the live working position.";
    previewSlider.max = String(state.history.length);
    previewSlider.value = String(state.playbackIndex);
    stepBackButton.disabled = state.playbackIndex <= 0;
    stepForwardButton.disabled = state.playbackIndex >= state.history.length;
    undoMoveButton.disabled = state.history.length === 0;
    syncRangeInputs(rangeStartInput, rangeEndInput, previewSlider, state.history.length);
    normalizeExportRange();
    const range = getExportRange();
    rangeSummary.textContent = `Exporting plies ${range.start} to ${range.end} (${range.end - range.start + 1} frame${range.end - range.start === 0 ? "" : "s"} minimum including start position).`;
    moveListPreview.value = formatMoveList(state.history.map((move) => move.notation));
  }

  function syncInputsFromState() {
    fenInput.value = boardToFen(state.baseBoard);
    sideSelect.value = state.baseTurn;
    movesInput.value = state.history.map((move) => move.notation).join(" ");
  }

  function normalizeExportRange() {
    const range = normalizeRange(rangeStartInput.value, rangeEndInput.value, state.history.length);
    rangeStartInput.value = String(range.start);
    rangeEndInput.value = String(range.end);
  }

  function getExportRange() {
    normalizeExportRange();
    return {
      start: Number(rangeStartInput.value) || 0,
      end: Number(rangeEndInput.value) || 0,
    };
  }

  function handleSquareClick(x, y) {
    if (state.mode === "edit") {
      const nextBoard = cloneBoard(state.board);
      nextBoard[y][x] = state.paletteSelection === "." ? null : state.paletteSelection;
      state.board = nextBoard;
      state.baseBoard = cloneBoard(nextBoard);
      state.history = [];
      state.playbackIndex = 0;
      state.baseTurn = state.turn;
      state.turn = state.baseTurn;
      render();
      return;
    }

    const piece = state.board[y][x];
    if (state.selectedSquare) {
      const isLegalTarget = state.legalTargets.some((target) => target.x === x && target.y === y);
      if (isLegalTarget) {
        applyMove({ from: { ...state.selectedSquare }, to: { x, y } }, true);
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
    renderBoardState();
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
    const board = createBoard();
    rows.forEach((row, y) => {
      let x = 0;
      for (const char of row) {
        if (/\d/.test(char)) {
          x += Number(char);
        } else if (PIECE_META[char]) {
          board[y][x] = char;
          x += 1;
        } else {
          throw new Error(`Unknown piece in FEN: ${char}`);
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
    return board
      .map((row) => {
        let empty = 0;
        let output = "";
        row.forEach((piece) => {
          if (!piece) {
            empty += 1;
          } else {
            if (empty) {
              output += String(empty);
              empty = 0;
            }
            output += piece;
          }
        });
        if (empty) {
          output += String(empty);
        }
        return output;
      })
      .join("/");
  }

  function importGame() {
    const hasFen = fenInput.value.trim().length > 0;
    loadFen(hasFen ? `${fenInput.value.trim()} ${sideSelect.value}` : START_FEN);
    const tokens = movesInput.value.trim().split(/[\s,]+/).map((token) => token.trim()).filter(Boolean);
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
      importedHistory.push({ notation: normalizeMoveNotation(move), from: move.from, to: move.to, piece: movingPiece, capture });
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
      from: { x: FILES.indexOf(cleaned[0]), y: 9 - Number(cleaned[1]) },
      to: { x: FILES.indexOf(cleaned[2]), y: 9 - Number(cleaned[3]) },
    };
  }

  function normalizeMoveNotation(move) {
    return `${FILES[move.from.x]}${9 - move.from.y}${FILES[move.to.x]}${9 - move.to.y}`;
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
      state.history.push({ notation: normalizeMoveNotation(move), from: move.from, to: move.to, piece: movingPiece, capture });
      state.playbackIndex = state.history.length;
      state.turn = state.turn === "w" ? "b" : "w";
    }
  }

  function stepPlayback(direction) {
    const nextIndex = clamp(state.playbackIndex + direction, 0, state.history.length);
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
    state.history = state.history.slice(0, -1);
    state.playbackIndex = state.history.length;
    applyPlaybackIndex();
  }

  function applyPlaybackIndex() {
    state.board = cloneBoard(state.baseBoard);
    state.turn = state.baseTurn;
    for (let index = 0; index < state.playbackIndex; index += 1) {
      const move = state.history[index];
      applyMove({ from: move.from, to: move.to }, false);
      state.turn = state.turn === "w" ? "b" : "w";
    }
    clearSelection();
    render();
  }

  function getLegalMovesForPiece(board, x, y) {
    const piece = board[y][x];
    if (!piece) {
      return [];
    }
    const side = PIECE_META[piece].side;
    const moves = [];
    const addMove = (nx, ny) => {
      if (nx < 0 || nx >= 9 || ny < 0 || ny >= 10) {
        return;
      }
      const target = board[ny][nx];
      if (!target || PIECE_META[target].side !== side) {
        moves.push({ x: nx, y: ny });
      }
    };

    switch (piece.toLowerCase()) {
      case "k":
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => {
          const nx = x + dx;
          const ny = y + dy;
          if (isInPalace(nx, ny, side)) {
            addMove(nx, ny);
          }
        });
        addFlyingGeneralMoves(board, x, y, side, moves);
        break;
      case "a":
        [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([dx, dy]) => {
          const nx = x + dx;
          const ny = y + dy;
          if (isInPalace(nx, ny, side)) {
            addMove(nx, ny);
          }
        });
        break;
      case "b":
        [[2, 2], [2, -2], [-2, 2], [-2, -2]].forEach(([dx, dy]) => {
          const eyeX = x + dx / 2;
          const eyeY = y + dy / 2;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || nx >= 9 || ny < 0 || ny >= 10 || board[eyeY][eyeX]) {
            return;
          }
          if ((side === "red" && ny < 5) || (side === "black" && ny > 4)) {
            return;
          }
          addMove(nx, ny);
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
          if (legX < 0 || legX >= 9 || legY < 0 || legY >= 10 || board[legY][legX]) {
            return;
          }
          addMove(x + jump[0], y + jump[1]);
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
        addMove(x, y + forward);
        const crossedRiver = side === "red" ? y <= 4 : y >= 5;
        if (crossedRiver) {
          addMove(x + 1, y);
          addMove(x - 1, y);
        }
        break;
      }
      default:
        break;
    }

    return moves.filter((move) => isLegalBoardAfterMove(board, piece, { from: { x, y }, to: move }));
  }

  function addSlidingMoves(board, x, y, side, moves, isCannon) {
    [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => {
      let nx = x + dx;
      let ny = y + dy;
      let screenFound = false;
      while (nx >= 0 && nx < 9 && ny >= 0 && ny < 10) {
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
    while (ny >= 0 && ny < 10) {
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

  function isInPalace(x, y, side) {
    if (x < 3 || x > 5) {
      return false;
    }
    return side === "red" ? y >= 7 && y <= 9 : y >= 0 && y <= 2;
  }

  function isLegalBoardAfterMove(board, piece, move) {
    const nextBoard = cloneBoard(board);
    nextBoard[move.to.y][move.to.x] = piece;
    nextBoard[move.from.y][move.from.x] = null;
    if (areGeneralsFacing(nextBoard)) {
      return false;
    }
    return !isGeneralInCheck(nextBoard, PIECE_META[piece].side);
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
    for (let y = Math.min(redGeneral.y, blackGeneral.y) + 1; y < Math.max(redGeneral.y, blackGeneral.y); y += 1) {
      if (board[y][redGeneral.x]) {
        return false;
      }
    }
    return true;
  }

  function isGeneralInCheck(board, side) {
    const target = side === "red" ? "K" : "k";
    let general = null;
    for (let y = 0; y < 10; y += 1) {
      for (let x = 0; x < 9; x += 1) {
        if (board[y][x] === target) {
          general = { x, y };
        }
      }
    }
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
      case "b":
        return Math.abs(dx) === 2 && Math.abs(dy) === 2 && !board[fromY + dy / 2][fromX + dx / 2];
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
          return (dx === 0 && dy === -1) || (fromY <= 4 && Math.abs(dx) === 1 && dy === 0);
        }
        return (dx === 0 && dy === 1) || (fromY >= 5 && Math.abs(dx) === 1 && dy === 0);
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

  function buildGifFrames() {
    const range = getExportRange();
    const frames = [];
    let board = cloneBoard(state.baseBoard);
    let turn = state.baseTurn;

    for (let index = 0; index < range.start; index += 1) {
      const move = state.history[index];
      board[move.to.y][move.to.x] = board[move.from.y][move.from.x];
      board[move.from.y][move.from.x] = null;
      turn = turn === "w" ? "b" : "w";
    }

    frames.push(drawBoardFrame(board, turn, null, {
      showCoords: showCoordsToggle.checked,
      showTurnIndicator: showTurnToggle.checked,
    }));

    for (let index = range.start; index < range.end; index += 1) {
      const move = state.history[index];
      board = cloneBoard(board);
      board[move.to.y][move.to.x] = board[move.from.y][move.from.x];
      board[move.from.y][move.from.x] = null;
      turn = turn === "w" ? "b" : "w";
      frames.push(drawBoardFrame(board, turn, move, {
        showCoords: showCoordsToggle.checked,
        showTurnIndicator: showTurnToggle.checked,
      }));
    }
    return frames;
  }

  function drawBoardFrame(board, turn, highlightMove, options) {
    const canvas = document.createElement("canvas");
    canvas.width = 720;
    canvas.height = 800;
    const ctx = canvas.getContext("2d");
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

    ctx.font = `700 ${metrics.riverFontSize}px ${XIANGQI_PIECE_FONT_FAMILY}`;
    ctx.fillStyle = "rgba(35, 24, 21, 0.65)";
    ctx.textAlign = "center";
    ctx.fillText("楚河", canvas.width / 2 - metrics.riverGap, metrics.originY + 4.68 * metrics.cell);
    ctx.fillText("漢界", canvas.width / 2 + metrics.riverGap, metrics.originY + 4.68 * metrics.cell);

    if (options.showCoords) {
      ctx.font = `600 ${metrics.coordFontSize}px ${UI_FONT_FAMILY}`;
      FILES.forEach((file, index) => {
        ctx.fillText(file, metrics.originX + index * metrics.cell, metrics.topCoordY);
        ctx.fillText(file, metrics.originX + index * metrics.cell, metrics.bottomCoordY);
      });
      RANKS.forEach((rank, index) => {
        ctx.fillText(rank, metrics.leftCoordX, metrics.originY + index * metrics.cell + metrics.coordOffsetY);
        ctx.fillText(rank, metrics.rightCoordX, metrics.originY + index * metrics.cell + metrics.coordOffsetY);
      });
    }

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

    if (options.showTurnIndicator) {
      ctx.font = `600 ${metrics.statusFontSize}px ${UI_FONT_FAMILY}`;
      ctx.fillStyle = "#2b1d13";
      ctx.textAlign = "left";
      ctx.fillText(`Turn: ${turn === "w" ? "Red" : "Black"}`, metrics.statusX, metrics.statusY);
    }

    return canvas;
  }

  function getBoardRenderMetrics(width, height) {
    const cell = Math.min(width / 10.2857, height / 11.4286);
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
      riverFontSize: cell * 0.78,
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
      pieceFontSize: cell * 0.59,
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
    ctx.font = `700 ${metrics.pieceFontSize}px ${XIANGQI_PIECE_FONT_FAMILY}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(PIECE_META[piece].glyph, x, y + metrics.cell * 0.014);
  }
}
