class InputHandler {
  constructor(manager) {
    this.m = manager;
    this.keys = {
      up: false,
      down: false,
      left: false,
      right: false,
      zoomIn: false,
      zoomOut: false,
    };
  }

  handleWheel(event) {
    if (this.canvasInteraction(event)) {
      this.m.camera.handleWheel(event);
      return false;
    }
  }

  handlePointer(event) {
    if (this.canvasInteraction(event)) {
      this.m.camera.handlePointer(event);
      return false;
    }
  }

  handleKeyPressed(k, kCode) {
    if (this.shouldIgnoreKeyboard()) {
      return false;
    }

    const keyLower = (k || "").toLowerCase();

    if (k === "#") {
      this.m.params.renderKeymapRef = !this.m.params.renderKeymapRef;
      this.m.refreshGUI();
      return false;
    }

    if (this.m.params.renderKeymapRef) {
      return false;
    }

    if (keyLower === "h") {
      this.m.gui.pane.hidden = !this.m.gui.pane.hidden;
      return false;
    }

    if (keyLower === " ") {
      this.m.params.running = !this.m.params.running;
      this.m.refreshGUI();
      return false;
    }

    if (keyLower === "p") {
      this.m.params.running = !this.m.params.running;
      this.m.refreshGUI();
      return false;
    }

    if (keyLower === "g") {
      this.m.generate();
      this.m.refreshGUI();
      return false;
    }

    if (keyLower === "r") {
      this.m.reset();
      this.m.refreshGUI();
      return false;
    }

    if (keyLower === "1") {
      this.m.params.displayMethod = "2D";
      this.m.refreshGUI();
      return false;
    }

    if (keyLower === "2") {
      this.m.params.displayMethod = "3D";
      this.m.refreshGUI();
      return false;
    }

    if (keyLower === "o") {
      this.m.params.renderStats = !this.m.params.renderStats;
      this.m.refreshGUI();
      return false;
    }

    if (keyLower === "l") {
      this.m.params.renderLegend = !this.m.params.renderLegend;
      this.m.refreshGUI();
      return false;
    }

    if (keyLower === "v") {
      if (this.m.media.isRecording) {
        this.m.media.stopRecording();
      } else {
        this.m.media.startRecording();
      }
      this.m.refreshGUI();
      return false;
    }

    if (keyLower === "f") {
      this.m.media.exportImage();
      return false;
    }

    if (keyLower === "u") {
      this.m.media.openImportDialog();
      return false;
    }

    if (keyLower === "c") {
      this.m.cycleColourMap(keyIsDown(SHIFT) ? -1 : 1);
      this.m.refreshGUI();
      return false;
    }

    if (keyLower === "m") {
      this.m.cycleSurfaceMap(keyIsDown(SHIFT) ? -1 : 1);
      this.m.refreshGUI();
      return false;
    }

    if (keyLower === "[" || keyLower === "{") {
      const delta = keyLower === "{" ? -16 : -4;
      this.m.params.heightScale = constrain(this.m.params.heightScale + delta, 1, 256);
      this.m.refreshGUI();
      return false;
    }

    if (keyLower === "]" || keyLower === "}") {
      const delta = keyLower === "}" ? 16 : 4;
      this.m.params.heightScale = constrain(this.m.params.heightScale + delta, 1, 256);
      this.m.refreshGUI();
      return false;
    }

    if (keyLower === "i") {
      this.m.params.dropletsPerFrame = constrain(this.m.params.dropletsPerFrame + 16, 0, 512);
      this.m.refreshGUI();
      return false;
    }

    if (keyLower === "k") {
      this.m.params.dropletsPerFrame = constrain(this.m.params.dropletsPerFrame - 16, 0, 512);
      this.m.refreshGUI();
      return false;
    }

    if (keyLower === "e" || kCode === 187 || kCode === 107) {
      this.keys.zoomIn = true;
      return false;
    }

    if (keyLower === "q" || kCode === 189 || kCode === 109) {
      this.keys.zoomOut = true;
      return false;
    }

    if (keyLower === "w" || kCode === UP_ARROW) this.keys.up = true;
    if (keyLower === "s" || kCode === DOWN_ARROW) this.keys.down = true;
    if (keyLower === "a" || kCode === LEFT_ARROW) this.keys.left = true;
    if (keyLower === "d" || kCode === RIGHT_ARROW) this.keys.right = true;

    return false;
  }

  handleKeyReleased(k, kCode) {
    const keyLower = (k || "").toLowerCase();

    if (keyLower === "e" || keyLower === "=" || keyLower === "+" || kCode === 187 || kCode === 107) {
      this.keys.zoomIn = false;
    }

    if (keyLower === "q" || keyLower === "-" || kCode === 189 || kCode === 109) {
      this.keys.zoomOut = false;
    }

    if (keyLower === "w" || kCode === UP_ARROW) this.keys.up = false;
    if (keyLower === "s" || kCode === DOWN_ARROW) this.keys.down = false;
    if (keyLower === "a" || kCode === LEFT_ARROW) this.keys.left = false;
    if (keyLower === "d" || kCode === RIGHT_ARROW) this.keys.right = false;

    return false;
  }

  handleContinuousInput() {
    if (this.shouldIgnoreKeyboard() || this.m.params.renderKeymapRef || this.m.params.displayMethod !== "3D") {
      return;
    }

    const yawStep = keyIsDown(SHIFT) ? 0.03 : 0.015;
    const pitchStep = keyIsDown(SHIFT) ? 0.03 : 0.015;
    const zoomStep = keyIsDown(SHIFT) ? 8 : 4;

    if (this.keys.left) this.m.camera.target.yaw -= yawStep;
    if (this.keys.right) this.m.camera.target.yaw += yawStep;
    if (this.keys.up) this.m.camera.target.pitch = constrain(this.m.camera.target.pitch - pitchStep, -1.56, 1.56);
    if (this.keys.down) this.m.camera.target.pitch = constrain(this.m.camera.target.pitch + pitchStep, -1.56, 1.56);
    if (this.keys.zoomIn) this.m.camera.target.zoom = max(20, this.m.camera.target.zoom - zoomStep);
    if (this.keys.zoomOut) this.m.camera.target.zoom = max(20, this.m.camera.target.zoom + zoomStep);
  }

  canvasInteraction(event) {
    if (!event?.target || typeof event.target.closest !== "function") return false;

    const { displayMethod } = this.m.params;
    const { target } = event;

    const is3D = displayMethod === "3D";
    const isUI = target.closest(".tp-dfwv");
    const isCanvas = target.tagName === "CANVAS";

    return is3D && !isUI && isCanvas;
  }

  shouldIgnoreKeyboard() {
    const el = document.activeElement;
    if (!el) return false;
    const tag = (el.tagName || "").toUpperCase();
    return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || !!el.isContentEditable;
  }
}
