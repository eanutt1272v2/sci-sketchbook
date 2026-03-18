class Analyser {
  static STAT_NAMES = {
    'p_m': 'Param m', 'p_s': 'Param s', 'n': 'Gen (#)', 't': 'Time (s)',
    'm': 'Mass (mg)', 'g': 'Growth (mg/s)', 'r': 'Gyradius (mm)',
    'd': 'Mass-growth distance (mm)', 's': 'Speed (mm/s)', 'w': 'Angular speed (deg/s)',
    'm_a': 'Mass asymmetry (mg)', 'x': 'X position (mm)', 'y': 'Y position (mm)',
    'l': 'Lyapunov exponent', 'k': 'Rotational symmetry', 'w_k': 'Rotational speed'
  };

  static STAT_HEADERS = Object.keys(Analyser.STAT_NAMES);

  constructor(statistics = null, displayData = null) {
    this.epsilon = 1e-10;
    this.series = [];
    this.segmentInit = 128;
    this.segmentLen = 512;
    this.statistics = statistics || {
      gen: 0,
      time: 0,
      mass: 0,
      growth: 0,
      maxValue: 0,
      gyradius: 0,
      centerX: 0,
      centerY: 0,
      massAsym: 0,
      speed: 0,
      angle: 0,
      symmSides: 0,
      symmStrength: 0,
      fps: 0
    };
    this.displayData = displayData || {
      frameCount: 0,
      lastTime: 0
    };

    this.reset();
  }

  reset() {
    this.mass = 0;
    this.growth = 0;
    this.maxValue = 0;
    this.gyradius = 0;
    this.centerX = 0;
    this.centerY = 0;
    this.massAsym = 0;
    this.lyapunov = 0;
    this.symmSides = 0;
    this.symmRotate = 0;
    this.lastCenterX = null;
    this.lastCenterY = null;
    this.totalShift = [0, 0];
  }

  analyse(board, automaton) {
    const stats = {};
    const size = board.size;
    const cells = board.cells;
    const field = board.field;
    const count = size * size;
    stats.mass = 0;
    stats.growth = 0;
    stats.maxValue = 0;
    let mx = 0;
    let my = 0;

    for (let i = 0; i < count; i++) {
      const val = cells[i];
      stats.mass += val;
      if (field[i] > 0) stats.growth += field[i];
      if (val > stats.maxValue) stats.maxValue = val;

      const x = i % size;
      const y = Math.floor(i / size);
      mx += val * x;
      my += val * y;
    }
    stats.centerX = stats.mass > this.epsilon ? mx / stats.mass : 0;
    stats.centerY = stats.mass > this.epsilon ? my / stats.mass : 0;

    let inertia = 0;
    if (stats.mass > this.epsilon) {
      for (let i = 0; i < count; i++) {
        const val = cells[i];
        if (val <= this.epsilon) continue;

        const x = i % size;
        const y = Math.floor(i / size);
        const dx = x - stats.centerX;
        const dy = y - stats.centerY;
        inertia += val * (dx * dx + dy * dy);
      }
    }

    stats.gyradius = stats.mass > this.epsilon ? Math.sqrt(inertia / stats.mass) : 0;
    if (this.lastCenterX !== null && stats.mass > this.epsilon) {
      const dx = stats.centerX - this.lastCenterX;
      const dy = stats.centerY - this.lastCenterY;
      const norm = Math.sqrt(dx * dx + dy * dy);

      if (norm > this.epsilon) {
        const nx = dx / norm;
        const ny = dy / norm;
        let massLeft = 0;
        let massRight = 0;

        for (let i = 0; i < count; i++) {
          const val = cells[i];
          if (val <= this.epsilon) continue;

          const x = i % size;
          const y = Math.floor(i / size);
          const px = x - stats.centerX;
          const py = y - stats.centerY;
          const side = px * ny - py * nx;

          if (side > 0) massRight += val;
          else massLeft += val;
        }

        stats.massAsym = massRight - massLeft;
      }
    }
    if (automaton && automaton.change && stats.maxValue > this.epsilon) {
      const sum = Array.from(automaton.change).reduce((a, b) => a + Math.abs(b), 0);
      if (sum > this.epsilon) {
        const l = Math.log(sum) - this.lyapunov;
        this.lyapunov += l / Math.max(1, (automaton.gen || 1));
      }
    }
    this._detectSymmetry(cells, size, stats);
    if (this.lastCenterX !== null) {
      const dx = stats.centerX - this.lastCenterX;
      const dy = stats.centerY - this.lastCenterY;
      stats.speed = Math.sqrt(dx * dx + dy * dy);
      stats.angle = Math.atan2(dy, dx) * 180 / Math.PI;
    } else {
      stats.speed = 0;
      stats.angle = 0;
    }

    this.lastCenterX = stats.centerX;
    this.lastCenterY = stats.centerY;

    return stats;
  }

  _detectSymmetry(cells, size, stats) {
    const center = size / 2;
    const radius = Math.min(center * 0.8, 64);
    const angularBins = 64;  
    const angles = new Float32Array(angularBins);
    for (let theta = 0; theta < angularBins; theta++) {
      const angle = (theta / angularBins) * 2 * Math.PI;
      let sum = 0;
      let count = 0;
      for (let r = 1; r < radius; r += 1) {
        const x = Math.round(center + r * Math.cos(angle));
        const y = Math.round(center + r * Math.sin(angle));
        
        if (x >= 0 && x < size && y >= 0 && y < size) {
          sum += cells[y * size + x];
          count++;
        }
      }
      
      angles[theta] = count > 0 ? sum / count : 0;
    }
    const harmonics = new Float32Array(angularBins / 2);
    for (let k = 0; k < angularBins / 2; k++) {
      let cosSum = 0;
      let sinSum = 0;
      
      for (let n = 0; n < angularBins; n++) {
        const phase = (2 * Math.PI * k * n) / angularBins;
        cosSum += angles[n] * Math.cos(phase);
        sinSum += angles[n] * Math.sin(phase);
      }
      harmonics[k] = Math.sqrt(cosSum * cosSum + sinSum * sinSum) / angularBins;
    }
    let maxHarmonic = 0;
    let maxIndex = 0;
    for (let k = 2; k < Math.min(16, angularBins / 2); k++) {
      if (harmonics[k] > maxHarmonic) {
        maxHarmonic = harmonics[k];
        maxIndex = k;
      }
    }
    let maxAll = Math.max(...harmonics);
    const symmStrength = maxAll > this.epsilon ? maxHarmonic / maxAll : 0;
    let rotSpeed = 0;
    if (this.lastCenterX !== null) {
      const angleOffset = Math.atan2(
        angles[angularBins / 4],
        angles[0]
      );
      rotSpeed = angleOffset * 180 / Math.PI;
    }
    
    stats.symmSides = maxIndex > 0 ? maxIndex : 0;
    stats.symmStrength = symmStrength;
    stats.rotationSpeed = rotSpeed;
    this.lastAngles = angles;
  }

  updateStatistics(board, automaton) {
    const statistics = this.statistics;
    const stats = this.analyse(board, automaton);

    statistics.gen = automaton.gen || 0;
    statistics.time = automaton.time || 0;
    statistics.mass = stats.mass;
    statistics.growth = stats.growth;
    statistics.maxValue = stats.maxValue;
    statistics.gyradius = stats.gyradius;
    statistics.centerX = stats.centerX;
    statistics.centerY = stats.centerY;
    statistics.massAsym = stats.massAsym || 0;
    statistics.speed = stats.speed || 0;
    statistics.angle = stats.angle || 0;
    statistics.symmSides = stats.symmSides || 0;
    statistics.symmStrength = stats.symmStrength || 0;
  }

  resetStatistics() {
    const statistics = this.statistics;
    statistics.gen = 0;
    statistics.time = 0;
    statistics.mass = 0;
    statistics.growth = 0;
    statistics.maxValue = 0;
    statistics.gyradius = 0;
    statistics.centerX = 0;
    statistics.centerY = 0;
    statistics.massAsym = 0;
    statistics.speed = 0;
    statistics.angle = 0;
    statistics.symmSides = 0;
    statistics.symmStrength = 0;
    statistics.fps = 0;
  }

  updateFps() {
    const displayData = this.displayData;
    const statistics = this.statistics;
    displayData.frameCount++;
    const now = millis();

    if (now - displayData.lastTime > 1000) {
      statistics.fps = Math.round(
        displayData.frameCount * 1000 / (now - displayData.lastTime)
      );
      displayData.frameCount = 0;
      displayData.lastTime = now;
    }
  }
  getStatRow() {
    const statistics = this.statistics;
    return [
      statistics.fps || 0,
      statistics.gen || 0,
      statistics.time || 0,
      statistics.mass || 0,
      statistics.growth || 0,
      statistics.gyradius || 0,
      statistics.centerX || 0,
      statistics.centerY || 0,
      statistics.massAsym || 0,
      statistics.speed || 0,
      statistics.angle || 0,
      statistics.symmSides || 0,
      statistics.symmStrength || 0
    ];
  }
  exportCSV() {
    const headers = 'FPS,Gen,Time,Mass,Growth,Gyradius,CenterX,CenterY,MassAsym,Speed,Angle,SymmSides,SymmStrength\n';
    let csv = headers;

    for (const row of this.series) {
      csv += row.join(',') + '\n';
    }

    return csv;
  }
  importCSV(csvText) {
    const lines = csvText.trim().split('\n');
    this.series = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => parseFloat(v) || 0);
      this.series.push(values);
    }
  }
}