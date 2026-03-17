/**
 * @file Mandelbrot_Set.pde
 * @description A Processing Java implementation of a Mandelbrot set explorer with a custom UI for adjusting parameters and color maps.
 * @author @eanutt1272.v2
 * @version 3.0.0
 */

AppCore appcore;

void settings() {
  size(800, 800, P2D);
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
  int maxIterations = 128;
  double zoom = 1.0;
  double offsetX = -0.25;
  double offsetY = 0.5;
  boolean needsRedraw = true;
  boolean showUI = true;

  boolean justPressed = false;

  UITheme theme;
  UIPanel panel;
  FractalRenderer renderer;
  InputHandler input;

  void setup() {
    theme = new UITheme();
    renderer = new FractalRenderer(this);
    panel = new UIPanel(this);
    input = new InputHandler(this);

    renderer.generateLUT();
    colorMode(RGB, 255);
  }

  void draw() {
    background(0);
    input.handleContinuousInput();
    if (needsRedraw) { renderer.render(); needsRedraw = false; }
    image(renderer.buffer, 0, 0);
    if (showUI) panel.draw();
    justPressed = false;
  }

  void doZoom(double factor, int tx, int ty) {
    float ar = (float) width / height;
    double baseX = map(tx, 0, width, -2.1f * ar, 1.1f * ar);
    double baseY = map(ty, 0, height, -2.1f, 1.1f);
    double old = zoom;
    zoom *= factor;
    offsetX += baseX * (1.0 / old - 1.0 / zoom);
    offsetY += baseY * (1.0 / old - 1.0 / zoom);
  }
}

class FractalRenderer {
  AppCore appcore;
  PGraphics buffer;

  static final int LUT_SIZE = 2048;
  int[] colorLUT = new int[LUT_SIZE];

  String[] mapNames = {
    "cividis", "inferno", "magma", "mako",
    "plasma", "rocket", "turbo", "viridis", "greyscale"
  };
  int currentMapIndex = 2;

  FractalRenderer(AppCore appcore) {
    this.appcore = appcore;
    buffer = createGraphics(width, height, P2D);
  }

  void render() {
    buffer.beginDraw();
    buffer.loadPixels();
    buffer.colorMode(RGB, 1.0);

    float ar = (float) width / height;
    double invZoom = 1.0 / appcore.zoom;

    for (int x = 0; x < width; x++) {
      for (int y = 0; y < height; y++) {
        double cx = map(x, 0, width, -2.1f * ar, 1.1f * ar) * invZoom + appcore.offsetX;
        double cy = map(y, 0, height, -2.1f, 1.1f) * invZoom + appcore.offsetY;
        double zx = 0.0;
        double zy = 0.0;
        int n = 0;

        while (n < appcore.maxIterations) {
          double zx2 = zx * zx, zy2 = zy * zy;
          if (zx2 + zy2 > 16.0) break;
          double newZx = zx2 - zy2 + cx;
          zy = 2.0 * zx * zy + cy;
          zx = newZx;
          n++;
        }

        if (n == appcore.maxIterations) {
          buffer.pixels[x + y * width] = buffer.color(0);
        } else {
          float log_zn = (float) Math.log(zx * zx + zy * zy) / 2.0f;
          float nu = (float) Math.log(log_zn / (float) Math.log(2)) / (float) Math.log(2);
          float t = (n + 1 - nu) / appcore.maxIterations;
          buffer.pixels[x + y * width] = colorLUT[floor(constrain(t, 0, 1) * (LUT_SIZE - 1))];
        }
      }
    }

    buffer.updatePixels();
    buffer.endDraw();
  }

  void setMap(int index) {
    currentMapIndex = index;
    generateLUT();
  }

  void generateLUT() {
    double[][] c = getCoefficients(mapNames[currentMapIndex]);
    colorMode(RGB, 1.0);
    for (int i = 0; i < LUT_SIZE; i++) {
      float t = (float) i / (LUT_SIZE - 1);
      colorLUT[i] = color(
        (float) applyPoly(t, c[0]),
        (float) applyPoly(t, c[1]),
        (float) applyPoly(t, c[2])
      );
    }
    colorMode(RGB, 255);
  }

