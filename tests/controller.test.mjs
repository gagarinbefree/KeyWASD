import test from 'node:test'
import assert from 'node:assert/strict'
import { installController } from '../src/controller.ts'

function fire(target, type, fields = {}) {
  const event = Object.assign(new Event(type, { cancelable: true }), fields)
  target.dispatchEvent(event)
  return event
}

function browser() {
  const win = new EventTarget()
  const doc = new EventTarget()
  const physical = { index: 0, id: 'Bluetooth Xbox', connected: true, mapping: 'standard' }
  const devices = { getGamepads: () => [physical, null, null, null] }
  const target = {
    async requestPointerLock() {
      doc.pointerLockElement = target
      fire(doc, 'pointerlockchange')
    }
  }
  doc.documentElement = target
  doc.exitPointerLock = () => {
    doc.pointerLockElement = null
    fire(doc, 'pointerlockchange')
  }
  const capture = installController(win, doc, devices)
  return { win, doc, devices, target, physical, capture }
}

test('the page polls one player in the physical slot and receives independent inputs', async () => {
  const { win, devices, target, capture, physical } = browser()
  assert.equal(devices.getGamepads()[0], physical)
  await capture(target)
  fire(win, 'keydown', { code: 'KeyW' })
  fire(win, 'mousedown', { button: 0 })
  fire(win, 'mousemove', { movementX: 8, movementY: -4 })
  const [pad] = devices.getGamepads()
  assert.equal(pad.mapping, 'standard')
  assert.equal(pad.axes[1], -1)
  assert.ok(pad.axes[2] > 0 && pad.buttons[7].pressed)
  fire(win, 'mouseup', { button: 0 })
  assert.equal(devices.getGamepads()[0].buttons[7].pressed, false)
  assert.equal(devices.getGamepads()[0].axes[1], -1)
})

for (const reason of ['blur', 'pointerlockchange', 'visibilitychange', 'F8']) {
  test(reason + ' clears capture and restores the physical controller', async () => {
    const { win, doc, devices, target, capture, physical } = browser()
    await capture(target)
    fire(win, 'keydown', { code: 'KeyD' })
    const active = devices.getGamepads()[0]
    assert.notEqual(active, physical)
    if (reason === 'blur') fire(win, 'blur')
    if (reason === 'pointerlockchange') doc.exitPointerLock()
    if (reason === 'visibilitychange') { doc.hidden = true; fire(doc, reason); doc.hidden = false }
    if (reason === 'F8') fire(win, 'keydown', { code: 'F8' })
    assert.equal(devices.getGamepads()[0], physical)
    await capture(target)
    assert.deepEqual(devices.getGamepads()[0].axes, [0, 0, 0, 0])
  })
}
