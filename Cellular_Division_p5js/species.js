
/**
 * @file species.js
 * @author @eanutt1272.v2
 * @version 1.0.0
 */
class Species {
  constructor(alpha, beta, gamma, radius) {
    this.alphaRad = radians(alpha);
    this.betaRad = radians(beta);
    this.v = radius * gamma / 100;
    this.r2 = radius * radius;
  }
}