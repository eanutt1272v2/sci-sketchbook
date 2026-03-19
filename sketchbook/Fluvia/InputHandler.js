class InputHandler {
  constructor(appcore) {
    this.appcore = appcore;
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
      this.appcore.camera.handleWheel(event);
      return false;
    }
  }

  handlePointer(event) {
    if (this.canvasInteraction(event)) {
      this.appcore.camera.handlePointer(event);
      return false;
    }
  }

  handleKeyPressed(k, kCode) {
    if (this.shouldIgnoreKeyboard()) {
      return false;
    }

    const keyLower = (k || "").toLowerCase();

    if (k === "#") {
      this.appcore.params.renderKeymapRef =
        !this.appcore.params.renderKeymapRef;
      this.appcore.refreshGUI();
      return false;
    }

    if (this.appcore.params.renderKeymapRef) {
      return false;
    }

    if (keyLower === "h") {
      this.appcore.gui.pane.hidden = !this.appcore.gui.pane.hidden;
      return false;
    }

    if (keyLower === " ") {
      this.appcore.params.running = !this.appcore.params.running;
      this.appcore.refreshGUI();
      return false;
    }

    if (keyLower === "p") {
      this.appcore.params.running = !this.appcore.params.running;
      this.appcore.refreshGUI();
      return false;
    }

    if (keyLower === "g") {
      this.appcore.generate();
      this.appcore.refreshGUI();
      return false;
    }

    if (keyLower === "r") {
      this.appcore.reset();
      this.appcore.refreshGUI();
      return false;
    }

    if (keyLower === "1") {
      this.appcore.params.displayMethod = "2D";
      this.appcore.refreshGUI();
      return false;
    }

    if (keyLower === "2") {
      this.appcore.params.displayMethod = "3D";
      this.appcore.refreshGUI();
      return false;
    }

    if (keyLower === "o") {
      this.appcore.params.renderStats = !this.appcore.params.renderStats;
      this.appcore.refreshGUI();
      return false;
    }

    if (keyLower === "l") {
      this.appcore.params.renderLegend = !this.appcore.params.renderLegend;
      this.appcore.refreshGUI();
      return false;
    }

    if (keyLower === "v") {
      if (this.appcore.media.isRecording) {
        this.appcore.media.stopRecording();
      } else {
        this.appcore.media.startRecording();
      }
      this.appcore.refreshGUI();
      return false;
    }

    if (keyLower === "f") {
      this.appcore.media.exportImage();
      return false;
    }

    if (keyLower === "u") {
      this.appcore.media.openImportDialog();
      return false;
    }

    if (keyLower === "c") {
      this.appcore.cycleColourMap(keyIsDown(SHIFT) ? -1 : 1);
      this.appcore.refreshGUI();
      return false;
    }

    if (keyLower === "m") {
      this.appcore.cycleSurfaceMap(keyIsDown(SHIFT) ? -1 : 1);
      this.appcore.refreshGUI();
      return false;
    }

    if (keyLower === "[" || keyLower === "{") {
      const delta = keyLower === "{" ? -16 : -4;
      this.appcore.params.heightScale = constrain(
        this.appcore.params.heightScale + delta,
        1,
        256,
      );
      this.appcore.refreshGUI();
      return false;
    }

    if (keyLower === "]" || keyLower === "}") {
      const delta = keyLower === "}" ? 16 : 4;
      this.appcore.params.heightScale = constrain(
        this.appcore.params.heightScale + delta,
        1,
        256,
      );
      this.appcore.refreshGUI();
      return false;
    }

    if (keyLower === "i") {
      this.appcore.params.dropletsPerFrame = constrain(
        this.appcore.params.dropletsPerFrame + 16,
        0,
        512,
      );
      this.appcore.refreshGUI();
      return false;
    }

    if (keyLower === "k") {
      this.appcore.params.dropletsPerFrame = constrain(
        this.appcore.params.dropletsPerFrame - 16,
        0,
        512,
      );
      this.appcore.refreshGUI();
      return false;
    }

    if (keyLower === "w") {
      this.appcore.media.exportWorldJSON();
      return false;
    }

    if (keyLower === "q") {
      this.appcore.media.importWorldJSON();
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

    if (
      keyLower === "e" ||
      keyLower === "=" ||
      keyLower === "+" ||
      kCode === 187 ||
      kCode === 107
    ) {
      this.keys.zoomIn = false;
    }

    if (
      keyLower === "q" ||
      keyLower === "-" ||
      kCode === 189 ||
      kCode === 109
    ) {
      this.keys.zoomOut = false;
    }

    if (keyLower === "w" || kCode === UP_ARROW) this.keys.up = false;
    if (keyLower === "s" || kCode === DOWN_ARROW) this.keys.down = false;
    if (keyLower === "a" || kCode === LEFT_ARROW) this.keys.left = false;
    if (keyLower === "d" || kCode === RIGHT_ARROW) this.keys.right = false;

    return false;
  }

  handleContinuousInput() {
    if (
      this.shouldIgnoreKeyboard() ||
      this.appcore.params.renderKeymapRef ||
      this.appcore.params.displayMethod !== "3D"
    ) {
      return;
    }

    const yawStep = keyIsDown(SHIFT) ? 0.03 : 0.015;
    const pitchStep = keyIsDown(SHIFT) ? 0.03 : 0.015;
    const zoomStep = keyIsDown(SHIFT) ? 8 : 4;

    if (this.keys.left) this.appcore.camera.target.yaw -= yawStep;
    if (this.keys.right) this.appcore.camera.target.yaw += yawStep;
    if (this.keys.up)
      this.appcore.camera.target.pitch = constrain(
        this.appcore.camera.target.pitch - pitchStep,
        -1.56,
        1.56,
      );
    if (this.keys.down)
      this.appcore.camera.target.pitch = constrain(
        this.appcore.camera.target.pitch + pitchStep,
        -1.56,
        1.56,
      );
    if (this.keys.zoomIn)
      this.appcore.camera.target.zoom = max(
        20,
        this.appcore.camera.target.zoom - zoomStep,
      );
    if (this.keys.zoomOut)
      this.appcore.camera.target.zoom = max(
        20,
        this.appcore.camera.target.zoom + zoomStep,
      );
  }

  canvasInteraction(event) {
    if (!event?.target || typeof event.target.closest !== "function")
      return false;

    const { displayMethod } = this.appcore.params;
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
    return (
      tag === "INPUT" ||
      tag === "TEXTAREA" ||
      tag === "SELECT" ||
      !!el.isContentEditable
    );
  }
}
