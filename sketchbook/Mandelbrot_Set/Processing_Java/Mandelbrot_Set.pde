

AppCore appcore;
PFont monoFont;

final String SKETCH_NAME = "Mandelbrot";
final String SKETCH_VERSION = "v3.0.0";
final String SKETCH_AUTHOR = "@eanutt1272.v2";

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

  monoFont = createFont("monaco.ttf", 13, true);
  textFont(monoFont);

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