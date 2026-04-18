/**
 * app.js — Calcudo Solver UI
 * Features: drag-to-select cells, build mode, play/hint mode
 */

// ── Palette of cage colors ────────────────────────────────────────────────
const CAGE_COLORS = [
  '#e8a832', '#5cb87a', '#5f9be8', '#c07ae8', '#e87a5f',
  '#5fc8c8', '#e8d85f', '#e8905f', '#9be85f', '#e85f9b',
];

// ── State ─────────────────────────────────────────────────────────────────
let gridSize   = 3;
let cages      = [];        // { cells: [[r,c],...], op, target, color }
let currentOp  = '+';
let solvedGrid = null;      // Full solution from build-mode solve

// Build mode
let selectedCells = new Set();  // "r,c" strings
let isDragging    = false;

// Play mode
let appMode      = 'build';     // 'build' | 'play'
let userGrid     = [];          // [r][c] = 0|1..n, user's entries in play mode
let hintGrid     = null;        // Full solution used for hints
let hintedCells  = new Set();   // Cells revealed as hints

// ── DOM refs ──────────────────────────────────────────────────────────────
const gridEl          = document.getElementById('calcudo-grid');
const cageListEl      = document.getElementById('cage-list');
const cageCountEl     = document.getElementById('cage-count');
const solveBtn        = document.getElementById('btn-solve');
const resetBtn        = document.getElementById('btn-reset');
const addCageBtn      = document.getElementById('btn-add-cage');
const clearSelBtn     = document.getElementById('btn-clear-selection');
const targetInput     = document.getElementById('cage-target');
const solveMsg        = document.getElementById('solve-message');
const panelBuild      = document.getElementById('panel-build');
const panelPlay       = document.getElementById('panel-play');
const hintBtn         = document.getElementById('btn-hint');
const revealBtn       = document.getElementById('btn-play-reveal');
const clearPlayBtn    = document.getElementById('btn-play-clear');
const playMsg         = document.getElementById('play-message');
const progressBar     = document.getElementById('play-progress-bar');
const progressLabel   = document.getElementById('play-progress-label');
const gridHintText    = document.getElementById('grid-hint-text');

// ── Init ──────────────────────────────────────────────────────────────────
buildGrid();

// ── Mode tabs ─────────────────────────────────────────────────────────────
document.querySelectorAll('.mode-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    const mode = tab.dataset.mode;
    if (mode === appMode) return;
    switchMode(mode);
  });
});

function switchMode(mode) {
  appMode = mode;
  document.querySelectorAll('.mode-tab').forEach(t =>
    t.classList.toggle('active', t.dataset.mode === mode)
  );

  if (mode === 'build') {
    panelBuild.classList.remove('hidden');
    panelPlay.classList.add('hidden');
    gridEl.classList.remove('play-mode');
    gridHintText.textContent = 'Drag across cells → define cage → Add Cage. All cells must belong to a cage.';
    renderGrid();
  } else {
    // Entering play mode: ensure puzzle has a solution
    const covered = new Set();
    cages.forEach(c => c.cells.forEach(([r, cc]) => covered.add(`${r},${cc}`)));
    if (covered.size < gridSize * gridSize) {
      showMessage('Define all cages in Build mode first.', 'error');
      switchMode('build');
      return;
    }
    showMessage('', '');

    // Compute solution for hints
    hintGrid = solve(gridSize, cages);
    if (!hintGrid) {
      showMessage('No solution found — check your cages.', 'error');
      switchMode('build');
      return;
    }

    // Reset user grid
    userGrid = Array.from({ length: gridSize }, () => new Array(gridSize).fill(0));
    hintedCells = new Set();
    solvedGrid = null;
    focusedCell = null;

    panelBuild.classList.add('hidden');
    panelPlay.classList.remove('hidden');
    gridEl.classList.add('play-mode');
    gridHintText.textContent = 'Click empty cells to cycle through values (1–N). Use Get Hint for help.';

    updatePlayProgress();
    showPlayMessage('', '');
    renderGrid();
  }
}

