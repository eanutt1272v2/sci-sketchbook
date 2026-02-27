class Box{
   PVector pos;
   float r;
   Box(PVector pos, float r){
      this.pos = pos;
      this.r = r;
   }
   
   ArrayList<Box> generate(){
      ArrayList<Box> boxes = new ArrayList<Box>();
      float newR = r/3;
      for (int x = -1; x <= 1; x++){
         for (int y = -1; y <= 1; y++){
            for (int z = -1; z <= 1; z++){
               if(1 < (abs(x)+abs(y)+abs(z))){
                  PVector newPos = new PVector(pos.x+newR*x, pos.y+newR*y, pos.z+newR*z);
                  Box b = new Box(newPos, newR);
                  boxes.add(b);
               }
            }
         }
      }
      return boxes;
   }
   
   void show(){
      pushMatrix();
      translate(pos.x, pos.y, pos.z);
      box(r);
      popMatrix();
   }
}

class Tetra{
   float r;
   PVector pos;
   Tetra(PVector pos, float r){
      this.r = r;
      this.pos = pos;
   }
   
   ArrayList<Tetra> generate(){
      ArrayList<Tetra> tetras = new ArrayList<Tetra>();
      float newR = r/2;
      PVector[] points = tetraVecs(newR);
      for (int i = 0; i < points.length; i++){
         Tetra nTetra = new Tetra(PVector.add(pos, points[i]), newR);
         tetras.add(nTetra);
      }
      return tetras;
   }
   
   void show(){
      tetra(pos, r);
   }
}

class Octa{
   float r;
   PVector pos;
   Octa(PVector pos, float r){
      this.r = r;
      this.pos = pos;
   }
   
   ArrayList<Octa> generate(){
      ArrayList<Octa> Octas = new ArrayList<Octa>();
      float newR = r/2;
      PVector[] points = octaVecs(newR);
      for (int i = 0; i < points.length; i++){
         Octa nOcta = new Octa(PVector.add(pos, points[i]), newR);
         Octas.add(nOcta);
      }
      return Octas;
   }
   
   void show(){
      octa(pos, r);
   }
}