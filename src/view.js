import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { STEP, tuning } from './simulation.js'
import { surfacesAt } from './islands.js'

const palette = {
  night: 0x0e1430, fog: 0x1b2350, grass: 0x2f5d50, sand: 0xc9b48a, wood: 0x6b4a2f, sea: 0x12384a,
  amber: 0xffb347, core: 0xffe9b0, unlit: 0x5b5f6e, mote: 0xfff6c2, halo: 0xffe58a,
  ink: 0x120a1a, violet: 0x7a3cff, stunned: 0x3a3450, shirt: 0xe8e2d0,
  vermilion: 0xc8102e, gold: 0xf2c14e, drifter: 0x8fa3b8,
}
const amber = palette.amber
const material = (color, options = {}) => new THREE.MeshLambertMaterial({ color, ...options })
const cylinder = (top, bottom, height, sides = 12) => new THREE.CylinderGeometry(top, bottom, height, sides)
const planeRing = (inner, outer, sides = 64) => new THREE.RingGeometry(inner, outer, sides).rotateX(-Math.PI / 2)
const basic = (color, options = {}) => new THREE.MeshBasicMaterial({ color, ...options })

function glowTexture() {
  const size = 32
  const pixels = new Uint8Array(size * size * 4)
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const radius = Math.hypot(2 * (col + .5) / size - 1, 2 * (row + .5) / size - 1)
      const index = (row * size + col) * 4
      pixels.set([255, 255, 255, Math.round(255 * Math.max(0, 1 - radius) ** 2)], index)
    }
  }
  const texture = new THREE.DataTexture(pixels, size, size)
  texture.needsUpdate = true
  texture.magFilter = THREE.LinearFilter
  return texture
}

function mesh(parent, geometry, surface, x, y, z) {
  const object = new THREE.Mesh(geometry, surface)
  object.position.set(x, y, z)
  parent.add(object)
  return object
}

