/**
 * @file Mandelbrot_Set.pde
 * @author @eanutt1272.v2
 * @version 2.2.0
 */

int maxIterations = 128;
double zoom       = 1.0;
double offsetX    = -0.25;
double offsetY    = 0.5;
boolean needsRedraw = true;

PGraphics fractalBuffer;

String[] mapNames = {
  "cividis", "inferno", "magma", "mako",
  "plasma",  "rocket",  "turbo", "viridis", "greyscale"
};
int currentMapIndex = 2;
int[] colorLUT = new int[2048];

Button   zoomInButton, zoomOutButton;
Button[] stepButtons = new Button[4];
Slider   iterSlider;
Dropdown mapDropdown;

boolean showUI       = true;
boolean isTypingIter = false;
String  typingBuffer = "";

boolean keyUp, keyDown, keyLeft, keyRight, keyZoomIn, keyZoomOut;

UITheme  theme;
UILayout layout;

static final int PANEL_W = 390;

void settings() {
  size(800, 800, P2D);
  pixelDensity(displayDensity());
}

void setup() {
  surface.setResizable(false);

  javax.swing.SwingUtilities.invokeLater(new Runnable() {
    public void run() {
      com.jogamp.newt.opengl.GLWindow window =
        (com.jogamp.newt.opengl.GLWindow) surface.getNative();
      window.setUndecorated(false);
      window.setSize(width, height);
    }
  });

  fractalBuffer = createGraphics(width, height, P2D);
  theme         = new UITheme();
  generateLUT();
  colorMode(RGB, 255);

  layout = new UILayout(10, 10, PANEL_W, 12, 5, 18);

  layout.add("iterLabel",   20, "group1");
  layout.add("iterSlider",  18, "group1");
  layout.add("stepButtons", 30, "group1");
  layout.add("zoomInfo",    19, "group1");
  layout.add("posInfo",     19, "group1");
  layout.add("hints",       15, "group1");
  layout.add("colorMap",    28, "group1");
  layout.finish();

  iterSlider = new Slider(
    layout.contentX(),
    layout.getY("iterSlider"),
    layout.contentW(),
    18, 1, 512, maxIterations
  );

  String[] stepLabels = {"\u2212\u2212", "\u2212", "+", "++"};
  float stepY = layout.getY("stepButtons");
  for (int i = 0; i < 4; i++) {
    stepButtons[i] = new Button(
      layout.contentX() + i * 36, stepY, 28, 28, stepLabels[i]
    );
  }

  mapDropdown = new Dropdown(
    layout.contentX(), layout.getY("colorMap"),
    180, 26, mapNames
  );

  zoomInButton  = new Button(width - 80, height - 160, 56, 56, "+");
  zoomOutButton = new Button(width - 80, height - 90,  56, 56, "\u2212");
}

void draw() {
  background(0);
  handleContinuousInput();
  if (needsRedraw) { renderFractalToBuffer(); needsRedraw = false; }
  image(fractalBuffer, 0, 0);
  if (showUI) drawUI();
}

void handleContinuousInput() {
  if (showUI && (mapDropdown.isOpen || iterSlider.locked || isTypingIter)) return;
  boolean changed = false;
  double panSpeed = 0.05 / zoom;

  if (keyUp)      { offsetY -= panSpeed; changed = true; }
  if (keyDown)    { offsetY += panSpeed; changed = true; }
  if (keyLeft)    { offsetX -= panSpeed; changed = true; }
  if (keyRight)   { offsetX += panSpeed; changed = true; }
  if (keyZoomIn)  { doZoom(1.05,       width / 2, height / 2); changed = true; }
  if (keyZoomOut) { doZoom(1.0 / 1.05, width / 2, height / 2); changed = true; }

  if (mousePressed && showUI) {
    if (zoomInButton.isMouseOver())  { doZoom(1.05,       width / 2, height / 2); changed = true; }
    if (zoomOutButton.isMouseOver()) { doZoom(1.0 / 1.05, width / 2, height / 2); changed = true; }
    if (iterSlider.locked && iterSlider.update()) {
      maxIterations = (int) iterSlider.val; changed = true;
    }
  }
  if (changed) needsRedraw = true;
}

