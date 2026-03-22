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
  version: "v2.8.1-dev",
  author: "@eanutt1272.v2",
};

let appcore;
let font;
let mainCanvas;

function disposeAppCore() {
  if (!appcore || typeof appcore.dispose !== "function") return;
  appcore.dispose();
  appcore = null;
}

function preload() {
  font = loadFont("../../_shared/fonts/Iosevka-Regular.ttf");
}

function setup() {
  const canvasSize = min(windowWidth, windowHeight);
  mainCanvas = createCanvas(canvasSize, canvasSize);
  setupCanvasProperties(mainCanvas);

  requestAnimationFrame(() => {
    disposeAppCore();
    appcore = new AppCore({ metadata });
  });
}

window.addEventListener("pagehide", disposeAppCore);

function setupCanvasProperties(canvas) {
  const canvasEl = canvas.elt;

  canvasEl.setAttribute("tabindex", "0");
  setTimeout(() => {
    canvasEl.focus();
  }, 100);

  noSmooth();
  textFont(font || "monospace");
  pixelDensity(1);
  frameRate(60);
}

function draw() {
  if (!appcore) return;
  appcore.update();
  appcore.render();
}

function keyPressed() {
  if (!appcore) return;
  appcore.onKeyPressed();
}

function windowResized() {
  if (!appcore) return;
  appcore.windowResized();
}