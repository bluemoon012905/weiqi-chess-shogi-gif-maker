import {
  UI_FONT_FAMILY,
  buildBranchOptions,
  clamp,
  cropCanvas,
  createBoardCanvas,
  drawCropOverlay,
  formatMoveList,
  normalizeRange,
  renderGif,
  syncRangeInputs,
} from "../../core/shared.js";

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
const PALETTE = ["K", "Q", "R", "B", "N", "P", "k", "q", "r", "b", "n", "p", "."];
const PIECE_GLYPHS = {
  K: "♔",
  Q: "♕",
  R: "♖",
  B: "♗",
  N: "♘",
  P: "♙",
  k: "♚",
  q: "♛",
  r: "♜",
  b: "♝",
  n: "♞",
  p: "♟",
};

const THEMES = {
  classic: { light: "#f0d9b5", dark: "#b58863", bg: "#f5ebd6", accent: "#6a4e2f" },
  slate: { light: "#d8dde6", dark: "#73839c", bg: "#edf1f7", accent: "#32465a" },
};

export function mountChess(root) {
  root.innerHTML = `
    <div class="mode-shell">
      <section class="board-panel">
        <div class="board-toolbar">
          <div class="toolbar-group">
            <button data-id="play-toggle" class="primary-button">Switch To Play Mode</button>
            <button data-id="clear-board">Clear Board</button>
            <button data-id="reset-start">Reset Start Position</button>
          </div>
          <div class="toolbar-group">
            <span class="status-pill" data-id="mode-pill">Editor</span>
            <button data-id="turn-pill" class="status-pill" type="button">White To Move</button>
            <span class="status-pill" data-id="branch-summary">Manual Board</span>
          </div>
        </div>
        <div class="canvas-board-wrap">
          <canvas data-id="board-canvas" class="board-canvas" width="720" height="720"></canvas>
        </div>
        <div class="board-footer">
          <p data-id="position-summary">Use editor mode to place pieces or parse a PGN branch, then switch to play mode to step through moves.</p>
          <p data-id="selection-summary">The selected branch and move range drive GIF export.</p>
        </div>
      </section>
      <aside class="control-panel">
        <section class="card">
          <h2>Editor Palette</h2>
          <div data-id="palette" class="palette"></div>
        </section>
        <section class="card">
          <h2>PGN Import</h2>
          <label class="field-label">
            PGN
            <textarea data-id="pgn-input" rows="10" placeholder='[Event "Example"]&#10;1. e4 e5 2. Nf3 Nc6 3. Bb5 a6'></textarea>
          </label>
          <div class="toolbar-group">
            <button data-id="load-pgn" class="primary-button">Parse PGN</button>
          </div>
          <p class="helper-copy">Variations are preserved. Parsing a PGN replaces the current manual branch.</p>
        </section>
        <section class="card">
          <h2>Branch & Range</h2>
          <label class="field-label">
            Branch
            <select data-id="branch-select"></select>
          </label>
          <label class="field-label">
            Preview Ply
            <input data-id="preview-slider" type="range" min="0" max="0" value="0" />
          </label>
          <div class="inline-fields">
            <label>Start Ply <input data-id="range-start" type="number" min="0" step="1" value="0" /></label>
            <label>End Ply <input data-id="range-end" type="number" min="0" step="1" value="0" /></label>
          </div>
          <p class="helper-copy" data-id="range-summary">Choose a branch or play moves manually to enable range export.</p>
          <label class="field-label">
            Move List
            <textarea data-id="move-list" rows="10" readonly></textarea>
          </label>
        </section>
        <section class="card">
          <h2>Board & Crop</h2>
          <div class="inline-fields">
            <label>
              Theme
              <select data-id="theme-select">
                <option value="classic">Classic</option>
                <option value="slate">Slate</option>
              </select>
            </label>
            <label>
              Frame Delay (ms)
              <input data-id="delay-input" type="number" min="100" step="50" value="650" />
            </label>
          </div>
          <div class="toggle-list">
            <label class="toggle-option"><input data-id="crop-toggle" type="checkbox" /> <span>Use Crop Region</span></label>
            <label class="toggle-option"><input data-id="show-coords" type="checkbox" /> <span>Show Coordinates</span></label>
            <label class="toggle-option"><input data-id="show-turn" type="checkbox" /> <span>Show Turn Indicator</span></label>
          </div>
          <div class="inline-fields">
            <label>From File <input data-id="crop-file-start" type="number" min="1" max="8" value="1" /></label>
            <label>To File <input data-id="crop-file-end" type="number" min="1" max="8" value="8" /></label>
          </div>
          <div class="inline-fields">
            <label>From Rank <input data-id="crop-rank-start" type="number" min="1" max="8" value="8" /></label>
            <label>To Rank <input data-id="crop-rank-end" type="number" min="1" max="8" value="1" /></label>
          </div>
        </section>
        <section class="card">
          <h2>GIF Export</h2>
          <div class="inline-fields">
            <label>
              End Delay (ms)
              <input data-id="end-delay-input" type="number" min="0" step="100" value="1200" />
            </label>
          </div>
          <div class="toolbar-group wrap">
            <button data-id="render-gif" class="primary-button">Render GIF</button>
            <button data-id="download-gif" disabled>Download GIF</button>
            <button data-id="copy-gif" disabled>Copy GIF</button>
          </div>
          <p data-id="gif-status" class="helper-copy">No GIF rendered yet.</p>
          <img data-id="gif-preview" class="gif-preview" alt="Generated Chess GIF preview" />
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
    tree: createRootNode(),
    branchPaths: [[]],
    branchIndex: 0,
    currentPath: [],
    currentStates: [createInitialState()],
    previewPly: 0,
    manual: {
      baseState: createInitialState(),
      states: [createInitialState()],
      history: [],
      selectedSquare: null,
      legalMoves: [],
      paletteSelection: ".",
    },
  };

  buildPalette();
  canvas.addEventListener("click", handleCanvasClick);
  get("load-pgn").addEventListener("click", loadPgn);
  get("branch-select").addEventListener("change", () => {
    state.branchIndex = Number(get("branch-select").value) || 0;
    state.source = "pgn";
    setCurrentBranch();
  });
  get("play-toggle").addEventListener("click", () => {
    state.uiMode = state.uiMode === "edit" ? "play" : "edit";
    clearSelection();
    render();
  });
  get("turn-pill").addEventListener("click", () => {
    const active = getActiveBaseState();
    active.turn = active.turn === "w" ? "b" : "w";
    if (state.source === "manual") {
      rebuildManualStates();
    } else {
      state.source = "manual";
      state.manual.baseState = cloneState(active);
      state.manual.history = [];
      rebuildManualStates();
    }
    render();
  });
  get("clear-board").addEventListener("click", () => {
    state.source = "manual";
    state.manual.baseState = {
      board: Array.from({ length: 8 }, () => Array(8).fill(null)),
      turn: "w",
      castling: "",
      enPassant: "-",
      halfmove: 0,
      fullmove: 1,
      lastMove: null,
    };
    state.manual.history = [];
    rebuildManualStates();
    render();
  });
  get("reset-start").addEventListener("click", () => {
    state.source = "manual";
    state.manual.baseState = createInitialState();
    state.manual.history = [];
    rebuildManualStates();
    render();
  });
  get("preview-slider").addEventListener("input", () => {
    state.previewPly = clamp(Number(get("preview-slider").value) || 0, 0, getActiveHistory().length);
    clearSelection();
    render();
  });
  [get("range-start"), get("range-end")].forEach((input) =>
    input.addEventListener("input", () => {
      normalizeExportInputs();
      render();
    })
  );
  [
    get("theme-select"),
    get("crop-toggle"),
    get("show-coords"),
    get("show-turn"),
    get("crop-file-start"),
    get("crop-file-end"),
    get("crop-rank-start"),
    get("crop-rank-end"),
  ].forEach((input) => input.addEventListener("input", render));
  get("render-gif").addEventListener("click", exportGif);

  seedManualBranchOptions();
  render();

  return {
    getSummary() {
      return {
        moves: getActiveHistory().length,
        description: "Chess now supports Xiangqi-style editor and play modes alongside PGN import and GIF export.",
      };
    },
  };

  function createRootNode() {
    return { id: "root", label: "root", children: [], parent: null, state: null };
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
        badge.textContent = PIECE_GLYPHS[piece];
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

  function seedManualBranchOptions() {
    const select = get("branch-select");
    select.innerHTML = "";
    const option = document.createElement("option");
    option.value = "0";
    option.textContent = "Manual Line";
    select.append(option);
  }

  function loadPgn() {
    try {
      const parsed = parsePgnToTree(get("pgn-input").value);
      state.tree = parsed.root;
      state.branchPaths = buildBranchOptions(get("branch-select"), parsed.root, (node) => node.label);
      state.branchIndex = 0;
      state.source = "pgn";
      setCurrentBranch();
      get("position-summary").textContent = `PGN parsed. ${state.branchPaths.length} branch${state.branchPaths.length === 1 ? "" : "es"} available.`;
    } catch (error) {
      window.alert(error.message);
    }
  }

  function setCurrentBranch() {
    state.currentPath = state.branchPaths[state.branchIndex] || [];
    state.currentStates = buildStatesForPath(state.currentPath, state.tree.initialState || createInitialState());
    state.previewPly = clamp(state.previewPly, 0, state.currentPath.length);
    clearSelection();
    render();
  }

  function getActiveHistory() {
    return state.source === "manual" ? state.manual.history : state.currentPath;
  }

  function getActiveStates() {
    return state.source === "manual" ? state.manual.states : state.currentStates;
  }

  function getActiveBaseState() {
    return state.source === "manual" ? state.manual.baseState : cloneState(getActiveStates()[0]);
  }

  function rebuildManualStates() {
    state.manual.states = [cloneState(state.manual.baseState)];
    let current = cloneState(state.manual.baseState);
    state.manual.history.forEach((move) => {
      current = applyMove(cloneState(current), move);
      state.manual.states.push(cloneState(current));
    });
    state.previewPly = clamp(state.previewPly, 0, state.manual.history.length);
    seedManualBranchOptions();
    clearSelection();
  }

  function normalizeExportInputs() {
    const range = normalizeRange(get("range-start").value, get("range-end").value, getActiveHistory().length);
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

  function clearSelection() {
    state.manual.selectedSquare = null;
    state.manual.legalMoves = [];
  }

  function render() {
    renderPalette();
    const activeHistory = getActiveHistory();
    const activeStates = getActiveStates();
    const previewSlider = get("preview-slider");
    previewSlider.max = String(activeHistory.length);
    previewSlider.value = String(state.previewPly);
    syncRangeInputs(get("range-start"), get("range-end"), previewSlider, activeHistory.length);
    normalizeExportInputs();
    get("mode-pill").textContent = state.uiMode === "edit" ? "Editor" : "Play";
    get("play-toggle").textContent = state.uiMode === "edit" ? "Switch To Play Mode" : "Switch To Edit Mode";
    const activeState = activeStates[state.previewPly] || activeStates[0];
    get("turn-pill").textContent = activeState.turn === "w" ? "White To Move" : "Black To Move";
    get("turn-pill").classList.toggle("turn-red", activeState.turn === "w");
    get("turn-pill").classList.toggle("turn-black", activeState.turn === "b");
    get("branch-summary").textContent =
      state.source === "manual"
        ? `Manual Line · ${state.manual.history.length} ply`
        : `Branch ${state.branchIndex + 1} · ${state.currentPath.length} ply`;
    const range = getRange();
    get("range-summary").textContent = `Exporting plies ${range.start} to ${range.end}.`;
    get("move-list").value = formatMoveList(activeHistory.map((item) => item.label || item.move || item.san || formatMove(item)));
    get("selection-summary").textContent =
      state.uiMode === "edit"
        ? "Editor mode places pieces directly on the board."
        : "Play mode lets you click a piece and then a legal target square.";
    drawPreview();
  }

  function drawPreview() {
    const theme = THEMES[get("theme-select").value] || THEMES.classic;
    const activeState = getActiveStates()[state.previewPly] || getActiveStates()[0];
    drawChessBoard(ctx, canvas, activeState, {
      theme,
      showCoords: get("show-coords").checked,
      showTurnIndicator: get("show-turn").checked,
      highlightMove: state.previewPly > 0 ? getActiveHistory()[state.previewPly - 1] : null,
      overlayCrop: get("crop-toggle").checked ? getCropRect() : null,
      selectedSquare: state.manual.selectedSquare,
      legalMoves: state.manual.legalMoves,
    });
  }

  function getCropRect() {
    const fileStart = clamp(Number(get("crop-file-start").value) || 1, 1, 8);
    const fileEnd = clamp(Number(get("crop-file-end").value) || 8, fileStart, 8);
    const rankHigh = clamp(Number(get("crop-rank-start").value) || 8, 1, 8);
    const rankLow = clamp(Number(get("crop-rank-end").value) || 1, 1, rankHigh);
    get("crop-file-start").value = String(fileStart);
    get("crop-file-end").value = String(fileEnd);
    get("crop-rank-start").value = String(rankHigh);
    get("crop-rank-end").value = String(rankLow);
    const metrics = getBoardMetrics(canvas.width, canvas.height, get("show-coords").checked);
    return {
      x: metrics.originX + (fileStart - 1) * metrics.cell,
      y: metrics.originY + (8 - rankHigh) * metrics.cell,
      width: (fileEnd - fileStart + 1) * metrics.cell,
      height: (rankHigh - rankLow + 1) * metrics.cell,
    };
  }

  function handleCanvasClick(event) {
    const square = canvasPointToSquare(canvas, event, get("show-coords").checked);
    if (!square) {
      return;
    }
    state.source = "manual";
    if (state.uiMode === "edit") {
      const next = cloneState(state.manual.baseState);
      next.board[square.y][square.x] = state.manual.paletteSelection === "." ? null : state.manual.paletteSelection;
      next.lastMove = null;
      state.manual.baseState = next;
      state.manual.history = [];
      state.previewPly = 0;
      rebuildManualStates();
      render();
      return;
    }

    const activeState = cloneState(state.manual.states[state.previewPly] || state.manual.states[0]);
    if (state.manual.selectedSquare) {
      const selectedMove = state.manual.legalMoves.find((move) => move.to.x === square.x && move.to.y === square.y);
      if (selectedMove) {
        if (state.previewPly < state.manual.history.length) {
          state.manual.history = state.manual.history.slice(0, state.previewPly);
        }
        state.manual.history.push({ ...selectedMove, label: formatMove(selectedMove) });
        state.previewPly = state.manual.history.length;
        rebuildManualStates();
        render();
        return;
      }
    }

    const piece = activeState.board[square.y][square.x];
    if (!piece) {
      clearSelection();
      render();
      return;
    }
    if ((activeState.turn === "w" && piece !== piece.toUpperCase()) || (activeState.turn === "b" && piece !== piece.toLowerCase())) {
      clearSelection();
      render();
      return;
    }
    state.manual.selectedSquare = square;
    state.manual.legalMoves = generateLegalMoves(activeState, activeState.turn).filter(
      (move) => move.from.x === square.x && move.from.y === square.y
    );
    render();
  }

  async function exportGif() {
    const range = getRange();
    const activeStates = getActiveStates();
    const activeHistory = getActiveHistory();
    const crop = get("crop-toggle").checked ? getCropRect() : null;
    const theme = THEMES[get("theme-select").value] || THEMES.classic;
    const frames = [];
    for (let ply = range.start; ply <= range.end; ply += 1) {
      const baseCanvas = createBoardCanvas(720, 720);
      drawChessBoard(baseCanvas.getContext("2d"), baseCanvas, activeStates[ply] || activeStates[0], {
        theme,
        showCoords: get("show-coords").checked,
        showTurnIndicator: get("show-turn").checked,
        highlightMove: ply > 0 ? activeHistory[ply - 1] : null,
      });
      frames.push(cropCanvas(baseCanvas, crop, 720, 720));
    }
    try {
      await renderGif({
        frames,
        delay: Math.max(100, Number(get("delay-input").value) || 650),
        endDelay: Math.max(0, Number(get("end-delay-input").value) || 0),
        filename: "chess-sequence.gif",
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

function canvasPointToSquare(canvas, event, showCoords) {
  const rect = canvas.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * canvas.width;
  const y = ((event.clientY - rect.top) / rect.height) * canvas.height;
  const metrics = getBoardMetrics(canvas.width, canvas.height, showCoords);
  if (x < metrics.originX || x > metrics.originX + metrics.boardSize || y < metrics.originY || y > metrics.originY + metrics.boardSize) {
    return null;
  }
  return {
    x: clamp(Math.floor((x - metrics.originX) / metrics.cell), 0, 7),
    y: clamp(Math.floor((y - metrics.originY) / metrics.cell), 0, 7),
  };
}

function drawChessBoard(ctx, canvas, state, options) {
  const { theme, showCoords, showTurnIndicator, highlightMove = null, overlayCrop = null, selectedSquare = null, legalMoves = [] } = options;
  const metrics = getBoardMetrics(canvas.width, canvas.height, showCoords);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = theme.bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let y = 0; y < 8; y += 1) {
    for (let x = 0; x < 8; x += 1) {
      ctx.fillStyle = (x + y) % 2 === 0 ? theme.light : theme.dark;
      ctx.fillRect(metrics.originX + x * metrics.cell, metrics.originY + y * metrics.cell, metrics.cell, metrics.cell);
    }
  }

  if (selectedSquare) {
    ctx.fillStyle = "rgba(168, 54, 35, 0.26)";
    ctx.fillRect(metrics.originX + selectedSquare.x * metrics.cell, metrics.originY + selectedSquare.y * metrics.cell, metrics.cell, metrics.cell);
  }
  legalMoves.forEach((move) => {
    ctx.fillStyle = "rgba(78, 126, 96, 0.24)";
    ctx.beginPath();
    ctx.arc(
      metrics.originX + move.to.x * metrics.cell + metrics.cell / 2,
      metrics.originY + move.to.y * metrics.cell + metrics.cell / 2,
      metrics.cell * 0.14,
      0,
      Math.PI * 2
    );
    ctx.fill();
  });

  if (highlightMove?.from && highlightMove?.to) {
    [highlightMove.from, highlightMove.to].forEach((square, index) => {
      ctx.fillStyle = index === 0 ? "rgba(92, 164, 108, 0.26)" : "rgba(183, 123, 45, 0.24)";
      ctx.fillRect(metrics.originX + square.x * metrics.cell, metrics.originY + square.y * metrics.cell, metrics.cell, metrics.cell);
    });
  }

  ctx.font = `700 ${metrics.pieceFontSize}px "Segoe UI Symbol", "Noto Sans Symbols", serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (let y = 0; y < 8; y += 1) {
    for (let x = 0; x < 8; x += 1) {
      const piece = state.board[y][x];
      if (!piece) {
        continue;
      }
      const glyph = PIECE_GLYPHS[piece];
      const centerX = metrics.originX + x * metrics.cell + metrics.cell / 2;
      const centerY = metrics.originY + y * metrics.cell + metrics.cell / 2;
      if (piece === piece.toUpperCase()) {
        ctx.strokeStyle = "rgba(0, 0, 0, 0.34)";
        ctx.lineWidth = 4;
        ctx.strokeText(glyph, centerX, centerY + metrics.cell * 0.03);
        ctx.fillStyle = "#fffdf6";
      } else {
        ctx.fillStyle = "#171818";
      }
      ctx.fillText(glyph, centerX, centerY + metrics.cell * 0.03);
    }
  }

  if (showCoords) {
    ctx.font = `600 ${metrics.coordFontSize}px ${UI_FONT_FAMILY}`;
    ctx.fillStyle = theme.accent;
    FILES.forEach((file, index) => {
      ctx.fillText(file, metrics.originX + index * metrics.cell + metrics.cell / 2, metrics.originY + metrics.boardSize + metrics.coordOffset);
      ctx.fillText(String(8 - index), metrics.originX - metrics.coordOffset, metrics.originY + index * metrics.cell + metrics.cell / 2);
    });
  }

  if (showTurnIndicator) {
    ctx.font = `600 ${metrics.coordFontSize}px ${UI_FONT_FAMILY}`;
    ctx.textAlign = "left";
    ctx.fillStyle = theme.accent;
    ctx.fillText(`Turn: ${state.turn === "w" ? "White" : "Black"}`, metrics.originX, metrics.originY - 18);
  }

  if (overlayCrop) {
    drawCropOverlay(ctx, metrics, overlayCrop, "rgba(168, 54, 35, 0.9)");
  }
}

