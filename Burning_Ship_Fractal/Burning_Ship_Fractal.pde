/**
 * @file Burning_Ship_Fractal.pde
 * @author @eanutt1272.v2
 * @version 1.3.0
 */

int maxIterations = 256;
double zoom = 1.0;
double offsetX = -0.45; 
double offsetY = -0.5;
boolean needsRedraw = true;

PGraphics fractalBuffer;

String[] mapNames = {"cividis", "inferno", "magma", "mako", "plasma", "rocket", "turbo", "viridis", "greyscale"};
int currentMapIndex = 1; 
int[] colorLUT = new int[2048]; 

Button zoomInButton, zoomOutButton;
Dropdown mapDropdown;
float uiColour = 50; 
boolean showUI = true;

boolean keyUp, keyDown, keyLeft, keyRight, keyZoomIn, keyZoomOut;

void setup() {
  size(800, 800);
  fractalBuffer = createGraphics(width, height);
  generateLUT();
  
  zoomInButton = new Button(width - 100, height - 200, 64, 64, "+");
  zoomOutButton = new Button(width - 100, height - 100, 64, 64, "-");
  mapDropdown = new Dropdown(20, 205, 150, 30, mapNames);
}

void draw() {
  handleContinuousInput();

  if (needsRedraw) {
    renderFractalToBuffer();
    needsRedraw = false;
  }
  
  image(fractalBuffer, 0, 0);
  
  if (showUI) {
    drawUI();
  }
}

void handleContinuousInput() {
  if (showUI && mapDropdown.isOpen) return;

  boolean changed = false;

  double panSpeed = 0.05 / zoom;
  if (keyUp)    { offsetY -= panSpeed; changed = true; }
  if (keyDown)  { offsetY += panSpeed; changed = true; }
  if (keyLeft)  { offsetX -= panSpeed; changed = true; }
  if (keyRight) { offsetX += panSpeed; changed = true; }

  if (keyZoomIn)  { doZoom(1.05, width/2, height/2); changed = true; }
  if (keyZoomOut) { doZoom(1.0/1.05, width/2, height/2); changed = true; }

  if (mousePressed && showUI) {
    if (zoomInButton.isMouseOver())  { doZoom(1.05, width/2, height/2); changed = true; }
    if (zoomOutButton.isMouseOver()) { doZoom(1.0/1.05, width/2, height/2); changed = true; }
  }

  if (changed) needsRedraw = true;
}

void doZoom(double factor, int targetX, int targetY) {
  float aspectRatio = (float)width / height;
  
  double baseX = map(targetX, 0, width, -2.1f * aspectRatio, 1.1f * aspectRatio);
  double baseY = map(targetY, 0, height, -2.1f, 1.1f);

  double oldZoom = zoom;
  zoom *= factor;

  offsetX += baseX * (1.0 / oldZoom - 1.0 / zoom);
  offsetY += baseY * (1.0 / oldZoom - 1.0 / zoom);
}

void renderFractalToBuffer() {
  fractalBuffer.beginDraw();
  fractalBuffer.loadPixels();
  fractalBuffer.colorMode(RGB, 1.0); 
  
  float aspectRatio = (float)width / height;
  double invZoom = 1.0 / zoom;
  
  for (int x = 0; x < width; x++) {
    for (int y = 0; y < height; y++) {
      double cx = (map(x, 0, width, -2.1f * aspectRatio, 1.1f * aspectRatio)) * invZoom + offsetX;
      double cy = (map(y, 0, height, -2.1f, 1.1f)) * invZoom + offsetY;
      
      double zx = cx;
      double zy = cy;
      int n = 0;
      
      while (n < maxIterations) {
        double zx2 = zx * zx;
        double zy2 = zy * zy;
        if (zx2 + zy2 > 16.0) break;
        
        double nextZx = zx2 - zy2 + cx;
        zy = Math.abs(2.0 * zx * zy) + cy;
        zx = nextZx;
        n++;
      }
      
      int pixColor;
      if (n == maxIterations) {
        pixColor = fractalBuffer.color(0); 
      } else {
        float log_zn = (float)Math.log(zx*zx + zy*zy) / 2.0f;
        float nu = (float)Math.log(log_zn / (float)Math.log(2)) / (float)Math.log(2);
        float t = (n + 1 - nu) / maxIterations;
        
        int lutIndex = floor(constrain(t, 0, 1) * (colorLUT.length - 1));
        pixColor = colorLUT[lutIndex];
      }
      fractalBuffer.pixels[x + y * width] = pixColor;
    }
  }
  fractalBuffer.updatePixels();
  fractalBuffer.endDraw();
}

