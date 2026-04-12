"use strict";

const _GLSL_MAX_KERNEL_TAPS = 8192;
const _GLSL_SHADER_PATHS = Object.freeze({
  vertex: "../shaders/lenia-compute.vert.glsl",
  fragment: "../shaders/lenia-compute.frag.glsl",
  fragmentLean: "../shaders/lenia-compute-lean.frag.glsl",
});

const _glslComputeState = {
  initAttempted: false,
  disabled: false,
  disableReason: "",
  canvas: null,
  gl: null,
  program: null,
  programLean: null,
  vao: null,
  vertexBuffer: null,
  uniforms: null,
  uniformsLean: null,
  runtime: null,
};

const _glslKernelState = {
  dx: null,
  dy: null,
  w: null,
  length: 0,
  version: 0,
};

const _glslKernelBankState = {
  kernels: [],
  nextVersion: 1,
};

const _glslMultiStepScratch = {
  cellCount: 0,
  channelCount: 0,
  sourceWorld: null,
  potentialTmp: null,
  growthTmp: null,
  changeTmp: null,
  dAccum: null,
  dWeight: null,
};

function _glslResolveUniforms(gl, program) {
  const uniforms = {
    uWorldTex: gl.getUniformLocation(program, "uWorldTex"),
    uFieldOldTex: gl.getUniformLocation(program, "uFieldOldTex"),
    uKernelTex: gl.getUniformLocation(program, "uKernelTex"),
    uKernelTexSize: gl.getUniformLocation(program, "uKernelTexSize"),
    uSize: gl.getUniformLocation(program, "uSize"),
    uKernelLen: gl.getUniformLocation(program, "uKernelLen"),
    uGn: gl.getUniformLocation(program, "uGn"),
    uFlags: gl.getUniformLocation(program, "uFlags"),
    uM: gl.getUniformLocation(program, "uM"),
    uS: gl.getUniformLocation(program, "uS"),
    uDt: gl.getUniformLocation(program, "uDt"),
    uH: gl.getUniformLocation(program, "uH"),
    uParamP: gl.getUniformLocation(program, "uParamP"),
  };

  if (
    uniforms.uWorldTex === null ||
    uniforms.uFieldOldTex === null ||
    uniforms.uKernelTex === null ||
    uniforms.uKernelTexSize === null ||
    uniforms.uSize === null ||
    uniforms.uKernelLen === null ||
    uniforms.uGn === null ||
    uniforms.uFlags === null ||
    uniforms.uM === null ||
    uniforms.uS === null ||
    uniforms.uDt === null ||
    uniforms.uH === null ||
    uniforms.uParamP === null
  ) {
    throw new Error("One or more GLSL uniforms could not be resolved");
  }

  return uniforms;
}

let _glslProbeCache = null;

function _glslLoseContext(gl) {
  try {
    const ext = gl.getExtension("WEBGL_lose_context");
    if (ext) ext.loseContext();
  } catch (_) { /* ignore */ }
}

function _glslProbeAvailability() {
  if (_glslProbeCache) return _glslProbeCache;
  let gl = null;
  try {
    const canvas = new OffscreenCanvas(1, 1);
    gl = canvas.getContext("webgl2");
    if (!gl) {
      _glslProbeCache = { available: false, reason: "WebGL2 not available" };
      return _glslProbeCache;
    }
    if (!gl.getExtension("EXT_color_buffer_float")) {
      _glslProbeCache = { available: false, reason: "EXT_color_buffer_float not available" };
      return _glslProbeCache;
    }
    _glslProbeCache = { available: true };
    return _glslProbeCache;
  } catch (error) {
    _glslProbeCache = { available: false, reason: String(error?.message || "Unknown probe error") };
    return _glslProbeCache;
  } finally {
    if (gl) _glslLoseContext(gl);
  }
}

