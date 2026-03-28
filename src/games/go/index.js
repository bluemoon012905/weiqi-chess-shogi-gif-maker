import {
  UI_FONT_FAMILY,
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
  kaya: { board: "#d9b56f", line: "#5e431a", bg: "#efe1be", grain: ["rgba(255,255,255,0.06)", "rgba(94,67,26,0.05)"] },
  ink: { board: "#ceb989", line: "#403423", bg: "#f3ead6", grain: ["rgba(255,255,255,0.04)", "rgba(64,52,35,0.06)"] },
  walnut: { board: "#8f6848", line: "#2e1d12", bg: "#d8c2ad", grain: ["rgba(255,255,255,0.05)", "rgba(46,29,18,0.12)"] },
  cedar: { board: "#b9784e", line: "#4a2617", bg: "#edd3be", grain: ["rgba(255,245,235,0.06)", "rgba(90,44,23,0.1)"] },
  ashwood: { board: "#c9b08a", line: "#544632", bg: "#f1e7d8", grain: ["rgba(255,255,255,0.08)", "rgba(84,70,50,0.07)"] },
  moss: { board: "#95a97d", line: "#f5f7f0", bg: "#dbe2cf", grain: null },
  sage: { board: "#9caf88", line: "#ffffff", bg: "#eef2e8", grain: null },
  monochrome: { board: "#ffffff", line: "#000000", bg: "#ffffff", grain: null },
};

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

