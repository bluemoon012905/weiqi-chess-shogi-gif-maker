import { mountChess } from "./chess.js";
import { mountGo } from "./go.js";
import { mountShogi } from "./shogi.js";
import { mountXiangqi } from "./xiangqi.js";

const MODES = [
  {
    id: "xiangqi",
    name: "Xiangqi",
    subtitle: "Board editor, playback, and FEN/UCCI GIF export.",
    mount: mountXiangqi,
  },
  {
    id: "chess",
    name: "Chess",
    subtitle: "PGN tree parsing with branch, range, and crop export.",
    mount: mountChess,
  },
  {
    id: "go",
    name: "Weiqi / Go",
    subtitle: "SGF tree parsing with branch, board-size, range, and crop export.",
    mount: mountGo,
  },
  {
    id: "shogi",
    name: "Shogi",
    subtitle: "Variant presets, theme selection, and range-based GIF export.",
    mount: mountShogi,
  },
];

const navElement = document.querySelector("#mode-nav");
const introTitle = document.querySelector("#mode-title");
const introCopy = document.querySelector("#mode-copy");
const hostElement = document.querySelector("#mode-host");

const mountedModes = new Map();

function init() {
  buildNavigation();
  const initial = new URLSearchParams(window.location.search).get("mode");
  const fallbackMode = MODES.some((mode) => mode.id === initial) ? initial : "xiangqi";
  activateMode(fallbackMode);
}

function buildNavigation() {
  MODES.forEach((mode) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "mode-tab";
    button.dataset.mode = mode.id;
    button.innerHTML = `<strong>${mode.name}</strong><span>${mode.subtitle}</span>`;
    button.addEventListener("click", () => activateMode(mode.id));
    navElement.append(button);
  });
}

function activateMode(modeId) {
  navElement.querySelectorAll(".mode-tab").forEach((button) => {
    button.classList.toggle("active", button.dataset.mode === modeId);
  });

  const mode = MODES.find((entry) => entry.id === modeId) || MODES[0];
  introTitle.textContent = mode.name;
  introCopy.textContent = mode.subtitle;

  if (!mountedModes.has(mode.id)) {
    const panel = document.createElement("section");
    panel.className = "mode-panel";
    panel.dataset.modePanel = mode.id;
    hostElement.append(panel);
    mountedModes.set(mode.id, {
      panel,
      api: mode.mount(panel),
    });
  }

  mountedModes.forEach((entry, id) => {
    entry.panel.hidden = id !== mode.id;
  });

  const nextUrl = new URL(window.location.href);
  nextUrl.searchParams.set("mode", mode.id);
  window.history.replaceState({}, "", nextUrl);
}

init();