function _glslCreateProgram(gl, vertexSource, fragmentSource) {
  const vertex = gl.createShader(gl.VERTEX_SHADER);
  if (!vertex) throw new Error("Failed to create vertex shader object");
  gl.shaderSource(vertex, vertexSource);
  gl.compileShader(vertex);
  if (!gl.getShaderParameter(vertex, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(vertex);
    gl.deleteShader(vertex);
    throw new Error(`Vertex shader compilation failed: ${log}`);
  }

  const fragment = gl.createShader(gl.FRAGMENT_SHADER);
  if (!fragment) {
    gl.deleteShader(vertex);
    throw new Error("Failed to create fragment shader object");
  }
  gl.shaderSource(fragment, fragmentSource);
  gl.compileShader(fragment);
  if (!gl.getShaderParameter(fragment, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(fragment);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    throw new Error(`Fragment shader compilation failed: ${log}`);
  }

  const program = gl.createProgram();
  if (!program) {
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    throw new Error("Failed to create program object");
  }
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    throw new Error(`Program linking failed: ${log}`);
  }

  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  return program;
}

async function _glslFetchShaderSource(relativePath) {
  const response = await fetch(relativePath);
  if (!response.ok) {
    throw new Error(`Failed to fetch shader "${relativePath}": ${response.status}`);
  }
  return response.text();
}

function _glslApplyKernelTapMacro(source) {
  return source.replace(
    "__MAX_KERNEL_TAPS__",
    String(_GLSL_MAX_KERNEL_TAPS),
  );
}

function _glslCapabilitySnapshot(requested = "cpu") {
  const device = normaliseComputeDevice(requested);
  const probe = _glslProbeAvailability();
  return {
    requested: device,
    active: device === "glsl" && probe.available ? "glsl" : "cpu",
    glslAvailable: probe.available,
  };
}

function _glslBindSamplerUniforms(gl, program, uniforms) {
  gl.useProgram(program);
  gl.uniform1i(uniforms.uWorldTex, 0);
  gl.uniform1i(uniforms.uFieldOldTex, 1);
  gl.uniform1i(uniforms.uKernelTex, 2);
  gl.useProgram(null);
}

function _glslCreateTexture(gl, width, height, internalFormat, format, type) {
  const texture = gl.createTexture();
  if (!texture) {
    throw new Error("Failed to create GLSL texture");
  }

  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    internalFormat,
    width,
    height,
    0,
    format,
    type,
    null,
  );
  gl.bindTexture(gl.TEXTURE_2D, null);
  return texture;
}

function _glslCreateRGBA32FTexture(gl, width, height) {
  return _glslCreateTexture(gl, width, height, gl.RGBA32F, gl.RGBA, gl.FLOAT);
}

function _glslCreateRG32FTexture(gl, width, height) {
  return _glslCreateTexture(gl, width, height, gl.RG32F, gl.RG, gl.FLOAT);
}

function _glslCreateR32FTexture(gl, width, height) {
  return _glslCreateTexture(gl, width, height, gl.R32F, gl.RED, gl.FLOAT);
}

function _glslDestroyTexture(gl, texture) {
  if (!gl || !texture) return;
  try {
    gl.deleteTexture(texture);
  } catch {
    // Ignore cleanup failures.
  }
}

function _glslDestroyFramebuffer(gl, framebuffer) {
  if (!gl || !framebuffer) return;
  try {
    gl.deleteFramebuffer(framebuffer);
  } catch {
    // Ignore cleanup failures.
  }
}

function _glslDestroyRuntime(gl, runtime) {
  if (!runtime) return;

  _glslDestroyTexture(gl, runtime.worldTex);
  _glslDestroyTexture(gl, runtime.fieldOldTex);
  _glslDestroyTexture(gl, runtime.kernelTex);
  _glslDestroyTexture(gl, runtime.outputTex);
  _glslDestroyTexture(gl, runtime.outputLeanTex);
  _glslDestroyFramebuffer(gl, runtime.framebuffer);
  _glslDestroyFramebuffer(gl, runtime.framebufferLean);
}

function _glslWarn(message, error = null) {
  try {
    if (error) {
      console.warn(`[LeniaWorker] ${message}`, error);
    } else {
      console.warn(`[LeniaWorker] ${message}`);
    }
  } catch {
    // Ignore logging failures.
  }
}

