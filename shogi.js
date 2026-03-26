import {
  CHINESE_FONT_FAMILY,
  UI_FONT_FAMILY,
  clamp,
  createBoardCanvas,
  formatMoveList,
  normalizeRange,
  renderGif,
  syncRangeInputs,
} from "./shared.js";

const THEMES = {
  character: {
    board: "#d4b57b",
    bg: "#efe3c7",
    line: "#5e421e",
    render(piece) {
      return PIECE_CHARS[piece] || piece;
    },
  },
  animal: {
    board: "#d9c08a",
    bg: "#f3ead5",
    line: "#5b4a2b",
    render(piece) {
      return PIECE_ANIMALS[piece] || piece;
    },
  },
};

const PIECE_CHARS = {
  K: "王",
  R: "飛",
  B: "角",
  G: "金",
  S: "銀",
  N: "桂",
  L: "香",
  P: "步",
  "+R": "龍",
  "+B": "馬",
  "+S": "全",
  "+N": "圭",
  "+L": "杏",
  "+P": "と",
};

const PIECE_ANIMALS = {
  K: "Lion",
  R: "Hawk",
  B: "Falcon",
  G: "Bear",
  S: "Fox",
  N: "Horse",
  L: "Stag",
  P: "Rabbit",
  "+R": "Dragon",
  "+B": "Pegasus",
  "+S": "Fox+",
  "+N": "Horse+",
  "+L": "Stag+",
  "+P": "Rabbit+",
};

const STANDARD_SFEN = "lnsgkgsnl/1r5b1/p1pppp1pp/6p2/9/2P6/PP1PPPPPP/1B5R1/LNSGKGSNL b - 1";
const PALETTE = ["K", "R", "B", "G", "S", "N", "L", "P", "k", "r", "b", "g", "s", "n", "l", "p", "."];

const VARIANTS = {
  standard: { label: "Standard", sfen: STANDARD_SFEN, hands: { b: {}, w: {} } },
  doro: { label: "Doro Doro Shogi", sfen: STANDARD_SFEN, hands: { b: {}, w: {} } },
  doroplus: { label: "Doro Doro Shogi+", sfen: STANDARD_SFEN, hands: { b: { N: 1, L: 1 }, w: { N: 1, L: 1 } } },
};

