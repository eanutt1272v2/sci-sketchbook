class CellTracker {
  constructor() {
    this.population = 0;
    this.frameCounter = 0;
    this.history = [];
  }

  update(particles, grid) {
    this.frameCounter++;
    if (this.frameCounter % Config.CELLS_INTERVAL === 0) {
      this.population = this.computeCells(particles, grid);
    }

    this.history.push(this.population);
    if (this.history.length > width) {
      this.history.shift();
    }
  }

  getPopulation() {
    return this.population;
  }

  getHistory() {
    return this.history;
  }

  computeCells(particles, grid) {
    let count = 0;
    for (const p of particles) {
      if (p.isHighDensity() && !p.isVisited()) {
        this.floodFill(p, grid);
        count++;
      }
    }
    for (const p of particles) {
      p.markUnvisited();
    }
    return count;
  }

  floodFill(seed, grid) {
    const stack = [];
    seed.markVisited();
    stack.push(seed);

    while (stack.length > 0) {
      const current = stack.pop();

      for (let i = -1; i <= 1; i++) {
        for (let j = -1; j <= 1; j++) {
          const nx = current.gridX + i;
          const ny = current.gridY + j;

          for (const neighbour of grid.getCell(nx, ny)) {
            if (!neighbour.isVisited() && neighbour.isHighDensity()) {
              const dx = this.wrapDistance(neighbour.x - current.x, width);
              const dy = this.wrapDistance(neighbour.y - current.y, height);

              if (dx * dx + dy * dy <= current.getRadiusSquared()) {
                neighbour.markVisited();
                stack.push(neighbour);
              }
            }
          }
        }
      }
    }
  }

  wrapDistance(d, dim) {
    if (d > dim / 2) {
      return d - dim;
    }
    if (d < -dim / 2) {
      return d + dim;
    }
    return d;
  }
}