void drawUI() {
  colorMode(RGB, 255); 
  
  fill(0, 180);
  rect(10, 10, 380, 235);
  
  fill(255);
  textSize(20);
  textAlign(LEFT);
  
  text("Iterations: " + maxIterations, 20, 40);
  text("Zoom: " + nfc((float)zoom, 1) + "x", 20, 70);
  text("X: " + nfc((float)-offsetX, 4), 20, 100);
  text("Y: " + nfc((float)offsetY, 4), 20, 130);
  
  textSize(14);
  fill(200);
  text("[WASD/Arrows]: Pan  [Q/E] or Scroll: Zoom", 20, 165);
  text("[H]: Show/Hide UI", 20, 185);
  
  zoomInButton.display();
  zoomOutButton.display();
  mapDropdown.display();
}

void mousePressed() {
  if (!showUI) return;

  if (mapDropdown.isOpen) {
    int clicked = mapDropdown.getClickedIndex();
    if (clicked != -1) {
      currentMapIndex = clicked;
      generateLUT();
      needsRedraw = true;
    }
    mapDropdown.isOpen = false; 
    return; 
  }
  
  if (mapDropdown.isHeaderOver()) {
    mapDropdown.toggle();
    return;
  }
}

void mouseDragged() {
  if (showUI && mapDropdown.isOpen) return;
  if (showUI && (zoomInButton.isMouseOver() || zoomOutButton.isMouseOver())) return;

  double aspect = (double)width / height;
  double moveX = (mouseX - pmouseX) * (3.2 * aspect) / width / zoom;
  double moveY = (mouseY - pmouseY) * 3.2 / height / zoom;
  
  offsetX -= moveX;
  offsetY -= moveY;
  needsRedraw = true;
}

void mouseWheel(MouseEvent event) {
  if (showUI && mapDropdown.isOpen) return;
  
  float e = event.getCount();
  double zoomFactor = (e < 0) ? 1.15 : 1.0/1.15;
  
  needsRedraw = true;
  doZoom(zoomFactor, mouseX, mouseY);
}

void keyPressed() {
  if (key == 'h' || key == 'H') showUI = !showUI;
  
  if (key == 'w' || key == 'W' || keyCode == UP) keyUp = true;
  if (key == 's' || key == 'S' || keyCode == DOWN) keyDown = true;
  if (key == 'a' || key == 'A' || keyCode == LEFT) keyLeft = true;
  if (key == 'd' || key == 'D' || keyCode == RIGHT) keyRight = true;
  
  if (key == 'e' || key == 'E' || key == '=' || key == '+') keyZoomIn = true;
  if (key == 'q' || key == 'Q' || key == '-') keyZoomOut = true;
}

void keyReleased() {
  if (key == 'w' || key == 'W' || keyCode == UP) keyUp = false;
  if (key == 's' || key == 'S' || keyCode == DOWN) keyDown = false;
  if (key == 'a' || key == 'A' || keyCode == LEFT) keyLeft = false;
  if (key == 'd' || key == 'D' || keyCode == RIGHT) keyRight = false;
  
  if (key == 'e' || key == 'E' || key == '=' || key == '+') keyZoomIn = false;
  if (key == 'q' || key == 'Q' || key == '-') keyZoomOut = false;
}

void generateLUT() {
  double[][] coeffs = getCoefficients(mapNames[currentMapIndex]);
  colorMode(RGB, 1.0);
  for (int i = 0; i < colorLUT.length; i++) {
    float t = (float)i / (colorLUT.length - 1);
    colorLUT[i] = color(
      (float)applyPoly(t, coeffs[0]), 
      (float)applyPoly(t, coeffs[1]), 
      (float)applyPoly(t, coeffs[2])
    );
  }
}

double applyPoly(float t, double[] c) {
  return c[0] + c[1]*t + c[2]*Math.pow(t,2) + c[3]*Math.pow(t,3) + 
         c[4]*Math.pow(t,4) + c[5]*Math.pow(t,5) + c[6]*Math.pow(t,6);
}

class Dropdown {
  float x, y, w, h;
  String[] items;
  boolean isOpen = false;
  
  Dropdown(float x, float y, float w, float h, String[] items) {
    this.x=x; this.y=y; this.w=w; this.h=h; this.items=items;
  }
  
