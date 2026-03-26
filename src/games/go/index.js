import {
  CHINESE_FONT_FAMILY,
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

const GO_THEMES = {
  kaya: { board: "#d9b56f", line: "#5e431a", bg: "#efe1be" },
  ink: { board: "#ceb989", line: "#403423", bg: "#f3ead6" },
};

export function mountGo(root) {
  root.innerHTML = `
    <div class="mode-shell">
      <section class="board-panel">
        <div class="board-toolbar">
          <div class="toolbar-group">
            <button data-id="play-toggle" class="primary-button">Switch To Play Mode</button>
            <button data-id="clear-board">Clear Board</button>
            <button data-id="reset-size">Reset Empty Board</button>
          </div>
          <div class="toolbar-group">
            <span class="status-pill" data-id="mode-pill">Editor</span>
            <button data-id="turn-pill" class="status-pill" type="button">Black To Move</button>
            <span class="status-pill" data-id="branch-summary">Manual Board</span>
          </div>
        </div>
        <div class="canvas-board-wrap">
          <canvas data-id="board-canvas" class="board-canvas" width="720" height="720"></canvas>
        </div>
        <div class="board-footer">
          <p data-id="position-summary">Use editor mode to place stones or parse an SGF branch, then switch to play mode for move-by-move reading.</p>
          <p data-id="selection-summary">Range export works for SGF branches and manual play lines.</p>
        </div>
      </section>
      <aside class="control-panel">
        <section class="card">
          <h2>Editor Palette</h2>
          <div data-id="palette" class="palette"></div>
        </section>
        <section class="card">
          <h2>SGF Import</h2>
          <label class="field-label">
            SGF
            <textarea data-id="sgf-input" rows="12" placeholder="(;GM[1]FF[4]SZ[19];B[pd];W[dd])"></textarea>
          </label>
          <div class="inline-fields">
            <label>
              Board Size
              <select data-id="board-size">
                <option value="19">19x19</option>
                <option value="13">13x13</option>
                <option value="9">9x9</option>
              </select>
            </label>
            <label>
              Frame Delay (ms)
              <input data-id="delay-input" type="number" min="100" step="50" value="650" />
            </label>
          </div>
          <div class="toolbar-group">
            <button data-id="load-sgf" class="primary-button">Parse SGF</button>
          </div>
        </section>
        <section class="card">
          <h2>Branch & Range</h2>
          <label class="field-label">
            Branch
            <select data-id="branch-select"></select>
          </label>
          <label class="field-label">
            Preview Move
            <input data-id="preview-slider" type="range" min="0" max="0" value="0" />
          </label>
          <div class="inline-fields">
            <label>Start Move <input data-id="range-start" type="number" min="0" step="1" value="0" /></label>
            <label>End Move <input data-id="range-end" type="number" min="0" step="1" value="0" /></label>
          </div>
          <p class="helper-copy" data-id="range-summary">Move range export is enabled after parsing or manual play.</p>
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
                <option value="kaya">Kaya</option>
                <option value="ink">Ink</option>
              </select>
            </label>
            <label>
              Label Moves
              <select data-id="label-mode">
                <option value="last">Last Move Only</option>
                <option value="none">No Labels</option>
              </select>
            </label>
          </div>
          <div class="toggle-list">
            <label class="toggle-option"><input data-id="crop-toggle" type="checkbox" /> <span>Use Crop Region</span></label>
            <label class="toggle-option"><input data-id="show-coords" type="checkbox" /> <span>Show Coordinates</span></label>
            <label class="toggle-option"><input data-id="show-turn" type="checkbox" /> <span>Show Turn Indicator</span></label>
          </div>
          <div class="inline-fields">
            <label>X1 <input data-id="crop-x1" type="number" min="1" max="19" value="1" /></label>
            <label>X2 <input data-id="crop-x2" type="number" min="1" max="19" value="19" /></label>
          </div>
          <div class="inline-fields">
            <label>Y1 <input data-id="crop-y1" type="number" min="1" max="19" value="1" /></label>
            <label>Y2 <input data-id="crop-y2" type="number" min="1" max="19" value="19" /></label>
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
          <img data-id="gif-preview" class="gif-preview" alt="Generated Go GIF preview" />
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
    boardSize: 19,
    tree: createRoot(),
    branchPaths: [[]],
    branchIndex: 0,
    currentPath: [],
    currentStates: [emptyPosition(19)],
    previewMove: 0,
    manual: {
      baseState: emptyPosition(19),
      states: [emptyPosition(19)],
      history: [],
      paletteSelection: "B",
    },
  };

  buildPalette();
  canvas.addEventListener("click", handleCanvasClick);
  get("play-toggle").addEventListener("click", () => {
    state.uiMode = state.uiMode === "edit" ? "play" : "edit";
    render();
  });
  get("turn-pill").addEventListener("click", () => {
    const base = getActiveBaseState();
    base.turn = base.turn === "B" ? "W" : "B";
    if (state.source === "manual") {
      rebuildManualStates();
    } else {
      state.source = "manual";
      state.manual.baseState = clonePosition(base);
      state.manual.history = [];
      rebuildManualStates();
    }
    render();
  });
  get("clear-board").addEventListener("click", () => {
    state.source = "manual";
    state.manual.baseState = emptyPosition(Number(get("board-size").value) || state.boardSize);
    state.manual.history = [];
    rebuildManualStates();
    render();
  });
  get("reset-size").addEventListener("click", () => {
    state.source = "manual";
    state.manual.baseState = emptyPosition(Number(get("board-size").value) || state.boardSize);
    state.manual.history = [];
    rebuildManualStates();
    render();
  });
  get("load-sgf").addEventListener("click", loadSgf);
  get("branch-select").addEventListener("change", () => {
    state.branchIndex = Number(get("branch-select").value) || 0;
    state.source = "sgf";
    setCurrentBranch();
  });
  get("preview-slider").addEventListener("input", () => {
    state.previewMove = clamp(Number(get("preview-slider").value) || 0, 0, getActiveHistory().length);
    render();
  });
  [get("range-start"), get("range-end")].forEach((input) => input.addEventListener("input", () => {
    normalizeExportInputs();
    render();
  }));
  [
    get("board-size"),
    get("theme-select"),
    get("label-mode"),
    get("crop-toggle"),
    get("show-coords"),
    get("show-turn"),
    get("crop-x1"),
    get("crop-x2"),
    get("crop-y1"),
    get("crop-y2"),
  ].forEach((input) => input.addEventListener("input", () => {
    if (input === get("board-size") && state.source === "manual") {
      state.boardSize = Number(get("board-size").value) || state.boardSize;
      state.manual.baseState = emptyPosition(state.boardSize);
      state.manual.history = [];
      rebuildManualStates();
    }
    render();
  }));
  get("render-gif").addEventListener("click", exportGif);

  seedManualBranch();
  render();

  return {
    getSummary() {
      return {
        moves: getActiveHistory().length,
        description: "Go now supports Xiangqi-style editor and play modes alongside SGF import and GIF export.",
      };
    },
  };

  function createRoot() {
    return { id: "root", label: "root", children: [], parent: null, props: {}, initialState: null };
  }

  function emptyPosition(size) {
    return { stones: new Map(), turn: "B", lastMove: null, moveNumber: 0, size };
  }

  function clonePosition(position) {
    return {
      stones: new Map(position.stones),
      turn: position.turn,
      lastMove: position.lastMove ? { ...position.lastMove } : null,
      moveNumber: position.moveNumber,
      size: position.size,
    };
  }

  function buildPalette() {
    const palette = get("palette");
    palette.innerHTML = "";
    [
      { id: "B", label: "Black" },
      { id: "W", label: "White" },
      { id: ".", label: "Erase" },
    ].forEach((entry) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "palette-option";
      button.dataset.piece = entry.id;
      const badge = document.createElement("span");
      badge.className = "palette-piece";
      if (entry.id === "B") {
        badge.textContent = "●";
        badge.style.color = "#111214";
      } else if (entry.id === "W") {
        badge.textContent = "○";
        badge.style.color = "#8d8d8d";
      } else {
        badge.className = "palette-piece erase-piece";
      }
      button.append(badge);
      button.addEventListener("click", () => {
        state.manual.paletteSelection = entry.id;
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

  function seedManualBranch() {
    const select = get("branch-select");
    select.innerHTML = "";
    const option = document.createElement("option");
    option.value = "0";
    option.textContent = "Manual Line";
    select.append(option);
  }

  function loadSgf() {
    try {
      const parsed = parseSgf(get("sgf-input").value, Number(get("board-size").value) || 19);
      state.tree = parsed.root;
      state.boardSize = parsed.size;
      get("board-size").value = String(parsed.size);
      state.branchPaths = buildBranchOptions(get("branch-select"), parsed.root, (node) => node.label);
      state.branchIndex = 0;
      state.source = "sgf";
      setCurrentBranch();
      get("position-summary").textContent = `SGF parsed for ${parsed.size}x${parsed.size}. ${state.branchPaths.length} branch${state.branchPaths.length === 1 ? "" : "es"} available.`;
    } catch (error) {
      window.alert(error.message);
    }
  }

  function setCurrentBranch() {
    state.currentPath = state.branchPaths[state.branchIndex] || [];
    state.currentStates = buildStatesForPath(state.currentPath, state.tree.initialState);
    state.previewMove = clamp(state.previewMove, 0, state.currentPath.length);
    render();
  }

  function getActiveHistory() {
    return state.source === "manual" ? state.manual.history : state.currentPath;
  }

  function getActiveStates() {
    return state.source === "manual" ? state.manual.states : state.currentStates;
  }

  function getActiveBaseState() {
    return state.source === "manual" ? state.manual.baseState : clonePosition(getActiveStates()[0]);
  }

  function rebuildManualStates() {
    state.manual.states = [clonePosition(state.manual.baseState)];
    let current = clonePosition(state.manual.baseState);
    state.manual.history.forEach((entry) => {
      current = applyGoMove(clonePosition(current), entry.point, entry.color);
      state.manual.states.push(clonePosition(current));
    });
    state.previewMove = clamp(state.previewMove, 0, state.manual.history.length);
    state.boardSize = state.manual.baseState.size;
    seedManualBranch();
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

  function render() {
    renderPalette();
    const activeHistory = getActiveHistory();
    const activeStates = getActiveStates();
    const previewSlider = get("preview-slider");
    previewSlider.max = String(activeHistory.length);
    previewSlider.value = String(state.previewMove);
    syncRangeInputs(get("range-start"), get("range-end"), previewSlider, activeHistory.length);
    normalizeExportInputs();
    get("mode-pill").textContent = state.uiMode === "edit" ? "Editor" : "Play";
    get("play-toggle").textContent = state.uiMode === "edit" ? "Switch To Play Mode" : "Switch To Edit Mode";
    const active = activeStates[state.previewMove] || activeStates[0];
    get("turn-pill").textContent = active.turn === "B" ? "Black To Move" : "White To Move";
    get("turn-pill").classList.toggle("turn-black", active.turn === "B");
    get("turn-pill").classList.toggle("turn-red", active.turn === "W");
    get("branch-summary").textContent =
      state.source === "manual"
        ? `Manual Line · ${state.manual.history.length} move${state.manual.history.length === 1 ? "" : "s"}`
        : `Branch ${state.branchIndex + 1} · ${state.currentPath.length} move${state.currentPath.length === 1 ? "" : "s"}`;
    const range = getRange();
    get("range-summary").textContent = `Exporting moves ${range.start} to ${range.end}.`;
    get("move-list").value = formatMoveList(activeHistory.map((item) => item.label || `${item.color} ${toSgfPoint(item.point.x, item.point.y)}`));
    get("selection-summary").textContent =
      state.uiMode === "edit"
        ? "Editor mode places or erases stones directly."
        : "Play mode alternates turns and applies captures.";
    drawPreview();
  }

  function getCropRect() {
    const size = Number(get("board-size").value) || state.boardSize;
    const x1 = clamp(Number(get("crop-x1").value) || 1, 1, size);
    const x2 = clamp(Number(get("crop-x2").value) || size, x1, size);
    const y1 = clamp(Number(get("crop-y1").value) || 1, 1, size);
    const y2 = clamp(Number(get("crop-y2").value) || size, y1, size);
    get("crop-x1").value = String(x1);
    get("crop-x2").value = String(x2);
    get("crop-y1").value = String(y1);
    get("crop-y2").value = String(y2);
    const metrics = getGoMetrics(canvas.width, canvas.height, size, get("show-coords").checked);
    return {
      x: metrics.originX + (x1 - 1) * metrics.cell - metrics.cell * 0.55,
      y: metrics.originY + (y1 - 1) * metrics.cell - metrics.cell * 0.55,
      width: (x2 - x1 + 1) * metrics.cell + metrics.cell * 0.1,
      height: (y2 - y1 + 1) * metrics.cell + metrics.cell * 0.1,
    };
  }

  function drawPreview() {
    const active = getActiveStates()[state.previewMove] || getActiveStates()[0];
    drawGoBoard(ctx, canvas, active, {
      theme: GO_THEMES[get("theme-select").value] || GO_THEMES.kaya,
      showCoords: get("show-coords").checked,
      showTurnIndicator: get("show-turn").checked,
      labelMode: get("label-mode").value,
      overlayCrop: get("crop-toggle").checked ? getCropRect() : null,
    });
  }

  function handleCanvasClick(event) {
    const point = canvasPointToIntersection(canvas, event, get("show-coords").checked, Number(get("board-size").value) || state.boardSize);
    if (!point) {
      return;
    }
    state.source = "manual";
    const current = clonePosition(state.manual.states[state.previewMove] || state.manual.states[0]);
    if (state.uiMode === "edit") {
      const key = `${point.x},${point.y}`;
      if (state.manual.paletteSelection === ".") {
        current.stones.delete(key);
      } else {
        current.stones.set(key, { color: state.manual.paletteSelection });
      }
      current.lastMove = null;
      state.manual.baseState = current;
      state.manual.history = [];
      state.previewMove = 0;
      rebuildManualStates();
      render();
      return;
    }

    const moveColor = current.turn;
    const applied = applyGoMove(current, point, moveColor);
    if (!applied) {
      return;
    }
    if (state.previewMove < state.manual.history.length) {
      state.manual.history = state.manual.history.slice(0, state.previewMove);
    }
    state.manual.history.push({
      color: moveColor,
      point,
      label: `${moveColor} ${toSgfPoint(point.x, point.y)}`,
    });
    state.previewMove = state.manual.history.length;
    rebuildManualStates();
    render();
  }

  async function exportGif() {
    const range = getRange();
    const crop = get("crop-toggle").checked ? getCropRect() : null;
    const frames = [];
    for (let index = range.start; index <= range.end; index += 1) {
      const frameCanvas = createBoardCanvas(720, 720);
      drawGoBoard(frameCanvas.getContext("2d"), frameCanvas, getActiveStates()[index] || getActiveStates()[0], {
        theme: GO_THEMES[get("theme-select").value] || GO_THEMES.kaya,
        showCoords: get("show-coords").checked,
        showTurnIndicator: get("show-turn").checked,
        labelMode: get("label-mode").value,
      });
      frames.push(cropCanvas(frameCanvas, crop, 720, 720));
    }
    try {
      await renderGif({
        frames,
        delay: Math.max(100, Number(get("delay-input").value) || 650),
        endDelay: Math.max(0, Number(get("end-delay-input").value) || 0),
        filename: "go-sequence.gif",
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

function canvasPointToIntersection(canvas, event, showCoords, size) {
  const rect = canvas.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * canvas.width;
  const y = ((event.clientY - rect.top) / rect.height) * canvas.height;
  const metrics = getGoMetrics(canvas.width, canvas.height, size, showCoords);
  const gridX = Math.round((x - metrics.originX) / metrics.cell);
  const gridY = Math.round((y - metrics.originY) / metrics.cell);
  if (gridX < 0 || gridX >= size || gridY < 0 || gridY >= size) {
    return null;
  }
  return { x: gridX, y: gridY };
}

function drawGoBoard(ctx, canvas, position, options) {
  const size = position.size;
  const metrics = getGoMetrics(canvas.width, canvas.height, size, options.showCoords);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = options.theme.bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = options.theme.board;
  ctx.fillRect(metrics.originX - metrics.cell * 0.7, metrics.originY - metrics.cell * 0.7, metrics.boardSpan + metrics.cell * 1.4, metrics.boardSpan + metrics.cell * 1.4);
  ctx.strokeStyle = options.theme.line;
  ctx.lineWidth = Math.max(1.4, metrics.cell * 0.05);
  for (let i = 0; i < size; i += 1) {
    const offset = metrics.originX + i * metrics.cell;
    ctx.beginPath();
    ctx.moveTo(metrics.originX, offset);
    ctx.lineTo(metrics.originX + metrics.boardSpan, offset);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(offset, metrics.originY);
    ctx.lineTo(offset, metrics.originY + metrics.boardSpan);
    ctx.stroke();
  }

  getStarPoints(size).forEach(([x, y]) => {
    const pointX = metrics.originX + (x - 1) * metrics.cell;
    const pointY = metrics.originY + (y - 1) * metrics.cell;
    ctx.fillStyle = options.theme.line;
    ctx.beginPath();
    ctx.arc(pointX, pointY, metrics.cell * 0.08, 0, Math.PI * 2);
    ctx.fill();
  });

  position.stones.forEach((stone, key) => {
    const [x, y] = key.split(",").map(Number);
    const centerX = metrics.originX + x * metrics.cell;
    const centerY = metrics.originY + y * metrics.cell;
    const radial = ctx.createRadialGradient(centerX - metrics.cell * 0.18, centerY - metrics.cell * 0.18, metrics.cell * 0.08, centerX, centerY, metrics.cell * 0.46);
    if (stone.color === "B") {
      radial.addColorStop(0, "#555a63");
      radial.addColorStop(1, "#111214");
    } else {
      radial.addColorStop(0, "#ffffff");
      radial.addColorStop(1, "#d9dde3");
    }
    ctx.fillStyle = radial;
    ctx.beginPath();
    ctx.arc(centerX, centerY, metrics.cell * 0.45, 0, Math.PI * 2);
    ctx.fill();
    if (options.labelMode === "last" && position.lastMove && position.lastMove.x === x && position.lastMove.y === y) {
      ctx.fillStyle = stone.color === "B" ? "#f0e2a1" : "#a12218";
      ctx.font = `700 ${Math.max(14, metrics.cell * 0.29)}px ${UI_FONT_FAMILY}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(position.moveNumber), centerX, centerY + 1);
    }
  });

  if (options.showCoords) {
    ctx.font = `600 ${metrics.coordFontSize}px ${UI_FONT_FAMILY}`;
    ctx.fillStyle = options.theme.line;
    for (let index = 0; index < size; index += 1) {
      const fileLabel = String.fromCharCode(65 + index + (index >= 8 ? 1 : 0));
      ctx.fillText(fileLabel, metrics.originX + index * metrics.cell, metrics.originY + metrics.boardSpan + metrics.coordOffset);
      ctx.fillText(String(index + 1), metrics.originX - metrics.coordOffset, metrics.originY + index * metrics.cell);
    }
  }

  if (options.showTurnIndicator) {
    ctx.font = `600 ${metrics.coordFontSize}px ${UI_FONT_FAMILY}`;
    ctx.textAlign = "left";
    ctx.fillStyle = options.theme.line;
    ctx.fillText(`Turn: ${position.turn === "B" ? "Black" : "White"}`, metrics.originX, metrics.originY - 18);
  }

  if (options.overlayCrop) {
    drawCropOverlay(ctx, metrics, options.overlayCrop, "rgba(165, 47, 28, 0.92)");
  }
}

