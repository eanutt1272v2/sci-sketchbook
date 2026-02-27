bool dragging = false;
float boxSize = 150;
float axesLength = 500;
float radiansX = -PI/4, radiansY = -PI/4;
float degreesX, degreesY;

void setup() {
   size(screenWidth, screenHeight, P3D);
}

void draw() {
   environment();
   radiansToDegrees();
   textInfo();
   cameraUpdate();
   drawAxesLabels();
   drawAxes();
   drawObject();
}

void mousePressed() {
   dragging = true;
}

void mouseReleased() {
   dragging = false;
}

void mouseDragged() {
   float sensitivity = 0.008; // Adjust sensitivity
   radiansX += (pmouseY -= mouseY) * sensitivity;
   radiansY -= (pmouseX -= mouseX) * sensitivity;
}

void drawObject() {
   fill(200);
   stroke(0);
   box(boxSize);
}

void drawAxes() {
   strokeWeight(1);
   stroke(255, 0, 0);
   line(-axesLength / 2, 0, 0, axesLength / 2, 0, 0); // X-axis
   stroke(0, 255, 0);
   line(0, -axesLength / 2, 0, 0, axesLength / 2, 0); // Y-axis
   stroke(0, 0, 255);
   line(0, 0, -axesLength / 2, 0, 0, axesLength / 2); // Z-axis
}

void drawAxesLabels() {
   stroke(0);
   fill(255, 0, 0);
   text("X", (axesLength/2) + 10, 0, 10);
   text("-X", -(axesLength/2) - 10, 0, 10);
   fill(0, 255, 0);
   text("Y", 0, (axesLength/2) + 10, 10);
   text("-Y", 0, -(axesLength/2) - 10, 10);
   fill(0, 0, 255);
   text("Z", 0, 0, (axesLength/2) + 20);
   text("-Z", 0, 0, -(axesLength/2) - 10);
}

void cameraUpdate() {
   rotateX(constrain(radiansX, -PI/2, PI/2));
   rotateY(radiansY);
}

void environment() {
   background(0);
   lights();
   textSize(20);
}

void radiansToDegrees() {
   degreesX = radiansX * (180 / PI);
   degreesY = radiansY * (180 / PI);
}

void textInfo() {
   fill(255);
   text("Local Cam Rotation X: " + degreesX, 20, 20);
   text("Local Cam Rotation Y: " + degreesY, 20, 50);
   translate(width / 2, height / 2);
}
