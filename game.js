'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#90caf9', // J - pale blue
  '#ffb74d', // L - orange
];

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
];

const LINE_SCORES = [0, 100, 300, 500, 800];

const RECORDS_KEY = 'tetris-records';
const STATS_KEY = 'tetris-stats';
const MAX_RECORDS = 5;

function shadeColor(hex, percent) {
  const num = parseInt(hex.slice(1), 16);
  const amt = Math.round(2.55 * percent);
  const r = Math.min(255, Math.max(0, (num >> 16) + amt));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00ff) + amt));
  const b = Math.min(255, Math.max(0, (num & 0x0000ff) + amt));
  return '#' + (0x1000000 + r * 0x10000 + g * 0x100 + b).toString(16).slice(1);
}

function roundedRectPath(context, x, y, w, h, r) {
  context.beginPath();
  context.moveTo(x + r, y);
  context.lineTo(x + w - r, y);
  context.arcTo(x + w, y, x + w, y + r, r);
  context.lineTo(x + w, y + h - r);
  context.arcTo(x + w, y + h, x + w - r, y + h, r);
  context.lineTo(x + r, y + h);
  context.arcTo(x, y + h, x, y + h - r, r);
  context.lineTo(x, y + r);
  context.arcTo(x, y, x + r, y, r);
  context.closePath();
}

const SKINS = {
  retro: {
    label: 'Retro',
    colors: COLORS,
    gridColor: '#22222e',
    draw(context, x, y, colorIndex, size, alpha) {
      const color = this.colors[colorIndex];
      context.globalAlpha = alpha;
      context.fillStyle = color;
      context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
      context.fillStyle = 'rgba(255,255,255,0.12)';
      context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
      context.globalAlpha = 1;
    },
  },
  neon: {
    label: 'Neon',
    colors: [null, '#00e5ff', '#faff00', '#ff2df5', '#39ff6a', '#ff2d55', '#4da3ff', '#ff9f1c'],
    gridColor: '#101018',
    draw(context, x, y, colorIndex, size, alpha) {
      const color = this.colors[colorIndex];
      const px = x * size + 2, py = y * size + 2, s = size - 4;
      context.globalAlpha = alpha;
      context.save();
      context.shadowColor = color;
      context.shadowBlur = 14;
      context.fillStyle = color;
      context.fillRect(px, py, s, s);
      context.restore();
      context.strokeStyle = color;
      context.lineWidth = 1;
      context.strokeRect(px + 0.5, py + 0.5, s - 1, s - 1);
      context.globalAlpha = 1;
    },
  },
  pastel: {
    label: 'Pastel',
    colors: [null, '#bfeceb', '#fff3c4', '#e6cdf2', '#cdeacd', '#f7c9c9', '#cfe3fb', '#ffe3bf'],
    gridColor: '#2a2a38',
    draw(context, x, y, colorIndex, size, alpha) {
      const color = this.colors[colorIndex];
      context.globalAlpha = alpha;
      roundedRectPath(context, x * size + 2, y * size + 2, size - 4, size - 4, 6);
      context.fillStyle = color;
      context.fill();
      context.globalAlpha = 1;
    },
  },
  pixel: {
    label: 'Pixel art',
    colors: COLORS,
    gridColor: '#22222e',
    draw(context, x, y, colorIndex, size, alpha) {
      const color = this.colors[colorIndex];
      const px = x * size + 1, py = y * size + 1, s = size - 2;
      context.globalAlpha = alpha;
      context.fillStyle = color;
      context.fillRect(px, py, s, s);
      const dark = shadeColor(color, -25);
      const light = shadeColor(color, 25);
      const cell = s / 4;
      for (let ry = 0; ry < 4; ry++) {
        for (let rx = 0; rx < 4; rx++) {
          if ((rx + ry) % 3 === 0) {
            context.fillStyle = (rx + ry) % 2 === 0 ? light : dark;
            context.fillRect(px + rx * cell, py + ry * cell, cell, cell);
          }
        }
      }
      context.strokeStyle = 'rgba(0,0,0,0.5)';
      context.lineWidth = 1;
      context.strokeRect(px + 0.5, py + 0.5, s - 1, s - 1);
      context.globalAlpha = 1;
    },
  },
};

