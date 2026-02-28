
/**
 * @file sketch.js
 * @author @eanutt1272.v2
 * @version 1.0.0
 */
const params = {
  numParticles: 2250,
  gridSize: 30,
  trailAlpha: 255,
  alpha: 180,
  beta: 17,
  gamma: 13.4,
  radius: 15,
  densityThreshold: 20,
  cellsInterval: 20,
  colourless: false,
};

const statistics = {
  fps: 0,
  elapsedTime: "0h 0m 0s",
  cellCount: 0,
};

let species;
let particles = [];
let grid;
let cols, rows;
let startMillis;
let cellHistory = [];
let frameCounter = 0;
let lastCellCount = 0;
let pane;
let graphCanvas;

function setup() {
  createCanvas(512, 512);
  frameRate(1000);

  species = new Species(params.alpha, params.beta, params.gamma, params.radius);

  particles = [];
  for (let i = 0; i < params.numParticles; i++) {
    particles.push(new Particle(i));
  }

  cols = ceil(width / params.gridSize);
  rows = ceil(height / params.gridSize);
  grid = new Array(cols);
  for (let i = 0; i < cols; i++) {
    grid[i] = new Array(rows);
    for (let j = 0; j < rows; j++) {
      grid[i][j] = [];
    }
  }

  background(0);
  startMillis = millis();

  initTweakpane();
}


function draw() {
  frameCounter++;

  // Draw fading trail effect
  noStroke();
  fill(0, params.trailAlpha);
  rect(0, 0, width, height);

  // Clear and repopulate spatial grid
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      grid[i][j] = [];
    }
  }

  // Assign particles to grid cells
  for (const p of particles) {
    const gx = constrain(floor(p.x / params.gridSize), 0, cols - 1);
    const gy = constrain(floor(p.y / params.gridSize), 0, rows - 1);
    grid[gx][gy].push(p);
    p.visited = false;
  }

  // Update and render all particles
  strokeWeight(2);
  for (const p of particles) {
    p.countNeighbours();
    p.highDensity = p.N >= params.densityThreshold;
    p.move();
    p.display();
  }

  // Periodically compute cell count via flood fill
  if (frameCounter % params.cellsInterval === 0) {
    lastCellCount = computeCells();
  }

  // Maintain cell history for graph
  cellHistory.push(lastCellCount);
  if (cellHistory.length > 300) {
    // Keep last 300 frames
    cellHistory.shift();
  }

  // Update stats for GUI display
  updateStats();

  // Update graph if it exists
  if (graphCanvas) {
    updateGraph();
  }
}

/**
 * Updates statistics displayed in Tweakpane
 * Calculates FPS, elapsed time, and current cell count
 */
function updateStats() {
  statistics.fps = parseFloat(frameRate().toFixed(1));

  const elapsed = floor((millis() - startMillis) / 1000);
  const seconds = elapsed % 60;
  const minutes = floor(elapsed / 60) % 60;
  const hours = floor(elapsed / 3600);
  statistics.elapsedTime = `${hours}h ${minutes}m ${seconds}s`;

  statistics.cellCount = lastCellCount;

  // Refresh pane to update monitor displays
  pane.refresh();
}

/**
 * Renders population graph onto canvas element in Tweakpane
 */
