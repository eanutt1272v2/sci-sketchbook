"use strict";

const CONSTS = {
  electronMassKg: 9.1093837015e-31,
  protonMassKg: 1.67262192369e-27,
  bohrRadiusM: 5.29177210903e-11,
};

function logGamma(z) {
  const coeffs = [
    676.5203681218851, -1259.1392167224028, 771.32342877765313,
    -176.61502916214059, 12.507343278686905, -0.13857109526572012,
    9.9843695780195716e-6, 1.5056327351493116e-7,
  ];

  if (z < 0.5) {
    return (
      Math.log(Math.PI) - Math.log(Math.sin(Math.PI * z)) - logGamma(1 - z)
    );
  }

  let x = 0.99999999999980993;
  const tZ = z - 1;
  for (let i = 0; i < coeffs.length; i++) {
    x += coeffs[i] / (tZ + i + 1);
  }

  const t = tZ + coeffs.length - 0.5;
  return (
    0.5 * Math.log(2 * Math.PI) + (tZ + 0.5) * Math.log(t) - t + Math.log(x)
  );
}

function reducedElectronNucleusMass(Z, nucleusMassKg) {
  const M = nucleusMassKg || (Z === 1 ? CONSTS.protonMassKg : 0);
  if (!M || M <= 0) {
    throw new Error("[Psi] nucleusMassKg is required for Z > 1");
  }
  const me = CONSTS.electronMassKg;
  return (me * M) / (me + M);
}

function reducedBohrRadius(muKg) {
  return CONSTS.bohrRadiusM * (CONSTS.electronMassKg / muKg);
}

function genLaguerre(k, alpha, x) {
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

function assocLegendre(l, absM, x) {
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
    pll =
      (x * (2.0 * ll - 1.0) * pmmp1 - (ll + absM - 1.0) * pmm) / (ll - absM);
    pmm = pmmp1;
    pmmp1 = pll;
  }
  return pmmp1;
}

let _cache = { key: "", logNormR: 0.0, l: 0, absM: 0, aMu: CONSTS.bohrRadiusM };

function _updateCache(n, l, m, Z, useReducedMass, nucleusMassKg) {
  const key = `${n}|${l}|${m}|${Z}|${useReducedMass ? 1 : 0}|${Number(nucleusMassKg || 0).toPrecision(8)}`;
  if (_cache.key === key) return;
  const absM = Math.abs(m);

  const muKg = useReducedMass
    ? reducedElectronNucleusMass(Z, nucleusMassKg)
    : CONSTS.electronMassKg;
  const aMu = reducedBohrRadius(muKg);

  let logNormR = 1.5 * Math.log((2.0 * Z) / (n * aMu));
  logNormR +=
    0.5 * (logGamma(n - l) - (Math.log(2.0 * n) + logGamma(n + l + 1)));

  _cache = { key, logNormR, l, absM, aMu };
}

