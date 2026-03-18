static final class Config {
  static final int GRID_SIZE = 30;
  static final int CELLS_INTERVAL = 15;
  static final int LEFT_PANEL_WIDTH = 260;
  static final int RIGHT_COLUMN_WIDTH = 220;
  static final int COLUMN_GAP = 10;
  static final float VALUE_BOX_WIDTH = 50;
  static final float VALUE_BOX_HEIGHT = 16;
  static final int MIN_PARTICLES = 100;
  static final int MAX_PARTICLES = 20000;
}

AppCore appcore;
PFont font;

final String SKETCH_NAME = "Cellular Division";
final String SKETCH_VERSION = "v2.5.8-dev";
final String SKETCH_AUTHOR = "@eanutt1272.v2";

void settings() {
  size(1100, 800, P2D);
  pixelDensity(displayDensity());
}

void setup() {
  surface.setResizable(false);
  javax.swing.SwingUtilities.invokeLater(new Runnable() {
    public void run() {
      com.jogamp.newt.opengl.GLWindow w = (com.jogamp.newt.opengl.GLWindow) surface.getNative();
      w.setUndecorated(false);
      w.setSize(width, height);
    }
  });

  font = createFont("JetBrainsMono-Regular.ttf", 13, true);
  textFont(font);

  appcore = new AppCore();
}

void draw() {
  appcore.update();
  appcore.render();
}

void keyPressed() {
  appcore.onKeyPressed();
}
