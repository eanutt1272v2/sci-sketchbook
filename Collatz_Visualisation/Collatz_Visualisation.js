const NUM_STARTS = 5000;
const MAX_START = 1000000;
const PATHS_PER_FRAME = 100;

const EVEN_ANGLE = -8.65;
const ODD_ANGLE = 16.0;

const scale = 0.2;

let startingNumbers = [];
let currentStartIndex = 0;

let treeEdges = new Map();
let nodePositions = new Map();

let maxCount = 0;

function setup() {
  createCanvas(windowWidth, windowHeight);
  angleMode(DEGREES);

  for (let i = 0; i < NUM_STARTS; i++) {
    startingNumbers.push(floor(random(2, MAX_START)));
  }

  nodePositions.set(1, { x: width / 2, y: height * 3.5, angle: 0 });
}

function draw() {
  if (currentStartIndex >= startingNumbers.length) {
    noLoop();
    console.log("Finished drawing all paths.");
    return;
  }

  const batchEnd = min(currentStartIndex + PATHS_PER_FRAME, startingNumbers.length);
  for (let i = currentStartIndex; i < batchEnd; i++) {
    let n = startingNumbers[i];
    let path = getCollatzPath(n);
    addPathToTree(path);
  }

  redrawTree();

  currentStartIndex = batchEnd;
}

function getCollatzPath(startNum) {
  let path = [startNum];
  let n = startNum;
  while (n > 1) {
    if (n % 2 === 0) {
      n = n / 2;
    } else {
      n = 3 * n + 1;
    }
    path.push(n);
  }
  return path.reverse();
}

function addPathToTree(path) {
  for (let i = 0; i < path.length - 1; i++) {
    let parent = path[i];
    let child = path[i + 1];
    let key = `${parent}-${child}`;

    if (treeEdges.has(key)) {
      treeEdges.get(key).count++;
    } else {
      treeEdges.set(key, { count: 1, parent, child });
    }
    maxCount = max(maxCount, treeEdges.get(key).count);
  }
}

function redrawTree() {
  background(0);

  for (const [key, edge] of treeEdges.entries()) {
    if (!nodePositions.has(edge.parent)) {
        continue;
    }

    const parentPos = nodePositions.get(edge.parent);
    let x1 = parentPos.x;
    let y1 = parentPos.y;
    let parentAngle = parentPos.angle;

    const angleChange = (edge.child % 2 === 0) ? EVEN_ANGLE : ODD_ANGLE;
    const newAngle = parentAngle + angleChange;

    const lengthScale = 120;
    const edgeLength = lengthScale / Math.log1p(edge.child);

    const x2 = x1 + edgeLength * cos(newAngle);
    const y2 = y1 + edgeLength * sin(newAngle);

    if (!nodePositions.has(edge.child)) {
        nodePositions.set(edge.child, { x: x2, y: y2, angle: newAngle });
    }

    const countRatio = Math.log1p(edge.count) / Math.log1p(maxCount);
    
    const thickness = map(countRatio, 0, 1, 0.1, 2.5) * 0.3;
    
    let r, g, b;
    const divider = 0.5;
    if (countRatio < 1) {
        r = map(countRatio, 0, divider, 40, 252);
        g = map(countRatio, 0, divider, 0, 100);
        b = map(countRatio, 0, divider, 90, 90);
    } else {
        r = map(countRatio, divider, 1, 252, 255);
        g = map(countRatio, divider, 1, 100, 100);
        b = map(countRatio, divider, 1, 90, 0);
    }

    stroke(r, g, b, 255);
    strokeWeight(thickness);
    line(x1 * scale, y1 * scale, x2 * scale, y2 * scale);
  }
}

Math.log1p = Math.log1p || function(x) { return Math.log(1 + x); };

