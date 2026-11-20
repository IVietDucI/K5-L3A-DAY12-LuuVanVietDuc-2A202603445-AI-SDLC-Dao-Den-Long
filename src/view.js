import * as THREE from 'three'
import { ISLAND_RADIUS, STEP, tuning } from './simulation.js'

const amber = 0xffb64f
const material = (color, options = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.88, ...options })
const cylinder = (top, bottom, height, sides = 12) => new THREE.CylinderGeometry(top, bottom, height, sides)
const planeRing = (inner, outer, sides = 64) => new THREE.RingGeometry(inner, outer, sides).rotateX(-Math.PI / 2)

function mesh(parent, geometry, surface, x, y, z) {
  const object = new THREE.Mesh(geometry, surface)
  object.position.set(x, y, z)
  parent.add(object)
  return object
}

function makeIsland(scene) {
  mesh(scene, new THREE.PlaneGeometry(360, 360).rotateX(-Math.PI / 2), material(0x193d50), 0, -0.67, 0)
  mesh(scene, cylinder(24.65, 22.8, 1.15, 80), material(0x87795a), 0, -0.64, 0)
  mesh(scene, cylinder(ISLAND_RADIUS, 24.55, .19, 80), material(0x426c59), 0, -.095, 0)

  const ripple = new THREE.MeshBasicMaterial({ color: 0x5ea6a4, transparent: true, opacity: .25 })
  for (const radius of [25, 26.2, 28.7, 33.7, 40, 49]) {
    mesh(scene, planeRing(radius, radius + .045, 96), ripple, 0, -.665, 0)
  }

  const rock = new THREE.DodecahedronGeometry(1, 0)
  const stones = [material(0x5f8270), material(0x70887a), material(0x435d60)]
  const leaf = new THREE.IcosahedronGeometry(1, 0)
  const leaves = [material(0x2c5a4b), material(0x337654), material(0x4e8057)]
  for (let i = 0; i < 53; i++) {
    const angle = i * 2.39996
    const radius = 17 + 6.5 * ((i * 13) % 49) / 49
    const x = Math.cos(angle) * radius
    const z = Math.sin(angle) * radius
    const boulder = mesh(scene, rock, stones[i % 3], x, .19, z)
    boulder.scale.set(.45 + i % 5 * .12, .28 + i % 4 * .11, .43 + i % 3 * .17)
    boulder.rotation.y = angle
    const bush = mesh(scene, leaf, leaves[i % 3], x + .55, .28, z - .38)
    bush.scale.set(.55 + i % 3 * .2, .48 + i % 3 * .15, .6)
  }
  const gravel = new THREE.CircleGeometry(1, 10).rotateX(-Math.PI / 2)
  const gravelMat = material(0x567766)
  for (let path = 0; path < 5; path++) {
    const angle = Math.PI / 2 + path * Math.PI * 2 / 5
    for (let j = 1; j < 15; j++) {
      const rockAngle = angle + Math.sin(j * .7) * .04
      const radius = 1.2 + j * .91
      const stone = mesh(scene, gravel, gravelMat, Math.cos(rockAngle) * radius, .009, Math.sin(rockAngle) * radius)
      stone.scale.set(.45 + (j % 3) * .17, 1, .3 + (j % 4) * .14)
      stone.rotation.y = angle
    }
  }
}

function makeLantern(scene, markerLayer, lantern) {
  const root = new THREE.Group()
  root.position.fromArray(lantern.pos)
  scene.add(root)
  const stone = material(0x536966)
  const wood = material(0x634c3d)
  const roof = material(0x9a573d)
  const paper = material(0x876249, { emissive: 0xff9330, emissiveIntensity: .09 })
  mesh(root, cylinder(.83, .97, .21, 8), stone, 0, .105, 0)
  mesh(root, cylinder(.13, .17, 2, 10), wood, 0, 1.21, 0)
  mesh(root, cylinder(.53, .45, .13, 8), wood, 0, 2.22, 0)
  mesh(root, cylinder(.53, .53, .68, 8), paper, 0, 2.62, 0)
  for (let i = 0; i < 8; i++) {
    const angle = i * Math.PI / 4
    mesh(root, cylinder(.025, .025, .74, 5), wood, Math.cos(angle) * .535, 2.62, Math.sin(angle) * .535)
  }
  mesh(root, cylinder(.11, .72, .39, 8), roof, 0, 3.13, 0)
  const shelter = mesh(root, planeRing(tuning.safe_radius - .06, tuning.safe_radius),
    new THREE.MeshBasicMaterial({ color: amber, transparent: true, opacity: .45, depthWrite: false }), 0, .023, 0)
  const light = new THREE.PointLight(amber, 0, 13, 1.65)
  light.position.y = 2.53
  root.add(light)

  const label = document.createElement('span')
  label.className = 'marker'
  label.textContent = lantern.id
  markerLayer.append(label)
  return { paper, shelter, light, label, lit: null }
}

