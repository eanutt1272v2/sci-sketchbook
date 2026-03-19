class Particle {
  constructor() {
    this.x = random(width);
    this.y = random(height);
    this.heading = random(TWO_PI);
    this.headingSin = sin(this.heading);
    this.headingCos = cos(this.heading);

    this.neighbourCount = 0;
    this.leftCount = 0;
    this.rightCount = 0;
    this.closeNeighbourCount = 0;

    this.highDensity = false;
    this.visited = false;

    this.gridX = 0;
    this.gridY = 0;

    this.radiusSquared = 0;
  }

  setGridPosition(gx, gy) {
    this.gridX = gx;
    this.gridY = gy;
  }

  countNeighbours(grid, species) {
    this.neighbourCount = 0;
    this.leftCount = 0;
    this.rightCount = 0;
    this.closeNeighbourCount = 0;
    this.radiusSquared = species.radiusSquared;

    for (let i = -1; i <= 1; i++) {
      for (let j = -1; j <= 1; j++) {
        const cell = grid.getCell(this.gridX + i, this.gridY + j);
        for (const other of cell) {
          if (other === this) {
            continue;
          }

          const dx = this.wrapDistance(other.x - this.x, width);
          const dy = this.wrapDistance(other.y - this.y, height);
          const distSq = dx * dx + dy * dy;

          if (distSq <= species.radiusSquared) {
            if (dx * this.headingSin - dy * this.headingCos > 0) {
              this.leftCount++;
            } else {
              this.rightCount++;
            }
            this.neighbourCount++;
          }

          if (distSq <= sq(3.9)) {
            this.closeNeighbourCount++;
          }
        }
      }
    }
  }

  move(species) {
    const turnDirection =
      this.rightCount > this.leftCount
        ? 1
        : this.rightCount < this.leftCount
          ? -1
          : 0;
    const turn =
      species.alphaRad + species.betaRad * this.neighbourCount * turnDirection;

    this.heading = (this.heading + turn) % TWO_PI;
    this.headingSin = sin(this.heading);
    this.headingCos = cos(this.heading);

    this.x = this.wrapCoordinate(
      this.x + species.velocity * this.headingCos,
      width,
    );
    this.y = this.wrapCoordinate(
      this.y + species.velocity * this.headingSin,
      height,
    );
  }

  display() {
    colorMode(RGB, 255);
    fill(this.getDisplayColour());
    const pRadius = 2;
    rect(this.x - pRadius / 2, this.y - pRadius / 2, pRadius, pRadius);
  }

  getDisplayColour() {
    if (this.closeNeighbourCount > 15) {
      return color(255, 80, 255);
    }
    if (this.neighbourCount > 35) {
      return color(255, 255, 100);
    }
    if (this.neighbourCount > 15) {
      return color(0, 0, 255);
    }
    if (this.neighbourCount >= 13) {
      return color(180, 100, 50);
    }
    return color(80, 255, 80);
  }

  updateHighDensity(threshold) {
    this.highDensity = this.neighbourCount >= threshold;
  }

  isHighDensity() {
    return this.highDensity;
  }

  isVisited() {
    return this.visited;
  }

  markVisited() {
    this.visited = true;
  }

  markUnvisited() {
    this.visited = false;
  }

  getRadiusSquared() {
    return this.radiusSquared;
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

  wrapCoordinate(coord, dim) {
    return (coord + dim) % dim;
  }
}
