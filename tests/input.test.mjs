import assert from 'node:assert/strict'
import test from 'node:test'
import { ControllerInput } from '../src/input.ts'

test('moving diagonally, looking and firing can be sampled together and released independently', () => {
  const input = new ControllerInput()
  input.key('KeyW', true)
  input.key('KeyD', true)
  input.mouseButton(0, true)
  input.mouseButton(2, true)
  input.move(8, -6, 10)
  const { axes, buttons } = input.read(12)
  assert.ok(Math.abs(axes[0] - Math.SQRT1_2) < 1e-6)
  assert.equal(axes[1], -axes[0])
  assert.ok(axes[2] > 0 && axes[3] < 0)
  assert.ok(buttons[6] && buttons[7])
  input.mouseButton(0, false)
  const later = input.read(100)
  assert.deepEqual(later.axes, [axes[0], axes[1], 0, 0])
  assert.equal(later.buttons[7], false)
  assert.equal(later.buttons[6], true)
})

test('opposite movement cancels and releasing one key restores the other', () => {
  const input = new ControllerInput()
  input.key('KeyS', true)
  input.key('KeyW', true)
  assert.equal(input.read(0).axes[1], 0)
  input.key('KeyW', false)
  assert.equal(input.read(0).axes[1], 1)
})

test('mouse deltas accumulate between polls and stay in the unit circle', () => {
  const input = new ControllerInput()
  input.move(1, 0, 1)
  const first = input.read(2).axes[2]
  input.move(1, 0, 3)
  assert.ok(input.read(4).axes[2] > first)
  input.move(500, 500, 5)
  const axes = input.read(6).axes
  assert.ok(Math.abs(Math.hypot(axes[2], axes[3]) - 1) < 1e-6)
  assert.deepEqual(input.read(6).axes, axes)
})

test('reset clears keys, held triggers and recent mouse movement', () => {
  const input = new ControllerInput()
  input.key('Space', true)
  input.mouseButton(0, true)
  input.move(20, -12, 0)
  assert.ok(input.read(1).buttons[0])
  input.reset()
  assert.deepEqual(input.read(2), new ControllerInput().read(2))
})
