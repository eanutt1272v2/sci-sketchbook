/**
 * @file Mandelbrot_Set.pde
 * @description A Processing Java implementation of a Mandelbrot set explorer with a custom UI for adjusting parameters and colour maps.
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