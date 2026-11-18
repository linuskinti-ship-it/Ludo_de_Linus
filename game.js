const PATH = [
  [6, 1], [6, 2], [6, 3], [6, 4], [6, 5], [5, 6], [4, 6], [3, 6], [2, 6], [1, 6], [0, 6], [0, 7], [0, 8],
  [1, 8], [2, 8], [3, 8], [4, 8], [5, 8], [6, 9], [6, 10], [6, 11], [6, 12], [6, 13], [6, 14], [7, 14],
  [8, 14], [8, 13], [8, 12], [8, 11], [8, 10], [8, 9], [9, 8], [10, 8], [11, 8], [12, 8], [13, 8], [14, 8],
  [14, 7], [14, 6], [13, 6], [12, 6], [11, 6], [10, 6], [9, 6], [8, 5], [8, 4], [8, 3], [8, 2], [8, 1],
  [8, 0], [7, 0], [6, 0],
];

const PLAYERS = [
  { name: "Rouge", color: "red", start: 0, yard: [[3, 3], [3, 4], [4, 3], [4, 4]], lane: [[7, 1], [7, 2], [7, 3], [7, 4], [7, 5]] },
  { name: "Vert", color: "green", start: 13, yard: [[3, 10], [3, 11], [4, 10], [4, 11]], lane: [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7]] },
  { name: "Jaune", color: "yellow", start: 26, yard: [[10, 10], [10, 11], [11, 10], [11, 11]], lane: [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9]] },
  { name: "Bleu", color: "blue", start: 39, yard: [[10, 3], [10, 4], [11, 3], [11, 4]], lane: [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7]] },
];
const HOME_ENTRY_STEP = PATH.length - 2;
const HOME_LANE_START_STEP = HOME_ENTRY_STEP + 1;
const FINISH_STEP = HOME_LANE_START_STEP + PLAYERS[0].lane.length;
const SAFE_SPACES = new Set(PLAYERS.map((player) => player.start));
const DIE_PIPS = [
  [],
  [4],
  [0, 8],
  [0, 4, 8],
  [0, 2, 6, 8],
  [0, 2, 4, 6, 8],
  [0, 2, 3, 5, 6, 8],
];

const board = document.querySelector("#board");
const settingsDialog = document.querySelector("#settings-dialog");
const state = {
  turn: 0,
  activePlayers: [0, 1, 2, 3],
  rolled: null,
  selectable: [],
  winner: null,
  waitingTurn: false,
  rolling: false,
  animating: false,
  sixesThisTurn: 0,
  diceValues: PLAYERS.map(() => 1),
  movingToken: null,
};
let tokens;
let turnTimer;
let rollTimer;
let autoMoveTimer;
let gameGeneration = 0;
let selectedPlayerCount = 4;
let selectedColors = [0, 1, 2, 3];
let settingsPlayerCount = selectedPlayerCount;
let settingsColors = [...selectedColors];
let audioContext;

function getAudioContext() {
  if (!audioContext) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) audioContext = new AudioContextClass();
  }
  if (audioContext?.state === "suspended") audioContext.resume();
  return audioContext;
}

function playTone(frequency, startTime, duration, volume = 0.12, type = "sine") {
  const context = getAudioContext();
  if (!context) return;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, startTime);
  gain.gain.setValueAtTime(volume, startTime);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(startTime);
  oscillator.stop(startTime + duration);
}

function playDiceSound() {
  const context = getAudioContext();
  if (!context) return;
  const now = context.currentTime;
  [0, 0.055, 0.11, 0.16, 0.21].forEach((delay, index) => {
    playTone(170 + index * 28 + (index % 2) * 35, now + delay, 0.045, 0.09, "triangle");
  });
}

function playCaptureSound() {
  const context = getAudioContext();
  if (!context) return;
  const now = context.currentTime;
  [392, 523.25, 659.25, 783.99].forEach((frequency, index) => {
    playTone(frequency, now + index * 0.075, 0.18, 0.11, "square");
  });
}

function defaultColorsForCount(count) {
  if (count === 2) return [0, 2];
  if (count === 3) return [0, 1, 2];
  return [0, 1, 2, 3];
}

function coordinateKey(row, col) {
  return `${row},${col}`;
}

function createCell(row, col, className) {
  const cell = document.createElement("div");
  cell.className = className;
  cell.style.setProperty("--row", row + 1);
  cell.style.setProperty("--col", col + 1);
  return cell;
}

