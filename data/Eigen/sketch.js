
/**
 * @file sketch.js
 * @author @eanutt1272.v2
 * @version 1.0.0
 */
p5.disableFriendlyErrors = true;

let manager;
let colourMaps, font;

const metadata = {
  name: "Eigen",
  version: "v2.0.0",
  author: "@eanutt1272.v2"
};

function preload() {
  colourMaps = loadJSON("colour-maps.json");
  font = loadFont("monaco.ttf");
}

function setup() {
  const canvasSize = min(windowWidth, windowHeight);
  const mainCanvas = createCanvas(canvasSize, canvasSize);

  setupCanvasProperties(mainCanvas);

  manager = new Manager({
    metadata: metadata,
    colourMaps: colourMaps,
    font: font
  });
}

function setupCanvasProperties(canvas) {
  const canvasEl = canvas.elt;

  canvasEl.setAttribute('tabindex', '0');
  setTimeout(() => {
    canvasEl.focus();
  }, 100);

  textFont(font);
  pixelDensity(2);
}

function draw() {
  handleContinuousInput();
  manager.update();
  manager.draw();
}

function windowResized() {
  const canvasSize = min(windowWidth, windowHeight);
  resizeCanvas(canvasSize, canvasSize);
}

function handleContinuousInput() {
  let needsUpdate = false;
  let logMsg = "";

  if (keyIsDown(LEFT_ARROW) || keyIsDown(RIGHT_ARROW)) {
    let oldOffset = manager.params.sliceOffset;
    manager.adjustSliceOffset(keyIsDown(RIGHT_ARROW) ? 0.5 : -0.5);
    logMsg = `Slice Offset: ${oldOffset.toFixed(2)} -> ${manager.params.sliceOffset.toFixed(2)}`;
    needsUpdate = true;
  }

  if (keyIsDown(UP_ARROW) || keyIsDown(DOWN_ARROW)) {
    let oldRadius = manager.params.viewRadius;
    manager.adjustViewRadius(keyIsDown(DOWN_ARROW) ? 0.5 : -0.5);
    logMsg = `View Radius: ${oldRadius.toFixed(2)} -> ${manager.params.viewRadius.toFixed(2)}`;
    needsUpdate = true;
  }

  if (keyIsDown(219) || keyIsDown(221)) {
    let oldExp = manager.params.exposure;
    manager.adjustExposure(keyIsDown(221) ? 0.01 : -0.01);
    logMsg = `Exposure: ${oldExp.toFixed(3)} -> ${manager.params.exposure.toFixed(3)}`;
    needsUpdate = true;
  }

  const isPlus = keyIsDown(187) || keyIsDown(61) || keyIsDown(107);
  const isMinus = keyIsDown(189) || keyIsDown(173) || keyIsDown(109);

  if (isPlus || isMinus) {
    let oldRes = manager.params.resolution;
    manager.adjustResolution(isPlus ? 2 : -2);
    logMsg = `Resolution: ${oldRes} -> ${manager.params.resolution}`;
    needsUpdate = true;
  }

  if (needsUpdate && frameCount % 2 === 0) {
    if (logMsg) console.log(`[Action] ${logMsg}`);
  }
}

function keyPressed() {
  let logMsg = "";
  const k = key.toLowerCase();

  if (k === 'w' || k === 's') {
    manager.updateQuantumNumbers('n', k === 'w' ? 1 : -1);
    logMsg = `n changed to ${manager.params.n}`;
  } else if (k === 'd' || k === 'a') {
    manager.updateQuantumNumbers('l', k === 'd' ? 1 : -1);
    logMsg = `l changed to ${manager.params.l}`;
  } else if (k === 'e' || k === 'q') {
    manager.updateQuantumNumbers('m', k === 'e' ? 1 : -1);
    logMsg = `m changed to ${manager.params.m}`;
  }

  const planes = { '1': 'xy', '2': 'xz', '3': 'yz' };
  if (planes[key]) {
    manager.changePlane(planes[key]);
    logMsg = `Plane switched to ${manager.params.slicePlane.toUpperCase()}`;
  }

  switch (k) {
    case 'c':
    manager.cycleColourMap();
    logMsg = `Map switched to ${manager.params.colourMap}`;
    break;
    case 'o':
    manager.toggleOverlay();
    logMsg = `Overlay: ${manager.params.renderOverlay}`;
    break;
    case 'm':
    manager.toggleSmoothing();
    logMsg = `Smoothing: ${manager.params.pixelSmoothing}`;
    break;
    case 'h':
    manager.toggleGUI();
    break;
    case 'p':
    manager.exportImage();
    break;
  }

  if (key === '#') {
    manager.toggleKeymapRef();
    logMsg = `Keymap Reference: ${manager.params.renderKeymapRef}`;
  }

  if (key === ' ') {
    manager.resetSliceOffset();
    logMsg = "Offset reset to 0";
  }

  if (logMsg) console.log(`[Action] ${logMsg}`);
  manager.gui.refresh();
}

function mouseWheel(e) {
  return manager.handleWheel(e);
}