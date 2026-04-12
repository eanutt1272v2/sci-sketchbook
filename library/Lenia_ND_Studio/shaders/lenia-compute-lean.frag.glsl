#version 300 es

precision highp float;
precision highp int;
precision highp sampler2D;

#define MAX_KERNEL_TAPS __MAX_KERNEL_TAPS__

in vec2 vUv;
out vec2 outColor;

uniform sampler2D uWorldTex;
uniform sampler2D uFieldOldTex;
uniform sampler2D uKernelTex;

uniform ivec2 uKernelTexSize;
uniform int uSize;
uniform int uKernelLen;
uniform int uGn;
uniform int uFlags;

uniform float uM;
uniform float uS;
uniform float uDt;
uniform float uH;
uniform float uParamP;

int wrapCoord(int coord, int span) {
  int outCoord = coord % span;
  return outCoord < 0 ? outCoord + span : outCoord;
}

float growthAt(float pot, float m, float s, int gn) {
  float diff = pot - m;
  if (gn == 2) {
    return exp(-(diff * diff) / (2.0 * s * s)) * 2.0 - 1.0;
  }
  if (gn == 3) {
    return abs(diff) <= s ? 1.0 : -1.0;
  }
  float base = max(0.0, 1.0 - (diff * diff) / (9.0 * s * s));
  return base * base * base * base * 2.0 - 1.0;
}

void main() {
  int fragX = int(floor(gl_FragCoord.x));
  int fragY = int(floor(gl_FragCoord.y));

  int x = fragX;
  int y = uSize - 1 - fragY;

  float potential = 0.0;
  for (int i = 0; i < MAX_KERNEL_TAPS; i++) {
    if (i >= uKernelLen) break;

    ivec2 kTexCoord = ivec2(i % uKernelTexSize.x, i / uKernelTexSize.x);
    vec4 tap = texelFetch(uKernelTex, kTexCoord, 0);

    int dx = int(round(tap.r));
    int dy = int(round(tap.g));
    float weight = tap.b;

    int sx = wrapCoord(x + dx, uSize);
    int sy = wrapCoord(y + dy, uSize);

    float src = texelFetch(uWorldTex, ivec2(sx, sy), 0).r;
    potential += src * weight;
  }

  float world = texelFetch(uWorldTex, ivec2(x, y), 0).r;
  float growth = growthAt(potential, uM, max(uS, 1e-6), uGn);

  bool softClip = (uFlags & 1) != 0;
  bool multiStep = (uFlags & 2) != 0;
  bool aritaMode = (uFlags & 4) != 0;
  bool hasFieldOld = (uFlags & 8) != 0;

  float d = aritaMode ? (growth + 1.0) * 0.5 - world : growth;
  if (multiStep && hasFieldOld && !aritaMode) {
    float previousGrowth = texelFetch(uFieldOldTex, ivec2(x, y), 0).r;
    d = 0.5 * (3.0 * growth - previousGrowth);
  }

  float delta = uDt * uH * d;
  float nextValue = world + delta;

  if (softClip) {
    float softK = 1.0 / max(uDt, 1e-6);
    float softC = exp(-softK);
    float a = exp(softK * nextValue);
    nextValue = log(1.0 / (a + 1.0) + softC) / (-softK);
  } else {
    nextValue = clamp(nextValue, 0.0, 1.0);
  }

  if (uParamP > 0.0) {
    nextValue = round(nextValue * uParamP) / uParamP;
  }

  nextValue = clamp(nextValue, 0.0, 1.0);
  outColor = vec2(nextValue, growth);
}
