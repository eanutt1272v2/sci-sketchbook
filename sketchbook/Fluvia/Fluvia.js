p5.disableFriendlyErrors = true;

let appcore;
let vertShader, fragShader, colourMaps, font;
let mainCanvas;

const diagnosticsLogger =
  typeof AppDiagnostics !== "undefined" &&
  typeof AppDiagnostics.resolveLogger === "function"
    ? AppDiagnostics.resolveLogger("Fluvia")
    : { info() {}, warn() {}, error() {}, debug() {} };

if (
  typeof AppDiagnostics !== "undefined" &&
  typeof AppDiagnostics.installGlobalErrorHandlers === "function"
) {
  AppDiagnostics.installGlobalErrorHandlers("Fluvia", {
    logger: diagnosticsLogger,
  });
}

function disposeAppCore() {
  if (!appcore || typeof appcore.dispose !== "function") return;
  appcore.dispose();
  appcore = null;
}

const metadata = {
  name: "Fluvia",
  version: "v5.4.7-dev",
  author: "@eanutt1272.v2",
};

function createReadbackOptimisedCanvas(widthPx, heightPx) {
  const canvasEl = document.createElement("canvas");
  try {
    canvasEl.getContext("2d", { willReadFrequently: true });
  } catch {
    canvasEl.getContext("2d");
  }
  return createCanvas(widthPx, heightPx, canvasEl);
}

async function setup() {
  try {
    const [loadedFont, loadedColourMaps, loadedVertLines, loadedFragLines] =
      await Promise.all([
        loadFont("../../_shared/fonts/Iosevka-Regular.ttf"),
        loadJSON("../../_shared/data/colour-maps.json"),
        loadStrings("../../_shared/shaders/vert.glsl"),
        loadStrings("../../_shared/shaders/frag.glsl"),
      ]);

    font = loadedFont;
    colourMaps = loadedColourMaps;
    vertShader = Array.isArray(loadedVertLines)
      ? loadedVertLines.join("\n")
      : "";
    fragShader = Array.isArray(loadedFragLines)
      ? loadedFragLines.join("\n")
      : "";
  } catch (error) {
    diagnosticsLogger.error("Failed to load startup assets:", error);
    return;
  }

  const canvasSize = min(windowWidth, windowHeight);
  mainCanvas = createReadbackOptimisedCanvas(canvasSize, canvasSize);

  setupCanvasProperties(mainCanvas);

  requestAnimationFrame(() => {
    disposeAppCore();
    try {
      appcore = new AppCore({
        metadata,
        vertShader,
        fragShader,
        colourMaps,
        font,
      });
    } catch (error) {
      diagnosticsLogger.error("Failed to initialise AppCore:", error);
      disposeAppCore();
    }
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

function mousePressed(event) {
  return appcore ? appcore.handlePointerStart(event) : false;
}

function mouseReleased(event) {
  return appcore ? appcore.handlePointerEnd(event) : false;
}

function touchStarted(event) {
  return appcore ? appcore.handlePointerStart(event) : false;
}

function touchMoved(event) {
  return appcore ? appcore.handlePointer(event) : false;
}

function touchEnded(event) {
  return appcore ? appcore.handlePointerEnd(event) : false;
}
