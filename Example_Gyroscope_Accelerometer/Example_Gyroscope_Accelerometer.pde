float gyroscopeX, gyroscopeY, gyroscopeZ;


void setup() {
   size(screenWidth, screenHeight, P3D);
}

void draw() {
   background(0,0,255);
   translate(width/2,height/2,0);
   translate(100*gyroscopeX,100*gyroscopeY,1000*gyroscopeZ);
   ellipse(gyroscopeX,gyroscopeY, 45, 45);
   fill(255, 255, 100);
}

//experimental feature
void gyroscopeUpdated(float x, float y, float z) {
   gyroscopeX = x;
   gyroscopeY = y;
   gyroscopeZ = z;	 
}

//experimental feature
/*void accelerometerUpdated(float x, float y, float z) {
   gyroscopeX = x;
   gyroscopeY = y;
   gyroscopeZ = z;	   
}*/
