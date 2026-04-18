# Calcudo Solver

Calcudo Solver is a browser-based application for creating and solving Calcudo.

The application allows users to define grids of varying sizes and group cells into cages with arithmetic constraints. Each puzzle follows the rules of a Latin square, where every row and column must contain unique values from 1 to N, while each cage must satisfy a specified operation and target value.

A built-in backtracking solver efficiently computes valid solutions by enforcing row, column, and cage constraints, with additional pruning to reduce the search space. The interface supports both a construction mode for designing puzzles and a play mode where users can attempt solutions with optional hints.

The project is implemented entirely in vanilla JavaScript, HTML, and CSS, with no external dependencies.