// ── Grid size buttons ─────────────────────────────────────────────────────
document.querySelectorAll('.size-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    if (parseInt(btn.dataset.size) === gridSize) return;
    document.querySelectorAll('.size-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    gridSize = parseInt(btn.dataset.size);
    cages = [];
    selectedCells = new Set();
    solvedGrid = null;
    hintGrid = null;
    if (appMode === 'play') switchMode('build');
    buildGrid();
    renderCageList();
    showMessage('', '');
  });
});

// ── Op buttons ────────────────────────────────────────────────────────────
document.querySelectorAll('.op-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.op-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentOp = btn.dataset.op;
  });
});

// ── Add Cage ──────────────────────────────────────────────────────────────
addCageBtn.addEventListener('click', () => {
  if (selectedCells.size === 0) { showMessage('Select at least one cell first.', 'error'); return; }
  const target = parseInt(targetInput.value);
  if (isNaN(target) || target < 1) { showMessage('Enter a valid target number.', 'error'); return; }

  for (const key of selectedCells) {
    const [r, c] = key.split(',').map(Number);
    if (cages.some(cage => cage.cells.some(([cr, cc]) => cr === r && cc === c))) {
      showMessage(`Cell (${r+1},${c+1}) already belongs to a cage.`, 'error');
      return;
    }
  }
  if (selectedCells.size === 1 && (currentOp === '−' || currentOp === '÷')) {
    showMessage(`Operation ${currentOp} needs at least 2 cells.`, 'error');
    return;
  }

  const cells = [...selectedCells].map(k => k.split(',').map(Number));
  const color = CAGE_COLORS[cages.length % CAGE_COLORS.length];
  cages.push({ cells, op: currentOp, target, color });
  selectedCells = new Set();
  solvedGrid = null;
  renderGrid();
  renderCageList();
  targetInput.value = '';
  showMessage('', '');
});

// ── Clear selection ───────────────────────────────────────────────────────
clearSelBtn.addEventListener('click', () => {
  selectedCells = new Set();
  renderGrid();
});

// ── Solve (build mode) ────────────────────────────────────────────────────
solveBtn.addEventListener('click', () => {
  showMessage('', '');
  const covered = new Set();
  cages.forEach(cage => cage.cells.forEach(([r, c]) => covered.add(`${r},${c}`)));
  if (covered.size < gridSize * gridSize) {
    showMessage(`${gridSize * gridSize - covered.size} cell(s) not assigned to any cage.`, 'error');
    return;
  }
  showMessage('Solving…', 'info');
  solveBtn.disabled = true;
  setTimeout(() => {
    try {
      const result = solve(gridSize, cages);
      if (result) {
        solvedGrid = result;
        renderGrid();
        showMessage('Solved! ✓', 'success');
      } else {
        solvedGrid = null;
        renderGrid();
        showMessage('No solution found. Check your cages.', 'error');
      }
    } catch (e) {
      showMessage('Solver error: ' + e.message, 'error');
    }
    solveBtn.disabled = false;
  }, 30);
});

// ── Reset (build mode) ────────────────────────────────────────────────────
resetBtn.addEventListener('click', () => {
  cages = [];
  selectedCells = new Set();
  solvedGrid = null;
  hintGrid = null;
  renderGrid();
  renderCageList();
  showMessage('', '');
});

// ── Hint (play mode) ──────────────────────────────────────────────────────
hintBtn.addEventListener('click', () => {
  if (!hintGrid) return;

  // Find all cells not yet correctly filled and not yet hinted
  const candidates = [];
  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      const key = `${r},${c}`;
      if (!hintedCells.has(key) && userGrid[r][c] !== hintGrid[r][c]) {
        candidates.push([r, c]);
      }
    }
  }

  if (candidates.length === 0) {
    showPlayMessage('Puzzle complete! ✓', 'success');
    return;
  }

  // Pick a random candidate for variety
  const [r, c] = candidates[Math.floor(Math.random() * candidates.length)];
  const key = `${r},${c}`;
  hintedCells.add(key);
  userGrid[r][c] = hintGrid[r][c];

  renderGrid();
  updatePlayProgress();

  // Flash the revealed cell
  const cell = getCell(r, c);
  if (cell) {
    cell.classList.add('hint-flash');
    cell.addEventListener('animationend', () => cell.classList.remove('hint-flash'), { once: true });
  }

  const remaining = candidates.length - 1;
  if (remaining === 0) {
    showPlayMessage('Puzzle complete! ✓', 'success');
  } else {
    showPlayMessage(`Hint: (${r+1},${c+1}) = ${hintGrid[r][c]}. ${remaining} cell${remaining !== 1 ? 's' : ''} left.`, 'info');
  }
});

