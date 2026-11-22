const movementKeys = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD'])
const buttonKeys = new Map([
  ['Space', 0], ['KeyC', 1], ['KeyR', 2], ['KeyE', 3],
  ['KeyQ', 4], ['KeyF', 5], ['ShiftLeft', 10], ['ControlLeft', 11]
])
const lookWindowMs = 36

/** Scales a vector to the stick's circular range without changing its direction. */
function stick(x: number, y: number): [number, number] {
  const divisor = Math.max(1, Math.hypot(x, y))
  return [x / divisor, y / divisor]
}

/** Collects keyboard and mouse input independently of the site's polling rate. */
export class ControllerInput {
  private keys = new Set<string>()
  private triggers = new Set<number>()
  private motion: { x: number; y: number; time: number }[] = []

  /** Returns whether this physical key belongs to the controller. */
  key(code: string, down: boolean) {
    if (!movementKeys.has(code) && !buttonKeys.has(code)) return false
    if (down) this.keys.add(code)
    else this.keys.delete(code)
    return true
  }

  mouseButton(button: number, down: boolean) {
    if (button !== 0 && button !== 2) return false
    if (down) this.triggers.add(button)
    else this.triggers.delete(button)
    return true
  }

  move(x: number, y: number, now: number) {
    this.expire(now)
    this.motion.push({ x, y, time: now })
  }

  private expire(now: number) {
    while (this.motion.length && now - this.motion[0].time >= lookWindowMs) this.motion.shift()
  }

  reset() {
    this.keys.clear()
    this.triggers.clear()
    this.motion = []
  }

  /** Reads a snapshot without consuming motion, allowing several readers per frame. */
  read(now: number) {
    this.expire(now)
    const x = Number(this.keys.has('KeyD')) - Number(this.keys.has('KeyA'))
    const y = Number(this.keys.has('KeyS')) - Number(this.keys.has('KeyW'))
    let dx = 0
    let dy = 0
    for (const sample of this.motion) {
      dx += sample.x
      dy += sample.y
    }
    const buttons = Array<boolean>(17).fill(false)
    for (const code of this.keys) {
      const index = buttonKeys.get(code)
      if (index !== undefined) buttons[index] = true
    }
    buttons[6] = this.triggers.has(2)
    buttons[7] = this.triggers.has(0)
    const fullDeflection = buttons[6] ? 90 : 55
    return { axes: [...stick(x, y), ...stick(dx / fullDeflection, dy / fullDeflection)], buttons }
  }
}
