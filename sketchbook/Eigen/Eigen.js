p5.disableFriendlyErrors = true;

let appcore;
let colourMaps, font;

const metadata = {
  name: "Eigen",
  version: "v2.3.3-dev",
  author: "@eanutt1272.v2",
};

function preload() {
  font = loadFont("JetBrainsMono-Regular.ttf");
  colourMaps = loadJSON("colour-maps.json");
}

function setup() {
  const canvasSize = min(windowWidth, windowHeight);
  const mainCanvas = createCanvas(canvasSize, canvasSize);

  setupCanvasProperties(mainCanvas);

  appcore = new AppCore({
    metadata,
    colourMaps,
    font,
  });
}

function setupCanvasProperties(canvas) {
  const canvasEl = canvas.elt;

  canvasEl.setAttribute("tabindex", "0");
  setTimeout(() => {
    canvasEl.focus();
  }, 100);

  textFont(font);
  pixelDensity(1);
  frameRate(60);
}

function draw() {
  if (!appcore) return;
  appcore.update();
  appcore.draw();
}

function windowResized() {
  if (!appcore) return;
  appcore.resize();
}
function keyPressed() { return appcore ? appcore.handleKeyPressed(key, keyCode) : false; }
function keyReleased() { return appcore ? appcore.handleKeyReleased(key, keyCode) : false; }
function mouseWheel(event) { return appcore ? appcore.handleWheel(event) : false; }
function mouseDragged(event) { return appcore ? appcore.handlePointer(event) : false; }
function mouseReleased(event) { return appcore ? appcore.handlePointerEnd(event) : false; }
function touchStarted(event) { return appcore ? appcore.handlePointer(event) : false; }
function touchMoved(event) { return appcore ? appcore.handlePointer(event) : false; }
function touchEnded(event) { return appcore ? appcore.handlePointerEnd(event) : false; }