function makeIsland(scene, island) {
  const sea = mesh(scene, new THREE.PlaneGeometry(400, 350).rotateX(-Math.PI / 2), basic(palette.sea), 20, -.72, 0)
  sea.renderOrder = 1
  const sand = material(palette.sand)
  const grass = material(palette.grass)
  const wood = material(palette.wood)
  const ripple = basic(0x709b9e, { transparent: true, opacity: .22 })
  const rocks = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), material(0x647c83), island.bases.length * 25)
  const matrix = new THREE.Object3D()
  let index = 0
  for (const base of island.bases) {
    mesh(scene, cylinder(base.radius, base.radius - 1, 1.1, 80), sand, base.x, -.67, base.z)
    mesh(scene, cylinder(base.radius, base.radius, .13, 80), grass, base.x, -.065, base.z)
    for (const gap of [2.4, 6, 11]) {
      mesh(scene, planeRing(base.radius + gap, base.radius + gap + .05), ripple, base.x, -.71, base.z)
    }
    for (let i = 0; i < 25; i++) {
      const angle = i * 2.39996
      const radius = base.radius - 2 - i % 4
      matrix.position.set(base.x + radius * Math.cos(angle), .26, base.z + radius * Math.sin(angle))
      matrix.rotation.y = angle
      matrix.scale.set(.65 + i % 3 * .18, .34 + i % 5 * .09, .79)
      matrix.updateMatrix()
      rocks.setMatrixAt(index++, matrix.matrix)
    }
  }
  scene.add(rocks)
  if (island.bridge) {
    const { minX, maxX, minZ, maxZ } = island.bridge
    const width = maxZ - minZ
    const planks = new THREE.InstancedMesh(new THREE.BoxGeometry(.36, .24, width), wood, 50)
    matrix.rotation.set(0, 0, 0)
    matrix.scale.set(1, 1, 1)
    for (let i = 0; i < planks.count; i++) {
      matrix.position.set(minX + .18 + i * (maxX - minX) / planks.count, -.12, (minZ + maxZ) / 2)
      matrix.updateMatrix()
      planks.setMatrixAt(i, matrix.matrix)
    }
    scene.add(planks)
  }
  if (island.ring) {
    const { inner, outer, height } = island.ring
    const shape = new THREE.Shape()
    shape.moveTo(inner, 0)
    for (let i = 0; i <= 48; i++) shape.lineTo(outer * Math.cos(i * Math.PI / 48), -outer * Math.sin(i * Math.PI / 48))
    for (let i = 48; i >= 0; i--) shape.lineTo(inner * Math.cos(i * Math.PI / 48), -inner * Math.sin(i * Math.PI / 48))
    shape.closePath()
    const deck = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false }).rotateX(-Math.PI / 2)
    mesh(scene, deck, [grass, sand], 0, 0, 0)
    mesh(scene, cylinder(island.disc.radius, island.disc.radius, island.disc.height, 48), sand, 0, island.disc.height / 2 - .03, 0)
    mesh(scene, cylinder(island.disc.radius, island.disc.radius, .06, 48), grass, 0, island.disc.height - .03, 0)
    const tower = island.tower
    mesh(scene, cylinder(tower.radius, tower.radius, tower.height - 1.6, 16), wood, 0, tower.base + (tower.height - 1.6) / 2, 0)
    mesh(scene, cylinder(.15, 2.1, 1.6, 16), material(0x534868), 0, tower.base + tower.height - .8, 0)
  }
  for (const slope of island.ramps) {
    const [dx, dz] = slope.axis
    const coords = []
    for (const [along, y, side] of [[slope.outer, 0, -1], [slope.outer, 0, 1],
      [slope.inner, slope.height, -1], [slope.inner, slope.height, 1]]) {
      coords.push(along * dx - side * slope.width / 2 * dz, y + .012, along * dz + side * slope.width / 2 * dx)
    }
    const surface = new THREE.BufferGeometry()
    surface.setAttribute('position', new THREE.Float32BufferAttribute(coords, 3))
    surface.setIndex([0, 1, 2, 2, 1, 3])
    surface.computeVertexNormals()
    mesh(scene, surface, material(palette.wood, { side: THREE.DoubleSide }), 0, 0, 0)
  }
  for (const { pos: [x, y, z] } of island.pads) {
    mesh(scene, cylinder(1, 1, .1, 24), wood, x, y - .044, z)
    mesh(scene, planeRing(.72, 1, 24), basic(palette.gold), x, y + .02, z)
  }
}

function lanternFrameGeometry() {
  const frame = [cylinder(.13, .17, 2, 10).translate(0, 1.21, 0),
    cylinder(.53, .45, .13, 8).translate(0, 2.22, 0), cylinder(.11, .72, .39, 8).translate(0, 3.13, 0)]
  const geometry = mergeGeometries(frame)
  for (const piece of frame) piece.dispose()
  return geometry
}

function makeLantern(scene, markerLayer, lantern, frame, wood) {
  const root = new THREE.Group()
  root.position.fromArray(lantern.pos)
  scene.add(root)
  const stone = material(0x536966)
  const paper = material(palette.unlit)
  const core = mesh(root, cylinder(.42, .42, .63, 8), basic(palette.core), 0, 2.62, 0)
  mesh(root, cylinder(.83, .97, .21, 8), stone, 0, .105, 0)
  mesh(root, frame, wood, 0, 0, 0)
  mesh(root, cylinder(.53, .53, .68, 8), paper, 0, 2.62, 0)
  const shelter = mesh(root, planeRing(tuning.safe_radius - .06, tuning.safe_radius),
    new THREE.MeshBasicMaterial({ color: amber, transparent: true, opacity: .45, depthWrite: false }), 0, .023, 0)
  const glow = mesh(root, new THREE.SphereGeometry(.89, 12, 8),
    basic(palette.core, { transparent: true, opacity: .13, depthWrite: false }), 0, 2.62, 0)

  const label = document.createElement('span')
  label.className = 'marker'
  label.textContent = lantern.id
  markerLayer.append(label)
  return { paper, core, shelter, glow, label, lit: null }
}

