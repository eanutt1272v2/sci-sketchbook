class InputHandler {
  constructor(appcore) {
    this.appcore = appcore;
    this._diagnosticsLogger =
      appcore?._diagnosticsLogger ||
      (typeof AppDiagnostics !== "undefined" &&
      typeof AppDiagnostics.resolveLogger === "function"
        ? AppDiagnostics.resolveLogger("Lenia")
        : { info() {}, warn() {}, error() {}, debug() {} });
    this._pointerActive = false;
    this._lastPointer = { x: 0, y: 0 };
  }

  handleWheel(event) {
    if (!this.appcore?.canvasInteraction?.(event)) return false;
    if ((this.appcore.params.dimension || 2) <= 2) return false;

    const delta = event?.deltaY > 0 ? 1 : -1;
    const dim = Number(this.appcore.params.dimension) || 2;
    const activeAxis =
      typeof this.appcore.getNDActiveAxis === "function"
        ? this.appcore.getNDActiveAxis()
        : "z";
    const axis =
      KeyboardUtils.isShiftHeld() && dim >= 4
        ? activeAxis === "w"
          ? "z"
          : "w"
        : activeAxis;

    this.appcore.adjustNDSlice(axis, delta);
    return false;
  }

  handlePointerPressed() {
    this._pointerActive = true;
    this._lastPointer.x = mouseX;
    this._lastPointer.y = mouseY;
    return false;
  }

  handlePointerDragged() {
    return false;
  }

  handlePointerReleased() {
    this._pointerActive = false;
    return false;
  }

  handleKeyPressed(k, kCode, event = null) {
    if (KeyboardUtils.shouldIgnoreKeyboard(event)) return false;

    const keyValue = KeyboardUtils.normaliseKey(k);
    const shiftHeld = Boolean(event?.shiftKey) || KeyboardUtils.isShiftHeld();
    const match = (hintId, optionIndex = null) =>
      typeof KeybindCatalogue !== "undefined" &&
      typeof KeybindCatalogue.matchHint === "function" &&
      KeybindCatalogue.matchHint(
        "lenia",
        hintId,
        keyValue,
        kCode,
        event,
        optionIndex,
      );
    const app = this.appcore;
    const p = app.params;
    const dim = p.dimension || 2;
    const sh = shiftHeld;

    if (match("keymapReference")) {
      p.renderKeymapRef = !p.renderKeymapRef;
      app.refreshGUI();
      return false;
    }
    if (p.renderKeymapRef) return false;

    for (const [hint, opt, guard, action] of InputHandler._KEY_DISPATCH) {
      if (guard && !guard(dim, p)) continue;
      if (match(hint, opt)) {
        action(this, app, p, sh, dim);
        return false;
      }
    }
    return false;
  }

  handleKeyReleased(k, kCode, event = null) {
    return false;
  }
}

// ── Dispatch table ──────────────────────────────────────────────────────────
// Each entry: [hintId, optionIndex | null, guard | null, handler]
// handler signature: (inputHandler, appcore, params, shiftHeld, dim)
// guard signature: (dim, params) → boolean

const _upd = (app) => { app.updateAutomatonParams(); app.refreshGUI(); };
const _gui = (app) => app.refreshGUI();