export function mountShogi(root) {
  root.innerHTML = `
    <div class="mode-shell">
      <section class="board-panel">
        <div class="board-toolbar">
          <div class="toolbar-group">
            <button data-id="play-toggle" class="primary-button">Switch To Play Mode</button>
            <button data-id="clear-board">Clear Board</button>
            <button data-id="reset-variant">Reset Variant</button>
          </div>
          <div class="toolbar-group">
            <span class="status-pill" data-id="mode-pill">Editor</span>
            <button data-id="turn-pill" class="status-pill" type="button">Black To Move</button>
            <span class="status-pill" data-id="variant-summary">Manual Board</span>
          </div>
        </div>
        <div class="canvas-board-wrap">
          <canvas data-id="board-canvas" class="board-canvas" width="720" height="820"></canvas>
        </div>
        <div class="board-footer">
          <p data-id="position-summary">Editor mode places pieces directly. Play mode supports move-by-move board play on the current setup.</p>
          <p data-id="selection-summary">Variant presets and theme choices carry through to GIF export.</p>
        </div>
      </section>
      <aside class="control-panel">
        <section class="card">
          <h2>Editor Palette</h2>
          <div data-id="palette" class="palette"></div>
        </section>
        <section class="card">
          <h2>Variant & Theme</h2>
          <div class="inline-fields">
            <label>
              Variant
              <select data-id="variant-select">
                <option value="standard">Standard</option>
                <option value="doro">Doro Doro Shogi</option>
                <option value="doroplus">Doro Doro Shogi+</option>
              </select>
            </label>
            <label>
              Theme
              <select data-id="theme-select">
                <option value="character">Character</option>
                <option value="animal">Animal</option>
              </select>
            </label>
          </div>
          <p class="helper-copy">Doro Doro Shogi+ starts with a knight and lance in hand for each side in this UI model.</p>
        </section>
        <section class="card">
          <h2>Import</h2>
          <label class="field-label">
            SFEN Position
            <textarea data-id="sfen-input" rows="3" placeholder="${STANDARD_SFEN}"></textarea>
          </label>
          <label class="field-label">
            Moves (USI)
            <textarea data-id="moves-input" rows="8" placeholder="7g7f 3c3d 2g2f"></textarea>
          </label>
          <div class="inline-fields">
            <label>
              Frame Delay (ms)
              <input data-id="delay-input" type="number" min="100" step="50" value="650" />
            </label>
            <label>
              End Delay (ms)
              <input data-id="end-delay-input" type="number" min="0" step="100" value="1200" />
            </label>
          </div>
          <div class="toolbar-group">
            <button data-id="load-game" class="primary-button">Load Shogi Game</button>
          </div>
        </section>
        <section class="card">
          <h2>Range</h2>
          <label class="field-label">
            Preview Move
            <input data-id="preview-slider" type="range" min="0" max="0" value="0" />
          </label>
          <div class="inline-fields">
            <label>Start Move <input data-id="range-start" type="number" min="0" step="1" value="0" /></label>
            <label>End Move <input data-id="range-end" type="number" min="0" step="1" value="0" /></label>
          </div>
          <p class="helper-copy" data-id="range-summary">Load or play a line to enable range export.</p>
          <label class="field-label">
            Move List
            <textarea data-id="move-list" rows="10" readonly></textarea>
          </label>
        </section>
        <section class="card">
          <h2>GIF Export</h2>
          <div class="toggle-list">
            <label class="toggle-option"><input data-id="show-turn" type="checkbox" /> <span>Show Turn Indicator</span></label>
          </div>
          <div class="toolbar-group wrap">
            <button data-id="render-gif" class="primary-button">Render GIF</button>
            <button data-id="download-gif" disabled>Download GIF</button>
            <button data-id="copy-gif" disabled>Copy GIF</button>
          </div>
          <p data-id="gif-status" class="helper-copy">No GIF rendered yet.</p>
          <img data-id="gif-preview" class="gif-preview" alt="Generated Shogi GIF preview" />
        </section>
      </aside>
    </div>
  `;

  const get = (id) => root.querySelector(`[data-id="${id}"]`);
  const canvas = get("board-canvas");
  const ctx = canvas.getContext("2d");
  const state = {
    uiMode: "edit",
    source: "manual",
    importedPositions: [loadVariantPosition("standard")],
    importedMoves: [],
    manual: {
      baseState: loadVariantPosition("standard"),
      positions: [loadVariantPosition("standard")],
      moves: [],
      paletteSelection: ".",
      selectedSquare: null,
      legalMoves: [],
    },
    previewMove: 0,
  };

  buildPalette();
  canvas.addEventListener("click", handleCanvasClick);
  get("play-toggle").addEventListener("click", () => {
    state.uiMode = state.uiMode === "edit" ? "play" : "edit";
    clearSelection();
    render();
  });
  get("turn-pill").addEventListener("click", () => {
    const base = getActiveBaseState();
    base.turn = base.turn === "b" ? "w" : "b";
    if (state.source === "manual") {
      rebuildManualPositions();
    } else {
      state.source = "manual";
      state.manual.baseState = clonePosition(base);
      state.manual.moves = [];
      rebuildManualPositions();
    }
    render();
  });
  get("clear-board").addEventListener("click", () => {
    state.source = "manual";
    state.manual.baseState = emptyPosition();
    applyVariantHands(state.manual.baseState, get("variant-select").value);
    state.manual.moves = [];
    rebuildManualPositions();
    render();
  });
  get("reset-variant").addEventListener("click", () => {
    state.source = "manual";
    state.manual.baseState = loadVariantPosition(get("variant-select").value);
    state.manual.moves = [];
    rebuildManualPositions();
    render();
  });
  get("variant-select").addEventListener("change", () => {
    if (state.source === "manual") {
      state.manual.baseState = loadVariantPosition(get("variant-select").value);
      state.manual.moves = [];
      rebuildManualPositions();
    }
    render();
  });
  get("theme-select").addEventListener("change", render);
  get("load-game").addEventListener("click", loadGame);
  get("preview-slider").addEventListener("input", () => {
    state.previewMove = clamp(Number(get("preview-slider").value) || 0, 0, getActiveMoves().length);
    clearSelection();
    render();
  });
  [get("range-start"), get("range-end")].forEach((input) =>
    input.addEventListener("input", () => {
      normalizeExportInputs();
      render();
    })
  );
  get("render-gif").addEventListener("click", exportGif);

  render();

  return {
    getSummary() {
      return {
        moves: getActiveMoves().length,
        description: "Shogi now supports Xiangqi-style editor and play modes, with variant presets and shared GIF export.",
      };
    },
  };

  function emptyPosition() {
    return {
      board: Array.from({ length: 9 }, () => Array(9).fill(null)),
      turn: "b",
      hands: { b: {}, w: {} },
      moveNumber: 1,
    };
  }

  function buildPalette() {
    const palette = get("palette");
    palette.innerHTML = "";
    PALETTE.forEach((piece) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "palette-option";
      button.dataset.piece = piece;
      if (piece === ".") {
        const erase = document.createElement("span");
        erase.className = "palette-piece erase-piece";
        button.append(erase);
      } else {
        const badge = document.createElement("span");
        badge.className = "palette-piece";
        badge.textContent = piece.toUpperCase();
        button.append(badge);
      }
      button.addEventListener("click", () => {
        state.manual.paletteSelection = piece;
        renderPalette();
      });
      palette.append(button);
    });
    renderPalette();
  }

  function renderPalette() {
    get("palette").querySelectorAll(".palette-option").forEach((button) => {
      button.classList.toggle("active", button.dataset.piece === state.manual.paletteSelection);
    });
  }

  function clonePosition(position) {
    return {
      board: position.board.map((row) => row.map((piece) => (piece ? { ...piece } : null))),
      turn: position.turn,
      hands: { b: { ...position.hands.b }, w: { ...position.hands.w } },
      moveNumber: position.moveNumber,
    };
  }

  function getActiveMoves() {
    return state.source === "manual" ? state.manual.moves : state.importedMoves;
  }

  function getActivePositions() {
    return state.source === "manual" ? state.manual.positions : state.importedPositions;
  }

  function getActiveBaseState() {
    return state.source === "manual" ? state.manual.baseState : clonePosition(getActivePositions()[0]);
  }

  function rebuildManualPositions() {
    state.manual.positions = [clonePosition(state.manual.baseState)];
    let current = clonePosition(state.manual.baseState);
    state.manual.moves.forEach((move) => {
      current = applyUsiMove(clonePosition(current), move.usi);
      state.manual.positions.push(clonePosition(current));
    });
    state.previewMove = clamp(state.previewMove, 0, state.manual.moves.length);
    clearSelection();
  }

  function clearSelection() {
    state.manual.selectedSquare = null;
    state.manual.legalMoves = [];
  }

  function loadGame() {
    try {
      const variant = get("variant-select").value;
      const start = get("sfen-input").value.trim() ? parseSfen(get("sfen-input").value.trim()) : loadVariantPosition(variant);
      applyVariantHands(start, variant);
      const moveTokens = get("moves-input").value.trim().split(/[\s,]+/).filter(Boolean);
      const positions = [clonePosition(start)];
      moveTokens.forEach((token) => {
        positions.push(applyUsiMove(clonePosition(positions[positions.length - 1]), token));
      });
      state.source = "imported";
      state.importedPositions = positions;
      state.importedMoves = moveTokens.map((usi) => ({ usi, label: usi }));
      state.previewMove = 0;
      clearSelection();
      render();
    } catch (error) {
      window.alert(error.message);
    }
  }

  function normalizeExportInputs() {
    const range = normalizeRange(get("range-start").value, get("range-end").value, getActiveMoves().length);
    get("range-start").value = String(range.start);
    get("range-end").value = String(range.end);
  }

  function getRange() {
    normalizeExportInputs();
    return {
      start: Number(get("range-start").value) || 0,
      end: Number(get("range-end").value) || 0,
    };
  }

  function render() {
    renderPalette();
    const previewSlider = get("preview-slider");
    const activeMoves = getActiveMoves();
    const activePositions = getActivePositions();
    previewSlider.max = String(activeMoves.length);
    previewSlider.value = String(state.previewMove);
    syncRangeInputs(get("range-start"), get("range-end"), previewSlider, activeMoves.length);
    normalizeExportInputs();
    const active = activePositions[state.previewMove] || activePositions[0];
    get("mode-pill").textContent = state.uiMode === "edit" ? "Editor" : "Play";
    get("play-toggle").textContent = state.uiMode === "edit" ? "Switch To Play Mode" : "Switch To Edit Mode";
    get("turn-pill").textContent = active.turn === "b" ? "Black To Move" : "White To Move";
    get("turn-pill").classList.toggle("turn-black", active.turn === "b");
    get("turn-pill").classList.toggle("turn-red", active.turn === "w");
    get("variant-summary").textContent =
      state.source === "manual"
        ? `Manual Board · ${activeMoves.length} move${activeMoves.length === 1 ? "" : "s"}`
        : `${VARIANTS[get("variant-select").value].label} · ${activeMoves.length} move${activeMoves.length === 1 ? "" : "s"}`;
    const range = getRange();
    get("range-summary").textContent = `Exporting moves ${range.start} to ${range.end}.`;
    get("move-list").value = formatMoveList(activeMoves.map((move) => move.label || move.usi));
    get("selection-summary").textContent =
      state.uiMode === "edit"
        ? "Editor mode places pieces directly on the board."
        : "Play mode allows piece movement on the current setup.";
    drawShogiBoard(ctx, canvas, active, {
      theme: THEMES[get("theme-select").value] || THEMES.character,
      showTurnIndicator: get("show-turn").checked,
      selectedSquare: state.manual.selectedSquare,
      legalMoves: state.manual.legalMoves,
    });
  }

  function handleCanvasClick(event) {
    const square = canvasPointToSquare(canvas, event);
    if (!square) {
      return;
    }
    state.source = "manual";
    if (state.uiMode === "edit") {
      const next = clonePosition(state.manual.baseState);
      next.board[square.y][square.x] =
        state.manual.paletteSelection === "."
          ? null
          : {
              side: state.manual.paletteSelection === state.manual.paletteSelection.toUpperCase() ? "b" : "w",
              kind: state.manual.paletteSelection.toUpperCase(),
            };
      state.manual.baseState = next;
      state.manual.moves = [];
      state.previewMove = 0;
      rebuildManualPositions();
      render();
      return;
    }

    const active = clonePosition(state.manual.positions[state.previewMove] || state.manual.positions[0]);
    if (state.manual.selectedSquare) {
      const move = state.manual.legalMoves.find((candidate) => candidate.to.x === square.x && candidate.to.y === square.y);
      if (move) {
        if (state.previewMove < state.manual.moves.length) {
          state.manual.moves = state.manual.moves.slice(0, state.previewMove);
        }
        state.manual.moves.push({ usi: move.usi, label: move.usi });
        state.previewMove = state.manual.moves.length;
        rebuildManualPositions();
        render();
        return;
      }
    }

    const piece = active.board[square.y][square.x];
    if (!piece || piece.side !== active.turn) {
      clearSelection();
      render();
      return;
    }
    state.manual.selectedSquare = square;
    state.manual.legalMoves = generateShogiMoves(active, square.x, square.y);
    render();
  }

  async function exportGif() {
    const range = getRange();
    const frames = [];
    const activePositions = getActivePositions();
    for (let moveIndex = range.start; moveIndex <= range.end; moveIndex += 1) {
      const frameCanvas = createBoardCanvas(720, 820);
      drawShogiBoard(frameCanvas.getContext("2d"), frameCanvas, activePositions[moveIndex] || activePositions[0], {
        theme: THEMES[get("theme-select").value] || THEMES.character,
        showTurnIndicator: get("show-turn").checked,
      });
      frames.push(frameCanvas);
    }
    try {
      await renderGif({
        frames,
        delay: Math.max(100, Number(get("delay-input").value) || 650),
        endDelay: Math.max(0, Number(get("end-delay-input").value) || 0),
        filename: "shogi-sequence.gif",
        statusElement: get("gif-status"),
        previewElement: get("gif-preview"),
        downloadButton: get("download-gif"),
        copyButton: get("copy-gif"),
      });
    } catch (error) {
      get("gif-status").textContent = error.message;
    }
  }
}