function makePlayer(scene) {
  const shadow = mesh(scene, new THREE.CircleGeometry(.37, 24).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0x142c32, transparent: true, opacity: .47, depthWrite: false }), 0, .02, 0)
  const root = new THREE.Group()
  scene.add(root)
  const teal = material(0x44ac9b)
  const red = material(0xc8523d)
  const dark = material(0x263149)
  const straw = material(0xe9b75b)
  const skin = material(0xce9069)
  mesh(root, cylinder(.24, .35, .69, 10), teal, 0, .81, 0)
  mesh(root, cylinder(.29, .30, .105, 10), red, 0, .83, 0)
  mesh(root, new THREE.SphereGeometry(.23, 12, 8), skin, 0, 1.3, 0)
  mesh(root, cylinder(.027, .56, .34, 20), straw, 0, 1.62, 0)
  mesh(root, cylinder(.545, .56, .055, 20), material(0xb77a44), 0, 1.45, 0)
  const legs = [-.145, .145].map((x) => mesh(root, cylinder(.09, .092, .47, 8), dark, x, .27, 0))
  mesh(root, cylinder(.021, .021, .49, 8), dark, .45, 1.24, .05).rotation.z = -.44
  const smallLantern = material(0xffcf75, { emissive: amber, emissiveIntensity: 1.4 })
  mesh(root, cylinder(.115, .13, .22, 8), smallLantern, .55, .9, .05)
  mesh(root, cylinder(.1, .1, .065, 8), red, .55, .99, .05)
  const lamp = new THREE.PointLight(amber, 8, 5, 1.6)
  lamp.position.set(.55, .9, .05)
  root.add(lamp)
  return { root, shadow, legs }
}

function makeShade(scene) {
  const root = new THREE.Group()
  const ink = material(0x231b3a, { emissive: 0x57326c, emissiveIntensity: .31 })
  const body = mesh(root, new THREE.IcosahedronGeometry(.57, 1), ink, 0, 0, 0)
  body.scale.set(.86, 1.22, .79)
  const eye = new THREE.MeshBasicMaterial({ color: 0xffc9fc })
  for (const x of [-.16, .16]) {
    mesh(root, new THREE.SphereGeometry(.061, 8, 6), eye, x, .13, .417)
    mesh(root, new THREE.ConeGeometry(.16, .36, 7), ink, x * 1.9, -.47, 0).rotation.z = x * 3
  }
  scene.add(root)
  return { root, ink }
}

