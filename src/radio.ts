type RadioState = 'starting' | 'playing' | 'off' | 'blocked' | 'error'

/** Plays the live station and releases the stream when the listener switches it off. */
export function installRadio(audio: HTMLAudioElement, render: (state: RadioState) => void) {
  let state: RadioState = 'off'
  let request = 0

  function show(next: RadioState) {
    state = next
    render(next)
  }

  function stop(next: 'off' | 'blocked' | 'error') {
    request++
    audio.pause()
    audio.removeAttribute('src')
    audio.load()
    show(next)
  }

  async function start() {
    const current = ++request
    show('starting')
    audio.src = 'https://stream.laut.fm/gta-classics'
    try {
      await audio.play()
      if (current === request) show('playing')
    } catch (error) {
      if (current === request) {
        stop(error instanceof DOMException && error.name === 'NotAllowedError' ? 'blocked' : 'error')
      }
    }
  }

  audio.addEventListener('error', () => {
    if (audio.error && audio.src) stop('error')
  })
  audio.addEventListener('ended', () => {
    if (audio.ended && state === 'playing') stop('error')
  })
  audio.addEventListener('pause', () => {
    if (audio.paused && !audio.ended && state === 'playing') stop('off')
  })

  void start()
  return {
    toggle() {
      if (state === 'playing' || state === 'starting') stop('off')
      else void start()
    },
    unlock() {
      if (state === 'blocked') void start()
    }
  }
}