const SKIN_STORAGE_KEY = 'tetris-skin';
let currentSkin = localStorage.getItem(SKIN_STORAGE_KEY) || 'retro';
if (!SKINS[currentSkin]) currentSkin = 'retro';

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');
const themeSelect = document.getElementById('theme-select');
const pauseOverlay = document.getElementById('pause-overlay');
const pauseMenuMain = document.getElementById('pause-menu-main');
const pauseControlsList = document.getElementById('pause-controls-list');
const resumeBtn = document.getElementById('resume-btn');
const pauseRestartBtn = document.getElementById('pause-restart-btn');
const controlsBtn = document.getElementById('controls-btn');
const backBtn = document.getElementById('back-btn');
const startLevelSelect = document.getElementById('start-level-select');
const recordsListEl = document.getElementById('records-list');
const bestComboEl = document.getElementById('best-combo');
const maxLinesRecordEl = document.getElementById('max-lines-record');
const resetRecordsBtn = document.getElementById('reset-records-btn');
const nameEntry = document.getElementById('name-entry');
const playerNameInput = document.getElementById('player-name-input');
const saveScoreBtn = document.getElementById('save-score-btn');
const overlayRecords = document.getElementById('overlay-records');
const skinSelect = document.getElementById('skin-select');

let board, current, next, score, lines, level, combo, maxCombo, paused, gameOver, lastTime, dropAccum, dropInterval, animId;

function applyTheme(theme) {
  document.body.dataset.theme = theme;
  themeSelect.value = theme;
  localStorage.setItem('tetris-theme', theme);
}

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  const type = Math.floor(Math.random() * 7) + 1;
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    combo++;
    if (combo > maxCombo) maxCombo = combo;
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    updateHUD();
  } else {
    combo = 0;
  }
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  merge();
  clearLines();
  spawn();
}

function spawn() {
  current = next;
  next = randomPiece();
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  SKINS[currentSkin].draw(context, x, y, colorIndex, size, alpha ?? 1);
}

function setSkin(name) {
  if (!SKINS[name]) return;
  currentSkin = name;
  localStorage.setItem(SKIN_STORAGE_KEY, name);
  document.body.dataset.skin = name;
  if (current) draw();
  if (next) drawNext();
}

