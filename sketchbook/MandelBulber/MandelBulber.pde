/**
 * @file MandelBulber.pde
 * @author @eanutt1272.v2
 * @version 3.7.0
 */

AppCore appcore;

void settings() {
  size(1024, 1024, P3D);
  pixelDensity(displayDensity());
}

void setup() {
  surface.setResizable(false);

  javax.swing.SwingUtilities.invokeLater(new Runnable() {
    public void run() {
      com.jogamp.newt.opengl.GLWindow window = (com.jogamp.newt.opengl.GLWindow) surface.getNative();
      window.setUndecorated(false);
      window.setSize(width, height);
    }
  });

  appcore = new AppCore();
  appcore.setup();
}

void draw() { appcore.draw(); }
void mousePressed() { appcore.input.onMousePressed(); }
void mouseReleased() { appcore.input.onMouseReleased(); }
void mouseDragged() { appcore.input.onMouseDragged(); }
void mouseWheel(MouseEvent e) { appcore.input.onMouseWheel(e); }
void keyPressed() { appcore.input.onKeyPressed(); }
void keyReleased() { appcore.input.onKeyReleased(); }

class AppCore {
  float radiansX = -PI / 4;
  float radiansY = -PI / 4;
  boolean showUI = true;

  boolean justPressed = false;
  boolean keyUp, keyDown, keyLeft, keyRight, keyZoomIn, keyZoomOut;

  PGraphics sceneBuffer;
  PGraphics uiBuffer;

  UITheme theme;
  UIPanel panel;
  BulbRenderer renderer;
  InputHandler input;

  void setup() {
    sceneBuffer = createGraphics(width, height, P3D);
    uiBuffer = createGraphics(width, height, P2D);

    theme = new UITheme();
    renderer = new BulbRenderer(this);
    panel = new UIPanel(this);
    input = new InputHandler(this);

    renderer.startCompute();
  }

  void draw() {
    input.handleContinuousInput();

    sceneBuffer.beginDraw();
    sceneBuffer.background(0);
    sceneBuffer.lights();
    sceneBuffer.translate(sceneBuffer.width / 2.0, sceneBuffer.height / 2.0);
    sceneBuffer.rotateX(constrain(radiansX, -HALF_PI, HALF_PI));
    sceneBuffer.rotateY(radiansY);
    renderer.drawAxes();
    renderer.drawAxesLabels();
    renderer.drawBulb();
    sceneBuffer.endDraw();

    uiBuffer.beginDraw();
    uiBuffer.clear();
    if (showUI) panel.draw();
    uiBuffer.endDraw();

    background(0);
    image(sceneBuffer, 0, 0);
    image(uiBuffer, 0, 0);

    justPressed = false;
  }
}

class BulbRenderer {
  AppCore appcore;

  int maximumIterations = 8;
  int power = 8;
  int resolutionScale = 128;
  int objectSize = 175;

  float axesLength() { return objectSize * 2.857; }

  int[] powerValues = {2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 16};
  int[] resolutionValues = {32, 48, 64, 96, 128, 192, 256};

  volatile ArrayList<PVector> bulbPoints = new ArrayList<PVector>();

  volatile boolean isComputing = false;
  java.util.concurrent.atomic.AtomicInteger computedSlices = new java.util.concurrent.atomic.AtomicInteger(0);
  volatile int totalSlices = 1;
  volatile long computeStartMs = 0;
  volatile int lastPointCount = 0;

  final Object swapLock = new Object();

  BulbRenderer(AppCore appcore) {
    this.appcore = appcore;
  }

