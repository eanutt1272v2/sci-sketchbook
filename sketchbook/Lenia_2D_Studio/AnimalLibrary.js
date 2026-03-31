class AnimalLibrary {
  constructor(params = null) {
    this.params = params;
    this.animals = [];
    this.animalsByDimension = {
      2: [],
      3: [],
      4: [],
    };
    this.activeDimension = 2;
    this.loaded = false;
  }

  loadFromData(data, dimension = 2) {
    const dim =
      typeof NDCompatibility !== "undefined"
        ? NDCompatibility.coerceDimension(dimension)
        : 2;
    const dataArray = Array.isArray(data) ? data : Object.values(data || {});
    const animals = dataArray.filter(
      (a) => a?.name && !a.code?.startsWith(">"),
    );

    this.animalsByDimension[dim] = animals;
    if (dim === this.activeDimension) {
      this.animals = animals;
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
    this.activeDimension =
      typeof NDCompatibility !== "undefined"
        ? NDCompatibility.coerceDimension(dimension)
        : 2;
    this.animals = this.animalsByDimension[this.activeDimension] || [];
  }

  getAnimal(index) {
    return this.animals[index] || null;
  }

  getAnimalList() {
    return this.animals.reduce((options, animal, idx) => {
      let name =
        `${animal.code || ""} ${animal.name || ""} ${animal.cname || ""}`
          .replace(/\s+/g, " ")
          .trim()
          .substring(0, 56);
      if (name in options) {
        let n = 2;
        while (`${name} (${n})` in options) n++;
        name = `${name} (${n})`;
      }
      options[name] = String(idx);
      return options;
    }, {});
  }

  applyAnimalParameters(animal) {
    if (!animal?.params || !this.params) return;

    const params = this.params;

    const sourceParams = Array.isArray(animal.params)
      ? animal.params.find((entry) => entry && typeof entry === "object") ||
        animal.params[0] ||
        {}
      : animal.params;

    const { b, ...standardParams } = sourceParams;

    Object.assign(params, standardParams);

    if (b !== undefined) {
      params.b =
        typeof b === "string"
          ? b.split(",").map((val) => RLECodec.parseFraction(val))
          : b;
    }
  }
}
