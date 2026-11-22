import assert from 'node:assert/strict'
import test from 'node:test'
import { installSpotify } from '../src/spotify.ts'
import { trackDurations, trackIds } from '../src/playlist.ts'

const origin = 'https://open.spotify.com'
function setup(storage = new Map()) {
  const win = new EventTarget()
  win.sessionStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) }
  let timeout
  win.setTimeout = callback => { timeout = callback; return 1 }
  win.clearTimeout = () => { timeout = undefined }
  const commands = []
  const contentWindow = { postMessage(data, target) {
    assert.equal(target, origin)
    commands.push(data.command)
  } }
  const frame = { contentWindow, src: '' }
  const states = []
  const player = installSpotify(win, frame, state => states.push(state))
  function message(type, payload, source = contentWindow, from = origin) {
    win.dispatchEvent(Object.assign(new Event('message'), { data: { type, payload }, origin: from, source }))
  }
  return { player, states, commands, message, frame, expire: () => timeout?.() }
}

test('loads the playlist at startup and requests playback as soon as Spotify is ready', () => {
  const { states, commands, message, frame } = setup()
  assert.match(frame.src, /^https:\/\/open\.spotify\.com\/embed\/track\/[a-zA-Z0-9]{22}\?/)
  message('ready')
  assert.deepEqual(commands, ['load_complete_ack', 'play'])
  assert.notEqual(states.at(-1), 'playing')
  message('playback_update', { isPaused: false, isBuffering: false })
  assert.equal(states.at(-1), 'playing')
})

function finishTrack(session, trackUrl = session.frame.src, clipDuration) {
  const id = new URL(trackUrl).pathname.split('/').at(-1)
  const duration = clipDuration ?? trackDurations[id]
  const update = { playingURI: 'spotify:track:' + id, isPaused: false, isBuffering: false, duration }
  session.message('playback_update', { ...update, position: 101 })
  session.message('playback_update', { ...update, position: update.duration })
}

test('ending a preview keeps the selected song and lets the listener retry it', () => {
  const s = setup()
  const first = s.frame.src
  s.message('ready')
  finishTrack(s, first, 30000)
  assert.equal(s.frame.src, first)
  assert.equal(s.states.at(-1), 'preview')
  s.player.unlock()
  assert.equal(s.states.at(-1), 'preview')
  s.player.toggle()
  assert.equal(s.states.at(-1), 'loading')
  assert.equal(s.frame.src, first)
})

test('only the current song reaching its full duration advances the queue', () => {
  const s = setup()
  const first = s.frame.src
  const id = new URL(first).pathname.split('/').at(-1)
  const update = { playingURI: 'spotify:track:' + id, isPaused: false, isBuffering: false, duration: trackDurations[id] }
  s.message('ready')
  s.message('playback_update', { ...update, position: 10000 })
  s.message('playback_update', { ...update, position: update.duration, isBuffering: true })
  s.message('playback_update', { ...update, position: update.duration, playingURI: undefined })
  s.message('playback_update', { ...update, position: update.duration - 1, isPaused: true })
  assert.equal(s.frame.src, first)
  s.message('playback_update', { ...update, position: update.duration, isPaused: true })
  assert.notEqual(s.frame.src, first)
})

test('reloading with the same random draws still avoids the last selected song', t => {
  t.mock.method(Math, 'random', () => 0.25)
  const storage = new Map()
  const first = setup(storage)
  assert.notEqual(setup(storage).frame.src, first.frame.src)
})

test('random draws change the queue, and every song plays once before the next cycle', t => {
  const random = t.mock.method(Math, 'random', () => 0.1)
  const a = setup()
  random.mock.mockImplementation(() => 0.8)
  const b = setup()
  assert.notEqual(a.frame.src, b.frame.src)
  const seen = new Set()
  let last
  for (let count = 0; count < trackIds.length; count++) {
    last = a.frame.src
    seen.add(new URL(last).pathname.split('/').at(-1))
    a.message('ready')
    finishTrack(a)
  }
  assert.deepEqual(seen, new Set(trackIds))
  assert.notEqual(a.frame.src, last)
})

test('pause, resume, retry and late events from the previous song do not consume the queue', () => {
  const s = setup()
  const first = s.frame.src
  s.message('ready')
  s.message('playback_update', { isPaused: false, isBuffering: false })
  s.player.toggle()
  finishTrack(s)
  assert.equal(s.frame.src, first)
  s.player.toggle()
  s.message('error')
  s.player.toggle()
  assert.equal(s.frame.src, first)
  s.message('ready')
  finishTrack(s)
  const second = s.frame.src
  assert.notEqual(second, first)
  s.message('ready')
  finishTrack(s, first)
  assert.equal(s.frame.src, second)
})

test('sound off wins during startup and over late playback events', () => {
  const { player, states, commands, message } = setup()
  player.toggle()
  message('ready')
  player.unlock()
  assert.ok(!commands.includes('play'))
  message('playback_update', { isPaused: false, isBuffering: false })
  assert.equal(commands.at(-1), 'pause')
  assert.equal(states.at(-1), 'off')
  player.toggle()
  assert.ok(['play', 'resume'].includes(commands.at(-1)))
})

test('a single click retries an unconfirmed autoplay; a later toggle pauses and resumes', () => {
  const { player, states, commands, message, expire } = setup()
  message('ready')
  expire()
  assert.equal(states.at(-1), 'blocked')
  player.toggle()
  assert.equal(commands.at(-1), 'play')
  message('playback_update', { isPaused: false, isBuffering: false })
  player.toggle()
  player.unlock()
  assert.equal(commands.at(-1), 'pause')
  player.toggle()
  assert.equal(commands.at(-1), 'resume')
})

test('ignores unrelated frames and origins; a failed player can be loaded again', () => {
  const { player, states, commands, frame, message, expire } = setup()
  message('ready', {}, {})
  message('ready', {}, frame.contentWindow, 'https://example.com')
  assert.deepEqual(commands, [])
  expire()
  assert.equal(states.at(-1), 'error')
  player.toggle()
  message('ready')
  assert.equal(commands.at(-1), 'play')
})