function getProbabilityDensity(
  x,
  y,
  z,
  n,
  l,
  m,
  Z,
  useReducedMass,
  nucleusMassKg,
) {
  _updateCache(n, l, m, Z, useReducedMass, nucleusMassKg);
  const { logNormR, absM, aMu } = _cache;

  const xM = x * aMu;
  const yM = y * aMu;
  const zM = z * aMu;

  const r = Math.sqrt(xM * xM + yM * yM + zM * zM);
  const cosTheta = r > 0 ? Math.min(1, Math.max(-1, zM / r)) : 1.0;
  const rho = (2.0 * Z * r) / (n * aMu);
  const phi = Math.atan2(yM, xM);

  const R_nl =
    Math.exp(logNormR) *
    Math.exp(-rho / 2.0) *
    Math.pow(rho, l) *
    genLaguerre(n - l - 1, 2 * l + 1, rho);

  const p_lm = assocLegendre(l, absM, cosTheta);
  const logNormY =
    0.5 * Math.log((2 * l + 1) / (4 * Math.PI)) +
    0.5 * (logGamma(l - absM + 1) - logGamma(l + absM + 1));
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

function getSliceAxes(slicePlane) {
  if (slicePlane === "xy") return { c1: 0, c2: 1, cFixed: 2 };
  if (slicePlane === "yz") return { c1: 1, c2: 2, cFixed: 0 };
  return { c1: 0, c2: 2, cFixed: 1 };
}

function computeRadialProbabilityMoments(
  n,
  l,
  nuclearCharge,
  useReducedMass,
  nucleusMassKg,
  viewRadius,
) {
  const nQ = Math.max(1, Math.round(Number(n) || 1));
  const lQ = Math.max(0, Math.min(nQ - 1, Math.round(Number(l) || 0)));
  const Z = Math.max(1, Math.round(Number(nuclearCharge) || 1));

  const muKg = useReducedMass
    ? reducedElectronNucleusMass(Z, nucleusMassKg)
    : CONSTS.electronMassKg;
  const aMu = reducedBohrRadius(muKg);
  const toA0 = aMu / CONSTS.bohrRadiusM;

  let logNormR = 1.5 * Math.log((2.0 * Z) / (nQ * aMu));
  logNormR +=
    0.5 * (logGamma(nQ - lQ) - (Math.log(2.0 * nQ) + logGamma(nQ + lQ + 1)));

  const expectedRadiusAMu = (3 * nQ * nQ - lQ * (lQ + 1)) / (2 * Z);
  const maxRadiusAMu = Math.max(
    4,
    Number(viewRadius) || 0,
    expectedRadiusAMu * 4,
  );
  const samples = 2048;
  const dr = maxRadiusAMu / samples;

  let weightSum = 0;
  let weightedR = 0;
  let weightedR2 = 0;
  let peakWeight = -1;
  let radialPeakAMu = 0;

  for (let i = 1; i <= samples; i++) {
    const rAMu = i * dr;
    const rho = (2.0 * Z * rAMu) / nQ;
    const radialComponent =
      Math.exp(logNormR) *
      Math.exp(-rho / 2.0) *
      Math.pow(rho, lQ) *
      genLaguerre(nQ - lQ - 1, 2 * lQ + 1, rho);

    if (!Number.isFinite(radialComponent)) continue;

    const pR = rAMu * rAMu * radialComponent * radialComponent;
    if (!Number.isFinite(pR) || pR <= 0) continue;

    weightSum += pR;
    weightedR += pR * rAMu;
    weightedR2 += pR * rAMu * rAMu;

    if (pR > peakWeight) {
      peakWeight = pR;
      radialPeakAMu = rAMu;
    }
  }

  if (weightSum <= 0) {
    return { radialPeak: 0, radialSpread: 0 };
  }

  const meanR = weightedR / weightSum;
  const varianceR = Math.max(0, weightedR2 / weightSum - meanR * meanR);

  return {
    radialPeak: radialPeakAMu * toA0,
    radialSpread: Math.sqrt(varianceR) * toA0,
  };
}

function computeDensityStatistics(grid, resolution, viewRadius, orbitalParams) {
  if (!grid || grid.length === 0) {
    return {
      density: 0,
      peakDensity: 0,
      mean: 0,
      stdDev: 0,
      entropy: 0,
      concentration: 0,
      radialPeak: 0,
      radialSpread: 0,
      nodeEstimate: 0,
    };
  }

  let sum = 0;
  let peak = 0;
  const radialBins = 64;
  const radialMass = new Float64Array(radialBins);
  const radialCount = new Uint32Array(radialBins);
  const center = (resolution - 1) * 0.5;
  const maxR = Math.max(1, Math.sqrt(center * center + center * center));

  for (let i = 0; i < grid.length; i++) {
    const val = grid[i];
    sum += val;
    if (val > peak) peak = val;

    const x = i % resolution;
    const y = (i / resolution) | 0;
    const dx = x - center;
    const dy = y - center;
    const rn = Math.min(0.999999, Math.sqrt(dx * dx + dy * dy) / maxR);
    const bin = Math.floor(rn * radialBins);
    radialMass[bin] += val;
    radialCount[bin] += 1;
  }

  const mean = sum / grid.length;
  let variance = 0;
  let concentration = 0;
  let entropy = 0;

  for (let i = 0; i < grid.length; i++) {
    const val = grid[i];
    const diff = val - mean;
    variance += diff * diff;

    if (sum > 0) {
      const p = val / sum;
      if (p > 1e-300) {
        entropy -= p * Math.log(p);
        concentration += p * p;
      }
    }
  }

  const stdDev = Math.sqrt(variance / grid.length);

  let radialWeightedSum = 0;
  for (let i = 0; i < radialBins; i++) {
    const mass = radialMass[i];
    radialWeightedSum += mass * (i + 0.5);
  }

  const radialMeanBin = sum > 0 ? radialWeightedSum / sum : 0;
  let radialVarAcc = 0;
  for (let i = 0; i < radialBins; i++) {
    const d = i + 0.5 - radialMeanBin;
    radialVarAcc += radialMass[i] * d * d;
  }
  let nodeEstimate = 0;
  const radialProfile = new Float64Array(radialBins);
  for (let i = 0; i < radialBins; i++) {
    radialProfile[i] = radialCount[i] > 0 ? radialMass[i] / radialCount[i] : 0;
  }
  for (let i = 1; i < radialBins - 1; i++) {
    const prev = radialProfile[i - 1];
    const cur = radialProfile[i];
    const next = radialProfile[i + 1];
    if (cur < prev && cur < next && cur < peak * 0.02) {
      nodeEstimate++;
    }
  }

  const radialStandard = computeRadialProbabilityMoments(
    orbitalParams?.n,
    orbitalParams?.l,
    orbitalParams?.nuclearCharge,
    orbitalParams?.useReducedMass,
    orbitalParams?.nucleusMassKg,
    viewRadius,
  );

  return {
    density: mean,
    peakDensity: peak,
    mean,
    stdDev,
    entropy,
    concentration,
    radialPeak: radialStandard.radialPeak,
    radialSpread: radialStandard.radialSpread,
    nodeEstimate,
  };
}

function computeGrid(
  n,
  l,
  m,
  res,
  viewRadius,
  slicePlane,
  sliceOffset,
  viewCentre,
  nuclearCharge,
  useReducedMass,
  nucleusMassKg,
  reuseGridBuffer,
) {
  const requiredByteLength = res * res * Float32Array.BYTES_PER_ELEMENT;
  const grid =
    reuseGridBuffer && reuseGridBuffer.byteLength === requiredByteLength
      ? new Float32Array(reuseGridBuffer)
      : new Float32Array(res * res);
  const step = res === 1 ? 0 : (viewRadius * 2) / (res - 1);

  const { c1, c2, cFixed } = getSliceAxes(slicePlane);
  const centerX = viewCentre.x || 0;
  const centerY = viewCentre.y || 0;
  const centerZ = viewCentre.z || 0;

  const axisCentre1 = c1 === 0 ? centerX : c1 === 1 ? centerY : centerZ;
  const axisCentre2 = c2 === 0 ? centerX : c2 === 1 ? centerY : centerZ;

  let peak = 1e-10;

  for (let v = 0; v < res; v++) {
    const p2 = -viewRadius + v * step + axisCentre2;
    const rowOffset = v * res;

    for (let u = 0; u < res; u++) {
      const p1 = -viewRadius + u * step + axisCentre1;

      let x = 0,
        y = 0,
        z = 0;
      if (c1 === 0) x = p1;
      else if (c1 === 1) y = p1;
      else z = p1;
      if (c2 === 0) x = p2;
      else if (c2 === 1) y = p2;
      else z = p2;
      if (cFixed === 0) x = sliceOffset;
      else if (cFixed === 1) y = sliceOffset;
      else z = sliceOffset;

      const density = getProbabilityDensity(
        x,
        y,
        z,
        n,
        l,
        m,
        nuclearCharge,
        useReducedMass,
        nucleusMassKg,
      );
      grid[rowOffset + u] = density;
      if (density > peak) peak = density;
    }
  }

  const muKg = useReducedMass
    ? reducedElectronNucleusMass(nuclearCharge, nucleusMassKg)
    : CONSTS.electronMassKg;
  const aMu = reducedBohrRadius(muKg);

  return { grid, peak, aMu };
}

self.onmessage = function (e) {
  const { type } = e.data;

  if (type === "render") {
    const {
      requestId,
      n,
      l,
      m,
      res,
      viewRadius,
      slicePlane,
      sliceOffset,
      viewCentre,
      nuclearCharge,
      useReducedMass,
      nucleusMassKg,
      includeAnalysis,
      analysisSignature,
      analysisResolution,
      analysisViewRadius,
    } = e.data;

    const charge = Math.max(1, Math.round(Number(nuclearCharge) || 1));
    const reducedMassEnabled = useReducedMass !== false;
    const nucleusMass = Number(nucleusMassKg) || undefined;

    const { grid, peak } = computeGrid(
      n,
      l,
      m,
      res,
      viewRadius,
      slicePlane,
      sliceOffset,
      viewCentre,
      charge,
      reducedMassEnabled,
      nucleusMass,
      e.data.reuseGridBuffer || null,
    );

    let analysisStats = null;
    let analysisPeak = null;
    let analysisAMu = null;
    let canonicalResolution = Math.max(
      32,
      Math.round(Number(analysisResolution) || 384),
    );
    let canonicalViewRadius = Math.max(
      1,
      Number(analysisViewRadius) || viewRadius,
    );

    if (includeAnalysis) {
      const canonical = computeGrid(
        n,
        l,
        m,
        canonicalResolution,
        canonicalViewRadius,
        slicePlane,
        sliceOffset,
        { x: 0, y: 0, z: 0 },
        charge,
        reducedMassEnabled,
        nucleusMass,
      );

      analysisPeak = canonical.peak;
      analysisAMu = canonical.aMu;
      analysisStats = computeDensityStatistics(
        canonical.grid,
        canonicalResolution,
        canonicalViewRadius,
        {
          n,
          l,
          nuclearCharge: charge,
          useReducedMass: reducedMassEnabled,
          nucleusMassKg: nucleusMass,
        },
      );
    }

    self.postMessage(
      {
        type: "result",
        requestId,
        resolution: res,
        grid: grid.buffer,
        peak,
        analysisPeak,
        analysisAMu,
        analysisResolution: canonicalResolution,
        analysisViewRadius: canonicalViewRadius,
        analysisSignature: includeAnalysis ? analysisSignature : "",
        analysisStats,
      },
      [grid.buffer],
    );
  }
};