function drawGrid() {
  ctx.strokeStyle = SKINS[currentSkin].gridColor;
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

function loadRecords() {
  try {
    return JSON.parse(localStorage.getItem(RECORDS_KEY)) || [];
  } catch {
    return [];
  }
}

function saveRecords(records) {
  localStorage.setItem(RECORDS_KEY, JSON.stringify(records));
}

function loadStats() {
  try {
    return JSON.parse(localStorage.getItem(STATS_KEY)) || { bestCombo: 0, maxLines: 0 };
  } catch {
    return { bestCombo: 0, maxLines: 0 };
  }
}

function saveStats(stats) {
  localStorage.setItem(STATS_KEY, JSON.stringify(stats));
}

function qualifiesForRecords(s) {
  const records = loadRecords();
  return records.length < MAX_RECORDS || s > records[records.length - 1].score;
}

function renderRecords(container, highlightIndex) {
  const records = loadRecords();
  container.innerHTML = '';
  if (records.length === 0) {
    const li = document.createElement('li');
    li.textContent = 'Sin récords todavía';
    li.className = 'record-empty';
    container.appendChild(li);
    return;
  }
  records.forEach((r, i) => {
    const li = document.createElement('li');
    li.textContent = `${i + 1}. ${r.name} — ${r.score.toLocaleString()}`;
    if (i === highlightIndex) li.classList.add('record-highlight');
    container.appendChild(li);
  });
}

function renderStats() {
  const stats = loadStats();
  bestComboEl.textContent = stats.bestCombo;
  maxLinesRecordEl.textContent = stats.maxLines;
}

function updateGlobalStats() {
  const stats = loadStats();
  let changed = false;
  if (maxCombo > stats.bestCombo) { stats.bestCombo = maxCombo; changed = true; }
  if (lines > stats.maxLines) { stats.maxLines = lines; changed = true; }
  if (changed) saveStats(stats);
  renderStats();
}

function saveScore() {
  const name = (playerNameInput.value.trim() || 'Jugador').slice(0, 12);
  const records = loadRecords();
  records.push({ name, score, lines, combo: maxCombo });
  records.sort((a, b) => b.score - a.score);
  records.length = Math.min(records.length, MAX_RECORDS);
  saveRecords(records);
  const idx = records.findIndex(r => r.name === name && r.score === score);
  renderRecords(recordsListEl, -1);
  nameEntry.classList.add('hidden');
  overlayRecords.classList.remove('hidden');
  renderRecords(overlayRecords, idx);
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()} · Líneas: ${lines} · Combo máx: ${maxCombo}`;
  overlay.classList.remove('hidden');
  updateGlobalStats();
  if (qualifiesForRecords(score)) {
    nameEntry.classList.remove('hidden');
    overlayRecords.classList.add('hidden');
    playerNameInput.value = '';
    playerNameInput.focus();
  } else {
    nameEntry.classList.add('hidden');
    overlayRecords.classList.remove('hidden');
    renderRecords(overlayRecords, -1);
  }
}

function showPauseMenu() {
  pauseControlsList.classList.add('hidden');
  pauseMenuMain.classList.remove('hidden');
  pauseOverlay.classList.remove('hidden');
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    pauseOverlay.classList.add('hidden');
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    showPauseMenu();
  }
}

function loop(ts) {
  const dt = ts - lastTime;
  lastTime = ts;
  dropAccum += dt;
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
    }
  }
  draw();
  animId = requestAnimationFrame(loop);
}

function init() {
  board = createBoard();
  score = 0;
  lines = 0;
  level = parseInt(startLevelSelect.value, 10) || 1;
  combo = 0;
  maxCombo = 0;
  paused = false;
  gameOver = false;
  dropInterval = Math.max(100, 1000 - (level - 1) * 90);
  dropAccum = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  pauseOverlay.classList.add('hidden');
  nameEntry.classList.add('hidden');
  overlayRecords.classList.add('hidden');
  renderRecords(recordsListEl, -1);
  renderStats();
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (e.code === 'KeyP' || e.code === 'Escape') { togglePause(); return; }
  if (paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

restartBtn.addEventListener('click', init);
themeSelect.addEventListener('change', e => applyTheme(e.target.value));

resumeBtn.addEventListener('click', togglePause);
pauseRestartBtn.addEventListener('click', init);
controlsBtn.addEventListener('click', () => {
  pauseMenuMain.classList.add('hidden');
  pauseControlsList.classList.remove('hidden');
});
backBtn.addEventListener('click', showPauseMenu);

saveScoreBtn.addEventListener('click', saveScore);

playerNameInput.addEventListener('keydown', e => {
  e.stopPropagation();
  if (e.code === 'Enter') saveScore();
});

resetRecordsBtn.addEventListener('click', () => {
  if (!confirm('¿Borrar todos los récords y estadísticas?')) return;
  localStorage.removeItem(RECORDS_KEY);
  localStorage.removeItem(STATS_KEY);
  renderRecords(recordsListEl, -1);
  renderStats();
});

applyTheme(localStorage.getItem('tetris-theme') || 'dark');

skinSelect.value = currentSkin;
document.body.dataset.skin = currentSkin;
skinSelect.addEventListener('change', e => setSkin(e.target.value));

init();