function buildBoard() {
  board.replaceChildren();
  for (const player of PLAYERS) {
    const yard = document.createElement("div");
    yard.className = `yard ${player.color}`;
    yard.innerHTML = `<span class="yard-name">${player.name.toUpperCase()}</span><span class="yard-status" role="img" aria-label="0 pion sur 4 au centre">${Array.from({ length: 4 }, () => '<i class="status-token"></i>').join("")}</span><div class="yard-inner"></div><button class="yard-die ${player.color}" type="button" aria-label="Dé ${player.name}"><span class="die-face" aria-hidden="true">${Array.from({ length: 9 }, (_, index) => `<i class="die-pip pip-${index}"></i>`).join("")}</span></button>`;
    yard.querySelector(".yard-die").addEventListener("click", () => rollDice(PLAYERS.indexOf(player)));
    board.append(yard);
  }
  PATH.forEach(([row, col], index) => {
    const startPlayer = PLAYERS.find((player) => player.start === index);
    const cell = createCell(row, col, `board-cell track-cell${SAFE_SPACES.has(index) ? " safe" : ""}${startPlayer ? ` start ${startPlayer.color}` : ""}`);
    cell.dataset.pathIndex = index;
    board.append(cell);
  });
  PLAYERS.forEach((player) => player.lane.forEach(([row, col]) => {
    const cell = createCell(row, col, `board-cell home-cell ${player.color}`);
    cell.dataset.home = player.color;
    board.append(cell);
  }));
  const finish = createCell(6, 6, "board-cell finish");
  finish.style.gridRowEnd = "span 3";
  finish.style.gridColumnEnd = "span 3";
  finish.innerHTML = "<span>★</span>";
  board.append(finish);
}

function newGame() {
  window.clearTimeout(turnTimer);
  window.clearTimeout(rollTimer);
  window.clearTimeout(autoMoveTimer);
  gameGeneration++;
  state.activePlayers = [...selectedColors].sort((a, b) => a - b);
  tokens = PLAYERS.map(() => Array(4).fill(-1));
  state.turn = state.activePlayers[0];
  state.rolled = null;
  state.selectable = [];
  state.winner = null;
  state.waitingTurn = false;
  state.rolling = false;
  state.animating = false;
  state.sixesThisTurn = 0;
  state.diceValues = PLAYERS.map(() => 1);
  state.movingToken = null;
  render();
}

function tokenCoordinate(playerIndex, tokenIndex) {
  const player = PLAYERS[playerIndex];
  const steps = tokens[playerIndex][tokenIndex];
  if (steps === -1) return player.yard[tokenIndex];
  if (steps === FINISH_STEP) return [7, 7];
  if (steps >= HOME_LANE_START_STEP) return player.lane[steps - HOME_LANE_START_STEP];
  return PATH[(player.start + steps) % PATH.length];
}

function renderTokens() {
  board.querySelectorAll(".stack").forEach((stack) => stack.remove());
  const positions = new Map();
  tokens.forEach((playerTokens, playerIndex) => {
    if (!state.activePlayers.includes(playerIndex)) return;
    playerTokens.forEach((steps, tokenIndex) => {
      if (steps === FINISH_STEP) return;
      const [row, col] = tokenCoordinate(playerIndex, tokenIndex);
      const key = coordinateKey(row, col);
      if (!positions.has(key)) positions.set(key, []);
      positions.get(key).push({ playerIndex, tokenIndex });
    });
  });

  positions.forEach((items, key) => {
    const [row, col] = key.split(",").map(Number);
    const stack = createCell(row, col, `board-cell stack${items.length > 1 ? " crowded" : ""}`);
    const columns = Math.ceil(Math.sqrt(items.length));
    stack.style.setProperty("--stack-columns", columns);
    stack.style.setProperty("--stack-rows", Math.ceil(items.length / columns));
    items.forEach(({ playerIndex, tokenIndex }) => {
      const token = document.createElement("button");
      const isSelectable = playerIndex === state.turn && state.selectable.includes(tokenIndex);
      token.type = "button";
      const isMoving = state.movingToken?.playerIndex === playerIndex && state.movingToken.tokenIndex === tokenIndex;
      token.className = `token ${PLAYERS[playerIndex].color}${items.length > 1 || tokens[playerIndex][tokenIndex] === -1 ? " mini" : ""}${isSelectable ? " selectable" : ""}${tokens[playerIndex][tokenIndex] === FINISH_STEP ? " finished-token" : ""}${isMoving ? " moving" : ""}`;
      token.setAttribute("aria-label", `Pion ${PLAYERS[playerIndex].name.toLowerCase()} ${tokenIndex + 1}${isSelectable ? ", jouable" : ""}`);
      token.title = token.getAttribute("aria-label");
      if (isSelectable) token.addEventListener("click", () => moveToken(tokenIndex));
      stack.append(token);
    });
    board.append(stack);
  });
}

