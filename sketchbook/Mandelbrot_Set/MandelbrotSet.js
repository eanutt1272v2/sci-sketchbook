p5.disableFriendlyErrors = true;

let appcore;
let font;
let mainCanvas;

const metadata = {
  name: "Mandelbrot Set",
  version: "v3.2.0-dev",
  author: "@eanutt1272.v2",
};

function preload() {
  font = loadFont("JetBrainsMono-Regular.ttf");
}

function setup() {
  const canvasSize = min(windowWidth, windowHeight);
  mainCanvas = createCanvas(canvasSize, canvasSize);
  setupCanvasProperties(mainCanvas);
  appcore = new AppCore({ metadata });
  appcore.setup();
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

function windowResized() {
  if (appcore !== null) appcore.windowResized();
}

function draw() {
  appcore.draw();
}
function mousePressed() {
  appcore.input.onMousePressed();
  return false;
}
function mouseReleased() {
  appcore.input.onMouseReleased();
  return false;
}
function mouseDragged() {
  appcore.input.onMouseDragged();
  return false;
}
function touchStarted() {
  appcore.input.onTouchStarted();
  return false;
}
function touchEnded() {
  appcore.input.onTouchEnded();
  return false;
}
function touchMoved() {
  appcore.input.onTouchMoved();
  return false;
}
function mouseWheel(event) {
  appcore.input.onMouseWheel(event);
  return false;
}
function keyPressed() {
  appcore.input.onKeyPressed();
  return false;
}
function keyReleased() {
  appcore.input.onKeyReleased();
  return false;
}