function getGoMetrics(width, height, size, showCoords) {
  const padding = showCoords ? 82 : 58;
  const boardSpan = Math.min(width - padding * 2, height - padding * 2);
  const cell = boardSpan / (size - 1);
  return { originX: (width - boardSpan) / 2, originY: (height - boardSpan) / 2, boardSpan, cell, coordFontSize: Math.max(12, cell * 0.24), coordOffset: 24 };
}

function getStarPoints(size) {
  if (size === 19) {
    return [[4, 4], [10, 4], [16, 4], [4, 10], [10, 10], [16, 10], [4, 16], [10, 16], [16, 16]];
  }
  if (size === 13) {
    return [[4, 4], [7, 4], [10, 4], [4, 7], [7, 7], [10, 7], [4, 10], [7, 10], [10, 10]];
  }
  return [[3, 3], [5, 5], [7, 7], [3, 7], [7, 3]];
}

function parseSgf(sgf, fallbackSize) {
  if (!sgf.trim()) {
    throw new Error("Paste an SGF first.");
  }
  let index = 0;
  let sequence = 0;

  function skipWhitespace() {
    while (/\s/.test(sgf[index] || "")) {
      index += 1;
    }
  }

  function parseValue() {
    let value = "";
    index += 1;
    while (index < sgf.length) {
      const char = sgf[index];
      if (char === "\\") {
        value += sgf[index + 1] || "";
        index += 2;
        continue;
      }
      if (char === "]") {
        index += 1;
        break;
      }
      value += char;
      index += 1;
    }
    return value;
  }

  function parseNode(parent) {
    const node = { id: `go-${sequence += 1}`, label: "", children: [], parent, props: {} };
    while (true) {
      skipWhitespace();
      const identMatch = /^[A-Za-z]+/.exec(sgf.slice(index));
      if (!identMatch) {
        break;
      }
      const key = identMatch[0];
      index += key.length;
      node.props[key] = [];
      while (sgf[index] === "[") {
        node.props[key].push(parseValue());
      }
    }
    node.label = describeNode(node);
    return node;
  }

  function parseTree(parent = null) {
    skipWhitespace();
    if (sgf[index] !== "(") {
      throw new Error("Invalid SGF tree.");
    }
    index += 1;
    let currentParent = parent;
    let treeRoot = null;
    while (index < sgf.length) {
      skipWhitespace();
      if (sgf[index] === ";") {
        index += 1;
        const node = parseNode(currentParent);
        if (!treeRoot) {
          treeRoot = node;
        }
        if (currentParent) {
          currentParent.children.push(node);
        }
        currentParent = node;
      } else if (sgf[index] === "(") {
        parseTree(currentParent);
      } else if (sgf[index] === ")") {
        index += 1;
        break;
      } else {
        index += 1;
      }
    }
    return treeRoot;
  }

  const parsedRoot = parseTree();
  const size = Number(parsedRoot?.props?.SZ?.[0] || fallbackSize || 19);
  const root = { id: "root", label: "root", parent: null, children: [], props: {}, initialState: buildInitialState(parsedRoot, size) };
  if (parsedRoot) {
    attachChildren(root, parsedRoot);
  }
  return { root, size };
}

