import { trackDurations, trackIds } from './playlist.ts'

export type MusicState = 'loading' | 'starting' | 'playing' | 'off' | 'blocked' | 'preview' | 'error'

const origin = 'https://open.spotify.com'
const lastTrackKey = 'keywest.gta-fm.last-track'

/** Uses Spotify's iframe messages so the extension loads no remote scripts into its own page. */
export function installSpotify(win: Window, frame: HTMLIFrameElement, render: (state: MusicState) => void) {
  let state: MusicState = 'loading'
  let ready = false
  let played = false
  let timeout: number | undefined
  const remaining: string[] = []
  let trackId = ''
  try {
    trackId = win.sessionStorage.getItem(lastTrackKey) ?? ''
  } catch {
    // The queue also works when the browser disables session storage.
  }

  function show(next: MusicState) {
    win.clearTimeout(timeout)
    state = next
    render(next)
  }

  function send(command: 'play' | 'resume' | 'pause' | 'load_complete_ack') {
    frame.contentWindow?.postMessage({ command }, origin)
  }

  function load() {
    ready = false
    played = false
    show('loading')
    timeout = win.setTimeout(() => show('error'), 15000)
    frame.src = origin + '/embed/track/' + trackId + '?utm_source=iframe-api&theme=0'
  }

  /** Draws uniformly without replacement, excluding the most recent song at cycle boundaries. */
  function nextTrack() {
    if (remaining.length === 0) remaining.push(...trackIds)
    const excluded = remaining.length > 1 ? remaining.indexOf(trackId) : -1
    const choices = remaining.length - Number(excluded >= 0)
    let index = Math.floor(Math.random() * choices)
    if (excluded >= 0 && index >= excluded) index++
    trackId = remaining.splice(index, 1)[0]
    try {
      win.sessionStorage.setItem(lastTrackKey, trackId)
    } catch {
      // In-memory playback can continue without remembering this track across reloads.
    }
    load()
  }

  function play() {
    show('starting')
    send(played ? 'resume' : 'play')
    timeout = win.setTimeout(() => show('blocked'), 4500)
  }

  win.addEventListener('message', event => {
    if (event.source !== frame.contentWindow || event.origin !== origin) return
    const data = event.data
    if (data?.type === 'ready') {
      send('load_complete_ack')
      if (!ready) {
        ready = true
        if (state !== 'off') play()
      }
    } else if (data?.type === 'error' && state !== 'off') {
      show('error')
    } else if (data?.type === 'playback_update') {
      const update = data.payload
      const currentURI = 'spotify:track:' + trackId
      if (!ready || state === 'preview' || (update?.playingURI && update.playingURI !== currentURI)) return
      if (state !== 'off' && state !== 'error' && played && update?.playingURI === currentURI &&
          update.isBuffering === false && Number.isFinite(update.position) && Number.isFinite(update.duration) &&
          update.duration > 0 && update.position >= update.duration) {
        // Compare catalog and stream lengths at second precision, after the stream has ended.
        if (Math.floor(update.duration / 1000) >= Math.floor(trackDurations[trackId] / 1000)) nextTrack()
        else show('preview')
      } else if (update?.isPaused === false) {
        if (state === 'off') send('pause')
        else if (update.isBuffering === false && state !== 'playing') {
          played = true
          show('playing')
        }
      } else if (update?.isPaused === true && state === 'playing') {
        show('blocked')
      }
    }
  })

  nextTrack()
  return {
    toggle() {
      if (state === 'playing' || state === 'loading' || state === 'starting') {
        show('off')
        if (ready) send('pause')
      } else if (!ready || state === 'error' || state === 'preview') load()
      else play()
    },
    unlock() {
      if (ready && state === 'blocked') play()
      else if (ready && state === 'starting') send(played ? 'resume' : 'play')
    }
  }
}