function drawMap(canvas, ctx, sim, yaw) {
  const mid = canvas.width / 2
  const r = mid - 11
  const scale = r / ISLAND_RADIUS
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.beginPath()
  ctx.arc(mid, mid, r, 0, Math.PI * 2)
  ctx.fillStyle = '#263e41'
  ctx.fill()
  ctx.strokeStyle = '#52736d'
  ctx.stroke()
  ctx.font = 'bold 12px system-ui'
  ctx.textAlign = 'center'
  for (const lantern of sim.lanterns) {
    const x = mid + lantern.pos[0] * scale
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
  ctx.translate(mid + sim.player.pos[0] * scale, mid + sim.player.pos[2] * scale)
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

export class GameView {
  constructor(canvas, markerLayer, map, sim) {
    this.canvas = canvas
    this.map = map
    this.mapContext = map.getContext('2d')
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
    this.scene = new THREE.Scene()
    this.night = new THREE.Color(0x172740)
    this.dawn = new THREE.Color(0x655266)
    this.scene.background = this.night.clone()
    this.scene.fog = new THREE.FogExp2(this.night, .023)
    this.camera = new THREE.PerspectiveCamera(49, 1, .1, 170)
    this.sky = new THREE.HemisphereLight(0xb2d6fa, 0x7b7054, 1.35)
    const moon = new THREE.DirectionalLight(0xa7c2ff, 1.2)
    moon.position.set(-12, 19, 9)
    this.scene.add(this.sky, moon)
    makeIsland(this.scene)
    this.lanterns = sim.lanterns.map((lantern) => makeLantern(this.scene, markerLayer, lantern))
    const moteGeometry = new THREE.IcosahedronGeometry(.12, 0)
    const moteMaterial = new THREE.MeshBasicMaterial({ color: 0xffdf7e })
    const moteHalo = new THREE.MeshBasicMaterial({
      color: 0xffc75f, transparent: true, opacity: .18, depthWrite: false,
    })
    this.motes = sim.motes.map(({ pos: [x, y, z] }) => {
      const glow = mesh(this.scene, moteGeometry, moteMaterial, x, y + .46, z)
      mesh(glow, new THREE.IcosahedronGeometry(.245, 0), moteHalo, 0, 0, 0)
      return glow
    })
    this.player = makePlayer(this.scene)
    this.shades = new Map()
    this.pulseRing = mesh(this.scene, planeRing(.94, 1),
      new THREE.MeshBasicMaterial({ color: 0xffd589, transparent: true, depthWrite: false }), 0, .05, 0)
    this.pulseTick = -60
    this.projection = new THREE.Vector3()
    this.resize()
    new ResizeObserver(() => this.resize()).observe(canvas.parentElement)
  }

  resize() {
    const { clientWidth: width, clientHeight: height } = this.canvas.parentElement
    this.camera.aspect = width / Math.max(1, height)
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(width, height, false)
  }

  reset() {
    this.pulseTick = -60
    this.player.root.rotation.y = Math.PI
  }

  draw(sim, yaw, walking, wallTime) {
    const [x, y, z] = sim.player.pos
    const t = sim.tick * STEP
    this.player.root.position.set(x, y, z)
    this.player.shadow.position.set(x, .02, z)
    this.player.root.visible = sim.tick >= sim.player.invulnerableUntil || Math.floor(t * 12) % 2 === 0
    if (walking) this.player.root.rotation.y = Math.atan2(walking[0], walking[1])
    this.player.legs[0].rotation.x = walking && y === 0 ? Math.sin(t * 15) * .52 : 0
    this.player.legs[1].rotation.x = -this.player.legs[0].rotation.x
    this.motes.forEach((mote, index) => {
      mote.visible = sim.motes[index].active
      mote.position.y = sim.motes[index].pos[1] + .47 + .14 * Math.sin(wallTime * 3.5 + index * 2.3)
    })

    const activeIds = new Set(sim.shades.map((shade) => shade.id))
    for (const [id, view] of this.shades) {
      if (activeIds.has(id)) continue
      this.scene.remove(view.root)
      view.root.traverse((child) => {
        if (child.isMesh) {
          child.geometry.dispose()
          child.material.dispose()
        }
      })
      this.shades.delete(id)
    }
    for (const shade of sim.shades) {
      if (!this.shades.has(shade.id)) this.shades.set(shade.id, makeShade(this.scene))
      const { root, ink } = this.shades.get(shade.id)
      root.position.fromArray(shade.pos)
      root.position.y += .12 * Math.sin(wallTime * 4 + root.id)
      root.rotation.y = Math.atan2(x - shade.pos[0], z - shade.pos[2])
      ink.emissive.setHex(shade.state === 'stunned' ? 0xffad57 : 0x57326c)
    }

    const litCount = sim.lanterns.reduce((sum, lantern) => sum + Number(lantern.lit), 0)
    this.sky.intensity = 1.35 + litCount * .28
    this.scene.background.copy(this.night).lerp(this.dawn, litCount / this.lanterns.length)
    this.scene.fog.color.copy(this.scene.background)
    this.scene.fog.density = .023 - litCount * .0013
    const elapsed = (sim.tick - this.pulseTick) * STEP
    this.pulseRing.visible = elapsed < .48
    if (this.pulseRing.visible) {
      this.pulseRing.scale.setScalar(.2 + tuning.pulse_radius * elapsed / .48)
      this.pulseRing.material.opacity = .8 * (1 - elapsed / .48)
    }

    const behind = 11.7
    this.camera.position.set(x + Math.sin(yaw) * behind, 7.8 + y * .45, z + Math.cos(yaw) * behind)
    this.camera.lookAt(x - Math.sin(yaw) * 3.3, 1.35 + y * .4, z - Math.cos(yaw) * 3.3)
    this.camera.updateMatrixWorld()
    sim.lanterns.forEach((lantern, index) => {
      const view = this.lanterns[index]
      if (view.lit !== lantern.lit) {
        view.lit = lantern.lit
        view.paper.color.setHex(lantern.lit ? 0xffbd66 : 0x876249)
        view.paper.emissiveIntensity = lantern.lit ? 1.5 : .09
        view.shelter.visible = lantern.lit
        view.light.intensity = lantern.lit ? 44 : 0
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
    drawMap(this.map, this.mapContext, sim, yaw)
    this.renderer.render(this.scene, this.camera)
  }

  showPulse(sim) {
    const [x, , z] = sim.player.pos
    this.pulseRing.position.set(x, .05, z)
    this.pulseTick = sim.tick
  }
}