void mousePressed() {
  if (!showUI) return;

  if (mapDropdown.isOpen) {
    int clicked = mapDropdown.getClickedIndex();
    if (clicked != -1) { currentMapIndex = clicked; generateLUT(); needsRedraw = true; }
    mapDropdown.isOpen = false;
    return;
  }
  if (mapDropdown.isHeaderOver()) { mapDropdown.toggle(); return; }

  if (mouseX > layout.contentX() && mouseX < layout.contentX() + 180
   && mouseY > layout.getY("iterLabel") && mouseY < layout.getY("iterLabel") + 20) {
    isTypingIter = true; typingBuffer = ""; return;
  } else {
    isTypingIter = false;
  }

  if (iterSlider.isMouseOver()) {
    iterSlider.locked = true;
    iterSlider.val = constrain(
      map(mouseX, iterSlider.x, iterSlider.x + iterSlider.w, iterSlider.min, iterSlider.max),
      iterSlider.min, iterSlider.max
    );
    maxIterations = (int) iterSlider.val;
    needsRedraw = true;
  }

  int[] amounts = {-100, -10, 10, 100};
  for (int i = 0; i < 4; i++) {
    if (stepButtons[i].isMouseOver()) {
      maxIterations = constrain(maxIterations + amounts[i], 1, 5000);
      iterSlider.val = maxIterations;
      needsRedraw = true;
    }
  }
}

void mouseReleased() { iterSlider.locked = false; }

void mouseDragged() {
  if (iterSlider.locked) {
    iterSlider.val = constrain(
      map(mouseX, iterSlider.x, iterSlider.x + iterSlider.w, iterSlider.min, iterSlider.max),
      iterSlider.min, iterSlider.max
    );
    maxIterations = (int) iterSlider.val;
    needsRedraw = true;
    return;
  }
  if (showUI && (mapDropdown.isOpen || isTypingIter)) return;
  if (showUI && (zoomInButton.isMouseOver() || zoomOutButton.isMouseOver())) return;

  double aspect = (double) width / height;
  offsetX -= (mouseX - pmouseX) * (3.2 * aspect) / width  / zoom;
  offsetY -= (mouseY - pmouseY) * 3.2             / height / zoom;
  needsRedraw = true;
}

void mouseWheel(MouseEvent event) {
  if (showUI && mapDropdown.isOpen) return;
  doZoom((event.getCount() < 0) ? 1.15 : 1.0 / 1.15, mouseX, mouseY);
  needsRedraw = true;
}

void keyPressed() {
  if (isTypingIter) {
    if (key >= '0' && key <= '9') {
      typingBuffer += key;
    } else if (keyCode == BACKSPACE && typingBuffer.length() > 0) {
      typingBuffer = typingBuffer.substring(0, typingBuffer.length() - 1);
    } else if (keyCode == ENTER || keyCode == RETURN) {
      if (typingBuffer.length() > 0) {
        maxIterations  = constrain(int(typingBuffer), 1, 5000);
        iterSlider.val = maxIterations;
        needsRedraw    = true;
      }
      isTypingIter = false;
    } else if (keyCode == ESC) {
      isTypingIter = false;
    }
    return;
  }

  if (key == 'h' || key == 'H') showUI = !showUI;
  if (key == 'w' || key == 'W' || keyCode == UP)    keyUp    = true;
  if (key == 's' || key == 'S' || keyCode == DOWN)  keyDown  = true;
  if (key == 'a' || key == 'A' || keyCode == LEFT)  keyLeft  = true;
  if (key == 'd' || key == 'D' || keyCode == RIGHT) keyRight = true;
  if (key == 'e' || key == 'E' || key == '=' || key == '+') keyZoomIn  = true;
  if (key == 'q' || key == 'Q' || key == '-')               keyZoomOut = true;
}

void keyReleased() {
  if (key == 'w' || key == 'W' || keyCode == UP)    keyUp    = false;
  if (key == 's' || key == 'S' || keyCode == DOWN)  keyDown  = false;
  if (key == 'a' || key == 'A' || keyCode == LEFT)  keyLeft  = false;
  if (key == 'd' || key == 'D' || keyCode == RIGHT) keyRight = false;
  if (key == 'e' || key == 'E' || key == '=' || key == '+') keyZoomIn  = false;
  if (key == 'q' || key == 'Q' || key == '-')               keyZoomOut = false;
}

