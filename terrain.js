var perlin    = require('perlin').noise.perlin2
var heightmap = require('heightmap-mesher')
var pack      = require('array-pack-2d')
var unindex   = require('unindex-mesh')
var reindex   = require('mesh-reindex')
var normals   = require('face-normals')
var Geometry  = require('gl-geometry')
var mat4      = require('gl-matrix').mat4
var vec3      = require('gl-matrix').vec3
var fill      = require('ndarray-fill')
var Texture   = require('gl-texture2d')
var ndarray   = require('ndarray')
var Shader    = require('glslify')
var Tree      = require('./tree')
var zeros     = require('zeros')

var RockShader = Shader({
    vert: './shaders/terrain.vert'
  , frag: './shaders/rock.frag'
  , transform: ['glslify-hex']
})

var TentShader = Shader({
    vert: './shaders/tent.vert'
  , frag: './shaders/tent.frag'
  , transform: ['glslify-hex']
})

var RockFactory = require('./rock')
var Rock = RockFactory(require('./models/stone2.obj')(false), RockShader)
var Tent = RockFactory(require('./models/tent.obj')(true, [1, 0, 0]), TentShader)

module.exports = createTerrain

var AMPLITUDE     = 2.5
var TREE_DENSITY  = 0.82
var ROCK_DENSITY  = 0.035
var TENT_DENSITY  = 0.02
var SCALE = 140
var SIZE  = 8
var HALF_SIZE = SIZE / 2

var identity = mat4.create()
var TerrainShader = Shader({
    vert: './shaders/terrain.vert'
  , frag: './shaders/terrain.frag'
  , transform: ['glslify-hex']
})

function createTerrain(gl) {
  var shader = TerrainShader(gl)
  var trees = []
  var rocks = []
  var tents = []
  var mesh = createMesh()
  var geom = Geometry(gl)
    .attr('position', mesh.positions)
    .attr('normal', mesh.normals)

  var texture = Texture(gl, require('./textures/grass'))

  texture.minFilter = gl.LINEAR
  texture.magFilter = gl.LINEAR

  var texture2 = Texture(gl, require('./textures/water'))
  texture2.minFilter = gl.LINEAR
  texture2.magFilter = gl.LINEAR

  shader.bind()
  shader.attributes.position.location = 0
  shader.attributes.normal.location = 1

  var w = mesh.map.shape[0]
  var min = [].slice.call(mesh.positions, 0, 3)
  for (var i = 0; i < mesh.positions.length; i+=9) {
    var triangle = getTriangle(mesh.positions, i)
    for (var k = 0; k < 20; k++) {
      var itemPos = randomPositionInTriangle(triangle)
      var X = itemPos[0]
      var Y = itemPos[1]
      var Z = itemPos[2]


      var r = Math.random()
      if (X > w/2 && Z < 50 && Y < 0) continue
      if (r < TREE_DENSITY) {
        trees.push(Tree(gl, X, Y, Z))
        continue
      }

      r -= TREE_DENSITY
      if (r < ROCK_DENSITY) {
        rocks.push(Rock(gl, X, Y, Z))
        continue
      }

      r -= ROCK_DENSITY
      if (r < TENT_DENSITY) {
        tents.push(Tent(gl, X, Y, Z))
        continue
      }

    }
  }

  return render

  function render(params) {
    trees[0].prerender(params)
    for (var i = 0; i < trees.length; i++) trees[i](params)
    trees[0].postrender(params)

    rocks[0] && rocks[0].prerender(params)
    for (var i = 0; i < rocks.length; i++) rocks[i](params)
    rocks[0] && rocks[0].postrender(params)

    tents[0] && tents[0].prerender(params)
    for (var i = 0; i < tents.length; i++) tents[i](params)
    tents[0] && tents[0].postrender(params)

    geom.bind(shader)

    shader.uniforms.tOverlay = texture.bind(0)
    shader.uniforms.tOverlay2 = texture2.bind(1)
    shader.uniforms.uLightDirection = params.lightDirection
    shader.uniforms.uLightThreshold = params.lightThreshold
    shader.uniforms.uProjection = params.proj
    shader.uniforms.uView = params.view
    shader.uniforms.uModel = identity

    geom.draw(gl.TRIANGLES)
    // geom.unbind()
  }
}

function createMesh() {
  var map = fill(zeros([SIZE, SIZE]), function(x, y) {
    x -= HALF_SIZE; y -= HALF_SIZE
    x /= SIZE;      y /= SIZE

    var h = 0

    h += (perlin(
        x * 3.1 + 293.94288
      , y * 3.1 + 12.238383
    ) + 1) * 0.075

    h += (perlin(
        x * 125.5 + 293.94288
      , y * 125.5 + 12.238383
    ) + 1) * 0.006125

    h *= AMPLITUDE

    return h > 0 ? h : 0
  })

  var pos = heightmap(map)
  var lowest = 0
  var ax = 0
  var ay = 0
  var az = 0
  var l = 1 / (pos.length / 3)
  for (var i = 0; i < pos.length;) {
    var x = pos[i] = (pos[i++] - 0.5) * SCALE
    var y = pos[i] = (pos[i++] - 0.5) * SCALE
    var z = pos[i] = (pos[i++] - 0.5) * SCALE
    ax += x * l; ay += y * l; az += z * l
  }

  for (var i = 0; i < pos.length;) {
    pos[i++] -= ax
    pos[i++] -= ay
    pos[i++] -= az
  }

  return {
    positions: pos
    , normals: normals(pos)
    , toWorld: toWorld
    , height: getHeight
    , map: map
  }

  function toWorld(p) {
    p[0] = (x - 0.5) * SCALE - ax
    p[1] = (y - 0.5) * SCALE - ay
    p[2] = (z - 0.5) * SCALE - az
  }

  function getHeight(x, z) {
    return (map.get(x, z) - 0.5) * SCALE - ay
  }
}

function getPoint(arr, index) {
  return [arr[index], arr[index + 1], arr[index + 2]]
}

function getTriangle(arr, index) {
  return [getPoint(arr, index), getPoint(arr, index + 3), getPoint(arr, index + 6)]
}

function randomPositionInTriangle(triangle) {
  var p1 = triangle[0]
  var p2 = triangle[1]
  var p3 = triangle[2]
  var A = vec3.fromValues(p1[0], p1[1], p1[2])
  var B = vec3.fromValues(p2[0], p2[1], p2[2])
  var C = vec3.fromValues(p3[0], p3[1], p3[2])
  var r1 = Math.random()
  var r2 = Math.random()
  vec3.scale(A, A, 1 - Math.sqrt(r1))
  vec3.scale(B, B, Math.sqrt(r1) * (1 - r2))
  vec3.scale(C, C, r2 * Math.sqrt(r1))
  var result = []
  vec3.add(result, A, B)
  vec3.add(result, result, C)
  return result
}
