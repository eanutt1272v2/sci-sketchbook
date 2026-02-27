class particle { // or a cell of a colony or an organelle of a cell
  PVector position;
  PVector velocity;
  int type;

  // constructor
  particle(PVector start, int t) {
    position = new PVector(start.x, start.y);
    velocity = new PVector(0, 0);
    type = t;
  }

  // applies forces based on this cell's particles
  void applyInternalForces(cell c) {
    PVector totalForce = new PVector(0, 0);
    PVector acceleration = new PVector(0, 0);
    PVector vector = new PVector(0, 0);
    float dis;
    for (particle p : c.swarm) {
      if (p != this) {
        vector.mult(0);
        vector = p.position.copy();
        vector.sub(position);
        if (vector.x > width * 0.5) {
          vector.x -= width;
        }
        if (vector.x < width * -0.5) {
          vector.x += width;
        }
        if (vector.y > height * 0.5) {
          vector.y -= height;
        }
        if (vector.y < height * -0.5) {
          vector.y += height;
        }
        dis = vector.mag();
        vector.normalize();
        if (dis < c.internalMins[type][p.type]) {
          PVector force = vector.copy();
          force.mult(abs(c.internalForces[type][p.type])*-3*K);
          force.mult(map(dis, 0, c.internalMins[type][p.type], 1, 0));
          totalForce.add(force);
        }
        if (dis < c.internalRadii[type][p.type]) {
          PVector force = vector.copy();
          force.mult(c.internalForces[type][p.type]*K);
          force.mult(map(dis, 0, c.internalRadii[type][p.type], 1, 0));
          totalForce.add(force);
        }
      }
    }
    acceleration = totalForce.copy();
    velocity.add(acceleration);

    position.add(velocity);
    position.x = (position.x + width)%width;
    position.y = (position.y + height)%height;
    velocity.mult(friction);
  }
  
  // applies forces based on other cell's particles 
  void applyExternalForces(cell c) {
    PVector totalForce = new PVector(0, 0);
    PVector acceleration = new PVector(0, 0);
    PVector vector = new PVector(0, 0);
    float dis;
    for (cell other : swarm) { // for each other cell in the swarm
      if (other != c) {  // don't apply external forces within this cell
        for (particle p : other.swarm) { // for each particle in the other cell
          vector.mult(0);
          vector = p.position.copy();
          vector.sub(position);
          if (vector.x > width * 0.5) {
            vector.x -= width;
          }
          if (vector.x < width * -0.5) {
            vector.x += width;
          }
          if (vector.y > height * 0.5) {
            vector.y -= height;
          }
          if (vector.y < height * -0.5) {
            vector.y += height;
          }
          dis = vector.mag();
          vector.normalize();
          if (dis < c.externalMins[type][p.type]) {
            PVector force = vector.copy();
            force.mult(abs(c.externalForces[type][p.type])*-3*K);
            force.mult(map(dis, 0, c.externalMins[type][p.type], 1, 0));
            totalForce.add(force);
          }
          if (dis < c.externalRadii[type][p.type]) {
            PVector force = vector.copy();
            force.mult(c.externalForces[type][p.type]*K);
            force.mult(map(dis, 0, c.externalRadii[type][p.type], 1, 0));
            totalForce.add(force);
          }
        }
      }
    }
    acceleration = totalForce.copy();
    velocity.add(acceleration);
    position.add(velocity);
    position.x = (position.x + width)%width;
    position.y = (position.y + height)%height;
    velocity.mult(friction);
  }

  // applies forces based on nearby food particles
  void applyFoodForces(cell c) {
    PVector totalForce = new PVector(0, 0);
    PVector acceleration = new PVector(0, 0);
    PVector vector = new PVector(0, 0);
    float dis;
    for (particle p : food) {  // for all food particles
      vector.mult(0);
      vector = p.position.copy();
      vector.sub(position);
      if (vector.x > width * 0.5) {
        vector.x -= width;
      }
      if (vector.x < width * -0.5) {
        vector.x += width;
      }
      if (vector.y > height * 0.5) {
        vector.y -= height;
      }
      if (vector.y < height * -0.5) {
        vector.y += height;
      }
      dis = vector.mag();
      vector.normalize();
      // no repulsive force for food
      if (dis < c.externalRadii[type][p.type]) {
        PVector force = vector.copy();
        force.mult(c.externalForces[type][p.type]*K);
        force.mult(map(dis, 0, c.externalRadii[type][p.type], 1, 0));
        totalForce.add(force);
      }
    }
    acceleration = totalForce.copy();
    velocity.add(acceleration);
    position.add(velocity);
    position.x = (position.x + width)%width;
    position.y = (position.y + height)%height;
    velocity.mult(friction);
  }

  // display the particles
  void display() {
    fill(type*colorStep, 100, 100);
    circle(position.x, position.y, 8);
  }
}
