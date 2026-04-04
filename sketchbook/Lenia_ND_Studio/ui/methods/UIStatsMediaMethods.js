class StatsMediaMethods {
  createStatisticsTab(page) {
    const { statistics, params } = this;
    const formatSigned = FormatUtils.formatSigned;
    const formatPercent = FormatUtils.formatPercent;
    const formatInt = FormatUtils.formatInt;
    const addStat = (folder, key, label, format = formatSigned) =>
      folder.addBinding(statistics, key, {
        readonly: true,
        label,
        format,
      });

    const statsAxisOptions = this.appcore
      ? this.appcore.getStatAxisOptions()
      : { m: "m", g: "g", x: "x", y: "y" };

    const display = page.addFolder({
      title: "Display & Modes",
      expanded: true,
    });

    display.addBinding(params, "renderStats", {
      label: this.withHint("Statistics Data Overlay", "renderStats", "Ctrl+H"),
    });

    const analysisOverlays = page.addFolder({ title: "Analysis Overlays" });

    analysisOverlays.addBinding(params, "renderMotionOverlay", {
      label: this.withHint("Motion Overlay", "renderMotion", "J"),
    });
    analysisOverlays.addBinding(params, "renderTrajectoryOverlay", {
      label: this.withHint("Trajectory Overlay", "renderTrajectory", "Ctrl+L"),
    });
    analysisOverlays.addBinding(params, "renderMassGrowthOverlay", {
      label: this.withHint(
        "Mass->Growth Centroid Link",
        "renderMassGrowth",
        "Ctrl+Shift+L",
      ),
    });

    display
      .addBinding(params, "statsMode", {
        label: this.withHint("Show Stats", "statsMode", "Alt+J"),
        options: {
          None: 0,
          "Corner Graph": 1,
          "Overlay Graph": 2,
          "Segment Graph": 3,
          "All Segments Graph": 4,
          Periodogram: 5,
          "Recurrence Plot": 6,
        },
      })
      .on("change", () => {
        this.appcore?.analyser?.updatePeriodogram?.(params, 10, true);
      });

    display
      .addBinding(params, "statsX", {
        label: this.withHint("Stats X axis", "statsXAxis", "Alt+K"),
        options: statsAxisOptions,
      })
      .on("change", () =>
        this.appcore?.analyser?.updatePeriodogram?.(params, 10, true),
      );

    display
      .addBinding(params, "statsY", {
        label: this.withHint("Stats Y axis", "statsYAxis", "Alt+L"),
        options: statsAxisOptions,
      })
      .on("change", () =>
        this.appcore?.analyser?.updatePeriodogram?.(params, 10, true),
      );

    display.addBinding(params, "statsTrimSegment", {
      label: "Segment Length",
      options: {
        Unlimited: 0,
        Short: 1,
        Long: 2,
      },
    });

    display.addBinding(params, "statsGroupByParams", {
      label: "Group by Params",
    });

    display
      .addBinding(params, "periodogramUseWelch", {
        label: "Periodogram Method (Welch)",
      })
      .on("change", () =>
        this.appcore?.analyser?.updatePeriodogram?.(params, 10, true),
      );

    display.addBinding(params, "recurrenceThreshold", {
      label: "Recurrence Threshold",
      min: 0.05,
      max: 1.5,
      step: 0.01,
    });

    const segments = page.addFolder({ title: "Segment Management" });

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

    const metrics = page.addFolder({ title: "Basic Metrics" });
    addStat(metrics, "gen", "Generation [gen]", formatInt);
    addStat(metrics, "time", "Time [μs]");
    addStat(metrics, "mass", "Mass [μg]");
    addStat(metrics, "growth", "Growth [μg/μs]");
    addStat(metrics, "massLog", "Mass (log scale) [μg]");
    addStat(metrics, "growthLog", "Growth (log scale) [μg/μs]");
    addStat(metrics, "massVolumeLog", "Mass volume (log scale) [μm^D]");
    addStat(metrics, "growthVolumeLog", "Growth volume (log scale) [μm^D]");
    addStat(metrics, "massDensity", "Mass density [μg/μm^D]");
    addStat(metrics, "growthDensity", "Growth density [μg/(μm^D·μs)]");
    addStat(metrics, "maxValue", "Peak value [cell-state]");
    addStat(metrics, "gyradius", "Gyradius [μm]");

    this.addSeparator(page);

    const motion = page.addFolder({ title: "Position & Motion" });
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

    const symmetry = page.addFolder({ title: "Symmetry" });
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

    const invariants = page.addFolder({ title: "Moment Invariants" });
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

    this.addSeparator(page);

    addStat(metrics, "fps", "FPS [Hz]");
  }

  createMediaTab(page) {
    const { statistics, appcore } = this;
    const media = appcore?.media;
    const analyser = appcore?.analyser;

    const imp = page.addFolder({ title: "Import" });
    imp
      .addButton({
        title: this.withHint("Import Params", "importParams", "Ctrl+Shift+I"),
      })
      .on("click", () => media?.importParamsJSON());
    imp
      .addButton({
        title: this.withHint("Import World", "importWorld", "Ctrl+Shift+W"),
      })
      .on("click", () => media?.importWorldJSON());

    this.addSeparator(page);

    const exp = page.addFolder({ title: "Export" });
    exp
      .addButton({
        title: this.withHint("Export Params", "exportParams", "Ctrl+Shift+P"),
      })
      .on("click", () => media?.exportParamsJSON());
    exp
      .addButton({
        title: this.withHint(
          "Export Stats (JSON)",
          "exportStatsJson",
          "Ctrl+Shift+J",
        ),
      })
      .on("click", () => media?.exportStatisticsJSON());
    exp
      .addButton({
        title: this.withHint(
          "Export Stats (CSV)",
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

    const capture = exp.addFolder({ title: "Capture" });

    capture.addBinding(this.params, "recordingFPS", {
      label: "Record FPS [Hz]",
      min: 12,
      max: 120,
      step: 1,
    });

    capture.addBinding(this.params, "videoBitrateMbps", {
      label: "Bitrate [Mbps]",
      min: 1,
      max: 64,
      step: 0.5,
    });

    this.recordButton = capture.addButton({
      title: media?.isRecording
        ? this.withHint("⏹ Stop", "record", "Ctrl+R")
        : this.withHint("⏺ Record", "record", "Ctrl+R"),
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
      label: "Image Format",
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
      ? this.withHint("⏹ Stop", "record", "Ctrl+R")
      : this.withHint("⏺ Record", "record", "Ctrl+R");
  }
}

for (const name of Object.getOwnPropertyNames(StatsMediaMethods.prototype)) {
  if (name === "constructor") continue;
  GUI.prototype[name] = StatsMediaMethods.prototype[name];
}