// ── Reveal all (play mode) ────────────────────────────────────────────────
revealBtn.addEventListener('click', () => {
  if (!hintGrid) return;
  for (let r = 0; r < gridSize; r++)
    for (let c = 0; c < gridSize; c++)
      userGrid[r][c] = hintGrid[r][c];
  hintedCells = new Set();
  solvedGrid = hintGrid;
  renderGrid();
  updatePlayProgress();
  showPlayMessage('Full solution revealed.', 'success');
});

// ── Clear answers (play mode) ─────────────────────────────────────────────
clearPlayBtn.addEventListener('click', () => {
  userGrid = Array.from({ length: gridSize }, () => new Array(gridSize).fill(0));
  hintedCells = new Set();
  solvedGrid = null;
  renderGrid();
  updatePlayProgress();
  showPlayMessage('', '');
});

// ═══════════════════════════════════════════════
// GRID BUILDING & EVENTS
// ═══════════════════════════════════════════════

function buildGrid() {
  gridEl.innerHTML = '';
  const maxGridPx = Math.min(480, window.innerWidth - 340 - 80);
  const cellSize  = Math.max(44, Math.floor(maxGridPx / gridSize));

  gridEl.style.gridTemplateColumns = `repeat(${gridSize}, ${cellSize}px)`;
  gridEl.style.gridTemplateRows    = `repeat(${gridSize}, ${cellSize}px)`;

  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.r = r;
      cell.dataset.c = c;
      cell.style.width  = cellSize + 'px';
      cell.style.height = cellSize + 'px';

      const labelSpan = document.createElement('span');
      labelSpan.className = 'cell-cage-label';
      labelSpan.style.fontSize = Math.max(8, Math.floor(cellSize * 0.22)) + 'px';
      cell.appendChild(labelSpan);

      const valSpan = document.createElement('span');
      valSpan.className = 'cell-value';
      valSpan.style.fontSize = Math.max(14, Math.floor(cellSize * 0.44)) + 'px';
      cell.appendChild(valSpan);

      gridEl.appendChild(cell);
    }
  }

  attachGridEvents();
  renderGrid();
}

// ── Drag-to-select (pointer events — works for mouse AND touch) ───────────
function attachGridEvents() {
  // Use pointer events for unified mouse/touch handling
  gridEl.addEventListener('pointerdown', onPointerDown);
  gridEl.addEventListener('pointermove', onPointerMove);
  // pointerup/cancel on window so dragging outside grid still ends cleanly
  window.addEventListener('pointerup',     onPointerUp);
  window.addEventListener('pointercancel', onPointerUp);
}

function cellFromPoint(x, y) {
  const el = document.elementFromPoint(x, y);
  if (!el) return null;
  const cell = el.closest('.cell');
  if (!cell || !gridEl.contains(cell)) return null;
  return cell;
}

function onPointerDown(e) {
  if (appMode === 'play') {
    // In play mode: clicking focuses a cell for keyboard input
    const cell = e.target.closest('.cell');
    if (cell) setFocusedCell(parseInt(cell.dataset.r), parseInt(cell.dataset.c));
    return;
  }

  // Build mode drag selection
  e.preventDefault();
  isDragging = true;
  gridEl.setPointerCapture(e.pointerId);

  const cell = e.target.closest('.cell');
  if (!cell) return;
  const r = parseInt(cell.dataset.r);
  const c = parseInt(cell.dataset.c);
  toggleSelect(r, c);
  renderGrid();
}

function onPointerMove(e) {
  if (!isDragging || appMode !== 'build') return;
  e.preventDefault();
  const cell = cellFromPoint(e.clientX, e.clientY);
  if (!cell) return;
  const r = parseInt(cell.dataset.r);
  const c = parseInt(cell.dataset.c);
  const key = `${r},${c}`;
  if (!selectedCells.has(key)) {
    // Only add during drag (don't deselect)
    if (!cellInAnyCage(r, c)) {
      selectedCells.add(key);
      renderGrid();
    }
  }
}

function onPointerUp() {
  isDragging = false;
}

