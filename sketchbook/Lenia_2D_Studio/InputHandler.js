class InputHandler {
  constructor(appcore) {
    this.appcore = appcore;
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

    if (keyLower === "tab" || kCode === 9) {
      this._cycleDisplayMode();
      this.appcore.refreshGUI();
      return false;
    }

    if (keyLower === "g") {
      const enabled = this.appcore.params.displayMode !== "kernel";
      if (enabled) {
        this.appcore.params.showGrid = !this.appcore.params.showGrid;
        this.appcore.refreshGUI();
        console.log(`[Lenia] Grid: ${this.appcore.params.showGrid}`);
      }
      return false;
    }

    if (keyLower === "l") {
      this.appcore.params.showColourmap = !this.appcore.params.showColourmap;
      this.appcore.refreshGUI();
      console.log(`[Lenia] Legend: ${this.appcore.params.showColourmap}`);
      return false;
    }

    if (keyLower === "o") {
      this.appcore.params.showStats = !this.appcore.params.showStats;
      this.appcore.refreshGUI();
      console.log(`[Lenia] Stats overlay: ${this.appcore.params.showStats}`);
      return false;
    }

    if (keyLower === "m") {
      this.appcore.params.showMotionOverlay = !this.appcore.params.showMotionOverlay;
      this.appcore.refreshGUI();
      console.log(`[Lenia] Motion overlay: ${this.appcore.params.showMotionOverlay}`);
      return false;
    }

    if (keyLower === "b") {
      this.appcore.params.showScale = !this.appcore.params.showScale;
      this.appcore.refreshGUI();
      console.log(`[Lenia] Scale bar: ${this.appcore.params.showScale}`);
      return false;
    }

    if (keyLower === "h") {
      if (this.appcore.gui && this.appcore.gui.pane) {
        this.appcore.gui.pane.hidden = !this.appcore.gui.pane.hidden;
      }
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

  shouldIgnoreKeyboard() {
    const el = document.activeElement;
    if (!el) return false;
    const tag = (el.tagName || "").toUpperCase();
    return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || !!el.isContentEditable;
  }
}
