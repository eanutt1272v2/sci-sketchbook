class Renderer {
  constructor(solver, config) {
    this.solver = solver;
    this.config = config;
    this.buffer = null;
    this.maps = null;
  }

  async loadMaps(url) {
    const response = await fetch(url);
    this.maps = await response.json();
  }

  update() {
    const config = this.config;
    
    const res = config.resolution;
    
    if (!this.buffer || this.buffer.width !== res) this.buffer = createImage(res, res);

    let grid = new Float32Array(res * res);
    let peak = 1e-10;

    for (let y = 0; y < res; y++) {
      const pZ = map(y, 0, res - 1, -config.viewRadius, config.viewRadius);
      for (let x = 0; x < res; x++) {
        const pX = map(x, 0, res - 1, -config.viewRadius, config.viewRadius);
        const d = this.solver.getProbabilityDensity(pX, config.sliceY, pZ, config.n, config.l, config.m);
        
        grid[y * res + x] = d;
        if (d > peak) peak = d;
      }
    }

    this.buffer.loadPixels();
    
    const gamma = 1.0 / (1.0 + config.exposure);
    const mapData = this.maps[config.colourMap] || this.maps.inferno;
    const poly = (c, t) => c[0] + t * (c[1] + t * (c[2] + t * (c[3] + t * (c[4] + t * (c[5] + t * c[6])))));

    for (let i = 0; i < res * res; i++) {
      let norm = grid[i] / peak;
      
      const val = Math.pow(constrain(norm, 0, 1), gamma);
      const r = Math.floor(constrain(poly(mapData.r, val), 0, 1) * 255);
      const g = Math.floor(constrain(poly(mapData.g, val), 0, 1) * 255);
      const b = Math.floor(constrain(poly(mapData.b, val), 0, 1) * 255);
      
      this.buffer.pixels.set([r, g, b, 255], i * 4);
    }
    
    this.buffer.updatePixels();
  }

  display() {
    const config = this.config;
    
    if (this.buffer) image(this.buffer, 0, 0, width, height);
    
    if (config.displayData) {
      fill(255);
      noStroke();
      textAlign(LEFT, TOP);
      textSize(20);
      text(`n=${config.n}, l=${config.l}, m=${config.m}\nView Radius=${config.viewRadius.toFixed(2)} a₀\nSlice Y=${config.sliceY.toFixed(2)} a₀`, 20, 20);
    }
  }
}