  void startCompute() {
    if (isComputing) return;
    isComputing = true;
    computedSlices.set(0);
    totalSlices = resolutionScale;
    computeStartMs = System.currentTimeMillis();

    final int res = resolutionScale;
    final int maxIter = maximumIterations;
    final int pw = power;
    final int objSz = objectSize;
    final double step = 2.0 / res;
    final double origin = -1.0 + step * 0.5;
    final int nThreads = Runtime.getRuntime().availableProcessors();
    final BulbRenderer self = this;

    new Thread(new Runnable() {
      public void run() {
        final java.util.List<ArrayList<PVector>> threadResults =
          new java.util.ArrayList<ArrayList<PVector>>(nThreads);
        for (int t = 0; t < nThreads; t++) {
          threadResults.add(new ArrayList<PVector>());
        }

        final java.util.concurrent.CountDownLatch latch =
          new java.util.concurrent.CountDownLatch(nThreads);

        java.util.concurrent.ExecutorService pool =
          java.util.concurrent.Executors.newFixedThreadPool(nThreads);

        for (int t = 0; t < nThreads; t++) {
          final int threadIdx = t;
          final ArrayList<PVector> localPoints = threadResults.get(t);

          pool.submit(new Runnable() {
            public void run() {
              for (int i = threadIdx; i < res; i += nThreads) {
                double cx = origin + i * step;

                for (int j = 0; j < res; j++) {
                  double cy = origin + j * step;
                  boolean edge = false;

                  for (int k = 0; k < res; k++) {
                    double cz = origin + k * step;

                    double zx = cx, zy = cy, zz = cz;
                    boolean bounded = false;

                    for (int iter = 1; iter <= maxIter; iter++) {
                      double zx2 = zx * zx;
                      double zy2 = zy * zy;
                      double zz2 = zz * zz;
                      double r2 = zx2 + zy2 + zz2;

                      if (r2 > 4.0) break;

                      double r = Math.sqrt(r2);
                      double theta = Math.atan2(Math.sqrt(zx2 + zy2), zz);
                      double phi = Math.atan2(zy, zx);
                      double rn = Math.pow(r, pw);
                      double sinTheta = Math.sin(theta * pw);

                      zx = rn * sinTheta * Math.cos(phi * pw) + cx;
                      zy = rn * sinTheta * Math.sin(phi * pw) + cy;
                      zz = rn * Math.cos(theta * pw) + cz;

                      if (iter == maxIter) {
                        bounded = true;
                        break;
                      }
                    }

                    if (bounded) {
                      if (!edge) {
                        edge = true;
                        localPoints.add(new PVector((float)(cx * objSz), (float)(cy * objSz), (float)(cz * objSz)));
                      }
                    } else {
                      edge = false;
                    }
                  }
                }
                self.computedSlices.incrementAndGet();
              }
              latch.countDown();
            }
          });
        }

        try {
          latch.await();
        } catch (InterruptedException e) {
          Thread.currentThread().interrupt();
        }
        pool.shutdown();

        ArrayList<PVector> newPoints = new ArrayList<PVector>();
        for (ArrayList<PVector> localPoints : threadResults) {
          newPoints.addAll(localPoints);
        }

        synchronized (self.swapLock) {
          self.bulbPoints = newPoints;
          self.lastPointCount = newPoints.size();
          self.isComputing = false;
        }
      }
    }).start();
  }

  void drawBulb() {
    PGraphics g = appcore.sceneBuffer;
    ArrayList<PVector> pts;
    synchronized (swapLock) { pts = bulbPoints; }
    g.strokeWeight(1);
    g.stroke(255, 255);
    g.noFill();
    for (PVector v : pts) {
      g.point(v.y, v.z, v.x);
    }
  }

  void drawAxes() {
    PGraphics g = appcore.sceneBuffer;
    float al = axesLength();
    g.strokeWeight(1.5);
    g.stroke(255, 60, 60);
    g.line(-al / 2, 0, 0, al / 2, 0, 0);
    g.stroke(60, 255, 60);
    g.line(0, -al / 2, 0, 0, al / 2, 0);
    g.stroke(60, 60, 255);
    g.line(0, 0, -al / 2, 0, 0, al / 2);
  }

  void drawAxesLabels() {
    PGraphics g = appcore.sceneBuffer;
    float al = axesLength();
    g.textSize(14);
    g.textAlign(CENTER, CENTER);
    g.fill(255, 60, 60);
    g.text("+X", (al / 2) + 18, 0, 0);
    g.text("-X", -(al / 2) - 18, 0, 0);
    g.fill(60, 255, 60);
    g.text("+Y", 0, (al / 2) + 18, 0);
    g.text("-Y", 0, -(al / 2) - 18, 0);
    g.fill(60, 60, 255);
    g.text("+Z", 0, 0, (al / 2) + 18);
    g.text("-Z", 0, 0, -(al / 2) - 18);
  }

  void rescalePoints(int oldSize) {
    float ratio = (float) objectSize / oldSize;
    for (PVector v : bulbPoints) {
      v.mult(ratio);
    }
  }
}

class InputHandler {

  AppCore appcore;
  float rotateSensitivity = 0.008;
  float keyRotateSpeed = 0.03;
  float zoomFactor = 1.05;

  InputHandler(AppCore appcore) {
    this.appcore = appcore;
  }