async function _glslEnsureState() {
  if (_glslComputeState.disabled) return null;
  if (_glslComputeState.gl && _glslComputeState.program) {
    return _glslComputeState;
  }

  if (_glslComputeState.initAttempted) {
    if (_glslComputeState.gl && _glslComputeState.program) {
      return _glslComputeState;
    }
    return null;
  }

  _glslComputeState.initAttempted = true;

  const probe = _glslProbeAvailability();
  if (!probe.available) {
    _glslComputeState.disabled = true;
    _glslComputeState.disableReason = probe.reason;
    return null;
  }

  try {
    const canvas = new OffscreenCanvas(4, 4);
    const gl = canvas.getContext("webgl2", {
      antialias: false,
      alpha: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
    });

    if (!gl) {
      _glslComputeState.disabled = true;
      _glslComputeState.disableReason = "WebGL2 context creation failed";
      return null;
    }

    if (!gl.getExtension("EXT_color_buffer_float")) {
      _glslLoseContext(gl);
      _glslComputeState.disabled = true;
      _glslComputeState.disableReason = "EXT_color_buffer_float is unavailable";
      return null;
    }

    const [vertexSourceRaw, fragmentSourceRaw, fragmentLeanSourceRaw] =
      await Promise.all([
        _glslFetchShaderSource(_GLSL_SHADER_PATHS.vertex),
        _glslFetchShaderSource(_GLSL_SHADER_PATHS.fragment),
        _glslFetchShaderSource(_GLSL_SHADER_PATHS.fragmentLean),
      ]);

    const vertexSource = _glslApplyKernelTapMacro(vertexSourceRaw);
    const fragmentSource = _glslApplyKernelTapMacro(fragmentSourceRaw);
    const fragmentLeanSource = _glslApplyKernelTapMacro(fragmentLeanSourceRaw);

    const program = _glslCreateProgram(gl, vertexSource, fragmentSource);
    let programLean = null;
    try {
      programLean = _glslCreateProgram(gl, vertexSource, fragmentLeanSource);
    } catch (error) {
      _glslWarn(
        "GLSL lean readback shader unavailable; using full readback path:",
        error,
      );
      programLean = null;
    }

    const vao = gl.createVertexArray();
    const vertexBuffer = gl.createBuffer();
    if (!vao || !vertexBuffer) {
      throw new Error("Failed to create GLSL draw state");
    }

    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW,
    );

    const positionLocation = gl.getAttribLocation(program, "aPosition");
    if (positionLocation < 0) {
      throw new Error("Shader attribute aPosition was not found");
    }

    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    const uniforms = _glslResolveUniforms(gl, program);
    _glslBindSamplerUniforms(gl, program, uniforms);

    let uniformsLean = null;
    if (programLean) {
      uniformsLean = _glslResolveUniforms(gl, programLean);
      _glslBindSamplerUniforms(gl, programLean, uniformsLean);
    }

    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.pixelStorei(gl.PACK_ALIGNMENT, 1);

    _glslComputeState.canvas = canvas;
    _glslComputeState.gl = gl;
    _glslComputeState.program = program;
    _glslComputeState.programLean = programLean;
    _glslComputeState.vao = vao;
    _glslComputeState.vertexBuffer = vertexBuffer;
    _glslComputeState.uniforms = uniforms;
    _glslComputeState.uniformsLean = uniformsLean;
    _glslComputeState.runtime = null;
    _glslComputeState.disabled = false;
    _glslComputeState.disableReason = "";
    return _glslComputeState;
  } catch (error) {
    _glslComputeState.disabled = true;
    _glslComputeState.disableReason = String(
      error?.message || "GLSL compute initialisation failed",
    );
    _glslWarn("GLSL compute initialisation failed:", error);
    return null;
  }
}

function _glslEnsureRuntime(gl, size, kernelLen) {
  const current = _glslComputeState.runtime;
  if (
    current &&
    current.size === size &&
    current.kernelCapacity >= kernelLen
  ) {
    return current;
  }

  if (current) {
    _glslDestroyRuntime(gl, current);
    _glslComputeState.runtime = null;
  }

  const maxTextureSize = Math.max(
    1,
    Math.floor(Number(gl.getParameter(gl.MAX_TEXTURE_SIZE)) || 1),
  );

  if (size > maxTextureSize) {
    _glslWarn(
      `GLSL compute fallback: simulation size ${size} exceeds max texture size ${maxTextureSize}`,
    );
    return null;
  }

  const kernelTexWidth = Math.max(
    1,
    Math.min(maxTextureSize, 1024, Math.max(1, Math.floor(kernelLen))),
  );
  const kernelTexHeight = Math.max(1, Math.ceil(kernelLen / kernelTexWidth));
  if (kernelTexHeight > maxTextureSize) {
    _glslWarn(
      `GLSL compute fallback: kernel texture ${kernelTexWidth}x${kernelTexHeight} exceeds max texture size ${maxTextureSize}`,
    );
    return null;
  }

  const pixelCount = size * size;
  const worldTex = _glslCreateR32FTexture(gl, size, size);
  const fieldOldTex = _glslCreateR32FTexture(gl, size, size);
  const kernelTex = _glslCreateRGBA32FTexture(gl, kernelTexWidth, kernelTexHeight);
  const outputTex = _glslCreateRGBA32FTexture(gl, size, size);

  const framebuffer = gl.createFramebuffer();
  if (!framebuffer) {
    throw new Error("Failed to create GLSL framebuffer");
  }

  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    gl.COLOR_ATTACHMENT0,
    gl.TEXTURE_2D,
    outputTex,
    0,
  );

  const framebufferStatus = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
  if (framebufferStatus !== gl.FRAMEBUFFER_COMPLETE) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    throw new Error(`GLSL framebuffer incomplete: 0x${framebufferStatus.toString(16)}`);
  }

  gl.bindFramebuffer(gl.FRAMEBUFFER, null);

  let outputLeanTex = null;
  let framebufferLean = null;
  let leanReadback = null;
  let leanAvailable = false;
  try {
    outputLeanTex = _glslCreateRG32FTexture(gl, size, size);
    framebufferLean = gl.createFramebuffer();
    if (!framebufferLean) {
      throw new Error("Failed to create lean GLSL framebuffer");
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, framebufferLean);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      outputLeanTex,
      0,
    );

    const leanStatus = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (leanStatus !== gl.FRAMEBUFFER_COMPLETE) {
      throw new Error(`Lean GLSL framebuffer incomplete: 0x${leanStatus.toString(16)}`);
    }

    leanReadback = new Float32Array(pixelCount * 2);
    leanAvailable = true;
  } catch (error) {
    _glslWarn("GLSL lean framebuffer unavailable, keeping full-readback mode:", error);
    _glslDestroyTexture(gl, outputLeanTex);
    _glslDestroyFramebuffer(gl, framebufferLean);
    outputLeanTex = null;
    framebufferLean = null;
    leanReadback = null;
    leanAvailable = false;
  } finally {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }
  const runtime = {
    size,
    pixelCount,
    kernelCapacity: kernelLen,
    kernelTexWidth,
    kernelTexHeight,
    worldTex,
    fieldOldTex,
    kernelTex,
    outputTex,
    outputLeanTex,
    framebuffer,
    framebufferLean,
    leanAvailable,
    worldPrev: new Float32Array(pixelCount),
    kernelUpload: new Float32Array(kernelTexWidth * kernelTexHeight * 4),
    readback: new Float32Array(pixelCount * 4),
    readbackLean: leanReadback,
    kernelVersion: -1,
  };

  _glslComputeState.runtime = runtime;
  return runtime;
}

