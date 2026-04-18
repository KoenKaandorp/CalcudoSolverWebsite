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
 *   −  difference: for any ordering of values, the largest minus the rest equals target
 *   ×  product of all values equals target
 *   ÷  quotient: for any ordering of values, the largest divided by the rest equals target
 *   =  single cell (or multi-cell) fixed value; all cells equal target
 */

/**
 * Check whether the values in `vals` satisfy the cage constraint.
 * Only called when all cells of the cage are filled.
 *
 * @param {number[]} vals   - The assigned values (all > 0).
 * @param {string}   op     - '+', '−', '×', '÷', '='
 * @param {number}   target - The required result.
 * @returns {boolean}
 */
function cageCheck(vals, op, target) {
  switch (op) {
    case '+':
      return vals.reduce((a, b) => a + b, 0) === target;

    case '×':
      return vals.reduce((a, b) => a * b, 1) === target;

    case '=':
      // All values must equal target
      return vals.every(v => v === target);

    case '−': {
      // For subtraction: the maximum value minus the sum of the rest equals target.
      // This handles any number of cells gracefully.
      const sorted = [...vals].sort((a, b) => b - a);
      return sorted[0] - sorted.slice(1).reduce((a, b) => a + b, 0) === target;
    }

    case '÷': {
      // For division: the maximum value divided by the product of the rest equals target.
      // Must divide evenly.
      const sorted = [...vals].sort((a, b) => b - a);
      const rest = sorted.slice(1).reduce((a, b) => a * b, 1);
      return rest !== 0 && sorted[0] / rest === target;
    }

    default:
      return false;
  }
}

/**
 * Partial constraint check: called while a cage is still being filled.
 * Returns false early if the partially-filled cage is already unsatisfiable.
 *
 * @param {number[]} vals     - Values placed so far (no zeros).
 * @param {string}   op
 * @param {number}   target
 * @param {number}   total    - Total cells in the cage.
 * @param {number}   n        - Grid size (max digit).
 * @returns {boolean}
 */
function cagePartialCheck(vals, op, target, total, n) {
  if (vals.length === total) return cageCheck(vals, op, target);

  switch (op) {
    case '+': {
      const sum = vals.reduce((a, b) => a + b, 0);
      const remaining = total - vals.length;
      // min possible addition: remaining * 1
      // max possible addition: remaining * n
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
      // Hard to prune partially — just allow
      return true;

    default:
      return true;
  }
}

/**
 * Main solver.
 *
 * @param {number}   n      - Grid size.
 * @param {Array}    cages  - Array of { cells: [[r,c],...], op: string, target: number }
 * @returns {number[][]|null}  - Solved NxN grid, or null if unsolvable.
 */
function solve(n, cages) {
  // grid[r][c] = 0 (unfilled) or 1..n
  const grid = Array.from({ length: n }, () => new Array(n).fill(0));

  // row/col sets for fast uniqueness checks
  const rowUsed = Array.from({ length: n }, () => new Set());
  const colUsed = Array.from({ length: n }, () => new Set());

  // Map each cell to its cage index
  const cellCage = Array.from({ length: n }, () => new Array(n).fill(-1));
  cages.forEach((cage, idx) => {
    cage.cells.forEach(([r, c]) => { cellCage[r][c] = idx; });
  });

  // How many cells of each cage have been filled
  const cageFilled = new Array(cages.length).fill(0);

  // Build a flat list of cells to fill, ordered for better pruning:
  // cells that belong to smaller cages come first (tighter constraints).
  const cellOrder = [];
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++)
      cellOrder.push([r, c]);

  cellOrder.sort((a, b) => {
    const sizeA = cages[cellCage[a[0]][a[1]]].cells.length;
    const sizeB = cages[cellCage[b[0]][b[1]]].cells.length;
    return sizeA - sizeB;
  });

  // Get all current values placed in a cage
  function getCageVals(cageIdx) {
    return cages[cageIdx].cells
      .map(([r, c]) => grid[r][c])
      .filter(v => v > 0);
  }

  let calls = 0;
  const MAX_CALLS = 5_000_000;

  function bt(idx) {
    if (calls++ > MAX_CALLS) return false; // guard runaway puzzles
    if (idx === cellOrder.length) return true; // all cells placed

    const [r, c] = cellOrder[idx];
    const cageIdx = cellCage[r][c];
    const cage = cages[cageIdx];

    for (let v = 1; v <= n; v++) {
      if (rowUsed[r].has(v)) continue;
      if (colUsed[c].has(v)) continue;

      // Place
      grid[r][c] = v;
      rowUsed[r].add(v);
      colUsed[c].add(v);
      cageFilled[cageIdx]++;

      // Cage partial / full check
      const cageVals = getCageVals(cageIdx);
      const valid = cagePartialCheck(cageVals, cage.op, cage.target, cage.cells.length, n);

      if (valid) {
        if (bt(idx + 1)) return true;
      }

      // Undo
      grid[r][c] = 0;
      rowUsed[r].delete(v);
      colUsed[c].delete(v);
      cageFilled[cageIdx]--;
    }
    return false;
  }

  const success = bt(0);
  return success ? grid : null;
}
