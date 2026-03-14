
/**
 * @file Analyser.js
 * @author @eanutt1272.v2
 * @version 1.0.0
 */
class Analyser {
  analyse(board) {
    let mass = 0;
    let growth = 0;
    let maxValue = 0;
    let mx = 0, my = 0;

    for (let y = 0; y < board.size; y++) {
      for (let x = 0; x < board.size; x++) {
        const val = board.cells[y][x];
        mass += val;
        if (board.field[y][x] > 0) growth += board.field[y][x];
        if (val > maxValue) maxValue = val;
        mx += val * x;
        my += val * y;
      }
    }

    let gyradius = 0;
    if (mass > 0) {
      const cx = mx / mass;
      const cy = my / mass;
      let inertia = 0;

      for (let y = 0; y < board.size; y++) {
        for (let x = 0; x < board.size; x++) {
          const dx = x - cx;
          const dy = y - cy;
          inertia += board.cells[y][x] * (dx * dx + dy * dy);
        }
      }
      gyradius = Math.sqrt(inertia / mass);
    }

    return { mass, growth, maxValue, gyradius };
  }

  updateStatistics(board, params) {
    const stats = this.analyse(board);
    const dt = 1 / params.T;

    statistics.gen++;
    statistics.time = Math.round((statistics.time + dt) * 1000) / 1000;
    statistics.mass = stats.mass;
    statistics.growth = stats.growth;
    statistics.maxValue = stats.maxValue;
    statistics.gyradius = stats.gyradius;
  }

  resetStatistics() {
    statistics.gen = 0;
    statistics.time = 0;
    statistics.mass = 0;
    statistics.growth = 0;
    statistics.maxValue = 0;
    statistics.gyradius = 0;
  }

  updateFps() {
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
}