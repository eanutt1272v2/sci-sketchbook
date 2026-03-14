
// @file MandelBulber.pde
// @author @eanutt1272.v2
// @version 1.0.0
int maximumIterations = 8;
int power = 8;
int resolutionScale = 128;
int objectSize = 175;

bool dragging = false;
float axesLength = 500;
float radiansX = -PI/4, radiansY = -PI/4;
float degreesX, degreesY;

ArrayList<PVector> mandelBulb = new ArrayList<PVector>();

void setup() {
   size(screenWidth, screenHeight, P3D);
   computeObject();
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

void computeObject() {
   for(int i = 0; i < resolutionScale; i++){
      for(int j = 0; j < resolutionScale; j++){
         bool edge = false;
         for(int k = 0; k < resolutionScale; k++){
            
            float x = map(i, 0, resolutionScale, -1, 1);
            float y = map(j, 0, resolutionScale, -1, 1);
            float z = map(k, 0, resolutionScale, -1, 1);
            
            PVector zeta = new PVector(0, 0, 0);
            
            int maxiterations = maximumIterations;
            int iteration = 0;
            int n = power;
            
            while(true){
               //println("Computing..." + (iteration / maxiterations) * 100 + "%";
               Spherical s = spherical(zeta.x, zeta.y, zeta.z);
               
               float newX =  pow(s.r, n) * sin(s.theta*n) * cos(s.phi*n);
               float newY = pow(s.r, n) * sin(s.theta*n) * sin(s.phi*n);
               float newZ = pow(s.r, n) * cos(s.theta*n);
               
               zeta.x = newX + x;
               zeta.y = newY + y;
               zeta.z = newZ + z;    
               
               iteration++;
               stroke(random(0, 255), random(0, 255), random(0, 255));
               
               if(s.r > 2){
                  if(edge) edge = false;
                  break;
               } 
               
               if(iteration > maxiterations){
                  if(!edge){
                     edge = true;
                     mandelBulb.add(new PVector(x*objectSize , y*objectSize, z*objectSize));
                  }
                  break;
               }
            }
         } 
      }
   }
}

class Spherical {
   float r, theta, phi;
   
   Spherical(float r, float theta, float phi){
      this.r = r;
      this.theta = theta;
      this.phi = phi;
   }
}

Spherical spherical  (float x, float y, float z){
   float r = sqrt(x*x + y*y + z*z);
   float theta = atan2(sqrt(x*x + y*y), z);
   float phi = atan2(y, x);
   return new Spherical(r, theta, phi);
}

void drawObject() {
   stroke(255, 255);
   for(PVector v : mandelBulb){
      point(v.y, v.z, v.x);
   }
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
}

void radiansToDegrees() {
   degreesX = radiansX * (180 / PI);
   degreesY = radiansY * (180 / PI);
}

void textInfo() {
   textSize(20);
   fill(255);
   text("Rotation X: " + degreesX, 10, 20);
   text("Rotation Y: " + degreesY, 10, 50);
   text("Iterations: " + maximumIterations, 10, 80);
   text("Power: " + power, 10, 110);
   text("Resolution: " + resolutionScale, 10, 140);
   text("Object Size: " + objectSize, 10, 170);
   translate(width / 2, height / 2);
}
