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
    this.ndSliceZBinding = null;
    this.ndSliceWBinding = null;
  }
}