  void handleContinuousInput() {
    UIPanel p = appcore.panel;

    if (!p.collapsed) {
      if (p.dropdown.isOpen || p.resDropdown.isOpen || p.iterSlider.locked || p.resSlider.locked) return;
    }

    if (appcore.keyUp) appcore.radiansX -= keyRotateSpeed;
    if (appcore.keyDown) appcore.radiansX += keyRotateSpeed;
    if (appcore.keyLeft) appcore.radiansY -= keyRotateSpeed;
    if (appcore.keyRight) appcore.radiansY += keyRotateSpeed;
    if (appcore.keyZoomIn) doZoom(zoomFactor);
    if (appcore.keyZoomOut) doZoom(1.0 / zoomFactor);

    if (mousePressed && appcore.showUI && !appcore.justPressed) {
      if (p.zoomInBtn.isMouseOver()) doZoom(zoomFactor);
      if (p.zoomOutBtn.isMouseOver()) doZoom(1.0 / zoomFactor);
    }

    if (!p.collapsed) {
      if (mousePressed && p.iterSlider.locked && p.iterSlider.update()) {
        appcore.renderer.maximumIterations = (int) p.iterSlider.val;
      }
      if (mousePressed && p.resSlider.locked && p.resSlider.update()) {
        appcore.renderer.resolutionScale = (int) p.resSlider.val;
      }
    }
  }

  void onMousePressed() {
    appcore.justPressed = true;

    if (!appcore.showUI) return;
    UIPanel p = appcore.panel;

    if (p.isHeaderOver()) {
      p.collapsed = !p.collapsed;
      return;
    }

    if (p.collapsed) return;

    if (p.dropdown.isOpen) {
      int clicked = p.dropdown.getClickedIndex();
      if (clicked != -1) appcore.renderer.power = appcore.renderer.powerValues[clicked];
      p.dropdown.isOpen = false;
      return;
    }
    if (p.dropdown.isHeaderOver()) { p.dropdown.toggle(); return; }

    if (p.resDropdown.isOpen) {
      int clicked = p.resDropdown.getClickedIndex();
      if (clicked != -1) {
        appcore.renderer.resolutionScale = appcore.renderer.resolutionValues[clicked];
        p.resSlider.val = appcore.renderer.resolutionScale;
      }
      p.resDropdown.isOpen = false;
      return;
    }
    if (p.resDropdown.isHeaderOver()) { p.resDropdown.toggle(); return; }

    UILayout lay = p.layout;
    if (mouseX > lay.contentX() && mouseX < lay.contentX() + 180
     && mouseY > lay.getY("iterLabel") && mouseY < lay.getY("iterLabel") + 20) {
      p.isTypingIter = true; p.iterTypingBuffer = ""; return;
    } else {
      p.isTypingIter = false;
    }

    if (mouseX > lay.contentX() && mouseX < lay.contentX() + 180
     && mouseY > lay.getY("resLabel") && mouseY < lay.getY("resLabel") + 20) {
      p.isTypingRes = true; p.resTypingBuffer = ""; return;
    } else {
      p.isTypingRes = false;
    }

    if (p.recomputeBtn.isMouseOver() && !appcore.renderer.isComputing) { appcore.renderer.startCompute(); return; }

    if (p.iterSlider.isMouseOver()) {
      p.iterSlider.locked = true;
      p.iterSlider.val = constrain(map(mouseX, p.iterSlider.x, p.iterSlider.x + p.iterSlider.w, p.iterSlider.min, p.iterSlider.max), p.iterSlider.min, p.iterSlider.max);
      appcore.renderer.maximumIterations = (int) p.iterSlider.val;
    }

    if (p.resSlider.isMouseOver()) {
      p.resSlider.locked = true;
      p.resSlider.val = constrain(map(mouseX, p.resSlider.x, p.resSlider.x + p.resSlider.w, p.resSlider.min, p.resSlider.max),p.resSlider.min, p.resSlider.max);
      appcore.renderer.resolutionScale = (int) p.resSlider.val;
    }

    int[] iterAmounts = {-4, -1, 1, 4};
    for (int i = 0; i < 4; i++) {
      if (p.iterStepButtons[i].isMouseOver()) {
        appcore.renderer.maximumIterations = constrain(appcore.renderer.maximumIterations + iterAmounts[i], (int) p.iterSlider.min, (int) p.iterSlider.max);
        p.iterSlider.val = appcore.renderer.maximumIterations;
      }
    }

    int[] resAmounts = {-32, -16, 16, 32};
    for (int i = 0; i < 4; i++) {
      if (p.resStepButtons[i].isMouseOver()) {
        appcore.renderer.resolutionScale = constrain(appcore.renderer.resolutionScale + resAmounts[i], (int) p.resSlider.min, (int) p.resSlider.max);
        p.resSlider.val = appcore.renderer.resolutionScale;
      }
    }

    if (p.zoomInBtn.isMouseOver()) doZoom(zoomFactor);
    if (p.zoomOutBtn.isMouseOver()) doZoom(1.0 / zoomFactor);
  }

