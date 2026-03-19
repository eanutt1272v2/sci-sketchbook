"use strict";

function logFact(k) {
  if (k <= 1) return 0.0;
  let sum = 0.0;
  for (let i = 2; i <= k; i++) sum += Math.log(i);
  return sum;
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

function assocLegendre(l, m, x) {
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
    pll =
      (x * (2.0 * ll - 1.0) * pmmp1 - (ll + absM - 1.0) * pmm) / (ll - absM);
    pmm = pmmp1;
    pmmp1 = pll;
  }
  return pmmp1;
}

let _cache = { key: "", logNormR: 0, normY: 0 };

function _updateCache(n, l, m) {
  const key = `${n}-${l}-${m}`;
  if (_cache.key === key) return;
  const absM = Math.abs(m);
  const logNormR =
    1.5 * Math.log(2.0 / n) +
    0.5 * (logFact(n - l - 1) - Math.log(2.0 * n) - logFact(n + l));
  const normY = Math.sqrt(
    ((2 * l + 1) * Math.exp(logFact(l - absM) - logFact(l + absM))) /
      (4 * Math.PI),
  );
  _cache = { key, logNormR, normY };
}

function getProbabilityDensity(x, y, z, n, l, m) {
  const r = Math.sqrt(x * x + y * y + z * z);
  if (r < 0.001) return 0.0;

  _updateCache(n, l, m);
  const { logNormR, normY } = _cache;

  const cosTheta = Math.min(1, Math.max(-1, z / r));
  const rho = (2.0 * r) / n;
  const phi = Math.atan2(y, x);
  const absM = Math.abs(m);

  const R_nl =
    Math.exp(logNormR) *
    Math.exp(-rho / 2.0) *
    Math.pow(rho, l) *
    genLaguerre(n - l - 1, 2 * l + 1, rho);

  let azimuthal = 1.0;
  if (m > 0) {
    azimuthal = Math.SQRT2 * Math.cos(m * phi);
  } else if (m < 0) {
    azimuthal = Math.SQRT2 * Math.sin(absM * phi);
  }

  const Y_lm = normY * assocLegendre(l, absM, cosTheta) * azimuthal;
  return R_nl * Y_lm * (R_nl * Y_lm);
}

function getSliceAxes(slicePlane) {
  if (slicePlane === "xy") return { c1: 0, c2: 1, cFixed: 2 };
  if (slicePlane === "yz") return { c1: 1, c2: 2, cFixed: 0 };
  return { c1: 0, c2: 2, cFixed: 1 };
}

function computeGrid(
  n,
  l,
  m,
  res,
  viewRadius,
  slicePlane,
  sliceOffset,
  viewCenter,
) {
  const grid = new Float32Array(res * res);
  const step = res === 1 ? 0 : (viewRadius * 2) / (res - 1);

  const { c1, c2, cFixed } = getSliceAxes(slicePlane);
  const centerX = viewCenter.x || 0;
  const centerY = viewCenter.y || 0;
  const centerZ = viewCenter.z || 0;

  const axisCenter1 = c1 === 0 ? centerX : c1 === 1 ? centerY : centerZ;
  const axisCenter2 = c2 === 0 ? centerX : c2 === 1 ? centerY : centerZ;

  let peak = 1e-10;

  for (let v = 0; v < res; v++) {
    const p2 = -viewRadius + v * step + axisCenter2;
    const rowOffset = v * res;

    for (let u = 0; u < res; u++) {
      const p1 = -viewRadius + u * step + axisCenter1;

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

      const density = getProbabilityDensity(x, y, z, n, l, m);
      grid[rowOffset + u] = density;
      if (density > peak) peak = density;
    }
  }

  return { grid, peak };
}

self.onmessage = function (e) {
  const { type } = e.data;

  if (type === "render") {
    const { n, l, m, res, viewRadius, slicePlane, sliceOffset, viewCenter } =
      e.data;
    const { grid, peak } = computeGrid(
      n,
      l,
      m,
      res,
      viewRadius,
      slicePlane,
      sliceOffset,
      viewCenter,
    );
    self.postMessage({ type: "result", grid: grid.buffer, peak }, [
      grid.buffer,
    ]);
  }
};