void doZoom(double factor, int targetX, int targetY) {
  float  aspectRatio = (float) width / height;
  double baseX       = map(targetX, 0, width,  -2.1f * aspectRatio, 1.1f * aspectRatio);
  double baseY       = map(targetY, 0, height, -2.1f, 1.1f);
  double oldZoom     = zoom;
  zoom    *= factor;
  offsetX += baseX * (1.0 / oldZoom - 1.0 / zoom);
  offsetY += baseY * (1.0 / oldZoom - 1.0 / zoom);
}

void renderFractalToBuffer() {
  fractalBuffer.beginDraw();
  fractalBuffer.loadPixels();
  fractalBuffer.colorMode(RGB, 1.0);

  float  aspectRatio = (float) width / height;
  double invZoom     = 1.0 / zoom;

  for (int x = 0; x < width; x++) {
    for (int y = 0; y < height; y++) {
      double cx = map(x, 0, width,  -2.1f * aspectRatio, 1.1f * aspectRatio) * invZoom + offsetX;
      double cy = map(y, 0, height, -2.1f, 1.1f)                             * invZoom + offsetY;

      double zx = 0.0;
      double zy = 0.0;
      int n = 0;

      while (n < maxIterations) {
        double zx2 = zx * zx;
        double zy2 = zy * zy;
        if (zx2 + zy2 > 16.0) break;
        double newZx = zx2 - zy2 + cx;
        zy = 2.0 * zx * zy + cy;
        zx = newZx;
        n++;
      }

      if (n == maxIterations) {
        // Inside the set — colour black
        fractalBuffer.pixels[x + y * width] = fractalBuffer.color(0);
      } else {
        // Smooth colouring via normalised iteration count
        float log_zn = (float) Math.log(zx * zx + zy * zy) / 2.0f;
        float nu     = (float) Math.log(log_zn / (float) Math.log(2)) / (float) Math.log(2);
        float t      = (n + 1 - nu) / maxIterations;
        fractalBuffer.pixels[x + y * width] =
          colorLUT[floor(constrain(t, 0, 1) * (colorLUT.length - 1))];
      }
    }
  }

  fractalBuffer.updatePixels();
  fractalBuffer.endDraw();
}

void drawUI() {
  colorMode(RGB, 255);

  fill(theme.bgPanel);
  stroke(theme.strokePanel);
  strokeWeight(theme.swPanel);
  rect(layout.x, layout.y, PANEL_W, layout.totalHeight, 4);

  for (float sepY : layout.separatorYs()) {
    stroke(theme.strokeSeparator);
    strokeWeight(theme.swSeparator);
    line(layout.contentX(), sepY, layout.x + PANEL_W - layout.padding, sepY);
  }

  float px = layout.contentX();

  String iterText = isTypingIter
    ? "Input: " + typingBuffer + "_"
    : "Iterations: " + maxIterations;
  fill(theme.textPrimary);
  textSize(theme.textSizePrimary);
  textAlign(LEFT, TOP);
  text(iterText, px, layout.getY("iterLabel"));

  if (!isTypingIter) {
    fill(theme.textMuted);
    textSize(theme.textSizeCaption);
    text("(click to type)", px + 105, layout.getY("iterLabel") + 3);
  }

  iterSlider.display();
  for (Button b : stepButtons) b.display();

  fill(theme.textSecondary);
  textSize(theme.textSizeSecondary);
  textAlign(LEFT, TOP);
  text("Zoom: " + nfc((float) zoom, 1) + "x", px, layout.getY("zoomInfo"));
  text("Position: X=" + nfc((float) -offsetX, 3) + ", Y=" + nfc((float) offsetY, 3), px, layout.getY("posInfo"));

  fill(theme.textMuted);
  textSize(theme.textSizeCaption);
  text("[WASD/Arrows]: Pan,  [Scroll/Q,E]: Zoom,  [H]: Toggle UI", px, layout.getY("hints"));

  mapDropdown.display();
  zoomInButton.display();
  zoomOutButton.display();
}

