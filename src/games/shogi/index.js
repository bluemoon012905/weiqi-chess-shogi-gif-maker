import {
  CHINESE_FONT_FAMILY,
  UI_FONT_FAMILY,
  clamp,
  cropCanvas,
  createBoardCanvas,
  formatMoveList,
  normalizeRange,
  renderGif,
  syncRangeInputs,
} from "../../core/shared.js";

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
const LISHOGI_BASE_URL = new URL("../../../assets/lishogi-standard/", import.meta.url).href;

const LISHOGI_PACKS = [
  { id: "1kanji_3d", label: "1Kanji 3D", ext: "svg" },
  { id: "2kanji_3d", label: "2Kanji 3D", ext: "svg" },
  { id: "dobutsu", label: "Dobutsu", ext: "svg" },
  { id: "glass", label: "Glass", ext: "png" },
  { id: "hitomoji", label: "Hitomoji", ext: "svg" },
  { id: "kanji_brown", label: "Kanji Brown", ext: "svg" },
  { id: "kanji_light", label: "Kanji Light", ext: "svg" },
  { id: "orangain", label: "Orangain", ext: "svg" },
  { id: "shogi_bnw", label: "Shogi BnW", ext: "svg" },
  { id: "shogi_cz", label: "Shogi CZ", ext: "svg" },
  { id: "shogi_fcz", label: "Shogi FCZ", ext: "svg" },
  { id: "simple_kanji", label: "Simple Kanji", ext: "svg" },
  { id: "valdivia", label: "Valdivia", ext: "svg" },
  { id: "western", label: "Western", ext: "svg" },
];

const LISHOGI_PIECE_CODES = {
  K: "OU",
  R: "HI",
  B: "KA",
  G: "KI",
  S: "GI",
  N: "KE",
  L: "KY",
  P: "FU",
  "+R": "RY",
  "+B": "UM",
  "+S": "NG",
  "+N": "NK",
  "+L": "NY",
  "+P": "TO",
};

const STANDARD_SFEN = "lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL b - 1";
const DORO_SFEN = "sgkgs/5/1ppp1/1PPP1/5/SGKGS b - 1";
const PALETTE = ["K", "R", "B", "G", "S", "N", "L", "P", "k", "r", "b", "g", "s", "n", "l", "p", "."];
const HAND_ORDER = ["R", "B", "G", "S", "N", "L", "P"];

const VARIANTS = {
  standard: { label: "Standard", sfen: STANDARD_SFEN, cols: 9, rows: 9, promotionZoneDepth: 3, hands: { b: {}, w: {} }, handKinds: HAND_ORDER },
  doro: { label: "Doro Doro Shogi", sfen: DORO_SFEN, cols: 5, rows: 6, promotionZoneDepth: 2, hands: { b: {}, w: {} }, handKinds: ["G", "S", "P"] },
  doroplus: { label: "Doro Doro Shogi+", sfen: DORO_SFEN, cols: 5, rows: 6, promotionZoneDepth: 2, hands: { b: { N: 1, L: 1 }, w: { N: 1, L: 1 } }, handKinds: ["G", "S", "N", "L", "P"] },
};