  void display() {
    stroke(255);
    fill(uiColour);
    rect(x, y, w, h);
    fill(255);
    textSize(16);
    textAlign(LEFT, CENTER);
    text("Map: " + items[currentMapIndex], x + 10, y + h/2);
    
    if (isOpen) {
      for (int i = 0; i < items.length; i++) {
        fill(mouseX > x && mouseX < x+w && mouseY > y + h + (i*h) && mouseY < y + 2*h + (i*h) ? uiColour + 50 : uiColour + 20);
        rect(x, y + h + (i*h), w, h);
        fill(255);
        text(items[i], x + 10, y + h + (i*h) + h/2);
      }
    }
  }
  
  void toggle() { isOpen = !isOpen; }
  boolean isHeaderOver() { return mouseX > x && mouseX < x+w && mouseY > y && mouseY < y+h; }
  
  int getClickedIndex() {
    for (int i = 0; i < items.length; i++) {
      if (mouseX > x && mouseX < x+w && mouseY > y + h + (i*h) && mouseY < y + 2*h + (i*h)) return i;
    }
    return -1;
  }
}

class Button {
  float x, y, w, h; String label;
  Button(float x, float y, float w, float h, String l) { this.x=x; this.y=y; this.w=w; this.h=h; label=l; }
  void display() {
    fill(isMouseOver() ? uiColour + 30 : uiColour); 
    stroke(255); 
    rect(x, y, w, h);
    fill(255); 
    textSize(40);
    textAlign(CENTER, CENTER); 
    text(label, x + w/2, y + h/2);
  }
  boolean isMouseOver() { return (mouseX > x && mouseX < x+w && mouseY > y && mouseY < y+h); }
}

double[][] getCoefficients(String name) {
  if (name.equals("cividis")) return new double[][]{{-0.008973, -0.384689, 15.429210, -58.977031, 102.370492, -83.187239, 25.776070}, {0.136756, 0.639494, 0.385562, -1.404197, 2.600914, -2.140750, 0.688122}, {0.294170, 2.982654, -22.363760, 74.863561, -121.303164, 93.974216, -28.262533}};
  if (name.equals("inferno")) return new double[][]{{0.000214, 0.105874, 11.617115, -41.709277, 77.157454, -71.287667, 25.092619}, {0.001635, 0.566364, -3.947723, 17.457724, -33.415679, 32.553880, -12.222155}, {-0.037130, 4.117926, -16.257323, 44.645117, -82.253923, 73.588132, -23.115650}};
  if (name.equals("magma")) return new double[][]{{-0.002067, 0.250486, 8.345901, -27.666969, 52.170684, -50.758572, 18.664253}, {-0.000688, 0.694455, -3.596031, 14.253853, -27.944584, 29.053880, -11.490027}, {-0.009548, 2.495287, 0.329057, -13.646583, 12.881091, 4.269936, -5.570769}};
  if (name.equals("mako")) return new double[][]{{0.032987, 1.620032, -5.833466, 19.266730, -48.335836, 57.794682, -23.674380}, {0.013232, 0.848348, -1.651402, 8.153931, -12.793640, 8.555513, -2.172825}, {0.040283, 0.292971, 12.702365, -44.241782, 65.176477, -47.319049, 14.259791}};
  if (name.equals("plasma")) return new double[][]{{0.064053, 2.142438, -2.653255, 6.094711, -11.065106, 9.974645, -3.623823}, {0.024812, 0.244749, -7.461101, 42.308428, -82.644718, 71.408341, -22.914405}, {0.534900, 0.742966, 3.108382, -28.491792, 60.093584, -54.020563, 18.193381}};
  if (name.equals("rocket")) return new double[][]{{-0.003174, 1.947267, -6.401815, 30.376433, -57.268147, 44.789992, -12.453563}, {0.037717, -0.476821, 15.073064, -81.403784, 173.768416, -158.313952, 52.250665}, {0.112123, 0.400542, 6.253872, -21.550609, 14.869938, 11.402042, -10.648435}};
  if (name.equals("turbo")) return new double[][]{{0.080545, 7.008980, -66.727306, 228.660253, -334.841257, 220.424075, -54.095540}, {0.069393, 3.147611, -4.927799, 25.101273, -69.296265, 67.510842, -21.578703}, {0.219622, 7.655918, -10.162980, -91.680678, 288.708703, -305.386975, 110.735079}};
  if (name.equals("viridis")) return new double[][]{{0.274455, 0.107708, -0.327241, -4.599932, 6.203736, 4.751787, -5.432077}, {0.005768, 1.396470, 0.214814, -5.758238, 14.153965, -13.749439, 4.641571}, {0.332664, 1.386771, 0.091977, -19.291809, 56.656300, -65.320968, 26.272108}};
  return new double[][]{{0, 1, 0, 0, 0, 0, 0}, {0, 1, 0, 0, 0, 0, 0}, {0, 1, 0, 0, 0, 0, 0}}; 
}