  private double applyPoly(float t, double[] c) {
    return c[0] + c[1]*t + c[2]*t*t + c[3]*t*t*t + c[4]*t*t*t*t + c[5]*t*t*t*t*t + c[6]*t*t*t*t*t*t;
  }

  private double[][] getCoefficients(String name) {
    if (name.equals("cividis")) return new double[][]{{-0.008973,-0.384689,15.429210,-58.977031,102.370492,-83.187239,25.776070},{0.136756,0.639494,0.385562,-1.404197,2.600914,-2.140750,0.688122},{0.294170,2.982654,-22.363760,74.863561,-121.303164,93.974216,-28.262533}};
    if (name.equals("inferno")) return new double[][]{{0.000214,0.105874,11.617115,-41.709277,77.157454,-71.287667,25.092619},{0.001635,0.566364,-3.947723,17.457724,-33.415679,32.553880,-12.222155},{-0.037130,4.117926,-16.257323,44.645117,-82.253923,73.588132,-23.115650}};
    if (name.equals("magma")) return new double[][]{{-0.002067,0.250486,8.345901,-27.666969,52.170684,-50.758572,18.664253},{-0.000688,0.694455,-3.596031,14.253853,-27.944584,29.053880,-11.490027},{-0.009548,2.495287,0.329057,-13.646583,12.881091,4.269936,-5.570769}};
    if (name.equals("mako")) return new double[][]{{0.032987,1.620032,-5.833466,19.266730,-48.335836,57.794682,-23.674380},{0.013232,0.848348,-1.651402,8.153931,-12.793640,8.555513,-2.172825},{0.040283,0.292971,12.702365,-44.241782,65.176477,-47.319049,14.259791}};
    if (name.equals("plasma")) return new double[][]{{0.064053,2.142438,-2.653255,6.094711,-11.065106,9.974645,-3.623823},{0.024812,0.244749,-7.461101,42.308428,-82.644718,71.408341,-22.914405},{0.534900,0.742966,3.108382,-28.491792,60.093584,-54.020563,18.193381}};
    if (name.equals("rocket")) return new double[][]{{-0.003174,1.947267,-6.401815,30.376433,-57.268147,44.789992,-12.453563},{0.037717,-0.476821,15.073064,-81.403784,173.768416,-158.313952,52.250665},{0.112123,0.400542,6.253872,-21.550609,14.869938,11.402042,-10.648435}};
    if (name.equals("turbo")) return new double[][]{{0.080545,7.008980,-66.727306,228.660253,-334.841257,220.424075,-54.095540},{0.069393,3.147611,-4.927799,25.101273,-69.296265,67.510842,-21.578703},{0.219622,7.655918,-10.162980,-91.680678,288.708703,-305.386975,110.735079}};
    if (name.equals("viridis")) return new double[][]{{0.274455,0.107708,-0.327241,-4.599932,6.203736,4.751787,-5.432077},{0.005768,1.396470,0.214814,-5.758238,14.153965,-13.749439,4.641571},{0.332664,1.386771,0.091977,-19.291809,56.656300,-65.320968,26.272108}};
    return new double[][]{{0,1,0,0,0,0,0},{0,1,0,0,0,0,0},{0,1,0,0,0,0,0}};
  }
}

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
    if (keyZoomOut){ appcore.doZoom(1.0 / 1.05, width / 2, height / 2); changed = true; }

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
      appcore.needsRedraw   = true;
    }

    int[] amounts = {-64, -16, 16, 64};
    for (int i = 0; i < 4; i++) {
      if (p.stepButtons[i].isMouseOver()) {
        appcore.maxIterations = constrain(appcore.maxIterations + amounts[i], (int)p.slider.min, (int)p.slider.max);
        p.slider.val = appcore.maxIterations;
        appcore.needsRedraw   = true;
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
      appcore.needsRedraw   = true;
      return;
    }
    if (appcore.showUI && (p.dropdown.isOpen || isTypingIter)) return;
    if (appcore.showUI && (p.zoomInBtn.isMouseOver() || p.zoomOutBtn.isMouseOver())) return;

    double ar = (double) width / height;
    appcore.offsetX -= (mouseX - pmouseX) * (3.2 * ar) / width  / appcore.zoom;
    appcore.offsetY -= (mouseY - pmouseY) *  3.2 / height / appcore.zoom;
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

class UIPanel {
  AppCore appcore;
  UILayout layout;
  Slider slider;
  Dropdown dropdown;
  Button zoomInBtn, zoomOutBtn;
  Button[] stepButtons = new Button[4];

  static final int PANEL_W = 390;

  UIPanel(AppCore appcore) {
    this.appcore = appcore;

    layout = new UILayout(10, 10, PANEL_W, 12, 5, 18);
    layout.add("iterLabel", 20, "panel");
    layout.add("iterSlider", 18, "panel");
    layout.add("stepButtons", 30, "panel");
    layout.add("zoomInfo", 19, "panel");
    layout.add("posInfo", 19, "panel");
    layout.add("hints", 15, "panel");
    layout.add("colorMap", 28, "panel");
    layout.finish();

    slider = new Slider(layout.contentX(), layout.getY("iterSlider"), layout.contentW(), 18, 1, 512, appcore.maxIterations, appcore.theme);

    String[] stepLabels = {"--", "-", "+", "++"};
    float stepY = layout.getY("stepButtons");
    for (int i = 0; i < 4; i++) {
      stepButtons[i] = new Button(layout.contentX() + i * 36, stepY, 28, 28, stepLabels[i], appcore.theme);
    }

    dropdown = new Dropdown(layout.contentX(), layout.getY("colorMap"), 180, 26, appcore.renderer.mapNames, appcore.theme);
    zoomInBtn = new Button(width - 80, height - 150, 56, 56, "+", appcore.theme);
    zoomOutBtn = new Button(width - 80, height - 80, 56, 56, "-", appcore.theme);
  }

  void draw() {
    UITheme t = appcore.theme;
    colorMode(RGB, 255);

    fill(t.bgPanel);
    stroke(t.strokePanel);
    strokeWeight(t.swPanel);
    rect(layout.x, layout.y, PANEL_W, layout.totalHeight, 4);

    for (float sy : layout.separatorYs()) {
      stroke(t.strokeSeparator);
      strokeWeight(t.swSeparator);
      line(layout.contentX(), sy, layout.x + PANEL_W - layout.padding, sy);
    }

    float px = layout.contentX();

    InputHandler inp = appcore.input;
    String iterText = inp.isTypingIter ? "Input: " + inp.typingBuffer + "_" : "Iterations: " + appcore.maxIterations;
    fill(t.textPrimary);
    textSize(t.textSizePrimary);
    textAlign(LEFT, TOP);
    text(iterText, px, layout.getY("iterLabel"));

    if (!inp.isTypingIter) {
      fill(t.textMuted);
      textSize(t.textSizeCaption);
      text("(click to type)", px + 105, layout.getY("iterLabel") + 3);
    }

    slider.display();

    for (Button b : stepButtons) b.display();

    fill(t.textSecondary);
    textSize(t.textSizeSecondary);
    textAlign(LEFT, TOP);

    String zr = format3dp(appcore.zoom);
    String xr = format3dp(appcore.offsetX);
    String yr = format3dp(-appcore.offsetY);

    text("Zoom: " + zr + "x", px, layout.getY("zoomInfo"));
    text("Position: X=" + xr + ", Y=" + yr, px, layout.getY("posInfo"));

    fill(t.textMuted);
    textSize(t.textSizeCaption);
    text("[WASD/Arrows]: Pan, [Scroll/Q,E]: Zoom, [H]: Toggle UI", px, layout.getY("hints"));

    dropdown.display(appcore.renderer.currentMapIndex);

    zoomInBtn.display();
    zoomOutBtn.display();
  }

  String format3dp(double value) {
    double rounded = Math.round(value * 1000.0) / 1000.0;
    String sign = rounded < 0 ? "-" : "";
    double absRounded = Math.abs(rounded);

    double whole = Math.floor(absRounded);
    int frac = (int) Math.round((absRounded - whole) * 1000.0);
    if (frac == 1000) {
      whole += 1;
      frac = 0;
    }

    String wholeStr = "" + whole;
    int dot = wholeStr.indexOf('.');
    if (dot != -1) wholeStr = wholeStr.substring(0, dot);

    String fracStr = (frac < 10 ? "00" : (frac < 100 ? "0" : "")) + frac;
    return sign + wholeStr + "." + fracStr;
  }
}

class UITheme {
  color bgPanel = color(20,  20,  20,  210);
  color bgWidget = color(42,  42,  42,  220);
  color bgHover = color(68,  68,  68,  230);
  color bgActive = color(100, 100, 100, 245);

  color textPrimary = color(240);
  color textSecondary = color(180);
  color textMuted = color(110);

  float textSizePrimary = 16;
  float textSizeSecondary = 14;
  float textSizeCaption = 10;

  float swPanel = 1.4;
  float swWidget = 1.0;
  float swTrack = 0.8;
  float swSeparator = 0.6;

  color strokePanel = color(105);
  color strokeWidget = color(82);
  color strokeTrack = color(65);
  color strokeSeparator = color(50);
  color strokeFocus = color(190);

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
  UITheme theme;

  Slider(float x, float y, float w, float h, float min, float max, float start, UITheme theme) {
    this.x=x; this.y=y; this.w=w; this.h=h;
    this.min=min; this.max=max; this.val=start; this.theme=theme;
  }

  void display() {
    colorMode(RGB, 255);
    float trackY = y + h / 2;
    stroke(theme.strokeTrack);
    strokeWeight(theme.swTrack);
    line(x, trackY, x + w, trackY);

    float handleX = map(val, min, max, x, x + w);
    noStroke();
    fill(locked ? theme.accentHandle : theme.textSecondary);
    ellipse(handleX, trackY, h * 0.5, h * 0.5);
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
  UITheme theme;

  Dropdown(float x, float y, float w, float h, String[] items, UITheme theme) {
    this.x=x; this.y=y; this.w=w; this.h=h; this.items=items; this.theme=theme;
  }

  void display(int currentIndex) {
    colorMode(RGB, 255);
    stroke(theme.strokeWidget);
    strokeWeight(theme.swWidget);

    fill(isHeaderOver() ? theme.bgHover : theme.bgWidget);
    rect(x, y, w, h, 3);
    fill(theme.textPrimary);
    textSize(theme.textSizeSecondary);
    textAlign(LEFT, CENTER);
    text("Map: " + items[currentIndex], x + 8, y + h / 2);

    if (isOpen) {
      for (int i = 0; i < items.length; i++) {
        boolean over = mouseX > x && mouseX < x + w && mouseY > y + h + i * h && mouseY < y + 2 * h + i * h;
        fill(over ? theme.bgActive : theme.bgHover);
        rect(x, y + h + i * h, w, h);
        fill(theme.textPrimary);
        text(items[i], x + 8, y + h + i * h + h / 2);
      }
    }
  }

  void toggle() { isOpen = !isOpen; }

  boolean isHeaderOver() {
    return mouseX > x && mouseX < x + w && mouseY > y && mouseY < y + h;
  }

  int getClickedIndex() {
    for (int i = 0; i < items.length; i++) {
      if (mouseX > x && mouseX < x + w && mouseY > y + h + i * h && mouseY < y + 2 * h + i * h) return i;
    }
    return -1;
  }
}

class Button {
  float x, y, w, h;
  String label;
  UITheme theme;

  Button(float x, float y, float w, float h, String label, UITheme theme) {
    this.x=x; this.y=y; this.w=w; this.h=h; this.label=label; this.theme=theme;
  }

  void display() {
    colorMode(RGB, 255);
    fill(isMouseOver() ? theme.bgHover : theme.bgWidget);
    stroke(theme.strokeWidget);
    strokeWeight(theme.swWidget);
    rect(x, y, w, h, 3);
    fill(theme.textPrimary);
    textSize(max(11, h * 0.42));
    textAlign(CENTER, CENTER);
    text(label, x + w / 2, y + h / 2);
  }

  boolean isMouseOver() {
    return mouseX > x && mouseX < x + w && mouseY > y && mouseY < y + h;
  }
}