export function mountShogi(root) {
  root.innerHTML = `
    <div class="mode-shell mode-shell-shogi">
      <section class="board-panel">
        <div class="board-toolbar">
          <div class="toolbar-group">
            <button data-id="play-toggle" class="primary-button">Switch To Play Mode</button>
            <button data-id="clear-board">Clear Board</button>
            <button data-id="reset-variant">Reset Variant</button>
          </div>
          <div class="toolbar-group">
            <label>
              Variant
              <select data-id="variant-select">
                <option value="standard">Standard</option>
                <option value="doro">Doro Doro Shogi</option>
                <option value="doroplus">Doro Doro Shogi+</option>
              </select>
            </label>
            <label>
              Piece Skin
              <select data-id="skin-select">
              </select>
            </label>
          </div>
          <div class="toolbar-group">
            <span class="status-pill" data-id="mode-pill">Editor</span>
            <button data-id="turn-pill" class="status-pill" type="button">Black To Move</button>
            <span class="status-pill" data-id="variant-summary">Manual Board</span>
          </div>
        </div>
        <div class="canvas-board-wrap">
          <canvas data-id="board-canvas" class="board-canvas" width="1080" height="990"></canvas>
        </div>
        <div class="board-footer">
          <p data-id="position-summary">Editor mode places pieces directly. Play mode supports move-by-move board play on the current setup.</p>
          <p data-id="selection-summary">Variant presets and theme choices carry through to GIF export.</p>
        </div>
        <section class="card board-subpanel shogi-board-subpanel">
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
            <textarea data-id="move-list" rows="8" readonly></textarea>
          </label>
        </section>
      </section>
      <aside class="control-panel">
        <section class="card">
          <h2>Editor Palette</h2>
          <div data-id="palette" class="palette"></div>
        </section>
        <section class="card">
          <h2>Import</h2>
          <p class="helper-copy">Doro Doro Shogi+ starts with a knight and lance in hand for each side in this UI model.</p>
          <label class="field-label">
            SFEN Position
            <textarea data-id="sfen-input" rows="3" placeholder="${STANDARD_SFEN}"></textarea>
          </label>
          <label class="field-label">
            Moves (USI / KIF)
            <textarea data-id="moves-input" rows="8" placeholder="7g7f 3c3d 2g2f&#10;or paste a KIF game record"></textarea>
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
          <div class="toolbar-group wrap">
            <button data-id="fill-north-hand">Add Rest To North Hand</button>
            <button data-id="fill-south-hand">Add Rest To South Hand</button>
          </div>
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
  const lishogiImageCache = new Map();
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
      selectedHand: null,
      legalMoves: [],
    },
    previewMove: 0,
  };

  buildSkinOptions();
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
  get("skin-select").addEventListener("change", render);
  get("load-game").addEventListener("click", loadGame);
  get("fill-north-hand").addEventListener("click", () => fillHandForSide("w"));
  get("fill-south-hand").addEventListener("click", () => fillHandForSide("b"));
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
    const variant = VARIANTS[get("variant-select").value] || VARIANTS.standard;
    return {
      board: Array.from({ length: variant.rows }, () => Array(variant.cols).fill(null)),
      cols: variant.cols,
      rows: variant.rows,
      promotionZoneDepth: variant.promotionZoneDepth,
      turn: "b",
      hands: { b: {}, w: {} },
      handKinds: [...variant.handKinds],
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

  function buildSkinOptions() {
    const select = get("skin-select");
    select.innerHTML = "";
    LISHOGI_PACKS.forEach((pack) => {
      const option = document.createElement("option");
      option.value = pack.id;
      option.textContent = pack.label;
      select.append(option);
    });
    select.value = "kanji_light";
  }

  function renderPalette() {
    const activePack = getSelectedLishogiPack();
    get("palette").querySelectorAll(".palette-option").forEach((button) => {
      button.classList.toggle("active", button.dataset.piece === state.manual.paletteSelection);
      const badge = button.querySelector(".palette-piece");
      if (!badge || button.dataset.piece === ".") {
        return;
      }
      const piece = button.dataset.piece;
      const lishogiImage = getLishogiImage(activePack, piece === piece.toUpperCase() ? "b" : "w", piece.toUpperCase());
      const hasLishogiPreview = Boolean(lishogiImage && lishogiImage.complete && lishogiImage.naturalWidth > 0);
      badge.textContent = hasLishogiPreview ? "" : PIECE_CHARS[piece.toUpperCase()] || piece.toUpperCase();
      badge.style.backgroundImage = hasLishogiPreview ? `url("${lishogiImage.src}")` : "";
      badge.style.backgroundPosition = hasLishogiPreview ? "center" : "";
      badge.style.backgroundSize = hasLishogiPreview ? "contain" : "";
      badge.classList.remove("sprite");
      badge.classList.add("lishogi-preview");
      badge.classList.toggle("black", piece === piece.toUpperCase());
      badge.classList.toggle("red", piece !== piece.toUpperCase());
    });
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
    resetRangeInputs();
    state.previewMove = clamp(state.previewMove, 0, state.manual.moves.length);
    clearSelection();
  }

  function clearSelection() {
    state.manual.selectedSquare = null;
    state.manual.selectedHand = null;
    state.manual.legalMoves = [];
  }

function loadGame() {
    try {
      const variant = get("variant-select").value;
      const start = get("sfen-input").value.trim() ? parseSfen(get("sfen-input").value.trim()) : loadVariantPosition(variant);
      applyVariantGeometry(start, variant);
      const importedMoves = parseImportedMoves(get("moves-input").value, start);
      const positions = [clonePosition(start)];
      importedMoves.forEach((move) => {
        positions.push(applyUsiMove(clonePosition(positions[positions.length - 1]), move.usi));
      });
      state.source = "imported";
      state.importedPositions = positions;
      state.importedMoves = importedMoves;
      resetRangeInputs();
      state.previewMove = 0;
      clearSelection();
      render();
    } catch (error) {
      window.alert(error.message);
    }
  }

  function fillHandForSide(side) {
    const variant = get("variant-select").value;
    const target = clonePosition(getActiveBaseState());
    const fullCounts = countSideInventory(loadVariantPosition(variant), side);
    const currentCounts = countSideInventory(target, side);
    HAND_ORDER.forEach((kind) => {
      const missing = Math.max(0, (fullCounts[kind] || 0) - (currentCounts[kind] || 0));
      if (missing > 0) {
        target.hands[side][kind] = (target.hands[side][kind] || 0) + missing;
      }
    });
    state.source = "manual";
    state.manual.baseState = target;
    state.manual.moves = [];
    state.previewMove = 0;
    rebuildManualPositions();
    render();
  }

  function normalizeExportInputs() {
    const range = normalizeRange(get("range-start").value, get("range-end").value, getActiveMoves().length);
    get("range-start").value = String(range.start);
    get("range-end").value = String(range.end);
  }

  function resetRangeInputs() {
    const total = getActiveMoves().length;
    get("range-start").value = "0";
    get("range-end").value = String(total);
  }

  function getRange() {
    normalizeExportInputs();
    return {
      start: Number(get("range-start").value) || 0,
      end: Number(get("range-end").value) || 0,
    };
  }

  function render() {
    const activePack = getSelectedLishogiPack();
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
    get("sfen-input").value = positionToSfen(getActiveBaseState());
    get("variant-summary").textContent =
    state.source === "manual"
        ? `Manual Board · ${activeMoves.length} move${activeMoves.length === 1 ? "" : "s"}`
        : `${VARIANTS[get("variant-select").value].label} · ${activeMoves.length} move${activeMoves.length === 1 ? "" : "s"}`;
    const range = getRange();
    get("range-summary").textContent = `Exporting moves ${range.start} to ${range.end}.`;
    get("move-list").value = formatMoveList(activeMoves.map((move) => move.label || move.usi));
    get("selection-summary").textContent =
      state.uiMode === "edit"
        ? "Editor mode places pieces directly on the board. Click the same selected piece to promote it, click a different piece to replace it, or use erase to remove it."
        : "Play mode allows piece movement on the current setup.";
    drawShogiBoard(ctx, canvas, active, {
      theme: getShogiTheme(),
      lishogiPack: activePack,
      getLishogiImage,
      showTurnIndicator: get("show-turn").checked,
      selectedSquare: state.manual.selectedSquare,
      selectedHand: state.manual.selectedHand,
      legalMoves: state.manual.legalMoves,
    });
  }

  function handleCanvasClick(event) {
    const editablePosition =
      state.uiMode === "edit"
        ? clonePosition(getActivePositions()[state.previewMove] || getActiveBaseState())
        : state.manual.baseState;
    const square = canvasPointToSquare(canvas, event, editablePosition);
    const handSlot = square ? null : canvasPointToHandSlot(canvas, event, editablePosition);
    if (!square && !handSlot) {
      return;
    }
    if (!square) {
      if (!handSlot) {
        return;
      }
      if (state.uiMode !== "edit") {
        const active = clonePosition(state.manual.positions[state.previewMove] || state.manual.positions[0]);
        if (handSlot.side !== active.turn || !(active.hands[handSlot.side][handSlot.kind] > 0)) {
          clearSelection();
          render();
          return;
        }
        state.manual.selectedSquare = null;
        state.manual.selectedHand = handSlot;
        state.manual.legalMoves = generateShogiDrops(active, handSlot.kind).map((drop) => ({
          ...drop,
          fromHand: true,
        }));
        render();
        return;
      }
      const next = editablePosition;
      if (state.manual.paletteSelection === ".") {
        if (next.hands[handSlot.side][handSlot.kind]) {
          next.hands[handSlot.side][handSlot.kind] -= 1;
          if (next.hands[handSlot.side][handSlot.kind] <= 0) {
            delete next.hands[handSlot.side][handSlot.kind];
          }
        }
      } else {
        next.hands[handSlot.side][handSlot.kind] = (next.hands[handSlot.side][handSlot.kind] || 0) + 1;
      }
      state.source = "manual";
      state.manual.baseState = next;
      state.manual.moves = [];
      state.previewMove = 0;
      rebuildManualPositions();
      render();
      return;
    }
    if (state.uiMode === "edit") {
      const next = editablePosition;
      const currentPiece = next.board[square.y][square.x];
      const selectedPiece = state.manual.paletteSelection;
      if (selectedPiece === ".") {
        next.board[square.y][square.x] = null;
      } else {
        const selectedSide = selectedPiece === selectedPiece.toUpperCase() ? "b" : "w";
        const selectedKind = selectedPiece.toUpperCase();
        const matchesSelected =
          currentPiece &&
          currentPiece.side === selectedSide &&
          currentPiece.kind.replace("+", "") === selectedKind;
        if (matchesSelected && canPromote(currentPiece.kind) && !currentPiece.kind.startsWith("+")) {
          next.board[square.y][square.x] = {
            ...currentPiece,
            kind: `+${currentPiece.kind}`,
          };
        } else {
          next.board[square.y][square.x] = {
            side: selectedSide,
            kind: selectedKind,
          };
        }
      }
      state.source = "manual";
      state.manual.baseState = next;
      state.manual.moves = [];
      state.previewMove = 0;
      rebuildManualPositions();
      render();
      return;
    }

    const active = clonePosition(state.manual.positions[state.previewMove] || state.manual.positions[0]);
    if (state.manual.selectedSquare || state.manual.selectedHand) {
      const move = state.manual.legalMoves.find((candidate) => candidate.to.x === square.x && candidate.to.y === square.y);
      if (move) {
        if (state.previewMove < state.manual.moves.length) {
          state.manual.moves = state.manual.moves.slice(0, state.previewMove);
        }
        let usi = move.usi;
        if (move.fromHand) {
          // drop move, no promotion branch
        } else if (move.mustPromote) {
          usi += "+";
        } else if (move.canPromote) {
          const shouldPromoteMove = window.confirm("Promote this piece?");
          if (shouldPromoteMove) {
            usi += "+";
          }
        }
        state.manual.moves.push({ usi, label: usi });
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
    state.manual.selectedHand = null;
    state.manual.selectedSquare = square;
    state.manual.legalMoves = generateShogiMoves(active, square.x, square.y);
    render();
  }

  async function exportGif() {
    const range = getRange();
    const frames = [];
    const activePositions = getActivePositions();
    for (let moveIndex = range.start; moveIndex <= range.end; moveIndex += 1) {
      const frameCanvas = createBoardCanvas(720, 660);
      const position = activePositions[moveIndex] || activePositions[0];
      drawShogiBoard(frameCanvas.getContext("2d"), frameCanvas, position, {
        theme: getShogiTheme(),
        lishogiPack: getSelectedLishogiPack(),
        getLishogiImage,
        showTurnIndicator: get("show-turn").checked,
        handPieceScale: 1.4,
        handGapExtra: 16,
      });
      const cropRect = getShogiContentRect(frameCanvas, position);
      const outputSize = getShogiOutputSize(cropRect, 720);
      frames.push(cropCanvas(frameCanvas, cropRect, outputSize.width, outputSize.height));
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

  function getShogiTheme() {
    return {
      id: "lishogi",
      label: "Lishogi",
      board: "#d5be8b",
      bg: "#f1e8d3",
      line: "#5a4522",
      render(piece) {
        return PIECE_CHARS[piece] || piece;
      },
    };
  }

  function getSelectedLishogiPack() {
    return LISHOGI_PACKS.find((pack) => pack.id === get("skin-select").value) || LISHOGI_PACKS[0];
  }

  function getLishogiImage(pack, side, kind) {
    if (!pack) {
      return null;
    }
    const code = LISHOGI_PIECE_CODES[kind];
    if (!code) {
      return null;
    }
    const key = `${pack.id}:${side}:${code}`;
    if (lishogiImageCache.has(key)) {
      return lishogiImageCache.get(key);
    }
    const image = new Image();
    image.src = new URL(`${pack.id}/${side === "b" ? "0" : "1"}${code}.${pack.ext}`, LISHOGI_BASE_URL).href;
    image.addEventListener("load", render);
    image.addEventListener("error", render);
    lishogiImageCache.set(key, image);
    return image;
  }
}

function drawShogiBoard(ctx, canvas, position, options) {
  const metrics = getShogiMetrics(canvas.width, canvas.height, position, options);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = options.theme.bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = options.theme.board;
  ctx.fillRect(metrics.originX, metrics.originY, metrics.boardWidth, metrics.boardHeight);
  ctx.strokeStyle = options.theme.line;
  ctx.lineWidth = 2.2;
  for (let index = 0; index <= position.cols; index += 1) {
    const offset = metrics.originX + index * metrics.cell;
    ctx.beginPath();
    ctx.moveTo(offset, metrics.originY);
    ctx.lineTo(offset, metrics.originY + metrics.boardHeight);
    ctx.stroke();
  }
  for (let index = 0; index <= position.rows; index += 1) {
    const offset = metrics.originY + index * metrics.cell;
    ctx.beginPath();
    ctx.moveTo(metrics.originX, offset);
    ctx.lineTo(metrics.originX + metrics.boardWidth, offset);
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

  for (let y = 0; y < position.rows; y += 1) {
    for (let x = 0; x < position.cols; x += 1) {
      const square = position.board[y][x];
      if (!square) {
        continue;
      }
      const centerX = metrics.originX + x * metrics.cell + metrics.cell / 2;
      const centerY = metrics.originY + y * metrics.cell + metrics.cell / 2;
      drawShogiPiece(ctx, centerX, centerY, metrics.cell, square.side, {
        label: options.theme.render(square.kind),
        image: options.getLishogiImage(options.lishogiPack, square.side, square.kind),
        promoted: square.kind.startsWith("+"),
      });
    }
  }

  drawHandColumn(ctx, metrics, position.hands.w, "w", {
    theme: options.theme,
    lishogiPack: options.lishogiPack,
    getLishogiImage: options.getLishogiImage,
    handPieceScale: options.handPieceScale,
    selectedHand: options.selectedHand,
  });
  drawHandColumn(ctx, metrics, position.hands.b, "b", {
    theme: options.theme,
    lishogiPack: options.lishogiPack,
    getLishogiImage: options.getLishogiImage,
    handPieceScale: options.handPieceScale,
    selectedHand: options.selectedHand,
  });

  if (options.showTurnIndicator) {
    ctx.font = `600 ${metrics.handFontSize}px ${UI_FONT_FAMILY}`;
    ctx.fillStyle = options.theme.line;
    ctx.textAlign = "left";
    ctx.fillText(`Turn: ${position.turn === "b" ? "Black" : "White"}`, metrics.originX + metrics.boardWidth - 140, metrics.originY - 26);
  }
}

function drawHandColumn(ctx, metrics, hands, side, options) {
  const handKinds = getHandKinds(metrics.position);
  const slotSize = metrics.handSlotSize;
  const centerX = side === "w" ? metrics.leftHandCenterX : metrics.rightHandCenterX;
  const startY = metrics.handStartY;
  handKinds.forEach((kind, index) => {
    const count = hands[kind] || 0;
    const centerY = startY + index * metrics.handSlotGap;
    if (options.selectedHand?.side === side && options.selectedHand?.kind === kind) {
      ctx.save();
      ctx.strokeStyle = "rgba(168, 54, 35, 0.72)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(centerX - slotSize * 0.7, centerY - slotSize * 0.7, slotSize * 1.4, slotSize * 1.4, 12);
      ctx.stroke();
      ctx.restore();
    }
    drawShogiPiece(ctx, centerX, centerY, slotSize, side, {
      label: options.theme.render(kind),
      image: options.getLishogiImage(options.lishogiPack, side, kind),
      promoted: false,
      dimmed: count === 0,
      count: count > 0 ? `x${count}` : "",
      scale: options.handPieceScale || 2,
    });
  });
}

function drawShogiPiece(ctx, centerX, centerY, cell, side, pieceVisual) {
  const pieceScale = pieceVisual.scale || 1.08;
  const scaledCell = cell * pieceScale;
  ctx.save();
  ctx.translate(centerX, centerY);
  if (pieceVisual.dimmed) {
    ctx.globalAlpha = 0.3;
  }
  if (side === "w" && !pieceVisual.image) {
    ctx.rotate(Math.PI);
  }
  if (pieceVisual.image && pieceVisual.image.complete && pieceVisual.image.naturalWidth > 0) {
    const imageSize = scaledCell * 0.88;
    ctx.drawImage(pieceVisual.image, -imageSize / 2, -imageSize / 2, imageSize, imageSize);
  } else {
    ctx.fillStyle = "#f7ebc4";
    ctx.strokeStyle = "#6b4c21";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -scaledCell * 0.42);
    ctx.lineTo(scaledCell * 0.36, -scaledCell * 0.18);
    ctx.lineTo(scaledCell * 0.28, scaledCell * 0.42);
    ctx.lineTo(-scaledCell * 0.28, scaledCell * 0.42);
    ctx.lineTo(-scaledCell * 0.36, -scaledCell * 0.18);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = side === "b" ? "#1d1a16" : "#8b2220";
    ctx.font = `700 ${scaledCell * 0.36}px ${CHINESE_FONT_FAMILY}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const lines = pieceVisual.label.length > 3 ? [pieceVisual.label.slice(0, 4), pieceVisual.label.slice(4)] : [pieceVisual.label];
    lines.forEach((line, index) => ctx.fillText(line, 0, (index - (lines.length - 1) / 2) * scaledCell * 0.25));
    if (pieceVisual.promoted) {
      ctx.fillStyle = "#b8841b";
      ctx.beginPath();
      ctx.arc(scaledCell * 0.16, scaledCell * 0.18, scaledCell * 0.12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff7df";
      ctx.font = `700 ${scaledCell * 0.16}px ${UI_FONT_FAMILY}`;
      ctx.fillText("+", scaledCell * 0.16, scaledCell * 0.18);
    }
  }
  ctx.restore();

  if (pieceVisual.count) {
    ctx.save();
    ctx.fillStyle = side === "b" ? "#2c2215" : "#6f261d";
    ctx.font = `700 ${Math.max(12, scaledCell * 0.22)}px ${UI_FONT_FAMILY}`;
    ctx.textAlign = "right";
    ctx.textBaseline = "bottom";
    ctx.fillText(pieceVisual.count, centerX + scaledCell * 0.48, centerY + scaledCell * 0.48);
    ctx.restore();
  }
}

