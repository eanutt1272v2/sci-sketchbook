class InputHandler {
  constructor(appcore) {
    this.appcore = appcore;
    this._lastGuiRefreshMs = 0;
  }

  handleContinuousInput() {
    if (this.shouldIgnoreKeyboard() || this.appcore.params.renderKeymapRef) {
      return;
    }

    if (frameCount % 2 !== 0) {
      return;
    }

    const { params } = this.appcore;
    const dtScale = constrain((deltaTime || 16.67) / 16.67, 0.5, 2.0);
    let shouldUpdateAutomaton = false;

    if (keyIsDown(219) || keyIsDown(221)) {
      params.R = constrain(
        params.R + (keyIsDown(221) ? 1 : -1) * dtScale,
        2,
        50,
      );
      params.R = Math.round(params.R);
      shouldUpdateAutomaton = true;
    }

    if (keyIsDown(186) || keyIsDown(222)) {
      params.T = constrain(
        params.T + (keyIsDown(222) ? 1 : -1) * dtScale,
        1,
        50,
      );
      params.T = Math.round(params.T);
      shouldUpdateAutomaton = true;
    }

    if (keyIsDown(188) || keyIsDown(190)) {
      params.m = constrain(
        params.m + (keyIsDown(190) ? 0.002 : -0.002) * dtScale,
        0,
        0.5,
      );
      shouldUpdateAutomaton = true;
    }

    const minusHeld = keyIsDown(189) || keyIsDown(173) || keyIsDown(109);
    const plusHeld = keyIsDown(187) || keyIsDown(61) || keyIsDown(107);
    if (minusHeld || plusHeld) {
      params.s = constrain(
        params.s + (plusHeld ? 0.0005 : -0.0005) * dtScale,
        0.001,
        0.1,
      );
      shouldUpdateAutomaton = true;
    }

    if (keyIsDown(LEFT_ARROW) || keyIsDown(RIGHT_ARROW)) {
      params.addNoise = constrain(
        params.addNoise + (keyIsDown(RIGHT_ARROW) ? 0.1 : -0.1) * dtScale,
        0,
        10,
      );
      shouldUpdateAutomaton = true;
    }

    if (keyIsDown(UP_ARROW) || keyIsDown(DOWN_ARROW)) {
      params.maskRate = constrain(
        params.maskRate + (keyIsDown(UP_ARROW) ? 0.1 : -0.1) * dtScale,
        0,
        10,
      );
      shouldUpdateAutomaton = true;
    }

    if (shouldUpdateAutomaton) {
      this.appcore.updateAutomatonParams();
      const nowMs = millis();
      if (nowMs - this._lastGuiRefreshMs > 120) {
        this.appcore.refreshGUI();
        this._lastGuiRefreshMs = nowMs;
      }
    }
  }

  handleKeyPressed(k, kCode) {
    if (this.shouldIgnoreKeyboard()) return false;

    const keyValue = KeyboardUtils.normaliseKey(k);
    const keyLower = KeyboardUtils.toLower(keyValue);
    const shiftHeld = KeyboardUtils.isShiftHeld();

    if (keyValue === "#") {
      this.appcore.params.renderKeymapRef =
        !this.appcore.params.renderKeymapRef;
      this.appcore.refreshGUI();
      return false;
    }

    if (this.appcore.params.renderKeymapRef) return false;

    if (shiftHeld && keyLower === "i") {
      this.appcore.media.importParamsJSON();
      console.log("[Lenia] Importing params JSON…");
      return false;
    }

    if (shiftHeld && keyLower === "p") {
      this.appcore.media.exportParamsJSON();
      console.log("[Lenia] Exporting params JSON…");
      return false;
    }

    if (shiftHeld && keyLower === "u") {
      this.appcore.media.importStatisticsJSON();
      console.log("[Lenia] Importing statistics JSON…");
      return false;
    }

    if (keyValue === " ") {
      this.appcore.params.running = !this.appcore.params.running;
      this.appcore.refreshGUI();
      console.log(
        `[Lenia] ${this.appcore.params.running ? "Running" : "Paused"}`,
      );
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
      this._cycleRenderMode();
      this.appcore.refreshGUI();
      return false;
    }

    if (keyLower === "t") {
      this.appcore.cycleColourMap(1);
      console.log(`[Lenia] Colour map: ${this.appcore.params.colourMap}`);
      return false;
    }

    if (keyLower === "g") {
      const enabled = this.appcore.params.renderMode !== "kernel";
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

    if (keyValue === "M") {
      this.appcore.params.renderMotionTrail =
        !this.appcore.params.renderMotionTrail;
      this.appcore.refreshGUI();
      console.log(
        `[Lenia] Motion trail: ${this.appcore.params.renderMotionTrail}`,
      );
      return false;
    }

    if (keyLower === "m") {
      this.appcore.params.renderMotionOverlay =
        !this.appcore.params.renderMotionOverlay;
      this.appcore.refreshGUI();
      console.log(
        `[Lenia] Motion overlay: ${this.appcore.params.renderMotionOverlay}`,
      );
      return false;
    }

    if (keyValue === "4") {
      this.appcore.params.renderCalcPanels =
        !this.appcore.params.renderCalcPanels;
      this.appcore.refreshGUI();
      console.log(
        `[Lenia] Calculationpanels: ${this.appcore.params.renderCalcPanels}`,
      );
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
      this.appcore.updateAutomatonParams();
      this.appcore.refreshGUI();
      console.log(`[Lenia] Kernel type: ${this.appcore.params.kn}`);
      return false;
    }

    if (keyLower === "y") {
      this.appcore.params.gn = this._cycleInt(this.appcore.params.gn, 1, 3, 1);
      this.appcore.updateAutomatonParams();
      this.appcore.refreshGUI();
      console.log(`[Lenia] Growth type: ${this.appcore.params.gn}`);
      return false;
    }

    if (keyLower === "u") {
      this.appcore.params.softClip = !this.appcore.params.softClip;
      this.appcore.updateAutomatonParams();
      this.appcore.refreshGUI();
      console.log(`[Lenia] Soft clip: ${this.appcore.params.softClip}`);
      return false;
    }

    if (keyLower === "i") {
      this.appcore.params.multiStep = !this.appcore.params.multiStep;
      this.appcore.updateAutomatonParams();
      this.appcore.refreshGUI();
      console.log(`[Lenia] Multi-step: ${this.appcore.params.multiStep}`);
      return false;
    }

    if (keyLower === "v") {
      this._cycleGridSize();
      return false;
    }

    if (keyValue === "[") {
      this.appcore.params.R = Math.max(2, this.appcore.params.R - 1);
      this.appcore.updateAutomatonParams();
      this.appcore.refreshGUI();
      console.log(`[Lenia] R = ${this.appcore.params.R}`);
      return false;
    }

    if (keyValue === "]") {
      this.appcore.params.R = Math.min(50, this.appcore.params.R + 1);
      this.appcore.updateAutomatonParams();
      this.appcore.refreshGUI();
      console.log(`[Lenia] R = ${this.appcore.params.R}`);
      return false;
    }

    if (keyValue === ";") {
      this.appcore.params.T = Math.max(1, this.appcore.params.T - 1);
      this.appcore.updateAutomatonParams();
      this.appcore.refreshGUI();
      console.log(`[Lenia] T = ${this.appcore.params.T}`);
      return false;
    }

    if (keyValue === "'") {
      this.appcore.params.T = Math.min(50, this.appcore.params.T + 1);
      this.appcore.updateAutomatonParams();
      this.appcore.refreshGUI();
      console.log(`[Lenia] T = ${this.appcore.params.T}`);
      return false;
    }

    if (keyLower === "e") {
      console.log("[Lenia] Exporting world state…");
      this.appcore.media.exportWorldJSON();
      return false;
    }

    if (keyLower === "w") {
      console.log("[Lenia] Importing world state…");
      this.appcore.media.importWorldJSON();
      return false;
    }

    if (keyLower === "c") {
      if (shiftHeld) {
        console.log("[Lenia] Exporting statistics JSON…");
        this.appcore.media.exportStatisticsJSON();
      } else {
        console.log("[Lenia] Exporting statistics CSV…");
        this.appcore.media.exportStatisticsCSV();
      }
      return false;
    }

    if (keyLower === "s") {
      console.log("[Lenia] Exporting image…");
      this.appcore.media.exportImage();
      return false;
    }

    if (keyLower === "q") {
      this._cyclePlaceScale(keyValue === "Q" ? -1 : 1);
      return false;
    }

    if (keyValue === "`") {
      this._autoScaleParams();
      return false;
    }

    return false;
  }

  handleKeyReleased(k, kCode) {
    return false;
  }

  _cycleRenderMode() {
    const modes = ["world", "potential", "growth", "kernel"];
    const idx = modes.indexOf(this.appcore.params.renderMode);
    const safeIdx = idx >= 0 ? idx : 0;
    this.appcore.params.renderMode = modes[(safeIdx + 1) % modes.length];
    console.log(`[Lenia] Render: ${this.appcore.params.renderMode}`);
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

  _cyclePlaceScale(delta) {
    const scales = [0.25, 0.5, 1, 2, 3, 4];
    const current = this.appcore.params.placeScale || 1;
    const idx = scales.findIndex((s) => Math.abs(s - current) < 0.01);
    const base = idx >= 0 ? idx : 2;
    const next = (base + delta + scales.length) % scales.length;
    this.appcore.params.placeScale = scales[next];
    this.appcore.refreshGUI();
    console.log(`[Lenia] Place scale: ${scales[next]}×`);
  }

  _autoScaleParams() {
    const animal = this.appcore.getSelectedAnimal();
    const baseR = animal?.params?.R ?? this.appcore.params.R;
    const baseT = animal?.params?.T ?? this.appcore.params.T;
    const s = this.appcore.params.placeScale || 1;
    this.appcore.params.R = Math.round(Math.min(50, Math.max(2, baseR * s)));
    this.appcore.params.T = Math.round(Math.min(50, Math.max(1, baseT * s)));
    this.appcore.updateAutomatonParams();
    this.appcore.refreshGUI();
    console.log(
      `[Lenia] Auto-scaled: R=${this.appcore.params.R}, T=${this.appcore.params.T}`,
    );
  }

  shouldIgnoreKeyboard() {
    return KeyboardUtils.isTypingTarget(document.activeElement);
  }
}
