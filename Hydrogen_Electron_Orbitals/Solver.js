class Solver {
  logFact(k) {
    let sum = 0.0;
    
    for (let i = 2; i <= k; i++) sum += Math.log(i);
    
    return sum;
  }

  genLaguerre(k, alpha, x) {
    if (k <= 0) return 1.0;
    
    let L2 = 1.0, L1 = 1.0 + alpha - x, Lc = L1;
    
    for (let i = 2; i <= k; i++) {
      Lc = ((2 * i - 1 + alpha - x) * L1 - (i - 1 + alpha) * L2) / i;
      L2 = L1;
      L1 = Lc;
    }
    
    return isFinite(Lc) ? Lc : 0.0;
  }

  assocLegendre(l, m, x) {
    const absM = Math.abs(m);
    let pmm = 1.0;
    
    if (absM > 0) {
      const somx2 = Math.sqrt(Math.max(0, (1.0 - x) * (1.0 + x)));
      let fact = 1.0;
      
      for (let i = 1; i <= absM; i++) {
        pmm *= -fact * somx2;
        fact += 2.0;
      }
    }
    
    if (l === absM) return pmm;
    
    let pmmp1 = x * (2.0 * absM + 1.0) * pmm;
    
    if (l === absM + 1) return pmmp1;
    
    let pll = 0;
    
    for (let ll = absM + 2; ll <= l; ll++) {
      pll = (x * (2.0 * ll - 1.0) * pmmp1 - (ll + absM - 1.0) * pmm) / (ll - absM);
      pmm = pmmp1;
      pmmp1 = pll;
    }
    
    return pmmp1;
  }

  getProbabilityDensity(x, y, z, n, l, m) {
    const r = Math.sqrt(x * x + y * y + z * z);
    
    if (r < 0.001) return 0.0;
    
    const cosTheta = constrain(z / r, -1, 1);
    
    const rho = (2.0 * r) / n;
    
    const logNormR = 1.5 * Math.log(2.0 / n) + 0.5 * (this.logFact(n - l - 1) - Math.log(2.0 * n) - this.logFact(n + l));
    
    const R_nl = Math.exp(logNormR) * Math.exp(-rho / 2.0) * Math.pow(rho, l) * this.genLaguerre(n - l - 1, 2 * l + 1, rho);
    
    const absM = Math.abs(m);
    
    const normY = Math.sqrt(((2 * l + 1) * Math.exp(this.logFact(l - absM) - this.logFact(l + absM))) / (4 * Math.PI));
    
    const azimuthal = m === 0 ? 1.0 : m > 0 ? Math.sqrt(2) * Math.cos(m * Math.atan2(y, x)) : Math.sqrt(2) * Math.sin(absM * Math.atan2(y, x));
    
    return Math.pow(R_nl * normY * this.assocLegendre(l, absM, cosTheta) * azimuthal, 2);
  }
}
