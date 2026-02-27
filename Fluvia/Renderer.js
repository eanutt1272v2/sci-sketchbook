class Renderer {
  constructor(grid, params) {
    this.grid = grid;
    this.params = params;
    this.canvas = createImage(grid.size, grid.size);
  }

  resize(size) {
    this.canvas = createImage(size, size);
  }

  render() {
    const { flatColour, steepColour, waterColour, renderMode, lightDirection } = this.params;
    
    const gridSize = this.grid.size;
    const totalArea = this.grid.area;

    const lightMagnitude = Math.sqrt(lightDirection.x * lightDirection.x + lightDirection.y * lightDirection.y + lightDirection.z * lightDirection.z) || 1;

    const normalisedLightX = lightDirection.x / lightMagnitude;
    const normalisedLightY = lightDirection.y / lightMagnitude;
    const normalisedLightZ = lightDirection.z / lightMagnitude;

    this.canvas.loadPixels();
    
    const pixelArray = this.canvas.pixels;

    for (let cellIndex = 0; cellIndex < totalArea; cellIndex++) {
      let redChannel = 0;
      let greenChannel = 0;
      let blueChannel = 0;
      
      const pixelBufferIndex = cellIndex * 4;

      const coordinateX = cellIndex % gridSize;
      const coordinateY = (cellIndex / gridSize) | 0;

      if (renderMode === "composite") {
        const surfaceNormal = this.grid.getSurfaceNormal(coordinateX, coordinateY);
        const slopeSteepness = 1 - surfaceNormal.y;

        const dotProduct = surfaceNormal.x * normalisedLightX + surfaceNormal.y * normalisedLightY + surfaceNormal.z * normalisedLightZ;

        const lightIntensity = dotProduct > 0 ? (dotProduct < 0.15 ? 0.15 : dotProduct) : 0.15;

        const inverseSteepness = 1 - slopeSteepness;
        
        redChannel = (inverseSteepness * flatColour.r + slopeSteepness * steepColour.r) * lightIntensity;
        greenChannel = (inverseSteepness * flatColour.g + slopeSteepness * steepColour.g) * lightIntensity;
        blueChannel = (inverseSteepness * flatColour.b + slopeSteepness * steepColour.b) * lightIntensity;

        const waterDischarge = this.grid.getDischarge(cellIndex);
        
        if (waterDischarge > 0) {
          const waterAlpha = waterDischarge > 1 ? 1 : waterDischarge;
          const inverseAlpha = 1 - waterAlpha;

          const rawDepth = 1 - waterDischarge * 0.5;
          const clampedDepth = rawDepth < 0.3 ? 0.3 : rawDepth;

          const waterRed = waterColour.r * clampedDepth * lightIntensity;
          const waterGreen = waterColour.g * clampedDepth * lightIntensity;
          const waterBlue = waterColour.b * clampedDepth * lightIntensity;

          redChannel = inverseAlpha * redChannel + waterAlpha * waterRed;
          greenChannel = inverseAlpha * greenChannel + waterAlpha * waterGreen;
          blueChannel = inverseAlpha * blueChannel + waterAlpha * waterBlue;
        }
      } else if (renderMode === "height") {
        const heightValue = this.grid.heightMap[cellIndex] * 255;
        
        redChannel = greenChannel = blueChannel = heightValue;
      } else if (renderMode === "delta") {
        const heightDifference = this.grid.heightMap[cellIndex] - this.grid.originalHeightMap[cellIndex];
        const intensity = 500;

        if (heightDifference < 0) {
          const redValue = -heightDifference * intensity;
          
          redChannel = redValue > 255 ? 255 : redValue;
          greenChannel = blueChannel = 0;
        } else {
          const greenValue = heightDifference * intensity;
          
          greenChannel = greenValue > 255 ? 255 : greenValue;
          redChannel = blueChannel = 0;
        }
      } else if (renderMode === "slope") {
        const surfaceNormal = this.grid.getSurfaceNormal(coordinateX, coordinateY);
        
        const slopeValue = (1 - surfaceNormal.y) * 255; 
  
        redChannel = greenChannel = blueChannel = slopeValue;
      } else if (renderMode === "discharge") {
        const dischargeValue = this.grid.getDischarge(cellIndex) * 255;
        
        redChannel = dischargeValue * 0.2;
        greenChannel = dischargeValue * 0.6;
        blueChannel = dischargeValue;
      }
      
      pixelArray[pixelBufferIndex] = redChannel;
      pixelArray[pixelBufferIndex + 1] = greenChannel;
      pixelArray[pixelBufferIndex + 2] = blueChannel;
      pixelArray[pixelBufferIndex + 3] = 255;
    }

    this.canvas.updatePixels();
    image(this.canvas, 0, 0, width, height);
  }
}