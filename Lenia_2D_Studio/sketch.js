
/**
 * @file sketch.js
 * @author @eanutt1272.v2
 * @version 1.0.0
 */
p5.disableFriendlyErrors = true;

let automaton, board, renderer, analyser, animalLibrary, gui;
let font, animalsData;
let mainCanvas;

const metadata = {
  name: "Lenia2D Studio (DEV)",
  version: "v0.9.0",
  author: "@eanutt1272.v2"
};

const params = {
  running: true,
  gridSize: 128,

  R: 13, T: 10, m: 0.15, s: 0.015,
  b: [1], kn: 1, gn: 1,

  softClip: false,
  multiStep: false,

  displayMode: "world",
  showGrid: true,
  showScale: true,
  showColourmap: true,
  showStats: true,

  selectedAnimal: "",
  placeMode: true
};

const statistics = {
  gen: 0,
  time: 0,
  mass: 0,
  growth: 0,
  maxValue: 0,
  gyradius: 0,
  fps: 0
};

const displayData = {
  frameCount: 0,
  lastTime: 0
};

function preload() {
  font = loadFont("monaco.ttf");
  animalsData = loadJSON("animals.json");
}

function setup() {
  const canvasSize = min(windowWidth, windowHeight);
  mainCanvas = createCanvas(canvasSize, canvasSize);

  setupCanvasProperties();
  initialiseClasses();

  if (gui && animalLibrary.loaded && animalLibrary.animals.length > 0) {
    loadFirstAnimal();
  }

  gui.setupTabs();
}

function draw() {
  if (params.running) {
    automaton.step(board);
    analyser.updateStatistics(board, params);
  }

  renderer.render(board, automaton, params.displayMode);

  if (params.showGrid && params.displayMode !== "kernel") {
    renderer.drawGrid(params.R);
  }

  if (params.showScale) {
    renderer.drawScale(params.R);
  }

  if (params.showColourmap) {
    renderer.drawLegend();
  }

  if (params.showStats) {
    renderer.drawStats(statistics, params);
  }

  analyser.updateFps();
}

function initialiseClasses() {
  animalLibrary = new AnimalLibrary();
  animalLibrary.loadFromData(animalsData);
  board = new Board(params.gridSize);
  automaton = new Automaton(params);
  analyser = new Analyser();
  renderer = new Renderer(params.gridSize);
  gui = new GUI(params, statistics, displayData, metadata);
}

function setupCanvasProperties() {
  const canvasEl = mainCanvas.elt;
  canvasEl.setAttribute("tabindex", "0");

  setTimeout(() => {
    canvasEl.focus();
  }, 100);

  noSmooth();
  textFont(font);
  pixelDensity(1);
}

function stepOnce() {
  automaton.step(board);
  analyser.updateStatistics(board, params);
}

function clearWorld() {
  board.clear();
  analyser.resetStatistics();
}

function randomiseWorld() {
  board.randomise(automaton.R);
  analyser.resetStatistics();
}

function changeResolution() {
  const canvasSize = min(windowWidth, windowHeight);
  resizeCanvas(canvasSize, canvasSize);

  board.resize(params.gridSize);
  renderer.resize(params.gridSize);
}

function loadAnimal(animal) {
  if (!animal) return;

  analyser.resetStatistics();
  board.loadPattern(animal);

  animalLibrary.applyAnimalParameters(animal);
  automaton.updateParameters(params);

  if (gui && gui.pane) {
    gui.pane.refresh();
  }
}

function loadSelectedAnimal() {
  const value = params.selectedAnimal;
  if (!value || value === "") return;

  const idx = parseInt(value);
  if (isNaN(idx)) return;

  const animal = animalLibrary.getAnimal(idx);
  if (animal) {
    loadAnimal(animal);
  }
}

function placeAnimal(cellX, cellY) {
  if (!params.placeMode || !params.selectedAnimal) return;

  const idx = parseInt(params.selectedAnimal);
  if (isNaN(idx)) return;

  const animal = animalLibrary.getAnimal(idx);
  if (!animal) return;

  board.placePattern(animal, cellX, cellY);
}

function loadFirstAnimal() {
  if (!animalLibrary.loaded || animalLibrary.animals.length === 0) return;

  const firstAnimal = animalLibrary.getAnimal(0);
  if (firstAnimal) {
    params.selectedAnimal = "0";
    loadAnimal(firstAnimal);
    if (gui && gui.pane) {
      gui.pane.refresh();
    }
  }
}

function canvasInteraction(e) {
  if (!e || !e.target) return false;
  if (e.target.closest(".tp-dfwv")) return false;
  if (e.target.tagName !== "CANVAS") return false;
  return true;
}

function mouseClicked(e) {
  if (canvasInteraction(e)) {
    const cellX = Math.floor((mouseX / width) * params.gridSize);
    const cellY = Math.floor((mouseY / height) * params.gridSize);
    placeAnimal(cellX, cellY);
    return false;
  }
}

function windowResized() {
  const canvasSize = min(windowWidth, windowHeight);
  resizeCanvas(canvasSize, canvasSize);
}