function updateGraph() {
  const ctx = graphCanvas.getContext("2d");
  const width = graphCanvas.width;
  const height = graphCanvas.height;

  // Clear canvas
  ctx.fillStyle = "rgba(0, 0, 0, 0.9)";
  ctx.fillRect(0, 0, width, height);

  if (cellHistory.length < 2) return;

  // Calculate scaling
  let maxVal = 1;
  for (const val of cellHistory) {
    maxVal = Math.max(maxVal, val);
  }

  const padding = 30;
  const graphWidth = width - padding * 2;
  const graphHeight = height - padding * 2;

  // Draw axes
  ctx.strokeStyle = "#666";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padding, padding);
  ctx.lineTo(padding, height - padding);
  ctx.lineTo(width - padding, height - padding);
  ctx.stroke();

  // Draw axis labels
  ctx.fillStyle = "#aaa";
  ctx.font = "10px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Frame Index", width / 2, height - 5);

  ctx.save();
  ctx.translate(10, height / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText("Cell Population", 0, 0);
  ctx.restore();

  // Draw scale labels
  ctx.textAlign = "right";
  ctx.fillText("0", padding - 5, height - padding + 4);
  ctx.fillText(maxVal.toString(), padding - 5, padding + 4);

  // Draw data line
  ctx.strokeStyle = "#ff3366";
  ctx.lineWidth = 2;
  ctx.beginPath();

  const hs = cellHistory.length;
  for (let i = 0; i < hs; i++) {
    const x = padding + (i / Math.max(1, hs - 1)) * graphWidth;
    const y = height - padding - (cellHistory[i] / maxVal) * graphHeight;

    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.stroke();
}

/**
 * Counts distinct cell clusters using flood fill algorithm
 * Each contiguous region of high-density particles = one cell
 */
function computeCells() {
  let count = 0;
  for (const p of particles) {
    if (p.highDensity && !p.visited) {
      floodFill(p);
      count++;
    }
  }
  // Reset visited flags for next computation
  for (const p of particles) {
    p.visited = false;
  }
  return count;
}

/**
 * Flood fill algorithm to identify connected components
 * Uses iterative approach with stack to avoid recursion limits
 */
function floodFill(seed) {
  const stack = [seed];
  seed.visited = true;

  while (stack.length > 0) {
    const cur = stack.pop();
    const gx = floor(cur.x / params.gridSize);
    const gy = floor(cur.y / params.gridSize);

    // Check all neighbouring grid cells
    for (let i = -1; i <= 1; i++) {
      for (let j = -1; j <= 1; j++) {
        const nx = (gx + i + cols) % cols;
        const ny = (gy + j + rows) % rows;

        for (const q of grid[nx][ny]) {
          if (!q.visited && q.highDensity) {
            // Check actual distance with toroidal wrapping
            let dx = q.x - cur.x;
            let dy = q.y - cur.y;
            if (dx > width / 2) dx -= width;
            if (dx < -width / 2) dx += width;
            if (dy > height / 2) dy -= height;
            if (dy < -height / 2) dy += height;

            if (dx * dx + dy * dy <= species.r2) {
              q.visited = true;
              stack.push(q);
            }
          }
        }
      }
    }
  }
}

/**
 * Initialises Tweakpane GUI with parameter controls
 * Includes stats monitoring, legend, graph, and simulation controls
 */
function initTweakpane() {
  pane = new Tweakpane.Pane({
    title: "Cellular Division v1.4",
    expanded: true,
  });

  // Statistics folder with live monitoring
  const statsFolder = pane.addFolder({ title: "Statistics", expanded: true });
  statsFolder.addBinding(statistics, "fps", {
    readonly: true,
    label: "FPS",
  });
  statsFolder.addBinding(statistics, "elapsedTime", {
    readonly: true,
    label: "Elapsed Time",
  });
  statsFolder.addBinding(statistics, "cellCount", {
    readonly: true,
    label: "Cell Population",
  });

  // Population graph
  const graphFolder = pane.addFolder({
    title: "Population Graph",
    expanded: true,
  });
  graphCanvas = document.createElement("canvas");
  graphCanvas.width = 360;
  graphCanvas.height = 200;
  graphCanvas.style.width = "100%";
  graphCanvas.style.display = "block";
  graphCanvas.style.borderRadius = "4px";
  graphFolder.element.appendChild(graphCanvas);

  // Colour legend
  const legendFolder = pane.addFolder({
    title: "Particle Legend",
    expanded: true,
  });
  const legendHTML = `
        <div class="legend-text">
          <div class="legend-item">
            <div class="legend-color" style="background: rgb(0, 255, 0);"></div>
            <span>Nutrients</span>
          </div>
          <div class="legend-item">
            <div class="legend-color" style="background: rgb(139, 69, 19);"></div>
            <span>Premature spores</span>
          </div>
          <div class="legend-item">
            <div class="legend-color" style="background: rgb(255, 0, 255);"></div>
            <span>Matured spores</span>
          </div>
          <div class="legend-item">
            <div class="legend-color" style="background: rgb(0, 0, 255);"></div>
            <span>Cell membrane</span>
          </div>
          <div class="legend-item">
            <div class="legend-color" style="background: rgb(255, 255, 0);"></div>
            <span>Cell nuclei</span>
          </div>
        </div>
      `;
  const legendDiv = document.createElement("div");
  legendDiv.innerHTML = legendHTML;
  legendFolder.element.appendChild(legendDiv);

  // Simulation parameters
  const simFolder = pane.addFolder({
    title: "Simulation Parameters",
    expanded: true,
  });
  simFolder.addBinding(params, "numParticles", {
    min: 100,
    max: 10000,
    step: 50,
    label: "Particles",
  });
  simFolder.addBinding(params, "alpha", {
    min: 0,
    max: 360,
    step: 1,
    label: "Alpha (°)",
  });
  simFolder.addBinding(params, "beta", {
    min: 0,
    max: 50,
    step: 0.1,
    label: "Beta",
  });
  simFolder.addBinding(params, "gamma", {
    min: 0,
    max: 50,
    step: 0.1,
    label: "Gamma",
  });
  simFolder.addBinding(params, "radius", {
    min: 5,
    max: 50,
    step: 0.5,
    label: "Radius",
  });

  // Visual settings
  const visualFolder = pane.addFolder({ title: "Visual Settings" });
  visualFolder.addBinding(params, "trailAlpha", {
    min: 0,
    max: 255,
    step: 1,
    label: "Trail Fade",
  });
  visualFolder.addBinding(params, "colourless", {
    label: "Greyscale Mode",
  });

  // Advanced settings
  const advancedFolder = pane.addFolder({ title: "Advanced" });
  advancedFolder.addBinding(params, "gridSize", {
    min: 10,
    max: 100,
    step: 5,
    label: "Grid Size",
  });
  advancedFolder.addBinding(params, "densityThreshold", {
    min: 1,
    max: 50,
    step: 1,
    label: "Density Threshold",
  });
  advancedFolder.addBinding(params, "cellsInterval", {
    min: 1,
    max: 100,
    step: 1,
    label: "Count Interval",
  });

  // Info section
  const infoFolder = pane.addFolder({ title: "About" });
  const infoHTML = `
        <div class="legend-text" style="font-size: 10px;">
          <p style="margin: 4px 0;"><strong>Cellular Division v1.4</strong></p>
          <p style="margin: 4px 0;">Blackwell Labs</p>
          <p style="margin: 4px 0;">Software by @eanutt1272.v2</p>
          <p style="margin: 4px 0;">(223184 CAMVC)</p>
          <p style="margin: 8px 0 4px 0; font-size: 9px;">
            <a href="https://www.github.com/notzen3264/Cellular_Division" 
               target="_blank" 
               style="color: #6af; text-decoration: none;">
              GitHub Repository
            </a>
          </p>
        </div>
      `;
  const infoDiv = document.createElement("div");
  infoDiv.innerHTML = infoHTML;
  infoFolder.element.appendChild(infoDiv);

  // Reset button triggers full simulation reinitialisation
  pane.addButton({ title: "Reset Simulation" }).on("click", () => {
    particles = [];
    for (let i = 0; i < params.numParticles; i++) {
      particles.push(new Particle(i));
    }
    species = new Species(
      params.alpha,
      params.beta,
      params.gamma,
      params.radius
    );
    cellHistory = [];
    frameCounter = 0;
    startMillis = millis();
  });

  // Update species parameters when relevant params change
  pane.on("change", (ev) => {
    if (["alpha", "beta", "gamma", "radius"].includes(ev.presetKey)) {
      species = new Species(
        params.alpha,
        params.beta,
        params.gamma,
        params.radius
      );
    }
  });
}