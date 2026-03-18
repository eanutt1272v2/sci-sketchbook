p5.disableFriendlyErrors = true;

let automaton, board, renderer, analyser, animalLibrary, gui;
let font, animalsData;
let mainCanvas;

const metadata = {
  name: "Lenia2D Studio (DEV)",
  version: "v1.0.0",
  author: "@eanutt1272.v2"
};

const params = {
  running: true,
  gridSize: 128,

  R: 13, T: 10, m: 0.15, s: 0.015,
  b: [1], kn: 1, gn: 1,

  softClip: false,
  multiStep: false,
  addNoise: 0,
  maskRate: 0,
  paramP: 0,

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
  centerX: 0,
  centerY: 0,
  massAsym: 0,
  speed: 0,
  angle: 0,
  symmSides: 0,
  symmStrength: 0,
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
    analyser.updateStatistics(board, automaton, params);
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
  
  if (automaton.gen % 10 === 0) {
    analyser.series.push(analyser.getStatRow());
  }
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
  analyser.reset();
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

function keyPressed() {
  const pressedKey = key || event.key;

  if (pressedKey === 'e' || pressedKey === 'E') {
    const data = board.toJSON();
    const json = JSON.stringify(data, null, 2);
    console.log('Exporting world state...');
    downloadFile(json, `lenia-world-${automaton.gen}.json`, 'application/json');
    return false;
  }

  if (pressedKey === 'c' || pressedKey === 'C') {
    const csv = analyser.exportCSV();
    console.log('Exporting statistics to CSV...');
    downloadFile(csv, `lenia-stats-${automaton.gen}.csv`, 'text/csv');
    return false;
  }

  if (pressedKey === 's' || pressedKey === 'S') {
    console.log('Saving canvas as PNG...');
    saveCanvas(`lenia-frame-${automaton.gen}`, 'png');
    return false;
  }

  if (pressedKey === 'r' || pressedKey === 'R') {
    automaton.reset();
    analyser.reset();
    clearWorld();
    console.log('Reset to defaults');
    return false;
  }

  return false;
}

function downloadFile(content, filename, mimeType) {
  const element = document.createElement('a');
  element.setAttribute('href', 'data:' + mimeType + ';charset=utf-8,' + encodeURIComponent(content));
  element.setAttribute('download', filename);
  element.style.display = 'none';
  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);
}