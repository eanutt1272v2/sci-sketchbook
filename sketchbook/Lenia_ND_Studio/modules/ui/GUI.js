class GUI {
  constructor(
    params,
    statistics,
    renderData,
    metadata,
    animalLibrary = null,
    appcore = null,
  ) {
    this.params = params;
    this.statistics = statistics;
    this.renderData = renderData;
    this.metadata = metadata;
    this.animalLibrary = animalLibrary;
    this.appcore = appcore;
    this.pane = null;
    this.animalBinding = null;
    this._animalMenuState = null;
    this._lastAnimalSelection = String(this.params?.selectedAnimal || "");
    this.recordButton = null;
    this.placeScaleBinding = null;
    this.ndSliceZBinding = null;
    this.ndSliceWBinding = null;
    this._statsGraphWrapper = null;
    this._statsGraphCanvas = null;
    this._statsGraphCaption = null;
    this._statsGraphRaf = 0;
    this._statsGraphLastFrameMs = 0;
    this._statsGraphScratch = null;
    this._statsGraphLayers = null;
  }

  rebuildPane() {
    if (this._rebuildScheduled) return;
    this._rebuildScheduled = true;
    Promise.resolve().then(() => {
      this._rebuildScheduled = false;
      if (typeof this._teardownStatsGraph === "function") {
        this._teardownStatsGraph();
      }
      if (this.pane) {
        this.pane.dispose();
      }
      this.pane = null;
      this.animalBinding = null;
      this.recordButton = null;
      this.placeScaleBinding = null;
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
        { title: "Animals" },
        { title: "Statistics" },
        { title: "Media" },
      ],
    });

    this.createSimulationTab(tabs.pages[0]);
    this.createParametersTab(tabs.pages[1]);
    this.createAnimalsTab(tabs.pages[3]);
    this.createRenderTab(tabs.pages[2]);
    this.createStatisticsTab(tabs.pages[4]);
    this.createMediaTab(tabs.pages[5]);
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

  _runIfGUIIdle(fn) {
    if (!this.appcore) return;
    if (this.appcore._isRefreshingGUI) return;
    fn();
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
      .on("click", () => this.appcore?.nudgeRadius(10));
    xform
      .addButton({
        title: this.withHint("Zoom Out", "zoomOutTransform", "F"),
      })
      .on("click", () => this.appcore?.nudgeRadius(-10));

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
          title: this.withHint("Centre Slice", "centerSlice", "Ctrl+Home"),
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
      label: this.withHint("Arita Mode", "aritaMode", "Ctrl+P"),
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
    overlay.addBinding(params, "renderAnimalName", {
      label: this.withHint("Toggle Animal Name", "renderName", "Shift+J"),
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

  createAnimalsTab(page) {
    const { params } = this;
    const sourceDimension =
      this.animalLibrary && Number.isFinite(this.animalLibrary.activeDimension)
        ? this.animalLibrary.activeDimension
        : params.dimension;
    const animalCount = Array.isArray(this.animalLibrary?.animals)
      ? this.animalLibrary.animals.length
      : 0;
    const options = this.animalLibrary
      ? this.animalLibrary.getHierarchicalAnimalMenu()
      : {};

    const currentSelection = String(params.selectedAnimal || "");
    const currentAnimalToken = this.animalLibrary
      ? this.animalLibrary.toAnimalMenuValue(currentSelection)
      : currentSelection;
    const firstAnimalToken = this.animalLibrary
      ? this.animalLibrary.getFirstAnimalMenuValue()
      : "";
    const optionValues = new Set(Object.values(options));
    const initialMenuValue = optionValues.has(currentAnimalToken)
      ? currentAnimalToken
      : optionValues.has(firstAnimalToken)
        ? firstAnimalToken
        : currentAnimalToken;

    this._animalMenuState = {
      selectedAnimalMenu: initialMenuValue,
    };

    this.animalBinding = page.addBinding(
      this._animalMenuState,
      "selectedAnimalMenu",
      {
        label: `Selected Animal (${animalCount} × ${sourceDimension}D)`,
        options,
      },
    );
    this.animalBinding.on("change", (event) => {
      const idx = this.animalLibrary
        ? this.animalLibrary.parseAnimalMenuValue(event.value)
        : parseInt(String(event.value), 10);

      if (!Number.isFinite(idx) || idx < 0) {
        const fallback = this.animalLibrary
          ? this.animalLibrary.toAnimalMenuValue(params.selectedAnimal)
          : String(params.selectedAnimal || "");
        this._animalMenuState.selectedAnimalMenu = fallback;
        this.animalBinding?.refresh?.();
        return;
      }

      const nextSelection = String(idx);
      this._lastAnimalSelection = nextSelection;

      const selected = this.appcore?.selectAnimalByIndex
        ? this.appcore.selectAnimalByIndex(idx, {
            preserveScaleFactor: true,
          })
        : false;

      if (selected) return;

      if (params.selectedAnimal === nextSelection) return;
      params.selectedAnimal = nextSelection;
      this.appcore?.loadSelectedAnimalParams();
      this.appcore?.loadSelectedAnimal();
    });

    page
      .addButton({
        title: this.withHint("◀ Previous", "prevAnimal", "C"),
      })
      .on("click", () => this.appcore?.cycleAnimal(-1));
    page
      .addButton({
        title: this.withHint("▶ Next", "nextAnimal", "V"),
      })
      .on("click", () => this.appcore?.cycleAnimal(1));
    page
      .addButton({
        title: this.withHint("Reload at Centre", "reloadAnimalAtCentre", "Z"),
      })
      .on("click", () => this.appcore?.loadSelectedAnimal());
    page
      .addButton({
        title: this.withHint("Place at Random", "placeRandom", "X"),
      })
      .on("click", () => this.appcore?.placeAnimalRandom());

    this.addSeparator(page);

    const placementFolder = page.addFolder({
      title: "Placement",
      expanded: true,
    });

    placementFolder.addBinding(params, "placeMode", {
      label: this.withHint("Click to Place", "placeMode", "Shift+X"),
    });

    const placementScaleBounds = this.appcore?.getPlacementScaleBounds
      ? this.appcore.getPlacementScaleBounds(params.selectedAnimal)
      : { min: 0.25, max: 4 };

    this.placeScaleBinding = placementFolder
      .addBinding(params, "placeScale", {
        label: this.withHint("Placement Scale", "placeScale", "Ctrl+[/]"),
        min: placementScaleBounds.min,
        max: placementScaleBounds.max,
        step: 0.05,
      })
      .on("change", () => {
        if (!this.appcore) return;
        this.appcore.updatePlacementScale(params.placeScale);
      });

    placementFolder
      .addButton({
        title: this.withHint(
          "Reset Animal Parameters",
          "resetAnimalParams",
          "Ctrl+Shift+Z",
        ),
      })
      .on("click", () => {
        if (!this.appcore) return;
        this.appcore.applySelectedAnimalParams({ refreshGUI: true });
      });
  }

  syncPlacementScaleBounds() {
    if (!this.appcore || !this.placeScaleBinding) return;
    if (typeof this.appcore.getPlacementScaleBounds !== "function") return;

    const bounds = this.appcore.getPlacementScaleBounds(
      this.params.selectedAnimal,
    );
    this.placeScaleBinding.min = bounds.min;
    this.placeScaleBinding.max = bounds.max;
    this.params.placeScale = constrain(
      Number(this.params.placeScale) || 1,
      bounds.min,
      bounds.max,
    );
  }

  syncAnimalSelectors() {
    if (this.animalBinding && this._animalMenuState && this.animalLibrary) {
      const token = this.animalLibrary.toAnimalMenuValue(
        this.params.selectedAnimal,
      );
      if (token && this._animalMenuState.selectedAnimalMenu !== token) {
        this._animalMenuState.selectedAnimalMenu = token;
        this.animalBinding.refresh?.();
      }
    }

    this.syncPlacementScaleBounds();
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

  dispose() {
    if (typeof this._teardownStatsGraph === "function") {
      this._teardownStatsGraph();
    }
    if (this.pane) {
      this.pane.dispose();
      this.pane = null;
      this.animalBinding = null;
      this.recordButton = null;
      this.ndSliceZBinding = null;
      this.ndSliceWBinding = null;
    }
  }

  createStatisticsTab(page) {
    const { statistics, params } = this;
    const formatSigned = FormatUtils.formatSigned;
    const formatPercent = FormatUtils.formatPercent;
    const formatInt = FormatUtils.formatInt;
    const superscriptDigits = {
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
    };
    const dimension = Math.max(2, Math.floor(Number(params?.dimension) || 2));
    const dimPower = String(dimension)
      .split("")
      .map((char) => superscriptDigits[char] || char)
      .join("");
    const microMeterPower = `μm${dimPower}`;
    const addStat = (folder, key, label, format = formatSigned) =>
      folder.addBinding(statistics, key, {
        readonly: true,
        label,
        format,
      });
    const refreshSpectralAnalysis = () => {
      this.appcore?.analyser?.updatePeriodogram?.(params, 10, true);
      this._renderStatsGraph();
    };

    const statsAxisOptions = this.appcore
      ? this.appcore.getStatAxisOptions()
      : { m: "m", g: "g", x: "x", y: "y" };

    const overlays = page.addFolder({
      title: "Statistics Overlay",
      expanded: true,
    });

    overlays.addBinding(params, "renderStats", {
      label: this.withHint(
        "Toggle Statistics Overlay",
        "renderStats",
        "Ctrl+H",
      ),
    });

    this.addSeparator(page);

    const graphs = page.addFolder({
      title: "Graphs and Modes",
      expanded: true,
    });

    graphs
      .addBinding(params, "statsMode", {
        label: this.withHint("Graph Mode", "statsMode", "Alt+J"),
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
        options: statsAxisOptions,
      })
      .on("change", refreshSpectralAnalysis);

    graphs
      .addBinding(params, "graphY", {
        label: this.withHint("Graph Y axis", "graphYAxis", "Alt+L"),
        options: statsAxisOptions,
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
      .on("change", () => this._renderStatsGraph());

    this._mountStatsGraph(graphs);

    this.addSeparator(page);

    const segments = page.addFolder({
      title: "Segments and Grouping",
      expanded: false,
    });

    segments.addBinding(params, "statsTrimSegment", {
      label: "Segment Length",
      options: {
        Unlimited: 0,
        Short: 1,
        Long: 2,
      },
    });

    segments.addBinding(params, "statsGroupByParams", {
      label: "Group by Parameters",
    });

    this.addSeparator(segments);

    segments
      .addButton({ title: "Start New Segment" })
      .on("click", () => this.appcore?.startStatsSegment());
    segments
      .addButton({ title: "Clear Current Segment" })
      .on("click", () => this.appcore?.clearCurrentStatsSegment());
    segments
      .addButton({ title: "Clear All Segments" })
      .on("click", () => this.appcore?.clearAllStatsSegments());

    this.addSeparator(page);

    const metrics = page.addFolder({ title: "Basic Metrics", expanded: true });
    addStat(metrics, "gen", "Generation [gen]", formatInt);
    addStat(metrics, "time", "Time [μs]");
    addStat(metrics, "fps", "FPS [Hz]");
    addStat(metrics, "mass", "Mass [μg]");
    addStat(metrics, "growth", "Growth [μg/μs]");
    addStat(metrics, "massLog", "Mass (log scale) [μg]");
    addStat(metrics, "growthLog", "Growth (log scale) [μg/μs]");
    addStat(
      metrics,
      "massVolumeLog",
      `Mass volume (log scale) [${microMeterPower}]`,
    );
    addStat(
      metrics,
      "growthVolumeLog",
      `Growth volume (log scale) [${microMeterPower}]`,
    );
    addStat(metrics, "massDensity", `Mass density [μg/${microMeterPower}]`);
    addStat(
      metrics,
      "growthDensity",
      `Growth density [μg/(${microMeterPower}·μs)]`,
    );
    addStat(metrics, "maxValue", "Peak value [cell-state]");
    addStat(metrics, "gyradius", "Gyradius [μm]");

    this.addSeparator(page);

    const motion = page.addFolder({
      title: "Position and Motion",
      expanded: false,
    });
    addStat(motion, "centreX", "Centroid X [μm]");
    addStat(motion, "centreY", "Centroid Y [μm]");
    addStat(motion, "growthCentreX", "Growth centroid X [μm]");
    addStat(motion, "growthCentreY", "Growth centroid Y [μm]");
    addStat(motion, "massGrowthDist", "Mass-growth distance [μm]");
    addStat(motion, "speed", "Speed [μm/μs]");
    addStat(motion, "centroidSpeed", "Centroid speed [μm/μs]");
    addStat(motion, "angle", "Direction angle [rad]");
    addStat(motion, "centroidRotateSpeed", "Centroid rotate speed [rad/μs]");
    addStat(
      motion,
      "growthRotateSpeed",
      "Growth-centroid rotate speed [rad/μs]",
    );
    addStat(motion, "majorAxisRotateSpeed", "Major axis rotate speed [rad/μs]");
    addStat(motion, "rotationSpeed", "Rotation speed [rad/μs]");

    this.addSeparator(page);

    const symmetry = page.addFolder({
      title: "Symmetry",
      expanded: false,
    });
    addStat(symmetry, "symmSides", "Symmetry order", formatInt);
    addStat(symmetry, "symmStrength", "Symmetry strength [%]", formatPercent);
    addStat(symmetry, "massAsym", "Mass asymmetry [μg]");
    addStat(symmetry, "lyapunov", "Lyapunov exponent [gen⁻¹]");
    addStat(symmetry, "period", "Period [μs]");
    addStat(
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
    addStat(
      invariants,
      "hu1Log",
      "Moment of inertia - Hu's moment invariant 1 (log scale)",
    );
    addStat(
      invariants,
      "hu4Log",
      "Skewness - Hu's moment invariant 4 (log scale)",
    );
    addStat(invariants, "hu5Log", "Hu's 5 (log scale)");
    addStat(invariants, "hu6Log", "Hu's 6 (log scale)");
    addStat(invariants, "hu7Log", "Hu's 7 (log scale)");
    addStat(invariants, "flusser7", "Kurtosis - Flusser's moment invariant 7");
    addStat(invariants, "flusser8Log", "Flusser's 8 (log scale)");
    addStat(invariants, "flusser9Log", "Flusser's 9 (log scale)");
    addStat(invariants, "flusser10Log", "Flusser's 10 (log scale)");
  }

  createMediaTab(page) {
    const { appcore } = this;
    const media = appcore?.media;

    const imp = page.addFolder({ title: "Import Data" });
    imp
      .addButton({
        title: this.withHint(
          "Import Parameters",
          "importParams",
          "Ctrl+Shift+I",
        ),
      })
      .on("click", () => media?.importParamsJSON());
    imp
      .addButton({
        title: this.withHint("Import World", "importWorld", "Ctrl+Shift+W"),
      })
      .on("click", () => media?.importWorldJSON());

    this.addSeparator(page);

    const exp = page.addFolder({ title: "Export Data" });
    exp
      .addButton({
        title: this.withHint(
          "Export Parameters",
          "exportParams",
          "Ctrl+Shift+P",
        ),
      })
      .on("click", () => media?.exportParamsJSON());
    exp
      .addButton({
        title: this.withHint(
          "Export Statistics (JSON)",
          "exportStatsJson",
          "Ctrl+Shift+J",
        ),
      })
      .on("click", () => media?.exportStatisticsJSON());
    exp
      .addButton({
        title: this.withHint(
          "Export Statistics (CSV)",
          "exportStatsCsv",
          "Ctrl+Shift+K",
        ),
      })
      .on("click", () => media?.exportStatisticsCSV());
    exp
      .addButton({
        title: this.withHint("Export World", "exportWorld", "Ctrl+Shift+E"),
      })
      .on("click", () => media?.exportWorldJSON());

    const capture = exp.addFolder({ title: "Video Capture" });

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

if (window.StatsGraphComponent?.install) {
  window.StatsGraphComponent.install(GUI);
}
