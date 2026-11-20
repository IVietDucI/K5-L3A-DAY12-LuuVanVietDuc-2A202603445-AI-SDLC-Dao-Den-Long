const radians = Math.PI / 180
const flat = (x, z, radius) => ({ x, z, radius })
const circle = (count, radius, offset = 0, y = 0, centerX = 0) =>
  Array.from({ length: count }, (_, i) => {
    const angle = (offset + i * 360 / count) * radians
    return [centerX + Math.cos(angle) * radius, y, Math.sin(angle) * radius]
  })
const cauCenters = [0, 70]
const ramp = (degrees) => {
  const angle = degrees * radians
  return { axis: [Math.cos(angle), Math.sin(angle)], inner: 24, outer: 30, width: 3, height: 3 }
}

export const islands = {
  1: {
    name: 'Đảo Bến', advice: 'Hãy thắp đèn trước rạng đông. Vòng sáng sẽ giữ Bóng Mực ở bên ngoài.',
    spawn: [0, 0, 0], facing: [0, 1], bases: [flat(0, 0, 40)], pads: [], ramps: [],
    lanterns: [[0, 0, 25], [23.8, 0, 7.7], [14.7, 0, -20.2], [-14.7, 0, -20.2], [-23.8, 0, 7.7]],
    moteSpots: [...circle(8, 12), ...circle(16, 33)],
    shadeSpots: circle(12, 37, 15, .85), shadeInterval: 480, shadeLimit: 6, shadeMinPlayerGap: 15,
    charms: [],
  },
  2: {
    name: 'Đảo Cau', advice: 'Qua cầu tre hoặc dùng bục nhảy để đổi đảo. Hãy để ý Gió Lạc khi túi đã đầy.',
    spawn: [0, 0, 0], facing: [0, 1], bases: cauCenters.map(x => flat(x, 0, 28)), ramps: [],
    bridge: { minX: 26, maxX: 44, minZ: -2, maxZ: 2 },
    pads: [{ pos: [20, 0, 18], target: [70, 0], vertical: 14, speed: 24 },
      { pos: [50, 0, -18], target: [0, 0], vertical: 14, speed: 24 }],
    lanterns: [[0, 0, 20], [17, 0, -10], [-17, 0, -10], [70, 0, 20], [87, 0, -10], [53, 0, -10]],
    moteSpots: cauCenters.flatMap(x => [...circle(4, 10, 0, 0, x), ...circle(8, 22, 0, 0, x)]),
    shadeSpots: cauCenters.flatMap(x => circle(8, 26, 22.5, .85, x)),
    shadeInterval: 420, shadeLimit: 8, charms: [[35, 0, 0]],
  },
  3: {
    name: 'Đảo Chuông', advice: 'Theo hai dốc lên vành khăn, rồi dùng bục nhảy tới tầng tháp. Lá bay là dấu hiệu gió sắp nổi.',
    spawn: [0, 0, -12], facing: [0, 1], bases: [flat(0, 0, 45)],
    ring: { inner: 12, outer: 24, height: 3 },
    disc: { radius: 8, height: 6 },
    tower: { radius: 2, base: 6, height: 8 },
    ramps: [ramp(30), ramp(150)],
    pads: [{ pos: [0, 3, 13], target: [0, 0], vertical: 12, speed: 8 }],
    lanterns: [[0, 6, 6], [18, 3, 10], [-18, 3, 10], [35, 0, -10], [-35, 0, -10], [20, 0, -35], [-20, 0, -35]],
    moteSpots: [...circle(18, 34), ...circle(18, 18, 0, 3).slice(1, 9), ...circle(4, 5, 45, 6)],
    shadeSpots: circle(16, 43, 0, .85), shadeInterval: 360, shadeLimit: 10,
    charms: [[30, 0, 25], [-30, 0, 25]],
  },
}

export function surfacesAt(island, x, z) {
  const result = []
  if (island.bases.some(base => Math.hypot(x - base.x, z - base.z) <= base.radius)) result.push({ y: 0 })
  const bridge = island.bridge
  if (bridge && x >= bridge.minX && x <= bridge.maxX && z >= bridge.minZ && z <= bridge.maxZ && result.length === 0) {
    result.push({ y: 0 })
  }
  for (const slope of island.ramps) {
    const [dx, dz] = slope.axis
    const along = x * dx + z * dz
    const across = -x * dz + z * dx
    if (along >= slope.inner - 1e-8 && along <= slope.outer + 1e-8 && Math.abs(across) <= slope.width / 2) {
      result.push({ y: Math.max(0, Math.min(slope.height, (slope.outer - along) / 2)), slope })
    }
  }
  const radius = Math.hypot(x, z)
  if (island.ring && z > 0 && radius >= island.ring.inner && radius <= island.ring.outer + 1e-8) {
    result.push({ y: island.ring.height })
  }
  if (island.disc && radius <= island.disc.radius) result.push({ y: island.disc.height })
  return result
}