function attachChildren(parent, sgfNode) {
  const node = { id: sgfNode.id, label: sgfNode.label, parent, props: sgfNode.props, children: [] };
  parent.children.push(node);
  sgfNode.children.forEach((child) => attachChildren(node, child));
}

function buildInitialState(sgfRoot, size) {
  const state = emptyPosition(size);
  if (sgfRoot) {
    applySetupProps(state, sgfRoot.props);
    if (sgfRoot.props.PL?.[0] === "W") {
      state.turn = "W";
    } else {
      state.turn = "B";
    }
  }
  return state;
}

function buildStatesForPath(path, initialState) {
  const states = [clonePosition(initialState)];
  path.forEach((node) => {
    const next = clonePosition(states[states.length - 1]);
    applySetupProps(next, node.props);
    if (node.props.B || node.props.W) {
      const color = node.props.B ? "B" : "W";
      const value = (node.props.B || node.props.W)[0];
      const point = value ? sgfPointToCoords(value) : null;
      if (point) {
        applyGoMove(next, point, color);
      } else {
        next.turn = color === "B" ? "W" : "B";
        next.moveNumber += 1;
        next.lastMove = null;
      }
    }
    states.push(next);
  });
  return states;
}

function applySetupProps(position, props) {
  (props.AB || []).forEach((value) => {
    const point = sgfPointToCoords(value);
    if (point) {
      position.stones.set(`${point.x},${point.y}`, { color: "B" });
    }
  });
  (props.AW || []).forEach((value) => {
    const point = sgfPointToCoords(value);
    if (point) {
      position.stones.set(`${point.x},${point.y}`, { color: "W" });
    }
  });
  (props.AE || []).forEach((value) => {
    const point = sgfPointToCoords(value);
    if (point) {
      position.stones.delete(`${point.x},${point.y}`);
    }
  });
}

