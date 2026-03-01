class Renderer {
  constructor(manager) {
    this.m = manager;

    this.canvas3D = createGraphics(width, height, WEBGL);
    this.terrainShader = this.canvas3D.createShader(
      this.m.shaders.vert,
      this.m.shaders.frag
    );

    const { size } = this.m.terrain;
    this.canvas2D = createImage(size, size);
    this.heightMapTexture = createImage(size, size);

    this.lut = new Uint8ClampedArray(256 * 3);
    this.currentColourMap = "";
  }

  reinitialise() {
    const { size } = this.m.terrain;
    this.canvas2D = createImage(size, size);
    this.heightMapTexture = createImage(size, size);
  }

  updateLUT(colourMap) {
    if (this.currentColourMap === colourMap) return;

    const colourData = this.m.colourMaps[colourMap];
    if (!colourData) return;

    this.currentColourMap = colourMap;
    const channels = ["r", "g", "b"];

    for (let i = 0; i < 256; i++) {
      const intensity = i / 255;

      for (let c = 0; c < 3; c++) {
        const coeffs = colourData[channels[c]];
        let val = 0;

        for (let j = coeffs.length - 1; j >= 0; j--) {
          val = val * intensity + coeffs[j];
        }

        this.lut[i * 3 + c] = constrain(val * 255, 0, 255);
      }
    }
  }

  generateTextures(is3D) {
    const { params, terrain, camera, statistics } = this.m;
    const { 
      surfaceMap, lightDir, flatColour, steepColour, 
      sedimentColour, waterColour, skyColour, specularIntensity 
    } = params;

    const { size, area, heightMap, originalHeightMap, sedimentMap, dischargeMap } = terrain;

    if (surfaceMap !== "composite") {
      this.updateLUT(params.colourMap || "viridis");
    }

    const lightMag = Math.sqrt(lightDir.x ** 2 + lightDir.y ** 2 + lightDir.z ** 2) || 1;
    const lX = lightDir.x / lightMag;
    const lY = lightDir.y / lightMag;
    const lZ = lightDir.z / lightMag;

    let vX = 0, vY = 1, vZ = 0;
    if (is3D) {
      const v = camera.getViewDirection();
      vX = v.x; vY = v.y; vZ = v.z;
    }

    const bounds = this.calculateBounds(surfaceMap);

    this.canvas2D.loadPixels();
    this.heightMapTexture.loadPixels();

    for (let i = 0; i < area; i++) {
      const idx = i << 2;
      const hVal = heightMap[i];

      const hByte = (hVal * 255) | 0;
      this.heightMapTexture.pixels[idx] = hByte;
      this.heightMapTexture.pixels[idx + 1] = hByte;
      this.heightMapTexture.pixels[idx + 2] = hByte;
      this.heightMapTexture.pixels[idx + 3] = 255;

      let r, g, b;

      if (surfaceMap === "composite") {
        const x = i % size;
        const y = (i / size) | 0;
        const normal = terrain.getSurfaceNormal(x, y);

        const dot = normal.x * lX + normal.y * lY + normal.z * lZ;
        const diffuse = Math.max(0, dot);
        const sW = normal.y * 0.5 + 0.5;

        const shR = diffuse + (skyColour.r * 0.000588) * sW;
        const shG = diffuse + (skyColour.g * 0.000588) * sW;
        const shB = diffuse + (skyColour.b * 0.000588) * sW;

        const steep = 1 - normal.y;
        r = (normal.y * flatColour.r + steep * steepColour.r) * shR;
        g = (normal.y * flatColour.g + steep * steepColour.g) * shG;
        b = (normal.y * flatColour.b + steep * steepColour.b) * shB;

        const sed = sedimentMap[i];
        if (sed > 0) {
          const a = Math.min(1, sed * 5);
          r = (1 - a) * r + a * sedimentColour.r * shR;
          g = (1 - a) * g + a * sedimentColour.g * shG;
          b = (1 - a) * b + a * sedimentColour.b * shB;
        }

        const dis = terrain.getDischarge(i);
        if (dis > 0) {
          const a = Math.min(1, dis);
          const s = Math.max(0.3, 1 - dis * 0.25);

          r = (1 - a) * r + a * waterColour.r * s * shR;
          g = (1 - a) * g + a * waterColour.g * s * shG;
          b = (1 - a) * b + a * waterColour.b * s * shB;

          if (is3D) {
            const hX = lX + vX, hY = lY + vY, hZ = lZ + vZ;
            const hM = Math.sqrt(hX * hX + hY * hY + hZ * hZ) || 1;
            const ndotH = Math.max(0, (normal.x * hX + normal.y * hY + normal.z * hZ) / hM);
            const spec = Math.pow(ndotH, 120) * (specularIntensity || 255) * a;

            r = Math.min(255, r + spec);
            g = Math.min(255, g + spec);
            b = Math.min(255, b + spec);
          }
        }
      } else {
        let v = 0;
        if (surfaceMap === "height") {
          v = (hVal - bounds.min) / bounds.range;
        } else if (surfaceMap === "slope") {
          v = 1 - terrain.getSurfaceNormal(i % size, (i / size) | 0).y;
        } else if (surfaceMap === "discharge") {
          v = terrain.getDischarge(i);
        } else if (surfaceMap === "sediment") {
          v = (sedimentMap[i] - bounds.min) / bounds.range;
        } else if (surfaceMap === "delta") {
          v = 0.5 + (hVal - originalHeightMap[i]) * 10;
        }

        const lIdx = constrain((v * 255) | 0, 0, 255) * 3;
        r = this.lut[lIdx];
        g = this.lut[lIdx + 1];
        b = this.lut[lIdx + 2];
      }

      this.canvas2D.pixels[idx] = r;
      this.canvas2D.pixels[idx + 1] = g;
      this.canvas2D.pixels[idx + 2] = b;
      this.canvas2D.pixels[idx + 3] = 255;
    }

    this.canvas2D.updatePixels();
    this.heightMapTexture.updatePixels();
  }

  calculateBounds(mode) {
    const { statistics } = this.m;

    if (mode === "height") {
      const { min, max } = statistics.heightBounds;
      return { min, range: (max - min) || 1 };
    }

    if (mode === "discharge") {
      return { min: 0, range: statistics.peakDischarge || 1 };
    }

    if (mode === "sediment") {
      const { min, max } = statistics.sedimentBounds;
      return { min, range: (max - min) || 1 };
    }

    return { min: 0, range: 1 };
  }

  render() {
    const is3D = (this.m.params.displayMethod === "3D");

    this.generateTextures(is3D);

    if (is3D) {
      this.render3D();
    } else {
      this.render2D();
    }

	 this.renderOverlay();
  }

  render2D() {
    image(this.canvas2D, 0, 0, width, height);
  }

  render3D() {
    const { canvas3D, terrainShader, heightMapTexture, canvas2D } = this;
    const { terrain, params, camera } = this.m;
    const eye = camera.getEyePosition();
    const up = camera.getUpVector();

    canvas3D.background(params.skyColour.r, params.skyColour.g, params.skyColour.b);
    
    canvas3D.push();
    canvas3D.resetMatrix();
    canvas3D.perspective(PI / 3, width / height, 0.1, 30000);
    canvas3D.camera(eye.x, eye.y, eye.z, 0, 0, 0, up.x, up.y, up.z);

	 canvas3D.noStroke();
    canvas3D.shader(terrainShader);
    terrainShader.setUniform("uHeightMap", heightMapTexture);
    terrainShader.setUniform("uTexture", canvas2D);
    terrainShader.setUniform("uHeightScale", params.heightScale);

    const pSize = terrain.size * 2;
    canvas3D.plane(pSize, pSize, terrain.size - 1, terrain.size - 1);
    canvas3D.pop();

    image(canvas3D, 0, 0, width, height);
  }

  renderOverlay() {
    if (this.m.params.renderStats) this.renderStats();
    if (this.m.params.renderLegend) this.renderLegend();
  }

  renderStats() {
    push();
    const { statistics, params } = this.m;
    
    fill(255);
    textSize(15);
    textAlign(LEFT, TOP);

    const lines = [
      `FPS: ${statistics.fps.toFixed(2)}`,
      `Time: ${statistics.simulationTime.toFixed(2)}s`,
	   `Display Method: ${params.displayMethod}`,
      `Surface Map: ${params.surfaceMap}`,
	   `Colour Map: ${params.colourMap}`,
      `Elevation Range: ${statistics.minElevation.toFixed(3)} - ${statistics.maxElevation.toFixed(3)}`,
      `Peak Discharge: ${statistics.peakDischarge.toFixed(3)}`,
      `Rugosity Index: ${statistics.rugosity.toFixed(3)}`
    ];

    text(lines.join('\n'), 20, 20);
    pop();
  }

  renderLegend() {
    if (this.m.params.surfaceMap === "composite") {
      this.renderCompositeLegend();
    } else {
      this.renderDataLegend();
    }
  }

  renderCompositeLegend() {
    push();
    const { flatColour, steepColour, sedimentColour, waterColour } = this.m.params;
    
    const items = [
      { l: "Flat", c: flatColour },
      { l: "Steep", c: steepColour },
      { l: "Sediment", c: sedimentColour },
      { l: "Water", c: waterColour }
    ];

    textSize(14);
    textAlign(LEFT, CENTER);

    items.forEach((item, i) => {
      const y = 15 + i * 28;
      fill(item.c.r, item.c.g, item.c.b);
		stroke(255, 200);
		strokeWeight(1);
      rect(width - 110, y, 20, 20);
      
      fill(255);
		noStroke();
      text(item.l, width - 82, y + 10);
    });
    pop();
  }

  renderDataLegend() {
    push();
    const { surfaceMap, colourMap } = this.m.params;
    this.updateLUT(colourMap || "viridis");

    const x = width - 15;
    const y1 = 15;
    const y2 = height - 15;
    const w = 20;
    const h = y2 - y1;

    const grad = drawingContext.createLinearGradient(0, y1, 0, y2);
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      const idx = (((1 - t) * 255) | 0) * 3;
      grad.addColorStop(t, `rgb(${this.lut[idx]}, ${this.lut[idx+1]}, ${this.lut[idx+2]})`);
    }

	 drawingContext.strokeStyle = 'rgba(255, 255, 255, 0.78)';
    drawingContext.lineWidth = 1;

    drawingContext.fillStyle = grad;
    drawingContext.fillRect(x - w, y1, w, h);

    drawingContext.strokeRect(x - w, y1, w, h);

    const b = this.calculateBounds(surfaceMap);
    const labels = [
      { v: b.min + b.range, y: y1 },
      { v: b.min + b.range / 2, y: y1 + h / 2 },
      { v: b.min, y: y2 }
    ];

    fill(255);
    textSize(11);
    textAlign(RIGHT, CENTER);

    labels.forEach(l => {
      text(l.v.toFixed(3), x - w - 6, l.y);
      stroke(255, 100);
      line(x - w - 3, l.y, x - w, l.y);
    });
    pop();
  }

  resize() {
    const s = min(windowWidth, windowHeight);
    if (this.canvas3D) {
      this.canvas3D.resizeCanvas(s, s);
    }
  }
}