InputHandler._KEY_DISPATCH = [
  // ── Transport ─────────────────────────────────────────────────────────────
  ["stepOnce",        null, null, (_ih, app) => app.stepOnce()],
  ["running",         null, null, (_ih, app, p) => { p.running = !p.running; _gui(app); }],

  // ── Render / visual ───────────────────────────────────────────────────────
  ["renderMode",      null, null, (ih, app, _p, sh) => { ih._cycleRenderMode(sh ? -1 : 1); _gui(app); }],
  ["channelShift",    0,    null, (_ih, app) => app.shiftChannelLegend(1, { refreshGUI: true })],
  ["channelShift",    1,    null, (_ih, app) => app.shiftChannelLegend(-1, { refreshGUI: true })],
  ["colourMap",       0,    null, (_ih, app) => { app.cycleColourMap(1); _gui(app); }],
  ["colourMap",       1,    null, (_ih, app) => { app.cycleColourMap(-1); _gui(app); }],

  // ── Growth centre & width ─────────────────────────────────────────────────
  ["growthCentre",    0,    null, (_ih, app, p, sh) => { p.m = Math.max(0, Math.min(1, p.m + (sh ? 0.01 : 0.001))); _upd(app); }],
  ["growthCentre",    1,    null, (_ih, app, p, sh) => { p.m = Math.max(0, Math.min(1, p.m - (sh ? 0.01 : 0.001))); _upd(app); }],
  ["growthWidth",     0,    null, (_ih, app, p, sh) => { p.s = Math.max(0.0001, p.s + (sh ? 0.001 : 0.0001)); _upd(app); }],
  ["growthWidth",     1,    null, (_ih, app, p, sh) => { p.s = Math.max(0.0001, p.s - (sh ? 0.001 : 0.0001)); _upd(app); }],

  // ── Radius ────────────────────────────────────────────────────────────────
  ["radius",          0,    null, (_ih, app, _p, sh) => { app.nudgeRadius?.(sh ? 1 : 5); _gui(app); }],
  ["radius",          1,    null, (_ih, app, _p, sh) => { app.nudgeRadius?.(sh ? -1 : -5); _gui(app); }],

  // ── Time step (T) ─────────────────────────────────────────────────────────
  ["steps",           0,    null, (_ih, app, p, sh) => {
    const maxT = app.getMaxTimeScale?.() ?? 1500;
    p.T = sh ? Math.min(maxT, p.T + 1) : Math.min(maxT, p.T * 2);
    _upd(app);
  }],
  ["steps",           1,    null, (_ih, app, p, sh) => {
    p.T = sh ? Math.max(1, p.T - 1) : Math.max(1, Math.round(p.T / 2));
    _upd(app);
  }],

  // ── Quantise / weight ─────────────────────────────────────────────────────
  ["quantiseP",       0,    null, (_ih, app, p, sh) => { p.paramP = Math.min(64, (p.paramP || 0) + (sh ? 1 : 10)); _upd(app); }],
  ["quantiseP",       1,    null, (_ih, app, p, sh) => { p.paramP = Math.max(0, (p.paramP || 0) - (sh ? 1 : 10)); _upd(app); }],
  ["weight",          0,    null, (_ih, app, p) => { p.h = Math.min(1, Math.round((p.h + 0.1) * 10) / 10); _upd(app); }],
  ["weight",          1,    null, (_ih, app, p) => { p.h = Math.max(0.1, Math.round((p.h - 0.1) * 10) / 10); _upd(app); }],

  // ── Peaks (beta coefficients) ─────────────────────────────────────────────
  ["peakY",           null, null, (ih, _app, _p, sh) => ih._adjustPeak(0, sh ? -1/12 : 1/12)],
  ["peakU",           null, null, (ih, _app, _p, sh) => ih._adjustPeak(1, sh ? -1/12 : 1/12)],
  ["peakI",           null, null, (ih, _app, _p, sh) => ih._adjustPeak(2, sh ? -1/12 : 1/12)],
  ["peakO",           null, null, (ih, _app, _p, sh) => ih._adjustPeak(3, sh ? -1/12 : 1/12)],
  ["peakP",           null, null, (ih, _app, _p, sh) => ih._adjustPeak(4, sh ? -1/12 : 1/12)],
  ["peakCount",       null, null, (_ih, app, p, sh) => {
    if (sh) { if (p.b.length > 1) p.b.pop(); } else { p.b.push(0); }
    _upd(app);
  }],

  // ── Kernel / growth types ─────────────────────────────────────────────────
  ["kernelType",      null, null, (_ih, app, p, sh) => { p.kn = sh ? ((p.kn - 2 + 4) % 4) + 1 : (p.kn % 4) + 1; _upd(app); }],
  ["growthType",      null, null, (_ih, app, p, sh) => { p.gn = sh ? ((p.gn - 2 + 3) % 3) + 1 : (p.gn % 3) + 1; _upd(app); }],
  ["softClip",        null, null, (_ih, app, p, sh) => {
    if (sh) { p.maskRate = ((p.maskRate || 0) + 1) % 10; } else { p.softClip = !p.softClip; }
    _upd(app);
  }],
  ["noise",           null, null, (_ih, app, p) => { p.addNoise = ((p.addNoise || 0) + 1) % 11; _upd(app); }],
  ["aritaMode",       null, null, (_ih, app, p, sh) => {
    if (sh) { p.maskRate = 0; p.addNoise = 0; } else { p.aritaMode = !p.aritaMode; }
    _upd(app);
  }],
  ["multiStep",       null, null, (_ih, app, p) => { p.multiStep = !p.multiStep; _upd(app); }],

  // ── Dimension / backend ───────────────────────────────────────────────────
  ["dimension",       null, null, (_ih, app, p) => {
    const dims = [2, 3, 4];
    const idx = dims.indexOf(Number(p.dimension) || 2);
    app.setDimension(dims[(idx + 1) % dims.length]); _gui(app);
  }],
  ["backendComputeDevice", null, null, (_ih, app, _p, sh) => app.cycleBackendComputeDevice(sh ? -1 : 1, { refreshGUI: true })],

  // ── Channel / kernel selection ────────────────────────────────────────────
  ["selectedChannel", 0,    null, (_ih, app) => app.cycleSelectedChannel(-1, { refreshGUI: true })],
  ["selectedChannel", 1,    null, (_ih, app) => app.cycleSelectedChannel(1, { refreshGUI: true })],
  ["selectedKernel",  0,    null, (_ih, app) => app.cycleSelectedKernel(-1, { refreshGUI: true })],
  ["selectedKernel",  1,    null, (_ih, app) => app.cycleSelectedKernel(1, { refreshGUI: true })],

  // ── Spatial transforms ────────────────────────────────────────────────────
  ["shiftX",          0,    null, (_ih, app, _p, sh) => app.shiftWorld(sh ? -1 : -10, 0)],
  ["shiftX",          1,    null, (_ih, app, _p, sh) => app.shiftWorld(sh ? 1 : 10, 0)],
  ["shiftY",          0,    null, (_ih, app, _p, sh) => app.shiftWorld(0, sh ? -1 : -10)],
  ["shiftY",          1,    null, (_ih, app, _p, sh) => app.shiftWorld(0, sh ? 1 : 10)],

  // ── ND-only controls (dim > 2 guard) ──────────────────────────────────────
  ["cycleSliceAxis",  null, (d) => d > 2, (_ih, app) => app.cycleNDActiveAxis(1)],
  ["centreSlice",     null, (d) => d > 2, (_ih, app) => app.centreNDSlices({ allAxes: true })],
  ["viewDepth",       0,    (d) => d > 2, (_ih, app, _p, sh) => app.shiftNDDepth(sh ? 1 : 10)],
  ["viewDepth",       1,    (d) => d > 2, (_ih, app, _p, sh) => app.shiftNDDepth(sh ? -1 : -10)],
  ["sliceOffset",     0,    (d) => d > 2, (_ih, app, p, sh) => {
    if (p.viewMode !== "slice") app.setViewMode("slice");
    app.adjustNDSlice(null, sh ? 1 : 10);
  }],
  ["sliceOffset",     1,    (d) => d > 2, (_ih, app, p, sh) => {
    if (p.viewMode !== "slice") app.setViewMode("slice");
    app.adjustNDSlice(null, sh ? -1 : -10);
  }],
  ["toggleSliceView", null, (d) => d > 2, (_ih, app) => app.toggleNDSliceView()],

  // ── Rotation / flip ───────────────────────────────────────────────────────
  ["rotate",          0,    null, (_ih, app, _p, sh) => app.rotateWorld(sh ? -15 : -90)],
  ["rotate",          1,    null, (_ih, app, _p, sh) => app.rotateWorld(sh ? 15 : 90)],
  ["flipX",           null, null, (_ih, app, _p, sh) => app.flipWorld(sh ? 1 : 0)],
  ["flipY",           null, null, (_ih, app) => app.flipWorld(2)],

  // ── Auto behaviours ───────────────────────────────────────────────────────
  ["autoCentre",      null, null, (_ih, app, p) => { p.autoCentre = !p.autoCentre; _gui(app); }],
  ["autoRotate",      null, null, (_ih, app, p) => {
    if (app.cycleAutoRotateMode) { app.cycleAutoRotateMode(1, { refreshGUI: true }); }
    else { p.autoRotateMode = ((((Number(p.autoRotateMode) || 0) + 1) % 3) + 3) % 3; _gui(app); }
  }],
  ["polarMode",       null, null, (_ih, app) => app.cyclePolarMode(1, { refreshGUI: true })],

  // ── Soliton selection ─────────────────────────────────────────────────────
  ["loadSoliton",     null, null, (_ih, app) => { app.loadSelectedSoliton(); _gui(app); }],
  ["previousSoliton", null, null, (ih, _app, _p, sh) => ih._cycleSoliton(sh ? -10 : -1)],
  ["nextSoliton",     null, null, (ih, _app, _p, sh) => ih._cycleSoliton(sh ? 10 : 1)],
  ["placeMode",       null, null, (_ih, app, p) => { p.placeMode = !p.placeMode; _gui(app); }],
  ["placeSolitonAtRandom", null, null, (_ih, app) => { app.placeSolitonRandom(); _gui(app); }],

  // ── World generation ──────────────────────────────────────────────────────
  ["clearWorld",      null, null, (_ih, app) => { app.clearWorld(); _gui(app); }],
  ["randomSeed",      null, null, (_ih, app) => { app.randomWorldWithSeed(null, false); _gui(app); }],
  ["randomiseWorld",  null, null, (_ih, app) => { app.randomiseWorld(); _gui(app); }],
  ["randomiseRulesMutation", null, null, (_ih, app) => { app.randomiseParams(true); _gui(app); }],
  ["randomiseRules",  null, null, (_ih, app) => { app.randomiseParams(false); _gui(app); }],

  // ── GUI / overlays ────────────────────────────────────────────────────────
  ["toggleGUI",       null, null, (_ih, app) => { if (app.gui?.pane) app.gui.pane.hidden = !app.gui.pane.hidden; }],
  ["statisticsMode",  null, null, (_ih, app, _p, sh) => app.cycleStatisticsMode(sh ? -1 : 1)],
  ["graphXAxis",      null, null, (_ih, app, _p, sh) => app.cycleStatisticsAxis("x", sh ? -1 : 1)],
  ["graphYAxis",      null, null, (_ih, app, _p, sh) => app.cycleStatisticsAxis("y", sh ? -1 : 1)],
  ["segmentAdd",      null, null, (_ih, app) => app.startStatisticsSegment()],
  ["segmentClear",    null, null, (_ih, app, _p, sh) => { sh ? app.clearAllStatisticsSegments() : app.clearCurrentStatisticsSegment(); }],

  // ── Render toggles ────────────────────────────────────────────────────────
  ["renderStatistics", null, null, (_ih, app, p) => { p.renderStatistics = !p.renderStatistics; _gui(app); }],
  ["renderSymmetry",   null, null, (_ih, app, p) => { p.renderSymmetryOverlay = !p.renderSymmetryOverlay; _gui(app); }],
  ["periodogram",     null, null, (_ih, app, p) => {
    const mode = Math.max(0, Math.min(6, Math.floor(Number(p.statisticsMode) || 1)));
    p.statisticsMode = mode === 5 ? 1 : 5;
    app.analyser?.updatePeriodogram?.(p, 10, true); _gui(app);
  }],
  ["massGrowthOverlay", null, null, (_ih, app, p) => { p.renderMassGrowthOverlay = !p.renderMassGrowthOverlay; _gui(app); }],
  ["trajectory",      null, null, (_ih, app, p) => { p.renderTrajectoryOverlay = !p.renderTrajectoryOverlay; _gui(app); }],
  ["solitonName",     null, null, (_ih, app, p) => { p.renderSolitonName = !p.renderSolitonName; _gui(app); }],
  ["motionOverlay",   null, null, (_ih, app, p) => { p.renderMotionOverlay = !p.renderMotionOverlay; _gui(app); }],
  ["calcPanels",      null, null, (_ih, app, p) => { p.renderCalcPanels = !p.renderCalcPanels; _gui(app); }],
  ["legend",          null, null, (_ih, app, p) => { p.renderLegend = !p.renderLegend; _gui(app); }],
  ["scale",           null, null, (_ih, app, p) => { p.renderScale = !p.renderScale; _gui(app); }],
  ["gridSize",        null, null, (ih) => ih._cycleGridSize()],
  ["renderGrid",      null, null, (_ih, app, p) => { p.renderGrid = !p.renderGrid; _gui(app); }],

  // ── Recording / media ─────────────────────────────────────────────────────
  ["record",          null, null, (ih, app) => {
    try { app.media.isRecording ? app.media.stopRecording() : app.media.startRecording(); }
    catch (e) { ih._diagnosticsLogger.error("Recording toggle failed:", e); }
    app.gui?.syncMediaControls();
  }],
  ["applySolitonParams", null, null, (_ih, app) => app.applySelectedSolitonParams({ refreshGUI: true })],
  ["exportImage",     null, null, (_ih, app) => app.media.exportImage()],
  ["stateExport",     null, null, (_ih, app) => app.media.exportWorldJSON()],
  ["stateImport",     null, null, (_ih, app) => app.media.importWorldJSON()],
  ["paramsImport",    null, null, (_ih, app) => app.media.importParamsJSON()],
  ["paramsExport",    null, null, (_ih, app) => app.media.exportParamsJSON()],
  ["statisticsExportJson", null, null, (_ih, app) => app.media.exportStatisticsJSON()],
  ["statisticsExportCsv",  null, null, (_ih, app) => app.media.exportStatisticsCSV()],
];