function applyGoMove(position, point, color) {
  const key = `${point.x},${point.y}`;
  if (position.stones.has(key)) {
    return null;
  }
  position.stones.set(key, { color });
  captureOpponents(position, point.x, point.y, color);
  if (!hasLiberty(position, point.x, point.y, color, new Set())) {
    position.stones.delete(key);
    return null;
  }
  position.lastMove = { ...point };
  position.turn = color === "B" ? "W" : "B";
  position.moveNumber += 1;
  return position;
}

function captureOpponents(position, x, y, color) {
  const enemy = color === "B" ? "W" : "B";
  [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => {
    const nx = x + dx;
    const ny = y + dy;
    if (position.stones.get(`${nx},${ny}`)?.color === enemy && !hasLiberty(position, nx, ny, enemy, new Set())) {
      removeGroup(position, nx, ny, enemy, new Set());
    }
  });
}

function hasLiberty(position, x, y, color, seen) {
  const key = `${x},${y}`;
  if (seen.has(key)) {
    return false;
  }
  seen.add(key);
  const stone = position.stones.get(key);
  if (!stone || stone.color !== color) {
    return false;
  }
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= position.size || ny >= position.size) {
      continue;
    }
    const neighbor = position.stones.get(`${nx},${ny}`);
    if (!neighbor) {
      return true;
    }
    if (neighbor.color === color && hasLiberty(position, nx, ny, color, seen)) {
      return true;
    }
  }
  return false;
}

function removeGroup(position, x, y, color, seen) {
  const key = `${x},${y}`;
  if (seen.has(key)) {
    return;
  }
  seen.add(key);
  const stone = position.stones.get(key);
  if (!stone || stone.color !== color) {
    return;
  }
  position.stones.delete(key);
  [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => removeGroup(position, x + dx, y + dy, color, seen));
}

function sgfPointToCoords(point) {
  if (!point || point.length < 2) {
    return null;
  }
  return { x: point.charCodeAt(0) - 97, y: point.charCodeAt(1) - 97 };
}

function toSgfPoint(x, y) {
  return `${String.fromCharCode(97 + x)}${String.fromCharCode(97 + y)}`;
}

function describeNode(node) {
  if (node.props.B) {
    return `B ${node.props.B[0] || "pass"}`;
  }
  if (node.props.W) {
    return `W ${node.props.W[0] || "pass"}`;
  }
  return "Setup";
}
