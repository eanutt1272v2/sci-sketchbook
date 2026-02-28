
/**
 * @file AnimalLibrary.js
 * @author @eanutt1272.v2
 * @version 1.0.0
 */
class AnimalLibrary {
  constructor() {
    this.animals = [];
    this.loaded = false;
  }

  loadFromData(data) {
    const dataArray = Array.isArray(data) ? data : Object.values(data);
    this.animals = dataArray.filter(a => a?.name && !a.code?.startsWith(">"));
    this.loaded = true;
  }

  getAnimal(index) {
    return this.animals[index] || null;
  }

  getAnimalList() {
    return this.animals.reduce((options, animal, idx) => {
      const name = `${animal.code || ""} ${animal.name || ""} ${(animal.cname) || ""}`.trim();
      options[name.substring(0, 35)] = String(idx);
      return options;
    }, {});
  }

  applyAnimalParameters(animal) {
    if (!animal?.params) return;

    const { b, ...standardParams } = animal.params;

    Object.assign(params, standardParams);

    if (b !== undefined) {
      params.b = typeof b === "string" ? b.split(",").map(val => RLEParser.parseFraction(val)) : b;
    }
  }
}