function _glslUploadKernelIfNeeded(gl, runtime) {
  if (runtime.kernelVersion === _glslKernelState.version) return;

  runtime.kernelUpload.fill(0);
  const len = Math.min(_glslKernelState.length, runtime.kernelCapacity);
  for (let i = 0; i < len; i++) {
    const base = i * 4;
    runtime.kernelUpload[base] = _glslKernelState.dx[i];
    runtime.kernelUpload[base + 1] = _glslKernelState.dy[i];
    runtime.kernelUpload[base + 2] = _glslKernelState.w[i];
  }

  gl.bindTexture(gl.TEXTURE_2D, runtime.kernelTex);
  gl.texSubImage2D(
    gl.TEXTURE_2D,
    0,
    0,
    0,
    runtime.kernelTexWidth,
    runtime.kernelTexHeight,
    gl.RGBA,
    gl.FLOAT,
    runtime.kernelUpload,
  );
  gl.bindTexture(gl.TEXTURE_2D, null);

  runtime.kernelVersion = _glslKernelState.version;
}

function _glslUploadWorldInputs(gl, runtime, world, fieldOld, trackPrevious = false) {
  if (trackPrevious && runtime.worldPrev) {
    runtime.worldPrev.set(world);
  }

  gl.bindTexture(gl.TEXTURE_2D, runtime.worldTex);
  gl.texSubImage2D(
    gl.TEXTURE_2D,
    0,
    0,
    0,
    runtime.size,
    runtime.size,
    gl.RED,
    gl.FLOAT,
    world,
  );

  if (fieldOld instanceof Float32Array && fieldOld.length === world.length) {
    gl.bindTexture(gl.TEXTURE_2D, runtime.fieldOldTex);
    gl.texSubImage2D(
      gl.TEXTURE_2D,
      0,
      0,
      0,
      runtime.size,
      runtime.size,
      gl.RED,
      gl.FLOAT,
      fieldOld,
    );
  }

  gl.bindTexture(gl.TEXTURE_2D, null);
}

function _glslUnpackReadback(readback, size, world, potential, growth, change) {
  for (let y = 0; y < size; y++) {
    const srcRow = y * size;
    const dstRow = (size - 1 - y) * size;
    for (let x = 0; x < size; x++) {
      const src = srcRow + x;
      const dst = dstRow + x;
      const base = src * 4;
      world[dst] = readback[base];
      potential[dst] = readback[base + 1];
      growth[dst] = readback[base + 2];
      change[dst] = readback[base + 3];
    }
  }
}

function _glslUnpackLeanReadback(readback, size, world, growth, change, worldPrev) {
  for (let y = 0; y < size; y++) {
    const srcRow = y * size;
    const dstRow = (size - 1 - y) * size;
    for (let x = 0; x < size; x++) {
      const src = srcRow + x;
      const dst = dstRow + x;
      const base = src * 2;
      const nextValue = readback[base];
      world[dst] = nextValue;
      growth[dst] = readback[base + 1];
      change[dst] = nextValue - worldPrev[dst];
    }
  }
}

