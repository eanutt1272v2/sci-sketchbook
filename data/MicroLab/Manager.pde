
// @file Manager.pde
// @author @eanutt1272.v2
// @version 1.0.0
class Manager {
   ArrayList<Type> types = new ArrayList<Type>();
   ArrayList<Particle> particles = new ArrayList<Particle>();
   HashMap<Long, IntList> spatialBuckets = new HashMap<Long, IntList>();
   int evolveTick = 0;
   float initialSpawnRadius = -1;
   float interactionRadius = 120;
   float gridCellSize = 120;
   int gridCols = 1;
   int gridRows = 1;
   
   void display() {
      if (useTrails) {
         noStroke();
         fill(0, constrain(trailAlpha, 2, 180));
         rect(0, 0, width, height);
      } else {
         background(0);
      }
      
      for (Particle particle : particles) {
         particle.display();
      }
      
      if (showBounds) {
         renderBounds();
      }
   }
   
   void update() {
      setOrigin();

      stepSimulation();
      
      display();
      
      initialParticles();
      
      if (useEvolveRules && (++evolveTick % 4 == 0)) {
         evolveRules();
      }
   }

   void stepSimulation() {
      if (particles.size() == 0 || types.size() == 0) {
         return;
      }

      refreshGridMeta();
      buildSpatialGrid();

      boolean mouseActive = mouse != null && mouse.selected && mousePressed && mouseButton == LEFT;
      PVector dragDelta = mouseActive ? mouse.setPos() : null;

      for (int i = 0; i < particles.size(); i++) {
         Particle p = particles.get(i);
         float vx = 0;
         float vy = 0;

         if (mouseActive && mouse.inMouse(p)) {
            vx = dragDelta.x;
            vy = dragDelta.y;
         } else if (gui.running) {
            PVector force = accumulateLocalForce(p);
            vx = force.x * viscosity;
            vy = force.y * viscosity;

            float speedSq = vx * vx + vy * vy;
            float maxSpeedSq = maxSpeed * maxSpeed;
            if (speedSq > maxSpeedSq && speedSq > 0) {
               float ratio = maxSpeed / sqrt(speedSq);
               vx *= ratio;
               vy *= ratio;
            }
         }

         p.integrate(vx, vy);
      }
   }

   PVector accumulateLocalForce(Particle center) {
      float fx = 0;
      float fy = 0;

      int cellX = worldToCellX(center.pos.x);
      int cellY = worldToCellY(center.pos.y);

      for (int ox = -1; ox <= 1; ox++) {
         for (int oy = -1; oy <= 1; oy++) {
            int nx = wrapCellX(cellX + ox);
            int ny = wrapCellY(cellY + oy);
            IntList bucket = spatialBuckets.get(cellKey(nx, ny));
            if (bucket == null) {
               continue;
            }

            for (int bi = 0; bi < bucket.size(); bi++) {
               Particle other = particles.get(bucket.get(bi));
               if (other == center) {
                  continue;
               }

               float dx = other.pos.x - center.pos.x;
               float dy = other.pos.y - center.pos.y;

               if (dx > width * 0.5) dx -= width;
               if (dx < -width * 0.5) dx += width;
               if (dy > height * 0.5) dy -= height;
               if (dy < -height * 0.5) dy += height;

               float d2 = dx * dx + dy * dy;
               if (d2 == 0) {
                  continue;
               }

               float d = sqrt(d2);
               if (d > interactionRadius) {
                  continue;
               }

               float force = interactionEquation(center.type, other.type, d);
               if (force == 0) {
                  continue;
               }

               float ratio = force / d;
               fx += ratio * -dx;
               fy += ratio * -dy;
            }
         }
      }

      return new PVector(fx, fy);
   }

   float interactionEquation(Type centerType, Type otherType, float d) {
      float a = centerType.attraction[otherType.index];
      float r = centerType.repelDist[otherType.index];
      float m = centerType.middle[otherType.index];

      if (0 <= d && d <= 2 * r) {
         return abs((2 * a / (4 * r * r)) * pow(d - 2 * r, 2));
      }
      if (2 * r <= d && d < m + 2 * r) {
         return a / m * d - 2 * r * a / m;
      }
      if (m + 2 * r <= d && d <= 2 * m + 2 * r) {
         return -a / m * d + 2 * m * a / m + 2 * r * a / m;
      }

      return 0;
   }

   void refreshGridMeta() {
      float maxRange = 25 * worldScale;
      for (Type t : types) {
         for (int i = 0; i < t.middle.length; i++) {
            maxRange = max(maxRange, t.middle[i] * 2 + t.repelDist[i] * 2);
         }
      }

      interactionRadius = max(32 * worldScale, maxRange);
      gridCellSize = max(24 * worldScale, interactionRadius);
      gridCols = max(1, ceil(width / gridCellSize));
      gridRows = max(1, ceil(height / gridCellSize));
   }

   void buildSpatialGrid() {
      spatialBuckets.clear();
      for (int i = 0; i < particles.size(); i++) {
         Particle p = particles.get(i);
         int cx = worldToCellX(p.pos.x);
         int cy = worldToCellY(p.pos.y);
         long key = cellKey(cx, cy);

         IntList bucket = spatialBuckets.get(key);
         if (bucket == null) {
            bucket = new IntList();
            spatialBuckets.put(key, bucket);
         }
         bucket.append(i);
      }
   }

   int worldToCellX(float x) {
      return wrapCellX(floor(x / gridCellSize));
   }

   int worldToCellY(float y) {
      return wrapCellY(floor(y / gridCellSize));
   }

   int wrapCellX(int x) {
      int wrapped = x % gridCols;
      if (wrapped < 0) wrapped += gridCols;
      return wrapped;
   }

