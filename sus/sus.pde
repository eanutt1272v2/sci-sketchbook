float friction = 0.8;
float charge = 4;

class Atom {
   PVector position;
   PVector velocity;
   float charge;
   
   Atom(float x, float y, float charge) {
      this.position = new PVector(x, y);
      this.velocity = new PVector(0, 0);
      this.charge = charge;
   }
   
   void update() {
      position.add(velocity);
      velocity.mult(friction);
      position.x = (position.x + width) % width;
      position.y = (position.y + height) % height;
   }
   
   void applyForce(PVector force) {
      velocity.add(force);
   }
   
   void display() {
      fill(255);
      noStroke();
      ellipse(position.x, position.y, 5, 5);
   }
}

ArrayList<Atom> atoms;

void setup() {
   size(screenWidth, screenHeight);
   atoms = new ArrayList<Atom>();
   for (int i = 0; i < 500; i++) {
      atoms.add(new Atom(random(width), random(height), charge));
   }
}

void draw() {
   background(0);
   for (Atom a : atoms) {
      a.update();
      a.display();
   }
   for (int i = 0; i < atoms.size(); i++) {
      for (int j = i + 1; j < atoms.size(); j++) {
         applyCoulombsLaw(atoms.get(i), atoms.get(j));
      }
   }
}

void applyCoulombsLaw(Atom a1, Atom a2) {
   PVector force = PVector.sub(a2.position, a1.position);
   float distance = force.mag();
   if (distance <= 5) {
      float strength = (a1.charge / a2.charge) / (distance*distance) * -1 * friction;
   } else {
      float strength = (a1.charge / a2.charge) / (distance*distance);
   }
   force.normalize();
   force.mult(strength);
   a1.applyForce(force);
   force.mult(-1);
   a2.applyForce(force);
}