function glslGetCapability(requested = "cpu") {
  return _glslCapabilitySnapshot(requested);
}

function _glslClearKernelState() {
  _glslKernelState.dx = null;
  _glslKernelState.dy = null;
  _glslKernelState.w = null;
  _glslKernelState.length = 0;
  _glslKernelState.version = _glslKernelBankState.nextVersion++;
}

function _glslBuildKernelEntry(kernelInfo) {
  if (!kernelInfo || typeof kernelInfo !== "object") {
    return null;
  }

  const rawDx = kernelInfo.kernelDX;
  const rawDy = kernelInfo.kernelDY;
  const rawW = kernelInfo.kernelValues;

  if (
    !(rawDx instanceof Int16Array) ||
    !(rawDy instanceof Int16Array) ||
    !(rawW instanceof Float32Array)
  ) {
    return null;
  }

  const len = Math.min(rawDx.length, rawDy.length, rawW.length);
  if (len <= 0) {
    return null;
  }

  if (len > _GLSL_MAX_KERNEL_TAPS) {
    _glslWarn(
      `GLSL kernel tap limit exceeded (${len} > ${_GLSL_MAX_KERNEL_TAPS}); falling back to CPU`,
    );
    return null;
  }
  const keepCount = len;

  const dx = new Int32Array(keepCount);
  const dy = new Int32Array(keepCount);
  const w = new Float32Array(keepCount);
  let cursor = 0;
  let weightSum = 0;

  for (let i = 0; i < len; i++) {
    const wi = Number.isFinite(rawW[i]) ? rawW[i] : 0;
    if (cursor >= keepCount) break;
    dx[cursor] = rawDx[i] | 0;
    dy[cursor] = rawDy[i] | 0;
    w[cursor] = wi;
    weightSum += wi;
    cursor++;
  }

  if (cursor <= 0 || !Number.isFinite(weightSum) || weightSum <= 0) {
    return null;
  }

  const actualLen = cursor;
  const outDx = actualLen === dx.length ? dx : dx.slice(0, actualLen);
  const outDy = actualLen === dy.length ? dy : dy.slice(0, actualLen);
  const outW = actualLen === w.length ? w : w.slice(0, actualLen);

  const invWeightSum = 1 / weightSum;
  for (let i = 0; i < outW.length; i++) {
    outW[i] *= invWeightSum;
  }

  return {
    dx: outDx,
    dy: outDy,
    w: outW,
    length: outW.length,
    version: _glslKernelBankState.nextVersion++,
  };
}

function _glslApplyKernelEntry(entry) {
  if (!entry) {
    _glslClearKernelState();
    return false;
  }

  _glslKernelState.dx = entry.dx;
  _glslKernelState.dy = entry.dy;
  _glslKernelState.w = entry.w;
  _glslKernelState.length = entry.length;
  _glslKernelState.version = entry.version;
  return true;
}

function _glslGetKernelEntry(index = 0) {
  const kernels = _glslKernelBankState.kernels;
  if (!Array.isArray(kernels) || kernels.length <= 0) {
    if (
      _glslKernelState.dx &&
      _glslKernelState.dy &&
      _glslKernelState.w &&
      _glslKernelState.length > 0
    ) {
      return {
        dx: _glslKernelState.dx,
        dy: _glslKernelState.dy,
        w: _glslKernelState.w,
        length: _glslKernelState.length,
        version: _glslKernelState.version,
      };
    }
    return null;
  }

  const safeIndex = Math.max(
    0,
    Math.min(kernels.length - 1, Math.floor(Number(index) || 0)),
  );
  return kernels[safeIndex] || null;
}

function glslSetKernelInfos(kernelInfos) {
  const entries = Array.isArray(kernelInfos)
    ? kernelInfos
      .map((entry) => _glslBuildKernelEntry(entry))
      .filter((entry) => !!entry)
    : [];

  _glslKernelBankState.kernels = entries;
  _glslApplyKernelEntry(entries[0] || null);
}

function glslSetKernelInfo(kernelInfo) {
  glslSetKernelInfos(kernelInfo ? [kernelInfo] : []);
}