void generateLUT() {
  double[][] coeffs = getCoefficients(mapNames[currentMapIndex]);
  colorMode(RGB, 1.0);
  for (int i = 0; i < colorLUT.length; i++) {
    float t = (float) i / (colorLUT.length - 1);
    colorLUT[i] = color(
      (float) applyPoly(t, coeffs[0]),
      (float) applyPoly(t, coeffs[1]),
      (float) applyPoly(t, coeffs[2])
    );
  }
}

double applyPoly(float t, double[] c) {
  return c[0] + c[1]*t + c[2]*t*t + c[3]*t*t*t + c[4]*t*t*t*t + c[5]*t*t*t*t*t + c[6]*t*t*t*t*t*t;
}

double[][] getCoefficients(String name) {
  if (name.equals("cividis")) return new double[][]{{-0.008973,-0.384689,15.429210,-58.977031,102.370492,-83.187239,25.776070},{0.136756,0.639494,0.385562,-1.404197,2.600914,-2.140750,0.688122},{0.294170,2.982654,-22.363760,74.863561,-121.303164,93.974216,-28.262533}};
  if (name.equals("inferno"))  return new double[][]{{0.000214,0.105874,11.617115,-41.709277,77.157454,-71.287667,25.092619},{0.001635,0.566364,-3.947723,17.457724,-33.415679,32.553880,-12.222155},{-0.037130,4.117926,-16.257323,44.645117,-82.253923,73.588132,-23.115650}};
  if (name.equals("magma"))    return new double[][]{{-0.002067,0.250486,8.345901,-27.666969,52.170684,-50.758572,18.664253},{-0.000688,0.694455,-3.596031,14.253853,-27.944584,29.053880,-11.490027},{-0.009548,2.495287,0.329057,-13.646583,12.881091,4.269936,-5.570769}};
  if (name.equals("mako"))     return new double[][]{{0.032987,1.620032,-5.833466,19.266730,-48.335836,57.794682,-23.674380},{0.013232,0.848348,-1.651402,8.153931,-12.793640,8.555513,-2.172825},{0.040283,0.292971,12.702365,-44.241782,65.176477,-47.319049,14.259791}};
  if (name.equals("plasma"))   return new double[][]{{0.064053,2.142438,-2.653255,6.094711,-11.065106,9.974645,-3.623823},{0.024812,0.244749,-7.461101,42.308428,-82.644718,71.408341,-22.914405},{0.534900,0.742966,3.108382,-28.491792,60.093584,-54.020563,18.193381}};
  if (name.equals("rocket"))   return new double[][]{{-0.003174,1.947267,-6.401815,30.376433,-57.268147,44.789992,-12.453563},{0.037717,-0.476821,15.073064,-81.403784,173.768416,-158.313952,52.250665},{0.112123,0.400542,6.253872,-21.550609,14.869938,11.402042,-10.648435}};
  if (name.equals("turbo"))    return new double[][]{{0.080545,7.008980,-66.727306,228.660253,-334.841257,220.424075,-54.095540},{0.069393,3.147611,-4.927799,25.101273,-69.296265,67.510842,-21.578703},{0.219622,7.655918,-10.162980,-91.680678,288.708703,-305.386975,110.735079}};
  if (name.equals("viridis"))  return new double[][]{{0.274455,0.107708,-0.327241,-4.599932,6.203736,4.751787,-5.432077},{0.005768,1.396470,0.214814,-5.758238,14.153965,-13.749439,4.641571},{0.332664,1.386771,0.091977,-19.291809,56.656300,-65.320968,26.272108}};
  return new double[][]{{0,1,0,0,0,0,0},{0,1,0,0,0,0,0},{0,1,0,0,0,0,0}};
}

class UITheme {
  color bgPanel  = color(18, 18, 22, 210);
  color bgWidget = color(38, 38, 50,  220);
  color bgHover  = color(62, 62, 80,  230);
  color bgActive = color(90, 90, 112, 245);

  color textPrimary   = color(238, 238, 238);
  color textSecondary = color(170, 172, 190);
  color textMuted     = color(108, 110, 128);

