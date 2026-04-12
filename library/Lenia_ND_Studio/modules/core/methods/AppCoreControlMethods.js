class AppCoreControlMethods {
  getSelectedSolitonIndex() {
    const value = this.params.selectedSoliton;
    if (!value || value === "") return null;

    const idx = parseInt(value, 10);
    return Number.isNaN(idx) ? null : idx;
  }

  getSelectedSoliton() {
    const idx = this.getSelectedSolitonIndex();
    if (idx === null) return null;
    return this.solitonLibrary.getSoliton(idx);
  }

  getViewModeOptions() {
    const modes = NDCompatibility.getViewModesForDimension(
      this.params.dimension,
    );

    return modes.reduce((options, mode) => {
      if (mode === "slice") options["Slice"] = mode;
      if (mode === "projection") options["Projection"] = mode;
      return options;
    }, {});
  }

  getGridSizeOptions(dimension = this.params.dimension) {
    const dim = NDCompatibility.coerceDimension(dimension);
    const sizes = NDCompatibility.getGridSizeOptions(dim);
    const canvasSize = min(windowWidth, windowHeight);
    const dimPower = formatDimPower(dim);
    const options = {};
    for (const size of sizes) {
      if (size <= canvasSize) {
        options[`${size}${dimPower}`] = size;
      }
    }
    if (Object.keys(options).length === 0) {
      options[`${sizes[0]}${dimPower}`] = sizes[0];
    }
    return options;
  }

  getMaxKernelRadius(latticeExtent = this.params.latticeExtent) {
    const size = Math.max(1, Math.floor(Number(latticeExtent) || 1));
    return Math.max(2, Math.floor(size / 2));
  }

  getMaxTimeScale() {
    return 1500;
  }

  _coerceKernelWeights(rawWeights, fallback = [1]) {
    let weights = rawWeights;
    if (typeof weights === "string") {
      weights = weights
        .split(",")
        .map((v) => RLECodec.parseFraction(v))
        .filter((v) => Number.isFinite(v));
    }

    if (!Array.isArray(weights) || weights.length === 0) {
      return Array.isArray(fallback) && fallback.length > 0
        ? fallback.slice()
        : [1];
    }

    const out = [];
    for (let i = 0; i < weights.length; i++) {
      const n = Number(weights[i]);
      if (Number.isFinite(n)) out.push(Math.max(0, n));
    }
    return out.length > 0 ? out : [1];
  }

  getChannelCount() {
    const channelCount = Math.max(
      1,
      Math.min(8, Math.floor(Number(this.params.channelCount) || 1)),
    );
    this.params.channelCount = channelCount;
    return channelCount;
  }

  getChannelSelectorOptions() {
    const count = this.getChannelCount();
    const options = {};
    for (let c = 0; c < count; c++) {
      options[`Channel ${c}`] = c;
    }
    return options;
  }

  getKernelSelectorOptions() {
    const channelCount = this.getChannelCount();
    const kernels = this.getKernelParams();
    const options = {};
    for (let i = 0; i < kernels.length; i++) {
      const channels = this._coerceKernelChannels(kernels[i]?.c, channelCount);
      options[`Kernel ${i} (${channels[0]}->${channels[1]})`] = i;
    }
    return options;
  }

  _coerceKernelChannels(rawPair, channelCount = this.getChannelCount()) {
    const maxChannel = Math.max(0, channelCount - 1);
    const pair = Array.isArray(rawPair) ? rawPair : [0, 0];
    const c0 = Math.max(
      0,
      Math.min(maxChannel, Math.floor(Number(pair[0]) || 0)),
    );
    const c1 = Math.max(
      0,
      Math.min(maxChannel, Math.floor(Number(pair[1]) || c0)),
    );
    return [c0, c1];
  }

  _createKernelParamTemplate(overrides = {}, c0 = 0, c1 = 0) {
    const params = this.params;
    const parsedB = this._coerceKernelWeights(overrides.b, params.b);

    const out = {
      R: Number.isFinite(Number(overrides.R))
        ? Number(overrides.R)
        : Number(params.R) || 20,
      T: Number.isFinite(Number(overrides.T))
        ? Number(overrides.T)
        : Number(params.T) || 10,
      m: Number.isFinite(Number(overrides.m))
        ? Number(overrides.m)
        : Number(params.m) || 0.1,
      s: Number.isFinite(Number(overrides.s))
        ? Number(overrides.s)
        : Number(params.s) || 0.01,
      r: Number.isFinite(Number(overrides.r))
        ? Number(overrides.r)
        : Number(params.r) || 1,
      b: parsedB,
      kn: Math.max(
        1,
        Math.min(4, Math.round(Number(overrides.kn) || Number(params.kn) || 1)),
      ),
      gn: Math.max(
        1,
        Math.min(3, Math.round(Number(overrides.gn) || Number(params.gn) || 1)),
      ),
      h: Number.isFinite(Number(overrides.h))
        ? Number(overrides.h)
        : Number(params.h) || 1,
      softClip:
        typeof overrides.softClip === "boolean"
          ? overrides.softClip
          : Boolean(params.softClip),
      multiStep:
        typeof overrides.multiStep === "boolean"
          ? overrides.multiStep
          : Boolean(params.multiStep),
      aritaMode:
        typeof overrides.aritaMode === "boolean"
          ? overrides.aritaMode
          : Boolean(params.aritaMode),
      addNoise: Number.isFinite(Number(overrides.addNoise))
        ? Number(overrides.addNoise)
        : Number(params.addNoise) || 0,
      maskRate: Number.isFinite(Number(overrides.maskRate))
        ? Number(overrides.maskRate)
        : Number(params.maskRate) || 0,
      paramP: Number.isFinite(Number(overrides.paramP))
        ? Number(overrides.paramP)
        : Number(params.paramP) || 0,
      c: this._coerceKernelChannels(overrides.c || [c0, c1]),
    };

    out.R = Math.max(2, Math.min(this.getMaxKernelRadius(), Math.round(out.R)));
    out.T = Math.max(1, Math.min(this.getMaxTimeScale(), Math.round(out.T)));
    out.m = constrain(out.m, 0, 1);
    out.s = Math.max(0.0001, out.s);
    out.addNoise = constrain(out.addNoise, 0, 10);
    out.maskRate = constrain(out.maskRate, 0, 10);
    out.paramP = Math.max(0, Math.min(64, Math.round(out.paramP)));

    return out;
  }

  _normaliseKernelTopology() {
    const channelCount = this.getChannelCount();
    const params = this.params;

    const kernelCount = Math.max(
      1,
      Math.min(4, Math.floor(Number(params.kernelCount) || 1)),
    );
    const crossKernelCount = Math.max(
      0,
      Math.min(4, Math.floor(Number(params.crossKernelCount) || 0)),
    );

    params.kernelCount = kernelCount;
    params.crossKernelCount = crossKernelCount;

    const existing = Array.isArray(params.kernelParams)
      ? params.kernelParams.filter(
          (entry) => entry && typeof entry === "object",
        )
      : [];

    const expectedKernelTotal =
      channelCount * kernelCount +
      channelCount * (channelCount - 1) * crossKernelCount;
    const preserveExplicitTopology =
      existing.length > 0 && existing.length !== expectedKernelTotal;

    const finalise = (
      next,
      inferredKernelCount = kernelCount,
      inferredCrossKernelCount = crossKernelCount,
    ) => {
      const safeNext =
        Array.isArray(next) && next.length > 0
          ? next
          : [this._createKernelParamTemplate({}, 0, 0)];

      params.kernelParams = safeNext;
      params.kernelCount = Math.max(
        1,
        Math.min(4, Math.floor(Number(inferredKernelCount) || 1)),
      );
      params.crossKernelCount = Math.max(
        0,
        Math.min(4, Math.floor(Number(inferredCrossKernelCount) || 0)),
      );
      params.selectedChannel = Math.max(
        0,
        Math.min(
          channelCount - 1,
          Math.floor(Number(params.selectedChannel) || 0),
        ),
      );
      params.selectedKernel = Math.max(
        0,
        Math.min(
          safeNext.length - 1,
          Math.floor(Number(params.selectedKernel) || 0),
        ),
      );
      params.channelShift = Math.max(
        0,
        Math.min(17, Math.floor(Number(params.channelShift) || 0)),
      );
      return safeNext;
    };

    if (preserveExplicitTopology) {
      const next = [];
      const pairCounts = new Map();

      for (let i = 0; i < existing.length; i++) {
        const entry = existing[i];
        const pair = this._coerceKernelChannels(entry.c, channelCount);
        const key = `${pair[0]}:${pair[1]}`;
        pairCounts.set(key, (pairCounts.get(key) || 0) + 1);
        next.push(this._createKernelParamTemplate(entry, pair[0], pair[1]));
      }

      let inferredKernelCount = 0;
      let inferredCrossKernelCount = 0;
      for (const [key, count] of pairCounts.entries()) {
        const [c0, c1] = key.split(":").map((value) => Number(value));
        if (c0 === c1) {
          if (count > inferredKernelCount) inferredKernelCount = count;
        } else if (count > inferredCrossKernelCount) {
          inferredCrossKernelCount = count;
        }
      }
      if (inferredKernelCount <= 0) inferredKernelCount = 1;

      return finalise(next, inferredKernelCount, inferredCrossKernelCount);
    }

    const buckets = new Map();
    for (let i = 0; i < existing.length; i++) {
      const entry = existing[i];
      const pair = this._coerceKernelChannels(entry.c, channelCount);
      const key = `${pair[0]}:${pair[1]}`;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets
        .get(key)
        .push(this._createKernelParamTemplate(entry, pair[0], pair[1]));
    }

    const next = [];

    for (let c0 = 0; c0 < channelCount; c0++) {
      const key = `${c0}:${c0}`;
      const bucket = buckets.get(key) || [];
      for (let rep = 0; rep < kernelCount; rep++) {
        const existingKernel = bucket[rep] || null;
        next.push(
          this._createKernelParamTemplate(existingKernel || {}, c0, c0),
        );
      }
    }

    if (crossKernelCount > 0) {
      for (let c0 = 0; c0 < channelCount; c0++) {
        for (let c1 = 0; c1 < channelCount; c1++) {
          if (c0 === c1) continue;
          const key = `${c0}:${c1}`;
          const bucket = buckets.get(key) || [];
          for (let rep = 0; rep < crossKernelCount; rep++) {
            const existingKernel = bucket[rep] || null;
            next.push(
              this._createKernelParamTemplate(existingKernel || {}, c0, c1),
            );
          }
        }
      }
    }

    return finalise(next, kernelCount, crossKernelCount);
  }

  getKernelParams() {
    return this._normaliseKernelTopology();
  }

  _getSelectedKernelParam() {
    const kernels = this.getKernelParams();
    const idx = Math.max(
      0,
      Math.min(
        kernels.length - 1,
        Math.floor(Number(this.params.selectedKernel) || 0),
      ),
    );
    this.params.selectedKernel = idx;
    return kernels[idx] || kernels[0];
  }

  _syncPrimaryParamsFromSelectedKernel() {
    const kernel = this._getSelectedKernelParam();
    if (!kernel) return;

    const channelCount = this.getChannelCount();
    const kernelChannels = this._coerceKernelChannels(kernel.c, channelCount);
    this.params.selectedChannel = kernelChannels[1];

    this.params.R = kernel.R;
    this.params.T = kernel.T;
    this.params.m = kernel.m;
    this.params.s = kernel.s;
    this.params.r = kernel.r;
    this.params.b = Array.isArray(kernel.b) ? kernel.b.slice() : [1];
    this.params.kn = kernel.kn;
    this.params.gn = kernel.gn;
    this.params.h = kernel.h;
    this.params.softClip = Boolean(kernel.softClip);
    this.params.multiStep = Boolean(kernel.multiStep);
    this.params.aritaMode = Boolean(kernel.aritaMode);
    this.params.addNoise = Number(kernel.addNoise) || 0;
    this.params.maskRate = Number(kernel.maskRate) || 0;
    this.params.paramP = Number(kernel.paramP) || 0;
  }

  _syncSelectedKernelFromPrimaryParams() {
    const kernels = this.getKernelParams();
    const idx = Math.max(
      0,
      Math.min(
        kernels.length - 1,
        Math.floor(Number(this.params.selectedKernel) || 0),
      ),
    );
    const existing = kernels[idx] || {};
    const channels = this._coerceKernelChannels(
      existing.c,
      this.getChannelCount(),
    );
    kernels[idx] = this._createKernelParamTemplate(
      {
        ...existing,
        R: this.params.R,
        T: this.params.T,
        m: this.params.m,
        s: this.params.s,
        r: this.params.r,
        b: this.params.b,
        kn: this.params.kn,
        gn: this.params.gn,
        h: this.params.h,
        softClip: this.params.softClip,
        multiStep: this.params.multiStep,
        aritaMode: this.params.aritaMode,
        addNoise: this.params.addNoise,
        maskRate: this.params.maskRate,
        paramP: this.params.paramP,
        c: channels,
      },
      channels[0],
      channels[1],
    );

    this.params.kernelParams = kernels;
  }

  setChannelCount(channelCount, { refreshGUI = true } = {}) {
    const next = Math.max(
      1,
      Math.min(8, Math.floor(Number(channelCount) || 1)),
    );
    if (next === this.getChannelCount()) return next;

    this.params.channelCount = next;
    this.params.kernelParams = [];
    this._normaliseKernelTopology();
    this._syncPrimaryParamsFromSelectedKernel();

    if (this.board && typeof this.board.setChannelCount === "function") {
      this.board.setChannelCount(next, { preserve: true });
    }
    this._ensureBuffers();
    this.updateAutomatonParams();

    if (refreshGUI) {
      if (this.gui && typeof this.gui.rebuildPane === "function") {
        this.gui.rebuildPane();
      } else {
        this.refreshGUI();
      }
    }
    return next;
  }

  setSelectedChannel(index, { refreshGUI = true } = {}) {
    const count = this.getChannelCount();
    const next = Math.max(
      0,
      Math.min(count - 1, Math.floor(Number(index) || 0)),
    );
    this.params.selectedChannel = next;
    if (refreshGUI) this.refreshGUI();
    return next;
  }

  cycleSelectedChannel(delta = 1, { refreshGUI = true } = {}) {
    const count = this.getChannelCount();
    if (count <= 1) return 0;
    const step = Math.floor(Number(delta) || 0) || 1;
    const current = Math.max(
      0,
      Math.min(count - 1, Math.floor(Number(this.params.selectedChannel) || 0)),
    );
    const next = (((current + step) % count) + count) % count;
    this.params.selectedChannel = next;
    if (refreshGUI) this.refreshGUI();
    return next;
  }

  shiftChannelLegend(delta = 1, { refreshGUI = true } = {}) {
    const step = Math.floor(Number(delta) || 0) || 1;
    const current = Math.floor(Number(this.params.channelShift) || 0);
    const next = (((current + step) % 18) + 18) % 18;
    this.params.channelShift = next;
    if (refreshGUI) this.refreshGUI();
    return next;
  }

  setSelectedKernel(index, { refreshGUI = true } = {}) {
    const kernels = this.getKernelParams();
    const next = Math.max(
      0,
      Math.min(kernels.length - 1, Math.floor(Number(index) || 0)),
    );
    if (next === this.params.selectedKernel && kernels[next]) {
      this._syncPrimaryParamsFromSelectedKernel();
      if (refreshGUI) this.refreshGUI();
      return next;
    }

    this.params.selectedKernel = next;
    this._syncPrimaryParamsFromSelectedKernel();
    this.updateAutomatonParams();

    if (refreshGUI) this.refreshGUI();
    return next;
  }

  cycleSelectedKernel(delta = 1, { refreshGUI = true } = {}) {
    const kernels = this.getKernelParams();
    if (!kernels.length) return 0;
    const step = Math.floor(Number(delta) || 0) || 1;
    const current = Math.max(
      0,
      Math.min(
        kernels.length - 1,
        Math.floor(Number(this.params.selectedKernel) || 0),
      ),
    );
    const next =
      (((current + step) % kernels.length) + kernels.length) % kernels.length;
    return this.setSelectedKernel(next, { refreshGUI });
  }

  _normaliseBackendComputeDevice(value = this.params.backendComputeDevice) {
    return normaliseComputeDevice(value);
  }

  isGLSLComputeSupported({ forceRefresh = false } = {}) {
    if (!forceRefresh && typeof this._cachedGLSLComputeSupport === "boolean") {
      return this._cachedGLSLComputeSupport;
    }

    if (typeof OffscreenCanvas === "undefined") {
      this._cachedGLSLComputeSupport = false;
      return false;
    }

    let supported = false;
    try {
      const canvas = new OffscreenCanvas(2, 2);
      const gl = canvas.getContext("webgl2", {
        antialias: false,
        alpha: false,
        depth: false,
        stencil: false,
        premultipliedAlpha: false,
        preserveDrawingBuffer: false,
      });
      supported = Boolean(gl && gl.getExtension("EXT_color_buffer_float"));
    } catch {
      supported = false;
    }

    this._cachedGLSLComputeSupport = supported;
    return supported;
  }

  getBackendComputeDeviceOptions() {
    return {
      CPU: "cpu",
      "GLSL Compute (2D)": "glsl",
    };
  }

  _warnGLSLUnavailableOnce() {
    if (this._warnedGLSLComputeUnavailable) return;
    this._warnedGLSLComputeUnavailable = true;
    if (this._diagnosticsLogger?.warn) {
      this._diagnosticsLogger.warn(
        "GLSL compute backend requested but WebGL2 float render targets are unavailable. Falling back to CPU.",
      );
    }
  }

  setBackendComputeDevice(
    device,
    { refreshGUI = true, allowFallback = true } = {},
  ) {
    const requested = this._normaliseBackendComputeDevice(device);
    let next = requested;

    if (
      allowFallback &&
      requested === "glsl" &&
      !this.isGLSLComputeSupported()
    ) {
      next = "cpu";
      this._warnGLSLUnavailableOnce();
    }

    if (
      requested === "glsl" &&
      (Number(this.params.dimension) || 2) > 2 &&
      !this._warnedGLSLNDOnly
    ) {
      this._warnedGLSLNDOnly = true;
      if (this._diagnosticsLogger?.info) {
        this._diagnosticsLogger.info(
          "GLSL compute currently accelerates 2D only; ND dimensions continue on CPU stepping.",
        );
      }
    }

    if (next === this.params.backendComputeDevice) {
      if (refreshGUI) this.refreshGUI();
      return next;
    }

    this.params.backendComputeDevice = next;
    this.updateAutomatonParams();
    if (refreshGUI) this.refreshGUI();
    return next;
  }

  cycleBackendComputeDevice(delta = 1, { refreshGUI = true } = {}) {
    const devices = this.isGLSLComputeSupported() ? ["cpu", "glsl"] : ["cpu"];
    const step = Math.floor(Number(delta) || 0) || 1;
    const current = this._normaliseBackendComputeDevice(
      this.params.backendComputeDevice,
    );
    const currentIndex = Math.max(0, devices.indexOf(current));
    const nextIndex =
      (((currentIndex + step) % devices.length) + devices.length) %
      devices.length;
    return this.setBackendComputeDevice(devices[nextIndex], {
      refreshGUI,
      allowFallback: false,
    });
  }

  nudgeRadius(delta) {
    const step = Math.floor(Number(delta) || 0);
    if (!Number.isFinite(step) || step === 0) return;

    const maxR = this.getMaxKernelRadius();
    const currentR = Math.round(Number(this.params.R) || 2);
    const nextR = Math.max(2, Math.min(maxR, currentR + step));
    if (nextR === currentR) return;

    this.zoomWorld(nextR);
  }

  getDefaultRadius(
    latticeExtent = this.params.latticeExtent,
    dimension = this.params.dimension,
  ) {
    const size = Math.max(1, Math.floor(Number(latticeExtent) || 1));
    const dim = NDCompatibility.coerceDimension(dimension);
    const raw = (size / 64) * dim * 5;
    return Math.round(constrain(raw, 2, this.getMaxKernelRadius(size)));
  }

  _coerceAutoRotateModeValue(mode = this.params.autoRotateMode) {
    if (typeof mode === "string") {
      const key = mode.trim().toLowerCase();
      if (key === "off") return 0;
      if (key === "arrow" || key === "arrow (velocity)" || key === "velocity") {
        return 1;
      }
      if (key === "symmetry" || key === "symm") return 2;
    }
    const numeric = Math.floor(Number(mode) || 0);
    return Math.max(0, Math.min(2, numeric));
  }

  getAutoRotateMode() {
    return this._coerceAutoRotateModeValue(this.params.autoRotateMode);
  }

  setAutoRotateMode(mode, { refreshGUI = true } = {}) {
    const nextMode = this._coerceAutoRotateModeValue(mode);
    this.params.autoRotateMode = nextMode;
    if (refreshGUI) this.refreshGUI();
    return nextMode;
  }

  cycleAutoRotateMode(delta = 1, { refreshGUI = true } = {}) {
    const current = this.getAutoRotateMode();
    const step = Math.floor(Number(delta) || 0) || 1;
    const next = (((current + step) % 3) + 3) % 3;
    return this.setAutoRotateMode(next, { refreshGUI });
  }

  getWorldShapeLabel() {
    const dim = Math.max(2, Math.floor(Number(this.params.dimension) || 2));
    const size = Math.max(
      1,
      Math.floor(Number(this.params.latticeExtent) || 1),
    );
    const shape = dim === 2 ? "square" : dim === 3 ? "cube" : "hypercube";
    return `${shape} ${size}^${dim}`;
  }

  _coerceNDActiveAxis(axis, dimension = this.params.dimension) {
    const dim = NDCompatibility.coerceDimension(dimension);
    if (dim <= 3) return "z";
    return String(axis || "z").toLowerCase() === "w" ? "w" : "z";
  }

  getNDActiveAxis() {
    return this._coerceNDActiveAxis(
      this.params.ndActiveAxis,
      this.params.dimension,
    );
  }

  setNDActiveAxis(axis, { refreshGUI = true } = {}) {
    if ((this.params.dimension || 2) <= 2) return "z";
    const nextAxis = this._coerceNDActiveAxis(axis, this.params.dimension);
    this.params.ndActiveAxis = nextAxis;
    if (refreshGUI) this.refreshGUI();
    return nextAxis;
  }

  cycleNDActiveAxis(delta = 1, { refreshGUI = true } = {}) {
    if ((this.params.dimension || 2) < 4) {
      this.params.ndActiveAxis = "z";
      if (refreshGUI) this.refreshGUI();
      return "z";
    }
    const step = Math.floor(Number(delta) || 0) || 1;
    const order = ["z", "w"];
    const current = this.getNDActiveAxis();
    const idx = order.indexOf(current);
    const safeIdx = idx >= 0 ? idx : 0;
    const next = order[(safeIdx + step + order.length) % order.length];
    this.params.ndActiveAxis = next;
    if (refreshGUI) this.refreshGUI();
    return next;
  }

  buildNDConfig() {
    const dimension = NDCompatibility.coerceDimension(this.params.dimension);
    const viewMode = NDCompatibility.coerceViewMode(
      dimension,
      this.params.viewMode,
    );
    const ndDepth = NDCompatibility.getWorldDepthForDimension(
      this.params.latticeExtent,
      dimension,
    );
    const ndSliceZ = NDCompatibility.coerceSliceIndex(
      this.params.ndSliceZ,
      ndDepth,
    );
    const ndSliceW = NDCompatibility.coerceSliceIndex(
      this.params.ndSliceW,
      ndDepth,
    );
    this.params.dimension = dimension;
    this.params.viewMode = viewMode;
    this.params.ndDepth = ndDepth;
    this.params.ndSliceZ = ndSliceZ;
    this.params.ndSliceW = ndSliceW;
    this.params.ndActiveAxis = this._coerceNDActiveAxis(
      this.params.ndActiveAxis,
      dimension,
    );
    const channelCount = this.getChannelCount();
    const kernelParams = this.getKernelParams();

    return {
      dimension,
      viewMode,
      depth: ndDepth,
      sliceZ: ndSliceZ,
      sliceW: ndSliceW,
      activeAxis: this.params.ndActiveAxis,
      channelCount,
      selectedChannel: this.params.selectedChannel,
      selectedKernel: this.params.selectedKernel,
      channelShift: this.params.channelShift,
      kernelParams,
    };
  }

  setDimension(dimension) {
    if (this._changingDimension) return;
    const nextDimension = NDCompatibility.coerceDimension(dimension);

    this._changingDimension = true;
    try {
      this.params.dimension = nextDimension;
      const coercedSize = this._normaliseGridSize(this.params.latticeExtent);
      const sizeChanged = coercedSize !== this.params.latticeExtent;
      this.params.latticeExtent = coercedSize;
      this.params.R = this.getDefaultRadius(
        this.params.latticeExtent,
        nextDimension,
      );
      this._prevR = this.params.R;

      if ((Number(this.params.dimension) || 2) > 2) {
        this.params.viewMode = "projection";
        const ndDepthForSlice = NDCompatibility.getWorldDepthForDimension(
          this.params.latticeExtent,
          nextDimension,
        );
        this.params.ndSliceZ = Math.floor(ndDepthForSlice / 2);
        this.params.ndSliceW = Math.floor(ndDepthForSlice / 2);
        this.params.ndActiveAxis = this._coerceNDActiveAxis(
          this.params.ndActiveAxis,
          nextDimension,
        );
      } else {
        this.params.viewMode = "slice";
        this.params.ndActiveAxis = "z";
      }

      const soliton = this._setSelectedSolitonForActiveDimension(
        this._getRememberedSolitonSelectionForDimension(nextDimension),
        {
          fallbackIndex: 0,
          skipNextParamsLoad: true,
        },
      );

      if (sizeChanged) {
        this.changeResolution();
      }

      if (soliton) {
        this.loadSoliton(soliton, {
          preserveScaleFactor: true,
          preservedScaleFactor: this._getHiddenSolitonScaleFactor(1),
        });
      } else {
        this.clearWorld();
      }

      this._diagnosticsLogger.info(
        `${nextDimension}D mode enabled with ${this.params.latticeExtent}^${nextDimension} world shape and ND tensor stepping.`,
      );

      if (this.gui && typeof this.gui.rebuildPane === "function") {
        this.gui.rebuildPane();
      } else {
        this.refreshGUI();
      }
    } finally {
      this._changingDimension = false;
    }
  }

  setViewMode(viewMode) {
    this.params.viewMode = viewMode === "slice" ? "slice" : "projection";

    this._workerRequestView();

    if (this.gui && typeof this.gui.rebuildPane === "function") {
      this.gui.rebuildPane();
    } else {
      this.refreshGUI();
    }
  }

  adjustNDSlice(axis, delta) {
    if ((this.params.dimension || 2) <= 2) return;
    const targetAxis = this._coerceNDActiveAxis(
      axis || this.params.ndActiveAxis,
      this.params.dimension,
    );
    const step = Math.floor(Number(delta) || 0);
    if (!Number.isFinite(step) || step === 0) return;
    const depth = NDCompatibility.coerceDepth(
      this.params.ndDepth,
      this.params.dimension,
    );
    if (targetAxis === "z") {
      this.params.ndSliceZ =
        (((Math.floor(Number(this.params.ndSliceZ) || 0) + step) % depth) +
          depth) %
        depth;
    } else if (targetAxis === "w") {
      this.params.ndSliceW =
        (((Math.floor(Number(this.params.ndSliceW) || 0) + step) % depth) +
          depth) %
        depth;
    }
    this._workerRequestView();
    this.refreshGUI();
  }

  centreNDSlices({ allAxes = true } = {}) {
    if ((this.params.dimension || 2) <= 2) return;
    const depth = NDCompatibility.coerceDepth(
      this.params.ndDepth,
      this.params.dimension,
    );
    const centre = Math.floor(depth / 2);

    if (allAxes || this.getNDActiveAxis() === "z") {
      this.params.ndSliceZ = centre;
    }
    if ((this.params.dimension || 2) >= 4) {
      if (allAxes || this.getNDActiveAxis() === "w") {
        this.params.ndSliceW = centre;
      }
    }

    this._workerRequestView();
    this.refreshGUI();
  }

  centerNDSlices(options = {}) {
    this.centreNDSlices(options);
  }

  toggleNDSliceView() {
    if ((this.params.dimension || 2) <= 2) return;
    const nextMode = this.params.viewMode === "slice" ? "projection" : "slice";
    this.setViewMode(nextMode);
  }

  shiftNDDepth(delta, axis = null) {
    if ((this.params.dimension || 2) <= 2) return;
    const step = Math.floor(Number(delta) || 0);
    if (!Number.isFinite(step) || step === 0) return;

    const targetAxis = this._coerceNDActiveAxis(
      axis || this.params.ndActiveAxis,
      this.params.dimension,
    );

    this._queueAction("shiftNDDepth", () =>
      this._queueOrRunMutation(() => {
        if (!this.board.world) return;
        this._ensureBuffers();
        this._workerTransform({
          shiftDepth: {
            axis: targetAxis,
            delta: step,
          },
        });
      }),
    );
  }

  refreshNDView() {
    this._workerRequestView();
    this.refreshGUI();
  }

  canvasInteraction(event) {
    if (!event || !event.target) return false;
    if (event.target.closest(".tp-dfwv")) return false;
    if (event.target.tagName !== "CANVAS") return false;
    return true;
  }

  handleMouseClicked(event) {
    if (this.canvasInteraction(event)) {
      const cell = this.renderer.screenToCell(mouseX, mouseY);
      const cellX = cell.x;
      const cellY = cell.y;

      const nowMs = millis();
      const last = this._lastPlacement;
      if (
        last.cellX === cellX &&
        last.cellY === cellY &&
        nowMs - last.atMs < 140
      ) {
        return false;
      }

      last.cellX = cellX;
      last.cellY = cellY;
      last.atMs = nowMs;

      this.placeSoliton(cellX, cellY);
      return false;
    }
  }

  handleMousePressed(event) {
    if (this.canvasInteraction(event)) {
      return this.input.handlePointerPressed(event);
    }
    return;
  }

  handleMouseDragged(event) {
    if (this.canvasInteraction(event)) {
      return this.input.handlePointerDragged(event);
    }
    return;
  }

  handleMouseReleased(event) {
    this.input.handlePointerReleased(event);
    if (this.canvasInteraction(event)) {
      return false;
    }
    return;
  }

  handleMouseWheel(event) {
    if (this.canvasInteraction(event)) {
      return this.input.handleWheel(event);
    }
    return;
  }

  handleKeyPressed(k, kCode, event = null) {
    return KeyboardUtils.safeHandle("Lenia", "press", () =>
      this.input.handleKeyPressed(k, kCode, event),
    );
  }

  handleKeyReleased(k, kCode, event = null) {
    return KeyboardUtils.safeHandle("Lenia", "release", () =>
      this.input.handleKeyReleased(k, kCode, event),
    );
  }

  updateAutomatonParams() {
    this.params.backendComputeDevice = this._normaliseBackendComputeDevice(
      this.params.backendComputeDevice,
    );
    if (
      this.params.backendComputeDevice === "glsl" &&
      !this.isGLSLComputeSupported()
    ) {
      this.params.backendComputeDevice = "cpu";
      this._warnGLSLUnavailableOnce();
    }
    this._normaliseKernelTopology();
    this._syncSelectedKernelFromPrimaryParams();
    this.automaton.updateParameters(this.params);
    this._prevR = this.params.R;
    this._workerSendKernel();
  }

  cycleColourMap(delta = 1) {
    if (!this.colourMapKeys.length) return;

    const currentIndex = this.colourMapKeys.indexOf(this.params.colourMap);
    const baseIndex = currentIndex >= 0 ? currentIndex : 0;
    const length = this.colourMapKeys.length;
    const nextIndex = (baseIndex + delta + length) % length;

    this.params.colourMap = this.colourMapKeys[nextIndex];
    this.refreshGUI();
  }

  getColourMapOptions() {
    return this.colourMapKeys.reduce((options, name) => {
      const entry = this.colourMaps[name] || {};
      const type = entry.type || "sequential";
      const label = `${name} (${type})`;
      options[label] = name;
      return options;
    }, {});
  }

  getStatAxisHeaders() {
    if (
      typeof Analyser !== "undefined" &&
      Array.isArray(Analyser.STAT_HEADERS)
    ) {
      return Analyser.STAT_HEADERS.slice();
    }
    return ["m", "g", "x", "y", "s", "k", "wr"];
  }

  getStatAxisOptions() {
    const headers = this.getStatAxisHeaders();
    const names =
      typeof Analyser !== "undefined" && Analyser.STAT_NAMES
        ? Analyser.STAT_NAMES
        : {};
    return headers.reduce((options, key) => {
      const label = names[key] ? `${key} - ${names[key]}` : key;
      options[label] = key;
      return options;
    }, {});
  }

  cycleStatisticsMode(delta = 1, { refreshGUI = true } = {}) {
    const modes = [0, 1, 5, 6];
    const currentRaw = Math.floor(Number(this.params.statisticsMode) || 1);
    const currentIndex = modes.indexOf(currentRaw);
    const current = currentIndex >= 0 ? currentIndex : 0;
    const step = Math.floor(Number(delta) || 0) || 1;
    const nextIndex =
      (((current + step) % modes.length) + modes.length) % modes.length;
    const next = modes[nextIndex];
    this.params.statisticsMode = next;

    if (next === 5) {
      this.analyser?.updatePeriodogram?.(this.params, 10, true);
    }

    if (refreshGUI) this.refreshGUI();
    return next;
  }

  cycleStatisticsAxis(axis = "x", delta = 1, { refreshGUI = true } = {}) {
    const key = String(axis).toLowerCase() === "y" ? "graphY" : "graphX";
    const headers = this.getStatAxisHeaders();
    if (!headers.length) return this.params[key];

    const current = headers.indexOf(this.params[key]);
    const base = current >= 0 ? current : 0;
    const step = Math.floor(Number(delta) || 0) || 1;
    const nextIndex =
      (((base + step) % headers.length) + headers.length) % headers.length;
    this.params[key] = headers[nextIndex];

    this.analyser?.updatePeriodogram?.(this.params, 10, true);
    if (refreshGUI) this.refreshGUI();
    return this.params[key];
  }

  startStatisticsSegment({ refreshGUI = true } = {}) {
    this.analyser?.startNewSegment?.();
    if (refreshGUI) this.refreshGUI();
  }

  clearCurrentStatisticsSegment({ refreshGUI = true } = {}) {
    this.analyser?.clearCurrentSegment?.();
    this.analyser?.updatePeriodogram?.(this.params, 10, true);
    if (refreshGUI) this.refreshGUI();
  }

  clearAllStatisticsSegments({ refreshGUI = true } = {}) {
    this.analyser?.clearAllSegments?.();
    this.analyser?.updatePeriodogram?.(this.params, 10, true);
    if (refreshGUI) this.refreshGUI();
  }

  refreshGUI() {
    if (this._isRefreshingGUI) return;
    this._isRefreshingGUI = true;
    try {
      if (this.gui && typeof this.gui.syncMediaControls === "function") {
        this.gui.syncMediaControls();
      }

      if (this.gui && typeof this.gui.syncNDSliceBounds === "function") {
        this.gui.syncNDSliceBounds();
      }

      if (this.gui && typeof this.gui.syncSolitonSelectors === "function") {
        this.gui.syncSolitonSelectors();
      }

      if (this.gui && typeof this.gui.syncKernelControlBounds === "function") {
        this.gui.syncKernelControlBounds();
      }

      if (this.gui && this.gui.pane) this.gui.pane.refresh();
    } finally {
      this._isRefreshingGUI = false;
    }
  }
}

AppCore.installMethodsFrom(AppCoreControlMethods);
