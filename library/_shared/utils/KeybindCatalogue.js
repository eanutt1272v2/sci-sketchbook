class KeybindCatalogue {
  static _catalogue = Object.freeze({
    lenia: Object.freeze({
      sections: Object.freeze([
        {
          title: "Run Control",
          entries: Object.freeze([
            ["Space", "Pause / resume"],
            ["Enter", "Step once"],
            ["Del / Backspace", "Clear world"],
          ]),
        },
        {
          title: "Solitons & World",
          entries: Object.freeze([
            ["`", "Cycle grid size"],
            ["Ctrl+D", "Cycle dimension (2D/3D/4D)"],
            ["Z", "Reload current soliton at centre"],
            [
              "C / V",
              "Previous / next soliton (Shift +/-10, keep current R/F zoom)",
            ],
            ["X", "Place current soliton at random"],
            ["Shift+X", "Toggle click-to-place mode"],
            ["Ctrl+Shift+Z", "Reset R, T from soliton"],
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
            ["R / F", "Kernel radius R +/- 5 (Shift +/-1)"],
            ["T / G", "Time steps T x2 / /2 (Shift +/-1)"],
            ["E / D", "Quantise paramP +/- 10 (Shift +/-1)"],
            ["Ctrl+T / Ctrl+G", "Weight h +/- 0.1"],
            ["Ctrl+9 / Ctrl+0", "Active channel -/+"],
            ["Ctrl+- / Ctrl+=", "Active kernel -/+"],
            ["Y/U/I/O/P", "Kernel peaks b[0-4] +/- 1/12 (Shift -)"],
            [";", "Add peak (Shift=remove)"],
          ]),
        },
        {
          title: "Options",
          entries: Object.freeze([
            ["Ctrl+B", "Cycle backend compute device (CPU/WebGPU)"],
            ["Ctrl+Y", "Cycle kernel core kn (Shift=reverse)"],
            ["Ctrl+U", "Cycle growth func gn (Shift=reverse)"],
            ["Ctrl+I", "Toggle soft clip (Shift=mask rate)"],
            ["Ctrl+O", "Cycle noise"],
            [
              "Ctrl+P",
              "Toggle asymptotic update (Arita) (Shift=reset mask+noise)",
            ],
            ["Ctrl+M", "Toggle multi-step"],
          ]),
        },
        {
          title: "Transforms",
          entries: Object.freeze([
            ["Arrows", "Shift world +/-10 (Shift +/-1)"],
            ["R / F", "Zoom world +/-5 in every dimension (Shift +/-1)"],
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
            ["Alt+. / Alt+,", "Shift multi-channel colour mapping"],
            ["Ctrl+'", "Cycle polar mode"],
            ["' / Shift+'", "Auto-centre / auto-rotate"],
            ["H", "Hide / show GUI panel"],
            ["Ctrl+H", "Toggle statistics overlay"],
            ["Ctrl+J", "Toggle symmetry overlay"],
            ["J", "Toggle motion overlay"],
            ["Ctrl+L", "Toggle trajectory overlay"],
            ["Ctrl+Shift+L", "Toggle mass->growth centroid link"],
            ["Ctrl+K", "Toggle periodogram mode"],
            ["Alt+J / Alt+K / Alt+L", "Cycle graph mode / X axis / Y axis"],
            ["Alt+Ctrl+N", "Start statistics segment"],
            ["Alt+Ctrl+J", "Clear current segment (Shift=all)"],
            ["Shift+J", "Toggle soliton name"],
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
            ["Ctrl+Shift+J / Ctrl+Shift+K", "Export statistics JSON / CSV"],
            ["#", "Toggle keymap reference"],
          ]),
        },
      ]),
      hints: Object.freeze({
        running: "Space",
        stepOnce: "Enter",
        clearWorld: "Del/Backspace",
        randomCells: "N",
        randomParams: "M",
        latticeExtent: "`",
        dimension: "Ctrl+D",
        ndView: "Ctrl+End",
        sliceZ: "Home/End",
        sliceW: "Shift+Scroll",
        moveFront: "PgUp (Shift small)",
        moveBack: "PgDn (Shift small)",
        moveFrontSmall: "Shift+PgUp",
        moveBackSmall: "Shift+PgDn",
        viewDepth: "PgUp/PgDn",
        sliceFront: "Home (Shift small)",
        sliceBack: "End (Shift small)",
        sliceFrontSmall: "Shift+Home",
        sliceBackSmall: "Shift+End",
        sliceOffset: "Home/End",
        centreSlice: "Ctrl+Home",
        showZSlice: "Ctrl+End",
        toggleSliceView: "Ctrl+End",
        changeZAxis: "Ctrl+Shift+Home",
        cycleSliceAxis: "Ctrl+Shift+Home",
        shiftLeft: "←",
        shiftRight: "→",
        shiftUp: "↑",
        shiftDown: "↓",
        shiftX: "←/→",
        shiftY: "↑/↓",
        zoomInTransform: "R (Shift+R small)",
        zoomOutTransform: "F (Shift+F small)",
        rotateLeft: "Ctrl+←",
        rotateRight: "Ctrl+→",
        rotate: "Ctrl+←/→",
        flipH: "=",
        flipV: "Shift+=",
        flipX: "=/Shift+=",
        transpose: "-",
        flipY: "-",
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
        channelCount: "GUI",
        selectedChannel: "Ctrl+9/0",
        selectedKernel: "Ctrl+-/=",
        kernelCount: "GUI",
        crossKernelCount: "GUI",
        backendComputeDevice: "Ctrl+B",
        channelShift: "Alt+./,",
        noise: "Ctrl+O",
        maskRate: "Ctrl+Shift+I",
        quantiseP: "E/D",
        colourMap: "./,",
        renderMode: "Tab",
        renderGrid: "Shift+G",
        renderScale: "B",
        scale: "B",
        renderLegend: "L",
        legend: "L",
        renderStatistics: "Ctrl+H",
        renderMotion: "J",
        motionOverlay: "J",
        renderSymmetry: "Ctrl+J",
        renderTrajectory: "Ctrl+L",
        trajectory: "Ctrl+L",
        renderMassGrowth: "Ctrl+Shift+L",
        massGrowthOverlay: "Ctrl+Shift+L",
        renderPeriodogram: "Ctrl+K",
        periodogram: "Ctrl+K",
        statisticsMode: "Alt+J",
        graphXAxis: "Alt+K",
        graphYAxis: "Alt+L",
        startStatisticsSegment: "Alt+Ctrl+N",
        segmentAdd: "Alt+Ctrl+N",
        clearStatisticsSegment: "Alt+Ctrl+J",
        segmentClear: "Alt+Ctrl+J",
        renderCalc: "K",
        calcPanels: "K",
        renderName: "Shift+J",
        solitonName: "Shift+J",
        toggleGUI: "H",
        peakY: "Y",
        peakU: "U",
        peakI: "I",
        peakO: "O",
        peakP: "P",
        peakCount: ";",
        autoCentre: "'",
        polarMode: "Ctrl+'",
        autoRotate: "Shift+'",
        prevSoliton: "C",
        previousSoliton: "C",
        nextSoliton: "V",
        reloadSolitonAtCentre: "Z",
        loadSoliton: "Z",
        placeSolitonAtRandom: "X",
        placeMode: "Shift+X",
        resetSolitonParams: "Ctrl+Shift+Z",
        applySolitonParams: "Ctrl+Shift+Z",
        randomiseWorld: "N",
        randomSeed: "Shift+N",
        randomiseRules: "M",
        randomiseRulesMutation: "Shift+M",
        gridSize: "`",
        importParams: "Ctrl+Shift+I",
        importWorld: "Ctrl+Shift+W",
        exportParams: "Ctrl+Shift+P",
        exportStatisticsJson: "Ctrl+Shift+J",
        exportStatisticsCsv: "Ctrl+Shift+K",
        exportWorld: "Ctrl+Shift+E",
        record: "Ctrl+R",
        exportImage: "Ctrl+S",
        keymapReference: "#",
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
            ["Ctrl+Shift+J / Ctrl+Shift+K", "Export statistics JSON / CSV"],
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
        overlayStatistics: "O",
        overlayLegend: "L",
        importHeightmap: "Ctrl+Shift+U",
        importParams: "Ctrl+Shift+I",
        importWorld: "Ctrl+Shift+Q",
        exportParams: "Ctrl+Shift+P",
        exportStatistics: "Ctrl+Shift+J",
        exportStatisticsCsv: "Ctrl+Shift+K",
        exportWorld: "Ctrl+Shift+W",
        toggleGUI: "H",
        orbitLeft: "A/←",
        orbitRight: "D/→",
        orbitUp: "W/↑",
        orbitDown: "S/↓",
        zoomOutCamera: "Q/-",
        zoomInCamera: "E/+",
        record: "Ctrl+R",
        exportImage: "Ctrl+S",
        keymapReference: "#",
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
            ["I / K", "Decrease / increase view radius"],
            ["Shift+J / Shift+L", "Decrease / increase slice offset"],
            ["Shift+A / Shift+D", "Pan X -/+"],
            ["Shift+W / Shift+S", "Pan Y -/+"],
            ["Shift+Q / Shift+E", "Pan Z -/+"],
            ["Arrow Keys", "Left/right slice offset, up/down view radius"],
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
            ["Ctrl+Shift+S / Ctrl+Shift+C", "Export statistics JSON / CSV"],
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
        toggleGUI: "H",
        viewRadius: "I/K",
        sliceOffset: "Shift+J/L",
        panX: "Shift+A/D",
        panY: "Shift+W/S",
        panZ: "Shift+Q/E",
        resetViewRadius: "Z",
        slicePlane: "1/2/3",
        resetSliceOffset: "Space",
        resetViewCentre: "X",
        importParams: "Ctrl+Shift+I",
        exportParams: "Ctrl+Shift+P",
        exportStatistics: "Ctrl+Shift+S",
        exportStatisticsCsv: "Ctrl+Shift+C",
        record: "Ctrl+R",
        exportImage: "Ctrl+S",
        keymapReference: "#",
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
        restart: "R",
        toggleUI: "H",
        alpha: "1/2",
        beta: "3/4",
        gamma: "5/6",
        radius: "7/8",
        trailAlpha: "9/0",
        density: "-/=",
        particleCount: "[/]",
        paramsImport: "Ctrl+Shift+I",
        paramsExport: "Ctrl+Shift+P",
        statisticsExportJson: "Ctrl+Shift+J",
        statisticsExportCsv: "Ctrl+Shift+K",
        stateImport: "Ctrl+Shift+O",
        stateExport: "Ctrl+Shift+S",
        record: "Ctrl+R",
        exportImage: "Ctrl+S",
        keymapReference: "#",
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

  static _comboCache = new Map();

  static _modAlias(token) {
    const normalised = String(token || "")
      .trim()
      .toLowerCase();
    if (!normalised) return "";
    if (normalised === "control") return "ctrl";
    if (normalised === "option") return "alt";
    if (normalised === "command") return "meta";
    if (normalised === "cmd") return "meta";
    return normalised;
  }

  static _isModifierToken(token) {
    const alias = KeybindCatalogue._modAlias(token);
    return (
      alias === "ctrl" ||
      alias === "shift" ||
      alias === "alt" ||
      alias === "meta"
    );
  }

  static _looksLikeKeyToken(token) {
    const t = String(token || "").trim();
    if (!t) return false;
    const noSpace = t.replace(/\s+/g, "");
    if (!noSpace) return false;
    if (KeybindCatalogue._isModifierToken(noSpace)) return false;
    if (noSpace === "GUI") return false;
    return true;
  }

  static _stripHintCommentary(hint) {
    return String(hint || "")
      .replace(/\([^)]*\)/g, "")
      .trim();
  }

  static _parseHintCombos(hint) {
    const rawHint = KeybindCatalogue._stripHintCommentary(hint);
    if (!rawHint) return [];

    const cacheHit = KeybindCatalogue._comboCache.get(rawHint);
    if (cacheHit) return cacheHit;

    const parts = rawHint
      .split("/")
      .map((part) => part.trim())
      .filter(Boolean);

    const combos = [];
    let inheritedMods = [];

    for (const rawPart of parts) {
      const partHasModifier =
        /(^|\+)(Ctrl|Control|Shift|Alt|Option|Meta|Cmd|Command)(\+|$)/i.test(
          rawPart,
        );
      let expandedPart = rawPart;

      if (
        !partHasModifier &&
        inheritedMods.length > 0 &&
        KeybindCatalogue._looksLikeKeyToken(rawPart)
      ) {
        expandedPart = `${inheritedMods.join("+")}+${rawPart}`;
      }

      const segments = KeybindCatalogue._splitComboSegments(expandedPart);
      if (segments.length === 0) continue;

      const combo = {
        keyToken: "",
        ctrl: false,
        shift: false,
        alt: false,
        meta: false,
      };

      for (const segment of segments) {
        const normalised = KeybindCatalogue._modAlias(segment);
        if (normalised === "ctrl") {
          combo.ctrl = true;
          continue;
        }
        if (normalised === "shift") {
          combo.shift = true;
          continue;
        }
        if (normalised === "alt") {
          combo.alt = true;
          continue;
        }
        if (normalised === "meta") {
          combo.meta = true;
          continue;
        }

        combo.keyToken = segment;
      }

      if (!KeybindCatalogue._looksLikeKeyToken(combo.keyToken)) {
        continue;
      }

      combos.push(combo);
      inheritedMods = [];
      if (combo.ctrl) inheritedMods.push("Ctrl");
      if (combo.shift) inheritedMods.push("Shift");
      if (combo.alt) inheritedMods.push("Alt");
      if (combo.meta) inheritedMods.push("Meta");
    }

    KeybindCatalogue._comboCache.set(rawHint, combos);
    return combos;
  }

  static _splitComboSegments(part) {
    const raw = String(part || "").trim();
    if (!raw) return [];

    if (raw === "+") {
      return ["+"];
    }

    const chunks = raw.split("+");
    const segments = [];

    for (let i = 0; i < chunks.length; i++) {
      const token = chunks[i].trim();
      if (token) {
        segments.push(token);
        continue;
      }

      // Keep trailing '+' as an explicit key token (e.g. "+/-" or "Ctrl++").
      if (i === chunks.length - 1 && raw.endsWith("+")) {
        segments.push("+");
      }
    }

    return segments;
  }

  static _resolveModifierState(event) {
    const shift = Boolean(event?.shiftKey) || KeyboardUtils.isShiftHeld();
    const ctrl = Boolean(event?.ctrlKey) || KeyboardUtils.isCtrlHeld();
    const alt =
      Boolean(event?.altKey) ||
      (typeof KeyboardUtils.isAltHeld === "function" &&
        KeyboardUtils.isAltHeld());
    const meta =
      Boolean(event?.metaKey) ||
      (typeof KeyboardUtils.isMetaHeld === "function" &&
        KeyboardUtils.isMetaHeld());
    return { shift, ctrl, alt, meta };
  }

  static _shouldRequireShiftOff(token) {
    const normalised = String(token || "")
      .trim()
      .toLowerCase();
    if (/^[a-z]$/.test(normalised)) return true;

    const named = new Set([
      "space",
      "enter",
      "return",
      "tab",
      "esc",
      "escape",
      "del",
      "delete",
      "backspace",
      "home",
      "end",
      "pgup",
      "pagedown",
      "pgdn",
      "pageup",
      "left",
      "right",
      "up",
      "down",
      "arrowleft",
      "arrowright",
      "arrowup",
      "arrowdown",
      "←",
      "→",
      "↑",
      "↓",
      "#",
    ]);
    return named.has(normalised);
  }

  static _matchKeyToken(token, keyValue, kCode) {
    const raw = String(token || "").trim();
    const lower = raw.toLowerCase();
    const keyNormal = KeyboardUtils.normaliseKey(keyValue);
    const keyLower = KeyboardUtils.toLower(keyNormal);
    const code = Number(kCode);

    if (!raw) return false;

    if (/^[a-z]$/.test(lower)) {
      return keyLower === lower;
    }

    if (/^[0-9]$/.test(lower)) {
      return keyLower === lower || code === 48 + Number(lower);
    }

    if (lower === "space") {
      return keyNormal === " " || code === 32;
    }
    if (lower === "enter" || lower === "return") {
      return KeyboardUtils.isEnterOrReturn(code);
    }
    if (lower === "tab") {
      return code === 9;
    }
    if (lower === "esc" || lower === "escape") {
      return code === 27;
    }
    if (lower === "del" || lower === "delete") {
      return code === 46;
    }
    if (lower === "backspace") {
      return code === 8;
    }
    if (lower === "home") {
      return code === 36;
    }
    if (lower === "end") {
      return code === 35;
    }
    if (lower === "pgup" || lower === "pageup") {
      return code === 33;
    }
    if (lower === "pgdn" || lower === "pagedown") {
      return code === 34;
    }
    if (lower === "left" || lower === "arrowleft" || raw === "←") {
      return code === KeyboardUtils.keyCode("LEFT_ARROW", 37);
    }
    if (lower === "right" || lower === "arrowright" || raw === "→") {
      return code === KeyboardUtils.keyCode("RIGHT_ARROW", 39);
    }
    if (lower === "up" || lower === "arrowup" || raw === "↑") {
      return code === KeyboardUtils.keyCode("UP_ARROW", 38);
    }
    if (lower === "down" || lower === "arrowdown" || raw === "↓") {
      return code === KeyboardUtils.keyCode("DOWN_ARROW", 40);
    }

    if (raw === "[") {
      return keyNormal === "[" || keyNormal === "{";
    }
    if (raw === "]") {
      return keyNormal === "]" || keyNormal === "}";
    }
    if (raw === ";") {
      return keyNormal === ";" || keyNormal === ":";
    }
    if (raw === "'") {
      return keyNormal === "'" || keyNormal === '"';
    }
    if (raw === ",") {
      return keyNormal === "," || keyNormal === "<";
    }
    if (raw === ".") {
      return keyNormal === "." || keyNormal === ">";
    }
    if (raw === "-") {
      return (
        keyNormal === "-" ||
        keyNormal === "_" ||
        code === 189 ||
        code === 173 ||
        code === 109
      );
    }
    if (raw === "=") {
      return (
        keyNormal === "=" ||
        keyNormal === "+" ||
        code === 187 ||
        code === 61 ||
        code === 107
      );
    }
    if (raw === "+") {
      return (
        keyNormal === "+" ||
        keyNormal === "=" ||
        code === 187 ||
        code === 61 ||
        code === 107
      );
    }
    if (raw === "`") {
      return keyNormal === "`" || keyNormal === "~";
    }

    return keyNormal === raw || keyLower === lower;
  }

  static _comboMatches(combo, keyValue, kCode, event = null) {
    if (!combo || !combo.keyToken) return false;

    const modifiers = KeybindCatalogue._resolveModifierState(event);
    if (combo.ctrl !== modifiers.ctrl) return false;
    if (combo.alt !== modifiers.alt) return false;
    if (combo.meta !== modifiers.meta) return false;

    const requireShiftOff =
      !combo.shift && KeybindCatalogue._shouldRequireShiftOff(combo.keyToken);
    if (combo.shift && !modifiers.shift) return false;
    if (requireShiftOff && modifiers.shift) return false;

    return KeybindCatalogue._matchKeyToken(combo.keyToken, keyValue, kCode);
  }

  static getHintCombos(sketchId, hintId) {
    const hint = KeybindCatalogue.getHint(sketchId, hintId, "");
    return KeybindCatalogue._parseHintCombos(hint);
  }

  static matchHint(
    sketchId,
    hintId,
    keyValue,
    kCode,
    event = null,
    optionIndex = null,
  ) {
    const combos = KeybindCatalogue.getHintCombos(sketchId, hintId);
    if (!Array.isArray(combos) || combos.length === 0) return false;

    if (Number.isInteger(optionIndex)) {
      const combo = combos[optionIndex];
      return KeybindCatalogue._comboMatches(combo, keyValue, kCode, event);
    }

    return combos.some((combo) =>
      KeybindCatalogue._comboMatches(combo, keyValue, kCode, event),
    );
  }

  static matchHintIndex(sketchId, hintId, keyValue, kCode, event = null) {
    const combos = KeybindCatalogue.getHintCombos(sketchId, hintId);
    if (!Array.isArray(combos) || combos.length === 0) return -1;

    for (let i = 0; i < combos.length; i++) {
      if (KeybindCatalogue._comboMatches(combos[i], keyValue, kCode, event)) {
        return i;
      }
    }

    return -1;
  }

  static _tokenVariantsForHeld(token) {
    const raw = String(token || "").trim();
    if (!raw) return [];

    const variants = new Set([raw, raw.toLowerCase()]);
    if (raw === "[") variants.add("{");
    if (raw === "]") variants.add("}");
    if (raw === ";") variants.add(":");
    if (raw === "'") variants.add('"');
    if (raw === ",") variants.add("<");
    if (raw === ".") variants.add(">");
    if (raw === "-") variants.add("_");
    if (raw === "=") variants.add("+");
    if (raw === "`") variants.add("~");
    if (
      raw.toLowerCase() === "left" ||
      raw.toLowerCase() === "arrowleft" ||
      raw === "←"
    ) {
      variants.add("arrowleft");
      variants.add("←");
    }
    if (
      raw.toLowerCase() === "right" ||
      raw.toLowerCase() === "arrowright" ||
      raw === "→"
    ) {
      variants.add("arrowright");
      variants.add("→");
    }
    if (
      raw.toLowerCase() === "up" ||
      raw.toLowerCase() === "arrowup" ||
      raw === "↑"
    ) {
      variants.add("arrowup");
      variants.add("↑");
    }
    if (
      raw.toLowerCase() === "down" ||
      raw.toLowerCase() === "arrowdown" ||
      raw === "↓"
    ) {
      variants.add("arrowdown");
      variants.add("↓");
    }
    if (raw.toLowerCase() === "space") variants.add(" ");

    return Array.from(variants);
  }

  static _heldHasModifier(heldSet, modName) {
    const hasSet = heldSet instanceof Set;

    if (modName === "ctrl") {
      if (hasSet && (heldSet.has("control") || heldSet.has("ctrl"))) {
        return true;
      }
      return (
        typeof KeyboardUtils.isCtrlHeld === "function" &&
        KeyboardUtils.isCtrlHeld()
      );
    }
    if (modName === "alt") {
      if (hasSet && (heldSet.has("alt") || heldSet.has("option"))) {
        return true;
      }
      return (
        typeof KeyboardUtils.isAltHeld === "function" &&
        KeyboardUtils.isAltHeld()
      );
    }
    if (modName === "shift") {
      if (hasSet && heldSet.has("shift")) {
        return true;
      }
      return (
        typeof KeyboardUtils.isShiftHeld === "function" &&
        KeyboardUtils.isShiftHeld()
      );
    }
    if (modName === "meta") {
      if (
        hasSet &&
        (heldSet.has("meta") || heldSet.has("command") || heldSet.has("cmd"))
      ) {
        return true;
      }
      return (
        typeof KeyboardUtils.isMetaHeld === "function" &&
        KeyboardUtils.isMetaHeld()
      );
    }
    return false;
  }

  static matchHintFromHeldSet(sketchId, hintId, heldSet, optionIndex = null) {
    if (!(heldSet instanceof Set)) return false;

    const combos = KeybindCatalogue.getHintCombos(sketchId, hintId);
    if (!Array.isArray(combos) || combos.length === 0) return false;

    const matchesCombo = (combo) => {
      if (!combo || !combo.keyToken) return false;

      if (combo.ctrl && !KeybindCatalogue._heldHasModifier(heldSet, "ctrl"))
        return false;
      if (combo.alt && !KeybindCatalogue._heldHasModifier(heldSet, "alt"))
        return false;
      if (combo.meta && !KeybindCatalogue._heldHasModifier(heldSet, "meta"))
        return false;
      if (combo.shift && !KeybindCatalogue._heldHasModifier(heldSet, "shift"))
        return false;

      const variants = KeybindCatalogue._tokenVariantsForHeld(combo.keyToken);
      return variants.some(
        (variant) =>
          heldSet.has(variant) || heldSet.has(String(variant).toLowerCase()),
      );
    };

    if (Number.isInteger(optionIndex)) {
      return matchesCombo(combos[optionIndex]);
    }

    return combos.some(matchesCombo);
  }
}

window.KeybindCatalogue = KeybindCatalogue;
