/**
 * solver.js — Calcudo / KenKen backtracking solver
 *
 * A Calcudo puzzle is an NxN Latin square where:
 *   - Each row contains the digits 1..N exactly once.
 *   - Each column contains the digits 1..N exactly once.
 *   - Each "cage" (a connected group of cells) has an operation and a target.
 *     The values in the cage must produce the target using the operation.
 *
 * Operations:
 *   +  sum of all values equals target
 *   −  difference: largest minus the rest equals target
 *   ×  product of all values equals target
 *   ÷  quotient: largest divided by the rest equals target
 *   =  fixed value; all cells equal target
 */

/**
 * Check whether the values in `vals` satisfy the cage constraint.
 * Only called when all cells of the cage are filled.
 */
function cageCheck(vals, op, target) {
  switch (op) {
    case '+':
      return vals.reduce((a, b) => a + b, 0) === target;
    case '×':
      return vals.reduce((a, b) => a * b, 1) === target;
    case '=':
      return vals.every(v => v === target);
    case '−': {
      const sorted = [...vals].sort((a, b) => b - a);
      return sorted[0] - sorted.slice(1).reduce((a, b) => a + b, 0) === target;
    }
    case '÷': {
      const sorted = [...vals].sort((a, b) => b - a);
      const rest = sorted.slice(1).reduce((a, b) => a * b, 1);
      return rest !== 0 && sorted[0] / rest === target;
    }
    default:
      return false;
  }
}

/**
 * Partial constraint check while a cage is still being filled.
 * Returns false early if already unsatisfiable.
 */
function cagePartialCheck(vals, op, target, total, n) {
  if (vals.length === total) return cageCheck(vals, op, target);

  switch (op) {
    case '+': {
      const sum = vals.reduce((a, b) => a + b, 0);
      const remaining = total - vals.length;
      return sum + remaining <= target && sum + remaining * n >= target;
    }
    case '×': {
      const prod = vals.reduce((a, b) => a * b, 1);
      if (prod > target) return false;
      if (target % prod !== 0) return false;
      return true;
    }
    case '=':
      return vals.every(v => v === target);
    case '−':
    case '÷':
      return true;
    default:
      return true;
  }
}

/**
 * Main solver.
 * @param {number}   n      - Grid size.
 * @param {Array}    cages  - Array of { cells: [[r,c],...], op, target }
 * @param {number[][]} [fixedGrid] - Optional pre-filled values (0 = unknown).
 * @returns {number[][]|null}
 */
function solve(n, cages, fixedGrid) {
  const grid = Array.from({ length: n }, (_, r) =>
    Array.from({ length: n }, (_, c) => (fixedGrid ? fixedGrid[r][c] : 0))
  );

  const rowUsed = Array.from({ length: n }, () => new Set());
  const colUsed = Array.from({ length: n }, () => new Set());

  // Pre-fill fixed values into used sets
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (grid[r][c] > 0) {
        rowUsed[r].add(grid[r][c]);
        colUsed[c].add(grid[r][c]);
      }
    }
  }

  const cellCage = Array.from({ length: n }, () => new Array(n).fill(-1));
  cages.forEach((cage, idx) => {
    cage.cells.forEach(([r, c]) => { cellCage[r][c] = idx; });
  });

  // Only solve unfilled cells; sort by cage size for better pruning
  const cellOrder = [];
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++)
      if (grid[r][c] === 0) cellOrder.push([r, c]);

  cellOrder.sort((a, b) => {
    const sizeA = cages[cellCage[a[0]][a[1]]].cells.length;
    const sizeB = cages[cellCage[b[0]][b[1]]].cells.length;
    return sizeA - sizeB;
  });

  function getCageVals(cageIdx) {
    return cages[cageIdx].cells
      .map(([r, c]) => grid[r][c])
      .filter(v => v > 0);
  }

  let calls = 0;
  const MAX_CALLS = 5_000_000;

  function bt(idx) {
    if (calls++ > MAX_CALLS) return false;
    if (idx === cellOrder.length) return true;

    const [r, c] = cellOrder[idx];
    const cageIdx = cellCage[r][c];
    const cage = cages[cageIdx];

    for (let v = 1; v <= n; v++) {
      if (rowUsed[r].has(v)) continue;
      if (colUsed[c].has(v)) continue;

      grid[r][c] = v;
      rowUsed[r].add(v);
      colUsed[c].add(v);

      const cageVals = getCageVals(cageIdx);
      const valid = cagePartialCheck(cageVals, cage.op, cage.target, cage.cells.length, n);

      if (valid && bt(idx + 1)) return true;

      grid[r][c] = 0;
      rowUsed[r].delete(v);
      colUsed[c].delete(v);
    }
    return false;
  }

  return bt(0) ? grid : null;
}