function render() {
  document.querySelectorAll(".yard").forEach((yard, index) => {
    const isInGame = state.activePlayers.includes(index);
    yard.classList.toggle("inactive", !isInGame);
    const die = yard.querySelector(".yard-die");
    const active = index === state.turn;
    die.disabled = !isInGame || !active || state.rolled !== null || state.winner !== null || state.waitingTurn || state.rolling || state.animating;
    die.classList.toggle("is-active", active && state.winner === null);
    die.classList.toggle("rolling", active && state.rolling);
    const visiblePips = DIE_PIPS[state.diceValues[index]];
    die.querySelectorAll(".die-pip").forEach((pip, pipIndex) => {
      pip.classList.toggle("visible", visiblePips.includes(pipIndex));
    });
    die.setAttribute("aria-label", `Dé ${PLAYERS[index].name}${active ? ", tour actuel" : ""}, résultat ${state.diceValues[index]}`);
    const finished = tokens[index].filter((steps) => steps === FINISH_STEP).length;
    yard.querySelectorAll(".status-token").forEach((token, tokenIndex) => {
      token.classList.toggle("is-home", tokenIndex < finished);
    });
    yard.querySelector(".yard-status").setAttribute("aria-label", `${finished} pion${finished > 1 ? "s" : ""} sur 4 au centre`);
  });
  renderTokens();
}

function legalTokens(roll) {
  return tokens[state.turn].flatMap((steps, index) => {
    if (steps === -1) return roll === 6 ? [index] : [];
    if (steps === FINISH_STEP || steps + roll > FINISH_STEP) return [];
    return [index];
  });
}

function rollDie() {
  if (window.crypto?.getRandomValues) {
    const values = new Uint32Array(1);
    const range = 6 * 715827882;
    let value;
    do {
      window.crypto.getRandomValues(values);
      value = values[0];
    } while (value >= range);
    return (value % 6) + 1;
  }
  return Math.floor(Math.random() * 6) + 1;
}

function rollDice(playerIndex) {
  if (playerIndex !== state.turn || state.rolled !== null || state.winner !== null || state.waitingTurn || state.rolling || state.animating) return;
  playDiceSound();
  state.rolling = true;
  const roll = rollDie();
  state.sixesThisTurn = roll === 6 ? state.sixesThisTurn + 1 : 0;
  state.diceValues[playerIndex] = roll;
  const generation = gameGeneration;
  render();
  rollTimer = window.setTimeout(() => {
    if (generation !== gameGeneration) return;
    state.rolling = false;
    if (roll === 6 && state.sixesThisTurn === 3) {
      state.waitingTurn = true;
      state.selectable = [];
      render();
      turnTimer = window.setTimeout(nextTurn, 600);
      return;
    }
    const moves = legalTokens(roll);
    if (moves.length === 0) {
      state.rolled = null;
      if (roll !== 6) state.waitingTurn = true;
      render();
      if (roll !== 6) turnTimer = window.setTimeout(nextTurn, 1100);
      return;
    }
    state.rolled = roll;
    state.selectable = moves;
    render();
    if (moves.length === 1) {
      autoMoveTimer = window.setTimeout(() => moveToken(moves[0]), 350);
    }
  }, 250);
}

const wait = (milliseconds) => new Promise((resolve) => window.setTimeout(resolve, milliseconds));

