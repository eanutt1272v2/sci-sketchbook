class AnimalLibrary {
  constructor(params = null) {
    this.params = params;
    this.animals = [];
    this.taxonomy = [];
    this.taxonomyRanks = [];
    this.taxonomyLevelLabels = [];
    this.animalsByDimension = {
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
    const dim = NDCompat.coerceDimension(dimension);
    const dataArray = Array.isArray(data) ? data : Object.values(data || {});
    const animals = [];
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

      animals.push(entry);
      taxonomy.push(lineage.filter(Boolean));
      taxonomyRanks.push(rankLineage.filter(Boolean));
    }

    this.animalsByDimension[dim] = animals;
    this.taxonomyByDimension[dim] = taxonomy;
    this.taxonomyRanksByDimension[dim] = taxonomyRanks;
    this.taxonomyLevelLabelsByDimension[dim] = levelLabels;
    if (dim === this.activeDimension) {
      this.animals = animals;
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
    this.activeDimension = NDCompat.coerceDimension(dimension);
    this.animals = this.animalsByDimension[this.activeDimension] || [];
    this.taxonomy = this.taxonomyByDimension[this.activeDimension] || [];
    this.taxonomyRanks =
      this.taxonomyRanksByDimension[this.activeDimension] || [];
    this.taxonomyLevelLabels =
      this.taxonomyLevelLabelsByDimension[this.activeDimension] || [];
  }

  getAnimal(index) {
    return this.animals[index] || null;
  }

  getAnimalList() {
    return this.animals.reduce((options, animal, idx) => {
      const animalLabel = this._formatAnimalLabel(animal, 56);
      const taxonPath = Array.isArray(this.taxonomy[idx])
        ? this.taxonomy[idx]
        : [];
      const taxonLabel = taxonPath
        .map((segment) => this._truncate(this._normaliseSpaces(segment), 24))
        .join(" > ");

      let name = taxonLabel ? `${taxonLabel} > ${animalLabel}` : animalLabel;
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

  toAnimalMenuValue(index) {
    const idx = Math.floor(Number(index));
    if (!Number.isFinite(idx) || idx < 0) return "";
    return `__animal__:${idx}`;
  }

  parseAnimalMenuValue(value) {
    const raw = String(value || "");
    const match = raw.match(/^__animal__:(\d+)$/);
    if (!match) return null;

    const idx = parseInt(match[1], 10);
    if (!Number.isFinite(idx) || idx < 0 || idx >= this.animals.length) {
      return null;
    }
    return idx;
  }

  getFirstAnimalMenuValue() {
    return this.animals.length > 0 ? this.toAnimalMenuValue(0) : "";
  }

  getHierarchicalAnimalMenu() {
    const options = {};
    const seenHeaders = new Set();

    for (let idx = 0; idx < this.animals.length; idx++) {
      const animal = this.animals[idx];
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
      const animalLabel = `${prefix}${this._formatAnimalLabel(animal, 88)}`;
      this._addUniqueMenuOption(
        options,
        animalLabel,
        this.toAnimalMenuValue(idx),
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

  getAnimalsForTaxonomy(prefix = []) {
    const prefixPath = Array.isArray(prefix) ? prefix : [];

    return this.animals.reduce((options, animal, idx) => {
      const taxonomyPath = Array.isArray(this.taxonomy[idx])
        ? this.taxonomy[idx]
        : [];
      if (
        !this._pathMatchesPrefix(taxonomyPath, prefixPath, prefixPath.length)
      ) {
        return options;
      }

      let name = this._formatAnimalLabel(animal, 56);
      if (!name) {
        name = `Animal ${idx + 1}`;
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

  _formatAnimalLabel(animal, maxLength = 56) {
    const label = this._normaliseSpaces(
      `${animal?.code || ""} ${animal?.name || ""} ${animal?.cname || ""}`,
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

  applyAnimalParameters(animal) {
    if (!animal?.params || !this.params) return;

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
    ]);

    const sourceParams = Array.isArray(animal.params)
      ? animal.params.find((entry) => entry && typeof entry === "object") ||
        animal.params[0] ||
        {}
      : animal.params;

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
  }
}
