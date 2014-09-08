"use strict"
//
// "Prelude"
//
var fitter = document.querySelector('[data-fit]')

refit()
window.addEventListener('resize', refit, false)
function refit() {
  fitter.style.width  = window.innerWidth + 'px'
  fitter.style.height = window.innerHeight + 'px'
}

var preloader = document.getElementById('preloader')
setTimeout(function() {
  preloader.style.opacity = 0
  setTimeout(function() {
    preloader.style.display = 'none'
  }, 600)
}, 500)

//
// Constants
//
var SCROLL_AMOUNT = 0.0025
var DAY_LENGTH    = 8000
var RETINA        = false
var CONTROLLABLE  = false
var FPS_MIN       = 52
var FPS_MAX       = 60
var FPS_GAP       = 120

//
// Dependencies
//
var canvas   = document.querySelector('#viewbox canvas')
var gl       = require('gl-context')(canvas, render)
var Camera   = require('canvas-orbit-camera')
var mouse    = require('mouse-position')()
var debounce = require('frame-debounce')
var triangle = require('a-big-triangle')
var mat4     = require('gl-matrix').mat4
var vec3     = require('gl-matrix').vec3
var quat     = require('gl-matrix').quat
var Terrain  = require('./terrain')
var Texture  = require('gl-texture2d')
//var water    = require('./water')(gl)
var fit      = require('canvas-fit')
var Shader   = require('glslify')
var FBO      = require('gl-fbo')
var clear    = require('gl-clear')({
  color: [0xE0/0xFF, 0xEC/0xFF, 0xEF/0xFF, 0]
})

//
// General Setup
//
var stats  = null
var camera = Camera(canvas, {
    rotate: CONTROLLABLE
  , scale: CONTROLLABLE
  , pan: CONTROLLABLE
})

global.camera = camera

var CAMERA_Y_START = 8

var scenes = [
  {
    seed:{
      amplitude: 3.5,
      a: 255.57603543402918 + 10 * Math.random(),
      b: 259.15527208565095 + 10 * Math.random(),
      c: 412.29487132259004 + 10 * Math.random(),
      d: 408.7788971224922 + 10 * Math.random()

    },
    camera: {"rotation":[-0.00803025394203903,0.9689247173185889,-0.005334424354910124,0.24716786018315728],"center":[44.27042954065837,8,41.08271098934347],"distance":284.2857761047055}
  },
  {
    seed: {
      amplitude: 3.5,
      a: 261.2685889658734,
      b: 259.62888073498675,
      c: 415.78625821486406,
      d: 416.59670781950757
    },
    camera: {"rotation":[0.013730556194295812,0.9725875523351319,0.06963369430354002,0.2214409029221873],"center":[46.93985236086883,8,42.28140228294069],"distance":307.8231533582704}
  },
  {
    seed:{
      amplitude: 3.5,
      a: 255.5760354340292,
      b: 259.15527208565095,
      c: 412.29487132259004,
      d: 408.7788971224922
    },
    camera: {"rotation":[-0.009138637508895198,0.9931606310667358,0.013170264287105589,0.11565029330793694],"center":[-11.023798441281542,8,11.913573415891733],"distance":264.795348770936}
  },
  {
    seed:{
      amplitude: 3.5,
      a: 255.5760354340292,
      b: 259.15527208565095,
      c: 412.29487132259004,
      d: 408.7788971224922
    },
    camera: {"rotation":[-0.021389141912916916,0.9986115661358734,0.034319235785879136,-0.03375847512789078],"center":[16.468219751724973,8,26.8639250206179],"distance":242.47268795040304}
  },
  {
    seed:{
      amplitude: 3.5,
      a: 255.5760354340292,
      b: 259.15527208565095,
      c: 412.29487132259004,
      d: 408.7788971224922
    },
    camera: {"rotation":[0.016619529263241433,0.985122027038742,0.039638073414947426,-0.1663947301632471],"center":[-88.27863728976808,8,69.25739084422821],"distance":271.652979382491}
  },
  {
    seed:{
      amplitude: 3.5,
      a: 255.5760354340292,
      b: 259.15527208565095,
      c: 412.29487132259004,
      d: 408.7788971224922
    },
    camera: {"rotation":[-0.047317392765469875,0.9942419338515545,0.060130203472256914,-0.07502266286519385],"center":[23.742700565839186,8,53.07262899779016],"distance":284.2857761047055}
  }
]

var SCENE_INDEX = getRandomInt(1, scenes.length)
console.log('selected scene', SCENE_INDEX)
var scene = scenes[SCENE_INDEX]

scene.seed.amplitude += Math.random() * 0.2
scene.seed.a += Math.random() * 0.5
scene.seed.b += Math.random() * 0.5
scene.seed.c += Math.random() * 0.5
scene.seed.d += Math.random() * 0.5


var cameraPos = scene.camera
camera.center = cameraPos.center
camera.distance = cameraPos.distance
camera.rotation = cameraPos.rotation

var CAMERA_Y_START = cameraPos.center[1]

var terrain = Terrain(gl, scene)

var scales = [0.25, 0.5, 1]
var ratio  = (RETINA && window.devicePixelRatio) || 1
if (ratio !== 1) scales.push(ratio)

var scaler = require('canvas-autoscale')(canvas, {
    parent: window
  , target: [FPS_MIN, FPS_MAX]
  , scales: scales
  , gap: FPS_GAP
}, render)