  void onMouseReleased() {
    appcore.panel.iterSlider.locked = false;
    appcore.panel.resSlider.locked = false;
  }

  void onMouseDragged() {
    UIPanel p = appcore.panel;

    if (!p.collapsed) {
      if (p.iterSlider.locked) {
        p.iterSlider.val = constrain(map(mouseX, p.iterSlider.x, p.iterSlider.x + p.iterSlider.w, p.iterSlider.min, p.iterSlider.max), p.iterSlider.min, p.iterSlider.max);
        appcore.renderer.maximumIterations = (int) p.iterSlider.val;
        return;
      }
      if (p.resSlider.locked) {
        p.resSlider.val = constrain(map(mouseX, p.resSlider.x, p.resSlider.x + p.resSlider.w, p.resSlider.min, p.resSlider.max), p.resSlider.min, p.resSlider.max);
        appcore.renderer.resolutionScale = (int) p.resSlider.val;
        return;
      }
      if (appcore.showUI && (p.dropdown.isOpen || p.resDropdown.isOpen)) return;
    }

    if (appcore.showUI && (p.zoomInBtn.isMouseOver() || p.zoomOutBtn.isMouseOver())) return;

    appcore.radiansX += (pmouseY - mouseY) * rotateSensitivity;
    appcore.radiansY -= (pmouseX - mouseX) * rotateSensitivity;
  }

  void onMouseWheel(MouseEvent e) {
    UIPanel p = appcore.panel;
    if (!p.collapsed && appcore.showUI && (p.dropdown.isOpen || p.resDropdown.isOpen)) return;
    doZoom(e.getCount() < 0 ? 1.15 : 1.0 / 1.15);
  }

  void onKeyPressed() {
    UIPanel p = appcore.panel;

    if (!p.collapsed) {
      if (p.isTypingIter) {
        if (key >= '0' && key <= '9') {
          p.iterTypingBuffer += key;
        } else if (keyCode == BACKSPACE && p.iterTypingBuffer.length() > 0) {
          p.iterTypingBuffer = p.iterTypingBuffer.substring(0, p.iterTypingBuffer.length() - 1);
        } else if (keyCode == ENTER || keyCode == RETURN) {
          if (p.iterTypingBuffer.length() > 0) {
            appcore.renderer.maximumIterations = constrain( int(p.iterTypingBuffer), (int) p.iterSlider.min, (int) p.iterSlider.max);
            p.iterSlider.val = appcore.renderer.maximumIterations;
          }
          p.isTypingIter = false;
        } else if (keyCode == ESC) {
          p.isTypingIter = false;
        }
        return;
      }

      if (p.isTypingRes) {
        if (key >= '0' && key <= '9') {
          p.resTypingBuffer += key;
        } else if (keyCode == BACKSPACE && p.resTypingBuffer.length() > 0) {
          p.resTypingBuffer = p.resTypingBuffer.substring(0, p.resTypingBuffer.length() - 1);
        } else if (keyCode == ENTER || keyCode == RETURN) {
          if (p.resTypingBuffer.length() > 0) {
            appcore.renderer.resolutionScale = constrain(int(p.resTypingBuffer), (int) p.resSlider.min, (int) p.resSlider.max);
            p.resSlider.val = appcore.renderer.resolutionScale;
          }
          p.isTypingRes = false;
        } else if (keyCode == ESC) {
          p.isTypingRes = false;
        }
        return;
      }
    }

    if (key == 'h' || key == 'H') appcore.showUI = !appcore.showUI;
    if (key == 'r' || key == 'R') { if (!appcore.renderer.isComputing) appcore.renderer.startCompute(); }
    if (key == 'w' || key == 'W' || keyCode == UP) appcore.keyUp = true;
    if (key == 's' || key == 'S' || keyCode == DOWN) appcore.keyDown = true;
    if (key == 'a' || key == 'A' || keyCode == LEFT) appcore.keyLeft = true;
    if (key == 'd' || key == 'D' || keyCode == RIGHT) appcore.keyRight = true;
    if (key == 'e' || key == 'E' || key == '=' || key == '+') appcore.keyZoomIn = true;
    if (key == 'q' || key == 'Q' || key == '-') appcore.keyZoomOut = true;
  }