function drawShogiBoard(ctx, canvas, position, options) {
  const metrics = getShogiMetrics(canvas.width, canvas.height);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = options.theme.bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = options.theme.board;
  ctx.fillRect(metrics.originX, metrics.originY, metrics.boardSize, metrics.boardSize);
  ctx.strokeStyle = options.theme.line;
  ctx.lineWidth = 2.2;
  for (let index = 0; index <= 9; index += 1) {
    const offset = metrics.originX + index * metrics.cell;
    ctx.beginPath();
    ctx.moveTo(offset, metrics.originY);
    ctx.lineTo(offset, metrics.originY + metrics.boardSize);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(metrics.originX, metrics.originY + index * metrics.cell);
    ctx.lineTo(metrics.originX + metrics.boardSize, metrics.originY + index * metrics.cell);
    ctx.stroke();
  }

  if (options.selectedSquare) {
    ctx.fillStyle = "rgba(168, 54, 35, 0.18)";
    ctx.fillRect(metrics.originX + options.selectedSquare.x * metrics.cell, metrics.originY + options.selectedSquare.y * metrics.cell, metrics.cell, metrics.cell);
  }
  (options.legalMoves || []).forEach((move) => {
    ctx.fillStyle = "rgba(73, 119, 91, 0.24)";
    ctx.beginPath();
    ctx.arc(metrics.originX + move.to.x * metrics.cell + metrics.cell / 2, metrics.originY + move.to.y * metrics.cell + metrics.cell / 2, metrics.cell * 0.14, 0, Math.PI * 2);
    ctx.fill();
  });

  for (let y = 0; y < 9; y += 1) {
    for (let x = 0; x < 9; x += 1) {
      const square = position.board[y][x];
      if (!square) {
        continue;
      }
      const centerX = metrics.originX + x * metrics.cell + metrics.cell / 2;
      const centerY = metrics.originY + y * metrics.cell + metrics.cell / 2;
      drawShogiPiece(ctx, centerX, centerY, metrics.cell, square.side, options.theme.render(square.kind));
    }
  }

  ctx.font = `600 ${metrics.handFontSize}px ${UI_FONT_FAMILY}`;
  ctx.fillStyle = options.theme.line;
  ctx.textAlign = "left";
  ctx.fillText(`Black hand: ${formatHands(position.hands.b)}`, metrics.originX, metrics.originY + metrics.boardSize + 38);
  ctx.fillText(`White hand: ${formatHands(position.hands.w)}`, metrics.originX, metrics.originY - 26);
  if (options.showTurnIndicator) {
    ctx.fillText(`Turn: ${position.turn === "b" ? "Black" : "White"}`, metrics.originX + metrics.boardSize - 140, metrics.originY - 26);
  }
}

