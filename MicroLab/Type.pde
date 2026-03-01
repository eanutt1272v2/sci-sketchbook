
// @file Type.pde
// @author @eanutt1272.v2
// @version 1.0.0
class Type {
  color c;
  float typeRadius;
  float[] attraction;
  float[] middle;
  float[] repelDist;
  int index;

  Type(color c, float typeRadius, float[] attraction, float[] middle, float[] repelDist, ArrayList<Type> typeList) {
    this.c = c;
    this.typeRadius = typeRadius;
    this.attraction = attraction;
    this.middle = middle;
    this.repelDist = repelDist;
    this.index = typeList.size();
  }
}