function getBoardMetrics(width, height, showCoords) {
  const padding = showCoords ? 74 : 46;
  const boardSize = Math.min(width - padding * 2, height - padding * 2);
  const cell = boardSize / 8;
  return {
    originX: (width - boardSize) / 2,
    originY: (height - boardSize) / 2,
    boardSize,
    cell,
    pieceFontSize: cell * 0.76,
    coordFontSize: cell * 0.18,
    coordOffset: 26,
  };
}

function parsePgnToTree(pgn) {
  if (!pgn.trim()) {
    throw new Error("Paste a PGN first.");
  }
  const headers = {};
  const headerRegex = /^\[(\w+)\s+"([^"]*)"\]$/gm;
  let match;
  while ((match = headerRegex.exec(pgn))) {
    headers[match[1]] = match[2];
  }
  const body = pgn
    .replace(/^\[[^\]]+\]\s*$/gm, "")
    .replace(/\{[^}]*\}/g, " ")
    .replace(/;.*$/gm, " ")
    .replace(/\$\d+/g, " ");
  const tokens = body.match(/\(|\)|\d+\.(?:\.\.)?|1-0|0-1|1\/2-1\/2|\*|[^\s()]+/g) || [];
  const root = { id: "root", label: "root", children: [], parent: null, initialState: parseFen(headers.FEN || undefined) };
  let current = root;
  const stack = [];
  let sequence = 0;

  tokens.forEach((token) => {
    if (token === "(") {
      stack.push(current);
      current = current.parent || root;
      return;
    }
    if (token === ")") {
      current = stack.pop() || root;
      return;
    }
    if (/^\d+\./.test(token) || /^(1-0|0-1|1\/2-1\/2|\*)$/.test(token)) {
      return;
    }
    const parentState = current.id === "root" ? root.initialState : current.state;
    const moveState = applySanMove(parentState, token);
    const node = {
      id: `chess-${sequence += 1}`,
      label: token,
      move: token,
      parent: current,
      state: moveState,
      from: moveState.lastMove?.from || null,
      to: moveState.lastMove?.to || null,
      children: [],
    };
    current.children.push(node);
    current = node;
  });

  return { root, headers };
}