  void onKeyReleased() {
    if (key == 'w' || key == 'W' || keyCode == UP) appcore.keyUp = false;
    if (key == 's' || key == 'S' || keyCode == DOWN) appcore.keyDown = false;
    if (key == 'a' || key == 'A' || keyCode == LEFT) appcore.keyLeft = false;
    if (key == 'd' || key == 'D' || keyCode == RIGHT) appcore.keyRight = false;
    if (key == 'e' || key == 'E' || key == '=' || key == '+') appcore.keyZoomIn = false;
    if (key == 'q' || key == 'Q' || key == '-') appcore.keyZoomOut = false;
  }

  private void doZoom(float factor) {
    int oldSize = appcore.renderer.objectSize;
    appcore.renderer.objectSize = constrain(round(oldSize * factor), 50, 600);
    if (appcore.renderer.objectSize != oldSize) {
      appcore.renderer.rescalePoints(oldSize);
    }
  }
}

class UIPanel {
  AppCore appcore;
  UILayout layout;

  static final int PANEL_W = 280;
  static final float HEADER_H = 28;
  static final float PANEL_X = 10;
  static final float PANEL_Y = 10;

  Slider iterSlider;
  Slider resSlider;
  Dropdown dropdown;
  Dropdown resDropdown;
  Button recomputeBtn;
  Button zoomInBtn, zoomOutBtn;
  Button[] iterStepButtons = new Button[4];
  Button[] resStepButtons = new Button[4];

  boolean collapsed = false;

  boolean isTypingIter = false;
  String iterTypingBuffer = "";
  boolean isTypingRes = false;
  String resTypingBuffer = "";

  UIPanel(AppCore appcore) {
    this.appcore = appcore;
    buildLayout();
  }

  void buildLayout() {
    layout = new UILayout(PANEL_X, PANEL_Y + HEADER_H, PANEL_W, 10, 8, 16);

    layout.add("iterLabel",     16, "iterCtrl");
    layout.add("iterSlider",    22, "iterCtrl");
    layout.add("iterStepBtns",  28, "iterCtrl");
    layout.add("powerDropdown", 26, "iterCtrl");

    layout.add("resLabel",      16, "resCtrl");
    layout.add("resSlider",     22, "resCtrl");
    layout.add("resStepBtns",   28, "resCtrl");
    layout.add("resDropdown",   26, "resCtrl");
    layout.add("recompute",     28, "resCtrl");
    layout.add("progress",      22, "resCtrl");

    layout.add("rotInfo",  16, "info");
    layout.add("sizeInfo", 16, "info");
    layout.add("hints",    12, "info");

    layout.finish();

    float cx = layout.contentX();
    float cw = layout.contentW();

    float si = 6;
    iterSlider = new Slider(cx + si, layout.getY("iterSlider"), cw - si * 2, 22, 1, 32, appcore.renderer.maximumIterations);
    resSlider  = new Slider(cx + si, layout.getY("resSlider"),  cw - si * 2, 22, 32, 256, appcore.renderer.resolutionScale);

    String[] stepLabels = {"--", "-", "+", "++"};
    float iterStepY = layout.getY("iterStepBtns");
    float resStepY  = layout.getY("resStepBtns");
    for (int i = 0; i < 4; i++) {
      iterStepButtons[i] = new Button(cx + i * 38, iterStepY, 32, 28, stepLabels[i]);
      resStepButtons[i]  = new Button(cx + i * 38, resStepY, 32, 28, stepLabels[i]);
    }

    String[] powerLabels = new String[appcore.renderer.powerValues.length];
    for (int i = 0; i < powerLabels.length; i++) {
      powerLabels[i] = "Power: " + appcore.renderer.powerValues[i];
    }
    dropdown = new Dropdown(cx, layout.getY("powerDropdown"), cw, 26, powerLabels);

    String[] resLabels = new String[appcore.renderer.resolutionValues.length];
    for (int i = 0; i < resLabels.length; i++) {
      resLabels[i] = "Res: " + appcore.renderer.resolutionValues[i];
    }
    resDropdown = new Dropdown(cx, layout.getY("resDropdown"), cw, 26, resLabels);

    recomputeBtn = new Button(cx, layout.getY("recompute"), 110, 28, "Recompute");

    zoomInBtn  = new Button(width - 80, height - 150, 56, 56, "+");
    zoomOutBtn = new Button(width - 80, height - 80,  56, 56, "-");
  }

