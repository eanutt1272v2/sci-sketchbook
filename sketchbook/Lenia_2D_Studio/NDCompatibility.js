class NDCompatibility {
  static SUPPORTED_DIMENSIONS = [2, 3, 4];
  static SUPPORTED_CHANNEL_COUNTS = [1, 2, 3, 4];

  static KERNEL_PRESETS = {
    single: {
      label: "Single Channel",
      selfWeight: 1,
      crossWeight: 0,
      crossMode: "none",
    },
    coupled: {
      label: "Coupled Channels",
      selfWeight: 1,
      crossWeight: 0.35,
      crossMode: "all-to-all",
    },
    cyclic: {
      label: "Cyclic Coupling",
      selfWeight: 1,
      crossWeight: 0.42,
      crossMode: "ring",
    },
  };

  static VIEW_MODES_BY_DIMENSION = {
    2: ["slice"],
    3: ["slice"],
    4: ["slice", "projection"],
  };

  static coerceDimension(value) {
    const dim = Number(value);
    return this.SUPPORTED_DIMENSIONS.includes(dim) ? dim : 2;
  }

  static getViewModesForDimension(dimension) {
    const dim = this.coerceDimension(dimension);
    return this.VIEW_MODES_BY_DIMENSION[dim] || this.VIEW_MODES_BY_DIMENSION[2];
  }

  static coerceViewMode(dimension, viewMode) {
    const modes = this.getViewModesForDimension(dimension);
    const mode = String(viewMode || "slice");
    return modes.includes(mode) ? mode : modes[0];
  }

  static coerceChannelCount(value) {
    const count = Number(value);
    return this.SUPPORTED_CHANNEL_COUNTS.includes(count) ? count : 1;
  }

  static coerceKernelPreset(value) {
    const preset = String(value || "single");
    return this.KERNEL_PRESETS[preset] ? preset : "single";
  }

  static getKernelPresetOptions() {
    return Object.entries(this.KERNEL_PRESETS).reduce((options, [id, preset]) => {
      options[preset.label] = id;
      return options;
    }, {});
  }

  static buildKernelRouting(channelCount, kernelPreset) {
    const count = this.coerceChannelCount(channelCount);
    const presetId = this.coerceKernelPreset(kernelPreset);
    const preset = this.KERNEL_PRESETS[presetId];
    const routing = [];

    for (let target = 0; target < count; target++) {
      routing.push({
        source: target,
        target,
        weight: preset.selfWeight,
        kind: "self",
      });
    }

    if (count <= 1 || preset.crossMode === "none" || preset.crossWeight <= 0) {
      return routing;
    }

    if (preset.crossMode === "all-to-all") {
      for (let source = 0; source < count; source++) {
        for (let target = 0; target < count; target++) {
          if (source === target) continue;
          routing.push({
            source,
            target,
            weight: preset.crossWeight,
            kind: "cross",
          });
        }
      }
      return routing;
    }

    if (preset.crossMode === "ring") {
      for (let source = 0; source < count; source++) {
        routing.push({
          source,
          target: (source + 1) % count,
          weight: preset.crossWeight,
          kind: "cross",
        });
      }
      return routing;
    }

    return routing;
  }

  static normaliseAnimalDataset(data) {
    const dataArray = Array.isArray(data) ? data : Object.values(data || {});
    return dataArray.filter((animal) => animal && animal.name && !animal.code?.startsWith(">"));
  }

  static buildAnimalsByDimension(animals2D, animalsByDimension = null) {
    const dimMap = {
      2: animals2D,
      3: null,
      4: null,
    };

    if (animalsByDimension && typeof animalsByDimension === "object") {
      if (animalsByDimension[2]) dimMap[2] = animalsByDimension[2];
      if (animalsByDimension[3]) dimMap[3] = animalsByDimension[3];
      if (animalsByDimension[4]) dimMap[4] = animalsByDimension[4];
    }

    return {
      2: this.normaliseAnimalDataset(dimMap[2]),
      3: this.normaliseAnimalDataset(dimMap[3]),
      4: this.normaliseAnimalDataset(dimMap[4]),
    };
  }
}