function _glslGetMultiStepScratch(cellCount, channelCount) {
  const total = cellCount * channelCount;
  if (
    _glslMultiStepScratch.cellCount !== cellCount ||
    _glslMultiStepScratch.channelCount !== channelCount ||
    !_glslMultiStepScratch.sourceWorld ||
    !_glslMultiStepScratch.potentialTmp ||
    !_glslMultiStepScratch.growthTmp ||
    !_glslMultiStepScratch.changeTmp ||
    !_glslMultiStepScratch.dAccum ||
    !_glslMultiStepScratch.dWeight ||
    _glslMultiStepScratch.dAccum.length !== total
  ) {
    _glslMultiStepScratch.cellCount = cellCount;
    _glslMultiStepScratch.channelCount = channelCount;
    _glslMultiStepScratch.sourceWorld = new Float32Array(cellCount);
    _glslMultiStepScratch.potentialTmp = new Float32Array(cellCount);
    _glslMultiStepScratch.growthTmp = new Float32Array(cellCount);
    _glslMultiStepScratch.changeTmp = new Float32Array(cellCount);
    _glslMultiStepScratch.dAccum = new Float32Array(total);
    _glslMultiStepScratch.dWeight = new Float32Array(total);
  }
  return _glslMultiStepScratch;
}

function _glslApplyAccumulatedDelta(world, change, dAccum, dWeight, params, size, channelCount) {
  const cellCount = size * size;
  const dt = 1 / Math.max(0.0001, Number(params?.T) || 10);
  const noiseAmp = (Number(params?.addNoise) || 0) / 10;
  const hasNoise = noiseAmp > 0;
  const mr = (Number(params?.maskRate) || 0) / 10;
  const hasMask = mr > 0;
  const softClip = Boolean(params?.softClip);
  const hasQuant = Number(params?.paramP) > 0;
  const quantP = Math.max(1, Math.round(Number(params?.paramP) || 1));
  const softK = softClip ? 1 / dt : 0;
  const softC = softClip ? Math.exp(-softK) : 0;

  const trig = typeof getTrigTables === "function" ? getTrigTables(size) : null;
  const cosT = trig?.cos;
  const sinT = trig?.sin;
  let acCosX = 0;
  let acSinX = 0;
  let acCosY = 0;
  let acSinY = 0;
  let acMass = 0;

  for (let c = 0; c < channelCount; c++) {
    const offset = c * cellCount;
    for (let y = 0; y < size; y++) {
      const row = offset + y * size;
      const cy = cosT ? cosT[y] : 0;
      const sy = sinT ? sinT[y] : 0;
      for (let x = 0; x < size; x++) {
        const idx = row + x;
        const denom = dWeight[idx] > 0 ? dWeight[idx] : 1;
        const deltaTerm = dAccum[idx] / denom;
        let newVal = world[idx] + deltaTerm;
        change[idx] = deltaTerm;

        if (hasNoise) newVal *= 1 + (Math.random() - 0.5) * noiseAmp;

        if (softClip) {
          const a = Math.exp(softK * newVal);
          newVal = Math.log(1 / (a + 1) + softC) / -softK;
        } else {
          if (newVal < 0) newVal = 0;
          else if (newVal > 1) newVal = 1;
        }

        if (hasQuant) newVal = Math.round(newVal * quantP) / quantP;
        if (!hasMask || Math.random() > mr) world[idx] = newVal;

        if (cosT && sinT) {
          const v = world[idx];
          acCosX += v * cosT[x];
          acSinX += v * sinT[x];
          acCosY += v * cy;
          acSinY += v * sy;
          acMass += v;
        }
      }
    }
  }

  if (cosT && sinT && typeof _stepCentreCache === "object" && _stepCentreCache) {
    _stepCentreCache.cosX = acCosX;
    _stepCentreCache.sinX = acSinX;
    _stepCentreCache.cosY = acCosY;
    _stepCentreCache.sinY = acSinY;
    _stepCentreCache.mass = acMass;
    _stepCentreCache.valid = true;
  }
}