function makePlayer(scene) {
  const shadow = mesh(scene, new THREE.CircleGeometry(.37, 24).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0x142c32, transparent: true, opacity: .47, depthWrite: false }), 0, .02, 0)
  const root = new THREE.Group()
  scene.add(root)
  const shirt = material(palette.shirt)
  const red = material(palette.vermilion)
  const dark = material(0x263149)
  const straw = material(0xe9b75b)
  const skin = material(0xce9069)
  mesh(root, cylinder(.24, .35, .69, 10), shirt, 0, .81, 0)
  mesh(root, cylinder(.29, .30, .105, 10), red, 0, .83, 0)
  mesh(root, new THREE.SphereGeometry(.23, 12, 8), skin, 0, 1.3, 0)
  mesh(root, cylinder(.027, .56, .34, 20), straw, 0, 1.62, 0)
  mesh(root, cylinder(.545, .56, .055, 20), material(0xb77a44), 0, 1.45, 0)
  const legs = [-.145, .145].map((x) => mesh(root, cylinder(.09, .092, .47, 8), dark, x, .27, 0))
  mesh(root, cylinder(.021, .021, .49, 8), dark, .45, 1.24, .05).rotation.z = -.44
  const smallLantern = basic(palette.core)
  mesh(root, cylinder(.115, .13, .22, 8), smallLantern, .55, .9, .05)
  mesh(root, cylinder(.1, .1, .065, 8), red, .55, .99, .05)
  const glow = mesh(scene, new THREE.PlaneGeometry(5, 5).rotateX(-Math.PI / 2),
    basic(palette.amber, { map: glowTexture(), transparent: true, opacity: .48, depthWrite: false }), 0, .023, 0)
  return { root, shadow, glow, legs }
}

function makeShade(scene) {
  const root = new THREE.Group()
  const ink = basic(palette.ink)
  const body = mesh(root, new THREE.IcosahedronGeometry(.57, 1), ink, 0, 0, 0)
  body.scale.set(.86, 1.22, .79)
  const outline = mesh(root, body.geometry, basic(palette.violet, { side: THREE.BackSide }), 0, 0, 0)
  outline.scale.copy(body.scale).multiplyScalar(1.07)
  const eye = basic(0xffc9fc)
  for (const x of [-.16, .16]) {
    mesh(root, new THREE.SphereGeometry(.061, 8, 6), eye, x, .13, .417)
  }
  scene.add(root)
  return { root, ink }
}

function drawMap(canvas, ctx, sim, yaw) {
  const mid = canvas.width / 2
  const bases = sim.island.bases
  const left = Math.min(...bases.map(({ x, radius }) => x - radius))
  const right = Math.max(...bases.map(({ x, radius }) => x + radius))
  const scale = (canvas.width - 17) / (right - left)
  const mapX = (x) => mid + (x - (left + right) / 2) * scale
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  for (const { x, z, radius } of bases) {
    ctx.beginPath()
    ctx.arc(mapX(x), mid + z * scale, radius * scale, 0, Math.PI * 2)
    ctx.fillStyle = '#2f5d50'
    ctx.fill()
    ctx.strokeStyle = '#52736d'
    ctx.stroke()
  }
  if (sim.island.bridge) {
    const { minX, maxX, minZ, maxZ } = sim.island.bridge
    ctx.fillStyle = '#c9b48a'
    ctx.fillRect(mapX(minX), mid + minZ * scale, (maxX - minX) * scale, (maxZ - minZ) * scale)
  }
  ctx.font = 'bold 12px system-ui'
  ctx.textAlign = 'center'
  for (const lantern of sim.lanterns) {
    const x = mapX(lantern.pos[0])
    const y = mid + lantern.pos[2] * scale
    ctx.beginPath()
    ctx.arc(x, y, 8, 0, Math.PI * 2)
    ctx.fillStyle = lantern.lit ? '#ffc16b' : '#16292d'
    ctx.fill()
    ctx.strokeStyle = lantern.lit ? '#ffe4ad' : '#a9c1b9'
    ctx.stroke()
    ctx.fillStyle = lantern.lit ? '#36210e' : '#f0f7de'
    ctx.fillText(lantern.id.slice(1), x, y + 4)
  }
  ctx.save()
  ctx.translate(mapX(sim.player.pos[0]), mid + sim.player.pos[2] * scale)
  ctx.rotate(-yaw)
  ctx.beginPath()
  ctx.moveTo(0, -6)
  ctx.lineTo(5, 4)
  ctx.lineTo(-5, 4)
  ctx.closePath()
  ctx.fillStyle = '#fff4c7'
  ctx.fill()
  ctx.restore()
}

