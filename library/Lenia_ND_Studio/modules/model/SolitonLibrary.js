class SolitonLibrary {
  constructor(params = null) {
    this.params = params;
    this.solitons = [];
    this.taxonomy = [];
    this.taxonomyRanks = [];
    this.taxonomyLevelLabels = [];
    this.solitonsByDimension = {
      2: [],
      3: [],
      4: [],
    };
    this.taxonomyByDimension = {
      2: [],
      3: [],
      4: [],
    };
    this.taxonomyRanksByDimension = {
      2: [],
      3: [],
      4: [],
    };
    this.taxonomyLevelLabelsByDimension = {
      2: [],
      3: [],
      4: [],
    };
    this.activeDimension = 2;
    this.loaded = false;
  }

  loadFromData(data, dimension = 2) {
    const dim = NDCompatibility.coerceDimension(dimension);
    const dataArray = Array.isArray(data) ? data : Object.values(data || {});
    const solitons = [];
    const taxonomy = [];
    const taxonomyRanks = [];
    const lineage = [];
    const rankLineage = [];
    const levelLabels = [];

    for (const entry of dataArray) {
      if (!entry || !entry.name) continue;

      if (this._isTaxonomyHeader(entry)) {
        const level = this._parseTaxonomyLevel(entry, lineage.length + 1);
        const label = this._formatTaxonomyLabel(entry);
        if (!label) continue;
        const rank = this._parseTaxonomyRank(entry);

        lineage.length = Math.max(0, level - 1);
        lineage[level - 1] = label;

        rankLineage.length = Math.max(0, level - 1);
        if (rank) {
          rankLineage[level - 1] = rank;
          if (!levelLabels[level - 1]) {
            levelLabels[level - 1] = rank;
          }
        } else if (!levelLabels[level - 1]) {
          levelLabels[level - 1] = `Level ${level}`;
        }
        continue;
      }

      solitons.push(entry);
      taxonomy.push(lineage.filter(Boolean));
      taxonomyRanks.push(rankLineage.filter(Boolean));
    }

    this.solitonsByDimension[dim] = solitons;
    this.taxonomyByDimension[dim] = taxonomy;
    this.taxonomyRanksByDimension[dim] = taxonomyRanks;
    this.taxonomyLevelLabelsByDimension[dim] = levelLabels;
    if (dim === this.activeDimension) {
      this.solitons = solitons;
      this.taxonomy = taxonomy;
      this.taxonomyRanks = taxonomyRanks;
      this.taxonomyLevelLabels = levelLabels;
    }

    this.loaded = true;
  }

  loadFromDimensionMap(map) {
    const source = map || {};
    this.loadFromData(source[2] || [], 2);
    this.loadFromData(source[3] || [], 3);
    this.loadFromData(source[4] || [], 4);
    this.setActiveDimension(this.activeDimension);
  }

  setActiveDimension(dimension) {
    this.activeDimension = NDCompatibility.coerceDimension(dimension);
    this.solitons = this.solitonsByDimension[this.activeDimension] || [];
    this.taxonomy = this.taxonomyByDimension[this.activeDimension] || [];
    this.taxonomyRanks =
      this.taxonomyRanksByDimension[this.activeDimension] || [];
    this.taxonomyLevelLabels =
      this.taxonomyLevelLabelsByDimension[this.activeDimension] || [];
  }

  getSoliton(index) {
    return this.solitons[index] || null;
  }

  getSolitonList() {
    return this.solitons.reduce((options, soliton, idx) => {
      const solitonLabel = this._formatSolitonLabel(soliton, 56);
      const taxonPath = Array.isArray(this.taxonomy[idx])
        ? this.taxonomy[idx]
        : [];
      const taxonLabel = taxonPath
        .map((segment) => this._truncate(this._normaliseSpaces(segment), 24))
        .join(" > ");

      let name = taxonLabel ? `${taxonLabel} > ${solitonLabel}` : solitonLabel;
      name = this._truncate(name, 112);

      if (name in options) {
        let n = 2;
        while (`${name} (${n})` in options) n++;
        name = `${name} (${n})`;
      }
      options[name] = String(idx);
      return options;
    }, {});
  }

  toSolitonMenuValue(index) {
    const idx = Math.floor(Number(index));
    if (!Number.isFinite(idx) || idx < 0) return "";
    return `__soliton__:${idx}`;
  }

  parseSolitonMenuValue(value) {
    const raw = String(value || "");
    const match = raw.match(/^__soliton__:(\d+)$/);
    if (!match) return null;

    const idx = parseInt(match[1], 10);
    if (!Number.isFinite(idx) || idx < 0 || idx >= this.solitons.length) {
      return null;
    }
    return idx;
  }

  getFirstSolitonMenuValue() {
    return this.solitons.length > 0 ? this.toSolitonMenuValue(0) : "";
  }

  getHierarchicalSolitonMenu() {
    const options = {};
    const seenHeaders = new Set();

    for (let idx = 0; idx < this.solitons.length; idx++) {
      const soliton = this.solitons[idx];
      const path = Array.isArray(this.taxonomy[idx]) ? this.taxonomy[idx] : [];

      for (let level = 0; level < path.length; level++) {
        const branchPath = path
          .slice(0, level + 1)
          .map((segment) => this._normaliseSpaces(segment))
          .filter(Boolean);
        if (branchPath.length <= level) continue;

        const headerKey = branchPath.join("||");
        if (seenHeaders.has(headerKey)) continue;
        seenHeaders.add(headerKey);

        const rank = this.getTaxonomyLevelLabel(level).toLowerCase();
        const label = `${"| ".repeat(level)}${rank}: ${this._truncate(branchPath[level], 64)}`;
        const token = `__header__:${level}:${headerKey}`;
        this._addUniqueMenuOption(options, label, token);
      }

      const prefix = `${"| ".repeat(path.length)}`;
      const solitonLabel = `${prefix}${this._formatSolitonLabel(soliton, 88)}`;
      this._addUniqueMenuOption(
        options,
        solitonLabel,
        this.toSolitonMenuValue(idx),
      );
    }

    return options;
  }

  getTaxonomyDepth() {
    return this.taxonomy.reduce(
      (maxDepth, path) =>
        Math.max(maxDepth, Array.isArray(path) ? path.length : 0),
      0,
    );
  }

  getTaxonomyPath(index) {
    const idx = Number(index);
    if (!Number.isFinite(idx) || idx < 0 || idx >= this.taxonomy.length) {
      return [];
    }
    const path = this.taxonomy[idx];
    return Array.isArray(path) ? [...path] : [];
  }

  getTaxonomyLevelLabel(level) {
    const idx = Math.max(0, Math.floor(Number(level) || 0));
    return this.taxonomyLevelLabels[idx] || `Level ${idx + 1}`;
  }

  getTaxonomyOptions(level, prefix = []) {
    const idx = Math.max(0, Math.floor(Number(level) || 0));
    const prefixPath = Array.isArray(prefix) ? prefix : [];

    return this.taxonomy.reduce((options, path) => {
      const taxonomyPath = Array.isArray(path) ? path : [];
      if (!this._pathMatchesPrefix(taxonomyPath, prefixPath, idx)) {
        return options;
      }

      const label = this._normaliseSpaces(taxonomyPath[idx] || "");
      if (!label) return options;
      if (!(label in options)) {
        options[label] = label;
      }
      return options;
    }, {});
  }

  getSolitonsForTaxonomy(prefix = []) {
    const prefixPath = Array.isArray(prefix) ? prefix : [];

    return this.solitons.reduce((options, soliton, idx) => {
      const taxonomyPath = Array.isArray(this.taxonomy[idx])
        ? this.taxonomy[idx]
        : [];
      if (
        !this._pathMatchesPrefix(taxonomyPath, prefixPath, prefixPath.length)
      ) {
        return options;
      }

      let name = this._formatSolitonLabel(soliton, 56);
      if (!name) {
        name = `Soliton ${idx + 1}`;
      }
      if (name in options) {
        let n = 2;
        while (`${name} (${n})` in options) n++;
        name = `${name} (${n})`;
      }

      options[name] = String(idx);
      return options;
    }, {});
  }

  _pathMatchesPrefix(path, prefix, upto = prefix.length) {
    const safePath = Array.isArray(path) ? path : [];
    const safePrefix = Array.isArray(prefix) ? prefix : [];
    const depth = Math.max(0, Math.floor(Number(upto) || 0));

    for (let i = 0; i < depth; i++) {
      const expected = this._normaliseSpaces(safePrefix[i] || "");
      if (!expected) continue;
      if (this._normaliseSpaces(safePath[i] || "") !== expected) {
        return false;
      }
    }

    return true;
  }

  _addUniqueMenuOption(options, label, value) {
    const baseLabel = String(label || "").replace(/\s+$/g, "");
    if (!baseLabel.trim()) return;

    let finalLabel = baseLabel;
    if (finalLabel in options) {
      let n = 2;
      while (`${baseLabel} (${n})` in options) n++;
      finalLabel = `${baseLabel} (${n})`;
    }

    options[finalLabel] = String(value || "");
  }

  _isTaxonomyHeader(entry) {
    return typeof entry?.code === "string" && entry.code.startsWith(">");
  }

  _parseTaxonomyRank(entry) {
    const rawName = this._normaliseSpaces(entry?.name || "");
    if (!rawName) return "";

    const splitIdx = rawName.indexOf(":");
    const rank = (splitIdx >= 0 ? rawName.slice(0, splitIdx) : rawName).trim();
    if (!rank) return "";

    return rank
      .split(/\s+/)
      .map((part) =>
        part.length > 0
          ? `${part[0].toUpperCase()}${part.slice(1).toLowerCase()}`
          : "",
      )
      .join(" ")
      .trim();
  }

  _parseTaxonomyLevel(entry, fallback = 1) {
    const codeMatch = String(entry?.code || "").match(/^>(\d+)/);
    if (codeMatch) {
      return Math.max(1, parseInt(codeMatch[1], 10));
    }

    const rank = String(entry?.name || "")
      .toLowerCase()
      .split(":", 1)[0]
      .trim();

    const levelByRank = {
      phylum: 1,
      subphylum: 1,
      class: 1,
      order: 2,
      family: 3,
      subfamily: 4,
      tribe: 5,
      genus: 6,
    };

    return levelByRank[rank] || Math.max(1, Math.floor(Number(fallback) || 1));
  }

  _formatTaxonomyLabel(entry) {
    const rawName = this._normaliseSpaces(entry?.name || "");
    const rawCName = this._normaliseSpaces(entry?.cname || "");
    const latin = rawName.includes(":")
      ? this._normaliseSpaces(rawName.slice(rawName.indexOf(":") + 1))
      : rawName;

    let combined = latin || rawCName;
    if (latin && rawCName) {
      combined = `${latin} (${rawCName})`;
    }

    return this._truncate(combined, 64);
  }

  _formatSolitonLabel(soliton, maxLength = 56) {
    const label = this._normaliseSpaces(
      `${soliton?.code || ""} ${soliton?.name || ""} ${soliton?.cname || ""}`,
    );
    return this._truncate(label, maxLength);
  }

  _normaliseSpaces(value) {
    return String(value || "")
      .replace(/\s+/g, " ")
      .trim();
  }

  _truncate(value, maxLength) {
    const text = String(value || "");
    if (!Number.isFinite(maxLength) || maxLength <= 0) return "";
    if (text.length <= maxLength) return text;
    return `${text.slice(0, Math.max(0, maxLength - 3))}...`;
  }

  applySolitonParameters(soliton) {
    if (!soliton?.params || !this.params) return;

    const params = this.params;
    const allowedKeys = new Set([
      "R",
      "T",
      "m",
      "s",
      "r",
      "kn",
      "gn",
      "h",
      "addNoise",
      "maskRate",
      "paramP",
      "softClip",
      "multiStep",
      "aritaMode",
      "channelCount",
      "selectedChannel",
      "selectedKernel",
      "channelShift",
      "kernelCount",
      "crossKernelCount",
      "multiKernel",
      "multiChannel",
      "asymptoticUpdate",
    ]);

    const sourceParamsArray = Array.isArray(soliton.params)
      ? soliton.params.filter((entry) => entry && typeof entry === "object")
      : soliton.params && typeof soliton.params === "object"
        ? [soliton.params]
        : [];
    if (sourceParamsArray.length === 0) return;

    const sourceParams = sourceParamsArray[0];

    if (!Object.prototype.hasOwnProperty.call(sourceParams, "h")) {
      params.h = 1;
    }
    if (!Object.prototype.hasOwnProperty.call(sourceParams, "r")) {
      params.r = 1;
    }

    const { b, ...standardParams } = sourceParams;

    for (const [key, value] of Object.entries(standardParams)) {
      if (!allowedKeys.has(key)) continue;
      params[key] = value;
    }

    if (b !== undefined) {
      const parsedB =
        typeof b === "string"
          ? b.split(",").map((val) => RLECodec.parseFraction(val))
          : Array.isArray(b)
            ? b.map((val) => RLECodec.parseFraction(val))
            : null;
      if (Array.isArray(parsedB) && parsedB.length > 0) {
        params.b = parsedB.filter((val) => Number.isFinite(val));
        if (params.b.length === 0) params.b = [1];
      }
    }

    const inferredCellsChannels = Array.isArray(soliton.cells)
      ? Math.max(1, soliton.cells.length)
      : 1;

    const coerceFlag = (value) => {
      if (typeof value === "boolean") return value;
      if (typeof value === "number")
        return Number.isFinite(value) && value !== 0;
      if (typeof value === "string") {
        const normalised = value.trim().toLowerCase();
        return ["1", "true", "yes", "y", "on"].includes(normalised);
      }
      return false;
    };

    const sourceFlags =
      soliton && typeof soliton.flags === "object" && soliton.flags
        ? soliton.flags
        : {};

    const hasAsymptoticFlag = (entry) => {
      if (!entry || typeof entry !== "object") return false;
      return (
        coerceFlag(entry.asymptoticUpdate) ||
        coerceFlag(entry.asymptotic_update) ||
        coerceFlag(entry.asymptotic) ||
        coerceFlag(entry.asym)
      );
    };

    const asymptoticUpdate =
      coerceFlag(sourceFlags.asymptoticUpdate) ||
      coerceFlag(sourceFlags.asymptotic_update) ||
      coerceFlag(sourceFlags.asymptotic) ||
      coerceFlag(sourceFlags.asym) ||
      coerceFlag(soliton?.asymptoticUpdate) ||
      coerceFlag(soliton?.asymptotic_update) ||
      coerceFlag(soliton?.asymptotic) ||
      coerceFlag(soliton?.asym) ||
      sourceParamsArray.some((entry) => hasAsymptoticFlag(entry));

    const defaultAritaMode =
      coerceFlag(sourceFlags.aritaMode) ||
      coerceFlag(soliton?.aritaMode) ||
      coerceFlag(sourceParams.aritaMode) ||
      asymptoticUpdate;

    const normaliseKn = (value, fallback = 1) => {
      const n = Number(value);
      if (!Number.isFinite(n)) return fallback;
      return Math.max(1, Math.min(4, Math.floor(n)));
    };

    const normaliseGn = (value, fallback = 1) => {
      const n = Number(value);
      if (!Number.isFinite(n)) return fallback;
      return Math.max(1, Math.min(3, Math.floor(n)));
    };

    // Python reference defaults missing kn/gn to 1 on imported kernels.
    const defaultKn = normaliseKn(
      Number.isFinite(Number(sourceParams.kn))
        ? Number(sourceParams.kn)
        : Number.isFinite(Number(soliton?.kn))
          ? Number(soliton.kn)
          : 1,
      1,
    );
    const defaultGn = normaliseGn(
      Number.isFinite(Number(sourceParams.gn))
        ? Number(sourceParams.gn)
        : Number.isFinite(Number(soliton?.gn))
          ? Number(soliton.gn)
          : 1,
      1,
    );

    let maxChannelIndex = 0;
    const kernels = sourceParamsArray.map((entry) => {
      const pair = Array.isArray(entry.c) ? entry.c : [0, 0];
      const c0 = Math.max(0, Math.floor(Number(pair[0]) || 0));
      const c1 = Math.max(0, Math.floor(Number(pair[1]) || c0));
      if (c0 > maxChannelIndex) maxChannelIndex = c0;
      if (c1 > maxChannelIndex) maxChannelIndex = c1;

      const parsedB =
        typeof entry.b === "string"
          ? entry.b.split(",").map((val) => RLECodec.parseFraction(val))
          : Array.isArray(entry.b)
            ? entry.b.map((val) => RLECodec.parseFraction(val))
            : params.b;

      return {
        R: Number.isFinite(Number(entry.R))
          ? Number(entry.R)
          : Number(params.R),
        T: Number.isFinite(Number(entry.T))
          ? Number(entry.T)
          : Number(params.T),
        m: Number.isFinite(Number(entry.m))
          ? Number(entry.m)
          : Number(params.m),
        s: Number.isFinite(Number(entry.s))
          ? Number(entry.s)
          : Number(params.s),
        r: Number.isFinite(Number(entry.r))
          ? Number(entry.r)
          : Number(params.r),
        b: Array.isArray(parsedB)
          ? parsedB.filter((val) => Number.isFinite(val) && val >= 0)
          : [1],
        kn: Number.isFinite(Number(entry.kn))
          ? normaliseKn(entry.kn, defaultKn)
          : defaultKn,
        gn: Number.isFinite(Number(entry.gn))
          ? normaliseGn(entry.gn, defaultGn)
          : defaultGn,
        h: Number.isFinite(Number(entry.h))
          ? Number(entry.h)
          : Number(params.h),
        addNoise: Number.isFinite(Number(entry.addNoise))
          ? Number(entry.addNoise)
          : Number(params.addNoise),
        maskRate: Number.isFinite(Number(entry.maskRate))
          ? Number(entry.maskRate)
          : Number(params.maskRate),
        paramP: Number.isFinite(Number(entry.paramP))
          ? Number(entry.paramP)
          : Number(params.paramP),
        softClip:
          typeof entry.softClip === "boolean"
            ? entry.softClip
            : Boolean(params.softClip),
        multiStep:
          typeof entry.multiStep === "boolean"
            ? entry.multiStep
            : Boolean(params.multiStep),
        aritaMode:
          typeof entry.aritaMode === "boolean"
            ? entry.aritaMode
            : hasAsymptoticFlag(entry)
              ? true
              : defaultAritaMode,
        c: [c0, c1],
      };
    });

    const inferredChannelCount = Math.max(
      inferredCellsChannels,
      maxChannelIndex + 1,
      1,
    );

    const multiKernel =
      coerceFlag(sourceFlags.multiKernel) ||
      coerceFlag(sourceFlags.multi_kernel) ||
      coerceFlag(soliton?.multiKernel) ||
      sourceParamsArray.length > 1;
    const multiChannel =
      coerceFlag(sourceFlags.multiChannel) ||
      coerceFlag(sourceFlags.multi_channel) ||
      coerceFlag(soliton?.multiChannel) ||
      inferredChannelCount > 1;

    params.multiKernel = multiKernel;
    params.multiChannel = multiChannel;
    params.asymptoticUpdate = asymptoticUpdate;

    params.channelCount = Math.max(1, Math.min(8, inferredChannelCount));
    params.selectedChannel = Math.max(
      0,
      Math.min(params.channelCount - 1, Number(params.selectedChannel) || 0),
    );
    params.channelShift = Math.max(
      0,
      Math.min(17, Number(params.channelShift) || 0),
    );

    const pairCounts = new Map();
    for (const kernel of kernels) {
      const key = `${kernel.c[0]}:${kernel.c[1]}`;
      pairCounts.set(key, (pairCounts.get(key) || 0) + 1);
    }
    let kernelCount = 1;
    let crossKernelCount = 0;
    for (const [key, count] of pairCounts.entries()) {
      const [c0, c1] = key.split(":").map((v) => Number(v));
      if (c0 === c1) {
        if (count > kernelCount) kernelCount = count;
      } else if (count > crossKernelCount) {
        crossKernelCount = count;
      }
    }

    params.kernelParams = kernels;
    params.kernelCount = Math.max(1, Math.min(4, kernelCount));
    params.crossKernelCount = Math.max(0, Math.min(4, crossKernelCount));
    params.selectedKernel = 0;

    const selected = kernels[0];
    if (selected) {
      for (const key of [
        "R",
        "T",
        "m",
        "s",
        "r",
        "kn",
        "gn",
        "h",
        "addNoise",
        "maskRate",
        "paramP",
      ]) {
        params[key] = selected[key];
      }
      params.softClip = Boolean(selected.softClip);
      params.multiStep = Boolean(selected.multiStep);
      params.aritaMode = Boolean(selected.aritaMode);
      params.b =
        Array.isArray(selected.b) && selected.b.length > 0
          ? selected.b.slice()
          : [1];
    }
  }
}