async function glslStepSingle({
  world,
  potential,
  growth,
  fieldOld,
  params,
  channelCount,
  kernelCount,
  dimension,
  changeOut,
  preferLeanReadback = false,
}) {
  const requestedDevice = normaliseComputeDevice(params?.backendComputeDevice);
  if (requestedDevice !== "glsl") return null;

  const dim = Math.max(2, Math.floor(Number(dimension) || 2));
  if (dim > 2) return null;
  if (Math.max(1, Math.floor(Number(channelCount) || 1)) !== 1) return null;
  if (Math.max(1, Math.floor(Number(kernelCount) || 1)) !== 1) return null;

  if ((Number(params?.addNoise) || 0) > 0) return null;
  if ((Number(params?.maskRate) || 0) > 0) return null;

  const size = Math.max(1, Math.floor(Number(params?.size) || 0));
  const count = size * size;
  if (!(world instanceof Float32Array) || world.length !== count) return null;
  if (!(potential instanceof Float32Array) || potential.length !== count) return null;
  if (!(growth instanceof Float32Array) || growth.length !== count) return null;

  if (
    !_glslKernelState.dx ||
    !_glslKernelState.dy ||
    !_glslKernelState.w ||
    _glslKernelState.length <= 0 ||
    _glslKernelState.length > _GLSL_MAX_KERNEL_TAPS
  ) {
    return null;
  }

  const state = await _glslEnsureState();
  if (!state?.gl || !state.program || !state.uniforms) return null;

  const gl = state.gl;
  const runtime = _glslEnsureRuntime(gl, size, _glslKernelState.length);
  if (!runtime) return null;

  const hasFieldOld =
    fieldOld instanceof Float32Array && fieldOld.length === count;

  const flags =
    (Boolean(params?.softClip) ? 1 : 0) |
    (Boolean(params?.multiStep) ? 2 : 0) |
    (Boolean(params?.aritaMode) ? 4 : 0) |
    (hasFieldOld ? 8 : 0);

  const gn = Math.max(1, Math.min(3, Math.floor(Number(params?.gn) || 1)));
  const m = Number(params?.m) || 0.15;
  const s = Math.max(0.0001, Number(params?.s) || 0.015);
  const dt = 1 / Math.max(0.1, Number(params?.T) || 10);
  const h = Math.max(0.0001, Number(params?.h) || 1);
  const paramP = Math.max(0, Number(params?.paramP) || 0);

  const change =
    changeOut instanceof Float32Array && changeOut.length === count
      ? changeOut
      : new Float32Array(count);

  const useLeanReadback = Boolean(
    preferLeanReadback &&
      runtime.leanAvailable &&
      runtime.readbackLean &&
      state.programLean &&
      state.uniformsLean,
  );

  const program = useLeanReadback ? state.programLean : state.program;
  const uniforms = useLeanReadback ? state.uniformsLean : state.uniforms;
  const framebuffer = useLeanReadback ? runtime.framebufferLean : runtime.framebuffer;

  try {
    _glslUploadKernelIfNeeded(gl, runtime);
    _glslUploadWorldInputs(
      gl,
      runtime,
      world,
      hasFieldOld ? fieldOld : null,
      useLeanReadback,
    );

    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.viewport(0, 0, size, size);
    gl.disable(gl.BLEND);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);

    gl.useProgram(program);
    gl.bindVertexArray(state.vao);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, runtime.worldTex);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, runtime.fieldOldTex);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, runtime.kernelTex);

    gl.uniform2i(
      uniforms.uKernelTexSize,
      runtime.kernelTexWidth,
      runtime.kernelTexHeight,
    );
    gl.uniform1i(uniforms.uSize, size);
    gl.uniform1i(uniforms.uKernelLen, _glslKernelState.length);
    gl.uniform1i(uniforms.uGn, gn);
    gl.uniform1i(uniforms.uFlags, flags);

    gl.uniform1f(uniforms.uM, m);
    gl.uniform1f(uniforms.uS, s);
    gl.uniform1f(uniforms.uDt, dt);
    gl.uniform1f(uniforms.uH, h);
    gl.uniform1f(uniforms.uParamP, paramP);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    if (useLeanReadback) {
      gl.readPixels(0, 0, size, size, gl.RG, gl.FLOAT, runtime.readbackLean);
    } else {
      gl.readPixels(0, 0, size, size, gl.RGBA, gl.FLOAT, runtime.readback);
    }

    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.bindVertexArray(null);
    gl.useProgram(null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    if (useLeanReadback) {
      _glslUnpackLeanReadback(
        runtime.readbackLean,
        size,
        world,
        growth,
        change,
        runtime.worldPrev,
      );
    } else {
      _glslUnpackReadback(runtime.readback, size, world, potential, growth, change);
    }

    return {
      change,
      backend: "glsl",
      leanReadback: useLeanReadback,
    };
  } catch (error) {
    _glslWarn("GLSL compute step failed, falling back to CPU:", error);
    _glslDestroyRuntime(gl, runtime);
    _glslComputeState.runtime = null;
    return null;
  }
}

