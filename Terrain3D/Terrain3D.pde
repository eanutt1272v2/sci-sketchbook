int cols, rows;
int scl = 20;
int w = 2000;
int h = 1600;

float[][] terrain;

void setup() {
   size(screenWidth, screenHeight, P3D);
   cols = w / scl;
   rows = h / scl;
   terrain = new float[cols][rows];
   generateTerrain();
}

void draw() {
   background(0);
   renderTerrain();
   drawAxes(200);
}

void generateTerrain() {
   float yoff = 0;
   for (int y = 0; y < rows; y++) {
      float xoff = 0;
      for (int x = 0; x < cols; x++) {
         terrain[x][y] = map(noise(xoff, yoff), 0, 1, -100, 100);
         xoff += 0.1;
      }
      yoff += 0.1;
   }
}

void renderTerrain() {
   translate(width / 2, height / 2);
   rotateX(PI / 3);
   translate(-w / 2, -h / 2);
   
   for (int y = 0; y < rows - 1; y++) {
      beginShape(TRIANGLE_STRIP);
      for (int x = 0; x < cols; x++) {
         vertex(x * scl, y * scl, terrain[x][y]);
         vertex(x * scl, (y + 1) * scl, terrain[x][y + 1]);
      }
      endShape();
   }
}

void drawAxes(float length) {
   strokeWeight(2);
   // X-axis (red)
   stroke(255, 0, 0);
   line(-length, 0, 0, length, 0, 0);
   // Y-axis (green)
   stroke(0, 255, 0);
   line(0, -length, 0, 0, length, 0);
   // Z-axis (blue)
   stroke(0, 0, 255);
   line(0, 0, -length, 0, 0, length);
}