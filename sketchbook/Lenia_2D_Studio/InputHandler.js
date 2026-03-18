class InputHandler {
  constructor(appcore) {
    this.appcore = appcore;
  }

  handleContinuousInput() {
    if (this.shouldIgnoreKeyboard() || this.appcore.params.renderKeymapRef) {
      return;
    }

    if (frameCount % 6 !== 0) {
      return;
    }

    const { params } = this.appcore;
    let shouldUpdateAutomaton = false;

    if (keyIsDown(219) || keyIsDown(221)) {
      params.R = constrain(params.R + (keyIsDown(221) ? 1 : -1), 2, 50);
      shouldUpdateAutomaton = true;
    }

    if (keyIsDown(186) || keyIsDown(222)) {
      params.T = constrain(params.T + (keyIsDown(222) ? 1 : -1), 1, 50);
      shouldUpdateAutomaton = true;
    }

    if (keyIsDown(188) || keyIsDown(190)) {
      params.m = constrain(params.m + (keyIsDown(190) ? 0.002 : -0.002), 0, 0.5);
      shouldUpdateAutomaton = true;
    }

    const minusHeld = keyIsDown(189) || keyIsDown(173) || keyIsDown(109);
    const plusHeld = keyIsDown(187) || keyIsDown(61) || keyIsDown(107);
    if (minusHeld || plusHeld) {
      params.s = constrain(params.s + (plusHeld ? 0.0005 : -0.0005), 0.001, 0.1);
      shouldUpdateAutomaton = true;
    }

    if (keyIsDown(LEFT_ARROW) || keyIsDown(RIGHT_ARROW)) {
      params.addNoise = constrain(params.addNoise + (keyIsDown(RIGHT_ARROW) ? 0.1 : -0.1), 0, 10);
      shouldUpdateAutomaton = true;
    }

    if (keyIsDown(UP_ARROW) || keyIsDown(DOWN_ARROW)) {
      params.maskRate = constrain(params.maskRate + (keyIsDown(UP_ARROW) ? 0.1 : -0.1), 0, 10);
      shouldUpdateAutomaton = true;
    }

    if (shouldUpdateAutomaton) {
      this.appcore.automaton.updateParameters(params);
      this.appcore.refreshGUI();
    }
  }

  handleKeyPressed(k, kCode) {
    if (this.shouldIgnoreKeyboard()) return false;

    const keyLower = (k || "").toLowerCase();

    if (k === "#") {
      this.appcore.params.renderKeymapRef = !this.appcore.params.renderKeymapRef;
      this.appcore.refreshGUI();
      return false;
    }

    if (this.appcore.params.renderKeymapRef) return false;

    if (k === " ") {
      this.appcore.params.running = !this.appcore.params.running;
      this.appcore.refreshGUI();
      console.log(`[Lenia] ${this.appcore.params.running ? "Running" : "Paused"}`);
      return false;
    }

    if (keyLower === "n") {
      this.appcore.stepOnce();
      return false;
    }

    if (keyLower === "a") {
      this._cycleAnimal(-1);
      return false;
    }

    if (keyLower === "d") {
      this._cycleAnimal(1);
      return false;
    }

    if (keyLower === "f") {
      this.appcore.loadSelectedAnimal();
      this.appcore.refreshGUI();
      console.log("[Lenia] Loaded selected animal");
      return false;
    }

    if (keyLower === "r") {
      this.appcore.automaton.reset();
      this.appcore.analyser.reset();
      this.appcore.clearWorld();
      this.appcore.refreshGUI();
      console.log("[Lenia] Reset");
      return false;
    }

    if (keyLower === "x") {
      this.appcore.clearWorld();
      this.appcore.refreshGUI();
      console.log("[Lenia] World cleared");
      return false;
    }

    if (keyLower === "z") {
      this.appcore.randomiseWorld();
      this.appcore.refreshGUI();
      console.log("[Lenia] World randomised");
      return false;
    }

    if (keyLower === "p") {
      this.appcore.params.placeMode = !this.appcore.params.placeMode;
      this.appcore.refreshGUI();
      console.log(`[Lenia] Place mode: ${this.appcore.params.placeMode}`);
      return false;
    }

    if (kCode === 9) {
      this._cycleDisplayMode();
      this.appcore.refreshGUI();
      return false;
    }

    if (keyLower === "t") {
      this.appcore.cycleColourMap(1);
      console.log(`[Lenia] Colour map: ${this.appcore.params.colourMap}`);
      return false;
    }

    if (keyLower === "g") {
      const enabled = this.appcore.params.displayMode !== "kernel";
      if (enabled) {
        this.appcore.params.renderGrid = !this.appcore.params.renderGrid;
        this.appcore.refreshGUI();
        console.log(`[Lenia] Grid: ${this.appcore.params.renderGrid}`);
      }
      return false;
    }

    if (keyLower === "l") {
      this.appcore.params.renderLegend = !this.appcore.params.renderLegend;
      this.appcore.refreshGUI();
      console.log(`[Lenia] Legend: ${this.appcore.params.renderLegend}`);
      return false;
    }

    if (keyLower === "o") {
      this.appcore.params.renderStats = !this.appcore.params.renderStats;
      this.appcore.refreshGUI();
      console.log(`[Lenia] Stats overlay: ${this.appcore.params.renderStats}`);
      return false;
    }

    if (keyLower === "m") {
      this.appcore.params.renderMotionOverlay = !this.appcore.params.renderMotionOverlay;
      this.appcore.refreshGUI();
      console.log(`[Lenia] Motion overlay: ${this.appcore.params.renderMotionOverlay}`);
      return false;
    }

    if (keyLower === "b") {
      this.appcore.params.renderScale = !this.appcore.params.renderScale;
      this.appcore.refreshGUI();
      console.log(`[Lenia] Scale bar: ${this.appcore.params.renderScale}`);
      return false;
    }

    if (keyLower === "h") {
      if (this.appcore.gui && this.appcore.gui.pane) {
        this.appcore.gui.pane.hidden = !this.appcore.gui.pane.hidden;
      }
      return false;
    }

    if (keyLower === "k") {
      this.appcore.params.kn = this._cycleInt(this.appcore.params.kn, 1, 4, 1);
      this.appcore.automaton.updateParameters(this.appcore.params);
      this.appcore.refreshGUI();
      console.log(`[Lenia] Kernel type: ${this.appcore.params.kn}`);
      return false;
    }

    if (keyLower === "y") {
      this.appcore.params.gn = this._cycleInt(this.appcore.params.gn, 1, 3, 1);
      this.appcore.automaton.updateParameters(this.appcore.params);
      this.appcore.refreshGUI();
      console.log(`[Lenia] Growth type: ${this.appcore.params.gn}`);
      return false;
    }

    if (keyLower === "u") {
      this.appcore.params.softClip = !this.appcore.params.softClip;
      this.appcore.automaton.updateParameters(this.appcore.params);
      this.appcore.refreshGUI();
      console.log(`[Lenia] Soft clip: ${this.appcore.params.softClip}`);
      return false;
    }

    if (keyLower === "i") {
      this.appcore.params.multiStep = !this.appcore.params.multiStep;
      this.appcore.automaton.updateParameters(this.appcore.params);
      this.appcore.refreshGUI();
      console.log(`[Lenia] Multi-step: ${this.appcore.params.multiStep}`);
      return false;
    }

    if (keyLower === "v") {
      this._cycleGridSize();
      return false;
    }

    if (k === "[") {
      this.appcore.params.R = Math.max(2, this.appcore.params.R - 1);
      this.appcore.automaton.updateParameters(this.appcore.params);
      this.appcore.refreshGUI();
      console.log(`[Lenia] R = ${this.appcore.params.R}`);
      return false;
    }

    if (k === "]") {
      this.appcore.params.R = Math.min(50, this.appcore.params.R + 1);
      this.appcore.automaton.updateParameters(this.appcore.params);
      this.appcore.refreshGUI();
      console.log(`[Lenia] R = ${this.appcore.params.R}`);
      return false;
    }

    if (k === ";") {
      this.appcore.params.T = Math.max(1, this.appcore.params.T - 1);
      this.appcore.automaton.updateParameters(this.appcore.params);
      this.appcore.refreshGUI();
      console.log(`[Lenia] T = ${this.appcore.params.T}`);
      return false;
    }

    if (k === "'") {
      this.appcore.params.T = Math.min(50, this.appcore.params.T + 1);
      this.appcore.automaton.updateParameters(this.appcore.params);
      this.appcore.refreshGUI();
      console.log(`[Lenia] T = ${this.appcore.params.T}`);
      return false;
    }

    if (keyLower === "e") {
      const data = this.appcore.board.toJSON();
      const json = JSON.stringify(data, null, 2);
      console.log("[Lenia] Exporting world state…");
      downloadFile(json, `lenia-world-${this.appcore.automaton.gen}.json`, "application/json");
      return false;
    }

    if (keyLower === "c") {
      const csv = this.appcore.analyser.exportCSV();
      console.log("[Lenia] Exporting statistics CSV…");
      downloadFile(csv, `lenia-stats-${this.appcore.automaton.gen}.csv`, "text/csv");
      return false;
    }

    if (keyLower === "s") {
      console.log("[Lenia] Saving canvas PNG…");
      saveCanvas(`lenia-frame-${this.appcore.automaton.gen}`, "png");
      return false;
    }

    return false;
  }

  handleKeyReleased(k, kCode) {
    return false;
  }

  _cycleDisplayMode() {
    const modes = ["world", "potential", "field", "kernel"];
    const idx = modes.indexOf(this.appcore.params.displayMode);
    this.appcore.params.displayMode = modes[(idx + 1) % modes.length];
    console.log(`[Lenia] Display: ${this.appcore.params.displayMode}`);
  }

  _cycleGridSize() {
    const sizes = [64, 128, 256];
    const current = this.appcore.params.gridSize;
    const idx = sizes.indexOf(current);
    this.appcore.params.gridSize = sizes[(idx + 1) % sizes.length];
    this.appcore.changeResolution();
    this.appcore.refreshGUI();
    console.log(`[Lenia] Grid size: ${this.appcore.params.gridSize}`);
  }

  _cycleAnimal(delta) {
    const lib = this.appcore.animalLibrary;
    if (!lib || !lib.animals || lib.animals.length === 0) return;

    const total = lib.animals.length;
    const current = parseInt(this.appcore.params.selectedAnimal, 10);
    const base = Number.isNaN(current) ? 0 : current;
    const next = (base + delta + total) % total;

    this.appcore.params.selectedAnimal = String(next);
    this.appcore.loadSelectedAnimal();
    this.appcore.refreshGUI();

    const animal = lib.getAnimal(next);
    if (animal && animal.name) {
      console.log(`[Lenia] Animal: ${animal.name}`);
    }
  }

  _cycleInt(value, minValue, maxValue, step) {
    const next = value + step;
    if (next > maxValue) return minValue;
    if (next < minValue) return maxValue;
    return next;
  }

  shouldIgnoreKeyboard() {
    const el = document.activeElement;
    if (!el) return false;
    const tag = (el.tagName || "").toUpperCase();
    return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || !!el.isContentEditable;
  }
}
