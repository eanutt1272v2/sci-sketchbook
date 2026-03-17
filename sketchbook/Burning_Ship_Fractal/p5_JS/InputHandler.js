class InputHandler {
  constructor(appcore) {
    this.appcore = appcore;

    this.keyUp = false;
    this.keyDown = false;
    this.keyLeft = false;
    this.keyRight = false;
    this.keyZoomIn = false;
    this.keyZoomOut = false;

    this.isTypingIter = false;
    this.typingBuffer = "";
    this.pinchDistance = null;
  }

  handleContinuousInput() {
    const p = this.appcore.panel;
    if (this.appcore.showKeymapRef) {
      return;
    }

    if (p.dropdown.isOpen || p.slider.locked || this.isTypingIter) {
      return;
    }

    let changed = false;
    const speed = 0.05 / this.appcore.zoom;

    if (this.keyUp) {
      this.appcore.offsetY -= speed;
      changed = true;
    }
    if (this.keyDown) {
      this.appcore.offsetY += speed;
      changed = true;
    }
    if (this.keyLeft) {
      this.appcore.offsetX -= speed;
      changed = true;
    }
    if (this.keyRight) {
      this.appcore.offsetX += speed;
      changed = true;
    }
    if (this.keyZoomIn) {
      this.appcore.doZoom(1.05, width / 2, height / 2);
      changed = true;
    }
    if (this.keyZoomOut) {
      this.appcore.doZoom(1.0 / 1.05, width / 2, height / 2);
      changed = true;
    }

    if (mouseIsPressed && this.appcore.showUI && !this.appcore.justPressed) {
      if (p.zoomInBtn.isMouseOver()) {
        this.appcore.doZoom(1.05, width / 2, height / 2);
        changed = true;
      }
      if (p.zoomOutBtn.isMouseOver()) {
        this.appcore.doZoom(1.0 / 1.05, width / 2, height / 2);
        changed = true;
      }
    }

    if (mouseIsPressed && p.slider.locked && p.slider.update()) {
      this.appcore.maxIterations = int(p.slider.val);
      changed = true;
    }

    if (changed) {
      this.appcore.needsRedraw = true;
    }
  }

  onMousePressed() {
    if (!this.appcore.showUI) {
      return;
    }

    const p = this.appcore.panel;

    if (p.dropdown.isOpen) {
      const clicked = p.dropdown.getClickedIndex();
      if (clicked !== -1 && !this.appcore.justPressed) {
        this.appcore.renderer.setMap(clicked);
        this.appcore.needsRedraw = true;
        this.appcore.justPressed = true;
      }
      p.dropdown.isOpen = false;
      return;
    }

    if (p.dropdown.isHeaderOver() && !this.appcore.justPressed) {
      p.dropdown.toggle();
      this.appcore.justPressed = true;
      return;
    }

    const lay = p.layout;
    if (
      mouseX > lay.contentX() && mouseX < lay.contentX() + 250 &&
      mouseY > lay.getY("iterLabel") && mouseY < lay.getY("iterLabel") + 20
    ) {
      this.isTypingIter = true;
      this.typingBuffer = "";
      return;
    }

    this.isTypingIter = false;

    if (p.slider.isMouseOver()) {
      p.slider.locked = true;
      p.slider.val = constrain(
        map(mouseX, p.slider.x, p.slider.x + p.slider.w, p.slider.min, p.slider.max),
        p.slider.min,
        p.slider.max
      );
      this.appcore.maxIterations = int(p.slider.val);
      this.appcore.needsRedraw = true;
    }

    const amounts = [-64, -16, 16, 64];
    for (let i = 0; i < 4; i++) {
      if (p.stepButtons[i].isMouseOver() && !this.appcore.justPressed) {
        this.appcore.maxIterations = constrain(this.appcore.maxIterations + amounts[i], int(p.slider.min), int(p.slider.max));
        p.slider.val = this.appcore.maxIterations;
        this.appcore.needsRedraw = true;
        this.appcore.justPressed = true;
      }
    }

    if (p.zoomInBtn.isMouseOver() && !this.appcore.justPressed) {
      this.appcore.doZoom(1.05, width / 2, height / 2);
      this.appcore.needsRedraw = true;
      this.appcore.justPressed = true;
    }

    if (p.zoomOutBtn.isMouseOver() && !this.appcore.justPressed) {
      this.appcore.doZoom(1.0 / 1.05, width / 2, height / 2);
      this.appcore.needsRedraw = true;
      this.appcore.justPressed = true;
    }
  }

  onMouseReleased() {
    this.appcore.panel.slider.locked = false;
    // ! Watch this flag carefully to avoid issues with click-drag interactions on the UI
    this.appcore.justPressed = false;
    this.pinchDistance = null;
  }

  onTouchStarted() {
    if (touches.length === 2) {
      const t1 = touches[0];
      const t2 = touches[1];
      this.pinchDistance = dist(t1.x, t1.y, t2.x, t2.y);
      return;
    }

    this.pinchDistance = null;
    this.onMousePressed();
  }

  onTouchMoved() {
    if (touches.length === 2) {
      if (this.appcore.showUI && this.appcore.panel.dropdown.isOpen) {
        return;
      }

      const t1 = touches[0];
      const t2 = touches[1];
      const distance = dist(t1.x, t1.y, t2.x, t2.y);
      const cx = (t1.x + t2.x) * 0.5;
      const cy = (t1.y + t2.y) * 0.5;

      if (this.pinchDistance && this.pinchDistance > 0) {
        const factor = distance / this.pinchDistance;
        if (isFinite(factor) && factor > 0) {
          this.appcore.doZoom(factor, cx, cy);
          this.appcore.needsRedraw = true;
        }
      }

      this.pinchDistance = distance;
      return;
    }

    this.pinchDistance = null;
    this.onMouseDragged();
  }

  onTouchEnded() {
    this.pinchDistance = null;
    this.onMouseReleased();
  }

  onMouseDragged() {
    const p = this.appcore.panel;
    if (p.slider.locked) {
      p.slider.val = constrain(
        map(mouseX, p.slider.x, p.slider.x + p.slider.w, p.slider.min, p.slider.max),
        p.slider.min,
        p.slider.max
      );
      this.appcore.maxIterations = int(p.slider.val);
      this.appcore.needsRedraw = true;
      return;
    }

    if (this.appcore.showUI && (p.dropdown.isOpen || this.isTypingIter)) {
      return;
    }
    if (this.appcore.showUI && (p.zoomInBtn.isMouseOver() || p.zoomOutBtn.isMouseOver())) {
      return;
    }

    const ar = width / height;
    this.appcore.offsetX -= (mouseX - pmouseX) * (3.2 * ar) / width / this.appcore.zoom;
    this.appcore.offsetY -= (mouseY - pmouseY) * 3.2 / height / this.appcore.zoom;
    this.appcore.needsRedraw = true;
  }

  onMouseWheel(event) {
    if (this.appcore.showUI && this.appcore.panel.dropdown.isOpen) {
      return;
    }
    this.appcore.doZoom(event.delta < 0 ? 1.15 : 1.0 / 1.15, mouseX, mouseY);
    this.appcore.needsRedraw = true;
  }

  onKeyPressed() {
    if (this.isTypingIter) {
      if (key >= "0" && key <= "9") {
        this.typingBuffer += key;
      } else if (keyCode === BACKSPACE && this.typingBuffer.length > 0) {
        this.typingBuffer = this.typingBuffer.substring(0, this.typingBuffer.length - 1);
      } else if (keyCode === ENTER || keyCode === RETURN) {
        if (this.typingBuffer.length > 0) {
          this.appcore.maxIterations = constrain(int(this.typingBuffer), int(this.appcore.panel.slider.min), int(this.appcore.panel.slider.max));
          this.appcore.panel.slider.val = this.appcore.maxIterations;
          this.appcore.needsRedraw = true;
        }
        this.isTypingIter = false;
      } else if (keyCode === ESCAPE) {
        this.isTypingIter = false;
      }
      return;
    }

    if (key === "h" || key === "H") this.appcore.showUI = !this.appcore.showUI;
    if (key === "#") {
      this.appcore.showKeymapRef = !this.appcore.showKeymapRef;
      return;
    }
    if (key === "r" || key === "R") {
      this.appcore.resetView();
      return;
    }
    if (key === "c" || key === "C") {
      this.appcore.cycleColorMap(1);
      return;
    }
    if (key === "x" || key === "X") {
      this.appcore.cycleColorMap(-1);
      return;
    }
    if (key === "[" || key === "{") {
      this.appcore.maxIterations = constrain(this.appcore.maxIterations - (key === "{" ? 64 : 16), int(this.appcore.panel.slider.min), int(this.appcore.panel.slider.max));
      this.appcore.panel.slider.val = this.appcore.maxIterations;
      this.appcore.needsRedraw = true;
      return;
    }
    if (key === "]" || key === "}") {
      this.appcore.maxIterations = constrain(this.appcore.maxIterations + (key === "}" ? 64 : 16), int(this.appcore.panel.slider.min), int(this.appcore.panel.slider.max));
      this.appcore.panel.slider.val = this.appcore.maxIterations;
      this.appcore.needsRedraw = true;
      return;
    }

    if (key >= "1" && key <= "9") {
      const idx = int(key) - 1;
      if (idx < this.appcore.renderer.mapNames.length) {
        this.appcore.renderer.setMap(idx);
        this.appcore.needsRedraw = true;
      }
      return;
    }

    if (key === "w" || key === "W" || keyCode === UP_ARROW) this.keyUp = true;
    if (key === "s" || key === "S" || keyCode === DOWN_ARROW) this.keyDown = true;
    if (key === "a" || key === "A" || keyCode === LEFT_ARROW) this.keyLeft = true;
    if (key === "d" || key === "D" || keyCode === RIGHT_ARROW) this.keyRight = true;
    if (key === "e" || key === "E" || key === "=" || key === "+") this.keyZoomIn = true;
    if (key === "q" || key === "Q" || key === "-") this.keyZoomOut = true;
  }

  onKeyReleased() {
    if (key === "w" || key === "W" || keyCode === UP_ARROW) this.keyUp = false;
    if (key === "s" || key === "S" || keyCode === DOWN_ARROW) this.keyDown = false;
    if (key === "a" || key === "A" || keyCode === LEFT_ARROW) this.keyLeft = false;
    if (key === "d" || key === "D" || keyCode === RIGHT_ARROW) this.keyRight = false;
    if (key === "e" || key === "E" || key === "=" || key === "+") this.keyZoomIn = false;
    if (key === "q" || key === "Q" || key === "-") this.keyZoomOut = false;
  }
}
