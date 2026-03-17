class InputHandler {
  AppCore appcore;

  boolean keyUp, keyDown, keyLeft, keyRight, keyZoomIn, keyZoomOut;
  boolean isTypingIter = false;
  String typingBuffer = "";

  InputHandler(AppCore appcore) {
    this.appcore = appcore;
  }

  void handleContinuousInput() {
    UIPanel p = appcore.panel;
    if (p.dropdown.isOpen || p.slider.locked || isTypingIter) return;

    boolean changed = false;
    double speed = 0.05 / appcore.zoom;

    if (keyUp) { appcore.offsetY -= speed; changed = true; }
    if (keyDown) { appcore.offsetY += speed; changed = true; }
    if (keyLeft) { appcore.offsetX -= speed; changed = true; }
    if (keyRight) { appcore.offsetX += speed; changed = true; }
    if (keyZoomIn) { appcore.doZoom(1.05, width / 2, height / 2); changed = true; }
    if (keyZoomOut) { appcore.doZoom(1.0 / 1.05, width / 2, height / 2); changed = true; }
    if (mousePressed && appcore.showUI && !appcore.justPressed) {
      if (p.zoomInBtn.isMouseOver()) { appcore.doZoom(1.05, width / 2, height / 2); changed = true; }
      if (p.zoomOutBtn.isMouseOver()) { appcore.doZoom(1.0 / 1.05, width / 2, height / 2); changed = true; }
    }

    if (mousePressed && p.slider.locked && p.slider.update()) {
      appcore.maxIterations = (int) p.slider.val;
      changed = true;
    }

    if (changed) appcore.needsRedraw = true;
  }

  void onMousePressed() {
    appcore.justPressed = true;

    if (!appcore.showUI) return;
    UIPanel p = appcore.panel;

    if (p.dropdown.isOpen) {
      int clicked = p.dropdown.getClickedIndex();
      if (clicked != -1) {
        appcore.renderer.setMap(clicked);
        appcore.needsRedraw = true;
      }
      p.dropdown.isOpen = false;
      return;
    }
    if (p.dropdown.isHeaderOver()) { p.dropdown.toggle(); return; }

    UILayout lay = p.layout;
    if (mouseX > lay.contentX() && mouseX < lay.contentX() + 180
     && mouseY > lay.getY("iterLabel") && mouseY < lay.getY("iterLabel") + 20) {
      isTypingIter = true; typingBuffer = ""; return;
    } else {
      isTypingIter = false;
    }

    if (p.slider.isMouseOver()) {
      p.slider.locked = true;
      p.slider.val = constrain(
        map(mouseX, p.slider.x, p.slider.x + p.slider.w, p.slider.min, p.slider.max),
        p.slider.min, p.slider.max
      );
      appcore.maxIterations = (int) p.slider.val;
      appcore.needsRedraw = true;
    }

    int[] amounts = {-64, -16, 16, 64};
    for (int i = 0; i < 4; i++) {
      if (p.stepButtons[i].isMouseOver()) {
        appcore.maxIterations = constrain(appcore.maxIterations + amounts[i], (int)p.slider.min, (int)p.slider.max);
        p.slider.val = appcore.maxIterations;
        appcore.needsRedraw = true;
      }
    }

    if (p.zoomInBtn.isMouseOver()) { appcore.doZoom(1.05, width / 2, height / 2); appcore.needsRedraw = true; }
    if (p.zoomOutBtn.isMouseOver()) { appcore.doZoom(1.0 / 1.05, width / 2, height / 2); appcore.needsRedraw = true; }
  }

  void onMouseReleased() {
    appcore.panel.slider.locked = false;
  }

  void onMouseDragged() {
    UIPanel p = appcore.panel;
    if (p.slider.locked) {
      p.slider.val = constrain(
        map(mouseX, p.slider.x, p.slider.x + p.slider.w, p.slider.min, p.slider.max),
        p.slider.min, p.slider.max
      );
      appcore.maxIterations = (int) p.slider.val;
      appcore.needsRedraw = true;
      return;
    }

    if (appcore.showUI && (p.dropdown.isOpen || isTypingIter)) return;
    if (appcore.showUI && (p.zoomInBtn.isMouseOver() || p.zoomOutBtn.isMouseOver())) return;

    double ar = (double) width / height;
    appcore.offsetX -= (mouseX - pmouseX) * (3.2 * ar) / width / appcore.zoom;
    appcore.offsetY -= (mouseY - pmouseY) * 3.2 / height / appcore.zoom;
    appcore.needsRedraw = true;
  }

  void onMouseWheel(MouseEvent e) {
    if (appcore.showUI && appcore.panel.dropdown.isOpen) return;
    appcore.doZoom((e.getCount() < 0) ? 1.15 : 1.0 / 1.15, mouseX, mouseY);
    appcore.needsRedraw = true;
  }

  void onKeyPressed() {
    if (isTypingIter) {
      if (key >= '0' && key <= '9') {
        typingBuffer += key;
      } else if (keyCode == BACKSPACE && typingBuffer.length() > 0) {
        typingBuffer = typingBuffer.substring(0, typingBuffer.length() - 1);
      } else if (keyCode == ENTER || keyCode == RETURN) {
        if (typingBuffer.length() > 0) {
          appcore.maxIterations = constrain(int(typingBuffer), (int)appcore.panel.slider.min, (int)appcore.panel.slider.max);
          appcore.panel.slider.val = appcore.maxIterations;
          appcore.needsRedraw = true;
        }
        isTypingIter = false;
      } else if (keyCode == ESC) {
        isTypingIter = false;
      }
      return;
    }

    if (key == 'h' || key == 'H') appcore.showUI = !appcore.showUI;
    if (key == 'w' || key == 'W' || keyCode == UP) keyUp = true;
    if (key == 's' || key == 'S' || keyCode == DOWN) keyDown = true;
    if (key == 'a' || key == 'A' || keyCode == LEFT) keyLeft = true;
    if (key == 'd' || key == 'D' || keyCode == RIGHT) keyRight = true;
    if (key == 'e' || key == 'E' || key == '=' || key == '+') keyZoomIn = true;
    if (key == 'q' || key == 'Q' || key == '-') keyZoomOut = true;
  }

  void onKeyReleased() {
    if (key == 'w' || key == 'W' || keyCode == UP) keyUp = false;
    if (key == 's' || key == 'S' || keyCode == DOWN) keyDown = false;
    if (key == 'a' || key == 'A' || keyCode == LEFT) keyLeft = false;
    if (key == 'd' || key == 'D' || keyCode == RIGHT) keyRight = false;
    if (key == 'e' || key == 'E' || key == '=' || key == '+') keyZoomIn = false;
    if (key == 'q' || key == 'Q' || key == '-') keyZoomOut = false;
  }
}