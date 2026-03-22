class FallbackSolver {
  constructor(appcore) {
    this.appcore = appcore;

    this.cache = {
      key: "",
      logNormR: 0.0,
      l: 0,
      absM: 0,
      aMu: 5.29177210903e-11,
    };

    this.constants = {
      electronMassKg: 9.1093837015e-31,
      protonMassKg: 1.67262192369e-27,
      bohrRadiusM: 5.29177210903e-11,
    };
  }

  _logGamma(z) {
    const coeffs = [
      676.5203681218851,
      -1259.1392167224028,
      771.32342877765313,
      -176.61502916214059,
      12.507343278686905,
      -0.13857109526572012,
      9.9843695780195716e-6,
      1.5056327351493116e-7,
    ];

    if (z < 0.5) {
      return Math.log(Math.PI) - Math.log(Math.sin(Math.PI * z)) - this._logGamma(1 - z);
    }

    let x = 0.99999999999980993;
    const tZ = z - 1;
    for (let i = 0; i < coeffs.length; i++) {
      x += coeffs[i] / (tZ + i + 1);
    }

    const t = tZ + coeffs.length - 0.5;
    return (
      0.5 * Math.log(2 * Math.PI) +
      (tZ + 0.5) * Math.log(t) -
      t +
      Math.log(x)
    );
  }

  _reducedElectronNucleusMass(Z, nucleusMassKg) {
    const M = nucleusMassKg || (Z === 1 ? this.constants.protonMassKg : 0);
    if (!M || M <= 0) {
      throw new Error("[Psi] nucleusMassKg is required for Z > 1");
    }

    const me = this.constants.electronMassKg;
    return (me * M) / (me + M);
  }

  _reducedBohrRadius(muKg) {
    return this.constants.bohrRadiusM * (this.constants.electronMassKg / muKg);
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

  assocLegendre(l, absM, x) {
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
      pll =
        (x * (2.0 * ll - 1.0) * pmmp1 - (ll + absM - 1.0) * pmm) / (ll - absM);
      pmm = pmmp1;
      pmmp1 = pll;
    }

    return pmmp1;
  }

  _updateCache(n, l, m, Z, useReducedMass, nucleusMassKg) {
    const key = `${n}|${l}|${m}|${Z}|${useReducedMass ? 1 : 0}|${Number(nucleusMassKg || 0).toPrecision(8)}`;
    if (this.cache.key === key) return;

    const absM = Math.abs(m);
    const muKg = useReducedMass
      ? this._reducedElectronNucleusMass(Z, nucleusMassKg)
      : this.constants.electronMassKg;
    const aMu = this._reducedBohrRadius(muKg);

    let logNormR = 1.5 * Math.log((2.0 * Z) / (n * aMu));
    logNormR += 0.5 * (
      this._logGamma(n - l) -
      (Math.log(2.0 * n) + this._logGamma(n + l + 1))
    );

    this.cache = { key, logNormR, l, absM, aMu };
  }

  getProbabilityDensity(x, y, z, n, l, m) {
    const Z = Math.max(1, Math.round(Number(this.appcore?.params?.nuclearCharge) || 1));
    const useReducedMass = this.appcore?.params?.useReducedMass !== false;
    const nucleusMassKg = Number(this.appcore?.params?.nucleusMassKg) || undefined;

    this._updateCache(n, l, m, Z, useReducedMass, nucleusMassKg);
    const { logNormR, absM, aMu } = this.cache;

    const xM = x * aMu;
    const yM = y * aMu;
    const zM = z * aMu;

    const r = Math.sqrt(xM * xM + yM * yM + zM * zM);
    const cosTheta = r > 0 ? Math.max(-1, Math.min(1, zM / r)) : 1.0;
    const rho = (2.0 * Z * r) / (n * aMu);
    const phi = Math.atan2(yM, xM);

    const R_nl =
      Math.exp(logNormR) *
      Math.exp(-rho / 2.0) *
      Math.pow(rho, l) *
      this.genLaguerre(n - l - 1, 2 * l + 1, rho);

    const p_lm = this.assocLegendre(l, absM, cosTheta);
    const logNormY =
      0.5 * Math.log((2 * l + 1) / (4 * Math.PI)) +
      0.5 * (this._logGamma(l - absM + 1) - this._logGamma(l + absM + 1));
    const normY = Math.exp(logNormY);

    const rePos = normY * p_lm * Math.cos(absM * phi);
    const imPos = normY * p_lm * Math.sin(absM * phi);

    let yRe = rePos;
    let yIm = m >= 0 ? imPos : -imPos;
    if (m < 0 && absM % 2 === 1) {
      yRe = -yRe;
      yIm = -yIm;
    }

    const psiRe = R_nl * yRe;
    const psiIm = R_nl * yIm;
    const density = psiRe * psiRe + psiIm * psiIm;
    return Number.isFinite(density) ? density : 0.0;
  }
}