float lineWidth = 1;
float first_size = 400;
float angle = 0;
ArrayList<Box> Bsponge;
ArrayList<Tetra> Tsponge;
ArrayList<Octa> Osponge;

int dispType = 0;
boolean userRot = false;

void setup(){
   size(screenWidth, screenHeight, P3D);
   //fullScreen(P3D);
   sponge_init(0, first_size);
   div_sponge();
   div_sponge();
   div_sponge();
}

void keyPressed(){
   if(key=='u'){
      userRot = !userRot;
   }
   if(key=='r'){
      sponge_init(0, first_size);
   }
   if(key=='t'){
      dispType++;
      if(dispType == 3){
         sponge_init(1000, first_size/2);
      }
      if(dispType >= 4){
         dispType = 0;
      }
   }
}

void draw(){
   background(0);
   lights();
   translate(width/2, height/2, 0);
   //noStroke();
   fill(255);
   multiRot();
   show_sponge();
   angle += 0.01;
}