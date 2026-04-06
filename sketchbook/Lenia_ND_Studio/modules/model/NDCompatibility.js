class NDCompat {
	static SUPPORTED_DIMENSIONS = Object.freeze([2, 3, 4]);

	static GRID_SIZE_OPTIONS_BY_DIMENSION = Object.freeze({
		2: Object.freeze([64, 128, 256, 512, 1024, 2048]),
		3: Object.freeze([32, 64, 128]),
		4: Object.freeze([16, 32]),
	});

	static DEFAULT_GRID_SIZE_BY_DIMENSION = Object.freeze({
		2: 128,
		3: 64,
		4: 32,
	});

	static VIEW_MODES_BY_DIMENSION = Object.freeze({
		2: Object.freeze(["slice"]),
		3: Object.freeze(["slice", "projection"]),
		4: Object.freeze(["slice", "projection"]),
	});

	static coerceDimension(value) {
		const dim = Math.floor(Number(value) || 2);
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

	static coerceDepth(value, dimension = 2) {
		const dim = this.coerceDimension(dimension);
		if (dim <= 2) return 1;
		const n = Math.floor(Number(value) || 6);
		return Math.max(2, Math.min(512, n));
	}

	static getGridSizeOptions(dimension = 2) {
		const dim = this.coerceDimension(dimension);
		return (
			this.GRID_SIZE_OPTIONS_BY_DIMENSION[dim] ||
			this.GRID_SIZE_OPTIONS_BY_DIMENSION[2]
		);
	}

	static getDefaultGridSize(dimension = 2) {
		const dim = this.coerceDimension(dimension);
		return this.DEFAULT_GRID_SIZE_BY_DIMENSION[dim] || 128;
	}

	static coerceGridSize(value, dimension = 2) {
		const options = this.getGridSizeOptions(dimension);
		const raw = Number(value);
		if (!Number.isFinite(raw) || raw <= 0) {
			return this.getDefaultGridSize(dimension);
		}

		let closest = options[0];
		let bestDistance = Math.abs(raw - closest);
		for (let i = 1; i < options.length; i++) {
			const distance = Math.abs(raw - options[i]);
			if (distance < bestDistance) {
				closest = options[i];
				bestDistance = distance;
			}
		}
		return closest;
	}

	static getWorldDepthForDimension(latticeExtent, dimension = 2) {
		const dim = this.coerceDimension(dimension);
		if (dim <= 2) return 1;
		return this.coerceGridSize(latticeExtent, dim);
	}

	static coerceSliceIndex(value, depth) {
		const d = Math.max(1, Math.floor(Number(depth) || 1));
		const n = Math.floor(Number(value) || 0);
		return Math.max(0, Math.min(d - 1, n));
	}

	static normaliseAnimalDataset(data) {
		const dataArray = Array.isArray(data) ? data : Object.values(data || {});
		return dataArray.filter(
			(animal) => animal && animal.name && !animal.code?.startsWith(">"),
		);
	}

	static buildAnimalsByDimension(animals2D, animalsByDimension = null) {
		const source =
			animalsByDimension && typeof animalsByDimension === "object"
				? animalsByDimension
				: {};

		return {
			2: this.normaliseAnimalDataset(source[2] || animals2D),
			3: this.normaliseAnimalDataset(source[3]),
			4: this.normaliseAnimalDataset(source[4]),
		};
	}
}
