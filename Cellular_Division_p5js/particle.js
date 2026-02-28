
/**
 * @file particle.js
 * @author @eanutt1272.v2
 * @version 1.0.0
 */
class Particle {
  constructor(idx) {
    this.x = random(width);
    this.y = random(height);
    this.phi = random(TWO_PI);
    this.phiSin = sin(this.phi);
    this.phiCos = cos(this.phi);
    this.speciesIdx = idx % 1; // Single species for now
    this.visited = false;
    this.N = 0;
    this.L = 0;
    this.R = 0;
    this.N_small = 0;
    this.highDensity = false;
  }

  /**
   * Counts neighbours in detection radius
   * Splits count into left/right based on facing direction
   * Uses spatial grid for O(n) complexity instead of O(n²)
   */
  countNeighbours() {
    this.N = this.L = this.R = this.N_small = 0;
    const gx = floor(this.x / params.gridSize);
    const gy = floor(this.y / params.gridSize);

    // Check 3x3 grid neighbourhood
    for (let i = -1; i <= 1; i++) {
      for (let j = -1; j <= 1; j++) {
        const nx = (gx + i + cols) % cols;
        const ny = (gy + j + rows) % rows;

        for (const q of grid[nx][ny]) {
          if (q === this) continue;

          // Handle toroidal wrapping for distance calculation
          let dx = q.x - this.x;
          let dy = q.y - this.y;
          if (dx > width / 2) dx -= width;
          if (dx < -width / 2) dx += width;
          if (dy > height / 2) dy -= height;
          if (dy < -height / 2) dy += height;

          const d2 = dx * dx + dy * dy;

          if (d2 <= species.r2) {
            // Determine if neighbour is on left or right side
            if (dx * this.phiSin - dy * this.phiCos > 0) {
              this.L++;
            } else {
              this.R++;
            }
            this.N++;
          }

          // Count very close neighbours (within 3.9 units)
          if (d2 <= 15.21) {
            // 3.9²
            this.N_small++;
          }
        }
      }
    }
  }

  /**
   * Updates particle orientation and position
   * Turn rate depends on neighbour asymmetry (L vs R)
   */
  move() {
    // Calculate turning angle based on neighbour distribution
    const turn =
      species.alphaRad +
      species.betaRad *
        this.N *
        (this.R > this.L ? 1 : this.R < this.L ? -1 : 0);

    this.phi = (this.phi + turn) % TWO_PI;
    this.phiSin = sin(this.phi);
    this.phiCos = cos(this.phi);

    // Update position with toroidal boundary conditions
    this.x = (this.x + species.v * this.phiCos + width) % width;
    this.y = (this.y + species.v * this.phiSin + height) % height;
  }

  /**
   * Renders particle with colour based on neighbour density
   * Colour indicates lifecycle stage (nutrient/spore/membrane/nucleus)
   */
  display() {
    colorMode(RGB, 255);
    strokeWeight(1);

    if (params.colourless) {
      stroke(255);
    } else {
      // Colour coding based on density thresholds
      if (this.N_small > 15) {
        stroke(255, 0, 255); // Magenta - matured spores
      } else if (this.N > 15 && this.N <= 35) {
        stroke(0, 0, 255); // Blue - cell membrane
      } else if (this.N > 35) {
        stroke(255, 255, 0); // Yellow - cell nuclei
      } else if (this.N >= 13 && this.N <= 15) {
        stroke(139, 69, 19); // Brown - premature spores
      } else {
        stroke(0, 255, 0); // Green - nutrients
      }
    }
    point(this.x, this.y);
  }
}
