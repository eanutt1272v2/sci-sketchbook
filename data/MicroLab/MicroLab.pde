
// @file MicroLab.pde
// @author @eanutt1272.v2
// @version 1.0.0
// Main File

int initialParticlesNum = 3000;
float viscosity = 0.85;
float maxSpeed = 500;
float worldScale = 0.5;
float trailAlpha = 30;

boolean useInitialParticles = true;
boolean useInstant = true;
boolean useRect = false;
boolean useEvolveRules = false;
boolean useTrails = false;
boolean showBounds = true;
boolean showHUD = true;

boolean isDesktop;
int trueScreenWidth;
int trueScreenHeight;

float zoom = 1;
float zoomRate = 1.05;
float offsetX = 0;
float offsetY = 0;
float originX;
float originY;

Manager man;
Mouse mouse;
GUI gui;

PImage lightAppIcon;
PImage darkAppIcon;
boolean useLightAppIcon = true;

void settings() {
   size(displayWidth, displayHeight, P2D);
   pixelDensity(displayDensity());
   osCheck();
}

void setup() {
   frameRate(60);
   //setAppIcon();
   man = new Manager();
   mouse = new Mouse();
   gui = new GUI(man);
   man.randomTypes();
}

void draw() {
   man.update();
   mouse.update();
   gui.update();
}

void mouseWheel(MouseEvent event) {
   float e = event.getCount();
   zoom = (e > 0) ? zoom/zoomRate : zoom*zoomRate;
}

void setAppIcon() {
   lightAppIcon = loadImage("lightAppIcon.png");
   darkAppIcon  = loadImage("darkAppIcon.png");
   
   if (isDesktop) {
      if (useLightAppIcon && lightAppIcon != null) {
         surface.setIcon(lightAppIcon);
      } 
      else if (!useLightAppIcon && darkAppIcon != null) {
         surface.setIcon(darkAppIcon);
      } 
      else {
         println("Error: Icon image not found for selected theme.");
      }
   } else {
      initialParticlesNum = 500;
   }
}

String getOS() {
   try {
      return System.getProperty("os.name");
   } catch (Exception e) {
      return null;
   }
}

void osCheck() {
   String os = getOS();
   if (os != null) {
      isDesktop = true;
   } else {
      isDesktop = false;
   }
}

void mouseDragged() {
   gui.mouseDragged();
}

void keyPressed() {
   gui.handleKey(key, keyCode);
}