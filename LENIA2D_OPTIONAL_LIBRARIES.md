# Optional JavaScript Libraries for LeniaND Port Enhancement

## 🎯 Purpose
This guide lists JavaScript libraries that can enhance Lenia2D p5.js towards full LeniaND equivalence through optional features.

---

## 💾 Core Enhancement Libraries

### 1. FFT-Based Convolution

**Library**: [fftjs](https://github.com/indutny/fftjs)

```bash
npm install fftjs
```

**Use Case**: 50-100x convolution speedup for grid sizes > 1024

**Integration**:
```javascript
import FFT from 'fftjs';

// In Automaton.convolve():
_convolveFFT(board) {
  const fft = new FFT.complex(board.size, false);
  // FFT of world
  const worldFFT = fft.createComplexArray();
  this._realToComplex(board.cells, worldFFT);
  fft.transform(worldFFT, worldFFT);
  
  // FFT of kernel
  const kernelFFT = fft.createComplexArray();
  this._realToComplex(this.kernel, kernelFFT);
  fft.transform(kernelFFT, kernelFFT);
  
  // Multiply
  for (let i = 0; i < worldFFT.length; i += 2) {
    const a = worldFFT[i], b = worldFFT[i+1];
    const c = kernelFFT[i], d = kernelFFT[i+1];
    worldFFT[i] = a*c - b*d;
    worldFFT[i+1] = a*d + b*c;
  }
  
  // Inverse FFT
  fft.inverseTransform(worldFFT, worldFFT);
  this._complexToReal(worldFFT, board.potential);
}
```

**When to use**: Simulations with R > 50 or grid ≥ 1024×1024

---

### 2. Polar FFT Analysis

**Library**: [fftjs](https://github.com/indutny/fftjs) + custom code

**Use Case**: Full polar coordinate analysis for symmetry detection

**Integration**:
```javascript
// In Analyser._detectSymmetry():
_detectSymmetryFullFFT(cells, size, stats) {
  const centerX = size / 2;
  const centerY = size / 2;
  const radius = Math.min(centerX * 0.8, 64);
  const angles = 32;
  
  // Sample polar coordinates
  const polarArray = new Float32Array(radius * angles);
  for (let r = 0; r < radius; r++) {
    for (let theta = 0; theta < angles; theta++) {
      const angle = (theta / angles) * 2 * Math.PI;
      const x = Math.round(centerX + r * Math.cos(angle));
      const y = Math.round(centerY + r * Math.sin(angle));
      if (x >= 0 && x < size && y >= 0 && y < size) {
        polarArray[r * angles + theta] = cells[y * size + x];
      }
    }
  }
  
  // Apply FFT to each radial slice
  const fft = new FFT.complex(angles, false);
  // Process to extract symmetry harmonics...
  
  return symmetryMetrics;
}
```

---

### 3. Multi-Threaded Computation

**Library**: [Comlink](https://github.com/GoogleChromeLabs/comlink)

```bash
npm install comlink
```

**Use Case**: Execute slow convolution steps in Web Worker (prevent UI freezing)

**automaton.worker.js**:
```javascript
import * as Comlink from 'comlink';

class AutomatonWorker {
  convolveParallel(board, automaton, workerCount = 4) {
    // Divide board into quadrants, process each in parallel
    const size = board.size;
    const quadSize = Math.floor(size / 2);
    
    const promises = [
      this.convolveQuadrant(board, 0, 0, quadSize),
      this.convolveQuadrant(board, quadSize, 0, quadSize),
      this.convolveQuadrant(board, 0, quadSize, quadSize),
      this.convolveQuadrant(board, quadSize, quadSize, quadSize)
    ];
    
    return Promise.all(promises);
  }
}

Comlink.expose(new AutomatonWorker());
```

**In sketch.js**:
```javascript
import * as Comlink from 'comlink';

let automatonWorker;

async function initWorker() {
  automatonWorker = Comlink.wrap(new Worker('automaton.worker.js'));
}

async function drawWithWorker() {
  if (params.running && automatonWorker) {
    automaton.potential = await automatonWorker.convolveParallel(board);
    board.potential.set(automaton.potential);
    automaton.step(board);
  }
}
```

**Performance**: 2-4x speedup on multi-core systems

---

### 4. WebAssembly Acceleration

**Library**: [Emscripten](https://emscripten.org/) or [AssemblyScript](https://www.assemblyscript.org/)

**Use Case**: 10-100x convolution speedup (compiled to native code)

**Example** (Wasm via AssemblyScript):
```typescript
// automaton.as (AssemblyScript)
export function convolveWasm(
  cellPtr: i32,
  kernelPtr: i32,
  potentialPtr: i32,
  size: i32,
  kernelSize: i32
): void {
  // Compiled Wasm code ~100x faster than JS
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let sum: f32 = 0;
      for (let ky = 0; ky < kernelSize; ky++) {
        for (let kx = 0; kx < kernelSize; kx++) {
          let cy = (y + ky - kernelSize/2 + size) % size;
          let cx = (x + kx - kernelSize/2 + size) % size;
          sum += load<f32>(cellPtr + (cy*size + cx)*4) * 
                 load<f32>(kernelPtr + (ky*kernelSize + kx)*4);
        }
      }
      store<f32>(potentialPtr + (y*size + x)*4, sum);
    }
  }
}
```

**When to use**: Production simulations with > 256×256 grids

---

## 📊 Data & Export Libraries

### 5. CSV Parsing & Export

**Library**: [PapaParse](https://www.papaparse.com/)

```bash
npm install papaparse
```

**Use Case**: Advanced CSV handling with proper escaping, large files

**Integration**:
```javascript
import Papa from 'papaparse';

// Enhanced CSV export
exportCSVAdvanced() {
  const data = [
    ['FPS', 'Gen', 'Time', 'Mass', 'Growth', ...], // headers
    ...this.series.map(row => row)
  ];
  
  const csv = Papa.unparse({
    data: data,
    header: true,
    dynamicTyping: false,
    quotes: true
  });
  
  return csv; // Proper quoting, escaping, etc.
}

// CSV import with validation
importCSVAdvanced(csvText) {
  const parsed = Papa.parse(csvText, {
    header: true,
    dynamicTyping: true,
    skipEmptyLines: true
  });
  
  if (parsed.errors.length) {
    console.error('CSV Parse errors:', parsed.errors);
  }
  
  return parsed.data;
}
```

---

### 6. Data Serialisation

**Library**: [msgpack](https://github.com/msgpack/msgpack-javascript)

```bash
npm install @msgpack/msgpack
```

**Use Case**: Compact binary format (2-5x smaller than JSON)

**Integration**:
```javascript
import { encode, decode } from '@msgpack/msgpack';

// Binary export
exportBinary() {
  const data = {
    size: this.size,
    params: this.params,
    cells: Array.from(this.cells),
    stats: this.getStats()
  };
  
  const binary = encode(data);
  return new Blob([binary], { type: 'application/octet-stream' });
}

// Binary import
async importBinary(blob) {
  const buffer = await blob.arrayBuffer();
  const data = decode(new Uint8Array(buffer));
  
  this.size = data.size;
  this.params = data.params;
  this.cells = new Float32Array(data.cells);
  
  return this;
}
```

---

## 🎨 Visualization Enhancements

### 7. 3D Visualization

**Library**: [Three.js](https://threejs.org/)

```bash
npm install three
```

**Use Case**: 3D slicing/projection of Lenia patterns

```javascript
import * as THREE from 'three';

class LeniaVisualizer3D {
  constructor(canvas, boardSize) {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
    this.renderer = new THREE.WebGLRenderer({ canvas });
  }
  
  renderSlice(board, sliceZ) {
    // Project 2D board to 3D with height map
    const geometry = new THREE.BufferGeometry();
    const positions = [];
    
    for (let y = 0; y < board.size; y++) {
      for (let x = 0; x < board.size; x++) {
        positions.push(
          x, 
          board.cells[y * board.size + x] * 10, // Height
          y
        );
      }
    }
    
    geometry.setAttribute('position', new THREE.BufferAttribute(
      new Float32Array(positions), 3
    ));
    
    const material = new THREE.MeshBasicMaterial();
    const mesh = new THREE.Mesh(geometry, material);
    this.scene.add(mesh);
  }
}
```

---

## 🔄 Advanced Features

### 8. Pattern Search/Evolution

**Library**: [Genetic Algorithm](https://github.com/subprotocol/genetic-js)

```bash
npm install genetic-js
```

**Use Case**: Automatically discover interesting patterns

```javascript
const GA = require('genetic-js');

const genetic = GA.create({
  mutationFunction: function(individual) {
    // Mutate automaton parameters
    return {
      m: individual.m + (Math.random() - 0.5) * 0.01,
      s: individual.s + (Math.random() - 0.5) * 0.005,
      R: Math.floor(individual.R + (Math.random() - 0.5) * 2)
    };
  },
  crossoverFunction: function(parent1, parent2) {
    return { 
      m: (parent1.m + parent2.m) / 2,
      s: (parent1.s + parent2.s) / 2,
      R: Math.max(parent1.R, parent2.R)
    };
  },
  fitnessFunction: function(individual) {
    // Fitness = interesting symmetry + movement
    automaton.updateParameters(individual);
    let fitness = stats.symmStrength * 100 + Math.abs(stats.speed) * 50;
    return fitness;
  },
  mutationProbability: 0.1,
  populationSize: 50,
  maxGenerations: 100
});
```

---

## 📱 Collaborative Features

### 9. Real-time Collaboration

**Library**: [Socket.io](https://socket.io/) + [Firestore](https://firebase.google.com/)

```bash
npm install socket.io-client firebase
```

**Use Case**: Multi-user simulation sharing

```javascript
import io from 'socket.io-client';
import { initializeApp } from 'firebase/app';

const socket = io('https://lenia-server.example.com');

socket.on('board_update', (data) => {
  board.cells.set(new Float32Array(data.cells));
  renderer.render(board, automaton, params.displayMode);
});

function shareBoardState() {
  socket.emit('board_update', {
    gen: automaton.gen,
    cells: Array.from(board.cells),
    params: params
  });
}
```

---

## 🚀 Installation Guide for All Enhancements

### Quick Setup (All optional libraries)

```bash
# Core enhancements
npm install fftjs comlink

# Data management
npm install papaparse @msgpack/msgpack

# Visualization
npm install three

# Advanced features
npm install genetic-js socket.io-client firebase

# Development
npm install --save-dev vite @vitejs/plugin-legacy
```

### Webpack Configuration (if using bundler)

```javascript
// vite.config.js
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    target: 'es2020',
    minify: 'terser'
  },
  worker: {
    format: 'es'
  }
});
```

---

## 📊 Performance Comparison

| Enhancement | Library | Speedup | Use Case |
|------------|---------|---------|----------|
| FFT Convolution | fftjs | 50-100x* | Large grids |
| Parallel Compute | Comlink+Workers | 2-4x | Multi-core CPUs |
| WebAssembly | Emscripten/AssemblyScript | 10-100x** | Production |
| Binary Compression | msgpack | 60-80% size | Storage/network |
| 3D Visualization | Three.js | Baseline | New dimension |

*Only for convolution-heavy workloads  
**Compared to pure JS

---

## ⚠️ Considerations

### Trade-offs

| Library | Pro | Con |
|---------|-----|-----|
| **FFT** | High speedup | Adds complexity, larger bundle |
| **WebWorkers** | Non-blocking UI | Message serialization overhead |
| **WebAssembly** | Maximum speedup | Browser support, toolchain setup |
| **Three.js** | Rich 3D | Huge dependency, overkill for 2D |
| **Comlink** | Easy worker API | Small overhead on each call |

### When NOT to Add

- Bundle size already >500KB?
- Target older browsers (IE11, Safari 12)?
- Simple 128×128 simulations only?
- → **Stick with current implementation**

### When To Add

- Grids > 512×512 expected?
- Simulations need to run 24/7 in production?
- Pattern discovery/evolution needed?
- Multi-user features desired?
- → **Integrate libraries strategically**

---

## 🔗 Quick Links

- **fftjs**: https://github.com/indutny/fftjs
- **Comlink**: https://github.com/GoogleChromeLabs/comlink
- **AssemblyScript**: https://www.assemblyscript.org/
- **Three.js**: https://threejs.org/
- **Socket.io**: https://socket.io/
- **PapaParse**: https://www.papaparse.com/

---

**Last Updated**: 17 March 2026  
**Status**: Reference guide for Lenia2D enhancements  
**Recommendation**: Start with **fftjs** if performance is bottleneck