async function _glslStepMulti({
  world,
  potential,
  growth,
  fieldOld,
  params,
  channelCount,
  kernelCount,
  dimension,
  changeOut,
}) {
  const requestedDevice = normaliseComputeDevice(params?.backendComputeDevice);
  if (requestedDevice !== "glsl") return null;

  const dim = Math.max(2, Math.floor(Number(dimension) || 2));
  if (dim > 2) return { fallbackReason: "nd-dimension" };

  const size = Math.max(1, Math.floor(Number(params?.size) || 0));
  const cellCount = size * size;
  const channels = Math.max(1, Math.floor(Number(channelCount) || 1));
  const kernelsRequested = Math.max(1, Math.floor(Number(kernelCount) || 1));
  const total = cellCount * channels;

  if (!(world instanceof Float32Array) || world.length !== total) {
    return { fallbackReason: "invalid-world" };
  }
  if (!(potential instanceof Float32Array) || potential.length !== total) {
    return { fallbackReason: "invalid-potential" };
  }
  if (!(growth instanceof Float32Array) || growth.length !== total) {
    return { fallbackReason: "invalid-growth" };
  }

  const kernelEntries = new Array(kernelsRequested);
  for (let k = 0; k < kernelsRequested; k++) {
    const entry = _glslGetKernelEntry(k);
    if (!entry) return { fallbackReason: "kernel-unavailable" };
    kernelEntries[k] = entry;
  }

  const hasFieldOld =
    fieldOld instanceof Float32Array && fieldOld.length === total;
  const kernelParams = Array.isArray(params?.kernelParams)
    ? params.kernelParams
    : [];
  const selectedKernel = Math.max(
    0,
    Math.min(kernelsRequested - 1, Math.floor(Number(params?.selectedKernel) || 0)),
  );

  const scratch = _glslGetMultiStepScratch(cellCount, channels);
  const sourceWorld = scratch.sourceWorld;
  const potentialTmp = scratch.potentialTmp;
  const growthTmp = scratch.growthTmp;
  const changeTmp = scratch.changeTmp;
  const dAccum = scratch.dAccum;
  const dWeight = scratch.dWeight;

  dAccum.fill(0);
  dWeight.fill(0);
  potential.fill(0);
  growth.fill(0);

  for (let k = 0; k < kernelsRequested; k++) {
    const kp = resolveKernelStepParams(params, kernelParams[k], channels);
    if (kp.aritaMode && kp.c0 !== kp.c1) {
      return { fallbackReason: "cross-channel-arita" };
    }

    _glslApplyKernelEntry(kernelEntries[k]);

    const srcOffset = kp.c0 * cellCount;
    const dstOffset = kp.c1 * cellCount;
    sourceWorld.set(world.subarray(srcOffset, srcOffset + cellCount));

    const fieldOldView = hasFieldOld
      ? fieldOld.subarray(dstOffset, dstOffset + cellCount)
      : null;

    const passResult = await glslStepSingle({
      world: sourceWorld,
      potential: potentialTmp,
      growth: growthTmp,
      fieldOld: fieldOldView,
      params: {
        ...params,
        m: kp.m,
        s: kp.s,
        gn: kp.gn,
        h: kp.h,
        multiStep: kp.multiStep,
        aritaMode: kp.aritaMode,
        addNoise: 0,
        maskRate: 0,
      },
      channelCount: 1,
      kernelCount: 1,
      dimension: 2,
      changeOut: changeTmp,
      preferLeanReadback: false,
    });

    if (!(passResult?.change instanceof Float32Array)) {
      return { fallbackReason: "glsl-pass-failed" };
    }

    for (let i = 0; i < cellCount; i++) {
      const dst = dstOffset + i;
      dAccum[dst] += changeTmp[i];
      dWeight[dst] += kp.h;
    }

    if (k === selectedKernel) {
      potential.set(potentialTmp, dstOffset);
      growth.set(growthTmp, dstOffset);
    }
  }

  const change =
    changeOut instanceof Float32Array && changeOut.length === total
      ? changeOut
      : new Float32Array(total);

  _glslApplyAccumulatedDelta(
    world,
    change,
    dAccum,
    dWeight,
    params,
    size,
    channels,
  );

  _glslApplyKernelEntry(kernelEntries[0] || null);

  return {
    change,
    backend: "glsl",
    leanReadback: false,
    multiPass: true,
  };
}

async function glslStep(options) {
  const requestedDevice = normaliseComputeDevice(options?.params?.backendComputeDevice);
  if (requestedDevice !== "glsl") return null;

  const channels = Math.max(1, Math.floor(Number(options?.channelCount) || 1));
  const kernelsRequested = Math.max(1, Math.floor(Number(options?.kernelCount) || 1));
  const hasNoise = (Number(options?.params?.addNoise) || 0) > 0;
  const hasMask = (Number(options?.params?.maskRate) || 0) > 0;

  if (channels === 1 && kernelsRequested === 1 && !hasNoise && !hasMask) {
    return glslStepSingle(options);
  }

  return _glslStepMulti(options);
}

globalThis.glslGetCapability = glslGetCapability;
globalThis.glslSetKernelInfos = glslSetKernelInfos;
globalThis.glslSetKernelInfo = glslSetKernelInfo;
globalThis.glslStep = glslStep;
globalThis.glslStepSingle = glslStepSingle;