function toggleSelect(r, c) {
  if (cellInAnyCage(r, c)) return;
  const key = `${r},${c}`;
  if (selectedCells.has(key)) selectedCells.delete(key);
  else selectedCells.add(key);
}

function cellInAnyCage(r, c) {
  return cages.some(cage => cage.cells.some(([cr, cc]) => cr === r && cc === c));
}

// ── Play mode: focused cell ───────────────────────────────────────────────
let focusedCell = null; // [r, c] or null

function setFocusedCell(r, c) {
  if (!hintGrid) return;
  focusedCell = [r, c];
  renderGrid();
}

function clearFocusedCell() {
  focusedCell = null;
  renderGrid();
}

// Click outside grid clears focus
document.addEventListener('pointerdown', e => {
  if (appMode !== 'play') return;
  if (!gridEl.contains(e.target)) clearFocusedCell();
});

// Keyboard handler for play mode
document.addEventListener('keydown', e => {
  if (appMode !== 'play' || !focusedCell) return;

  const [r, c] = focusedCell;

  // Arrow key navigation
  if (e.key === 'ArrowRight') { e.preventDefault(); setFocusedCell(r, Math.min(c + 1, gridSize - 1)); return; }
  if (e.key === 'ArrowLeft')  { e.preventDefault(); setFocusedCell(r, Math.max(c - 1, 0)); return; }
  if (e.key === 'ArrowDown')  { e.preventDefault(); setFocusedCell(Math.min(r + 1, gridSize - 1), c); return; }
  if (e.key === 'ArrowUp')    { e.preventDefault(); setFocusedCell(Math.max(r - 1, 0), c); return; }

  // Don't allow editing hinted cells
  if (hintedCells.has(`${r},${c}`)) return;

  // Delete / Backspace clears cell
  if (e.key === 'Backspace' || e.key === 'Delete') {
    e.preventDefault();
    userGrid[r][c] = 0;
    renderGrid();
    updatePlayProgress();
    return;
  }

  // Number keys 1..N
  const num = parseInt(e.key);
  if (!isNaN(num) && num >= 1 && num <= gridSize) {
    e.preventDefault();
    userGrid[r][c] = num;
    renderGrid();
    updatePlayProgress();
    checkPlayComplete();
    // Auto-advance: move right, wrap to next row
    if (c < gridSize - 1) setFocusedCell(r, c + 1);
    else if (r < gridSize - 1) setFocusedCell(r + 1, 0);
  }
});

function checkPlayComplete() {
  if (!hintGrid) return;
  for (let r = 0; r < gridSize; r++)
    for (let c = 0; c < gridSize; c++)
      if (userGrid[r][c] !== hintGrid[r][c]) return;
  showPlayMessage('Puzzle complete! ✓', 'success');
}

function updatePlayProgress() {
  const total = gridSize * gridSize;
  let filled = 0;
  for (let r = 0; r < gridSize; r++)
    for (let c = 0; c < gridSize; c++)
      if (userGrid[r][c] > 0) filled++;
  const pct = total > 0 ? Math.round((filled / total) * 100) : 0;
  progressBar.style.width = pct + '%';
  progressLabel.textContent = `${filled} / ${total} cells filled`;
}

// ═══════════════════════════════════════════════
// RENDER
// ═══════════════════════════════════════════════

