import { controllerName, installController } from './controller.ts'
import { installRadio } from './radio.ts'
import { localizePage, pageLanguage } from './i18n.ts'

/** Returns a required element of the packaged test page. */
function element(id: string) {
  const node = document.getElementById(id)
  if (!node) throw new Error('Missing tester element: ' + id)
  return node
}

const language = pageLanguage(Intl.DateTimeFormat().resolvedOptions().timeZone, navigator.language)
const strings = localizePage(document, language)
const captureButton = element('capture') as HTMLButtonElement
const errorMessage = element('error')
const soundButton = element('sound') as HTMLButtonElement
const player = installRadio(element('radio-player') as HTMLAudioElement, state => {
  const enabled = state === 'playing' || state === 'starting'
  soundButton.dataset.state = state
  soundButton.setAttribute('aria-pressed', String(enabled))
})
soundButton.addEventListener('click', () => player.toggle())
function unlockMusic(event: Event) {
  if (event.target instanceof Element && !event.target.closest('#sound, a')) player.unlock()
}
window.addEventListener('click', unlockMusic, true)
window.addEventListener('keydown', unlockMusic, true)

const capture = installController(window, document, navigator)
captureButton.addEventListener('click', async () => {
  errorMessage.textContent = ''
  try {
    await capture(document.documentElement)
  } catch {
    errorMessage.textContent = strings.captureError.message
  }
})

const bindings = [
  [7, 'RT', strings.mouseLeft.message], [6, 'LT', strings.mouseRight.message], [0, 'A', strings.space.message],
  [1, 'B', 'C'], [2, 'X', 'R'], [3, 'Y', 'E'], [4, 'LB', 'Q'], [5, 'RB', 'F'],
  [10, 'LS', strings.shift.message], [11, 'RS', strings.ctrl.message]
] as const
const container = element('buttons')
const labels = bindings.map(([index, control, key]) => {
  const label = document.createElement('span')
  label.className = 'binding'
  const symbol = document.createElement('b')
  symbol.textContent = control
  const shortcut = document.createElement('kbd')
  shortcut.className = 'kbd kbd-sm'
  shortcut.textContent = key
  label.append(symbol, shortcut)
  container.append(label)
  return { index, label }
})
const status = element('connection')
const dials = ['left', 'right'].map(name => ({ dot: element(name + '-dot'), value: element(name + '-value') }))

/** Reads only the browser-facing API so the instruments exercise the same adapter as a game. */
function render() {
  const pad = Array.from(navigator.getGamepads()).find(device => device?.id === controllerName)
  const active = Boolean(pad)
  if (status.dataset.active !== String(active)) {
    status.dataset.active = String(active)
    status.textContent = active ? strings.active.message : strings.waiting.message
    captureButton.disabled = active
    captureButton.textContent = active ? strings.captured.message : strings.capture.message
  }
  for (const [index, { dot, value }] of dials.entries()) {
    const x = pad?.axes[index * 2] ?? 0
    const y = pad?.axes[index * 2 + 1] ?? 0
    dot.style.left = (50 + 46 * x) + '%'
    dot.style.top = (50 + 46 * y) + '%'
    const text = 'X ' + x.toFixed(2) + '　 Y ' + y.toFixed(2)
    if (value.textContent !== text) value.textContent = text
  }
  for (const { index, label } of labels) {
    const pressed = String(pad?.buttons[index].pressed ?? false)
    if (label.dataset.active !== pressed) label.dataset.active = pressed
  }
  requestAnimationFrame(render)
}

render()