function cameraDistance(island, [x, y, z], dx, dz, behind) {
  if (!island.tower) return behind
  for (let distance = .4; distance < behind; distance += .4) {
    const px = x + dx * distance
    const pz = z + dz * distance
    const py = y + 1.35 + 6.45 * distance / behind
    const { tower } = island
    const inTower = Math.hypot(px, pz) <= tower.radius + .18 && py >= tower.base && py <= tower.base + tower.height
    const inLedge = surfacesAt(island, px, pz).some((level) => level.y > 0 && py < level.y + .18)
    if (inTower || inLedge) return Math.max(0, distance - .45)
  }
  return behind
}

export class GameView {
  constructor(canvas, markerLayer, map, sim) {
    this.canvas = canvas
    this.markerLayer = markerLayer
    this.arrow = document.getElementById('lantern-arrow')
    this.map = map
    this.mapContext = map.getContext('2d')
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1))
    this.camera = new THREE.PerspectiveCamera(49, 1, .1, 185)
    this.projection = new THREE.Vector3()
    this.matrix = new THREE.Object3D()
    this.load(sim)
    this.resize()
    new ResizeObserver(() => this.resize()).observe(canvas.parentElement)
  }

  load(sim) {
    if (this.scene) dispose(this.scene)
    this.markerLayer.replaceChildren()
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(palette.night)
    this.scene.fog = new THREE.FogExp2(palette.fog, .014)
    this.sky = new THREE.AmbientLight(0xffffff, .15)
    const moon = new THREE.DirectionalLight(0xdce7ff, 1.05)
    moon.position.set(-12, 19, 9)
    this.scene.add(this.sky, moon)
    makeIsland(this.scene, sim.island)
    const frame = lanternFrameGeometry()
    const wood = material(palette.wood)
    this.lanterns = sim.lanterns.map((lantern) => makeLantern(this.scene, this.markerLayer, lantern, frame, wood))
    this.motes = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(.17, 0), basic(palette.mote), 64)
    this.halos = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(.28, 0),
      basic(palette.halo, { transparent: true, opacity: .22, depthWrite: false }), 64)
    this.leaves = new THREE.InstancedMesh(new THREE.PlaneGeometry(.2, .12),
      basic(0x81ac7e, { side: THREE.DoubleSide }), 16)
    for (const batch of [this.motes, this.halos, this.leaves]) {
      batch.frustumCulled = false
      this.scene.add(batch)
    }
    this.charms = sim.charms.map(({ pos: [x, y, z] }) => {
      const border = mesh(this.scene, new THREE.BoxGeometry(.37, .7, .09), basic(palette.gold), x, y + .8, z)
      mesh(border, new THREE.BoxGeometry(.29, .60, .105), basic(palette.vermilion), 0, 0, 0)
      return border
    })
    this.player = makePlayer(this.scene)
    this.shades = new Map()
    this.drifters = new Map()
    this.pulseRing = mesh(this.scene, planeRing(.94, 1),
      new THREE.MeshBasicMaterial({ color: 0xffd589, transparent: true, depthWrite: false }), 0, .05, 0)
    this.pulseTick = -60
    this.mapTick = -4
    this.mapYaw = NaN
    this.mapLit = -1
  }

  resize() {
    const { clientWidth: width, clientHeight: height } = this.canvas.parentElement
    this.camera.aspect = width / Math.max(1, height)
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(width, height, false)
  }

  draw(sim, yaw) {
    const [x, y, z] = sim.player.pos
    const t = sim.simTick * STEP
    this.player.root.position.set(x, y, z)
    const floor = Math.max(-.72, ...surfacesAt(sim.island, x, z).map((level) => level.y).filter((height) => height <= y + .001))
    this.player.shadow.position.set(x, floor + .02, z)
    this.player.shadow.visible = floor >= 0 && sim.player.respawning === 0
    this.player.glow.position.set(x, floor + .024, z)
    this.player.glow.visible = this.player.shadow.visible
    this.player.glow.material.opacity = .5 / Math.max(1, 1 + y - floor)
    this.player.root.visible = sim.player.respawning === 0 && (sim.player.invuln === 0 || Math.floor(t * 12) % 2 === 0)
    this.player.root.rotation.y = Math.atan2(...sim.player.facing)
    const walking = Math.hypot(sim.player.vel[0], sim.player.vel[2]) > .2
    this.player.legs[0].rotation.x = walking && sim.player.grounded ? Math.sin(t * 15) * .52 : 0
    this.player.legs[1].rotation.x = -this.player.legs[0].rotation.x
    const matrix = this.matrix
    const count = Math.min(sim.motes.length, 64)
    this.motes.count = this.halos.count = count
    matrix.rotation.set(0, 0, 0)
    for (let index = 0; index < count; index++) {
      const [mx, my, mz] = sim.motes[index].pos
      matrix.position.set(mx, my + .47 + .14 * Math.sin(t * 3.5 + index * 2.3), mz)
      matrix.updateMatrix()
      this.motes.setMatrixAt(index, matrix.matrix)
      this.halos.setMatrixAt(index, matrix.matrix)
    }
    this.motes.instanceMatrix.needsUpdate = this.halos.instanceMatrix.needsUpdate = true
    this.charms.forEach((charm, index) => {
      charm.visible = sim.charms[index].respawn === 0
      charm.rotation.y = t * 1.3
    })

    for (const shade of sim.shades) {
      if (!this.shades.has(shade.id)) this.shades.set(shade.id, makeShade(this.scene))
      const { root, ink } = this.shades.get(shade.id)
      root.position.fromArray(shade.pos)
      root.position.y += .12 * Math.sin(t * 4 + root.id)
      root.rotation.y = Math.atan2(x - shade.pos[0], z - shade.pos[2])
      ink.color.setHex(shade.state === 'stunned' ? palette.stunned : palette.ink)
    }
    const drifterIds = new Set(sim.drifters.map(({ id }) => id))
    for (const [id, ribbon] of this.drifters) {
      if (drifterIds.has(id)) continue
      ribbon.removeFromParent()
      dispose(ribbon)
      this.drifters.delete(id)
    }
    for (const drifter of sim.drifters) {
      if (!this.drifters.has(drifter.id)) {
        const ribbon = mesh(this.scene, new THREE.PlaneGeometry(1.5, .44),
          basic(palette.drifter, { side: THREE.DoubleSide }), 0, 0, 0)
        this.drifters.set(drifter.id, ribbon)
      }
      const ribbon = this.drifters.get(drifter.id)
      ribbon.position.fromArray(drifter.pos)
      ribbon.position.y += .23 * Math.sin(t * 8)
      ribbon.rotation.set(Math.sin(t * 7) * .4, yaw, Math.cos(t * 5) * .24)
    }

    const litCount = sim.lanterns.reduce((sum, lantern) => sum + Number(lantern.lit), 0)
    this.sky.intensity = .15 + .55 * litCount / sim.lanterns.length
    const elapsed = (sim.simTick - this.pulseTick) * STEP
    this.pulseRing.visible = elapsed < .48
    if (this.pulseRing.visible) {
      this.pulseRing.scale.setScalar(.2 + tuning.pulse_radius * elapsed / .48)
      this.pulseRing.material.opacity = .8 * (1 - elapsed / .48)
    }

    const behind = 11.7
    this.leaves.visible = sim.wind.warning || sim.wind.active
    if (this.leaves.visible) {
      const angle = sim.wind.dir_deg * Math.PI / 180
      for (let i = 0; i < this.leaves.count; i++) {
        const drift = (t * 7 + i * 2.3) % 27 - 13.5
        const lateral = i * 13 % 17 - 8
        matrix.position.set(x + drift * Math.cos(angle) - lateral * Math.sin(angle),
          Math.max(0, y) + 1 + i % 4, z + drift * Math.sin(angle) + lateral * Math.cos(angle))
        matrix.rotation.set(t + i, t * 2 + i, i)
        matrix.updateMatrix()
        this.leaves.setMatrixAt(i, matrix.matrix)
      }
      this.leaves.instanceMatrix.needsUpdate = true
    }

    const cameraY = Math.max(y, -2.8)
    const dx = Math.sin(yaw)
    const dz = Math.cos(yaw)
    const distance = cameraDistance(sim.island, [x, cameraY, z], dx, dz, behind)
    const ratio = distance / behind
    this.camera.position.set(x + dx * distance, cameraY + Math.max(2.7, 1.35 + 6.45 * ratio), z + dz * distance)
    this.camera.lookAt(x - dx * 3.3 * ratio, 1.25 + cameraY, z - dz * 3.3 * ratio)
    this.camera.updateMatrixWorld()
    sim.lanterns.forEach((lantern, index) => {
      const view = this.lanterns[index]
      if (view.lit !== lantern.lit) {
        view.lit = lantern.lit
        view.paper.color.setHex(lantern.lit ? amber : palette.unlit)
        view.paper.emissive.setHex(lantern.lit ? amber : 0)
        view.paper.emissiveIntensity = lantern.lit ? .65 : 0
        view.paper.transparent = lantern.lit
        view.paper.opacity = lantern.lit ? .66 : 1
        view.shelter.visible = lantern.lit
        view.core.visible = view.glow.visible = lantern.lit
        view.label.classList.toggle('lit', lantern.lit)
      }
      const point = this.projection.fromArray(lantern.pos)
      point.y += 3.69
      point.project(this.camera)
      view.label.hidden = Math.abs(point.x) >= .98 || Math.abs(point.y) >= .94 || Math.abs(point.z) >= 1
      if (!view.label.hidden) {
        const left = (point.x * .5 + .5) * this.canvas.clientWidth
        const top = (-point.y * .5 + .5) * this.canvas.clientHeight
        view.label.style.transform = `translate(${left}px, ${top}px) translate(-50%, -50%)`
      }
    })
    const nearest = sim.nearestUnlitLantern()
    this.arrow.hidden = !nearest || !this.lanterns[sim.lanterns.indexOf(nearest)].label.hidden
    if (!this.arrow.hidden) {
      const dx = nearest.pos[0] - x
      const dz = nearest.pos[2] - z
      const axis = Math.atan2(dx * Math.cos(yaw) - dz * Math.sin(yaw), -dx * Math.sin(yaw) - dz * Math.cos(yaw))
      this.arrow.style.left = `${50 + Math.sin(axis) * 32}%`
      this.arrow.style.top = `${48 - Math.cos(axis) * 31}%`
      this.arrow.firstElementChild.style.transform = `rotate(${axis}rad)`
      this.arrow.lastElementChild.textContent = nearest.id
    }
    if (sim.simTick - this.mapTick >= 4 || this.mapYaw !== yaw || this.mapLit !== litCount) {
      drawMap(this.map, this.mapContext, sim, yaw)
      this.mapTick = sim.simTick
      this.mapYaw = yaw
      this.mapLit = litCount
    }
    this.renderer.render(this.scene, this.camera)
  }

  showPulse(sim) {
    const [x, y, z] = sim.player.pos
    this.pulseRing.position.set(x, y + .05, z)
    this.pulseTick = sim.simTick
  }
}

function dispose(root) {
  const resources = new Set()
  root.traverse((node) => {
    if (node.geometry) resources.add(node.geometry)
    if (node.isInstancedMesh) node.dispose()
    for (const material of [].concat(node.material ?? [])) {
      resources.add(material)
      if (material.map) resources.add(material.map)
    }
  })
  for (const resource of resources) resource.dispose()
}
