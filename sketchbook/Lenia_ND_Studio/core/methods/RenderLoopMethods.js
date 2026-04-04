class RenderLoopMethods {
  render() {
    const polarMode = Math.max(
      0,
      Math.min(4, Math.floor(Number(this.params.polarMode) || 0)),
    );
    const isKernel = this.params.renderMode === "kernel";

    this._prepareViewTransform(isKernel);

    this.renderer.beginAutoRotation();
    this._renderPrimaryLayer();
    this._renderWorldOverlays(polarMode, isKernel);
    this.renderer.endAutoRotation();

    this._renderHudLayers(polarMode);
    this._renderPanelsAndReference();

    if (this._pendingActions.length > 0) {
      this._runNextAction();
      return;
    }

    if (this.params.running && this.board.world) {
      this._dispatchWorkerStep();
    }

    if (this.params.running) {
      this.analyser.updateFps();
    }
  }

  _prepareViewTransform(isKernel) {
    this.renderer.setViewOffset(
      this.params.autoCentre && !isKernel,
      this.statistics.centreX,
      this.statistics.centreY,
    );

    const autoRotAngle = isKernel ? 0 : this._computeAutoRotationAngle();
    this.renderer.setAutoRotation(autoRotAngle);
  }

  _renderPrimaryLayer() {
    if (this.board.world) {
      this.renderer.render(
        this.board,
        this.automaton,
        this.params.renderMode,
        this.params.colourMap,
        this.params,
        this.statistics,
      );
      return;
    }
    this.renderer.renderCachedFrame();
  }

  _renderWorldOverlays(polarMode, isKernel) {
    const canRenderWorldGrid = polarMode <= 1;
    if (canRenderWorldGrid && (this.params.renderGrid || isKernel)) {
      this.renderer.renderGrid(this.params.R, this.params);
    }

    if (this.params.renderMode !== "kernel" && polarMode <= 1) {
      if (this.params.renderMotionOverlay) {
        this.renderer.renderMotionOverlay(this.statistics, this.params);
      }
      if (this.params.renderTrajectoryOverlay) {
        this.renderer.renderTrajectoryOverlay(this.statistics, this.params);
      }
      if (this.params.renderMassGrowthOverlay) {
        this.renderer.renderMassGrowthOverlay(this.statistics, this.params);
      }
    }

    if (
      this.params.renderSymmetryOverlay &&
      this.params.renderMode !== "kernel"
    ) {
      this.renderer.renderSymmetryOverlay(this.statistics, this.params);
    }
  }

  _renderHudLayers(polarMode) {
    const statsMode = Math.max(
      0,
      Math.min(6, Math.floor(Number(this.params.statsMode) || 0)),
    );

    if (this.params.renderSymmetryOverlay) {
      this.renderer.renderSymmetryTitle(this.statistics, this.params);
    }

    if (this.params.renderScale && polarMode <= 1) {
      this.renderer.renderScale(this.params.R, this.params);
    }

    if (this.params.renderLegend && polarMode <= 1) {
      this.renderer.renderLegend();
    }

    if (this.params.renderStats) {
      this.renderer.renderStats(this.statistics, this.params);
    }

    if (statsMode >= 1 && statsMode <= 4) {
      this.renderer.renderStatsGraphOverlay(this.statistics, this.params);
    }

    if (statsMode === 5) {
      this.renderer.renderPeriodogramOverlay(this.statistics, this.params);
    }

    if (statsMode === 6) {
      this.renderer.renderRecurrenceOverlay(this.statistics, this.params);
    }

    if (this.params.renderAnimalName) {
      const animal = this.getSelectedAnimal();
      if (animal?.name) {
        this.renderer.renderAnimalName(animal);
      }
    }
  }

  _renderPanelsAndReference() {
    if (this.params.renderCalcPanels) {
      if (this.board.world) {
        this.renderer.renderCalcPanels(this.board, this.automaton, this.params);
      } else {
        this.renderer.renderCachedCalcPanels();
      }
    }

    if (this.params.renderKeymapRef) {
      this.renderer.renderKeymapRef(this.metadata);
    }
  }

  _computeAutoRotationAngle() {
    const dim = this.params.dimension || 2;
    if (dim !== 2) return 0;
    if ((Number(this.params.polarMode) || 0) > 1) return 0;
    const mode = this.params.autoRotateMode || 0;
    if (mode === 0) return 0;
    if (mode === 1) {
      const angleRad = this.statistics.angle || 0;
      return angleRad + Math.PI / 2;
    }
    if (mode === 2) {
      return -(this.statistics.symmAngle || 0);
    }
    return 0;
  }
}

for (const name of Object.getOwnPropertyNames(RenderLoopMethods.prototype)) {
  if (name === "constructor") continue;
  AppCore.prototype[name] = RenderLoopMethods.prototype[name];
}