  boolean isHeaderOver() {
    return mouseX > PANEL_X && mouseX < PANEL_X + PANEL_W && mouseY > PANEL_Y && mouseY < PANEL_Y + HEADER_H;
  }

  void draw() {
    PGraphics g = appcore.uiBuffer;
    UITheme t = appcore.theme;
    BulbRenderer r = appcore.renderer;

    g.colorMode(RGB, 255);

    float totalPanelH = collapsed ? HEADER_H : HEADER_H + layout.totalHeight;

    g.fill(t.bgPanel);
    g.stroke(t.strokePanel);
    g.strokeWeight(t.swPanel);
    g.rect(PANEL_X, PANEL_Y, PANEL_W, totalPanelH, 4);

    g.fill(t.bgWidget);
    g.noStroke();
    if (collapsed) {
      g.rect(PANEL_X, PANEL_Y, PANEL_W, HEADER_H, 4);
    } else {
      g.rect(PANEL_X, PANEL_Y, PANEL_W, HEADER_H, 4, 4, 0, 0);
    }

    g.fill(t.textPrimary);
    g.textSize(t.textSizeSecondary);
    g.textAlign(LEFT, CENTER);
    g.text("MandelBulber", PANEL_X + 12, PANEL_Y + HEADER_H / 2);

    drawChevron(g, t, PANEL_X + PANEL_W - 18, PANEL_Y + HEADER_H / 2, collapsed);

    if (!collapsed) {
      g.stroke(t.strokeSeparator);
      g.strokeWeight(t.swSeparator);
      g.line(PANEL_X, PANEL_Y + HEADER_H, PANEL_X + PANEL_W, PANEL_Y + HEADER_H);
    }

    if (collapsed) {
      zoomInBtn.display(g, t);
      zoomOutBtn.display(g, t);
      return;
    }

    float cx = layout.contentX();

    for (float sy : layout.separatorYs()) {
      g.stroke(t.strokeSeparator);
      g.strokeWeight(t.swSeparator);
      g.line(cx, sy, PANEL_X + PANEL_W - layout.padding, sy);
    }

    g.fill(t.textPrimary);
    g.textSize(t.textSizeSecondary);
    g.textAlign(LEFT, TOP);
    g.text(isTypingIter ? "Iterations: " + iterTypingBuffer + "_" : "Iterations: " + r.maximumIterations, cx, layout.getY("iterLabel"));

    iterSlider.display(g, t);
    for (Button b : iterStepButtons) b.display(g, t);

    g.fill(t.textPrimary);
    g.textSize(t.textSizeSecondary);
    g.textAlign(LEFT, TOP);
    g.text(isTypingRes ? "Resolution: " + resTypingBuffer + "_" : "Resolution: " + r.resolutionScale, cx, layout.getY("resLabel"));

    resSlider.display(g, t);
    for (Button b : resStepButtons) b.display(g, t);

    recomputeBtn.display(g, t);

    float px = layout.contentX();
    float pw = layout.contentW();
    float barY = layout.getY("progress");
    float barTrackY = barY + 12;
    float barH = 7;

    if (r.isComputing) {
      int done = r.computedSlices.get();
      int total = r.totalSlices;
      float progress = total > 0 ? (float) done / total : 0;
      long elapsedMs = System.currentTimeMillis() - r.computeStartMs;
      String elapsedStr = nf(elapsedMs / 1000.0, 1, 1) + "s";
      int pct = (int)(progress * 100);

      g.fill(t.textMuted);
      g.textSize(t.textSizeCaption);
      g.textAlign(LEFT, TOP);
      g.text("Computing...  " + pct + "%  " + elapsedStr, px, barY);

      g.noStroke();
      g.fill(t.bgWidget);
      g.rect(px, barTrackY, pw, barH, 3);
      if (progress > 0) {
        g.fill(t.accentHandle);
        g.rect(px, barTrackY, pw * progress, barH, 3);
      }
    } else {
      g.fill(t.textMuted);
      g.textSize(t.textSizeCaption);
      g.textAlign(LEFT, TOP);
      long total = (long) r.resolutionScale * r.resolutionScale * r.resolutionScale;
      g.text("Voxels: " + nf(total / 1000000.0, 1, 1) + "M  Points: " + r.lastPointCount, px, barY);

      g.noStroke();
      g.fill(t.bgWidget);
      g.rect(px, barTrackY, pw, barH, 3);
      g.fill(t.strokeFocus);
      g.rect(px, barTrackY, pw * min(1.0, r.lastPointCount > 0 ? 1.0 : 0.0), barH, 3);
    }

    g.fill(t.textSecondary);
    g.textSize(t.textSizeSecondary);
    g.textAlign(LEFT, TOP);
    float degX = appcore.radiansX * (180.0 / PI);
    float degY = appcore.radiansY * (180.0 / PI);
    g.text("X=" + nf(degX, 1, 1) + "\u00b0  Y=" + nf(degY, 1, 1) + "\u00b0" + "  Size=" + r.objectSize, cx, layout.getY("rotInfo"));
    g.text("Iter=" + r.maximumIterations + "  Power=" + r.power + "  Res=" + r.resolutionScale, cx, layout.getY("sizeInfo"));

    g.fill(t.textMuted);
    g.textSize(t.textSizeCaption);
    g.text("[WASD]: Rotate  [Q/E]: Zoom  [R]: Recompute  [H]: Hide", cx, layout.getY("hints"));

    zoomInBtn.display(g, t);
    zoomOutBtn.display(g, t);

    int powerIdx = 0;
    for (int i = 0; i < r.powerValues.length; i++) {
      if (r.powerValues[i] == r.power) { powerIdx = i; break; }
    }
    int resIdx = 0;
    for (int i = 0; i < r.resolutionValues.length; i++) {
      if (r.resolutionValues[i] == r.resolutionScale) { resIdx = i; break; }
    }
    dropdown.displayTrigger(g, t, powerIdx);
    resDropdown.displayTrigger(g, t, resIdx);
    dropdown.displayList(g, t);
    resDropdown.displayList(g, t);
  }