function drawShogiPiece(ctx, centerX, centerY, cell, side, label) {
  ctx.save();
  ctx.translate(centerX, centerY);
  if (side === "w") {
    ctx.rotate(Math.PI);
  }
  ctx.fillStyle = "#f7ebc4";
  ctx.strokeStyle = "#6b4c21";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, -cell * 0.42);
  ctx.lineTo(cell * 0.36, -cell * 0.18);
  ctx.lineTo(cell * 0.28, cell * 0.42);
  ctx.lineTo(-cell * 0.28, cell * 0.42);
  ctx.lineTo(-cell * 0.36, -cell * 0.18);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = side === "b" ? "#1d1a16" : "#8b2220";
  ctx.font = `700 ${cell * 0.2}px ${CHINESE_FONT_FAMILY}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const lines = label.length > 3 ? [label.slice(0, 4), label.slice(4)] : [label];
  lines.forEach((line, index) => ctx.fillText(line, 0, (index - (lines.length - 1) / 2) * cell * 0.17));
  ctx.restore();
}

function getShogiMetrics(width, height) {
  const boardSize = Math.min(width - 80, height - 150);
  const cell = boardSize / 9;
  return { originX: (width - boardSize) / 2, originY: 70, boardSize, cell, handFontSize: 18 };
}

function loadVariantPosition(variant) {
  const position = parseSfen(VARIANTS[variant].sfen);
  applyVariantHands(position, variant);
  return position;
}

function applyVariantHands(position, variant) {
  position.hands = { b: { ...VARIANTS[variant].hands.b }, w: { ...VARIANTS[variant].hands.w } };
}

function parseSfen(sfen) {
  const [placement, turn = "b", hands = "-", moveNumber = "1"] = sfen.split(/\s+/);
  const rows = placement.split("/");
  const board = Array.from({ length: 9 }, () => Array(9).fill(null));
  rows.forEach((row, y) => {
    let x = 0;
    for (let index = 0; index < row.length; index += 1) {
      const char = row[index];
      if (/\d/.test(char)) {
        x += Number(char);
      } else if (char === "+") {
        const next = row[index + 1];
        board[y][x] = { side: next === next.toUpperCase() ? "b" : "w", kind: `+${next.toUpperCase()}` };
        index += 1;
        x += 1;
      } else {
        board[y][x] = { side: char === char.toUpperCase() ? "b" : "w", kind: char.toUpperCase() };
        x += 1;
      }
    }
  });
  return { board, turn, hands: parseHands(hands), moveNumber: Number(moveNumber) };
}

function parseHands(text) {
  const hands = { b: {}, w: {} };
  if (!text || text === "-") {
    return hands;
  }
  let count = "";
  for (const char of text) {
    if (/\d/.test(char)) {
      count += char;
      continue;
    }
    const amount = Number(count || "1");
    count = "";
    const side = char === char.toUpperCase() ? "b" : "w";
    hands[side][char.toUpperCase()] = (hands[side][char.toUpperCase()] || 0) + amount;
  }
  return hands;
}

function applyUsiMove(position, text) {
  const move = text.trim();
  if (!move) {
    return position;
  }
  if (move.includes("*")) {
    const [piece, targetText] = move.split("*");
    const target = shogiSquareToCoords(targetText);
    const side = position.turn;
    const stock = position.hands[side][piece];
    if (!stock || position.board[target.y][target.x]) {
      throw new Error(`Illegal drop: ${move}`);
    }
    position.board[target.y][target.x] = { side, kind: piece };
    position.hands[side][piece] -= 1;
    if (!position.hands[side][piece]) {
      delete position.hands[side][piece];
    }
  } else {
    const from = shogiSquareToCoords(move.slice(0, 2));
    const to = shogiSquareToCoords(move.slice(2, 4));
    const promote = move.endsWith("+");
    const piece = position.board[from.y][from.x];
    if (!piece) {
      throw new Error(`No piece on ${move.slice(0, 2)}.`);
    }
    const target = position.board[to.y][to.x];
    if (target) {
      const capturedKind = target.kind.replace("+", "");
      position.hands[position.turn][capturedKind] = (position.hands[position.turn][capturedKind] || 0) + 1;
    }
    position.board[from.y][from.x] = null;
    position.board[to.y][to.x] = {
      side: piece.side,
      kind: promote && canPromote(piece.kind) ? `+${piece.kind.replace("+", "")}` : piece.kind,
    };
  }
  position.turn = position.turn === "b" ? "w" : "b";
  position.moveNumber += 1;
  return position;
}

function generateShogiMoves(position, x, y) {
  const piece = position.board[y][x];
  if (!piece) {
    return [];
  }
  const forward = piece.side === "b" ? -1 : 1;
  const directions = getPieceDirections(piece.kind, forward);
  const moves = [];
  directions.forEach((direction) => {
    let nx = x + direction.dx;
    let ny = y + direction.dy;
    while (nx >= 0 && nx < 9 && ny >= 0 && ny < 9) {
      const target = position.board[ny][nx];
      if (target && target.side === piece.side) {
        break;
      }
      const usi = `${coordsToShogiSquare(x, y)}${coordsToShogiSquare(nx, ny)}${shouldPromote(piece.kind, piece.side, y, ny) ? "+" : ""}`;
      moves.push({ from: { x, y }, to: { x: nx, y: ny }, usi });
      if (target || !direction.repeat) {
        break;
      }
      nx += direction.dx;
      ny += direction.dy;
    }
  });
  return moves;
}

function getPieceDirections(kind, forward) {
  const base = kind.replace("+", "");
  if (kind.startsWith("+") && ["P", "L", "N", "S"].includes(base)) {
    return getPieceDirections("G", forward);
  }
  switch (kind) {
    case "K":
      return [
        { dx: -1, dy: -1 }, { dx: 0, dy: -1 }, { dx: 1, dy: -1 },
        { dx: -1, dy: 0 }, { dx: 1, dy: 0 },
        { dx: -1, dy: 1 }, { dx: 0, dy: 1 }, { dx: 1, dy: 1 },
      ];
    case "G":
      return [
        { dx: -1, dy: forward }, { dx: 0, dy: forward }, { dx: 1, dy: forward },
        { dx: -1, dy: 0 }, { dx: 1, dy: 0 }, { dx: 0, dy: -forward },
      ];
    case "S":
      return [
        { dx: -1, dy: forward }, { dx: 0, dy: forward }, { dx: 1, dy: forward },
        { dx: -1, dy: -forward }, { dx: 1, dy: -forward },
      ];
    case "N":
      return [{ dx: -1, dy: forward * 2 }, { dx: 1, dy: forward * 2 }];
    case "L":
      return [{ dx: 0, dy: forward, repeat: true }];
    case "P":
      return [{ dx: 0, dy: forward }];
    case "R":
      return [{ dx: 1, dy: 0, repeat: true }, { dx: -1, dy: 0, repeat: true }, { dx: 0, dy: 1, repeat: true }, { dx: 0, dy: -1, repeat: true }];
    case "B":
      return [{ dx: 1, dy: 1, repeat: true }, { dx: 1, dy: -1, repeat: true }, { dx: -1, dy: 1, repeat: true }, { dx: -1, dy: -1, repeat: true }];
    case "+R":
      return [...getPieceDirections("R", forward), { dx: 1, dy: 1 }, { dx: 1, dy: -1 }, { dx: -1, dy: 1 }, { dx: -1, dy: -1 }];
    case "+B":
      return [...getPieceDirections("B", forward), { dx: 1, dy: 0 }, { dx: -1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 0, dy: -1 }];
    default:
      return [];
  }
}

function shouldPromote(kind, side, fromY, toY) {
  if (!canPromote(kind)) {
    return false;
  }
  const zone = side === "b" ? [0, 1, 2] : [6, 7, 8];
  return zone.includes(fromY) || zone.includes(toY);
}

function canPromote(kind) {
  return ["R", "B", "S", "N", "L", "P"].includes(kind.replace("+", ""));
}

function canvasPointToSquare(canvas, event) {
  const rect = canvas.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * canvas.width;
  const y = ((event.clientY - rect.top) / rect.height) * canvas.height;
  const metrics = getShogiMetrics(canvas.width, canvas.height);
  if (x < metrics.originX || x > metrics.originX + metrics.boardSize || y < metrics.originY || y > metrics.originY + metrics.boardSize) {
    return null;
  }
  return {
    x: clamp(Math.floor((x - metrics.originX) / metrics.cell), 0, 8),
    y: clamp(Math.floor((y - metrics.originY) / metrics.cell), 0, 8),
  };
}

function shogiSquareToCoords(square) {
  return {
    x: 9 - Number(square[0]),
    y: square[1].toLowerCase().charCodeAt(0) - 97,
  };
}

function coordsToShogiSquare(x, y) {
  return `${9 - x}${String.fromCharCode(97 + y)}`;
}

function formatHands(hands) {
  const entries = Object.entries(hands);
  return entries.length ? entries.map(([piece, count]) => `${piece}x${count}`).join(" ") : "none";
}
