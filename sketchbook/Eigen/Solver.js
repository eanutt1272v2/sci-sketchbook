class Solver {
  constructor(appcore) {
    this.appcore = appcore;

    this.cache = {
      key: "",
      logNormR: 0,
      normY: 0
    };
  }

  logFact(k) {
    if (k <= 1) return 0.0;

    let sum = 0.0;
    for (let i = 2; i <= k; i++) {
      sum += Math.log(i);
    }

    return sum;
  }

  genLaguerre(k, alpha, x) {
    if (k <= 0) return 1.0;

    let L2 = 1.0;
    let L1 = 1.0 + alpha - x;
    let Lc = L1;

    for (let i = 2; i <= k; i++) {
      Lc = ((2 * i - 1 + alpha - x) * L1 - (i - 1 + alpha) * L2) / i;
      L2 = L1;
      L1 = Lc;
    }

    return isFinite(Lc) ? Lc : 0.0;
  }

  assocLegendre(l, m, x) {
    let absM = Math.abs(m);
    let pmm = 1.0;

    if (absM > 0) {
      let somx2 = Math.sqrt(Math.max(0, (1.0 - x) * (1.0 + x)));
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

  _updateCache(n, l, m) {
    let key = `${n}-${l}-${m}`;
    if (this.cache.key === key) return;

    let absM = Math.abs(m);

    let logNormR = 1.5 * Math.log(2.0 / n) +
    0.5 * (this.logFact(n - l - 1) - Math.log(2.0 * n) - this.logFact(n + l));

    let normY = Math.sqrt(((2 * l + 1) * Math.exp(this.logFact(l - absM) - this.logFact(l + absM))) / (4 * Math.PI));

    this.cache = { key, logNormR, normY };
  }

  getProbabilityDensity(x, y, z, n, l, m) {
    let r = Math.sqrt(x * x + y * y + z * z);
    if (r < 0.001) return 0.0;

    this._updateCache(n, l, m);

    const { logNormR, normY } = this.cache;

    let cosTheta = constrain(z / r, -1, 1);
    let rho = (2.0 * r) / n;
    let phi = Math.atan2(y, x);
    let absM = Math.abs(m);

    let R_nl = Math.exp(logNormR) * Math.exp(-rho / 2.0) * Math.pow(rho, l) * this.genLaguerre(n - l - 1, 2 * l + 1, rho);

    let azimuthal = 1.0;
    if (m > 0) {
      azimuthal = Math.sqrt(2) * Math.cos(m * phi);
    } else if (m < 0) {
      azimuthal = Math.sqrt(2) * Math.sin(absM * phi);
    }

    let Y_lm = normY * this.assocLegendre(l, absM, cosTheta) * azimuthal;

    return Math.pow(R_nl * Y_lm, 2);
  }
}