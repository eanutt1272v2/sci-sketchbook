class Species {
  final float alphaRad;
  final float betaRad;
  final float velocity;
  final float radiusSquared;
  
  Species(float alpha, float beta, float gamma, float radius) {
    this.alphaRad = radians(alpha);
    this.betaRad = radians(beta);
    this.velocity = radius * gamma / 100.0f;
    this.radiusSquared = sq(radius);
  }
}