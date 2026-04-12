/* ───────────────────────────────────────────────────────────────────────────
 * Constants.js — Shared constants & helpers for Lenia ND Studio
 *
 * This module is the single source of truth for:
 *   • statistics field definitions (STAT_FIELDS, STAT_HEADERS, STAT_INDEX …)
 *   • superscript-digit formatting (SUPERSCRIPT_DIGITS, formatDimPower)
 *   • compute-device normalisation (normaliseComputeDevice)
 *
 * Main-thread modules import from here directly.
 * Worker-side code gets these via WorkerShared.js re-exports.
 * ─────────────────────────────────────────────────────────────────────────── */

// ── Superscript digits ──────────────────────────────────────────────────────

const SUPERSCRIPT_DIGITS = Object.freeze({
  0: "⁰",
  1: "¹",
  2: "²",
  3: "³",
  4: "⁴",
  5: "⁵",
  6: "⁶",
  7: "⁷",
  8: "⁸",
  9: "⁹",
  "-": "⁻",
});

function formatDimPower(dim) {
  return String(dim)
    .split("")
    .map((c) => SUPERSCRIPT_DIGITS[c] || c)
    .join("");
}

// ── Compute-device normalisation ────────────────────────────────────────────

function normaliseComputeDevice(value = "cpu") {
  const v = String(value || "cpu")
    .trim()
    .toLowerCase();
  return v === "glsl" ||
    v === "glsl compute" ||
    v === "webgl" ||
    v === "webgl2" ||
    v === "webgpu" ||
    v === "webgpu compute"
    ? "glsl"
    : "cpu";
}

// ── Statistics field definitions ────────────────────────────────────────────
//
// Canonical ordered list of every statistics field. Each entry carries:
//   key       — short chart-axis key (dropdown / axis labels)
//   prop      — property name on the shared statistics object
//   label     — human-readable label with units (chart tooltip)
//   csvHeader — column header for CSV import/export
//
// getStatisticsRow() returns values in EXACTLY this order.
//
// FIX (2025-06): the old code had 39 STAT_NAMES keys for 40 row values.
// When massAsym was reused at position 18 (key "dg"), the old "ma" key was
// never removed, shifting every chart label from position 25 onwards by one.
// This caused "Lyapunov exponent" to display hu1Log data, "Hu 1" to show
// hu4Log, etc. The alignment is now corrected: "ma" is removed, and two new
// keys ("period", "pconf") are added so all 40 fields are properly labelled.

