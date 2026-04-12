class GUI {
  constructor(
    params,
    statistics,
    renderData,
    metadata,
    solitonLibrary = null,
    appcore = null,
  ) {
    this.params = params;
    this.statistics = statistics;
    this.renderData = renderData;
    this.metadata = metadata;
    this.solitonLibrary = solitonLibrary;
    this.appcore = appcore;
    this.pane = null;
    this._tabs = null;
    this._activeTabIndex = 0;
    this.solitonBinding = null;
    this._solitonMenuState = null;
    this._lastSolitonSelection = String(this.params?.selectedSoliton || "");
    this.recordButton = null;
    this.channelCountBinding = null;
    this.selectedChannelBinding = null;
    this.selectedKernelBinding = null;
    this.kernelCountBinding = null;
    this.crossKernelCountBinding = null;
    this.backendComputeDeviceBinding = null;
    this.ndSliceZBinding = null;
    this.ndSliceWBinding = null;
    this._statisticsGraphWrapper = null;
    this._statisticsGraphCanvas = null;
    this._statisticsGraphCaption = null;
    this._statisticsGraphRaf = 0;
    this._statisticsGraphLastFrameMs = 0;
    this._statisticsGraphScratch = null;
    this._statisticsGraphLayers = null;
  }

  rebuildPane() {
    if (this._rebuildScheduled) return;
    this._rebuildScheduled = true;
    Promise.resolve().then(() => {
      this._rebuildScheduled = false;
      this._captureActiveTabIndex();
      if (typeof this._teardownStatisticsGraph === "function") {
        this._teardownStatisticsGraph();
      }
      if (this.pane) {
        this.pane.dispose();
      }
      this.pane = null;
      this._tabs = null;
      this.solitonBinding = null;
      this.recordButton = null;
      this.channelCountBinding = null;
      this.selectedChannelBinding = null;
      this.selectedKernelBinding = null;
      this.kernelCountBinding = null;
      this.crossKernelCountBinding = null;
      this.backendComputeDeviceBinding = null;
      this.ndSliceZBinding = null;
      this.ndSliceWBinding = null;
      this.setupTabs();
    });
  }

  setupTabs() {
    this.pane = new Tweakpane.Pane({
      title: `${this.metadata.name} ${this.metadata.version} by ${this.metadata.author}`,
      expanded: true,
    });

    const tabs = this.pane.addTab({
      pages: [
        { title: "Simulation" },
        { title: "Parameters" },
        { title: "Rendering" },
        { title: "Solitons" },
        { title: "Statistics" },
        { title: "Media" },
      ],
    });
    this._tabs = tabs;

    this.createSimulationTab(tabs.pages[0]);
    this.createParametersTab(tabs.pages[1]);
    this.createSolitonsTab(tabs.pages[3]);
    this.createRenderTab(tabs.pages[2]);
    this.createStatisticsTab(tabs.pages[4]);
    this.createMediaTab(tabs.pages[5]);

    this._restoreActiveTabIndex();
  }

  addSeparator(target) {
    target.addBlade({ view: "separator" });
  }

  withHint(label, id, fallback = "") {
    if (typeof KeybindCatalogue === "undefined") {
      return fallback ? `${label} (${fallback})` : label;
    }
    return KeybindCatalogue.withHint(label, "lenia", id, fallback);
  }

  addBackendComputeBinding(target) {
    if (!target) return null;
    this.backendComputeDeviceBinding = target
      .addBinding(this.params, "backendComputeDevice", {
        label: this.withHint(
          "Backend Compute Device",
          "backendComputeDevice",
          "Ctrl+B",
        ),
        options: this.appcore?.getBackendComputeDeviceOptions
          ? this.appcore.getBackendComputeDeviceOptions()
          : {
              CPU: "cpu",
              "GLSL Compute": "glsl",
            },
      })
      .on("change", (event) =>
        this._runIfGUIIdle(() =>
          this.appcore?.setBackendComputeDevice(event.value),
        ),
      );
    return this.backendComputeDeviceBinding;
  }

  _runIfGUIIdle(fn) {
    if (!this.appcore) return;
    if (this.appcore._isRefreshingGUI) return;
    fn();
  }

  _captureActiveTabIndex() {
    const pages = this._tabs?.pages;
    if (!Array.isArray(pages) || pages.length === 0) return;
    const selectedIndex = pages.findIndex((page) => Boolean(page?.selected));
    if (selectedIndex >= 0) this._activeTabIndex = selectedIndex;
  }

  _restoreActiveTabIndex() {
    const pages = this._tabs?.pages;
    if (!Array.isArray(pages) || pages.length === 0) {
      this._activeTabIndex = 0;
      return;
    }
    const safeIndex = Math.max(
      0,
      Math.min(pages.length - 1, Math.floor(Number(this._activeTabIndex) || 0)),
    );
    const page = pages[safeIndex];
    if (page && "selected" in page) {
      try {
        page.selected = true;
      } catch (_error) {
        // Ignore if the tab implementation exposes a read-only selected state.
      }
    }
    this._activeTabIndex = safeIndex;
  }

  createSimulationTab(page) {
    const { params, statistics } = this;
    const sizeOptions = this.appcore
      ? this.appcore.getGridSizeOptions(params.dimension)
      : { "64²": 64, "128²": 128, "256²": 256, "512²": 512 };

    const run = page.addFolder({
      title: "Simulation Controls",
      expanded: true,
    });
    run.addBinding(params, "running", {
      label: this.withHint("Running", "running", "Space"),
    });
    run
      .addButton({
        title: this.withHint("Step Once", "stepOnce", "Enter"),
      })
      .on("click", () => this.appcore?.stepOnce());
    run
      .addButton({
        title: this.withHint("Clear World", "clearWorld", "Del/Backspace"),
      })
      .on("click", () => this.appcore?.clearWorld());
    run
      .addButton({
        title: this.withHint("Random Cells", "randomCells", "N"),
      })
      .on("click", () => this.appcore?.randomiseWorld());
    run
      .addButton({
        title: this.withHint("Random Parameters", "randomParams", "M"),
      })
      .on("click", () => this.appcore?.randomiseParams(false));

    this.addSeparator(page);

    const perf = page.addFolder({
      title: "Performance Metrics",
      expanded: true,
    });

    perf.addBinding(statistics, "fps", {
      readonly: true,
      label: "FPS [Hz]",
      view: "graph",
      interval: 60,
      min: 0,
      max: 100,
    });
    perf.addBinding(statistics, "time", { readonly: true, label: "Time [μs]" });

    this.addSeparator(page);

    const compute = page.addFolder({
      title: "Compute",
      expanded: true,
    });
    this.addBackendComputeBinding(compute);

    this.addSeparator(page);

    const world = page.addFolder({
      title: "World Configuration",
      expanded: true,
    });
    world
      .addBinding(params, "dimension", {
        label: this.withHint("Dimension", "dimension", "Ctrl+D"),
        options: { "2D": 2, "3D": 3, "4D": 4 },
      })
      .on("change", (event) =>
        this._runIfGUIIdle(() => this.appcore?.setDimension(event.value)),
      );

    world
      .addBinding(params, "latticeExtent", {
        label: this.withHint("Lattice Size", "latticeExtent", "`"),
        options: sizeOptions,
      })
      .on("change", () =>
        this._runIfGUIIdle(() => this.appcore?.changeResolution()),
      );

    const dim = Number(params.dimension) || 2;

    if (dim >= 3) {
      this.addSeparator(world);

      world
        .addBinding(params, "viewMode", {
          label: this.withHint("ND View", "ndView", "Ctrl+End"),
          options: this.appcore
            ? this.appcore.getViewModeOptions()
            : { Slice: "slice", Projection: "projection" },
        })
        .on("change", (event) =>
          this._runIfGUIIdle(() => this.appcore?.setViewMode(event.value)),
        );

      world.addBinding(params, "ndDepth", {
        label: "Tensor Depth (auto)",
        readonly: true,
      });

      const depthMax = Math.max(1, (Number(params.ndDepth) || 2) - 1);

      if (String(params.viewMode) === "slice") {
        this.ndSliceZBinding = world
          .addBinding(params, "ndSliceZ", {
            label: this.withHint("Slice Z", "sliceZ", "Home/End"),
            min: 0,
            max: depthMax,
            step: 1,
          })
          .on("change", () =>
            this._runIfGUIIdle(() => this.appcore?.refreshNDView()),
          );
      }

      if (dim >= 4) {
        world
          .addBinding(params, "ndActiveAxis", {
            label: this.withHint(
              "Depth Axis",
              "changeZAxis",
              "Ctrl+Shift+Home",
            ),
            options: {
              Z: "z",
              W: "w",
            },
          })
          .on("change", (event) =>
            this._runIfGUIIdle(() =>
              this.appcore?.setNDActiveAxis(event.value),
            ),
          );

        this.ndSliceWBinding = world
          .addBinding(params, "ndSliceW", {
            label: this.withHint("Slice W", "sliceW", "Shift+Scroll"),
            min: 0,
            max: depthMax,
            step: 1,
          })
          .on("change", () =>
            this._runIfGUIIdle(() => this.appcore?.refreshNDView()),
          );
      }
    }

    this.addSeparator(page);

    const xform = page.addFolder({ title: "Transform Operations" });

    xform
      .addButton({ title: this.withHint("Shift Left", "shiftLeft", "←") })
      .on("click", () => this.appcore?.shiftWorld(-10, 0));
    xform
      .addButton({
        title: this.withHint("Shift Right", "shiftRight", "→"),
      })
      .on("click", () => this.appcore?.shiftWorld(10, 0));
    xform
      .addButton({ title: this.withHint("Shift Up", "shiftUp", "↑") })
      .on("click", () => this.appcore?.shiftWorld(0, -10));
    xform
      .addButton({
        title: this.withHint("Shift Down", "shiftDown", "↓"),
      })
      .on("click", () => this.appcore?.shiftWorld(0, 10));

    this.addSeparator(xform);

    xform
      .addButton({
        title: this.withHint("Zoom In", "zoomInTransform", "R"),
      })
      .on("click", () => this.appcore?.nudgeRadius(5));
    xform
      .addButton({
        title: this.withHint("Zoom Out", "zoomOutTransform", "F"),
      })
      .on("click", () => this.appcore?.nudgeRadius(-5));

    this.addSeparator(xform);

    xform
      .addButton({
        title: this.withHint("Rotate -90°", "rotateLeft", "Ctrl+←"),
      })
      .on("click", () => this.appcore?.rotateWorld(-90));
    xform
      .addButton({
        title: this.withHint("Rotate +90°", "rotateRight", "Ctrl+→"),
      })
      .on("click", () => this.appcore?.rotateWorld(90));

    this.addSeparator(xform);

    xform
      .addButton({
        title: this.withHint("Flip Horizontal", "flipH", "="),
      })
      .on("click", () => this.appcore?.flipWorld(0));
    xform
      .addButton({
        title: this.withHint("Flip Vertical", "flipV", "Shift+="),
      })
      .on("click", () => this.appcore?.flipWorld(1));
    xform
      .addButton({ title: this.withHint("Transpose", "transpose", "-") })
      .on("click", () => this.appcore?.flipWorld(2));

    if (dim > 2) {
      this.addSeparator(xform);

      xform
        .addButton({
          title: this.withHint("Move Front", "moveFront", "PgUp"),
        })
        .on("click", () => this.appcore?.shiftNDDepth(10));
      xform
        .addButton({
          title: this.withHint("Move Back", "moveBack", "PgDn"),
        })
        .on("click", () => this.appcore?.shiftNDDepth(-10));
      xform
        .addButton({
          title: this.withHint(
            "Move Front (small)",
            "moveFrontSmall",
            "Shift+PgUp",
          ),
        })
        .on("click", () => this.appcore?.shiftNDDepth(1));
      xform
        .addButton({
          title: this.withHint(
            "Move Back (small)",
            "moveBackSmall",
            "Shift+PgDn",
          ),
        })
        .on("click", () => this.appcore?.shiftNDDepth(-1));

      this.addSeparator(xform);

      xform
        .addButton({
          title: this.withHint("Slice Front", "sliceFront", "Home"),
        })
        .on("click", () => {
          if (this.appcore?.params?.viewMode !== "slice") {
            this.appcore?.setViewMode("slice");
          }
          this.appcore?.adjustNDSlice(null, 10);
        });
      xform
        .addButton({
          title: this.withHint("Slice Back", "sliceBack", "End"),
        })
        .on("click", () => {
          if (this.appcore?.params?.viewMode !== "slice") {
            this.appcore?.setViewMode("slice");
          }
          this.appcore?.adjustNDSlice(null, -10);
        });
      xform
        .addButton({
          title: this.withHint(
            "Slice Front (small)",
            "sliceFrontSmall",
            "Shift+Home",
          ),
        })
        .on("click", () => {
          if (this.appcore?.params?.viewMode !== "slice") {
            this.appcore?.setViewMode("slice");
          }
          this.appcore?.adjustNDSlice(null, 1);
        });
      xform
        .addButton({
          title: this.withHint(
            "Slice Back (small)",
            "sliceBackSmall",
            "Shift+End",
          ),
        })
        .on("click", () => {
          if (this.appcore?.params?.viewMode !== "slice") {
            this.appcore?.setViewMode("slice");
          }
          this.appcore?.adjustNDSlice(null, -1);
        });

      xform
        .addButton({
          title: this.withHint("Centre Slice", "centreSlice", "Ctrl+Home"),
        })
        .on("click", () => this.appcore?.centerNDSlices({ allAxes: true }));

      xform
        .addButton({
          title: this.withHint("Show Z Slice", "showZSlice", "Ctrl+End"),
        })
        .on("click", () => this.appcore?.toggleNDSliceView());

      if (dim >= 4) {
        xform
          .addButton({
            title: this.withHint(
              "Change Z Axis",
              "changeZAxis",
              "Ctrl+Shift+Home",
            ),
          })
          .on("click", () => this.appcore?.cycleNDActiveAxis(1));
      }
    }

    this.addSeparator(page);

    const keymapShortcut =
      typeof KeybindCatalogue === "undefined"
        ? "#"
        : KeybindCatalogue.getHint("lenia", "keymapReference", "#");
    const keymapHint = {
      text: `Press ${keymapShortcut} to open keymap reference`,
    };
    page.addBinding(keymapHint, "text", {
      label: "Hint",
      readonly: true,
    });
  }

  createParametersTab(page) {
    const { params } = this;
    const bindAutomaton = (target, key, options) => {
      return target
        .addBinding(params, key, options)
        .on("change", () => this.appcore?.updateAutomatonParams());
    };

    const topology = page.addFolder({
      title: "Channels & Kernels",
      expanded: true,
    });

    this.channelCountBinding = topology
      .addBinding(params, "channelCount", {
        options: {
          1: 1,
          2: 2,
          3: 3,
          4: 4,
          5: 5,
          6: 6,
          7: 7,
          8: 8,
        },
        label: this.withHint("Channel Count", "channelCount", "GUI"),
      })
      .on("change", (event) =>
        this._runIfGUIIdle(() => this.appcore?.setChannelCount(event.value)),
      );

    this.selectedChannelBinding = topology
      .addBinding(params, "selectedChannel", {
        options: this.appcore?.getChannelSelectorOptions
          ? this.appcore.getChannelSelectorOptions()
          : { "Channel 0": 0 },
        label: this.withHint("Active Channel", "selectedChannel", "Ctrl+9/0"),
      })
      .on("change", (event) =>
        this._runIfGUIIdle(() => this.appcore?.setSelectedChannel(event.value)),
      );

    this.kernelCountBinding = topology
      .addBinding(params, "kernelCount", {
        options: {
          1: 1,
          2: 2,
          3: 3,
          4: 4,
        },
        label: this.withHint("Per-Channel Kernels", "kernelCount", "GUI"),
      })
      .on("change", () => {
        this.params.kernelParams = [];
        this.appcore?.updateAutomatonParams();
        this.appcore?.gui?.rebuildPane?.();
      });

    this.crossKernelCountBinding = topology
      .addBinding(params, "crossKernelCount", {
        options: {
          0: 0,
          1: 1,
          2: 2,
          3: 3,
          4: 4,
        },
        label: this.withHint(
          "Cross-Channel Kernels",
          "crossKernelCount",
          "GUI",
        ),
      })
      .on("change", () => {
        this.params.kernelParams = [];
        this.appcore?.updateAutomatonParams();
        this.appcore?.gui?.rebuildPane?.();
      });

    this.selectedKernelBinding = topology
      .addBinding(params, "selectedKernel", {
        options: this.appcore?.getKernelSelectorOptions
          ? this.appcore.getKernelSelectorOptions()
          : { "Kernel 0": 0 },
        label: this.withHint("Active Kernel", "selectedKernel", "Ctrl+-/="),
      })
      .on("change", (event) =>
        this._runIfGUIIdle(() => this.appcore?.setSelectedKernel(event.value)),
      );

    topology
      .addBinding(params, "channelShift", {
        min: 0,
        max: 17,
        step: 1,
        label: this.withHint("Channel Colour Shift", "channelShift", "Alt+./,"),
      })
      .on("change", () => this.appcore?.refreshGUI());

    this.addSeparator(page);

    const growth = page.addFolder({ title: "Growth Function", expanded: true });

    bindAutomaton(growth, "m", {
      min: 0,
      max: 1,
      step: 0.001,
      label: this.withHint("Centre μ", "growthCentre", "Q/A"),
    });

    bindAutomaton(growth, "s", {
      min: 0.0001,
      max: 1,
      step: 0.0001,
      label: this.withHint("Width σ", "growthWidth", "W/S"),
    });

    bindAutomaton(growth, "gn", {
      label: this.withHint("Growth Function Type", "growthType", "Ctrl+U"),
      options: {
        Polynomial: 1,
        Exponential: 2,
        Step: 3,
      },
    });

    this.addSeparator(page);

    const kernel = page.addFolder({ title: "Kernel Function", expanded: true });
    const maxR = this.appcore?.getMaxKernelRadius
      ? this.appcore.getMaxKernelRadius()
      : 50;

    kernel
      .addBinding(params, "R", {
        min: 2,
        max: maxR,
        step: 1,
        label: this.withHint("Radius R", "radius", "R/F"),
      })
      .on("change", (ev) => {
        this._runIfGUIIdle(() => {
          if (this.appcore) this.appcore.zoomWorld(ev.value);
        });
      });

    bindAutomaton(kernel, "kn", {
      label: this.withHint("Kernel Function Type", "kernelType", "Ctrl+Y"),
      options: {
        Polynomial: 1,
        Exponential: 2,
        Step: 3,
        Staircase: 4,
      },
    });

    this.addSeparator(page);

    const time = page.addFolder({ title: "Time Integration" });

    bindAutomaton(time, "T", {
      min: 1,
      max: 1500,
      step: 1,
      label: this.withHint("Steps T", "steps", "T/G"),
    });

    bindAutomaton(time, "softClip", {
      label: this.withHint("Soft Clip", "softClip", "Ctrl+I"),
    });

    bindAutomaton(time, "multiStep", {
      label: this.withHint("Multi-Step", "multiStep", "Ctrl+M"),
    });

    bindAutomaton(time, "aritaMode", {
      label: this.withHint("Asymptotic Update (Arita)", "aritaMode", "Ctrl+P"),
    });

    bindAutomaton(time, "h", {
      min: 0.1,
      max: 1.0,
      step: 0.1,
      label: this.withHint("Weight h", "weight", "Ctrl+T/G"),
    });

    bindAutomaton(time, "addNoise", {
      min: 0,
      max: 10,
      step: 0.1,
      label: this.withHint("Noise Level", "noise", "Ctrl+O"),
    });

    bindAutomaton(time, "maskRate", {
      min: 0,
      max: 10,
      step: 0.1,
      label: this.withHint("Mask Rate", "maskRate", "Ctrl+Shift+I"),
    });

    bindAutomaton(time, "paramP", {
      min: 0,
      max: 64,
      step: 1,
      label: this.withHint(
        "Quantise P (allowed cell states)",
        "quantiseP",
        "E/D",
      ),
    });
  }

  createRenderTab(page) {
    const { params } = this;

    const maps = page.addFolder({ title: "Map View", expanded: true });

    maps
      .addBinding(params, "colourMap", {
        label: this.withHint("Selected Colour Map", "colourMap", "./,"),
        options: this.appcore
          ? this.appcore.getColourMapOptions()
          : { greyscale: "greyscale" },
      })
      .on("change", () =>
        this.appcore?.renderer?.setColourMap(params.colourMap),
      );

    maps.addBinding(params, "renderMode", {
      label: this.withHint("Selected Render Mode", "renderMode", "Tab"),
      options: {
        World: "world",
        Potential: "potential",
        Growth: "growth",
        Kernel: "kernel",
      },
    });

    this.addSeparator(page);

    const overlay = page.addFolder({ title: "Scene Overlays", expanded: true });

    overlay.addBinding(params, "renderGrid", {
      label: this.withHint("Toggle Grid", "renderGrid", "Shift+G"),
    });
    overlay.addBinding(params, "renderScale", {
      label: this.withHint("Toggle Scale Bar", "renderScale", "B"),
    });
    overlay.addBinding(params, "renderLegend", {
      label: this.withHint("Toggle Legend", "renderLegend", "L"),
    });
    overlay.addBinding(params, "renderMotionOverlay", {
      label: this.withHint("Toggle Motion Overlay", "renderMotion", "J"),
    });
    overlay.addBinding(params, "renderTrajectoryOverlay", {
      label: this.withHint(
        "Toggle Trajectory Overlay",
        "renderTrajectory",
        "Ctrl+L",
      ),
    });
    overlay.addBinding(params, "renderMassGrowthOverlay", {
      label: this.withHint(
        "Toggle Mass→Growth Centroid Link",
        "renderMassGrowth",
        "Ctrl+Shift+L",
      ),
    });
    overlay.addBinding(params, "renderCalcPanels", {
      label: this.withHint("Toggle Calculation Panels", "renderCalc", "K"),
    });
    overlay.addBinding(params, "renderSolitonName", {
      label: this.withHint("Toggle Soliton Name", "renderName", "Shift+J"),
    });
    this.addSeparator(page);

    const polar = page.addFolder({ title: "Centering & Polar" });

    polar.addBinding(params, "autoCentre", {
      label: this.withHint("Toggle Auto-Centre", "autoCentre", "'"),
    });

    polar
      .addBinding(params, "polarMode", {
        label: this.withHint("Selected Polar Mode", "polarMode", "Ctrl+'"),
        options: {
          Off: 0,
          Symmetry: 1,
          Polar: 2,
          History: 3,
          Strength: 4,
        },
      })
      .on("change", (event) =>
        this.appcore?.setPolarMode(event.value, { refreshGUI: true }),
      );

    polar.addBinding(params, "renderSymmetryOverlay", {
      label: this.withHint(
        "Toggle Symmetry Overlay (Polar ≠ Off)",
        "renderSymmetry",
        "Ctrl+J",
      ),
    });

    polar
      .addBinding(params, "autoRotateMode", {
        label: this.withHint("Toggle Auto-Rotate", "autoRotate", "Shift+'"),
        options: {
          Off: 0,
          "Arrow (velocity)": 1,
          Symmetry: 2,
        },
      })
      .on("change", (event) =>
        this.appcore?.setAutoRotateMode?.(event.value, { refreshGUI: true }),
      );
  }

  createSolitonsTab(page) {
    const { params } = this;
    const sourceDimension =
      this.solitonLibrary &&
      Number.isFinite(this.solitonLibrary.activeDimension)
        ? this.solitonLibrary.activeDimension
        : params.dimension;
    const solitonCount = Array.isArray(this.solitonLibrary?.solitons)
      ? this.solitonLibrary.solitons.length
      : 0;
    const options = this.solitonLibrary
      ? this.solitonLibrary.getHierarchicalSolitonMenu()
      : {};

    const currentSelection = String(params.selectedSoliton || "");
    const currentSolitonToken = this.solitonLibrary
      ? this.solitonLibrary.toSolitonMenuValue(currentSelection)
      : currentSelection;
    const firstSolitonToken = this.solitonLibrary
      ? this.solitonLibrary.getFirstSolitonMenuValue()
      : "";
    const optionValues = new Set(Object.values(options));
    const initialMenuValue = optionValues.has(currentSolitonToken)
      ? currentSolitonToken
      : optionValues.has(firstSolitonToken)
        ? firstSolitonToken
        : currentSolitonToken;

    this._solitonMenuState = {
      selectedSolitonMenu: initialMenuValue,
    };

    this.solitonBinding = page.addBinding(
      this._solitonMenuState,
      "selectedSolitonMenu",
      {
        label: `Selected Soliton (${solitonCount} × ${sourceDimension}D)`,
        options,
      },
    );
    this.solitonBinding.on("change", (event) => {
      const idx = this.solitonLibrary
        ? this.solitonLibrary.parseSolitonMenuValue(event.value)
        : parseInt(String(event.value), 10);

      if (!Number.isFinite(idx) || idx < 0) {
        const fallback = this.solitonLibrary
          ? this.solitonLibrary.toSolitonMenuValue(params.selectedSoliton)
          : String(params.selectedSoliton || "");
        this._solitonMenuState.selectedSolitonMenu = fallback;
        this.solitonBinding?.refresh?.();
        return;
      }

      const nextSelection = String(idx);
      this._lastSolitonSelection = nextSelection;

      const selected = this.appcore?.selectSolitonByIndex
        ? this.appcore.selectSolitonByIndex(idx, {
            preserveScaleFactor: true,
          })
        : false;

      if (!selected) {
        const fallback = this.solitonLibrary
          ? this.solitonLibrary.toSolitonMenuValue(params.selectedSoliton)
          : String(params.selectedSoliton || "");
        this._solitonMenuState.selectedSolitonMenu = fallback;
        this.solitonBinding?.refresh?.();
      }
    });

    page
      .addButton({
        title: this.withHint("◀ Previous", "prevSoliton", "C"),
      })
      .on("click", () => this.appcore?.cycleSoliton(-1));
    page
      .addButton({
        title: this.withHint("▶ Next", "nextSoliton", "V"),
      })
      .on("click", () => this.appcore?.cycleSoliton(1));
    page
      .addButton({
        title: this.withHint("Reload at Centre", "reloadSolitonAtCentre", "Z"),
      })
      .on("click", () => this.appcore?.loadSelectedSoliton());
    page
      .addButton({
        title: this.withHint("Place at Random", "placeSolitonAtRandom", "X"),
      })
      .on("click", () => this.appcore?.placeSolitonRandom());

    this.addSeparator(page);

    const placementFolder = page.addFolder({
      title: "Placement",
      expanded: true,
    });

    placementFolder.addBinding(params, "placeMode", {
      label: this.withHint("Click to Place", "placeMode", "Shift+X"),
    });

    placementFolder
      .addButton({
        title: this.withHint(
          "Reset Soliton Parameters",
          "resetSolitonParams",
          "Ctrl+Shift+Z",
        ),
      })
      .on("click", () => {
        if (!this.appcore) return;
        this.appcore.applySelectedSolitonParams({ refreshGUI: true });
      });
  }

  syncSolitonSelectors() {
    if (this.solitonBinding && this._solitonMenuState && this.solitonLibrary) {
      const token = this.solitonLibrary.toSolitonMenuValue(
        this.params.selectedSoliton,
      );
      if (token && this._solitonMenuState.selectedSolitonMenu !== token) {
        this._solitonMenuState.selectedSolitonMenu = token;
        this.solitonBinding.refresh?.();
      }
    }
  }

  syncNDSliceBounds() {
    const params = this.params;
    const dim = Number(params.dimension) || 2;
    if (dim < 3) return;

    const depth = Math.max(2, Math.floor(Number(params.ndDepth) || 2));
    const depthMax = depth - 1;

    if (this.ndSliceZBinding) {
      this.ndSliceZBinding.min = 0;
      this.ndSliceZBinding.max = depthMax;
    }

    if (this.ndSliceWBinding) {
      this.ndSliceWBinding.min = 0;
      this.ndSliceWBinding.max = depthMax;
    }

    params.ndSliceZ = Math.max(
      0,
      Math.min(depthMax, Math.floor(Number(params.ndSliceZ) || 0)),
    );
    params.ndSliceW = Math.max(
      0,
      Math.min(depthMax, Math.floor(Number(params.ndSliceW) || 0)),
    );
  }

  syncKernelControlBounds() {
    const params = this.params;
    const channelCount = Math.max(
      1,
      Math.floor(Number(params.channelCount) || 1),
    );
    const kernelTotal = Array.isArray(params.kernelParams)
      ? params.kernelParams.length
      : 1;

    params.selectedChannel = Math.max(
      0,
      Math.min(
        channelCount - 1,
        Math.floor(Number(params.selectedChannel) || 0),
      ),
    );
    params.selectedKernel = Math.max(
      0,
      Math.min(kernelTotal - 1, Math.floor(Number(params.selectedKernel) || 0)),
    );
  }

  dispose() {
    if (typeof this._teardownStatisticsGraph === "function") {
      this._teardownStatisticsGraph();
    }
    if (this.pane) {
      this.pane.dispose();
      this.pane = null;
      this.solitonBinding = null;
      this.recordButton = null;
      this.channelCountBinding = null;
      this.selectedChannelBinding = null;
      this.selectedKernelBinding = null;
      this.kernelCountBinding = null;
      this.crossKernelCountBinding = null;
      this.ndSliceZBinding = null;
      this.ndSliceWBinding = null;
    }
  }

  createStatisticsTab(page) {
    const { statistics, params } = this;
    const formatSigned = FormatUtils.formatSigned;
    const formatPercent = FormatUtils.formatPercent;
    const formatInt = FormatUtils.formatInt;
    const dimension = Math.max(2, Math.floor(Number(params?.dimension) || 2));
    const dimPower = formatDimPower(dimension);
    const microMeterPower = `μm${dimPower}`;
    const addStatistic = (folder, key, label, format = formatSigned) =>
      folder.addBinding(statistics, key, {
        readonly: true,
        label,
        format,
      });
    const refreshSpectralAnalysis = () => {
      this.appcore?.analyser?.updatePeriodogram?.(params, 10, true);
      this._renderStatisticsGraph();
    };

    const statisticsAxisOptions = this.appcore
      ? this.appcore.getStatAxisOptions()
      : { m: "m", g: "g", x: "x", y: "y" };

    const overlays = page.addFolder({
      title: "Statistics Overlay",
      expanded: true,
    });

    overlays.addBinding(params, "renderStatistics", {
      label: this.withHint(
        "Toggle Statistics Overlay",
        "renderStatistics",
        "Ctrl+H",
      ),
    });

    this.addSeparator(page);

    const graphs = page.addFolder({
      title: "Graphs and Modes",
      expanded: true,
    });

    graphs
      .addBinding(params, "statisticsMode", {
        label: this.withHint("Graph Mode", "statisticsMode", "Alt+J"),
        options: {
          None: 0,
          "Comparative Graph": 1,
          Periodogram: 5,
          "Recurrence Plot": 6,
        },
      })
      .on("change", refreshSpectralAnalysis);

    graphs
      .addBinding(params, "graphX", {
        label: this.withHint("Graph X axis", "graphXAxis", "Alt+K"),
        options: statisticsAxisOptions,
      })
      .on("change", refreshSpectralAnalysis);

    graphs
      .addBinding(params, "graphY", {
        label: this.withHint("Graph Y axis", "graphYAxis", "Alt+L"),
        options: statisticsAxisOptions,
      })
      .on("change", refreshSpectralAnalysis);

    graphs
      .addBinding(params, "periodogramUseWelch", {
        label: "Toggle Periodogram Method (Welch)",
      })
      .on("change", refreshSpectralAnalysis);

    graphs
      .addBinding(params, "recurrenceThreshold", {
        label: "Recurrence Scale",
        min: 0.05,
        max: 1,
        step: 0.01,
      })
      .on("change", () => this._renderStatisticsGraph());

    this._mountStatisticsGraph(graphs);

    this.addSeparator(page);

    const segments = page.addFolder({
      title: "Segments and Grouping",
      expanded: false,
    });

    segments.addBinding(params, "statisticsTrimSegment", {
      label: "Segment Length",
      options: {
        Unlimited: 0,
        Short: 1,
        Long: 2,
      },
    });

    segments.addBinding(params, "statisticsGroupByParams", {
      label: "Group by Parameters",
    });

    this.addSeparator(segments);

    segments
      .addButton({ title: "Start New Segment" })
      .on("click", () => this.appcore?.startStatisticsSegment());
    segments
      .addButton({ title: "Clear Current Segment" })
      .on("click", () => this.appcore?.clearCurrentStatisticsSegment());
    segments
      .addButton({ title: "Clear All Segments" })
      .on("click", () => this.appcore?.clearAllStatisticsSegments());

    this.addSeparator(page);

    const metrics = page.addFolder({ title: "Basic Metrics", expanded: true });
    addStatistic(metrics, "gen", "Generation [gen]", formatInt);
    addStatistic(metrics, "time", "Time [μs]");
    addStatistic(metrics, "fps", "FPS [Hz]");
    addStatistic(metrics, "mass", "Mass [μg]");
    addStatistic(metrics, "growth", "Growth [μg/μs]");
    addStatistic(metrics, "massLog", "Mass (log scale) [μg]");
    addStatistic(metrics, "growthLog", "Growth (log scale) [μg/μs]");
    addStatistic(
      metrics,
      "massVolumeLog",
      `Mass volume (log scale) [${microMeterPower}]`,
    );
    addStatistic(
      metrics,
      "growthVolumeLog",
      `Growth volume (log scale) [${microMeterPower}]`,
    );
    addStatistic(
      metrics,
      "massDensity",
      `Mass density [μg/${microMeterPower}]`,
    );
    addStatistic(
      metrics,
      "growthDensity",
      `Growth density [μg/(${microMeterPower}·μs)]`,
    );
    addStatistic(metrics, "maxValue", "Peak value [cell-state]");
    addStatistic(metrics, "gyradius", "Gyradius [μm]");

    this.addSeparator(page);

    const motion = page.addFolder({
      title: "Position and Motion",
      expanded: false,
    });
    addStatistic(motion, "centreX", "Centroid X [μm]");
    addStatistic(motion, "centreY", "Centroid Y [μm]");
    addStatistic(motion, "growthCentreX", "Growth centroid X [μm]");
    addStatistic(motion, "growthCentreY", "Growth centroid Y [μm]");
    addStatistic(motion, "massGrowthDist", "Mass-growth distance [μm]");
    addStatistic(motion, "speed", "Speed [μm/μs]");
    addStatistic(motion, "centroidSpeed", "Centroid speed [μm/μs]");
    addStatistic(motion, "angle", "Direction angle [rad]");
    addStatistic(
      motion,
      "centroidRotateSpeed",
      "Centroid rotate speed [rad/μs]",
    );
    addStatistic(
      motion,
      "growthRotateSpeed",
      "Growth-centroid rotate speed [rad/μs]",
    );
    addStatistic(
      motion,
      "majorAxisRotateSpeed",
      "Major axis rotate speed [rad/μs]",
    );
    addStatistic(motion, "rotationSpeed", "Rotation speed [rad/μs]");

    this.addSeparator(page);

    const symmetry = page.addFolder({
      title: "Symmetry",
      expanded: false,
    });
    addStatistic(symmetry, "symmSides", "Symmetry order", formatInt);
    addStatistic(
      symmetry,
      "symmStrength",
      "Symmetry strength [%]",
      formatPercent,
    );
    addStatistic(symmetry, "massAsym", "Mass asymmetry [μg]");
    addStatistic(symmetry, "lyapunov", "Lyapunov exponent [gen⁻¹]");
    addStatistic(symmetry, "period", "Period [μs]");
    addStatistic(
      symmetry,
      "periodConfidence",
      "Period confidence [%]",
      formatPercent,
    );

    this.addSeparator(page);

    const invariants = page.addFolder({
      title: "Moment Invariants",
      expanded: false,
    });
    addStatistic(
      invariants,
      "hu1Log",
      "Moment of inertia - Hu's moment invariant 1 (log scale)",
    );
    addStatistic(
      invariants,
      "hu4Log",
      "Skewness - Hu's moment invariant 4 (log scale)",
    );
    addStatistic(invariants, "hu5Log", "Hu's 5 (log scale)");
    addStatistic(invariants, "hu6Log", "Hu's 6 (log scale)");
    addStatistic(invariants, "hu7Log", "Hu's 7 (log scale)");
    addStatistic(
      invariants,
      "flusser7",
      "Kurtosis - Flusser's moment invariant 7",
    );
    addStatistic(invariants, "flusser8Log", "Flusser's 8 (log scale)");
    addStatistic(invariants, "flusser9Log", "Flusser's 9 (log scale)");
    addStatistic(invariants, "flusser10Log", "Flusser's 10 (log scale)");
  }

  createMediaTab(page) {
    const { appcore } = this;
    const media = appcore?.media;

    const imp = page.addFolder({ title: "Import Data" });
    imp
      .addButton({
        title: this.withHint(
          "Import Parameters (JSON)",
          "importParams",
          "Ctrl+Shift+I",
        ),
      })
      .on("click", () => media?.importParamsJSON());
    imp
      .addButton({
        title: this.withHint("Import World (JSON)", "importWorld", "Ctrl+Shift+W"),
      })
      .on("click", () => media?.importWorldJSON());

    this.addSeparator(page);

    const exp = page.addFolder({ title: "Export Data" });
    exp
      .addButton({
        title: this.withHint(
          "Export Parameters (JSON)",
          "exportParams",
          "Ctrl+Shift+P",
        ),
      })
      .on("click", () => media?.exportParamsJSON());
    exp
      .addButton({
        title: this.withHint(
          "Export Statistics (JSON)",
          "exportStatisticsJson",
          "Ctrl+Shift+J",
        ),
      })
      .on("click", () => media?.exportStatisticsJSON());
    exp
      .addButton({
        title: this.withHint(
          "Export Statistics (CSV)",
          "exportStatisticsCsv",
          "Ctrl+Shift+K",
        ),
      })
      .on("click", () => media?.exportStatisticsCSV());
    exp
      .addButton({
        title: this.withHint("Export World (JSON)", "exportWorld", "Ctrl+Shift+E"),
      })
      .on("click", () => media?.exportWorldJSON());

    const capture = exp.addFolder({ title: "Media Capture" });

    capture.addBinding(this.params, "recordingFPS", {
      label: "Recording FPS [Hz]",
      min: 12,
      max: 120,
      step: 1,
    });

    capture.addBinding(this.params, "videoBitrateMbps", {
      label: "Video Bitrate [Mbps]",
      min: 1,
      max: 64,
      step: 0.5,
    });

    this.recordButton = capture.addButton({
      title: media?.isRecording
        ? this.withHint("⏹ Stop Recording", "record", "Ctrl+R")
        : this.withHint("⏺ Start Recording", "record", "Ctrl+R"),
    });

    this.recordButton.on("click", () => {
      if (!media) return;
      if (media.isRecording) {
        media.stopRecording();
      } else {
        media.startRecording();
      }
      this.syncMediaControls();
    });

    this.addSeparator(capture);

    capture.addBinding(this.params, "imageFormat", {
      label: "Image File Format",
      options: { PNG: "png", JPG: "jpg", WebP: "webp" },
    });

    capture
      .addButton({
        title: this.withHint("Export Image", "exportImage", "Ctrl+S"),
      })
      .on("click", () => media?.exportImage());
  }

  syncMediaControls() {
    if (!this.recordButton || !this.appcore || !this.appcore.media) return;
    this.recordButton.title = this.appcore.media.isRecording
      ? this.withHint("⏹ Stop Recording", "record", "Ctrl+R")
      : this.withHint("⏺ Start Recording", "record", "Ctrl+R");
  }
}

if (window.StatisticsGraph?.install) {
  window.StatisticsGraph.install(GUI);
}
