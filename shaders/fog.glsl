#pragma glslify: fog = require(glsl-fog/exp)

float fogDensity(float factor) {
  float d = gl_FragCoord.z/gl_FragCoord.w;
  return fog(d - 40.0, 0.012 * factor);
}

float fogDensity() {
  float d = gl_FragCoord.z/gl_FragCoord.w;
  return fog(d - 40.0, 0.012);
}

#pragma glslify: export(fogDensity)
