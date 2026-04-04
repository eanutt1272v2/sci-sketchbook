p5.disableFriendlyErrors = true;

let appcore;
let colourMaps, font;

function createReadbackOptimisedCanvas(widthPx, heightPx) {
  const canvasEl = document.createElement("canvas");
  try {
    canvasEl.getContext("2d", { willReadFrequently: true });
  } catch {
    canvasEl.getContext("2d");
  }
  return createCanvas(widthPx, heightPx, canvasEl);
}

function disposeAppCore() {
  if (!appcore || typeof appcore.dispose !== "function") return;
  appcore.dispose();
  appcore = null;
}

const metadata = {
  name: "Psi",
  version: "v2.9.5-dev",
  author: "@eanutt1272.v2",
};

async function setup() {
  try {
    const [loadedFont, loadedColourMaps] = await Promise.all([
      loadFont("../../_shared/fonts/Iosevka-Regular.ttf"),
      loadJSON("../../_shared/data/colour-maps.json"),
    ]);

    font = loadedFont;
    colourMaps = loadedColourMaps;
  } catch (error) {
    console.error("[Psi] Failed to load startup assets:", error);
    return;
  }

  const canvasSize = min(windowWidth, windowHeight);
  const mainCanvas = createReadbackOptimisedCanvas(canvasSize, canvasSize);

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

  if (typeof KeyboardUtils?.installCanvasFocusBridge === "function") {
    KeyboardUtils.installCanvasFocusBridge(canvasEl);
  }

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
  return appcore ? appcore.handleKeyPressed(keyValue, keyCode, event) : false;
}

function keyReleased(event) {
  const keyValue = KeyboardUtils.normaliseKey(key || event?.key);
  return appcore ? appcore.handleKeyReleased(keyValue, keyCode, event) : false;
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