function getShogiMetrics(width, height, position, options = {}) {
  const handKinds = getHandKinds(position);
  const sideReserve = 220;
  const usableWidth = width - sideReserve;
  const usableHeight = height - 150;
  const cell = Math.min(usableWidth / position.cols, usableHeight / position.rows);
  const boardWidth = cell * position.cols;
  const boardHeight = cell * position.rows;
  const originX = (width - boardWidth) / 2;
  const originY = (height - boardHeight) / 2;
  const handSlotSize = Math.max(40, Math.min(56, cell * 0.92));
  const targetExtraGap = options.handGapExtra ?? 72;
  const availableHandHeight = Math.min(height - 48, boardHeight + 40);
  const maxExtraGap =
    handKinds.length > 1
      ? Math.max(0, (availableHandHeight - handSlotSize) / (handKinds.length - 1) - handSlotSize)
      : targetExtraGap;
  const handSlotGap = handSlotSize + Math.min(targetExtraGap, maxExtraGap);
  const handCenterOffset = Math.max(48, (originX - 12) / 2);
  return {
    position,
    originX,
    originY,
    boardWidth,
    boardHeight,
    cell,
    handFontSize: 18,
    handSlotSize,
    handSlotGap,
    handStartY: originY + handSlotSize / 2,
    leftHandCenterX: handCenterOffset,
    rightHandCenterX: width - handCenterOffset,
  };
}

