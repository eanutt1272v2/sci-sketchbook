//Method
void sponge_init(float off, float size){
   Bsponge = new ArrayList<Box>();
   Tsponge = new ArrayList<Tetra>();
   Osponge = new ArrayList<Octa>();
   Box b = new Box(new PVector(-off,0,0), size);
   Bsponge.add(b);
   Tetra t = new Tetra(new PVector(0,0,0), size);
   Tsponge.add(t);
   Octa o = new Octa(new PVector(off,0,0), size);
   Osponge.add(o);
}

void div_sponge(){
   ArrayList<Tetra> Tnext = new ArrayList<Tetra>();
   for (Tetra t : Tsponge){
      ArrayList<Tetra> nextBoxes = t.generate();
      Tnext.addAll(nextBoxes);
   }
   Tsponge = Tnext;
   ArrayList<Box> Bnext = new ArrayList<Box>();
   for (Box b : Bsponge){
      ArrayList<Box> nextBoxes = b.generate();
      Bnext.addAll(nextBoxes);
   }
   Bsponge = Bnext;
   ArrayList<Octa> Onext = new ArrayList<Octa>();
   for (Octa o : Osponge){
      ArrayList<Octa> nextBoxes = o.generate();
      Onext.addAll(nextBoxes);
   }
   Osponge = Onext;
}

void show_sponge(){
   for (Tetra t : Tsponge){
      if(dispType==1 || dispType==3){
         t.show();
      }
   }
   for (Box b : Bsponge){
      if(dispType==0 || dispType==3){
         b.show();
      }
   }
   for (Octa o : Osponge){
      if(dispType==2 || dispType==3){
         o.show();
      }
   }
}

void multiRot(){
   if(userRot){
      rotateX((float)mouseY/1000);
      rotateY((float)mouseX/1000);
   }
   else{
      if(dispType == 3){
         rotateX(angle);
      }
      else{
         rotateX(angle);
         rotateY(angle*0.4);
         rotateZ(angle*0.1);
      }
   }
}

PVector[] octaVecs(float r){
   PVector[] points = new PVector[6];
   points[0] = new PVector(-r, 0, 0);
   points[1] = new PVector(0, -r, 0);
   points[2] = new PVector(r, 0, 0);
   points[3] = new PVector(0, r, 0);
   points[4] = new PVector(0, 0, r);
   points[5] = new PVector(0, 0, -r);
   return points;
}

void octa(PVector pos, float r){
   PVector[] points = octaVecs(r);
   pushMatrix();
   translate(pos.x, pos.y, pos.z);
   triangleVec(points[0], points[4], points[1]);
   triangleVec(points[1], points[4], points[2]);
   triangleVec(points[2], points[4], points[3]);
   triangleVec(points[3], points[4], points[0]);
   triangleVec(points[0], points[5], points[1]);
   triangleVec(points[1], points[5], points[2]);
   triangleVec(points[2], points[5], points[3]);
   triangleVec(points[3], points[5], points[0]);
   popMatrix();
}

PVector[] tetraVecs(float r){
   PVector[] result = new PVector[4];
   //result[0] = new PVector(3*r/4, r/3, -sqrt(3)*r/4);
   //result[1] = new PVector(-3*r/4, r/3, -sqrt(3)*r/4);
   //result[2] = new PVector(0, r/3, sqrt(3)*r/2);
   //result[3] = new PVector(0, -r, 0);//mistake
   result[0] = new PVector(sqrt(6)*r/3, r/3, -sqrt(2)*r/3);
   result[1] = new PVector(-sqrt(6)*r/3, r/3, -sqrt(2)*r/3);
   result[2] = new PVector(0, r/3, 2*sqrt(2)*r/3);
   result[3] = new PVector(0, -r, 0);
   return result;
}

void tetra(PVector pos, float r){
   PVector[] points = tetraVecs(r);
   pushMatrix();
   translate(pos.x, pos.y, pos.z);
   triangleVec(points[0], points[1], points[2]);
   triangleVec(points[0], points[3], points[1]);
   triangleVec(points[1], points[3], points[2]);
   triangleVec(points[2], points[3], points[0]);
   popMatrix();
}

void triangleVec(PVector a, PVector b, PVector c){
   strokeWeight(lineWidth);
   pushMatrix();
   beginShape();
   vertex(a.x, a.y, a.z);
   vertex(b.x, b.y, b.z);
   vertex(c.x, c.y, c.z);
   endShape(CLOSE);
   popMatrix();
}