p5.disableFriendlyErrors = true;

let appcore;
let font, animalsData, animalsData3D, animalsData4D, colourMaps;
let mainCanvas;

function disposeAppCore() {
  if (!appcore || typeof appcore.dispose !== "function") return;
  appcore.dispose();
  appcore = null;
}

const metadata = {
  name: "Lenia 2D Studio",
  version: "v1.9.1-dev",
  author: "@eanutt1272.v2",
};

function preload() {
  font = loadFont("../../_shared/fonts/Iosevka-Regular.ttf");
  animalsData = loadJSON("../../_shared/data/animals.json");

  animalsData3D = [];
  animalsData4D = [];
  loadJSON(
    "../../_shared/data/animals3D.json",
    (data) => {
      animalsData3D = data;
    },
    () => {
      animalsData3D = [];
    },
  );
  loadJSON(
    "../../_shared/data/animals4D.json",
    (data) => {
      animalsData4D = data;
    },
    () => {
      animalsData4D = [];
    },
  );

  colourMaps = loadJSON("../../_shared/data/colour-maps.json");
}

function setup() {
  const canvasSize = min(windowWidth, windowHeight);
  mainCanvas = createCanvas(canvasSize, canvasSize);

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
  frameRate(120);
}

function mouseClicked(e) {
  return appcore ? appcore.handleMouseClicked(e) : false;
}
function touchStarted(e) {
  return appcore ? appcore.handleMouseClicked(e) : false;
}
function windowResized() {
  return appcore ? appcore.windowResized() : false;
}
function keyPressed(event) {
  const keyValue = KeyboardUtils.normaliseKey(key || event?.key);
  return appcore ? appcore.handleKeyPressed(keyValue, keyCode) : false;
}
function keyReleased(event) {
  const keyValue = KeyboardUtils.normaliseKey(key || event?.key);
  return appcore ? appcore.handleKeyReleased(keyValue, keyCode) : false;
}
