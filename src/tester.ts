import { controllerName, installController } from './controller.ts'
import { installSpotify, type MusicState } from './spotify.ts'

/** Returns a required element of the packaged test page. */
function element(id: string) {
  const node = document.getElementById(id)
  if (!node) throw new Error('Missing tester element: ' + id)
  return node
}

const captureButton = element('capture') as HTMLButtonElement
const errorMessage = element('error')
const soundButton = element('sound') as HTMLButtonElement
const soundLabel = element('sound-label')
const musicStatus = element('music-status')
const messages: Record<MusicState, string> = {
  loading: 'Подключение к GTA FM…',
  starting: 'Запуск GTA FM…',
  playing: 'GTA FM',
  off: 'Звук выключен',
  blocked: 'Нажмите для звука',
  error: 'GTA FM недоступно'
}
const player = installSpotify(window, element('spotify-player') as HTMLIFrameElement, state => {
  const enabled = state === 'playing' || state === 'starting' || state === 'loading'
  soundButton.dataset.state = state
  soundLabel.textContent = enabled ? 'Выключить звук' : 'Включить звук'
  musicStatus.textContent = messages[state]
})
soundButton.addEventListener('click', () => player.toggle())
function unlockMusic(event: Event) {
  if (event.target instanceof Node && !soundButton.contains(event.target)) player.unlock()
}
window.addEventListener('click', unlockMusic, true)
window.addEventListener('keydown', unlockMusic, true)

const capture = installController(window, document, navigator)
captureButton.addEventListener('click', async () => {
  errorMessage.textContent = ''
  try {
    await capture(document.documentElement)
  } catch {
    errorMessage.textContent = 'Захват мыши недоступен. Выберите эту вкладку и повторите попытку.'
  }
})

const bindings = [
  [7, 'RT · ЛКМ'], [6, 'LT · ПКМ'], [0, 'A · Пробел'], [1, 'B · C'], [2, 'X · R'],
  [3, 'Y · E'], [4, 'LB · Q'], [5, 'RB · F'], [10, 'LS · Лев. Shift'], [11, 'RS · Лев. Ctrl']
] as const
const container = element('buttons')
const labels = bindings.map(([index, text]) => {
  const label = document.createElement('span')
  label.className = 'binding'
  const [control, key] = text.split(' · ')
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
    status.textContent = active ? 'Захват включён' : 'Ожидание ввода'
    captureButton.disabled = active
    captureButton.textContent = active ? 'Мышь захвачена' : 'Включить захват'
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
