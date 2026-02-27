int maxIterations = 256;
float zoom = 2;
float limit = random(0, 0.6);
float cx = random(-limit, limit);
float cy = random(-limit, limit);
float cz = random(-limit, limit);
float cw = random(-limit, limit);

void setup() {
   size(screenWidth, screenHeight);
   colorMode(HSB, 255);
   noLoop();
}

void draw() {
   loadPixels();
   
   for (int x = 0; x < width; x++) {
      for (int y = 0; y < height; y++) {
         float a = map(x, 0, width, -zoom, zoom);
         float b = map(y, 0, height, -zoom, zoom);
         float ca = a;
         float cb = b;
         float za = random(-1, 1);
         float zb = random(-1, 1);
         
         int n = 0;
         float distance = 0;
         
         while (n < maxIterations && distance < 16) {
            float aa = a * a - b * b;
            float bb = 2 * a * b;
            float cc = a * a - b * b;
            
            a = aa + cx;
            b = bb + cy;
            distance = a * a + b * b;
            n++;
         }
         
         if (n == maxIterations) {
            pixels[x + y * width] = color(0);
         } else {
            int bright = map(n, 0, maxIterations, 0, 255);
            if (n == maxIterations) {
               bright = 0;
            }
            float hue = map(n, 0, maxIterations, 0, 255);
            pixels[x + y * width] = color(hue, 255, bright * 100);
         }
      }
   }
   
   updatePixels();
}

void keyPressed() {
   if (key == 'r') {
      cx = random(-1, 1);
      cy = random(-1, 1);
      redraw();
   }
}