   int wrapCellY(int y) {
      int wrapped = y % gridRows;
      if (wrapped < 0) wrapped += gridRows;
      return wrapped;
   }

   long cellKey(int x, int y) {
      return (((long) x) << 32) ^ (y & 0xffffffffL);
   }
   
   void addParticle(int type, float x, float y) {
      PVector newPos = reverseTranslateCoords(x, y);
      particles.add(new Particle(type, new PVector(newPos.x, newPos.y), types));
   }
   
   void addType(color c, float typeRadius, float[] attraction, float[] middle, float[] repelDist) {
      types.add(new Type(c, typeRadius, attraction, middle, repelDist, types));
   }
   
   void randomParticles(int num, float rad) {
      for (int i = 0; i < num; i++) {
         float u = 1;
         float x = random(-u, u);
         float y = random(-sqrt(1 - x * x), sqrt(1 - x * x));
         addParticle((int) random(0, types.size()), width / 2 + x * rad, height / 2 + y * rad);
      }
   }
   
   void randomTypes() {
      if (gui != null) {
         gui.selected = -1;
      }
      initialSpawnRadius = -1;
      int len = (int) random(3, 16);
      for (int i = 0; i < len; i++) {
         float[] a = makeArray(-3 * worldScale, 3 * worldScale, len);
         
         float[] m = makeArray(15 * worldScale, 80 * worldScale, len);
         
         float[] r = makeArray(2 * worldScale, random(25 * worldScale, 64 * worldScale), len);
         
         float t = random(3, 4) * worldScale * 2;
         
         float desaturation = 100;
         
         float red = random(desaturation, 255);
         
         float green = random(desaturation, 255);
         
         float blue = random(desaturation, 255);
         
         color c = color(red, green, blue);
         
         man.addType(c, t, a, m, r);
      }

      refreshGridMeta();
   }
   
   void newRules() {
      int len = types.size();
      
      for (Type type : types) {
         float[] a = makeArray(-3 * worldScale, 3 * worldScale, len);
         
         float[] m = makeArray(15 * worldScale, 80 * worldScale, len);
         
         float[] r = makeArray(2 * worldScale, random(25 * worldScale, 64 * worldScale), len);
         
         type.attraction = a;
         
         type.middle = m;
         
         type.repelDist = r; 
      }

      refreshGridMeta();
   }
   
   void evolveRules() {
      int len = types.size();
      
      for (Type type : types) {
         float delta = random(0.1, 1.75) * 0.1;
         
         float[] a = evolveArray(-3 * worldScale, 3 * worldScale, type.attraction, -delta * worldScale, delta * worldScale, len);
         
         float[] m = evolveArray(15 * worldScale, 80 * worldScale, type.middle, -delta * worldScale, delta * worldScale, len);
         
         float[] r = evolveArray(2 * worldScale, 64 * worldScale, type.repelDist, -delta * worldScale, delta * worldScale, len);
         
         type.attraction = a;
         
         type.middle = m;
         
         type.repelDist = r; 
      }

      refreshGridMeta();
   }
   
   float[] makeArray(float lower, float upper, int len) {
      float[] outputArray = new float[len];
      
      for (int i = 0; i < len; i++) {
         outputArray[i] = random(lower, upper);
      }
      
      return outputArray;
   }
   
   float[] evolveArray(float min, float max, float[] inputArray, float lower, float upper, int len) {
      float[] outputArray = inputArray;
      
      for (int i = 0; i < len; i++) {
         outputArray[i] += random(lower, upper);
         outputArray[i] = constrain(outputArray[i], min, max);
      }
      
      return outputArray;
   }
   
   void initialParticles() {
      if (initialSpawnRadius < 0) {
         initialSpawnRadius = (PI - 3) * initialParticlesNum * worldScale * random(3, 8);
      }

      if (useInitialParticles && man.particles.size() < initialParticlesNum) {
         if (useInstant) {
            int amount = initialParticlesNum - man.particles.size();
            man.randomParticles(amount, initialSpawnRadius * zoom);
         }
         if (!useInstant) {
            man.randomParticles(1, initialSpawnRadius * zoom);
         }
      }
      if (!useInitialParticles && man.particles.size() >= initialParticlesNum) {
         useInitialParticles = false;
         initialSpawnRadius = -1;
      }
   }
   
   void setOrigin() {
      originX = width / 2 + offsetX;
      originY = height / 2 + offsetY;
   }
   
   void renderBounds() {
      PVector topLeft = translateCoords(0, 0);
      noFill();
      stroke(gui.guiStroke);
      strokeWeight(gui.guiStrokeWeight);
      rect(topLeft.x, topLeft.y, width * zoom, height * zoom);
      ellipse(width / 2, height / 2, 15, 15);
   }

   void addBurst(int amount, int typeIndex, float screenX, float screenY, float radius) {
      if (types.size() == 0 || amount <= 0) {
         return;
      }

      int chosenType = constrain(typeIndex, 0, types.size() - 1);
      PVector center = reverseTranslateCoords(screenX, screenY);
      for (int i = 0; i < amount; i++) {
         float angle = random(TWO_PI);
         float dist = radius * sqrt(random(1));
         float x = center.x + cos(angle) * dist;
         float y = center.y + sin(angle) * dist;
         particles.add(new Particle(chosenType, new PVector(x, y), types));
      }
   }
   
   PVector translateCoords(float x, float y) {
      float tx = ((x - originX) * zoom) + originX - offsetX;
      float ty = ((y - originY) * zoom) + originY - offsetY;
      return new PVector(tx, ty);
   }
   
   PVector reverseTranslateCoords(float x, float y) {
      float wx = ((x + offsetX - originX) / zoom) + originX;
      float wy = ((y + offsetY - originY) / zoom) + originY;
      return new PVector(wx, wy);
   }
}
