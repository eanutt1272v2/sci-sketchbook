
// @file Particle.pde
// @author @eanutt1272.v2
// @version 1.0.0
class Particle {
   PVector pos;
   Type type;
   
   Particle(int index, PVector pos, ArrayList<Type> list) {
      this.pos = pos;
      this.type = list.get(index);
   }
   
   void display() {
      PVector newPos = man.translateCoords(pos.x, pos.y);
      float newRadius = type.typeRadius * zoom;
      
      noStroke();
      
      fill(type.c);
      
      if (useRect) {
         rect(newPos.x - newRadius / 2, newPos.y - newRadius / 2, newRadius, newRadius);
      }

      if (!useRect) {
         ellipse(newPos.x, newPos.y, newRadius, newRadius);
      }
   }

   void integrate(float vx, float vy) {
      pos.x += vx;
      pos.y += vy;
      wrapParticles();
   }
   
   void wrapParticles() {
      if (pos.x > width) {
         pos.x -= width;
      } else if (pos.x < 0) {
         pos.x += width;
      }
      if (pos.y > height) {
         pos.y -= height;
      } else if (pos.y < 0) {
         pos.y += height;
      }
   }
   
}
