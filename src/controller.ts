import { ControllerInput } from './input.ts'

export const controllerName = 'KeyWASD Virtual Xbox Controller'

/** Installs page-local polling and returns a command for a user-initiated mouse capture. */
export function installController(win: Window, doc: Document, devices: Navigator) {
  const nativePads = devices.getGamepads.bind(devices)
  const input = new ControllerInput()
  let slot = -1
  let target: HTMLElement | null = null
  let generation = 0

  function snapshot(connected = true) {
    const timestamp = performance.now()
    const state = input.read(timestamp)
    return {
      id: controllerName, index: slot, mapping: 'standard', connected, timestamp,
      axes: state.axes,
      buttons: state.buttons.map(pressed => ({ pressed, touched: pressed, value: Number(pressed) })),
      vibrationActuator: null, hapticActuators: []
    }
  }

  Object.defineProperty(devices, 'getGamepads', {
    configurable: true, writable: true,
    value() {
      const hardware = nativePads()
      if (slot < 0) return hardware
      const pads: (Gamepad | ReturnType<typeof snapshot> | null)[] = Array.from(hardware)
      pads[slot] = snapshot()
      return pads
    }
  })

  function announce(type: string, gamepad: Gamepad | ReturnType<typeof snapshot>) {
    const event = new Event(type)
    Object.defineProperty(event, 'gamepad', { value: gamepad })
    win.dispatchEvent(event)
  }

  function stop() {
    const owned = target
    generation++
    target = null
    input.reset()
    if (slot >= 0) {
      const detached = snapshot(false)
      slot = -1
      announce('gamepaddisconnected', detached)
      const physical = nativePads()[detached.index]
      if (physical) announce('gamepadconnected', physical)
    }
    if (owned && doc.pointerLockElement === owned) doc.exitPointerLock()
  }

  async function capture(element: HTMLElement) {
    if (target) return
    const request = ++generation
    target = element
    try {
      await element.requestPointerLock()
      if (request !== generation) {
        if (!target && doc.pointerLockElement === element) doc.exitPointerLock()
        return
      }
      if (doc.pointerLockElement !== element || doc.hidden) {
        stop()
        return
      }
      const hardware = Array.from(nativePads())
      const index = hardware.findIndex(pad => pad?.mapping === 'standard')
      const empty = hardware.findIndex(pad => !pad)
      slot = index >= 0 ? index : empty >= 0 ? empty : hardware.length
      if (index >= 0 && hardware[index]) announce('gamepaddisconnected', hardware[index])
      announce('gamepadconnected', snapshot())
    } catch (error) {
      if (request === generation) stop()
      throw error
    }
  }

  function consume(event: Event) {
    event.preventDefault()
    event.stopImmediatePropagation()
  }

  function keyboard(event: KeyboardEvent) {
    const down = event.type === 'keydown'
    if (event.code === 'F8') {
      consume(event)
      if (!down || event.repeat) return
      if (target) stop()
      else void capture(doc.documentElement).catch(error => console.warn('KeyWASD', error))
    } else if (slot >= 0 && input.key(event.code, down)) consume(event)
  }

  function mouseButton(event: MouseEvent) {
    if (slot >= 0 && input.mouseButton(event.button, event.type === 'mousedown')) consume(event)
  }

  for (const type of ['gamepadconnected', 'gamepaddisconnected'] as const) {
    win.addEventListener(type, event => {
      if (event.isTrusted && event.gamepad.index === slot) event.stopImmediatePropagation()
    }, true)
  }
  win.addEventListener('keydown', keyboard, true)
  win.addEventListener('keyup', keyboard, true)
  win.addEventListener('mousedown', mouseButton, true)
  win.addEventListener('mouseup', mouseButton, true)
  win.addEventListener('mousemove', event => {
    if (slot < 0) return
    input.move(event.movementX, event.movementY, performance.now())
    consume(event)
  }, true)
  for (const type of ['contextmenu', 'click', 'auxclick'] as const) {
    win.addEventListener(type, event => { if (slot >= 0) consume(event) }, true)
  }
  win.addEventListener('blur', stop)
  win.addEventListener('pagehide', stop)
  doc.addEventListener('visibilitychange', () => { if (doc.hidden) stop() })
  doc.addEventListener('pointerlockchange', () => {
    if (target && doc.pointerLockElement !== target) stop()
  })
  return capture
}
