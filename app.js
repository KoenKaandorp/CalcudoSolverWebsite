/**
 * app.js — Calcudo Solver UI
 */

// ── Palette of cage colors ────────────────────────────────────────────────
const CAGE_COLORS = [
  '#e8a832', // amber
  '#5cb87a', // green
  '#5f9be8', // blue
  '#c07ae8', // purple
  '#e87a5f', // coral
  '#5fc8c8', // teal
  '#e8d85f', // yellow
  '#e8905f', // orange
  '#9be85f', // lime
  '#e85f9b', // pink
];

// ── State ─────────────────────────────────────────────────────────────────
let gridSize = 3;
let selectedCells = new Set(); // "r,c" strings
let cages = [];      // { cells: [[r,c],...], op, target, color }
let currentOp = '+';
let solvedGrid = null;

// ── DOM refs ──────────────────────────────────────────────────────────────
const gridEl       = document.getElementById('calcudo-grid');
const cageListEl   = document.getElementById('cage-list');
const cageCountEl  = document.getElementById('cage-count');
const solveBtn     = document.getElementById('btn-solve');
const resetBtn     = document.getElementById('btn-reset');
const addCageBtn   = document.getElementById('btn-add-cage');
const clearSelBtn  = document.getElementById('btn-clear-selection');
const targetInput  = document.getElementById('cage-target');
const solveMsg     = document.getElementById('solve-message');

// ── Init ──────────────────────────────────────────────────────────────────
buildGrid();

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
  if (selectedCells.size === 0) {
    showMessage('Select at least one cell first.', 'error');
    return;
  }
  const target = parseInt(targetInput.value);
  if (isNaN(target) || target < 1) {
    showMessage('Enter a valid target number.', 'error');
    return;
  }

  // Validate: cells not already in a cage
  for (const key of selectedCells) {
    const [r, c] = key.split(',').map(Number);
    const conflict = cages.find(cage =>
      cage.cells.some(([cr, cc]) => cr === r && cc === c)
    );
    if (conflict) {
      showMessage(`Cell (${r+1},${c+1}) already belongs to a cage.`, 'error');
      return;
    }
  }

  // Validate single-cell cages with −/÷ make no sense
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

// ── Solve ─────────────────────────────────────────────────────────────────
solveBtn.addEventListener('click', () => {
  showMessage('', '');

  // Check all cells are covered
  const covered = new Set();
  cages.forEach(cage => cage.cells.forEach(([r, c]) => covered.add(`${r},${c}`)));
  const total = gridSize * gridSize;
  if (covered.size < total) {
    showMessage(`${total - covered.size} cell(s) not assigned to any cage.`, 'error');
    return;
  }

  showMessage('Solving…', 'info');
  solveBtn.disabled = true;

  // Run solver asynchronously so the UI can update
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

// ── Reset ─────────────────────────────────────────────────────────────────
resetBtn.addEventListener('click', () => {
  cages = [];
  selectedCells = new Set();
  solvedGrid = null;
  renderGrid();
  renderCageList();
  showMessage('', '');
});

// ── Build grid ────────────────────────────────────────────────────────────
function buildGrid() {
  gridEl.innerHTML = '';
  // Dynamic cell size based on grid size
  const maxGridPx = Math.min(480, window.innerWidth - 340 - 80);
  const cellSize = Math.floor(maxGridPx / gridSize);

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

      // cage label span
      const labelSpan = document.createElement('span');
      labelSpan.className = 'cell-cage-label';
      const labelSize = Math.max(8, Math.floor(cellSize * 0.22));
      labelSpan.style.fontSize = labelSize + 'px';
      cell.appendChild(labelSpan);

      // value span
      const valSpan = document.createElement('span');
      valSpan.className = 'cell-value';
      const valSize = Math.max(14, Math.floor(cellSize * 0.44));
      valSpan.style.fontSize = valSize + 'px';
      cell.appendChild(valSpan);

      cell.addEventListener('click', () => onCellClick(r, c));
      gridEl.appendChild(cell);
    }
  }

  renderGrid();
}

// ── Cell click ────────────────────────────────────────────────────────────
function onCellClick(r, c) {
  const key = `${r},${c}`;

  // If cell belongs to an existing cage, don't allow selection
  const existingCage = cages.findIndex(cage =>
    cage.cells.some(([cr, cc]) => cr === r && cc === c)
  );
  if (existingCage !== -1) {
    // Clicking an existing cage cell — ignore (or could allow cage removal)
    return;
  }

  if (selectedCells.has(key)) {
    selectedCells.delete(key);
  } else {
    selectedCells.add(key);
  }
  renderGrid();
}

// ── Render grid ───────────────────────────────────────────────────────────
function renderGrid() {
  // Clear all dynamic state
  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      const cell = getCell(r, c);
      if (!cell) continue;
      cell.className = 'cell';
      cell.style.removeProperty('--cell-cage-border');
      cell.querySelector('.cell-cage-label').textContent = '';
      cell.querySelector('.cell-cage-label').style.color = '';
      cell.querySelector('.cell-value').textContent = '';
    }
  }

  // Draw cages
  cages.forEach(cage => {
    const cageSet = new Set(cage.cells.map(([r, c]) => `${r},${c}`));
    const topLeft = cage.cells.reduce((best, [r, c]) => {
      if (r < best[0] || (r === best[0] && c < best[1])) return [r, c];
      return best;
    }, cage.cells[0]);

    cage.cells.forEach(([r, c]) => {
      const cell = getCell(r, c);
      if (!cell) return;

      cell.style.setProperty('--cell-cage-border', cage.color);

      // Determine which borders are cage-boundary (adjacent cell not in cage)
      if (!cageSet.has(`${r-1},${c}`)) cell.classList.add('cage-border-top');
      if (!cageSet.has(`${r+1},${c}`)) cell.classList.add('cage-border-bottom');
      if (!cageSet.has(`${r},${c-1}`)) cell.classList.add('cage-border-left');
      if (!cageSet.has(`${r},${c+1}`)) cell.classList.add('cage-border-right');

      // Label on top-left cell of cage
      if (r === topLeft[0] && c === topLeft[1]) {
        const labelEl = cell.querySelector('.cell-cage-label');
        labelEl.textContent = `${cage.target}${cage.op}`;
        labelEl.style.color = cage.color;
      }
    });
  });

  // Draw solved values
  if (solvedGrid) {
    for (let r = 0; r < gridSize; r++) {
      for (let c = 0; c < gridSize; c++) {
        const cell = getCell(r, c);
        if (!cell) continue;
        if (solvedGrid[r][c]) {
          cell.classList.add('solved');
          cell.querySelector('.cell-value').textContent = solvedGrid[r][c];
        }
      }
    }
  }

  // Draw selection
  for (const key of selectedCells) {
    const [r, c] = key.split(',').map(Number);
    const cell = getCell(r, c);
    if (cell) cell.classList.add('selected');
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

// Rebuild grid on window resize (responsive cell sizing)
let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(buildGrid, 200);
});
