let mandelbulbShader;

const cameraData = {
  dist: 3.0,
  rotX: 0.37,
  rotY: 0.37,
  target: [0, 0, 0],
  last: {}
};

const interaction = {
  isDragging: false,
  isPanning: false,
  startX: 0,
  startY: 0,
  startRotX: 0,
  startRotY: 0,
  startTarget: [0, 0, 0]
};

const settings = {
  resolution: 1.0,
  iterations: 64
};

function preload() {
  mandelbulbShader = loadShader('vert.glsl', 'frag.glsl');
}

function setup() {
  const canvasSize = min(windowWidth, windowHeight);
  createCanvas(windowWidth, windowHeight, WEBGL);
  
  pixelDensity(1);
  noStroke();
  
  syncLastParams();
}

function windowResized() {
  const canvasSize = min(windowWidth, windowHeight);
  resizeCanvas(canvasSize, canvasSize);
}

function draw() {
  shader(mandelbulbShader);
  
  const uniforms = {
    'u_resolution': [width, height],
    'u_camDist': cameraData.dist,
    'u_camRotX': cameraData.rotX,
    'u_camRotY': cameraData.rotY,
    'u_camTarget': cameraData.target,
    'u_maxIter': settings.iterations,
    'u_renderScale': settings.resolution
  };

  Object.entries(uniforms).forEach(([name, val]) => {
    mandelbulbShader.setUniform(name, val);
  });

  rect(-width / 2, -height / 2, width, height);
  
  if (hasViewChanged()) {
    syncLastParams();
  }
}


function handleInputStart() {
  interaction.isDragging = true;
  interaction.isPanning = keyIsDown(SHIFT);
  interaction.startX = mouseX;
  interaction.startY = mouseY;
  interaction.startRotX = cameraData.rotX;
  interaction.startRotY = cameraData.rotY;
  interaction.startTarget = [...cameraData.target];
  return false;
}

function handleInputMove() {
  if (!interaction.isDragging) return;

  const dx = mouseX - interaction.startX;
  const dy = mouseY - interaction.startY;

  if (interaction.isPanning) {
    const panSpeed = cameraData.dist * 0.002;
    const right = [cos(interaction.startRotY), 0, sin(interaction.startRotY)];
    const up = [0, 1, 0];

    cameraData.target[0] = interaction.startTarget[0] - right[0] * dx * panSpeed - up[0] * dy * panSpeed;
    cameraData.target[1] = interaction.startTarget[1] - right[1] * dx * panSpeed - up[1] * dy * panSpeed;
    cameraData.target[2] = interaction.startTarget[2] - right[2] * dx * panSpeed - up[2] * dy * panSpeed;
  } else {
    cameraData.rotY = interaction.startRotY - dx * 0.0075;
    cameraData.rotX = constrain(interaction.startRotX + dy * 0.0075, -PI / 2 + 0.01, PI / 2 - 0.01);
  }
  return false;
}

function handleInputEnd() {
  interaction.isDragging = false;
  interaction.isPanning = false;
  return false;
}

function mousePressed() { return handleInputStart(); }
function mouseDragged() { return handleInputMove(); }
function mouseReleased() { return handleInputEnd(); }

function touchStarted() { return handleInputStart(); }
function touchMoved() { return handleInputMove(); }
function touchEnded() { return handleInputEnd(); }

function mouseWheel(event) {
  cameraData.dist = constrain(cameraData.dist * (event.delta < 0 ? 0.9 : 1.1), 0.1, 20.0);
  return false;
}

function keyPressed() {
  if (key.toLowerCase() === 'r') {
    cameraData.dist = 3.0;
    cameraData.rotX = 0.3;
    cameraData.rotY = 0.5;
    cameraData.target = [0, 0, 0];
  }
}

function hasViewChanged() {
  return cameraData.dist !== cameraData.last.dist ||
         cameraData.rotX !== cameraData.last.rotX ||
         cameraData.rotY !== cameraData.last.rotY ||
         cameraData.target.some((v, i) => v !== cameraData.last.target[i]);
}

function syncLastParams() {
  cameraData.last = {
    dist: cameraData.dist,
    rotX: cameraData.rotX,
    rotY: cameraData.rotY,
    target: [...cameraData.target]
  };
}