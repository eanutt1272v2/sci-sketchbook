class KeybindCatalogue {
  static _catalogue = Object.freeze({
    lenia: Object.freeze({
      sections: Object.freeze([
        {
          title: "Run Control",
          entries: Object.freeze([
            ["Space", "Pause / resume"],
            ["Enter", "Step once"],
            ["Del / Bksp", "Clear world"],
          ]),
        },
        {
          title: "Animals & World",
          entries: Object.freeze([
            ["`", "Cycle grid size"],
            ["Ctrl+D", "Cycle dimension (2D/3D/4D)"],
            ["Z", "Reload current animal at centre"],
            ["C / V", "Previous / next animal (Shift +/-10)"],
            ["X", "Place current animal at random"],
            ["Shift+X", "Toggle click-to-place mode"],
            ["Ctrl+[/]", "Place scale -/+ (auto-scales R, T)"],
            ["Ctrl+Shift+Z", "Reset R, T from animal"],
            ["N", "Random cells (Shift=seeded)"],
            ["M", "Random params (Shift=incremental)"],
            ["'", "Toggle auto-centre"],
          ]),
        },
        {
          title: "Parameters",
          entries: Object.freeze([
            ["Q / A", "Growth centre m +/- 0.001 (Shift +/-0.01)"],
            ["W / S", "Growth width s +/- 0.0001 (Shift +/-0.001)"],
            ["R / F", "Kernel radius R +/- 10 (Shift +/-1)"],
            ["T / G", "Time steps T x2 / /2 (Shift +/-1)"],
            ["E / D", "Quantise paramP +/- 10 (Shift +/-1)"],
            ["Ctrl+T / Ctrl+G", "Weight h +/- 0.1"],
            ["Y/U/I/O/P", "Kernel peaks b[0-4] +/- 1/12 (Shift -)"],
            [";", "Add peak (Shift=remove)"],
          ]),
        },
        {
          title: "Options",
          entries: Object.freeze([
            ["Ctrl+Y", "Cycle kernel core kn (Shift=reverse)"],
            ["Ctrl+U", "Cycle growth func gn (Shift=reverse)"],
            ["Ctrl+I", "Toggle soft clip (Shift=mask rate)"],
            ["Ctrl+O", "Cycle noise"],
            ["Ctrl+P", "Toggle Arita mode (Shift=reset mask+noise)"],
            ["Ctrl+M", "Toggle multi-step"],
          ]),
        },
        {
          title: "Transforms",
          entries: Object.freeze([
            ["Arrows", "Shift world +/-10 (Shift +/-1)"],
            ["R / F", "Zoom world +/-10 in every dimension (Shift +/-1)"],
            ["Ctrl+Left/Right", "Rotate +/-90 deg (Shift +/-15 deg)"],
            ["= / Shift+=", "Flip horiz / vert"],
            ["- (minus)", "Transpose"],
            ["PgUp/PgDn", "Move front/back (3D+, Shift small)"],
            ["Home/End", "Slice front/back (3D+, Shift small)"],
            ["Ctrl+Home", "Centre ND slice(s) (3D+)"],
            ["Ctrl+End", "Show Z slice / projection (3D+)"],
            ["Ctrl+Shift+Home", "Change Z axis (4D)"],
            ["Wheel / Shift+Wheel", "Slice active axis / other axis (3D+)"],
          ]),
        },
        {
          title: "Display",
          entries: Object.freeze([
            ["Tab", "Cycle render mode (Shift=reverse)"],
            [". / ,", "Next / prev colour map"],
            ["Ctrl+'", "Cycle polar mode"],
            ["' / Shift+'", "Auto-centre / auto-rotate"],
            ["H", "Hide / show GUI panel"],
            ["Ctrl+H", "Toggle stats overlay"],
            ["Ctrl+J", "Toggle symmetry overlay"],
            ["J", "Toggle motion overlay"],
            ["Ctrl+L", "Toggle trajectory overlay"],
            ["Ctrl+Shift+L", "Toggle mass->growth centroid link"],
            ["Ctrl+K", "Toggle periodogram mode"],
            ["Shift+J", "Toggle animal name"],
            ["K", "Toggle calc panels"],
            ["L", "Toggle legend"],
            ["B", "Toggle scale bar"],
            ["Shift+G", "Toggle grid"],
          ]),
        },
        {
          title: "Data",
          entries: Object.freeze([
            ["Ctrl+R", "Start / stop recording"],
            ["Ctrl+S", "Export image"],
            ["Ctrl+Shift+E", "Export world (JSON)"],
            ["Ctrl+Shift+W", "Import world (JSON)"],
            ["Ctrl+Shift+P / Ctrl+Shift+I", "Export / import params (JSON)"],
            ["Ctrl+Shift+J / Ctrl+Shift+K", "Export stats JSON / CSV"],
            ["#", "Toggle keymap reference"],
          ]),
        },
      ]),
      hints: Object.freeze({
        running: "Space",
        stepOnce: "Enter",
        clearWorld: "Del/Bksp",
        randomCells: "N",
        randomParams: "M",
        gridSize: "`",
        dimension: "Ctrl+D",
        ndView: "Ctrl+End",
        sliceZ: "Home/End",
        sliceW: "Shift+Scroll",
        moveFront: "PgUp (Shift small)",
        moveBack: "PgDn (Shift small)",
        moveFrontSmall: "Shift+PgUp",
        moveBackSmall: "Shift+PgDn",
        sliceFront: "Home (Shift small)",
        sliceBack: "End (Shift small)",
        sliceFrontSmall: "Shift+Home",
        sliceBackSmall: "Shift+End",
        centreSlice: "Ctrl+Home",
        showZSlice: "Ctrl+End",
        changeZAxis: "Ctrl+Shift+Home",
        shiftLeft: "Left",
        shiftRight: "Right",
        shiftUp: "Up",
        shiftDown: "Down",
        zoomInTransform: "R (Shift+R small)",
        zoomOutTransform: "F (Shift+F small)",
        rotateLeft: "Ctrl+Left",
        rotateRight: "Ctrl+Right",
        flipH: "=",
        flipV: "Shift+=",
        transpose: "-",
        growthCentre: "Q/A",
        growthWidth: "W/S",
        growthType: "Ctrl+U",
        radius: "R/F",
        kernelType: "Ctrl+Y",
        steps: "T/G",
        softClip: "Ctrl+I",
        multiStep: "Ctrl+M",
        aritaMode: "Ctrl+P",
        weight: "Ctrl+T/G",
        noise: "Ctrl+O",
        maskRate: "Ctrl+Shift+I",
        quantiseP: "E/D",
        colourMap: "./,",
        renderMode: "Tab",
        renderGrid: "Shift+G",
        renderScale: "B",
        renderLegend: "L",
        renderStats: "Ctrl+H",
        renderMotion: "J",
        renderSymmetry: "Ctrl+J",
        renderTrajectory: "Ctrl+L",
        renderMassGrowth: "Ctrl+Shift+L",
        renderPeriodogram: "Ctrl+K",
        renderCalc: "K",
        renderName: "Shift+J",
        autoCentre: "'",
        polarMode: "Ctrl+'",
        autoRotate: "Shift+'",
        prevAnimal: "C",
        nextAnimal: "V",
        reloadAnimalAtCentre: "Z",
        placeAnimalAtRandom: "X",
        placeMode: "Shift+X",
        placeScale: "Ctrl+[/]",
        resetAnimalParams: "Ctrl+Shift+Z",
        importParams: "Ctrl+Shift+I",
        importWorld: "Ctrl+Shift+W",
        exportParams: "Ctrl+Shift+P",
        exportStatsJson: "Ctrl+Shift+J",
        exportStatsCsv: "Ctrl+Shift+K",
        exportWorld: "Ctrl+Shift+E",
        record: "Ctrl+R",
        exportImage: "Ctrl+S",
      }),
    }),
    fluvia: Object.freeze({
      sections: Object.freeze([
        {
          title: "Simulation",
          entries: Object.freeze([
            ["Space / Enter / P", "Pause / resume simulation"],
            ["G / R", "Generate / reset terrain"],
            ["I / K", "Droplets per frame +/-"],
            ["Ctrl+U / Ctrl+J", "Max age +/- 16"],
            ["Ctrl+Y / Ctrl+H", "Min volume +/- 0.001"],
          ]),
        },
        {
          title: "Rendering",
          entries: Object.freeze([
            ["1 / 2", "Switch render method: 2D / 3D"],
            ["O / L", "Toggle statistics / legend overlays"],
            ["C", "Cycle colour map (Shift reverse)"],
            ["M", "Cycle surface map (Shift reverse)"],
            ["[ / ]", "Height scale -/+ (Shift large)"],
            ["Ctrl+1 / 2 / 3", "Terrain size 128 / 256 / 512 + regenerate"],
            ["Ctrl+[ / Ctrl+]", "Noise scale -/+ (Shift coarse)"],
            ["Ctrl+; / Ctrl+'", "Noise octaves -/+ 1"],
            ["Ctrl+, / Ctrl+.", "Specular intensity -/+ 10"],
          ]),
        },
        {
          title: "Camera",
          entries: Object.freeze([
            ["WASD / Arrow", "Orbit camera (3D mode)"],
            ["Q / E / - / +", "Zoom camera out / in (3D mode)"],
            ["Mouse Drag / Wheel", "Orbit / zoom camera"],
          ]),
        },
        {
          title: "Media",
          entries: Object.freeze([
            ["Ctrl+R", "Start / stop recording"],
            ["Ctrl+S", "Export image"],
            ["Ctrl+Shift+U", "Import heightmap"],
            ["Ctrl+Shift+I / Ctrl+Shift+P", "Import / export params (JSON)"],
            ["Ctrl+Shift+J / Ctrl+Shift+K", "Export stats JSON / CSV"],
            ["Ctrl+Shift+W / Ctrl+Shift+Q", "Export / import world state"],
          ]),
        },
        {
          title: "Reference",
          entries: Object.freeze([
            ["H", "Toggle GUI panel"],
            ["#", "Toggle keymap reference"],
          ]),
        },
      ]),
      hints: Object.freeze({
        running: "Space/Enter/P",
        generate: "G",
        reset: "R",
        droplets: "I/K",
        maxAge: "Ctrl+U/J",
        minVolume: "Ctrl+Y/H",
        renderMethod: "1/2",
        surfaceMap: "M",
        colourMap: "C",
        heightScale: "[/]",
        terrainSize: "Ctrl+1/2/3",
        noiseScale: "Ctrl+[/]",
        noiseOctaves: "Ctrl+;/'",
        specularIntensity: "Ctrl+,/.",
        overlayStats: "O",
        overlayLegend: "L",
        importHeightmap: "Ctrl+Shift+U",
        importParams: "Ctrl+Shift+I",
        importWorld: "Ctrl+Shift+Q",
        exportParams: "Ctrl+Shift+P",
        exportStats: "Ctrl+Shift+J",
        exportStatsCsv: "Ctrl+Shift+K",
        exportWorld: "Ctrl+Shift+W",
        record: "Ctrl+R",
        exportImage: "Ctrl+S",
      }),
    }),
    psi: Object.freeze({
      sections: Object.freeze([
        {
          title: "Quantum",
          entries: Object.freeze([
            ["W/S", "Increment/decrement n"],
            ["D/A", "Increment/decrement l"],
            ["E/Q", "Increment/decrement m"],
            ["R/T", "Nuclear charge Z +/- 1"],
            ["P", "Toggle reduced mass"],
            ["G/B", "log10 nucleus mass +/- 0.01"],
          ]),
        },
        {
          title: "View",
          entries: Object.freeze([
            ["1 / 2 / 3", "Switch plane: XY / XZ / YZ"],
            ["Z", "Reset view radius"],
            ["Space", "Reset slice offset"],
            ["X", "Reset view centre"],
            ["Arrow Keys", "Slice or zoom radius"],
            ["Shift+Arrow", "Pan in active plane"],
            ["Mouse Drag / Touch", "Pan view"],
            ["Wheel / Pinch", "Zoom radius"],
          ]),
        },
        {
          title: "Rendering",
          entries: Object.freeze([
            ["C", "Cycle colour map"],
            ["M", "Toggle pixel smoothing"],
            ["O", "Toggle overlay"],
            ["N", "Toggle detected node overlay"],
            ["L", "Toggle legend"],
            ["[ / ]", "Decrease / increase exposure"],
            ["- / +", "Decrease / increase resolution"],
            ["H", "Toggle GUI"],
          ]),
        },
        {
          title: "Data",
          entries: Object.freeze([
            ["Ctrl+R", "Start / stop recording"],
            ["Ctrl+S", "Export image"],
            ["Ctrl+Shift+I / Ctrl+Shift+P", "Import / export params (JSON)"],
            ["Ctrl+Shift+S / Ctrl+Shift+C", "Export stats JSON / CSV"],
          ]),
        },
        {
          title: "Reference",
          entries: Object.freeze([["#", "Toggle keymap reference"]]),
        },
      ]),
      hints: Object.freeze({
        quantumN: "W/S",
        quantumL: "D/A",
        quantumM: "E/Q",
        nuclearCharge: "R/T",
        reducedMass: "P",
        nucleusMass: "G/B",
        colourMap: "C",
        exposure: "[/]",
        resolution: "+/-",
        smoothing: "M",
        overlay: "O",
        nodeOverlay: "N",
        legend: "L",
        resetViewRadius: "Z",
        slicePlane: "1/2/3",
        resetSliceOffset: "Space",
        resetViewCentre: "X",
        importParams: "Ctrl+Shift+I",
        exportParams: "Ctrl+Shift+P",
        exportStats: "Ctrl+Shift+S",
        exportStatsCsv: "Ctrl+Shift+C",
        record: "Ctrl+R",
        exportImage: "Ctrl+S",
      }),
    }),
    cellular: Object.freeze({
      sections: Object.freeze([
        {
          title: "Simulation",
          entries: Object.freeze([
            ["H", "Toggle UI panels"],
            ["R", "Restart simulation"],
            ["Enter / P / Space", "Pause or play simulation"],
            ["#", "Toggle keymap reference"],
          ]),
        },
        {
          title: "Data",
          entries: Object.freeze([
            ["Ctrl+R", "Start / stop recording"],
            ["Ctrl+S", "Export image"],
            ["Ctrl+Shift+I / Ctrl+Shift+P", "Import / export params (JSON)"],
            ["Ctrl+Shift+J / Ctrl+Shift+K", "Export statistics JSON / CSV"],
            ["Ctrl+Shift+O / Ctrl+Shift+S", "Import / export state (JSON)"],
          ]),
        },
        {
          title: "Parameters",
          entries: Object.freeze([
            ["1 / 2", "Alpha a -/+"],
            ["3 / 4", "Beta b -/+"],
            ["5 / 6", "Gamma g -/+"],
            ["7 / 8", "Radius r -/+"],
            ["9 / 0", "Trail alpha t -/+"],
            ["- / =", "Density p -/+"],
            ["[ / ]", "Particles -/+ (restart to apply)"],
            ["Hold Shift", "Apply 10x change step"],
            ["Click value", "Start typing numeric input"],
            ["Enter / Esc", "Apply / cancel typed input"],
          ]),
        },
      ]),
      hints: Object.freeze({
        pause: "Enter/P/Space",
        alpha: "1/2",
        beta: "3/4",
        gamma: "5/6",
        radius: "7/8",
        trailAlpha: "9/0",
        density: "-/=",
        paramsImport: "Ctrl+Shift+I",
        paramsExport: "Ctrl+Shift+P",
        statsExportJson: "Ctrl+Shift+J",
        statsExportCsv: "Ctrl+Shift+K",
        stateImport: "Ctrl+Shift+O",
        stateExport: "Ctrl+Shift+S",
        record: "Ctrl+R",
        exportImage: "Ctrl+S",
      }),
    }),
  });

  static _cloneSections(sections) {
    return sections.map((section) => ({
      title: String(section.title || ""),
      entries: (section.entries || []).map((entry) => [
        String(entry?.[0] || ""),
        String(entry?.[1] || ""),
      ]),
    }));
  }

  static getSections(sketchId) {
    const sketch =
      KeybindCatalogue._catalogue[String(sketchId || "").toLowerCase()];
    if (!sketch || !Array.isArray(sketch.sections)) return [];
    return KeybindCatalogue._cloneSections(sketch.sections);
  }

  static getHint(sketchId, hintId, fallback = "") {
    const sketch =
      KeybindCatalogue._catalogue[String(sketchId || "").toLowerCase()];
    const hints = sketch?.hints || null;
    if (!hints) return fallback;

    const key = String(hintId || "");
    if (Object.prototype.hasOwnProperty.call(hints, key)) {
      const value = hints[key];
      return typeof value === "string" ? value : fallback;
    }

    return fallback;
  }

  static withHint(baseLabel, sketchId, hintId, fallback = "") {
    const label = String(baseLabel || "");
    const hint = KeybindCatalogue.getHint(sketchId, hintId, fallback);
    return hint ? `${label} (${hint})` : label;
  }
}

window.KeybindCatalogue = KeybindCatalogue;