function renderGrid() {
  // Clear all dynamic state
  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      const cell = getCell(r, c);
      if (!cell) continue;
      // Preserve hint-flash animation class if present
      const hasFlash = cell.classList.contains('hint-flash');
      cell.className = 'cell';
      if (hasFlash) cell.classList.add('hint-flash');
      cell.style.removeProperty('--cell-cage-border');
      cell.querySelector('.cell-cage-label').textContent = '';
      cell.querySelector('.cell-cage-label').style.color = '';
      const valEl = cell.querySelector('.cell-value');
      valEl.textContent = '';
      valEl.className = 'cell-value';
    }
  }

  // Draw cages
  cages.forEach(cage => {
    const cageSet = new Set(cage.cells.map(([r, c]) => `${r},${c}`));
    const topLeft = cage.cells.reduce((best, [r, c]) =>
      (r < best[0] || (r === best[0] && c < best[1])) ? [r, c] : best
    , cage.cells[0]);

    cage.cells.forEach(([r, c]) => {
      const cell = getCell(r, c);
      if (!cell) return;
      cell.style.setProperty('--cell-cage-border', cage.color);
      if (!cageSet.has(`${r-1},${c}`)) cell.classList.add('cage-border-top');
      if (!cageSet.has(`${r+1},${c}`)) cell.classList.add('cage-border-bottom');
      if (!cageSet.has(`${r},${c-1}`)) cell.classList.add('cage-border-left');
      if (!cageSet.has(`${r},${c+1}`)) cell.classList.add('cage-border-right');
      if (r === topLeft[0] && c === topLeft[1]) {
        const labelEl = cell.querySelector('.cell-cage-label');
        labelEl.textContent = `${cage.target}${cage.op}`;
        labelEl.style.color = cage.color;
      }
    });
  });

  if (appMode === 'build') {
    // Draw solved values (build mode)
    if (solvedGrid) {
      for (let r = 0; r < gridSize; r++) {
        for (let c = 0; c < gridSize; c++) {
          const cell = getCell(r, c);
          if (!cell || !solvedGrid[r][c]) continue;
          cell.classList.add('solved');
          cell.querySelector('.cell-value').textContent = solvedGrid[r][c];
        }
      }
    }
    // Draw selection
    for (const key of selectedCells) {
      const [r, c] = key.split(',').map(Number);
      const cell = getCell(r, c);
      if (cell) cell.classList.add('selected');
    }

  } else {
    // Play mode: draw user values
    gridEl.classList.add('play-mode');
    for (let r = 0; r < gridSize; r++) {
      for (let c = 0; c < gridSize; c++) {
        const cell = getCell(r, c);
        if (!cell) continue;
        const val = userGrid[r][c];
        const valEl = cell.querySelector('.cell-value');
        if (val > 0) {
          valEl.textContent = val;
          const isHint = hintedCells.has(`${r},${c}`);
          valEl.className = 'cell-value' + (isHint ? '' : ' user-value');
          // Mark wrong values
          if (hintGrid && val !== hintGrid[r][c]) {
            valEl.style.color = 'var(--red)';
          }
        } else {
          cell.classList.add('play-empty');
        }
        // Focused cell highlight
        if (focusedCell && focusedCell[0] === r && focusedCell[1] === c) {
          cell.classList.add('cell-focused');
        }
      }
    }
  }
}

// ── Render cage list ──────────────────────────────────────────────────────
function renderCageList() {
  cageCountEl.textContent = cages.length;
  if (cages.length === 0) {
    cageListEl.innerHTML = '<li class="cage-list-empty">No cages added yet.</li>';
    return;
  }
  cageListEl.innerHTML = '';
  cages.forEach((cage, idx) => {
    const li = document.createElement('li');
    li.className = 'cage-item';
    li.style.setProperty('--cage-color', cage.color);
    li.style.borderLeftColor = cage.color;

    const label = document.createElement('span');
    label.className = 'cage-item-label';
    label.style.color = cage.color;
    label.textContent = `${cage.target}${cage.op}`;

    const cells = document.createElement('span');
    cells.className = 'cage-item-cells';
    cells.textContent = cage.cells.map(([r, c]) => `(${r+1},${c+1})`).join(' ');

    const del = document.createElement('button');
    del.className = 'cage-item-del';
    del.textContent = '×';
    del.title = 'Remove cage';
    del.addEventListener('click', e => {
      e.stopPropagation();
      cages.splice(idx, 1);
      solvedGrid = null;
      hintGrid = null;
      renderGrid();
      renderCageList();
    });

    li.appendChild(label);
    li.appendChild(cells);
    li.appendChild(del);
    cageListEl.appendChild(li);
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────
function getCell(r, c) {
  return gridEl.querySelector(`.cell[data-r="${r}"][data-c="${c}"]`);
}

function showMessage(text, type) {
  solveMsg.textContent = text;
  solveMsg.className = 'solve-message';
  if (type) solveMsg.classList.add(type);
}

function showPlayMessage(text, type) {
  playMsg.textContent = text;
  playMsg.className = 'solve-message';
  if (type) playMsg.classList.add(type);
}

// Rebuild grid on window resize
let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(buildGrid, 200);
});
