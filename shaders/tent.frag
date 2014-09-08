precision mediump float;

#pragma glslify: fog = require(./fog)

#define ORANGE_LIGHT     #F2BD9D
#define ORANGE_DARK      #e8a286
#define GREY_LIGHT       #B09E78
#define GREY_DARK        #7E7051
#define BLUE             #E0ECEF

uniform float uLightThreshold;
uniform vec3  uLightDirection;

varying vec3 aNormal;
varying vec3 aIndex;

vec3 down = vec3(0.0, -1.0, 0.0);

void main() {
  float luminosity = clamp(dot(
      normalize(aNormal)
    , uLightDirection
  ), 0.0, 1.0);

  float fogness = clamp(dot(
      normalize(down)
    , uLightDirection
  ), 0.3, 1.0);

  float dark = abs(aIndex.x - 1.0) > 0.1
    ? 0.0
    : 1.0;

  vec3 color = mix(
      luminosity > uLightThreshold
      ? GREY_LIGHT
      : GREY_DARK
    , luminosity > uLightThreshold
      ? ORANGE_LIGHT
      : ORANGE_DARK
  , dark);

  color = mix(color, BLUE, clamp(fog(fogness), 0.0, 1.0));

  gl_FragColor = vec4(color, 1.0);
}
