
// @file Julia_Set.pde
// @author @eanutt1272.v2
// @version 1.0.0
int maxIterations = 256;
float minVal = -1;
float maxVal = 1;
float aspectRatio = (screenWidth / screenHeight);
float cRe = -0.7;
float cIm = 0.27015;
float zoom = 1;
float offsetX = 0;
float offsetY = 0;
float brightness = 1;
float windowscale = 1;

void setup() {
   size(screenWidth * windowscale, screenHeight * windowscale);
   colorMode(HSB, 256);
}

void draw() {
   loadPixels();
   for (int x = 0; x < width; x++) {
      for (int y = 0; y < height; y++) {
         float a = map(x, 0, screenWidth, ((minVal * aspectRatio) / zoom) - offsetX, ((maxVal * aspectRatio) / zoom) - offsetX);
         float b = map(y, 0, screenHeight, ((minVal / zoom) - offsetY), ((maxVal / zoom) - offsetY));
         int n = 0;
         float smoothIter = 0;
         
         while (n < maxIterations) {
            float aa = a * a - b * b;
            float bb = 2 * a * b;
            a = aa + cRe;
            b = bb + cIm;
            
            if (abs(a + b) > 16) {
               smoothIter = n + 1 - log(log(sqrt(a*a + b*b))) / log(2);
               break;
            }
            
            n++;
         }
         
         float bright = map(smoothIter, 0, maxIterations, 0, 255);
         
         if (n == maxIterations) {
            bright = 0;
         }
         
         int pix = x + y * width;
         pixels[pix] = color(bright * brightness, 255, bright * brightness);
      }
   }
   updatePixels();
   fill(255);
   textSize(20);
   text("Iterations: " + maxIterations, 10, 30);
   text("Zoom: " + zoom + "x", 10, 60);
   text("cRe: " + cRe, 10, 90);
   text("cIm: " + cIm, 10, 120);
   text("X: " + -offsetX, 10, 150);
   text("Y: " + offsetY, 10, 180);
}

void mouseWheel(MouseEvent event) {
   float e = event.getCount();
   if (e > 0) {
      zoom *= 1.1;
   } else {
      zoom /= 1.1;
   }
}

void mouseDragged() {
   offsetX += (mouseX - pmouseX) / ((screenHeight * zoom) / 2);
   offsetY += (mouseY - pmouseY) / ((screenHeight * zoom) / 2);
}