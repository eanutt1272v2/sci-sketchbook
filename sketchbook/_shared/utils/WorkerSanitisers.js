(function (global) {
  "use strict";

  function clamp(value, min, max) {
    if (value < min) return min;
    if (value > max) return max;
    return value;
  }

  function toFiniteNumber(value, fallback = 0) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
  }

  function toInteger(value, fallback, min, max) {
    const numeric = Math.round(toFiniteNumber(value, fallback));
    return clamp(numeric, min, max);
  }

  global.WorkerSanitisers = Object.freeze({
    clamp,
    toFiniteNumber,
    toInteger,
  });
})(typeof self !== "undefined" ? self : globalThis);