export function mountGo(root) {
  root.innerHTML = `
    <div class="mode-shell mode-shell-go">
      <section class="board-panel">
        <div class="board-toolbar">
          <div class="toolbar-group">
            <button data-id="play-toggle" class="primary-button">Switch To Play Mode</button>
            <button data-id="clear-board">Clear Board</button>
            <button data-id="reset-size">Reset Empty Board</button>
          </div>
          <div class="toolbar-group">
            <label>
              Board Size
              <select data-id="board-size">
                <option value="19">19x19</option>
                <option value="13">13x13</option>
                <option value="9">9x9</option>
              </select>
            </label>
            <label>
              Theme
              <select data-id="theme-select">
                <option value="kaya">Kaya</option>
                <option value="ink">Ink</option>
                <option value="walnut">Walnut</option>
                <option value="cedar">Cedar</option>
                <option value="ashwood">Ashwood</option>
                <option value="moss">Moss</option>
                <option value="sage">Sage</option>
                <option value="monochrome">Black & White</option>
              </select>
            </label>
          </div>
          <div class="toolbar-group">
            <span class="status-pill" data-id="mode-pill">Editor</span>
            <button data-id="turn-pill" class="status-pill" type="button">Black To Move</button>
            <span class="status-pill" data-id="branch-summary">Manual Board</span>
          </div>
        </div>
        <div class="canvas-board-wrap go-canvas-board-wrap">
          <canvas data-id="board-canvas" class="board-canvas" width="820" height="820"></canvas>
        </div>
        <div class="board-footer">
          <p data-id="position-summary">Use editor mode to place stones or parse an SGF branch, then switch to play mode for move-by-move reading.</p>
          <p data-id="selection-summary">Range export works for SGF branches and manual play lines.</p>
        </div>
        <section class="card board-subpanel go-board-subpanel">
          <div class="go-board-subpanel-grid">
            <section class="go-board-subsection">
              <div class="go-subsection-header">
                <h2>Branch Tree</h2>
                <span class="status-pill" data-id="tree-summary">Manual Line</span>
              </div>
              <p class="helper-copy" data-id="tree-copy">Parse an SGF to inspect variations as a move tree.</p>
              <div data-id="branch-tree" class="go-branch-tree"></div>
            </section>
            <section class="go-board-subsection">
              <div class="go-subsection-header">
                <h2>Range & Crop</h2>
                <button data-id="crop-edit-toggle" type="button">Edit Crop On Board</button>
              </div>
              <div class="inline-fields">
                <label>Start Move <input data-id="range-start" type="number" min="0" step="1" value="0" /></label>
                <label>End Move <input data-id="range-end" type="number" min="0" step="1" value="0" /></label>
              </div>
              <p class="helper-copy" data-id="range-summary">Exporting the full sequence.</p>
              <div class="toggle-list go-board-toggles">
                <label class="toggle-option"><input data-id="crop-toggle" type="checkbox" /> <span>Use Crop Region</span></label>
                <label class="toggle-option"><input data-id="show-coords" type="checkbox" /> <span>Show Coordinates</span></label>
                <label class="toggle-option"><input data-id="show-turn" type="checkbox" /> <span>Show Turn Indicator</span></label>
              </div>
              <p class="helper-copy" data-id="crop-summary">Crop the full board or drag the corner handles directly on the board.</p>
              <pre data-id="crop-debug" class="go-crop-debug">Crop: full board</pre>
            </section>
          </div>
        </section>
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
          <input data-id="sgf-file-input" type="file" accept=".sgf,.txt,text/plain,application/x-go-sgf" hidden />
          <div data-id="sgf-dropzone" class="file-dropzone" tabindex="0" role="button" aria-label="Drop an SGF file here or browse for a file">
            <strong>Drop an SGF file here</strong>
            <span>or use browse to load a local file into the parser</span>
          </div>
          <div class="inline-fields">
            <label>
              Frame Delay (ms)
              <input data-id="delay-input" type="number" min="100" step="50" value="650" />
            </label>
          </div>
          <div class="toolbar-group">
            <button data-id="load-sgf" class="primary-button">Parse SGF</button>
            <button data-id="browse-sgf" type="button">Browse File</button>
          </div>
          <p data-id="sgf-file-status" class="helper-copy">Paste SGF text, drop a file, or browse for one.</p>
        </section>
        <section class="card">
          <h2>Playback</h2>
          <div class="toolbar-group">
            <button data-id="preview-back" type="button">Back</button>
            <button data-id="preview-forward" type="button">Forward</button>
          </div>
          <label class="field-label">
            Preview Move
            <input data-id="preview-slider" type="range" min="0" max="0" value="0" />
          </label>
          <p class="helper-copy">Range defaults to the entire active line whenever the line changes.</p>
          <label class="field-label">
            Move List
            <textarea data-id="move-list" rows="10" readonly></textarea>
          </label>
        </section>
        <section class="card">
          <h2>GIF Export</h2>
          <div class="inline-fields">
            <label>
              Label Moves
              <select data-id="label-mode">
                <option value="last">Last Move Only</option>
                <option value="persist">Persistent</option>
                <option value="none">No Labels</option>
              </select>
            </label>
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
    crop: {
      enabled: false,
      editing: false,
      dragHandle: null,
      x1: 1,
      y1: 1,
      x2: 19,
      y2: 19,
    },
    manual: {
      baseState: emptyPosition(19),
      states: [emptyPosition(19)],
      history: [],
      paletteSelection: "B",
    },
  };

  buildPalette();
  canvas.addEventListener("click", handleCanvasClick);
  canvas.addEventListener("mousedown", handleCropPointerDown);
  window.addEventListener("mousemove", handleCropPointerMove);
  window.addEventListener("mouseup", handleCropPointerUp);
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
  get("browse-sgf").addEventListener("click", () => {
    get("sgf-file-input").click();
  });
  get("sgf-file-input").addEventListener("change", async (event) => {
    const [file] = Array.from(event.target.files || []);
    if (!file) {
      return;
    }
    await loadSgfFile(file);
    event.target.value = "";
  });
  ["dragenter", "dragover"].forEach((type) => {
    get("sgf-dropzone").addEventListener(type, (event) => {
      event.preventDefault();
      get("sgf-dropzone").classList.add("active");
    });
  });
  ["dragleave", "dragend"].forEach((type) => {
    get("sgf-dropzone").addEventListener(type, () => {
      get("sgf-dropzone").classList.remove("active");
    });
  });
  get("sgf-dropzone").addEventListener("drop", async (event) => {
    event.preventDefault();
    get("sgf-dropzone").classList.remove("active");
    const [file] = Array.from(event.dataTransfer?.files || []);
    if (!file) {
      get("sgf-file-status").textContent = "Drop a local SGF file to load it.";
      return;
    }
    await loadSgfFile(file);
  });
  get("sgf-dropzone").addEventListener("click", () => {
    get("sgf-file-input").click();
  });
  get("sgf-dropzone").addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      get("sgf-file-input").click();
    }
  });
  get("preview-back").addEventListener("click", () => {
    stepPreview(-1);
  });
  get("preview-forward").addEventListener("click", () => {
    stepPreview(1);
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
  ].forEach((input) => input.addEventListener("input", () => {
    if (input === get("board-size") && state.source === "manual") {
      state.boardSize = Number(get("board-size").value) || state.boardSize;
      state.manual.baseState = emptyPosition(state.boardSize);
      state.manual.history = [];
      resetCropToBoard(state.boardSize);
      rebuildManualStates();
    }
    if (input === get("crop-toggle")) {
      state.crop.enabled = get("crop-toggle").checked;
      if (!state.crop.enabled) {
        state.crop.editing = false;
        state.crop.dragHandle = null;
      }
    }
    render();
  }));
  get("crop-edit-toggle").addEventListener("click", () => {
    state.crop.enabled = true;
    get("crop-toggle").checked = true;
    state.crop.editing = !state.crop.editing;
    state.crop.dragHandle = null;
    render();
  });
  get("render-gif").addEventListener("click", exportGif);

  resetCropToBoard(state.boardSize);
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

  function loadSgf() {
    try {
      loadSgfText(get("sgf-input").value);
    } catch (error) {
      window.alert(error.message);
    }
  }

  function loadSgfText(sgfText) {
    const parsed = parseSgf(sgfText, Number(get("board-size").value) || 19);
    state.tree = parsed.root;
    state.boardSize = parsed.size;
    get("board-size").value = String(parsed.size);
    state.branchPaths = enumerateBranchPaths(parsed.root);
    state.branchIndex = 0;
    state.source = "sgf";
    resetCropToBoard(parsed.size);
    setCurrentBranch();
    get("sgf-file-status").textContent = `Loaded ${parsed.size}x${parsed.size} SGF with ${state.branchPaths.length} branch${state.branchPaths.length === 1 ? "" : "es"}.`;
    get("position-summary").textContent = `SGF parsed for ${parsed.size}x${parsed.size}. ${state.branchPaths.length} branch${state.branchPaths.length === 1 ? "" : "es"} available.`;
  }

  async function loadSgfFile(file) {
    try {
      const text = await file.text();
      get("sgf-input").value = text;
      loadSgfText(text);
      get("sgf-file-status").textContent = `Loaded ${file.name}.`;
    } catch (error) {
      get("sgf-file-status").textContent = "Could not read that SGF file.";
      window.alert(error.message || "Could not read that SGF file.");
    }
  }

  function setCurrentBranch() {
    state.currentPath = state.branchPaths[state.branchIndex] || [];
    state.currentStates = buildStatesForPath(state.currentPath, state.tree.initialState);
    resetRangeInputs();
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
    resetRangeInputs();
    state.previewMove = clamp(state.previewMove, 0, state.manual.history.length);
    state.boardSize = state.manual.baseState.size;
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

  function resetRangeInputs() {
    const total = getActiveHistory().length;
    get("range-start").value = "0";
    get("range-end").value = String(total);
  }

  function stepPreview(direction) {
    state.previewMove = clamp(state.previewMove + direction, 0, getActiveHistory().length);
    render();
  }

  function render() {
    renderPalette();
    renderBranchTree();
    const activeHistory = getActiveHistory();
    const activeStates = getActiveStates();
    const previewSlider = get("preview-slider");
    previewSlider.max = String(activeHistory.length);
    previewSlider.value = String(state.previewMove);
    get("preview-back").disabled = state.previewMove <= 0;
    get("preview-forward").disabled = state.previewMove >= activeHistory.length;
    syncRangeInputs(get("range-start"), get("range-end"), previewSlider, activeHistory.length);
    normalizeExportInputs();
    get("mode-pill").textContent = state.uiMode === "edit" ? "Editor" : "Play";
    get("play-toggle").textContent = state.uiMode === "edit" ? "Switch To Play Mode" : "Switch To Edit Mode";
    const active = activeStates[state.previewMove] || activeStates[0];
    get("turn-pill").textContent = active.turn === "B" ? "Black To Move" : "White To Move";
    get("turn-pill").classList.toggle("turn-black", active.turn === "B");
    get("turn-pill").classList.toggle("turn-red", active.turn === "W");
    get("tree-summary").textContent =
      state.source === "manual"
        ? `Manual Line · ${state.manual.history.length} move${state.manual.history.length === 1 ? "" : "s"}`
        : `Branch ${state.branchIndex + 1} · ${state.currentPath.length} move${state.currentPath.length === 1 ? "" : "s"}`;
    get("branch-summary").textContent =
      state.source === "manual"
        ? `Manual Line · ${state.manual.history.length} move${state.manual.history.length === 1 ? "" : "s"}`
        : `Branch ${state.branchIndex + 1} · ${state.currentPath.length} move${state.currentPath.length === 1 ? "" : "s"}`;
    const range = getRange();
    get("tree-copy").textContent =
      state.source === "manual"
        ? "Manual board play is shown as a single line."
        : "Click any move in the tree to switch to that SGF branch and preview that move.";
    get("range-summary").textContent = `Exporting moves ${range.start} to ${range.end} of ${activeHistory.length}.`;
    get("move-list").value = formatMoveList(activeHistory.map((item) => item.label || `${item.color} ${toSgfPoint(item.point.x, item.point.y)}`));
    get("selection-summary").textContent =
      state.uiMode === "edit"
        ? "Editor mode places or erases stones directly."
        : "Play mode alternates turns and applies captures.";
    get("crop-edit-toggle").textContent = state.crop.editing ? "Finish Crop Editing" : "Edit Crop On Board";
    get("crop-summary").textContent = state.crop.enabled
      ? state.crop.editing
        ? "Drag any highlighted corner on the board to reshape the crop."
        : describeCropSelection()
      : "Crop is off. Enable it and drag the corner handles on the board when needed.";
    get("crop-debug").textContent = formatCropDebug();
    drawPreview();
  }

  function getCropRect() {
    const crop = normalizeCropState();
    const metrics = getGoMetrics(canvas.width, canvas.height, crop.size, get("show-coords").checked);
    return {
      x: metrics.originX + (crop.x1 - 1) * metrics.cell - metrics.cell * 0.55,
      y: metrics.originY + (crop.y1 - 1) * metrics.cell - metrics.cell * 0.55,
      width: (crop.x2 - crop.x1 + 1) * metrics.cell + metrics.cell * 0.1,
      height: (crop.y2 - crop.y1 + 1) * metrics.cell + metrics.cell * 0.1,
    };
  }

  function drawPreview() {
    const active = getActiveStates()[state.previewMove] || getActiveStates()[0];
    drawGoBoard(ctx, canvas, active, {
      theme: GO_THEMES[get("theme-select").value] || GO_THEMES.kaya,
      showCoords: get("show-coords").checked,
      showTurnIndicator: get("show-turn").checked,
      labelMode: get("label-mode").value,
      overlayCrop: state.crop.enabled ? getCropRect() : null,
      cropHandles: state.crop.enabled ? getCropHandles() : [],
      cropEditing: state.crop.enabled && state.crop.editing,
      dragHandle: state.crop.dragHandle,
    });
  }

  function handleCanvasClick(event) {
    if (state.crop.enabled && state.crop.editing) {
      return;
    }
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

  function handleCropPointerDown(event) {
    if (!state.crop.enabled || !state.crop.editing) {
      return;
    }
    const handle = getCropHandleAtEvent(event);
    if (!handle) {
      return;
    }
    state.crop.dragHandle = handle;
    event.preventDefault();
    render();
  }

  function handleCropPointerMove(event) {
    if (!state.crop.dragHandle) {
      return;
    }
    const point = canvasPointToIntersection(canvas, event, get("show-coords").checked, state.boardSize);
    if (!point) {
      return;
    }
    updateCropFromHandle(state.crop.dragHandle, point);
    render();
  }

  function handleCropPointerUp() {
    if (!state.crop.dragHandle) {
      return;
    }
    state.crop.dragHandle = null;
    render();
  }

  async function exportGif() {
    const range = getRange();
    const crop = state.crop.enabled ? getCropRect() : null;
    const frames = [];
    for (let index = range.start; index <= range.end; index += 1) {
      const frameCanvas = createBoardCanvas(canvas.width, canvas.height);
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

  function renderBranchTree() {
    const tree = get("branch-tree");
    tree.innerHTML = "";
    if (state.source === "manual") {
      const manualLine = document.createElement("div");
      manualLine.className = "go-branch-line";
      if (!state.manual.history.length) {
        const empty = document.createElement("span");
        empty.className = "go-tree-empty";
        empty.textContent = "No moves yet.";
        manualLine.append(empty);
      } else {
        state.manual.history.forEach((move, index) => {
          manualLine.append(createMoveChip(move, index, true, () => {
            state.previewMove = index + 1;
            render();
          }, index === 0));
        });
      }
      tree.append(manualLine);
      return;
    }

    state.branchPaths.forEach((path, branchIndex) => {
      const row = document.createElement("div");
      row.className = "go-branch-line";
      if (!path.length) {
        const empty = document.createElement("span");
        empty.className = "go-tree-empty";
        empty.textContent = "Empty branch.";
        row.append(empty);
      } else {
        path.forEach((node, index) => {
          row.append(createMoveChip(
            nodeToMove(node),
            index,
            branchIndex === state.branchIndex && index < state.currentPath.length && state.currentPath[index]?.id === node.id,
            () => {
              state.source = "sgf";
              state.branchIndex = branchIndex;
              state.currentPath = state.branchPaths[branchIndex] || [];
              state.currentStates = buildStatesForPath(state.currentPath, state.tree.initialState);
              state.previewMove = index + 1;
              resetRangeInputs();
              render();
            },
            index === 0
          ));
        });
      }
      tree.append(row);
    });
  }

  function createMoveChip(move, index, active, onClick, isFirst = false) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "go-tree-move";
    if (isFirst) {
      button.classList.add("first");
    }
    if (active) {
      button.classList.add("active");
    }
    if (state.previewMove === index + 1 && active) {
      button.classList.add("active-preview");
    }
    button.addEventListener("click", onClick);

    const stone = document.createElement("span");
    stone.className = `go-tree-stone ${move.color === "B" ? "black" : "white"}`;
    stone.textContent = index + 1;
    button.setAttribute("aria-label", move.label);
    button.append(stone);
    return button;
  }

  function normalizeCropState() {
    const size = Number(get("board-size").value) || state.boardSize;
    state.crop.x1 = clamp(state.crop.x1, 1, size);
    state.crop.x2 = clamp(state.crop.x2, state.crop.x1, size);
    state.crop.y1 = clamp(state.crop.y1, 1, size);
    state.crop.y2 = clamp(state.crop.y2, state.crop.y1, size);
    return { ...state.crop, size };
  }

  function resetCropToBoard(size) {
    state.crop.x1 = 1;
    state.crop.y1 = 1;
    state.crop.x2 = size;
    state.crop.y2 = size;
    state.crop.dragHandle = null;
  }

  function describeCropSelection() {
    const crop = normalizeCropState();
    return `Crop spans ${crop.x1},${crop.y1} to ${crop.x2},${crop.y2}.`;
  }

  function formatCropDebug() {
    if (!state.crop.enabled) {
      return "Crop: full board";
    }
    const crop = normalizeCropState();
    const rect = getCropRect();
    const handle = state.crop.dragHandle || "none";
    return [
      `Board: (${crop.x1}, ${crop.y1}) -> (${crop.x2}, ${crop.y2})`,
      `Pixels: x=${rect.x.toFixed(2)} y=${rect.y.toFixed(2)} w=${rect.width.toFixed(2)} h=${rect.height.toFixed(2)}`,
      `Dragging: ${handle}`,
    ].join("\n");
  }

  function getCropHandles() {
    const crop = normalizeCropState();
    return [
      { id: "nw", point: { x: crop.x1 - 1, y: crop.y1 - 1 } },
      { id: "ne", point: { x: crop.x2 - 1, y: crop.y1 - 1 } },
      { id: "sw", point: { x: crop.x1 - 1, y: crop.y2 - 1 } },
      { id: "se", point: { x: crop.x2 - 1, y: crop.y2 - 1 } },
    ];
  }

  function getCropHandleAtEvent(event) {
    const metrics = getGoMetrics(canvas.width, canvas.height, state.boardSize, get("show-coords").checked);
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((event.clientY - rect.top) / rect.height) * canvas.height;
    const threshold = Math.max(14, metrics.cell * 0.35);
    return getCropHandles().find((handle) => {
      const centerX = metrics.originX + handle.point.x * metrics.cell;
      const centerY = metrics.originY + handle.point.y * metrics.cell;
      return Math.hypot(centerX - x, centerY - y) <= threshold;
    })?.id || null;
  }

  function updateCropFromHandle(handle, point) {
    const px = point.x + 1;
    const py = point.y + 1;
    const size = state.boardSize;
    if (handle === "nw") {
      state.crop.x1 = clamp(px, 1, state.crop.x2);
      state.crop.y1 = clamp(py, 1, state.crop.y2);
    } else if (handle === "ne") {
      state.crop.x2 = clamp(px, state.crop.x1, size);
      state.crop.y1 = clamp(py, 1, state.crop.y2);
    } else if (handle === "sw") {
      state.crop.x1 = clamp(px, 1, state.crop.x2);
      state.crop.y2 = clamp(py, state.crop.y1, size);
    } else if (handle === "se") {
      state.crop.x2 = clamp(px, state.crop.x1, size);
      state.crop.y2 = clamp(py, state.crop.y1, size);
    }
  }

  function nodeToMove(node) {
    return {
      color: node.props.B ? "B" : "W",
      label: node.label,
    };
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
  drawBoardGrain(ctx, metrics, options.theme);
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
    const shouldLabelLast = options.labelMode === "last" && position.lastMove && position.lastMove.x === x && position.lastMove.y === y;
    const shouldLabelPersist = options.labelMode === "persist" && Number.isFinite(stone.number);
    if (shouldLabelLast || shouldLabelPersist) {
      ctx.fillStyle = stone.color === "B" ? "#f0e2a1" : "#a12218";
      ctx.font = `700 ${Math.max(14, metrics.cell * 0.29)}px ${UI_FONT_FAMILY}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(shouldLabelPersist ? stone.number : position.moveNumber), centerX, centerY + 1);
    }
  });

  if (options.showCoords) {
    ctx.font = `600 ${metrics.coordFontSize}px ${UI_FONT_FAMILY}`;
    ctx.fillStyle = options.theme.line;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (let index = 0; index < size; index += 1) {
      const fileLabel = String.fromCharCode(65 + index + (index >= 8 ? 1 : 0));
      const x = metrics.originX + index * metrics.cell;
      const y = metrics.originY + index * metrics.cell;
      ctx.fillText(fileLabel, x, metrics.originY - metrics.coordOffset);
      ctx.fillText(fileLabel, x, metrics.originY + metrics.boardSpan + metrics.coordOffset);
      ctx.fillText(String(index + 1), metrics.originX - metrics.coordOffset, y);
      ctx.fillText(String(index + 1), metrics.originX + metrics.boardSpan + metrics.coordOffset, y);
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

  if (options.cropHandles?.length) {
    options.cropHandles.forEach((handle) => {
      const centerX = metrics.originX + handle.point.x * metrics.cell;
      const centerY = metrics.originY + handle.point.y * metrics.cell;
      ctx.save();
      ctx.fillStyle = options.cropEditing ? "#a52f1c" : "rgba(165, 47, 28, 0.72)";
      ctx.strokeStyle = "#fff7ee";
      ctx.lineWidth = Math.max(2, metrics.cell * 0.06);
      ctx.beginPath();
      ctx.arc(centerX, centerY, Math.max(8, metrics.cell * 0.2), 0, Math.PI * 2);
      ctx.fill();
      if (options.dragHandle === handle.id) {
        ctx.stroke();
      }
      ctx.restore();
    });
  }
}

function drawBoardGrain(ctx, metrics, theme) {
  if (!theme.grain) {
    return;
  }
  const boardX = metrics.originX - metrics.cell * 0.7;
  const boardY = metrics.originY - metrics.cell * 0.7;
  const boardWidth = metrics.boardSpan + metrics.cell * 1.4;
  const boardHeight = metrics.boardSpan + metrics.cell * 1.4;
  const [light, dark] = theme.grain || ["rgba(255,255,255,0.04)", "rgba(0,0,0,0.05)"];

  ctx.save();
  ctx.beginPath();
  ctx.rect(boardX, boardY, boardWidth, boardHeight);
  ctx.clip();

  for (let index = 0; index < 28; index += 1) {
    const x = boardX + (boardWidth / 28) * index;
    const swayA = Math.sin(index * 0.7) * metrics.cell * 0.32;
    const swayB = Math.cos(index * 1.1) * metrics.cell * 0.24;
    const swayC = Math.sin(index * 1.6) * metrics.cell * 0.2;
    const swayD = Math.cos(index * 2.2) * metrics.cell * 0.14;
    ctx.strokeStyle = index % 2 === 0 ? light : dark;
    ctx.lineWidth = Math.max(1.5, metrics.cell * (index % 5 === 0 ? 0.085 : index % 2 === 0 ? 0.045 : 0.03));
    ctx.beginPath();
    ctx.moveTo(x + swayA, boardY);
    ctx.bezierCurveTo(
      x - metrics.cell * 0.24 + swayD,
      boardY + boardHeight * 0.14 + swayB,
      x + metrics.cell * 0.28 - swayC,
      boardY + boardHeight * 0.32 - swayA,
      x + swayB,
      boardY + boardHeight * 0.5 + swayD
    );
    ctx.bezierCurveTo(
      x - metrics.cell * 0.22 - swayD,
      boardY + boardHeight * 0.68 + swayC,
      x + metrics.cell * 0.26 + swayA,
      boardY + boardHeight * 0.86 - swayB,
      x + swayC,
      boardY + boardHeight
    );
    ctx.stroke();
  }

  for (let index = 0; index < 10; index += 1) {
    const x = boardX + (boardWidth / 10) * index + Math.sin(index * 1.4) * metrics.cell * 0.18;
    ctx.strokeStyle = index % 2 === 0 ? dark : light;
    ctx.lineWidth = Math.max(1, metrics.cell * 0.018);
    ctx.beginPath();
    ctx.moveTo(x, boardY);
    ctx.bezierCurveTo(
      x + metrics.cell * 0.14,
      boardY + boardHeight * 0.22,
      x - metrics.cell * 0.16,
      boardY + boardHeight * 0.55,
      x + metrics.cell * 0.12,
      boardY + boardHeight
    );
    ctx.stroke();
  }

  ctx.restore();
}

function getGoMetrics(width, height, size, showCoords) {
  const padding = showCoords ? 102 : 62;
  const boardSpan = Math.min(width - padding * 2, height - padding * 2);
  const cell = boardSpan / (size - 1);
  return {
    originX: (width - boardSpan) / 2,
    originY: (height - boardSpan) / 2,
    boardSpan,
    cell,
    coordFontSize: Math.max(12, cell * 0.24),
    coordOffset: Math.max(24, cell * 0.62),
  };
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

function enumerateBranchPaths(root) {
  const leaves = [];

  function visit(node, path) {
    const nextPath = node.id === "root" ? path : [...path, node];
    if (!node.children?.length) {
      leaves.push(nextPath);
      return;
    }
    node.children.forEach((child) => visit(child, nextPath));
  }

  visit(root, []);
  return leaves.length ? leaves : [[]];
}


function parseSgf(sgf, fallbackSize) {
  const source = String(sgf || "").replace(/^\uFEFF/, "").trim();
  if (!source) {
    throw new Error("Paste an SGF first.");
  }
  let index = 0;
  let sequence = 0;

  function skipWhitespace() {
    while (/\s/.test(source[index] || "")) {
      index += 1;
    }
  }

  function parseValue() {
    let value = "";
    index += 1;
    while (index < source.length) {
      const char = source[index];
      if (char === "\\") {
        value += source[index + 1] || "";
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
      const identMatch = /^[A-Za-z]+/.exec(source.slice(index));
      if (!identMatch) {
        break;
      }
      const key = identMatch[0];
      index += key.length;
      node.props[key] = [];
      while (source[index] === "[") {
        node.props[key].push(parseValue());
      }
    }
    node.label = describeNode(node);
    return node;
  }

  function parseTree(parent = null) {
    skipWhitespace();
    if (source[index] !== "(") {
      throw new Error("Invalid SGF tree.");
    }
    index += 1;
    let currentParent = parent;
    let treeRoot = null;
    while (index < source.length) {
      skipWhitespace();
      if (source[index] === ";") {
        index += 1;
        const node = parseNode(currentParent);
        if (!treeRoot) {
          treeRoot = node;
        }
        if (currentParent) {
          currentParent.children.push(node);
        }
        currentParent = node;
      } else if (source[index] === "(") {
        parseTree(currentParent);
      } else if (source[index] === ")") {
        index += 1;
        break;
      } else {
        index += 1;
      }
    }
    return treeRoot;
  }

  const parsedRoot = parseTree();
  skipWhitespace();
  const size = Number(parsedRoot?.props?.SZ?.[0] || fallbackSize || 19);
  const root = { id: "root", label: "root", parent: null, children: [], props: {}, initialState: buildInitialState(parsedRoot, size) };
  if (parsedRoot) {
    if (hasMoveProps(parsedRoot.props)) {
      attachChildren(root, parsedRoot);
    } else {
      parsedRoot.children.forEach((child) => attachChildren(root, child));
    }
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

function hasMoveProps(props) {
  return Boolean(props?.B || props?.W);
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
  position.stones.set(key, { color, number: position.moveNumber + 1 });
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
  const x = point.charCodeAt(0) - 97;
  const y = point.charCodeAt(1) - 97;
  if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0) {
    return null;
  }
  return { x, y };
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
