import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { installRadio } from '../src/radio.ts'

test('the station name opens laut.fm in a new tab independently of the sound button', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
  const header = html.match(/<header\b[^>]*>([\s\S]*?)<\/header>/)[1]
  assert.match(header, /<a\b(?=[^>]*href="https:\/\/laut\.fm\/gta-classics")(?=[^>]*target="_blank")(?=[^>]*rel="[^"]*noopener)[^>]*>GTA FM<\/a>/)
  assert.doesNotMatch(header.match(/<button\b[^>]*id="sound"[^>]*>([\s\S]*?)<\/button>/)[1], /GTA FM|<a\b/)
})

function setup() {
  const audio = new EventTarget()
  const attempts = []
  const states = []
  audio.play = () => {
    const attempt = Promise.withResolvers()
    attempts.push(attempt)
    return attempt.promise
  }
  audio.pause = () => { audio.paused = true }
  audio.removeAttribute = name => { delete audio[name] }
  audio.load = () => { audio.error = null }
  const player = installRadio(audio, state => states.push(state))
  return { audio, attempts, states, player }
}

test('starts GTA Classics on open and reconnects live after switching off', async () => {
  const { audio, attempts, states, player } = setup()
  assert.equal(audio.src, 'https://stream.laut.fm/gta-classics')
  attempts[0].resolve()
  await Promise.resolve()
  assert.equal(states.at(-1), 'playing')
  player.toggle()
  player.unlock()
  assert.equal(states.at(-1), 'off')
  assert.equal(audio.src, undefined)
  assert.equal(attempts.length, 1)
  player.toggle()
  assert.equal(audio.src, 'https://stream.laut.fm/gta-classics')
  assert.equal(attempts.length, 2)
})

test('retries blocked autoplay on interaction and ignores superseded play attempts', async () => {
  const { attempts, player, states } = setup()
  attempts[0].reject(new DOMException('Interaction required', 'NotAllowedError'))
  await Promise.resolve()
  assert.equal(states.at(-1), 'blocked')
  player.unlock()
  player.unlock()
  assert.equal(attempts.length, 2)
  player.toggle()
  player.toggle()
  attempts[2].resolve()
  await Promise.resolve()
  attempts[1].reject(new DOMException('Aborted', 'AbortError'))
  await Promise.resolve()
  assert.equal(states.at(-1), 'playing')
})

test('a failed stream can be restarted from the same button', async () => {
  const { audio, attempts, states, player } = setup()
  attempts[0].resolve()
  await Promise.resolve()
  audio.error = { code: 2 }
  audio.dispatchEvent(new Event('error'))
  assert.equal(states.at(-1), 'error')
  player.toggle()
  assert.equal(attempts.length, 2)
  assert.equal(states.at(-1), 'starting')
})