function getShogiContentRect(canvas, position) {
  const metrics = getShogiMetrics(canvas.width, canvas.height, position, { handGapExtra: 16 });
  const handKinds = getHandKinds(position);
  const padX = metrics.handSlotSize * 0.8;
  const padTop = 36;
  const padBottom = 22;
  const left = Math.max(0, metrics.leftHandCenterX - metrics.handSlotSize / 2 - padX * 0.35);
  const right = Math.min(canvas.width, metrics.rightHandCenterX + metrics.handSlotSize / 2 + padX * 0.35);
  const top = Math.max(0, metrics.originY - padTop);
  const bottom = Math.min(
    canvas.height,
    Math.max(
      metrics.originY + metrics.boardHeight,
      metrics.handStartY + (handKinds.length - 1) * metrics.handSlotGap + metrics.handSlotSize / 2
    ) + padBottom
  );
  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
  };
}

function getShogiOutputSize(cropRect, maxSide = 720) {
  const scale = Math.min(maxSide / cropRect.width, maxSide / cropRect.height);
  return {
    width: Math.round(cropRect.width * scale),
    height: Math.round(cropRect.height * scale),
  };
}

function clonePosition(position) {
  return {
    board: position.board.map((row) => row.map((piece) => (piece ? { ...piece } : null))),
    cols: position.cols,
    rows: position.rows,
    promotionZoneDepth: position.promotionZoneDepth,
    turn: position.turn,
    hands: { b: { ...position.hands.b }, w: { ...position.hands.w } },
    handKinds: [...(position.handKinds || HAND_ORDER)],
    moveNumber: position.moveNumber,
  };
}

