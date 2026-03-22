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

  ensureEquationOverlay() {
    if (this.eqOverlayEl && document.body.contains(this.eqOverlayEl)) {
      return this.eqOverlayEl;
    }
    const panel = document.createElement("div");
    panel.className = "equation-overlay";
    panel.style.display = "none";
    const title = document.createElement("p");
    title.className = "equation-overlay__title";
    title.textContent = "Primordial Particle System";
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

  renderEquationOverlay() {
    const panel = this.ensureEquationOverlay();
    panel.style.display = "block";
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
