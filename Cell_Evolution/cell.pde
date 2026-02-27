class cell{  // or colony of cells
  ArrayList<particle> swarm; // shouldn't have used the name swarm again
  float internalForces[][];
  float externalForces[][];
  float internalMins[][];
  float externalMins[][];
  float internalRadii[][];
  float externalRadii[][];
  PVector positions[];  // probably better as an arraylist
  int numParticles = 40;
  int energy = startingEnergy;
  int radius; // avg distance from center
  PVector center = new PVector(0,0); // center of the cell
  
  cell(float x, float y){
    internalForces = new float[numTypes][numTypes];
    externalForces = new float[numTypes][numTypes];
    internalMins = new float[numTypes][numTypes];
    externalMins = new float[numTypes][numTypes];
    internalRadii = new float[numTypes][numTypes];
    externalRadii = new float[numTypes][numTypes];
    // Positions are the inital relative positions of all of the particles.
    // This is critcal to cells starting in a 'good' configuration.
    positions = new PVector[numParticles];
    swarm = new ArrayList<particle>();
    generateNew(x,y);
  }
  
  // generate the parameters for a new cell
  // note: all of the random ranges could be tweaked
  void generateNew(float x, float y){
    for(int i = 0; i < numTypes; i++){
      for(int j= 0; j < numTypes; j++){
        internalForces[i][j] = random(0.1,1.0); // internal forces are initially attractive, but can mutate
        internalMins[i][j] = random(40,70);
        internalRadii[i][j] = random(internalMins[i][j]*2,300); // minimum 'primary' force range must be twice repulsive range
        externalForces[i][j] = random(-1.0,1.0); // external forces could be attractive or repulsive
        externalMins[i][j] = random(40,70);
        externalRadii[i][j] = random(externalMins[i][j]*2,300);
      }
    }
    for(int  i = 0; i < numParticles; i++){
      positions[i] = new PVector(x+random(-50,50),y+random(-50,50));
      swarm.add(new particle(positions[i], 1+(int)random(numTypes-1))); // type 0 is food
    }
  }
  
  // Used to copy the values from a parent cell to a daughter cell.
  // (I don't trust deep copy when data structures get complex :)
  void copyCell(cell c){
    for(int i = 0; i < numTypes; i++){
      for(int j= 0; j < numTypes; j++){
        internalForces[i][j] = c.internalForces[i][j];
        internalMins[i][j] = c.internalMins[i][j];
        internalRadii[i][j] = c.internalRadii[i][j];
        externalForces[i][j] = c.externalForces[i][j];
        externalMins[i][j] = c.externalMins[i][j];
        externalRadii[i][j] = c.externalRadii[i][j];
      }
    }
    float x = random(width);
    float y = random(height);
    for(int  i = 0; i < numParticles; i++){
      positions[i] = new PVector(x+c.positions[i].x,y+c.positions[i].y);
      //swarm[i] = new particle(positions[i], c.swarm[i].type);
      particle p = swarm.get(i);
      particle temp = new particle(p.position,p.type); // create a new particle from the parent
      swarm.add(temp); // add to the new cell
    }
  }
  
  // When a new cell is created from a 'parent' cell the new cell's values are mutated
  // This mutates all values a 'little' bit. Mutating a few values by a larger amount could work better
  void mutateCell(){
    for(int i = 0; i < numTypes; i++){
      for(int j= 0; j < numTypes; j++){  
        internalForces[i][j] += random(-0.1,0.1);
        internalMins[i][j] += random(-5,5);
        internalRadii[i][j] += random(-10,10);
        externalForces[i][j] += random(-0.1,0.1);
        externalMins[i][j] += random(-5,5);
        externalRadii[i][j] += random(-10,10);
      }
    }
    for(int  i = 0; i < numParticles; i++){
      positions[i] = new PVector(positions[i].x+random(-5,5),positions[i].y+random(-5,5));
      if(random(100)< 10){  // 10% of the time a particle changes type
        particle p = swarm.get(i);
        p.type = 1+(int)random(numTypes-1);
      }
    } // Could also mutate the number of particles in the cell
  }
  
  // update a cell by appling each type of forces to each particle in the cell
  void update(){
    for(particle p: swarm){ // for each particle in this cell
      p.applyInternalForces(this);
      p.applyExternalForces(this);
      p.applyFoodForces(this);
    }
    energy -= 1.0; // cells lose one energy/timestep - should be a variable. Or dependent on forces generated
}
  
  void display(){
    // Code to draw lines between the particles in a cell
    if(drawLines){
      particle p1, p2;
     stroke(0,0,30);
     for(int  i = 0; i < numParticles-1; i++){
       p1 = swarm.get(i);
       p2 = swarm.get(i+1);
       line(p1.position.x,p1.position.y,p2.position.x,p2.position.y);
     }
    }
    noStroke();
    for(particle p: swarm){
      p.display();
    }
  }
}
