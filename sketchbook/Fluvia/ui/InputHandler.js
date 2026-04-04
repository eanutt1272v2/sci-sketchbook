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

  handlePointerStart(event) {
    if (this.canvasInteraction(event)) {
      this.appcore.camera.beginPointer(event);
      this.appcore.camera.handlePointer(event);
      return false;
    }
  }

  handlePointerEnd() {
    this.appcore.camera.endPointer();
    return false;
  }

  handleKeyPressed(k, kCode, event = null) {
    if (KeyboardUtils.shouldIgnoreKeyboard()) {
      return false;
    }

    const keyValue = KeyboardUtils.normaliseKey(k);
    const keyLower = KeyboardUtils.toLower(keyValue);
    const shiftHeld = Boolean(event?.shiftKey) || KeyboardUtils.isShiftHeld();
    const ctrlHeld = Boolean(event?.ctrlKey) || KeyboardUtils.isCtrlHeld();

    if (keyValue === "#") {
      this.appcore.params.renderKeymapRef =
        !this.appcore.params.renderKeymapRef;
      this.appcore.refreshGUI();
      return false;
    }

    if (this.appcore.params.renderKeymapRef) {
      return false;
    }

    if (shiftHeld && ctrlHeld && keyLower === "i") {
      this.appcore.media.importParamsJSON();
      return false;
    }

    if (shiftHeld && ctrlHeld && keyLower === "p") {
      this.appcore.media.exportParamsJSON();
      return false;
    }

    if (shiftHeld && ctrlHeld && keyLower === "j") {
      this.appcore.media.exportStatisticsJSON();
      return false;
    }

    if (shiftHeld && ctrlHeld && keyLower === "k") {
      this.appcore.media.exportStatisticsCSV();
      return false;
    }

    if (shiftHeld && ctrlHeld && keyLower === "u") {
      try {
        this.appcore.media.openImportDialog();
      } catch (error) {
        console.error("[Fluvia] Import heightmap failed:", error);
      }
      return false;
    }

    if (keyLower === "h" && !ctrlHeld) {
      if (this.appcore.gui && this.appcore.gui.pane) {
        this.appcore.gui.pane.hidden = !this.appcore.gui.pane.hidden;
      }
      return false;
    }

    if (keyLower === " " || KeyboardUtils.isEnterOrReturn(kCode)) {
      this.appcore.params.running = !this.appcore.params.running;
      this.appcore.refreshGUI();
      return false;
    }

    if (keyLower === "p" && !ctrlHeld) {
      this.appcore.params.running = !this.appcore.params.running;
      this.appcore.refreshGUI();
      return false;
    }

    if (ctrlHeld && keyLower === "r" && !shiftHeld) {
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

    if (ctrlHeld && keyLower === "s" && !shiftHeld) {
      try {
        this.appcore.media.exportImage();
      } catch (error) {
        console.error("[Fluvia] Export image failed:", error);
      }
      return false;
    }

    if (ctrlHeld && keyLower === "u" && !shiftHeld) {
      this.appcore.params.maxAge = constrain(
        this.appcore.params.maxAge + 16,
        8,
        2048,
      );
      this.appcore.refreshGUI();
      return false;
    }

    if (ctrlHeld && keyLower === "j" && !shiftHeld) {
      this.appcore.params.maxAge = constrain(
        this.appcore.params.maxAge - 16,
        8,
        2048,
      );
      this.appcore.refreshGUI();
      return false;
    }

    if (ctrlHeld && keyLower === "y" && !shiftHeld) {
      this.appcore.params.minVolume = constrain(
        this.appcore.params.minVolume + 0.001,
        1e-5,
        1,
      );
      this.appcore.refreshGUI();
      return false;
    }

    if (ctrlHeld && keyLower === "h" && !shiftHeld) {
      this.appcore.params.minVolume = constrain(
        this.appcore.params.minVolume - 0.001,
        1e-5,
        1,
      );
      this.appcore.refreshGUI();
      return false;
    }

    if (ctrlHeld && !shiftHeld && ["1", "2", "3"].includes(keyLower)) {
      const terrainSizeByKey = { 1: 128, 2: 256, 3: 512 };
      this.appcore.params.terrainSize = terrainSizeByKey[keyLower];
      this.appcore.generate();
      this.appcore.refreshGUI();
      return false;
    }

    if (
      ctrlHeld &&
      (keyValue === "[" ||
        keyValue === "{" ||
        keyValue === "]" ||
        keyValue === "}")
    ) {
      const baseStep = shiftHeld ? 0.25 : 0.05;
      const delta = keyValue === "[" || keyValue === "{" ? -baseStep : baseStep;
      this.appcore.params.noiseScale = constrain(
        this.appcore.params.noiseScale + delta,
        0.01,
        10,
      );
      this.appcore.refreshGUI();
      return false;
    }

    if (ctrlHeld && (keyValue === ";" || keyValue === ":")) {
      this.appcore.params.noiseOctaves = constrain(
        this.appcore.params.noiseOctaves - 1,
        1,
        12,
      );
      this.appcore.refreshGUI();
      return false;
    }

    if (ctrlHeld && (keyValue === "'" || keyValue === '"')) {
      this.appcore.params.noiseOctaves = constrain(
        this.appcore.params.noiseOctaves + 1,
        1,
        12,
      );
      this.appcore.refreshGUI();
      return false;
    }

    if (ctrlHeld && (keyValue === "," || keyValue === "<")) {
      this.appcore.params.specularIntensity = constrain(
        this.appcore.params.specularIntensity - 10,
        0,
        4096,
      );
      this.appcore.refreshGUI();
      return false;
    }

    if (ctrlHeld && (keyValue === "." || keyValue === ">")) {
      this.appcore.params.specularIntensity = constrain(
        this.appcore.params.specularIntensity + 10,
        0,
        4096,
      );
      this.appcore.refreshGUI();
      return false;
    }

    if (keyLower === "g" && !ctrlHeld) {
      this.appcore.generate();
      this.appcore.refreshGUI();
      return false;
    }

    if (keyLower === "r" && !ctrlHeld) {
      this.appcore.reset();
      this.appcore.refreshGUI();
      return false;
    }

    if (keyLower === "1" && !ctrlHeld) {
      this.appcore.params.renderMethod = "2D";
      this.appcore.refreshGUI();
      return false;
    }

    if (keyLower === "2" && !ctrlHeld) {
      this.appcore.params.renderMethod = "3D";
      this.appcore.refreshGUI();
      return false;
    }

    if (keyLower === "o" && !ctrlHeld) {
      this.appcore.params.renderStats = !this.appcore.params.renderStats;
      this.appcore.refreshGUI();
      return false;
    }

    if (keyLower === "l" && !ctrlHeld) {
      this.appcore.params.renderLegend = !this.appcore.params.renderLegend;
      this.appcore.refreshGUI();
      return false;
    }

    if (keyLower === "c" && !ctrlHeld) {
      this.appcore.cycleColourMap(shiftHeld ? -1 : 1);
      this.appcore.refreshGUI();
      return false;
    }

    if (keyLower === "m" && !ctrlHeld) {
      this.appcore.cycleSurfaceMap(shiftHeld ? -1 : 1);
      this.appcore.refreshGUI();
      return false;
    }

    if ((keyLower === "[" || keyLower === "{") && !ctrlHeld) {
      const delta = keyLower === "{" ? -16 : -4;
      this.appcore.params.heightScale = constrain(
        this.appcore.params.heightScale + delta,
        1,
        256,
      );
      this.appcore.refreshGUI();
      return false;
    }

    if ((keyLower === "]" || keyLower === "}") && !ctrlHeld) {
      const delta = keyLower === "}" ? 16 : 4;
      this.appcore.params.heightScale = constrain(
        this.appcore.params.heightScale + delta,
        1,
        256,
      );
      this.appcore.refreshGUI();
      return false;
    }

    if (keyLower === "i" && !ctrlHeld) {
      this.appcore.params.dropletsPerFrame = constrain(
        this.appcore.params.dropletsPerFrame + 16,
        0,
        512,
      );
      this.appcore.refreshGUI();
      return false;
    }

    if (keyLower === "k" && !ctrlHeld) {
      this.appcore.params.dropletsPerFrame = constrain(
        this.appcore.params.dropletsPerFrame - 16,
        0,
        512,
      );
      this.appcore.refreshGUI();
      return false;
    }

    if (shiftHeld && ctrlHeld && keyLower === "w") {
      try {
        this.appcore.media.exportWorldJSON();
      } catch (error) {
        console.error("[Fluvia] Export world failed:", error);
      }
      return false;
    }

    if (shiftHeld && ctrlHeld && keyLower === "q") {
      try {
        this.appcore.media.importWorldJSON();
      } catch (error) {
        console.error("[Fluvia] Import world failed:", error);
      }
      return false;
    }
    if (
      (!ctrlHeld && keyLower === "e") ||
      keyValue === "=" ||
      keyValue === "+" ||
      kCode === 187 ||
      kCode === 61 ||
      kCode === 107
    ) {
      this.keys.zoomIn = true;
      return false;
    }

    if (
      (!ctrlHeld && keyLower === "q") ||
      keyValue === "-" ||
      keyValue === "_" ||
      kCode === 189 ||
      kCode === 173 ||
      kCode === 109
    ) {
      this.keys.zoomOut = true;
      return false;
    }

    const upArrow = KeyboardUtils.keyCode("UP_ARROW", 38);
    const downArrow = KeyboardUtils.keyCode("DOWN_ARROW", 40);
    const leftArrow = KeyboardUtils.keyCode("LEFT_ARROW", 37);
    const rightArrow = KeyboardUtils.keyCode("RIGHT_ARROW", 39);

    if (!ctrlHeld && (keyLower === "w" || kCode === upArrow))
      this.keys.up = true;
    if (!ctrlHeld && (keyLower === "s" || kCode === downArrow))
      this.keys.down = true;
    if (!ctrlHeld && (keyLower === "a" || kCode === leftArrow))
      this.keys.left = true;
    if (!ctrlHeld && (keyLower === "d" || kCode === rightArrow))
      this.keys.right = true;

    return false;
  }

  handleKeyReleased(k, kCode, event = null) {
    const keyValue = KeyboardUtils.normaliseKey(k);
    const keyLower = KeyboardUtils.toLower(keyValue);

    if (
      keyLower === "e" ||
      keyValue === "=" ||
      keyValue === "+" ||
      kCode === 187 ||
      kCode === 61 ||
      kCode === 107
    ) {
      this.keys.zoomIn = false;
    }

    if (
      keyLower === "q" ||
      keyValue === "-" ||
      keyValue === "_" ||
      kCode === 189 ||
      kCode === 173 ||
      kCode === 109
    ) {
      this.keys.zoomOut = false;
    }

    const upArrow = KeyboardUtils.keyCode("UP_ARROW", 38);
    const downArrow = KeyboardUtils.keyCode("DOWN_ARROW", 40);
    const leftArrow = KeyboardUtils.keyCode("LEFT_ARROW", 37);
    const rightArrow = KeyboardUtils.keyCode("RIGHT_ARROW", 39);

    if (keyLower === "w" || kCode === upArrow) this.keys.up = false;
    if (keyLower === "s" || kCode === downArrow) this.keys.down = false;
    if (keyLower === "a" || kCode === leftArrow) this.keys.left = false;
    if (keyLower === "d" || kCode === rightArrow) this.keys.right = false;

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
