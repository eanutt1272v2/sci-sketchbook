class Renderer {
  constructor(terrain, params, cameraData, gestureData, vertShader, fragShader, colourMaps) {
    this.terrain = terrain;
    this.params = params;
    this.cameraData = cameraData;
    this.gestureData = gestureData;
    this.colourMaps = colourMaps;

    this.canvas3D = createGraphics(width, height, WEBGL);
    this.terrainShader = this.canvas3D.createShader(vertShader, fragShader);

    this.canvas2D = createImage(terrain.size, terrain.size);
    this.heightMapTexture = createImage(terrain.size, terrain.size);

    this.lut = new Uint8ClampedArray(256 * 3);
    this.currentColourMap = "";
  }

  updateLUT(colourMap) {
    if (this.currentColourMap === colourMap) return;
    
    this.currentColourMap = colourMap;
    const colourData = this.colourMaps[colourMap];
    if (!colourData) return;

    const channels = ["r", "g", "b"];
    
    for (let i = 0; i < 256; i++) {
      const intensity = i / 255;
      const offset = i * 3;
        
      for (let c = 0; c < 3; c++) {
        const coeffs = colourData[channels[c]];
        let val = 0;
          
        for (let j = coeffs.length - 1; j >= 0; j--) {
          val = val * intensity + coeffs[j];
        }
          
        this.lut[offset + c] = Math.max(0, Math.min(255, val * 255));
      }
    }
  }

  generateTextures(is3D) {
    const { 
      surfaceMap, colourMap, lightDir, flatColour, steepColour, 
      sedimentColour, waterColour, skyColour, specularIntensity 
    } = this.params;
    
    const { terrain, canvas2D, heightMapTexture, lut, cameraData } = this;
    const { size, area, heightMap, sedimentMap, originalHeightMap } = terrain;

    if (surfaceMap !== "composite") {
      this.updateLUT(colourMap || "greyscale");
    }

    const lightMag = Math.sqrt(lightDir.x ** 2 + lightDir.y ** 2 + lightDir.z ** 2) || 1;
    const lightX = lightDir.x / lightMag;
    const lightY = lightDir.y / lightMag;
    const lightZ = lightDir.z / lightMag;

    const viewX = is3D ? cos(cameraData.rotX) * sin(cameraData.rotZ) : 0;
    const viewY = is3D ? cos(cameraData.rotX) * cos(cameraData.rotZ) : 1;
    const viewZ = is3D ? sin(cameraData.rotX) : 0;

    const bounds = this.calculateBounds(surfaceMap);
      
    canvas2D.loadPixels();
    heightMapTexture.loadPixels();

    for (let i = 0; i < area; i++) {
      const pixelIndex = i << 2;
      const heightByte = (heightMap[i] * 255) | 0;

      heightMapTexture.pixels[pixelIndex] = heightMapTexture.pixels[pixelIndex + 1] = heightMapTexture.pixels[pixelIndex + 2] = heightByte;
      heightMapTexture.pixels[pixelIndex + 3] = 255;

      let r, g, b;
        
      if (surfaceMap === "composite") {
        const x = i % size;
        const y = (i / size) | 0;
        const normal = terrain.getSurfaceNormal(x, y);
        
        const dotProduct = normal.x * lightX + normal.y * lightY + normal.z * lightZ;
        const diffuse = Math.max(0, dotProduct);
        
        const skyWeight = normal.y * 0.5 + 0.5; 
        const shadingR = diffuse + (skyColour.r / 255) * skyWeight * 0.15;
        const shadingG = diffuse + (skyColour.g / 255) * skyWeight * 0.15;
        const shadingB = diffuse + (skyColour.b / 255) * skyWeight * 0.15;

        const steepness = 1 - normal.y;
        const flatness = 1 - steepness;

        r = (flatness * flatColour.r + steepness * steepColour.r) * shadingR;
        g = (flatness * flatColour.g + steepness * steepColour.g) * shadingG;
        b = (flatness * flatColour.b + steepness * steepColour.b) * shadingB;

        const sediment = sedimentMap[i];
        if (sediment > 0) {
          const sedimentAlpha = Math.min(1, sediment * 5);
          r = (1 - sedimentAlpha) * r + sedimentAlpha * (sedimentColour.r * shadingR);
          g = (1 - sedimentAlpha) * g + sedimentAlpha * (sedimentColour.g * shadingG);
          b = (1 - sedimentAlpha) * b + sedimentAlpha * (sedimentColour.b * shadingB);
        }

        const discharge = terrain.getDischarge(i);
        if (discharge > 0) {
          const dischargeAlpha = Math.min(1, discharge);
          const dischargeShade = Math.max(0.3, 1 - discharge * 0.25);
          
          r = (1 - dischargeAlpha) * r + dischargeAlpha * (waterColour.r * dischargeShade * shadingR);
          g = (1 - dischargeAlpha) * g + dischargeAlpha * (waterColour.g * dischargeShade * shadingG);
          b = (1 - dischargeAlpha) * b + dischargeAlpha * (waterColour.b * dischargeShade * shadingB);

          if (is3D) {
            const halfX = lightX + viewX;
            const halfY = lightY + viewY;
            const halfZ = lightZ + viewZ;
            const halfMag = Math.sqrt(halfX * halfX + halfY * halfY + halfZ * halfZ) || 1;
            
            const normalDotHalf = Math.max(0, normal.x * (halfX / halfMag) + normal.y * (halfY / halfMag) + normal.z * (halfZ / halfMag));
            
            const specularShine = Math.pow(normalDotHalf, 120.0) * (specularIntensity || 255) * dischargeAlpha;
            
            r = Math.min(255, r + specularShine);
            g = Math.min(255, g + specularShine);
            b = Math.min(255, b + specularShine);
          }
        }
      } else {
        let value = 0;
        if (surfaceMap === "height") {
          value = (heightMap[i] - bounds.min) / bounds.range;
        } else if (surfaceMap === "slope") {
          value = 1 - terrain.getSurfaceNormal(i % size, (i / size) | 0).y;
        } else if (surfaceMap === "discharge") {
          value = terrain.getDischarge(i) / bounds.range;
        } else if (surfaceMap === "sediment") {
          value = (sedimentMap[i] - bounds.min) / bounds.range;
        } else if (surfaceMap === "delta") {
          value = 0.5 + (heightMap[i] - originalHeightMap[i]) * 10;
        }
          
        const lutIndex = ((value * 255) | 0) * 3;
        const safeIndex = Math.max(0, Math.min(765, lutIndex));
        
        r = lut[safeIndex]; 
        g = lut[safeIndex + 1]; 
        b = lut[safeIndex + 2];
      }

      canvas2D.pixels[pixelIndex] = r;
      canvas2D.pixels[pixelIndex + 1] = g;
      canvas2D.pixels[pixelIndex + 2] = b;
      canvas2D.pixels[pixelIndex + 3] = 255;
    }

    canvas2D.updatePixels();
    heightMapTexture.updatePixels();
  }

  render() {
    const is3D = (this.params.displayMethod === "3D");
    this.generateTextures(is3D);

    if (is3D) {
      this.render3D(this.params.heightScale);
    } else {
      this.render2D();
    }
  }

  render2D() {
    image(this.canvas2D, 0, 0, width, height);
  }

  render3D(heightScale) {
    const { canvas3D, canvas2D, terrainShader, heightMapTexture, cameraData } = this;
    const { rotX, rotZ, zoom } = cameraData;
    const { skyColour } = this.params;
    const { size } = this.terrain;

    canvas3D.background(skyColour.r, skyColour.g, skyColour.b);
    canvas3D.noStroke();

    const eyeX = zoom * (cos(rotX) * sin(rotZ));
    const eyeY = zoom * (cos(rotX) * cos(rotZ));
    const eyeZ = zoom * sin(rotX);

    canvas3D.push();
    canvas3D.resetMatrix();
    canvas3D.perspective(PI / 3, width / height, 0.1, 20000);
    canvas3D.camera(eyeX, eyeY, eyeZ, 0, 0, 0, 0, 0, -1);

    canvas3D.shader(terrainShader);
    terrainShader.setUniform("uHeightMap", heightMapTexture);
    terrainShader.setUniform("uTexture", canvas2D);
    terrainShader.setUniform("uHeightScale", heightScale);

    canvas3D.plane(size * 2, size * 2, size - 1, size - 1);
    canvas3D.pop();

    image(canvas3D, 0, 0, width, height);
  }

  calculateBounds(mode) {
    const { terrain } = this;
    const { area, heightMap, sedimentMap } = terrain;
      
    if (mode === "height") {
      const bound = terrain.getMapBounds(heightMap);
      return { min: bound.min, range: bound.max - bound.min || 1 };
    } 
    
    if (mode === "discharge") {
      let maxDischarge = 0;
		
      for (let i = 0; i < area; i++) {
        const discharge = terrain.getDischarge(i);
        if (discharge > maxDischarge) maxDischarge = discharge;
      }
		
      return { min: 0, range: maxDischarge || 1 };
    } 
    
    if (mode === "sediment") {
      const bound = terrain.getMapBounds(sedimentMap);
      return { min: bound.min, range: bound.max - bound.min || 1 };
    }
      
    return { min: 0, range: 1 };
  }

  handleWheel(e) {
    this.cameraData.zoom = max(20, this.cameraData.zoom + e.delta * 0.5);
  }

  handlePointer() { 
    const { gestureData } = this;
	  
    let points = touches.length > 0 ? touches : [];
    
    if (points.length === 0 && mouseIsPressed) {
      points = [{ x: mouseX, y: mouseY }];
    }

    if (points.length === 1) {
      this.handleOrbit(points[0]);
    } else if (points.length === 2) {
      this.handlePinch(points[0], points[1]);
    } else {
      gestureData.mode = null;
    }
  }

  handleOrbit(touch) {
    const { cameraData, gestureData } = this;
	  
    if (gestureData.mode !== "orbit") {
      gestureData.mode = "orbit";
      gestureData.prevX = touch.x;
      gestureData.prevY = touch.y;
      return;
    }
	  
    cameraData.rotZ -= (touch.x - gestureData.prevX) * 0.01;
    cameraData.rotX = constrain(cameraData.rotX + (touch.y - gestureData.prevY) * 0.01, 0.01, PI / 2);
	  
    gestureData.prevX = touch.x;
    gestureData.prevY = touch.y;
  }

  handlePinch(t1, t2) {
    const { cameraData, gestureData } = this;
    const distance = dist(t1.x, t1.y, t2.x, t2.y);
	  
    if (gestureData.mode !== "pinch") {
      gestureData.mode = "pinch";
      gestureData.pinchLastDist = distance;
      return;
    }
	  
    cameraData.zoom = max(20, cameraData.zoom / (distance / gestureData.pinchLastDist));
    gestureData.pinchLastDist = distance;
  }

  resize() {
    const canvasSize = min(windowWidth, windowHeight);
    resizeCanvas(canvasSize, canvasSize);
    if (this.canvas3D) this.canvas3D.resizeCanvas(canvasSize, canvasSize);
  }
}