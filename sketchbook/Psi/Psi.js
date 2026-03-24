p5.disableFriendlyErrors = true;

let appcore;
let colourMaps, font;

function disposeAppCore() {
  if (!appcore || typeof appcore.dispose !== "function") return;
  appcore.dispose();
  appcore = null;
}

const metadata = {
  name: "Psi",
  version: "v2.7.1-dev",
  author: "@eanutt1272.v2",
};

function preload() {
  font = loadFont("../../_shared/fonts/Iosevka-Regular.ttf");
  colourMaps = loadJSON("../../_shared/data/colour-maps.json");
}

function setup() {
  const canvasSize = min(windowWidth, windowHeight);
  const mainCanvas = createCanvas(canvasSize, canvasSize);

  setupCanvasProperties(mainCanvas);

  requestAnimationFrame(() => {
    disposeAppCore();
    appcore = new AppCore({
      metadata,
      colourMaps,
      font,
    });
  });
}

window.addEventListener("pagehide", disposeAppCore);

function setupCanvasProperties(canvas) {
  const canvasEl = canvas.elt;

  canvasEl.setAttribute("tabindex", "0");
  setTimeout(() => {
    canvasEl.focus();
  }, 100);

  textFont(font || "monospace");
  pixelDensity(1);
  frameRate(120);
}

function draw() {
  if (!appcore) return;
  appcore.update();
  appcore.render();
}

function windowResized() {
  if (!appcore) return;
  appcore.resize();
}
function keyPressed(event) {
  const keyValue = KeyboardUtils.normalizeKey(key || event?.key);
  return appcore ? appcore.handleKeyPressed(keyValue, keyCode) : false;
}
function keyReleased(event) {
  const keyValue = KeyboardUtils.normalizeKey(key || event?.key);
  return appcore ? appcore.handleKeyReleased(keyValue, keyCode) : false;
}
function mouseWheel(event) {
  return appcore ? appcore.handleWheel(event) : false;
}
function mouseDragged(event) {
  return appcore ? appcore.handlePointer(event) : false;
}
function mouseReleased(event) {
  return appcore ? appcore.handlePointerEnd(event) : false;
}
function touchStarted(event) {
  return appcore ? appcore.handlePointer(event) : false;
}
function touchMoved(event) {
  return appcore ? appcore.handlePointer(event) : false;
}
function touchEnded(event) {
  return appcore ? appcore.handlePointerEnd(event) : false;
}