  void drawChevron(PGraphics g, UITheme t, float cx, float cy, boolean isCollapsed) {
    g.stroke(t.textMuted);
    g.strokeWeight(1.5);
    g.noFill();
    if (isCollapsed) {
      g.line(cx - 4, cy - 4, cx, cy);
      g.line(cx, cy, cx - 4, cy + 4);
    } else {
      g.line(cx - 6, cy - 2, cx - 2, cy + 2);
      g.line(cx - 2, cy + 2, cx + 2, cy - 2);
    }
  }
}

class UITheme {
  color bgPanel = color(20, 20, 20, 220);
  color bgWidget = color(38, 38, 38, 230);
  color bgHover = color(62, 62, 62, 235);
  color bgActive = color(95, 95, 95, 245);

  color textPrimary = color(240);
  color textSecondary = color(185);
  color textMuted = color(115);

  float textSizePrimary = 16;
  float textSizeSecondary = 13;
  float textSizeCaption = 10;

  float swPanel = 1.2;
  float swWidget = 0.8;
  float swTrack = 0.8;
  float swSeparator = 0.6;

  color strokePanel = color(90);
  color strokeWidget = color(70);
  color strokeTrack = color(60);
  color strokeSeparator = color(48);
  color strokeFocus = color(180);

  color accentHandle = color(220);
}

class UILayout {
  float x, y, w, padding, intraGap, interGap, totalHeight;

  ArrayList<String> names = new ArrayList<String>();
  ArrayList<Float> heights = new ArrayList<Float>();
  ArrayList<String> groups = new ArrayList<String>();
  ArrayList<Float> gaps = new ArrayList<Float>();

  HashMap<String, Float> yPositions = new HashMap<String, Float>();
  ArrayList<Float> _separatorYs = new ArrayList<Float>();

  UILayout(float x, float y, float w, float padding, float intraGap, float interGap) {
    this.x = x; this.y = y; this.w = w;
    this.padding = padding;
    this.intraGap = intraGap;
    this.interGap = interGap;
  }

  void add(String name, float h, String group) {
    names.add(name); heights.add(h); groups.add(group);
  }

  void finish() {
    gaps.clear();
    for (int i = 0; i < names.size(); i++) {
      boolean lastInGroup = (i == names.size() - 1) || !groups.get(i).equals(groups.get(i + 1));
      gaps.add(lastInGroup ? interGap : intraGap);
    }

    float cursor = y + padding;
    for (int i = 0; i < names.size(); i++) {
      yPositions.put(names.get(i), cursor);
      cursor += heights.get(i) + gaps.get(i);
    }
    totalHeight = cursor - y - interGap + padding;

    _separatorYs.clear();
    for (int i = 0; i < names.size() - 1; i++) {
      if (!groups.get(i).equals(groups.get(i + 1))) {
        float rowBottom = yPositions.get(names.get(i)) + heights.get(i);
        float nextTop = yPositions.get(names.get(i + 1));
        _separatorYs.add((rowBottom + nextTop) / 2.0);
      }
    }
  }

