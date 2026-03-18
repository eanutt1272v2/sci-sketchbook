class AppCore {
  constructor(assets) {
    const { metadata, animalsData, font } = assets;

    this.metadata = metadata;

    this.params = {
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
      showMotionOverlay: false,
      renderKeymapRef: false,

      selectedAnimal: "",
      placeMode: true
    };

    this.statistics = {
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

    this.displayData = {
      frameCount: 0,
      lastTime: 0
    };

    this.font = font;

    this.animalLibrary = new AnimalLibrary(this.params);
    this.animalLibrary.loadFromData(animalsData);
    this.board = new Board(this.params.gridSize);
    this.automaton = new Automaton(this.params);
    this.analyser = new Analyser(this.statistics, this.displayData);
    this.renderer = new Renderer(this.params.gridSize);
    this.gui = new GUI(this.params, this.statistics, this.displayData, this.metadata, this.animalLibrary, this);
    this.input = new InputHandler(this);
  }

  setup() {
    if (this.gui && this.animalLibrary.loaded && this.animalLibrary.animals.length > 0) {
      this.loadFirstAnimal();
    }

    if (this.gui) {
      this.gui.setupTabs();
    }
  }

  draw() {
    if (this.params.running) {
      this.automaton.step(this.board);
      this.analyser.updateStatistics(this.board, this.automaton, this.params);
    }

    this.renderer.render(this.board, this.automaton, this.params.displayMode);

    if (this.params.showGrid && this.params.displayMode !== "kernel") {
      this.renderer.drawGrid(this.params.R);
    }

    if (this.params.showScale) {
      this.renderer.drawScale(this.params.R);
    }

    if (this.params.showColourmap) {
      this.renderer.drawLegend();
    }

    if (this.params.showStats) {
      this.renderer.drawStats(this.statistics, this.params);
    }

    if (this.params.showMotionOverlay && this.params.displayMode !== "kernel") {
      this.renderer.drawMotionOverlay(this.statistics, this.params);
    }

    this.analyser.updateFps();
    
    if (this.automaton.gen % 10 === 0) {
      this.analyser.series.push(this.analyser.getStatRow());
    }
  }

  stepOnce() {
    this.automaton.step(this.board);
    this.analyser.updateStatistics(this.board, this.automaton, this.params);
  }

  clearWorld() {
    this.board.clear();
    this.analyser.resetStatistics();
    this.analyser.reset();
  }

  randomiseWorld() {
    this.board.randomise(this.automaton.R);
    this.analyser.resetStatistics();
  }

  changeResolution() {
    const canvasSize = min(windowWidth, windowHeight);
    resizeCanvas(canvasSize, canvasSize);
    this.board.resize(this.params.gridSize);
    this.renderer.resize(this.params.gridSize);
  }

  loadAnimal(animal) {
    if (!animal) return;

    this.analyser.resetStatistics();
    this.board.loadPattern(animal);

    this.animalLibrary.applyAnimalParameters(animal);
    this.automaton.updateParameters(this.params);

    if (this.gui && this.gui.pane) {
      this.gui.pane.refresh();
    }
  }

  loadSelectedAnimal() {
    const value = this.params.selectedAnimal;
    if (!value || value === "") return;

    const idx = parseInt(value);
    if (isNaN(idx)) return;

    const animal = this.animalLibrary.getAnimal(idx);
    if (animal) {
      this.loadAnimal(animal);
    }
  }

  placeAnimal(cellX, cellY) {
    if (!this.params.placeMode || !this.params.selectedAnimal) return;

    const idx = parseInt(this.params.selectedAnimal);
    if (isNaN(idx)) return;

    const animal = this.animalLibrary.getAnimal(idx);
    if (!animal) return;

    this.board.placePattern(animal, cellX, cellY);
  }

  loadFirstAnimal() {
    if (!this.animalLibrary.loaded || this.animalLibrary.animals.length === 0) return;

    const firstAnimal = this.animalLibrary.getAnimal(0);
    if (firstAnimal) {
      this.params.selectedAnimal = "0";
      this.loadAnimal(firstAnimal);
      if (this.gui && this.gui.pane) {
        this.gui.pane.refresh();
      }
    }
  }

  canvasInteraction(e) {
    if (!e || !e.target) return false;
    if (e.target.closest(".tp-dfwv")) return false;
    if (e.target.tagName !== "CANVAS") return false;
    return true;
  }

  handleMouseClicked(e) {
    if (this.canvasInteraction(e)) {
      const cellX = Math.floor((mouseX / width) * this.params.gridSize);
      const cellY = Math.floor((mouseY / height) * this.params.gridSize);
      this.placeAnimal(cellX, cellY);
      return false;
    }
  }

  handleKeyPressed(k, kCode) {
    return this.input.handleKeyPressed(k, kCode);
  }

  handleKeyReleased(k, kCode) {
    return this.input.handleKeyReleased(k, kCode);
  }

  refreshGUI() {
    if (this.gui && this.gui.pane) this.gui.pane.refresh();
  }

  windowResized() {
    const canvasSize = min(windowWidth, windowHeight);
    resizeCanvas(canvasSize, canvasSize);
  }
}
