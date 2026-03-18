precision highp float;
    
uniform vec2 u_resolution;
uniform float u_camDist;
uniform float u_camRotX;
uniform float u_camRotY;
uniform vec3 u_camTarget;
uniform float u_maxIter;
uniform float u_renderScale;

const float POWER = 8.0;
const float BAILOUT = 2.0;
const float MAX_STEPS = 256.0;
const float MIN_DIST = 0.0001;
const float MAX_DIST = 256.0;

float mandelbulbDE(vec3 pos) {
  vec3 z = pos;
  float dr = 1.0;
  float r = 0.0;

  for (float i = 0.0; i < 4096.0; i++) {
    if (i >= u_maxIter) break;

    r = length(z);
    if (r > BAILOUT) break;

    float theta = acos(z.z / r);
    float phi = atan(z.y, z.x);
    dr = pow(r, POWER - 1.0) * POWER * dr + 1.0;

    float zr = pow(r, POWER);
    theta = theta * POWER;
    phi = phi * POWER;

    z = zr * vec3(
      sin(theta) * cos(phi),
      sin(theta) * sin(phi),
      cos(theta)
    );
    z += pos;
  }

  return 0.5 * log(r) * r / dr;
}

vec3 estimateNormal(vec3 p) {
  float eps = 0.0005;
  return normalize(vec3(
    mandelbulbDE(p + vec3(eps, 0, 0)) - mandelbulbDE(p - vec3(eps, 0, 0)),
    mandelbulbDE(p + vec3(0, eps, 0)) - mandelbulbDE(p - vec3(0, eps, 0)),
    mandelbulbDE(p + vec3(0, 0, eps)) - mandelbulbDE(p - vec3(0, 0, eps))
  ));
}

mat3 rotateX(float angle) {
  float c = cos(angle);
  float s = sin(angle);
  return mat3(
    1.0, 0.0, 0.0,
    0.0, c, -s,
    0.0, s, c
  );
}

mat3 rotateY(float angle) {
  float c = cos(angle);
  float s = sin(angle);
  return mat3(
    c, 0.0, s,
    0.0, 1.0, 0.0,
    -s, 0.0, c
  );
}

void main() {
  vec2 pixelCoord = floor(gl_FragCoord.xy / u_renderScale) * u_renderScale;
  vec2 uv = (pixelCoord - u_resolution * 0.5) / u_resolution.y;

  vec3 offset = vec3(0.0, 0.0, u_camDist);
  offset = rotateX(u_camRotX) * offset;
  offset = rotateY(u_camRotY) * offset;
  vec3 camPos = u_camTarget + offset;

  vec3 forward = normalize(u_camTarget - camPos);
  vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), forward));
  vec3 up = cross(forward, right);

  vec3 rayDir = normalize(forward + uv.x * right + uv.y * up);

  float totalDist = 0.0;
  vec3 pos = camPos;
  bool hit = false;
  float steps = 0.0;

  for (float i = 0.0; i < MAX_STEPS; i++) {
    float dist = mandelbulbDE(pos);
    totalDist += dist;
    pos += rayDir * dist;
    steps++;

    if (dist < MIN_DIST * totalDist) {
      hit = true;
      break;
    }

    if (totalDist > MAX_DIST) break;
  }

  vec3 colour = vec3(0.0);

  if (hit) {
    vec3 normal = estimateNormal(pos);
    vec3 lightDir = normalize(vec3(1.0, 1.0, 1.0));
    vec3 viewDir = normalize(camPos - pos);

    float diff = max(dot(normal, lightDir), 0.0);
    float ambient = 0.15;
    float ao = 1.0 - (steps / MAX_STEPS);

    vec3 baseColour = vec3(0.9, 0.9, 0.9);
    colour = baseColour * (ambient + diff * 0.7) * ao;

    vec3 halfDir = normalize(lightDir + viewDir);
    float spec = pow(max(dot(normal, halfDir), 0.0), 40.0);
    colour += vec3(spec * 0.6);

    float fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), 3.0);
    colour += vec3(0.2, 0.3, 0.4) * fresnel * 0.3;
  } else {
    float fog = smoothstep(0.0, 1.0, totalDist / MAX_DIST);
    colour = mix(vec3(0.15, 0.15, 0.2), vec3(0.0), fog);
  }

  gl_FragColor = vec4(colour, 1.0);
}