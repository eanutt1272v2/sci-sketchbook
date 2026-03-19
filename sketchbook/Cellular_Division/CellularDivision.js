p5.disableFriendlyErrors = true;

const Config = {
  GRID_SIZE: 30,
  CELLS_INTERVAL: 15,
  LEFT_PANEL_WIDTH: 260,
  RIGHT_COLUMN_WIDTH: 220,
  COLUMN_GAP: 10,
  VALUE_BOX_WIDTH: 50,
  VALUE_BOX_HEIGHT: 16,
  MIN_PARTICLES: 100,
  MAX_PARTICLES: 20000,
};

const metadata = {
  name: "Cellular Division",
  version: "v2.5.8-dev",
  author: "@eanutt1272.v2",
};

let appcore;
let font;
let mainCanvas;

function preload() {
  font = loadFont("JetBrainsMono-Regular.ttf");
}

function setup() {
  mainCanvas = createCanvas(1100, 800);
  setupCanvasProperties(mainCanvas);
  appcore = new AppCore();
}

function setupCanvasProperties(canvas) {
  const canvasEl = canvas.elt;

  canvasEl.setAttribute("tabindex", "0");
  setTimeout(() => {
    canvasEl.focus();
  }, 100);

  noSmooth();
  textFont(font);
  pixelDensity(1);
  frameRate(60);
}

function draw() {
  appcore.update();
  appcore.render();
}

function keyPressed() {
  appcore.onKeyPressed();
}
