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
  version: "v3.0.5-dev",
  author: "@eanutt1272.v2",
};

let appcore;
let font;
let mainCanvas;

const diagnosticsLogger =
  typeof AppDiagnostics !== "undefined" &&
  typeof AppDiagnostics.resolveLogger === "function"
    ? AppDiagnostics.resolveLogger("Cellular Division")
    : { info() {}, warn() {}, error() {}, debug() {} };

if (
  typeof AppDiagnostics !== "undefined" &&
  typeof AppDiagnostics.installGlobalErrorHandlers === "function"
) {
  AppDiagnostics.installGlobalErrorHandlers("Cellular Division", {
    logger: diagnosticsLogger,
  });
}

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

function scheduleStartupInitialisation(task) {
  if (typeof task !== "function") return;

  if (
    typeof AppDiagnostics !== "undefined" &&
    typeof AppDiagnostics.scheduleFrameFriendlyTask === "function"
  ) {
    AppDiagnostics.scheduleFrameFriendlyTask(task, {
      logger: diagnosticsLogger,
      label: "Cellular Division AppCore initialisation",
      timeoutMs: 200,
      useIdle: true,
    });
    return;
  }

  if (typeof requestAnimationFrame === "function") {
    requestAnimationFrame(() => {
      setTimeout(task, 0);
    });
    return;
  }

  setTimeout(task, 0);
}

async function setup() {
  try {
    font = await AssetLoader.loadPreferredFont({
      family: "Iosevka",
      woff2Path: "../../_shared/fonts/Iosevka-Regular.woff2",
      ttfPath: "../../_shared/fonts/Iosevka-Regular.ttf",
      logger: diagnosticsLogger,
    });
  } catch (error) {
    diagnosticsLogger.error("Failed to load startup assets:", error);
    return;
  }

  mainCanvas = createReadbackOptimisedCanvas(windowWidth, windowHeight);
  setupCanvasProperties(mainCanvas);

  scheduleStartupInitialisation(() => {
    disposeAppCore();
    try {
      appcore = new AppCore({ metadata });
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
  frameRate(60);
}

function draw() {
  if (!appcore) return;
  appcore.update();
  appcore.render();
}

function keyPressed(event) {
  if (!appcore) return false;
  appcore.onKeyPressed(event);
  return false;
}

function windowResized() {
  if (!appcore) return;
  appcore.windowResized();
}
