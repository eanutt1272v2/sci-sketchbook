

let appcore;
let monoFont;

const metadata = {
  name: "Burning Ship",
  version: "v3.0.0",
  author: "@eanutt1272.v2",
};

function preload() {
  monoFont = loadFont("monaco.ttf");
}

function setup() {
  const canvasSize = min(windowWidth, windowHeight);
  createCanvas(canvasSize, canvasSize);
  textFont(monoFont);
  pixelDensity(1);
  appcore = new AppCore();
  appcore.setup();
}

function windowResized() {
  const canvasSize = min(windowWidth, windowHeight);
  resizeCanvas(canvasSize, canvasSize);

  if (appcore !== null) {
    appcore.renderer.buffer = createGraphics(width, height);
    appcore.renderer.buffer.pixelDensity(1);
    appcore.panel = new UIPanel(appcore);
    appcore.needsRedraw = true;
  }
}

function draw() { appcore.draw();}
function mousePressed() { appcore.input.onMousePressed(); return false; }
function mouseReleased() { appcore.input.onMouseReleased(); return false; }
function mouseDragged() { appcore.input.onMouseDragged(); return false; }
function touchStarted() { appcore.input.onTouchStarted(); return false; }
function touchEnded() { appcore.input.onTouchEnded(); return false; }
function touchMoved() { appcore.input.onTouchMoved(); return false; }
function mouseWheel(event) { appcore.input.onMouseWheel(event); return false; }
function keyPressed() { appcore.input.onKeyPressed(); return false; }
function keyReleased() { appcore.input.onKeyReleased(); return false; }