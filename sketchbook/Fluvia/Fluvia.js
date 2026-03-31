p5.disableFriendlyErrors = true;

let appcore;
let vertShader, fragShader, colourMaps, font;
let mainCanvas;

function disposeAppCore() {
  if (!appcore || typeof appcore.dispose !== "function") return;
  appcore.dispose();
  appcore = null;
}

const metadata = {
  name: "Fluvia",
  version: "v5.3.3-dev",
  author: "@eanutt1272.v2",
};

function preload() {
  font = loadFont("../../_shared/fonts/Iosevka-Regular.ttf");
  colourMaps = loadJSON("../../_shared/data/colour-maps.json");
  loadStrings(
    "../../_shared/shaders/vert.glsl",
    (lines) => (vertShader = lines.join("\n")),
  );
  loadStrings(
    "../../_shared/shaders/frag.glsl",
    (lines) => (fragShader = lines.join("\n")),
  );
}

function setup() {
  const canvasSize = min(windowWidth, windowHeight);
  mainCanvas = createCanvas(canvasSize, canvasSize);

  setupCanvasProperties(mainCanvas);

  requestAnimationFrame(() => {
    disposeAppCore();
    appcore = new AppCore({
      metadata,
      vertShader,
      fragShader,
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

  noSmooth();
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
  const keyValue = KeyboardUtils.normaliseKey(key || event?.key);
  return appcore ? appcore.handleKeyPressed(keyValue, keyCode) : false;
}

function keyReleased(event) {
  const keyValue = KeyboardUtils.normaliseKey(key || event?.key);
  return appcore ? appcore.handleKeyReleased(keyValue, keyCode) : false;
}

function mouseWheel(event) {
  return appcore ? appcore.handleWheel(event) : false;
}

function mouseDragged(event) {
  return appcore ? appcore.handlePointer(event) : false;
}

function touchStarted(event) {
  return appcore ? appcore.handlePointer(event) : false;
}

function touchMoved(event) {
  return appcore ? appcore.handlePointer(event) : false;
}

function touchEnded(event) {
  return appcore ? appcore.handlePointer(event) : false;
}
