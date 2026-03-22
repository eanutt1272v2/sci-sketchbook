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
  font = loadFont("../../_shared/fonts/Iosevka-Regular.ttf");
}

function setup() {
  const canvasSize = min(windowWidth, windowHeight);
  mainCanvas = createCanvas(canvasSize, canvasSize);
  setupCanvasProperties(mainCanvas);

  requestAnimationFrame(() => {
    appcore = new AppCore({ metadata });
    appcore.setup();
  });
}

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

function draw() { if (!appcore) return; appcore.render(); }
function windowResized() { if (!appcore) return; appcore.windowResized(); }
function mousePressed() { if (!appcore) return false; appcore.input.onMousePressed(); return false; }
function mouseReleased() { if (!appcore) return false; appcore.input.onMouseReleased(); return false; }
function mouseDragged() { if (!appcore) return false; appcore.input.onMouseDragged(); return false; }
function touchStarted() { if (!appcore) return false; appcore.input.onTouchStarted(); return false; }
function touchEnded() { if (!appcore) return false; appcore.input.onTouchEnded(); return false; }
function touchMoved() { if (!appcore) return false; appcore.input.onTouchMoved(); return false; }
function mouseWheel(event) { if (!appcore) return false; appcore.input.onMouseWheel(event); return false; }
function keyPressed() { if (!appcore) return false; appcore.input.onKeyPressed(); return false; }
function keyReleased() { if (!appcore) return false; appcore.input.onKeyReleased(); return false; }