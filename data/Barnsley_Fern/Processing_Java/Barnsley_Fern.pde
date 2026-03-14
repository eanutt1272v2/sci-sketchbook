/**
 * @file Barnsley_Fern.pde
 * @author @eanutt1272.v2
 * @version 2.1.0
 */

float x = 0, y = 0;
int pointsPerFrame = 8000;

void setup() {
  size(800, 800, P2D); 
  background(10, 15, 10);
  smooth(8);
}

void draw() {
  for (int i = 0; i < pointsPerFrame; i++) {
    nextPoint();
    drawPoint();
  }
}

void nextPoint() {
  float nextX, nextY;
  float r = random(1);
  if (r < 0.01) {
    nextX = 0;
    nextY = 0.16 * y;
  } else if (r < 0.86) {
    nextX = 0.85 * x + 0.04 * y;
    nextY = -0.04 * x + 0.85 * y + 1.6;
  } else if (r < 0.93) {
    nextX = 0.20 * x - 0.26 * y;
    nextY = 0.23 * x + 0.22 * y + 1.6;
  } else {
    nextX = -0.15 * x + 0.28 * y;
    nextY = 0.26 * x + 0.24 * y + 0.44;
  }
  x = nextX;
  y = nextY;
}

void drawPoint() {
  float px = map(x, -2.1820, 2.6558, 50, width - 50);
  float py = map(y, 0, 9.9983, height - 50, 50);

  float normY = map(y, 0, 9.9983, 0, 1);
  float r = lerp(20, 180, normY * normY);
  float g = lerp(60, 255, normY);
  float b = lerp(20, 100, normY);
  
  stroke(r, g, b, 120); 
  strokeWeight(1.2);
  point(px, py);
}

void keyPressed() {
  if (key == 'r' || key == 'R') {
    background(10, 15, 10);
  }
  
  if (key == 's' || key == 'S') {
    String filename = "Fern_" + year() + month() + day() + "_" + hour() + minute() + second() + ".png";
    saveFrame(filename);
    println("Saved image to: " + filename);
  }
}

void mouseClicked() {
  background(10, 15, 10);
}