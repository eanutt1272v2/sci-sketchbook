p5.disableFriendlyErrors = true;

let appcore;
let font, animalsData, animalsData3D, animalsData4D, colourMaps;
let mainCanvas;

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
  name: "Lenia ND Studio",
  version: "v2.2.2-dev",
  author: "@eanutt1272.v2",
};

async function setup() {
  try {
    const [
      loadedFont,
      loadedAnimals2D,
      loadedAnimals3D,
      loadedAnimals4D,
      loadedColourMaps,
    ] = await Promise.all([
      loadFont("../../_shared/fonts/Iosevka-Regular.ttf"),
      loadJSON("../../_shared/data/animals.json"),
      loadJSON("../../_shared/data/animals3D.json"),
      loadJSON("../../_shared/data/animals4D.json"),
      loadJSON("../../_shared/data/colour-maps.json"),
    ]);

    font = loadedFont;
    animalsData = loadedAnimals2D;
    animalsData3D = loadedAnimals3D;
    animalsData4D = loadedAnimals4D;
    colourMaps = loadedColourMaps;
  } catch (error) {
    console.error("[Lenia] Failed to load startup assets:", error);
    return;
  }

  const canvasSize = min(windowWidth, windowHeight);
  mainCanvas = createReadbackOptimisedCanvas(canvasSize, canvasSize);

  setupCanvasProperties(mainCanvas);

  requestAnimationFrame(() => {
    disposeAppCore();
    appcore = new AppCore({
      metadata,
      animalsData,
      animalsByDimension: {
        2: animalsData,
        3: animalsData3D,
        4: animalsData4D,
      },
      colourMaps,
      font,
    });

    appcore.setup();
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

  noSmooth();
  textFont(font || "monospace");
  pixelDensity(1);
  frameRate(256);
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