async function moveToken(tokenIndex) {
  if (!state.selectable.includes(tokenIndex) || state.rolled === null || state.animating) return;
  const generation = gameGeneration;
  const playerIndex = state.turn;
  const roll = state.rolled;
  const currentSteps = tokens[playerIndex][tokenIndex];
  const newSteps = currentSteps === -1 ? 0 : currentSteps + roll;
  state.selectable = [];
  state.animating = true;
  state.movingToken = { playerIndex, tokenIndex };
  render();

  const firstStep = currentSteps === -1 ? 0 : currentSteps + 1;
  for (let step = firstStep; step <= newSteps; step++) {
    if (generation !== gameGeneration) return;
    tokens[playerIndex][tokenIndex] = step;
    renderTokens();
    await wait(140);
  }
  if (generation !== gameGeneration) return;

  if (newSteps <= HOME_ENTRY_STEP) {
    const landedIndex = (PLAYERS[playerIndex].start + newSteps) % PATH.length;
    if (!SAFE_SPACES.has(landedIndex)) {
      let captured = false;
      tokens.forEach((opponentTokens, opponentIndex) => {
        if (opponentIndex === playerIndex || !state.activePlayers.includes(opponentIndex)) return;
        opponentTokens.forEach((steps, opponentTokenIndex) => {
          if (steps < 0 || steps > HOME_ENTRY_STEP) return;
          if ((PLAYERS[opponentIndex].start + steps) % PATH.length === landedIndex) {
            opponentTokens[opponentTokenIndex] = -1;
            captured = true;
          }
        });
      });
      if (captured) playCaptureSound();
    }
  }

  const finished = tokens[playerIndex].every((steps) => steps === FINISH_STEP);
  state.rolled = null;
  state.animating = false;
  state.movingToken = null;
  if (finished) {
    state.winner = playerIndex;
  }
  if (!finished && roll !== 6) state.waitingTurn = true;
  render();

  if (finished) return;
  if (roll !== 6) turnTimer = window.setTimeout(nextTurn, 850);
}

function nextTurn() {
  if (state.winner !== null) return;
  state.waitingTurn = false;
  state.sixesThisTurn = 0;
  turnTimer = undefined;
  const currentPosition = state.activePlayers.indexOf(state.turn);
  state.turn = state.activePlayers[(currentPosition + 1) % state.activePlayers.length];
  render();
}

function renderSettingsOptions() {
  document.querySelectorAll("[data-player-count]").forEach((button) => {
    button.setAttribute("aria-pressed", Number(button.dataset.playerCount) === settingsPlayerCount);
  });
  document.querySelectorAll("[data-player-color]").forEach((button) => {
    button.setAttribute("aria-pressed", settingsColors.includes(Number(button.dataset.playerColor)));
  });
}

document.querySelectorAll("[data-player-count]").forEach((button) => {
  button.addEventListener("click", () => {
    settingsPlayerCount = Number(button.dataset.playerCount);
    settingsColors = defaultColorsForCount(settingsPlayerCount);
    document.querySelector("#settings-message").textContent = "La sélection est prête. Vous pouvez modifier les couleurs.";
    renderSettingsOptions();
  });
});

document.querySelectorAll("[data-player-color]").forEach((button) => {
  button.addEventListener("click", () => {
    const playerIndex = Number(button.dataset.playerColor);
    settingsColors = settingsColors.includes(playerIndex)
      ? settingsColors.filter((index) => index !== playerIndex)
      : [...settingsColors, playerIndex];
    document.querySelector("#settings-message").textContent = settingsColors.length === settingsPlayerCount
      ? "La sélection est prête."
      : `Sélectionnez ${settingsPlayerCount} couleurs (${settingsColors.length} choisie${settingsColors.length === 1 ? "" : "s"}).`;
    renderSettingsOptions();
  });
});

document.querySelector("#open-settings").addEventListener("click", () => {
  settingsPlayerCount = selectedPlayerCount;
  settingsColors = [...selectedColors];
  document.querySelector("#settings-message").textContent = "La sélection est prête. Vous pouvez modifier les couleurs.";
  renderSettingsOptions();
  settingsDialog.showModal();
});
document.querySelector("#apply-settings").addEventListener("click", () => {
  if (settingsColors.length !== settingsPlayerCount) {
    document.querySelector("#settings-message").textContent = `Sélectionnez exactement ${settingsPlayerCount} couleurs pour démarrer.`;
    return;
  }
  selectedPlayerCount = settingsPlayerCount;
  selectedColors = [...settingsColors];
  newGame();
  settingsDialog.close();
});
document.querySelector("#open-rules").addEventListener("click", () => document.querySelector("#rules-dialog").showModal());

buildBoard();
document.querySelector("#new-game").addEventListener("click", newGame);
newGame();