function loadVariantPosition(variant) {
  const position = parseSfen(VARIANTS[variant].sfen);
  applyVariantGeometry(position, variant);
  position.hands = { b: { ...VARIANTS[variant].hands.b }, w: { ...VARIANTS[variant].hands.w } };
  return position;
}

function applyVariantGeometry(position, variant) {
  position.cols = VARIANTS[variant].cols;
  position.rows = VARIANTS[variant].rows;
  position.promotionZoneDepth = VARIANTS[variant].promotionZoneDepth;
  position.handKinds = [...VARIANTS[variant].handKinds];
}

function applyVariantHands(position, variant) {
  applyVariantGeometry(position, variant);
  position.hands = { b: { ...VARIANTS[variant].hands.b }, w: { ...VARIANTS[variant].hands.w } };
}

function countSideInventory(position, side) {
  const counts = {};
  position.board.forEach((row) => {
    row.forEach((square) => {
      if (!square || square.side !== side) {
        return;
      }
      const kind = square.kind.replace("+", "");
      counts[kind] = (counts[kind] || 0) + 1;
    });
  });
  Object.entries(position.hands[side] || {}).forEach(([kind, count]) => {
    counts[kind] = (counts[kind] || 0) + count;
  });
  return counts;
}

function parseSfen(sfen) {
  const [placement, turn = "b", hands = "-", moveNumber = "1"] = sfen.split(/\s+/);
  const rows = placement.split("/");
  const cols = rows.reduce((max, row) => {
    let width = 0;
    for (let index = 0; index < row.length; index += 1) {
      const char = row[index];
      if (/\d/.test(char)) {
        width += Number(char);
      } else if (char === "+") {
        index += 1;
        width += 1;
      } else {
        width += 1;
      }
    }
    return Math.max(max, width);
  }, 0);
  const board = Array.from({ length: rows.length }, () => Array(cols).fill(null));
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
  return {
    board,
    cols,
    rows: rows.length,
    promotionZoneDepth: cols === 5 && rows.length === 6 ? 2 : 3,
    turn,
    hands: parseHands(hands),
    handKinds: [...HAND_ORDER],
    moveNumber: Number(moveNumber),
  };
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

function parseImportedMoves(text, startPosition) {
  const input = text.trim();
  if (!input) {
    return [];
  }
  if (looksLikeKif(input)) {
    return parseKifRecord(input, clonePosition(startPosition));
  }
  return input.split(/[\s,]+/).filter(Boolean).map((usi) => ({ usi, label: usi }));
}

function looksLikeKif(text) {
  return /(^|\n)\s*手数-+指手/.test(text) || /(^|\n)\s*\d+\s+(同|[１２３４５６７８９])/.test(text) || /開始日時：|棋戦：|手合割：/.test(text);
}

function parseKifRecord(text, position) {
  const moves = [];
  let previousTo = null;
  text.split(/\r?\n/).forEach((line) => {
    const match = line.match(/^\s*(\d+)\s+(.+?)\s*$/);
    if (!match) {
      return;
    }
    const notation = match[2].trim();
    if (!notation || /^手数-+指手/.test(notation)) {
      return;
    }
    if (/^(投了|詰み|中断|千日手|持将棋|反則勝ち|反則負け|入玉勝ち|切れ負け)/.test(notation)) {
      return;
    }
    const parsed = parseKifNotation(notation, previousTo, position);
    moves.push({ usi: parsed.usi, label: notation });
    position = applyUsiMove(clonePosition(position), parsed.usi);
    previousTo = parsed.to;
  });
  return moves;
}

function parseKifNotation(notation, previousTo, position) {
  const normalized = notation.replace(/\s+/g, "").replace(/　+/g, "");
  const match = normalized.match(/^(同|[１２３４５６７８９][一二三四五六七八九])(成銀|成桂|成香|と|龍|竜|馬|歩|香|桂|銀|金|角|飛|玉|王|杏|圭|全)(打|成|不成)?(?:\(([1-9][1-9])\))?$/);
  if (!match) {
    throw new Error(`Unsupported KIF move: ${notation}`);
  }
  const [, destinationText, pieceText, action = "", sourceText] = match;
  const to = destinationText === "同" ? previousTo : kifDestinationToCoords(destinationText, position.cols);
  if (!to) {
    throw new Error(`Cannot resolve KIF destination: ${notation}`);
  }
  const kind = kifPieceToKind(pieceText);
  if (action === "打") {
    return {
      usi: `${kind}*${coordsToShogiSquare(to.x, to.y, position.cols)}`,
      to,
    };
  }
  if (!sourceText) {
    throw new Error(`KIF move is missing source square: ${notation}`);
  }
  const from = kifSourceToCoords(sourceText, position.cols);
  const promote = action === "成" ? "+" : "";
  return {
    usi: `${coordsToShogiSquare(from.x, from.y, position.cols)}${coordsToShogiSquare(to.x, to.y, position.cols)}${promote}`,
    to,
  };
}

function kifDestinationToCoords(text, cols) {
  const file = fullWidthDigitToNumber(text[0]);
  const rank = japaneseRankToNumber(text[1]);
  if (!file || !rank) {
    return null;
  }
  return {
    x: cols - file,
    y: rank - 1,
  };
}

function kifSourceToCoords(text, cols) {
  return {
    x: cols - Number(text[0]),
    y: Number(text[1]) - 1,
  };
}

function fullWidthDigitToNumber(char) {
  return "０１２３４５６７８９".indexOf(char);
}

function japaneseRankToNumber(char) {
  return "一二三四五六七八九".indexOf(char) + 1;
}

function kifPieceToKind(text) {
  switch (text) {
    case "歩":
      return "P";
    case "香":
      return "L";
    case "桂":
      return "N";
    case "銀":
      return "S";
    case "金":
      return "G";
    case "角":
      return "B";
    case "飛":
      return "R";
    case "玉":
    case "王":
      return "K";
    case "と":
      return "+P";
    case "成香":
    case "杏":
      return "+L";
    case "成桂":
    case "圭":
      return "+N";
    case "成銀":
    case "全":
      return "+S";
    case "馬":
      return "+B";
    case "龍":
    case "竜":
      return "+R";
    default:
      throw new Error(`Unsupported KIF piece: ${text}`);
  }
}

function positionToSfen(position) {
  const placement = position.board
    .map((row) => {
      let empty = 0;
      let output = "";
      row.forEach((square) => {
        if (!square) {
          empty += 1;
          return;
        }
        if (empty) {
          output += String(empty);
          empty = 0;
        }
        const code = square.side === "b" ? square.kind : square.kind.toLowerCase();
        output += code.startsWith("+") ? `+${code[1]}` : code;
      });
      if (empty) {
        output += String(empty);
      }
      return output;
    })
    .join("/");
  return `${placement} ${position.turn} ${handsToSfen(position.hands)} ${position.moveNumber || 1}`;
}

function handsToSfen(hands) {
  const tokens = [];
  [
    ["b", HAND_ORDER],
    ["w", HAND_ORDER],
  ].forEach(([side, order]) => {
    order.forEach((kind) => {
      const count = hands[side][kind] || 0;
      if (!count) {
        return;
      }
      const code = side === "b" ? kind : kind.toLowerCase();
      tokens.push(`${count > 1 ? count : ""}${code}`);
    });
  });
  return tokens.length ? tokens.join("") : "-";
}

function applyUsiMove(position, text) {
  const move = text.trim();
  if (!move) {
    return position;
  }
  if (move.includes("*")) {
    const [piece, targetText] = move.split("*");
    const target = shogiSquareToCoords(targetText, position.cols);
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
    const from = shogiSquareToCoords(move.slice(0, 2), position.cols);
    const to = shogiSquareToCoords(move.slice(2, 4), position.cols);
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
    while (nx >= 0 && nx < position.cols && ny >= 0 && ny < position.rows) {
      const target = position.board[ny][nx];
      if (target && target.side === piece.side) {
        break;
      }
      moves.push({
        from: { x, y },
        to: { x: nx, y: ny },
        usi: `${coordsToShogiSquare(x, y, position.cols)}${coordsToShogiSquare(nx, ny, position.cols)}`,
        canPromote: isPromotionAvailable(position, piece.kind, piece.side, y, ny),
        mustPromote: isPromotionRequired(position, piece.kind, piece.side, ny),
      });
      if (target || !direction.repeat) {
        break;
      }
      nx += direction.dx;
      ny += direction.dy;
    }
  });
  return moves;
}

