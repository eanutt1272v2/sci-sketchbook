p5.disableFriendlyErrors = true;

let appcore;
let font, solitonsData, solitonsData3D, solitonsData4D, colourMaps;
let mainCanvas;

const diagnosticsLogger =
  typeof AppDiagnostics !== "undefined" &&
  typeof AppDiagnostics.resolveLogger === "function"
    ? AppDiagnostics.resolveLogger("Lenia")
    : { info() {}, warn() {}, error() {}, debug() {} };

if (
  typeof AppDiagnostics !== "undefined" &&
  typeof AppDiagnostics.installGlobalErrorHandlers === "function"
) {
  AppDiagnostics.installGlobalErrorHandlers("Lenia", {
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
      label: "Lenia AppCore initialisation",
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

const metadata = {
  name: "Lenia ND Studio",
  version: "v2.6.4-dev",
  author: "@eanutt1272.v2",
};

async function setup() {
  try {
    const [
      loadedFont,
      loadedSolitons2D,
      loadedSolitons3D,
      loadedSolitons4D,
      loadedColourMaps,
    ] = await Promise.all([
      AssetLoader.loadPreferredFont({
        family: "Iosevka",
        woff2Path: "../../_shared/fonts/Iosevka-Regular.woff2",
        ttfPath: "../../_shared/fonts/Iosevka-Regular.ttf",
        logger: diagnosticsLogger,
      }),
      AssetLoader.loadJSONAsset("../../_shared/json/solitons.json", {
        logger: diagnosticsLogger,
        label: "Lenia 2D solitons",
      }),
      AssetLoader.loadJSONAsset("../../_shared/json/solitons3D.json", {
        logger: diagnosticsLogger,
        label: "Lenia 3D solitons",
      }),
      AssetLoader.loadJSONAsset("../../_shared/json/solitons4D.json", {
        logger: diagnosticsLogger,
        label: "Lenia 4D solitons",
      }),
      AssetLoader.loadJSONAsset("../../_shared/json/colour-maps.json", {
        logger: diagnosticsLogger,
        label: "Lenia colour maps",
      }),
    ]);

    font = loadedFont;
    solitonsData = loadedSolitons2D;
    solitonsData3D = loadedSolitons3D;
    solitonsData4D = loadedSolitons4D;
    colourMaps = loadedColourMaps;
  } catch (error) {
    diagnosticsLogger.error("Failed to load startup assets:", error);
    return;
  }

  const canvasSize = min(windowWidth, windowHeight);
  mainCanvas = createReadbackOptimisedCanvas(canvasSize, canvasSize);

  setupCanvasProperties(mainCanvas);

  scheduleStartupInitialisation(() => {
    disposeAppCore();
    try {
      const nextAppCore = new AppCore({
        metadata,
        solitonsData,
        solitonsByDimension: {
          2: solitonsData,
          3: solitonsData3D,
          4: solitonsData4D,
        },
        colourMaps,
        font,
      });
      appcore = nextAppCore;

      if (nextAppCore && typeof nextAppCore.setup === "function") {
        scheduleStartupInitialisation(() => {
          try {
            nextAppCore.setup();
          } catch (error) {
            diagnosticsLogger.error("Failed to complete AppCore setup:", error);
            disposeAppCore();
          }
        });
      }
    } catch (error) {
      diagnosticsLogger.error("Failed to initialise AppCore:", error);
      disposeAppCore();
    }
  });
}

window.addEventListener("pagehide", disposeAppCore);

function draw() {
  if (!appcore) return;
  appcore.render();
}

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

function mouseClicked(event) {
  return appcore ? appcore.handleMouseClicked(event) : false;
}

function mousePressed(event) {
  return appcore ? appcore.handleMousePressed(event) : false;
}

function mouseDragged(event) {
  return appcore ? appcore.handleMouseDragged(event) : false;
}

function mouseReleased(event) {
  return appcore ? appcore.handleMouseReleased(event) : false;
}

function mouseWheel(event) {
  return appcore ? appcore.handleMouseWheel(event) : false;
}

function touchStarted(event) {
  if (!appcore) return false;
  appcore.handleMousePressed(event);
  return appcore.handleMouseClicked(event);
}

function touchMoved(event) {
  return appcore ? appcore.handleMouseDragged(event) : false;
}

function touchEnded(event) {
  return appcore ? appcore.handleMouseReleased(event) : false;
}

function windowResized() {
  return appcore ? appcore.windowResized() : false;
}

function keyPressed(event) {
  const keyValue = KeyboardUtils.normaliseKey(key || event?.key);
  return appcore ? appcore.handleKeyPressed(keyValue, keyCode, event) : false;
}

function keyReleased(event) {
  const keyValue = KeyboardUtils.normaliseKey(key || event?.key);
  return appcore ? appcore.handleKeyReleased(keyValue, keyCode, event) : false;
}
