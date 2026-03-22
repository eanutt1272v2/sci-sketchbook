class Grid {
  constructor(cellSize) {
    this.cellSize = cellSize;
    this.cols = ceil(width / this.cellSize);
    this.rows = ceil(height / this.cellSize);
    this.cells = [];

    for (let i = 0; i < this.cols; i++) {
      this.cells[i] = [];
      for (let j = 0; j < this.rows; j++) {
        this.cells[i][j] = [];
      }
    }
  }

  clear() {
    for (let i = 0; i < this.cols; i++) {
      for (let j = 0; j < this.rows; j++) {
        this.cells[i][j].length = 0;
      }
    }
  }

  add(p) {
    const gx = constrain(floor(p.x / this.cellSize), 0, this.cols - 1);
    const gy = constrain(floor(p.y / this.cellSize), 0, this.rows - 1);
    this.cells[gx][gy].push(p);
    p.setGridPosition(gx, gy);
  }

  getCell(gx, gy) {
    const wrappedX = (gx + this.cols) % this.cols;
    const wrappedY = (gy + this.rows) % this.rows;
    return this.cells[wrappedX][wrappedY];
  }

  getCols() {
    return this.cols;
  }

  getRows() {
    return this.rows;
  }
}