function generateShogiDrops(position, kind) {
  const moves = [];
  for (let y = 0; y < position.rows; y += 1) {
    for (let x = 0; x < position.cols; x += 1) {
      if (position.board[y][x]) {
        continue;
      }
      if (!isLegalDrop(position, kind, x, y)) {
        continue;
      }
      moves.push({
        to: { x, y },
        usi: `${kind}*${coordsToShogiSquare(x, y, position.cols)}`,
      });
    }
  }
  return moves;
}

function isLegalDrop(position, kind, x, y) {
  const side = position.turn;
  if (kind === "P") {
    if (side === "b" ? y === 0 : y === position.rows - 1) {
      return false;
    }
    for (let row = 0; row < position.rows; row += 1) {
      const square = position.board[row][x];
      if (square?.side === side && square.kind === "P") {
        return false;
      }
    }
  }
  if (kind === "L" && (side === "b" ? y === 0 : y === position.rows - 1)) {
    return false;
  }
  if (kind === "N" && (side === "b" ? y <= 1 : y >= position.rows - 2)) {
    return false;
  }
  return true;
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

function isPromotionAvailable(position, kind, side, fromY, toY) {
  if (!canPromote(kind)) {
    return false;
  }
  const depth = position.promotionZoneDepth || 3;
  return side === "b"
    ? fromY < depth || toY < depth
    : fromY >= position.rows - depth || toY >= position.rows - depth;
}

function isPromotionRequired(position, kind, side, toY) {
  const base = kind.replace("+", "");
  if (!canPromote(base)) {
    return false;
  }
  if (base === "P" || base === "L") {
    return side === "b" ? toY === 0 : toY === position.rows - 1;
  }
  if (base === "N") {
    return side === "b" ? toY <= 1 : toY >= position.rows - 2;
  }
  return false;
}

function canPromote(kind) {
  return ["R", "B", "S", "N", "L", "P"].includes(kind.replace("+", ""));
}

function canvasPointToSquare(canvas, event, position) {
  const rect = canvas.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * canvas.width;
  const y = ((event.clientY - rect.top) / rect.height) * canvas.height;
  const metrics = getShogiMetrics(canvas.width, canvas.height, position);
  if (x < metrics.originX || x > metrics.originX + metrics.boardWidth || y < metrics.originY || y > metrics.originY + metrics.boardHeight) {
    return null;
  }
  return {
    x: clamp(Math.floor((x - metrics.originX) / metrics.cell), 0, position.cols - 1),
    y: clamp(Math.floor((y - metrics.originY) / metrics.cell), 0, position.rows - 1),
  };
}

function canvasPointToHandSlot(canvas, event, position) {
  const rect = canvas.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * canvas.width;
  const y = ((event.clientY - rect.top) / rect.height) * canvas.height;
  const metrics = getShogiMetrics(canvas.width, canvas.height, position);
  const side = x <= metrics.originX ? "w" : x >= metrics.originX + metrics.boardWidth ? "b" : null;
  if (!side) {
    return null;
  }
  const centerX = side === "w" ? metrics.leftHandCenterX : metrics.rightHandCenterX;
  const half = metrics.handSlotSize / 2;
  if (x < centerX - half || x > centerX + half) {
    return null;
  }
  const handKinds = getHandKinds(position);
  for (let index = 0; index < handKinds.length; index += 1) {
    const centerY = metrics.handStartY + index * metrics.handSlotGap;
    if (y >= centerY - half && y <= centerY + half) {
      return { side, kind: handKinds[index] };
    }
  }
  return null;
}

function getHandKinds(position) {
  return position.handKinds?.length ? position.handKinds : HAND_ORDER;
}

function shogiSquareToCoords(square, cols) {
  return {
    x: cols - Number(square[0]),
    y: square[1].toLowerCase().charCodeAt(0) - 97,
  };
}

function coordsToShogiSquare(x, y, cols) {
  return `${cols - x}${String.fromCharCode(97 + y)}`;
}

function formatHands(hands) {
  const entries = Object.entries(hands);
  return entries.length ? entries.map(([piece, count]) => `${piece}x${count}`).join(" ") : "none";
}