  float getY(String name) {
    Float v = yPositions.get(name);
    return v != null ? v : y;
  }

  float contentX() { return x + padding; }
  float contentW() { return w - padding * 2; }
  ArrayList<Float> separatorYs() { return _separatorYs; }
}

class Slider {
  float x, y, w, h, min, max, val;
  boolean locked = false;

  Slider(float x, float y, float w, float h, float min, float max, float start) {
    this.x = x; this.y = y; this.w = w; this.h = h;
    this.min = min; this.max = max; this.val = start;
  }

  void display(PGraphics g, UITheme t) {
    float trackY = y + h / 2;
    float handleX = map(val, min, max, x, x + w);

    g.stroke(t.strokeTrack);
    g.strokeWeight(t.swTrack);
    g.line(x, trackY, x + w, trackY);

    g.noStroke();
    g.fill(locked ? t.accentHandle : t.textSecondary);
    g.ellipse(handleX, trackY, h * 0.5, h * 0.5);
  }

  boolean update() {
    if (locked) { val = constrain(map(mouseX, x, x + w, min, max), min, max); return true; }
    return false;
  }

  boolean isMouseOver() {
    return mouseX > x && mouseX < x + w && mouseY > y && mouseY < y + h;
  }
}

class Dropdown {
  float x, y, w, h;
  String[] items;
  boolean isOpen = false;

  Dropdown(float x, float y, float w, float h, String[] items) {
    this.x = x; this.y = y; this.w = w; this.h = h; this.items = items;
  }

  void displayTrigger(PGraphics g, UITheme t, int currentIndex) {
    g.stroke(t.strokeWidget);
    g.strokeWeight(t.swWidget);
    g.fill(isHeaderOver() ? t.bgHover : t.bgWidget);
    g.rect(x, y, w, h, 3);
    g.fill(t.textPrimary);
    g.textSize(t.textSizeSecondary);
    g.textAlign(LEFT, CENTER);
    g.text(items[currentIndex], x + 8, y + h / 2);
    drawChevron(g, t, x + w - 12, y + h / 2, !isOpen);
  }

  void displayList(PGraphics g, UITheme t) {
    if (!isOpen) return;
    for (int i = 0; i < items.length; i++) {
      boolean over = mouseX > x && mouseX < x + w && mouseY > y + h + i * h && mouseY < y + 2 * h + i * h;
      g.fill(over ? t.bgActive : t.bgHover);
      g.stroke(t.strokeWidget);
      g.strokeWeight(t.swWidget);
      g.rect(x, y + h + i * h, w, h);
      g.fill(t.textPrimary);
      g.textSize(t.textSizeSecondary);
      g.textAlign(LEFT, CENTER);
      g.text(items[i], x + 8, y + h + i * h + h / 2);
    }
  }

  void drawChevron(PGraphics g, UITheme t, float cx, float cy, boolean isCollapsed) {
    g.stroke(t.textMuted);
    g.strokeWeight(1.2);
    g.noFill();
    if (isCollapsed) {
      g.line(cx - 4, cy - 4, cx, cy);
      g.line(cx, cy, cx - 4, cy + 4);
    } else {
      g.line(cx - 6, cy - 2, cx - 2, cy + 2);
      g.line(cx - 2, cy + 2, cx + 2, cy - 2);
    }
  }

  void toggle() { isOpen = !isOpen; }

  boolean isHeaderOver() {
    return mouseX > x && mouseX < x + w && mouseY > y && mouseY < y + h;
  }

  int getClickedIndex() {
    for (int i = 0; i < items.length; i++) {
      if (mouseX > x && mouseX < x + w
        && mouseY > y + h + i * h && mouseY < y + 2 * h + i * h) return i;
    }
    return -1;
  }
}

class Button {
  float x, y, w, h;
  String label;

  Button(float x, float y, float w, float h, String label) {
    this.x = x; this.y = y; this.w = w; this.h = h; this.label = label;
  }

  void display(PGraphics g, UITheme t) {
    g.fill(isMouseOver() ? t.bgHover : t.bgWidget);
    g.stroke(t.strokeWidget);
    g.strokeWeight(t.swWidget);
    g.rect(x, y, w, h, 6);
    g.fill(t.textPrimary);
    g.textSize(max(10, h * 0.40));
    g.textAlign(CENTER, CENTER);
    g.text(label, x + w / 2, y + h / 2);
  }

  boolean isMouseOver() {
    return mouseX > x && mouseX < x + w && mouseY > y && mouseY < y + h;
  }
}
