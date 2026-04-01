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
    if (KeyboardUtils.shouldIgnoreKeyboard()) {
      return false;
    }

    const keyValue = KeyboardUtils.normaliseKey(k);
    const keyLower = KeyboardUtils.toLower(k);
    const shiftHeld = KeyboardUtils.isShiftHeld();

    if (keyValue === "#") {
      this.appcore.params.renderKeymapRef =
        !this.appcore.params.renderKeymapRef;
      this.appcore.refreshGUI();
      return false;
    }

    if (this.appcore.params.renderKeymapRef) {
      return false;
    }

    if (shiftHeld && keyLower === "i") {
      this.appcore.media.importParamsJSON();
      return false;
    }

    if (shiftHeld && keyLower === "p") {
      this.appcore.media.exportParamsJSON();
      return false;
    }

    if (shiftHeld && keyLower === "j") {
      this.appcore.media.exportStatisticsJSON();
      return false;
    }

    if (shiftHeld && keyLower === "k") {
      this.appcore.media.exportStatisticsCSV();
      return false;
    }

    if (keyLower === "h") {
      if (this.appcore.gui && this.appcore.gui.pane) {
        this.appcore.gui.pane.hidden = !this.appcore.gui.pane.hidden;
      }
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
      this.appcore.params.renderMethod = "2D";
      this.appcore.refreshGUI();
      return false;
    }

    if (keyLower === "2") {
      this.appcore.params.renderMethod = "3D";
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
      try {
        if (this.appcore.media.isRecording) {
          this.appcore.media.stopRecording();
        } else {
          this.appcore.media.startRecording();
        }
      } catch (error) {
        console.error("[Fluvia] Recording toggle failed:", error);
      }
      this.appcore.refreshGUI();
      return false;
    }

    if (keyLower === "f") {
      try {
        this.appcore.media.exportImage();
      } catch (error) {
        console.error("[Fluvia] Export image failed:", error);
      }
      return false;
    }

    if (keyLower === "u") {
      try {
        this.appcore.media.openImportDialog();
      } catch (error) {
        console.error("[Fluvia] Import heightmap failed:", error);
      }
      return false;
    }

    if (keyLower === "c") {
      this.appcore.cycleColourMap(KeyboardUtils.isShiftHeld() ? -1 : 1);
      this.appcore.refreshGUI();
      return false;
    }

    if (keyLower === "m") {
      this.appcore.cycleSurfaceMap(KeyboardUtils.isShiftHeld() ? -1 : 1);
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

    if (keyValue === "W") {
      try {
        this.appcore.media.exportWorldJSON();
      } catch (error) {
        console.error("[Fluvia] Export world failed:", error);
      }
      return false;
    }

    if (keyValue === "Q") {
      try {
        this.appcore.media.importWorldJSON();
      } catch (error) {
        console.error("[Fluvia] Import world failed:", error);
      }
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
    const keyLower = KeyboardUtils.toLower(k);

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
      KeyboardUtils.shouldIgnoreKeyboard() ||
      this.appcore.params.renderKeymapRef ||
      this.appcore.params.renderMethod !== "3D"
    ) {
      return;
    }

    const shiftHeld = KeyboardUtils.isShiftHeld();
    const yawStep = shiftHeld ? 0.03 : 0.015;
    const pitchStep = shiftHeld ? 0.03 : 0.015;
    const zoomStep = shiftHeld ? 8 : 4;

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

    const { renderMethod } = this.appcore.params;
    const { target } = event;

    const is3D = renderMethod === "3D";
    const isUI = target.closest(".tp-dfwv");
    const isCanvas = target.tagName === "CANVAS";

    return is3D && !isUI && isCanvas;
  }

}
