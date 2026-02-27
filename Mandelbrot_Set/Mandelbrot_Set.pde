int maxIterations = 128;
float aspectRatio = (screenWidth / screenHeight);
float minVal = -1;
float maxVal = 1;
float offsetX = 0;
float offsetY = 0;
float zoom = 1;
float uiColour = 50;

Button zoomInButton;
Button zoomOutButton;

void setup() {
   size(screenWidth, screenHeight);
   colorMode(HSB, 256);
   noStroke();
   zoomInButton = new Button(width - 100, height - 200, 80, 80, "+");
   zoomOutButton = new Button(width - 100, height - 100, 80, 80, "-");
}

void draw() {
   loadPixels();
   
   for (int x = 0; x < width; x++) {
      for (int y = 0; y < height; y++) {
         float a = map(x, 0, screenWidth, ((minVal * aspectRatio) / zoom) - offsetX, ((maxVal * aspectRatio) / zoom) - offsetX);
         float b = map(y, 0, screenHeight, ((minVal / zoom) - offsetY), ((maxVal / zoom) - offsetY));
         
         float ca = a;
         float cb = b;
         
         float n = 0;
         float smoothIter = 0;
         while (n < maxIterations) {
            float aa = a * a - b * b;
            float bb = 2 * a * b;
            a = aa + ca;
            b = bb + cb;
            
            if (a * a + b * b > 16) {
               smoothIter = n + 1 - log(log(sqrt(a*a + b*b))) / log(2);
               break;
            }
            
            n++;
         }
         
         float bright = map(smoothIter, 0, maxIterations, 0, 255);
         
         int pix = (x + y * width);
         pixels[pix] = color(bright, 255, bright*10);
      }
   }
   
   roundedOffsetX = round(offsetX * 1000) / 1000.0
   roundedOffsetY = round(offsetY * 1000) / 1000.0
   roundedZoom = round(zoom * 10) / 10.0
   
   updatePixels();
   fill(uiColour);
   textSize(20);
   textAlign(LEFT);
   fill(255);
   text("Iterations: " + maxIterations, 20, 40);
   text("Zoom: " + zoom + "x", 20, 70);
   text("X: " + -roundedOffsetX, 20, 100);
   text("Y: " + roundedOffsetY, 20, 130);
   
   zoomInButton.display();
   zoomOutButton.display();
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
println((mouseX - pmouseX) / ((screenHeight * zoom) / 2));
   offsetX += (mouseX - pmouseX) / ((screenHeight * zoom) / 2);
   offsetY += (mouseY - pmouseY) / ((screenHeight * zoom) / 2);
}

class Button {
   float x, y, w, h;
   String label;
   
   Button(float x, float y, float w, float h, String label) {
      this.x = x;
      this.y = y;
      this.w = w;
      this.h = h;
      this.label = label;
   }
   
   void display() {
      fill(uiColour);
      rect(x, y, w, h);
      fill(255);
      textSize(40);
      textAlign(CENTER, CENTER);
      text(label, x + w/2, y + h/2);
   }
   
   boolean isMouseOver() {
      return (mouseX > x && mouseX < x + w && mouseY > y && mouseY < y + h);
   }
}

void mouseClicked() {
   if (zoomInButton.isMouseOver()) {
      zoom *= 1.05;
   } else if (zoomOutButton.isMouseOver()) {
      zoom /= 1.05;
   }
}