//
// Framebuffers
//
var ray = FBO(gl, [256, 256], { color: 1, depth: true })
var fbo = FBO(gl, [256, 256], { color: 1, depth: true })

//
// Assets: LUTs
//
var luts = {
    normal: lf(Texture(gl, require('./luts/normal')))
  , sunset: lf(Texture(gl, require('./luts/sunset')))
  , night: lf(Texture(gl, require('./luts/night')))
  , day: lf(Texture(gl, require('./luts/day')))
  , day2: lf(Texture(gl, require('./luts/day2')))
}

function lf(tex) {
  tex.minFilter = gl.LINEAR
  tex.magFilter = gl.LINEAR
  return tex
}

//
// Assets: Shaders
//
var post = Shader({
    frag: './shaders/postprocessing.frag'
  , vert: './shaders/triangle.vert'
  , transform: ['glslify-hex']
})(gl)

var rayShader = Shader({
    frag: './shaders/ray.frag'
  , vert: './shaders/triangle.vert'
  , transform: ['glslify-hex']
})(gl)

//
// General
//
var params = {
    lightThreshold: 0.5
  , lightDirectionX: 0.58
  , lightDirectionY: 0.5
  , lightDirectionZ: 0.76
  , lightDirection: new Float32Array(3)
  , sunX: -0.0
  , sunY: -0.0
  , lut1: 'day'
  , lut2: 'day'
  , lutT: 0
  , time: 0
  , proj: mat4.create()
  , view: mat4.create()
  , camera: camera
}

if (process.env.NODE_ENV !== 'production') {
  stats = (new (require('./stats')))
  stats.begin()
  document.body.appendChild(stats.domElement)
}
global.gl = gl
//
// Render Loop
//
function render() {
  if (!fbo) return
  if (stats) stats.update()

  //
  // Screen Size
  //
  var scale  = Math.max(1, scaler.scale * 2)
  var height = (canvas.height / scale)|0
  var width  = (canvas.width / scale)|0
  var screenWidth  = width * scale
  var screenHeight = height * scale

  //
  // Dynamic Parameters
  //
  var dayTime = Date.now() / DAY_LENGTH
  var sunpos = [
      params.sunX + Math.sin(dayTime) * 1.8
    , params.sunY + Math.cos(dayTime) * 1.2
  ]

  updateLUT(
      (Math.cos(dayTime) + 1) * 1.5
    , (dayTime + Math.PI) % (Math.PI * 4) > Math.PI * 2
  )

  params.time = Date.now() / 100000 % 1000
  params.screenSize = [width, height]
  params.lightDirection[0] = sunpos[0] * 0.3
  params.lightDirection[1] = sunpos[1] * 1.4 - 0.2
  params.lightDirection[2] = 1
  vec3.normalize(params.lightDirection, params.lightDirection)

  //
  // View/Projection matrices
  //
  camera.center[1] = CAMERA_Y_START + window.scrollY * SCROLL_AMOUNT
  camera.view(params.view)
  camera.tick()

  mat4.perspective(params.proj
    , Math.PI / 9
    , canvas.width / canvas.height
    , 1.0
    , 1000
  )

  //
  // Draw the main scene
  //
  fbo.shape = [width, height]
  fbo.bind()

  gl.viewport(0, 0, width, height)
  gl.enable(gl.DEPTH_TEST)
  gl.enable(gl.CULL_FACE)

  clear(gl)

  terrain(params)
  //water(params)

  gl.disable(gl.DEPTH_TEST)
  gl.disable(gl.CULL_FACE)

  //
  // "Ray map" for godrays
  //
  ray.bind()
  ray.shape = [width, height]
  gl.viewport(0, 0, width, height)
  rayShader.bind()
  rayShader.uniforms.uScreenSize  = [width, height]
  rayShader.uniforms.uSunPosition = sunpos
  rayShader.uniforms.tScreen      = fbo.color[0].bind(0)
  triangle(gl)

  //
  // Post-processing
  //
  gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  gl.viewport(0, 0, screenWidth, screenHeight)

  post.bind()
  post.shape = [screenWidth, screenHeight]
  post.uniforms.tScreen      = fbo.color[0].bind(0)
  post.uniforms.tRays        = ray.color[0].bind(1)
  post.uniforms.tLUT1        = luts[params.lut1].bind(2)
  post.uniforms.tLUT2        = luts[params.lut2].bind(3)
  post.uniforms.uLUTT        = params.lutT
  post.uniforms.uTime        = params.time
  post.uniforms.uScreenSize  = [screenWidth, screenHeight]
  post.uniforms.uSunPosition = sunpos
  triangle(gl)
}

// Responsible for day/night cycle,
// which is entirely faked using color grading.
function updateLUT(t, n) {
  t = ((t+3) % 6)

  if (t < 2) {
    params.lut1 = n ? 'day' : 'day2'
    params.lut2 = 'sunset'
    params.lutT = Math.max(0, t - 1)
  } else
  if (t < 3) {
    params.lut1 = 'sunset'
    params.lut2 = 'night'
    params.lutT = t - 2
  } else
  if (t < 5) {
    params.lut1 = 'night'
    params.lut2 = 'sunset'
    params.lutT = Math.max(0, t - 4)
  } else
  if (t < 6) {
    params.lut1 = 'sunset'
    params.lut2 = n ? 'day' : 'day2'
    params.lutT = t - 5
  }
}

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min)) + min;
}
