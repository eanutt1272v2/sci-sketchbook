attribute vec3 aPosition;
attribute vec2 aTexCoord;

uniform mat4 uProjectionMatrix;
uniform mat4 uModelViewMatrix;
uniform sampler2D uHeightMap;
uniform float uHeightScale;

varying vec2 vTexCoord;

void main() {
  vTexCoord = aTexCoord;
  
  float h = texture2D(uHeightMap, vTexCoord).r;
  
  vec3 pos = aPosition;
  pos.z += h * uHeightScale;

  gl_Position = uProjectionMatrix * uModelViewMatrix * vec4(pos, 1.0);
}