function buildStatesForPath(path, initialState) {
  const states = [cloneState(initialState)];
  path.forEach((node) => states.push(cloneState(node.state)));
  return states;
}

function createInitialState() {
  return parseFen("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
}

function parseFen(fen) {
  const source = fen || "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
  const [placement, turn = "w", castling = "KQkq", enPassant = "-", halfmove = "0", fullmove = "1"] = source.split(/\s+/);
  const rows = placement.split("/");
  const board = Array.from({ length: 8 }, () => Array(8).fill(null));
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
  return { board, turn, castling, enPassant, halfmove: Number(halfmove), fullmove: Number(fullmove), lastMove: null };
}

function cloneState(state) {
  return {
    board: state.board.map((row) => [...row]),
    turn: state.turn,
    castling: state.castling,
    enPassant: state.enPassant,
    halfmove: state.halfmove,
    fullmove: state.fullmove,
    lastMove: state.lastMove ? { ...state.lastMove, from: { ...state.lastMove.from }, to: { ...state.lastMove.to } } : null,
  };
}

function applySanMove(state, sanToken) {
  const san = sanitizeSan(sanToken);
  const working = cloneState(state);
  const side = working.turn;
  const legalMoves = generateLegalMoves(working, side);

  if (san === "O-O" || san === "0-0") {
    const move = legalMoves.find((candidate) => candidate.castle === "king");
    if (!move) {
      throw new Error(`Illegal castle move: ${sanToken}`);
    }
    return applyMove(working, move);
  }
  if (san === "O-O-O" || san === "0-0-0") {
    const move = legalMoves.find((candidate) => candidate.castle === "queen");
    if (!move) {
      throw new Error(`Illegal castle move: ${sanToken}`);
    }
    return applyMove(working, move);
  }

  const promotionMatch = san.match(/=([QRBN])/);
  const promotion = promotionMatch ? promotionMatch[1] : null;
  const targetMatch = san.match(/([a-h][1-8])$/);
  if (!targetMatch) {
    throw new Error(`Unsupported SAN move: ${sanToken}`);
  }
  const target = squareToCoords(targetMatch[1]);
  const pieceLetter = /^[KQRBN]/.test(san) ? san[0] : "P";
  const isCapture = san.includes("x");
  const sourceHint = san
    .replace(/^(O-O(-O)?|0-0(-0)?)$/, "")
    .replace(/^[KQRBN]?/, "")
    .replace(/x/, "")
    .replace(/[+#]/g, "")
    .replace(/=[QRBN]/, "")
    .replace(/[a-h][1-8]$/, "");

  const candidates = legalMoves.filter((move) => {
    const movingPiece = working.board[move.from.y][move.from.x];
    if (!movingPiece || movingPiece.toUpperCase() !== pieceLetter) {
      return false;
    }
    if (move.to.x !== target.x || move.to.y !== target.y) {
      return false;
    }
    if (Boolean(move.capture) !== isCapture && !move.enPassant) {
      return false;
    }
    if (promotion && move.promotion !== promotion) {
      return false;
    }
    return sourceHintMatches(move.from, sourceHint);
  });

  if (!candidates.length) {
    throw new Error(`No legal move found for SAN ${sanToken}`);
  }
  return applyMove(working, candidates[0]);
}

function sanitizeSan(san) {
  return san.replace(/[!?]+/g, "").replace(/[+#]+/g, "");
}

function sourceHintMatches(from, hint) {
  if (!hint) {
    return true;
  }
  if (hint.length === 2) {
    return FILES[from.x] === hint[0] && String(8 - from.y) === hint[1];
  }
  if (/[a-h]/.test(hint)) {
    return FILES[from.x] === hint;
  }
  if (/[1-8]/.test(hint)) {
    return String(8 - from.y) === hint;
  }
  return true;
}

function squareToCoords(square) {
  return { x: FILES.indexOf(square[0]), y: 8 - Number(square[1]) };
}

function coordsToSquare(x, y) {
  return `${FILES[x]}${8 - y}`;
}

function generateLegalMoves(state, side) {
  const moves = [];
  for (let y = 0; y < 8; y += 1) {
    for (let x = 0; x < 8; x += 1) {
      const piece = state.board[y][x];
      if (!piece) {
        continue;
      }
      if ((side === "w" && piece !== piece.toUpperCase()) || (side === "b" && piece !== piece.toLowerCase())) {
        continue;
      }
      generatePseudoMoves(state, x, y, piece).forEach((move) => {
        const nextState = applyMove(cloneState(state), move);
        if (!isInCheck(nextState, side)) {
          moves.push(move);
        }
      });
    }
  }
  return moves;
}

function generatePseudoMoves(state, x, y, piece) {
  const moves = [];
  const isWhite = piece === piece.toUpperCase();
  const side = isWhite ? "w" : "b";
  const add = (toX, toY, extra = {}) => {
    if (toX < 0 || toX >= 8 || toY < 0 || toY >= 8) {
      return;
    }
    const target = state.board[toY][toX];
    if (target && ((isWhite && target === target.toUpperCase()) || (!isWhite && target === target.toLowerCase()))) {
      return;
    }
    moves.push({ from: { x, y }, to: { x: toX, y: toY }, piece, capture: target || null, ...extra });
  };

  const lower = piece.toLowerCase();
  if (lower === "p") {
    const dir = isWhite ? -1 : 1;
    const startRank = isWhite ? 6 : 1;
    const promotionRank = isWhite ? 0 : 7;
    if (!state.board[y + dir]?.[x]) {
      if (y + dir === promotionRank) {
        ["Q", "R", "B", "N"].forEach((promotion) => add(x, y + dir, { promotion }));
      } else {
        add(x, y + dir);
      }
      if (y === startRank && !state.board[y + dir * 2]?.[x]) {
        add(x, y + dir * 2, { doubleStep: true });
      }
    }
    [-1, 1].forEach((dx) => {
      const targetX = x + dx;
      const targetY = y + dir;
      const target = state.board[targetY]?.[targetX];
      if (target && ((isWhite && target === target.toLowerCase()) || (!isWhite && target === target.toUpperCase()))) {
        if (targetY === promotionRank) {
          ["Q", "R", "B", "N"].forEach((promotion) => add(targetX, targetY, { promotion }));
        } else {
          add(targetX, targetY);
        }
      }
      if (!target && state.enPassant !== "-" && coordsToSquare(targetX, targetY) === state.enPassant) {
        add(targetX, targetY, { enPassant: true, capture: isWhite ? "p" : "P" });
      }
    });
    return moves;
  }

  if (lower === "n") {
    [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]].forEach(([dx, dy]) => add(x + dx, y + dy));
    return moves;
  }

  if (lower === "k") {
    [-1, 0, 1].forEach((dx) => [-1, 0, 1].forEach((dy) => dx || dy ? add(x + dx, y + dy) : null));
    addCastleMoves(state, side, moves);
    return moves;
  }

  const vectors =
    lower === "b"
      ? [[1, 1], [1, -1], [-1, 1], [-1, -1]]
      : lower === "r"
        ? [[1, 0], [-1, 0], [0, 1], [0, -1]]
        : [[1, 1], [1, -1], [-1, 1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]];

  vectors.forEach(([dx, dy]) => {
    let nx = x + dx;
    let ny = y + dy;
    while (nx >= 0 && nx < 8 && ny >= 0 && ny < 8) {
      const target = state.board[ny][nx];
      if (!target) {
        add(nx, ny);
      } else {
        if ((isWhite && target === target.toLowerCase()) || (!isWhite && target === target.toUpperCase())) {
          add(nx, ny);
        }
        break;
      }
      nx += dx;
      ny += dy;
    }
  });
  return moves;
}

function addCastleMoves(state, side, moves) {
  const y = side === "w" ? 7 : 0;
  const enemy = side === "w" ? "b" : "w";
  if (isInCheck(state, side)) {
    return;
  }
  const rights = state.castling || "";
  if ((side === "w" && rights.includes("K")) || (side === "b" && rights.includes("k"))) {
    if (!state.board[y][5] && !state.board[y][6] && !isSquareAttacked(state, 5, y, enemy) && !isSquareAttacked(state, 6, y, enemy)) {
      moves.push({ from: { x: 4, y }, to: { x: 6, y }, piece: side === "w" ? "K" : "k", castle: "king" });
    }
  }
  if ((side === "w" && rights.includes("Q")) || (side === "b" && rights.includes("q"))) {
    if (!state.board[y][1] && !state.board[y][2] && !state.board[y][3] && !isSquareAttacked(state, 2, y, enemy) && !isSquareAttacked(state, 3, y, enemy)) {
      moves.push({ from: { x: 4, y }, to: { x: 2, y }, piece: side === "w" ? "K" : "k", castle: "queen" });
    }
  }
}

function applyMove(state, move) {
  const next = cloneState(state);
  const piece = next.board[move.from.y][move.from.x];
  next.board[move.from.y][move.from.x] = null;
  if (move.enPassant) {
    next.board[move.from.y][move.to.x] = null;
  }
  if (move.castle === "king") {
    next.board[move.to.y][move.to.x] = piece;
    next.board[move.to.y][5] = next.board[move.to.y][7];
    next.board[move.to.y][7] = null;
  } else if (move.castle === "queen") {
    next.board[move.to.y][move.to.x] = piece;
    next.board[move.to.y][3] = next.board[move.to.y][0];
    next.board[move.to.y][0] = null;
  } else {
    next.board[move.to.y][move.to.x] = move.promotion ? (state.turn === "w" ? move.promotion : move.promotion.toLowerCase()) : piece;
  }

  next.castling = next.castling.replace(state.turn === "w" ? /[KQ]/g : /[kq]/g, "");
  if (move.from.x === 0 && move.from.y === 7) {
    next.castling = next.castling.replace("Q", "");
  }
  if (move.from.x === 7 && move.from.y === 7) {
    next.castling = next.castling.replace("K", "");
  }
  if (move.from.x === 0 && move.from.y === 0) {
    next.castling = next.castling.replace("q", "");
  }
  if (move.from.x === 7 && move.from.y === 0) {
    next.castling = next.castling.replace("k", "");
  }
  if (piece.toLowerCase() === "k") {
    next.castling = next.castling.replace(state.turn === "w" ? /[KQ]/g : /[kq]/g, "");
  }
  if (move.capture?.toLowerCase() === "r") {
    if (move.to.x === 0 && move.to.y === 7) {
      next.castling = next.castling.replace("Q", "");
    }
    if (move.to.x === 7 && move.to.y === 7) {
      next.castling = next.castling.replace("K", "");
    }
    if (move.to.x === 0 && move.to.y === 0) {
      next.castling = next.castling.replace("q", "");
    }
    if (move.to.x === 7 && move.to.y === 0) {
      next.castling = next.castling.replace("k", "");
    }
  }

  next.enPassant = move.doubleStep ? coordsToSquare(move.from.x, (move.from.y + move.to.y) / 2) : "-";
  next.turn = state.turn === "w" ? "b" : "w";
  next.lastMove = { ...move, from: { ...move.from }, to: { ...move.to } };
  return next;
}

function isInCheck(state, side) {
  let king = null;
  for (let y = 0; y < 8; y += 1) {
    for (let x = 0; x < 8; x += 1) {
      const piece = state.board[y][x];
      if (piece === (side === "w" ? "K" : "k")) {
        king = { x, y };
      }
    }
  }
  return king ? isSquareAttacked(state, king.x, king.y, side === "w" ? "b" : "w") : false;
}

function isSquareAttacked(state, x, y, attackerSide) {
  for (let row = 0; row < 8; row += 1) {
    for (let col = 0; col < 8; col += 1) {
      const piece = state.board[row][col];
      if (!piece) {
        continue;
      }
      if ((attackerSide === "w" && piece !== piece.toUpperCase()) || (attackerSide === "b" && piece !== piece.toLowerCase())) {
        continue;
      }
      if (attacksSquare(state, col, row, piece, x, y)) {
        return true;
      }
    }
  }
  return false;
}

function attacksSquare(state, fromX, fromY, piece, toX, toY) {
  const isWhite = piece === piece.toUpperCase();
  const dx = toX - fromX;
  const dy = toY - fromY;
  switch (piece.toLowerCase()) {
    case "p":
      return dy === (isWhite ? -1 : 1) && Math.abs(dx) === 1;
    case "n":
      return (Math.abs(dx) === 1 && Math.abs(dy) === 2) || (Math.abs(dx) === 2 && Math.abs(dy) === 1);
    case "b":
      return Math.abs(dx) === Math.abs(dy) && clearPath(state.board, fromX, fromY, toX, toY);
    case "r":
      return (dx === 0 || dy === 0) && clearPath(state.board, fromX, fromY, toX, toY);
    case "q":
      return ((dx === 0 || dy === 0) || Math.abs(dx) === Math.abs(dy)) && clearPath(state.board, fromX, fromY, toX, toY);
    case "k":
      return Math.max(Math.abs(dx), Math.abs(dy)) === 1;
    default:
      return false;
  }
}

function clearPath(board, fromX, fromY, toX, toY) {
  const stepX = Math.sign(toX - fromX);
  const stepY = Math.sign(toY - fromY);
  let x = fromX + stepX;
  let y = fromY + stepY;
  while (x !== toX || y !== toY) {
    if (board[y][x]) {
      return false;
    }
    x += stepX;
    y += stepY;
  }
  return true;
}

function formatMove(move) {
  const piece = move.piece ? move.piece.toUpperCase() : "";
  return `${piece}${coordsToSquare(move.from.x, move.from.y)}${move.capture ? "x" : "-"}${coordsToSquare(move.to.x, move.to.y)}${move.promotion ? `=${move.promotion}` : ""}`;
}
