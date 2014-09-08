precision mediump float;

#pragma glslify: fog = require(./fog)

#define GREEN_LIGHT     #9c9686
#define GREEN_DARK      #6e6b63
#define BLUE            #E0ECEF

uniform float uLightThreshold;
uniform vec3  uLightDirection;

varying vec3 aNormal;

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

  vec3 color = luminosity > uLightThreshold
    ? GREEN_LIGHT
    : GREEN_DARK;

  color = mix(color, BLUE, clamp(fog(fogness), 0.0, 1.0));

  gl_FragColor = vec4(color, 1.0);
}
