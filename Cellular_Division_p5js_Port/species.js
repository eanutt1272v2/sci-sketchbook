class Species {
  constructor(alpha, beta, gamma, radius) {
    this.alphaRad = radians(alpha);
    this.betaRad = radians(beta);
    this.v = radius * gamma / 100;
    this.r2 = radius * radius;
  }
}