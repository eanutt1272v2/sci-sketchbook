class InputHandler {
  constructor(appcore) {
    this.appcore = appcore;
    this.gesture = {
      pan: null,
      pinch: null,
    };
  }

  handleContinuousInput() {
    if (this.shouldIgnoreKeyboard() || this.appcore.params.renderKeymapRef) {
      return;
    }

    const { params } = this.appcore;
    const shiftHeld = KeyboardUtils.isShiftHeld();
    let needsRender = false;
    let syncViewConstraints = false;

    if (keyIsDown(LEFT_ARROW) || keyIsDown(RIGHT_ARROW)) {
      if (shiftHeld) {
        const step = max(0.25, params.viewRadius * 0.03);
        const delta = keyIsDown(RIGHT_ARROW) ? step : -step;
        this.panCurrentPlane(delta, 0);
      } else {
        params.sliceOffset = constrain(
          params.sliceOffset + (keyIsDown(RIGHT_ARROW) ? 0.5 : -0.5),
          -params.viewRadius,
          params.viewRadius,
        );
      }

      needsRender = true;
    }

    if (keyIsDown(UP_ARROW) || keyIsDown(DOWN_ARROW)) {
      if (shiftHeld) {
        const step = max(0.25, params.viewRadius * 0.03);
        const delta = keyIsDown(UP_ARROW) ? -step : step;
        this.panCurrentPlane(0, delta);
        needsRender = true;
      } else {
        const zoomIn = keyIsDown(UP_ARROW);
        const zoomOut = keyIsDown(DOWN_ARROW);

        if (zoomIn !== zoomOut) {
          const zoomScale = zoomOut ? 1.02 : 0.98;
          if (this.applyZoomAtNormalisedPoint(0.5, 0.5, zoomScale)) {
            needsRender = true;
            syncViewConstraints = true;
          }
        }
      }
    }

    if (keyIsDown(219) || keyIsDown(221)) {
      params.exposure = constrain(
        params.exposure + (keyIsDown(221) ? 0.01 : -0.01),
        0,
        2,
      );
      needsRender = true;
    }

    const isPlus = keyIsDown(187) || keyIsDown(61) || keyIsDown(107);
    const isMinus = keyIsDown(189) || keyIsDown(173) || keyIsDown(109);

    if (isPlus || isMinus) {
      params.resolution = constrain(
        params.resolution + (isPlus ? 2 : -2),
        64,
        512,
      );
      needsRender = true;
    }

    if (!needsRender) {
      return;
    }

    if (syncViewConstraints) {
      this.appcore.syncViewConstraints();
    } else {
      this.appcore.requestRender();
    }
  }

  handleKeyPressed(k) {
    const keyValue = KeyboardUtils.normaliseKey(k);

    if (keyValue === "#") {
      this.appcore.toggleKeymapRef();
      this.appcore.refreshGUI();
      console.log(`[Psi] Keymap Reference: ${this.appcore.params.renderKeymapRef}`);
      return false;
    }

    if (this.shouldIgnoreKeyboard()) {
      return false;
    }

    if (this.appcore.params.renderKeymapRef) {
      return false;
    }

    const keyLower = KeyboardUtils.toLower(keyValue);
    const shiftHeld = KeyboardUtils.isShiftHeld();

    if (shiftHeld && keyLower === "i") {
      this.appcore.media.importParamsJSON();
      return false;
    }

    if (shiftHeld && keyLower === "p") {
      this.appcore.media.exportParamsJSON();
      return false;
    }

    if (shiftHeld && keyLower === "u") {
      this.appcore.media.importStatisticsJSON();
      return false;
    }

    if (shiftHeld && keyLower === "s") {
      this.appcore.media.exportStatisticsJSON();
      return false;
    }

    if (shiftHeld && keyLower === "c") {
      this.appcore.media.exportStatisticsCSV();
      return false;
    }

    let logMsg = "";
    let shouldRefreshGUI = true;

    if (keyLower === "w" || keyLower === "s") {
      this.appcore.updateQuantumNumbers("n", keyLower === "w" ? 1 : -1);
      logMsg = `n changed to ${this.appcore.params.n}`;
    } else if (keyLower === "d" || keyLower === "a") {
      this.appcore.updateQuantumNumbers("l", keyLower === "d" ? 1 : -1);
      logMsg = `l changed to ${this.appcore.params.l}`;
    } else if (keyLower === "e" || keyLower === "q") {
      this.appcore.updateQuantumNumbers("m", keyLower === "e" ? 1 : -1);
      logMsg = `m changed to ${this.appcore.params.m}`;
    }

    const planes = { 1: "xy", 2: "xz", 3: "yz" };
    if (planes[keyValue]) {
      this.appcore.changePlane(planes[keyValue]);
      logMsg = `Plane switched to ${this.appcore.params.slicePlane.toUpperCase()}`;
    }

    switch (keyLower) {
      case "c":
        this.appcore.cycleColourMap();
        logMsg = `Map switched to ${this.appcore.params.colourMap}`;
        break;
      case "o":
        this.appcore.toggleOverlay();
        logMsg = `Overlay: ${this.appcore.params.renderOverlay}`;
        break;
      case "l":
        this.appcore.toggleLegend();
        logMsg = `Legend: ${this.appcore.params.renderLegend}`;
        break;
      case "m":
        this.appcore.toggleSmoothing();
        logMsg = `Smoothing: ${this.appcore.params.pixelSmoothing}`;
        break;
      case "h":
        this.appcore.toggleGUI();
        shouldRefreshGUI = false;
        break;
      case "p":
        this.appcore.exportImage();
        shouldRefreshGUI = false;
        break;
      case "x":
        this.appcore.resetViewCentre();
        logMsg = "View centre reset";
        break;
      case "z":
        this.appcore.resetViewRadius();
        logMsg = "View radius reset";
        break;
    }

    if (keyValue === " ") {
      this.appcore.resetSliceOffset();
      logMsg = "Offset reset to 0";
    }

    if (logMsg) {
      console.log(`[Psi] ${logMsg}`);
    }

    if (shouldRefreshGUI) {
      this.appcore.refreshGUI();
    }

    return false;
  }

  handleKeyReleased() {
    return false;
  }

  handleWheel(event) {
    if (!this.appcore.canvasInteraction(event)) {
      return;
    }

    const wheelDelta = constrain(event.delta || 0, -80, 80);
    const zoomScale = Math.exp(wheelDelta * 0.001);
    if (
      !this.applyZoomAtNormalisedPoint(
        mouseX / max(1, width),
        mouseY / max(1, height),
        zoomScale,
      )
    ) {
      return false;
    }

    this.appcore.requestRender();
    return false;
  }

  handlePointer(event) {
    if (!this.appcore.canvasInteraction(event)) {
      return;
    }

    const touchCount = touches.length;

    if (touchCount === 2) {
      this.handlePinch(touches[0], touches[1]);
      return false;
    }

    if (touchCount === 1) {
      this.handlePan(touches[0]);
      return false;
    }

    if (mouseIsPressed) {
      this.handlePan({ x: mouseX, y: mouseY });
      return false;
    }

    this.resetGesture();
  }

  handlePointerEnd(event) {
    const isCanvasInteraction = this.appcore.canvasInteraction(event);
    this.resetGesture();
    if (isCanvasInteraction) {
      return false;
    }
  }

  handlePan(pointer) {
    if (!this.gesture.pan) {
      this.gesture.pan = { x: pointer.x, y: pointer.y };
      this.gesture.pinch = null;
      return;
    }

    const dx = pointer.x - this.gesture.pan.x;
    const dy = pointer.y - this.gesture.pan.y;
    const worldScale = (this.appcore.params.viewRadius * 2) / max(1, width);

    this.panCurrentPlane(-dx * worldScale, -dy * worldScale);

    this.gesture.pan.x = pointer.x;
    this.gesture.pan.y = pointer.y;

    this.appcore.requestRender();
  }

  handlePinch(t1, t2) {
    const distance = dist(t1.x, t1.y, t2.x, t2.y);
    const cx = (t1.x + t2.x) / 2;
    const cy = (t1.y + t2.y) / 2;

    if (!this.gesture.pinch) {
      this.gesture.pinch = { distance };
      this.gesture.pan = null;
      return;
    }

    const ratio = distance / this.gesture.pinch.distance;
    const zoomScale = 1 / max(ratio, 1e-6);
    if (
      !this.applyZoomAtNormalisedPoint(
        cx / max(1, width),
        cy / max(1, height),
        zoomScale,
      )
    ) {
      return;
    }

    this.gesture.pinch.distance = distance;
    this.appcore.requestRender();
  }

  applyZoomAtNormalisedPoint(nx, ny, zoomScale) {
    const { params } = this.appcore;
    const oldRadius = params.viewRadius;
    const newRadius = constrain(oldRadius * zoomScale, 1, 256);

    if (newRadius === oldRadius) {
      return false;
    }

    const clampedNx = constrain(nx, 0, 1);
    const clampedNy = constrain(ny, 0, 1);
    const { axis1, axis2 } = this.appcore.getPlaneAxes();
    params.viewCentre[axis1] += (clampedNx - 0.5) * (oldRadius - newRadius) * 2;
    params.viewCentre[axis2] += (clampedNy - 0.5) * (oldRadius - newRadius) * 2;
    params.viewRadius = newRadius;

    return true;
  }

  panCurrentPlane(delta1, delta2) {
    const { axis1, axis2 } = this.appcore.getPlaneAxes();
    this.appcore.params.viewCentre[axis1] += delta1;
    this.appcore.params.viewCentre[axis2] += delta2;
  }

  resetGesture() {
    this.gesture.pan = null;
    this.gesture.pinch = null;
  }

  shouldIgnoreKeyboard() {
    return KeyboardUtils.isTypingTarget(document.activeElement);
  }
}
