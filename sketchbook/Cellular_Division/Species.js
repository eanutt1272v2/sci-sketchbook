class Species {
  constructor(alpha, beta, gamma, radius) {
    this.alphaRad = radians(alpha);
    this.betaRad = radians(beta);
    this.velocity = (radius * gamma) / 100.0;
    this.radiusSquared = sq(radius);
  }
}