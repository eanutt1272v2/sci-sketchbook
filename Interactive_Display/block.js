class Block {
   
   constructor(x, y, size) {
      this.x = x;
      this.y = y;
      this.angle = 0;
      this.size = size;
      this.colour = 70;
   }
   
   display() {
      noFill();
      stroke(this.colour);
      push();
      translate(this.x, this.y);
      rotate(this.angle);

      if(this.angle > 0 && this.angle < 45) {
         this.drawRect();
      } else {
         this.drawCross();
      }

      pop();
   }
   
   move() {
      let distance;
      
      if (pmouseX - mouseX != 0 || pmouseY - mouseY != 0) {
         distance = dist(mouseX, mouseY, this.x, this.y);
         
         if (distance < distMouse) {
            this.angle += 1 * speedScalar;
            this.colour = 255;
         } 
      }
      
      if (this.angle > 0 && this.angle < 90) {
         this.angle += 1 * speedScalar;
         if (this.colour > 70) {
            this.colour -= 7.5;
         }
      } else {
         this.angle = 0;
         this.colour = 70;
      }
   }
   
   drawRect() {
      rect(0, 0, this.size - spacing);
   }
   
   drawCross() {
      let margin = -this.size / 2;
      line(margin + spacing / 2, margin + spacing / 2, margin + this.size - spacing / 2, margin + this.size - spacing / 2);
      line(margin + this.size - spacing / 2, margin + spacing / 2, margin + spacing / 2, margin + this.size - spacing / 2);
      pop();
   }
}