  float textSizePrimary   = 16;
  float textSizeSecondary = 14;
  float textSizeCaption   = 10;

  float swPanel     = 1.4;
  float swWidget    = 1.0;
  float swTrack     = 0.8;
  float swSeparator = 0.6;

  color strokePanel     = color(100, 102, 120);
  color strokeWidget    = color(80,  82,  100);
  color strokeTrack     = color(70,  72,  90);
  color strokeSeparator = color(55,  57,  72);
  color strokeFocus     = color(160, 162, 190);

  color accentHandle = color(210, 212, 235);
}

class UILayout {
  float x, y, w;
  float padding;
  float intraGap;
  float interGap;
  float totalHeight;

  ArrayList<String> names   = new ArrayList<String>();
  ArrayList<Float>  heights = new ArrayList<Float>();
  ArrayList<String> groups  = new ArrayList<String>();
  ArrayList<Float>  gaps    = new ArrayList<Float>();

  HashMap<String, Float> yPositions   = new HashMap<String, Float>();
  ArrayList<Float>       _separatorYs = new ArrayList<Float>();

  UILayout(float x, float y, float w, float padding, float intraGap, float interGap) {
    this.x = x; this.y = y; this.w = w;
    this.padding  = padding;
    this.intraGap = intraGap;
    this.interGap = interGap;
  }

  void add(String name, float h, String group) {
    names.add(name); heights.add(h); groups.add(group);
  }

  void finish() {
    gaps.clear();
    for (int i = 0; i < names.size(); i++) {
      boolean isLastInGroup = (i == names.size() - 1)
        || !groups.get(i).equals(groups.get(i + 1));
      gaps.add(isLastInGroup ? interGap : intraGap);
    }

    float cursor = y + padding;
    for (int i = 0; i < names.size(); i++) {
      yPositions.put(names.get(i), cursor);
      cursor += heights.get(i) + gaps.get(i);
    }

    totalHeight = cursor - y - interGap + padding;

    _separatorYs.clear();
    for (int i = 0; i < names.size() - 1; i++) {
      boolean isBoundary = !groups.get(i).equals(groups.get(i + 1));
      if (isBoundary) {
        float rowBottom = yPositions.get(names.get(i)) + heights.get(i);
        float nextTop   = yPositions.get(names.get(i + 1));
        _separatorYs.add((rowBottom + nextTop) / 2.0);
      }
    }
  }

  float getY(String name) {
    Float val = yPositions.get(name);
    return val != null ? val : y;
  }

  float contentX() { return x + padding; }
  float contentW() { return w - padding * 2; }
  ArrayList<Float> separatorYs() { return _separatorYs; }
}

class Slider {
  float x, y, w, h, min, max, val;
  boolean locked = false;

  Slider(float x, float y, float w, float h, float min, float max, float start) {
    this.x=x; this.y=y; this.w=w; this.h=h;
    this.min=min; this.max=max; this.val=start;
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
    ellipse(handleX, trackY, h * 0.85, h * 0.85);
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
    this.x=x; this.y=y; this.w=w; this.h=h; this.items=items;
  }

  void display() {
    colorMode(RGB, 255);
    stroke(theme.strokeWidget);
    strokeWeight(theme.swWidget);

    fill(isHeaderOver() ? theme.bgHover : theme.bgWidget);
    rect(x, y, w, h, 3);
    fill(theme.textPrimary);
    textSize(theme.textSizeSecondary);
    textAlign(LEFT, CENTER);
    text("Map: " + items[currentMapIndex], x + 8, y + h / 2);

    if (isOpen) {
      for (int i = 0; i < items.length; i++) {
        boolean over = mouseX > x && mouseX < x + w
                    && mouseY > y + h + i * h && mouseY < y + 2 * h + i * h;
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
      if (mouseX > x && mouseX < x + w
       && mouseY > y + h + i * h && mouseY < y + 2 * h + i * h) return i;
    }
    return -1;
  }
}

class Button {
  float x, y, w, h;
  String label;

  Button(float x, float y, float w, float h, String l) {
    this.x=x; this.y=y; this.w=w; this.h=h; label=l;
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