const STAT_FIELDS = Object.freeze([
  /* 0  */ { key: "fps", prop: "fps", label: "FPS [Hz]", csvHeader: "FPS" },
  /* 1  */ { key: "n", prop: "gen", label: "Generation [gen]", csvHeader: "Gen" },
  /* 2  */ { key: "t", prop: "time", label: "Time [μs]", csvHeader: "Time" },
  /* 3  */ { key: "m", prop: "mass", label: "Mass [μg]", csvHeader: "Mass" },
  /* 4  */ { key: "g", prop: "growth", label: "Growth [μg/μs]", csvHeader: "Growth" },
  /* 5  */ { key: "ml", prop: "massLog", label: "Mass (log scale) [μg]", csvHeader: "MassLog" },
  /* 6  */ { key: "gl", prop: "growthLog", label: "Growth (log scale) [μg/μs]", csvHeader: "GrowthLog" },
  /* 7  */ { key: "vl", prop: "massVolumeLog", label: "Mass volume (log scale) [μm²]", csvHeader: "MassVolumeLog" },
  /* 8  */ { key: "vgl", prop: "growthVolumeLog", label: "Growth volume (log scale) [μm²]", csvHeader: "GrowthVolumeLog" },
  /* 9  */ { key: "rho", prop: "massDensity", label: "Mass density [μg/μm²]", csvHeader: "MassDensity" },
  /* 10 */ { key: "rhog", prop: "growthDensity", label: "Growth density [μg/(μm²·μs)]", csvHeader: "GrowthDensity" },
  /* 11 */ { key: "p", prop: "maxValue", label: "Peak value [cell-state]", csvHeader: "PeakValue" },
  /* 12 */ { key: "r", prop: "gyradius", label: "Gyradius [μm]", csvHeader: "Gyradius" },
  /* 13 */ { key: "x", prop: "centreX", label: "Centroid X [μm]", csvHeader: "CentreX" },
  /* 14 */ { key: "y", prop: "centreY", label: "Centroid Y [μm]", csvHeader: "CentreY" },
  /* 15 */ { key: "gx", prop: "growthCentreX", label: "Growth centroid X [μm]", csvHeader: "GrowthCentreX" },
  /* 16 */ { key: "gy", prop: "growthCentreY", label: "Growth centroid Y [μm]", csvHeader: "GrowthCentreY" },
  /* 17 */ { key: "d", prop: "massGrowthDist", label: "Mass-growth distance [μm]", csvHeader: "MassGrowthDist" },
  /* 18 */ { key: "dg", prop: "massAsym", label: "Growth-centroid distance [μm]", csvHeader: "MassAsym" },
  /* 19 */ { key: "s", prop: "speed", label: "Speed [μm/μs]", csvHeader: "Speed" },
  /* 20 */ { key: "cs", prop: "centroidSpeed", label: "Centroid speed [μm/μs]", csvHeader: "CentroidSpeed" },
  /* 21 */ { key: "a", prop: "angle", label: "Direction angle [rad]", csvHeader: "Angle" },
  /* 22 */ { key: "wc", prop: "centroidRotateSpeed", label: "Centroid rotate speed [rad/μs]", csvHeader: "CentroidRotateSpeed" },
  /* 23 */ { key: "wg", prop: "growthRotateSpeed", label: "Growth-centroid rotate speed [rad/μs]", csvHeader: "GrowthRotateSpeed" },
  /* 24 */ { key: "wt", prop: "majorAxisRotateSpeed", label: "Major axis rotate speed [rad/μs]", csvHeader: "MajorAxisRotateSpeed" },
  /* 25 */ { key: "k", prop: "symmSides", label: "Rotational symmetry order", csvHeader: "SymmSides" },
  /* 26 */ { key: "ks", prop: "symmStrength", label: "Rotational symmetry strength [%]", csvHeader: "SymmStrength" },
  /* 27 */ { key: "wr", prop: "rotationSpeed", label: "Rotational speed [rad/μs]", csvHeader: "RotationSpeed" },
  /* 28 */ { key: "ly", prop: "lyapunov", label: "Lyapunov exponent [gen⁻¹]", csvHeader: "Lyapunov" },
  /* 29 */ { key: "h1", prop: "hu1Log", label: "Moment of inertia – Hu's moment invariant 1 (log)", csvHeader: "Hu1Log" },
  /* 30 */ { key: "h4", prop: "hu4Log", label: "Skewness – Hu's moment invariant 4 (log)", csvHeader: "Hu4Log" },
  /* 31 */ { key: "h5", prop: "hu5Log", label: "Hu's 5 (log)", csvHeader: "Hu5Log" },
  /* 32 */ { key: "h6", prop: "hu6Log", label: "Hu's 6 (log)", csvHeader: "Hu6Log" },
  /* 33 */ { key: "h7", prop: "hu7Log", label: "Hu's 7 (log)", csvHeader: "Hu7Log" },
  /* 34 */ { key: "f7", prop: "flusser7", label: "Kurtosis – Flusser's moment invariant 7", csvHeader: "Flusser7" },
  /* 35 */ { key: "f8", prop: "flusser8Log", label: "Flusser's 8 (log)", csvHeader: "Flusser8Log" },
  /* 36 */ { key: "f9", prop: "flusser9Log", label: "Flusser's 9 (log)", csvHeader: "Flusser9Log" },
  /* 37 */ { key: "f10", prop: "flusser10Log", label: "Flusser's 10 (log)", csvHeader: "Flusser10Log" },
  /* 38 */ { key: "period", prop: "period", label: "Period [gen]", csvHeader: "Period" },
  /* 39 */ { key: "pconf", prop: "periodConfidence", label: "Period confidence", csvHeader: "PeriodConfidence" },
]);

// Derived look-ups (all frozen)
const STAT_HEADERS = Object.freeze(STAT_FIELDS.map((f) => f.key));
const STAT_NAMES = Object.freeze(
  Object.fromEntries(STAT_FIELDS.map((f) => [f.key, f.label])),
);
const STAT_INDEX = Object.freeze(
  Object.fromEntries(STAT_FIELDS.map((f, i) => [f.key, i])),
);
const STAT_PROPS = Object.freeze(STAT_FIELDS.map((f) => f.prop));
const STAT_CSV_HEADERS = Object.freeze(STAT_FIELDS.map((f) => f.csvHeader));

// ── Statistics helpers ──────────────────────────────────────────────────────

function createEmptyStatistics() {
  const stats = {};
  for (const f of STAT_FIELDS) stats[f.prop] = 0;
  return stats;
}

function resetStatisticsScalars(stats) {
  for (const f of STAT_FIELDS) stats[f.prop] = 0;
}

function statisticsToRow(stats) {
  const row = new Array(STAT_FIELDS.length);
  for (let i = 0; i < STAT_FIELDS.length; i++) {
    row[i] = stats[STAT_FIELDS[i].prop] || 0;
  }
  return row;
}

function applyWorkerStatScalars(stats, workerStats) {
  const toFinite = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };
  for (const f of STAT_FIELDS) {
    if (f.prop === "fps" || f.prop === "gen" || f.prop === "time") continue;
    if (workerStats[f.prop] !== undefined) {
      stats[f.prop] = toFinite(workerStats[f.prop]);
    }
  }
}
