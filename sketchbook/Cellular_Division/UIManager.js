class UIManager {
  constructor(appcore) {
    this.appcore = appcore;
    this.visible = true;
    this.renderKeymapRef = false;
    this.showEquation = true;
    this.eqOverlayEl = null;
    this.eqOverlaySig = "";

    this.leftPanel = new LeftPanel(appcore);
    this.rightPanel = new RightPanel(appcore);
    this.inputHandler = new InputHandler(
      this,
      appcore.sim,
      this.leftPanel,
      this.rightPanel,
    );

    this.leftPanel.setInputHandler(this.inputHandler);
    this.rightPanel.setInputHandler(this.inputHandler);
  }

  updateInput() {
    this.inputHandler.update();
  }

  render() {
    this.leftPanel.render();
    this.rightPanel.render();
    if (this.renderKeymapRef) {
      this.leftPanel.renderKeymapReference();
    }
    if (this.showEquation) {
      this.renderEquationOverlay();
    } else {
      this.hideEquationOverlay();
    }
  }

  onKeyPressed() {
    this.inputHandler.onKeyPressed();
  }

  toggleVisibility() {
    this.visible = !this.visible;
  }

  isVisible() {
    return this.visible;
  }

  toggleKeymapReference() {
    this.renderKeymapRef = !this.renderKeymapRef;
  }

  toggleEquation() {
    this.showEquation = !this.showEquation;
  }

  requestRestart() {
    this.appcore.restartSimulation();
  }

  toggleSimulationPause() {
    this.appcore.toggleSimulationPause();
  }

  dispose() {
    if (this.eqOverlayEl && this.eqOverlayEl.parentNode === document.body) {
      document.body.removeChild(this.eqOverlayEl);
    }
    this.eqOverlayEl = null;
    this.eqOverlaySig = "";
  }

  ensureEquationOverlay() {
    if (this.eqOverlayEl && document.body.contains(this.eqOverlayEl)) {
      return this.eqOverlayEl;
    }

    const overlays = document.querySelectorAll(".equation-overlay");
    let existing = null;
    for (const overlay of overlays) {
      const titleEl = overlay.querySelector(".equation-overlay__title");
      if (!titleEl) continue;
      if (titleEl.textContent !== "Primordial Particle System (PPS) Model") continue;

      if (!existing) {
        existing = overlay;
      } else if (overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }
    }

    if (existing) {
      this.eqOverlayEl = existing;
      this.eqOverlayEl.id = "cellular-division-equation-overlay";
      return this.eqOverlayEl;
    }

    const panel = document.createElement("div");
    panel.id = "cellular-division-equation-overlay";
    panel.className = "equation-overlay";
    panel.style.display = "none";
    const title = document.createElement("p");
    title.className = "equation-overlay__title";
    title.textContent = "Primordial Particle System (PPS) Model";
    const math = document.createElement("div");
    math.className = "equation-overlay__math";
    panel.appendChild(title);
    panel.appendChild(math);
    document.body.appendChild(panel);
    this.eqOverlayEl = panel;
    return panel;
  }

  hideEquationOverlay() {
    if (this.eqOverlayEl) this.eqOverlayEl.style.display = "none";
  }

  positionEquationOverlay() {
    const panel = this.eqOverlayEl;
    const canvasEl = _renderer?.elt;
    if (!panel || !canvasEl) return;

    const rect = canvasEl.getBoundingClientRect();
    const margin = 12;
    const upwardShift = 26;
    const maxWidth = Math.max(220, Math.floor(rect.width - margin * 2));
    const maxHeight = Math.max(120, Math.floor(rect.height - margin * 2));
    panel.style.maxWidth = `${maxWidth}px`;
    panel.style.maxHeight = `${maxHeight}px`;
    panel.style.overflowY = "auto";

    const panelWidth = panel.offsetWidth;

    const minLeft = rect.left + margin;
    const maxLeft = rect.right - panelWidth - margin;
    const preferredLeft = minLeft;
    const preferredBottom =
      Math.max(0, window.innerHeight - rect.bottom + margin + upwardShift);

    const left = Math.max(minLeft, Math.min(preferredLeft, Math.max(minLeft, maxLeft)));

    panel.style.left = `${Math.round(left)}px`;
    panel.style.top = "auto";
    panel.style.right = "auto";
    panel.style.bottom = `${Math.round(preferredBottom)}px`;
  }

  renderEquationOverlay() {
    const panel = this.ensureEquationOverlay();
    panel.style.display = "block";
    this.positionEquationOverlay();
    const mathEl = panel.querySelector(".equation-overlay__math");
    const tex = String.raw`\Delta\phi_i = \alpha + \beta\,N_i\,\mathrm{sgn}(R_i - L_i), \quad \mathbf{x}_i \mathrel{+}= v\left(\cos\phi_i,\,\sin\phi_i\right)`;
    if (tex === this.eqOverlaySig) return;
    const canRenderKatex =
      typeof window !== "undefined" &&
      window.katex &&
      typeof window.katex.render === "function";
    if (canRenderKatex) {
      window.katex.render(tex, mathEl, {
        displayMode: true,
        throwOnError: false,
        output: "mathml",
      });
    } else {
      mathEl.textContent = "dphi_i = alpha + beta * N_i * sgn(R_i - L_i),  x_i += v(cos(phi_i), sin(phi_i))";
    }
    this.eqOverlaySig = tex;
  }
}
