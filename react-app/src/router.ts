import { useSyncExternalStore } from 'react'

/** ハッシュ（#/path?query）でのルーティング。サブフォルダ配置でも動くようにハッシュ方式にしている */
function current() {
  const h = window.location.hash.replace(/^#\/?/, '')
  const [p, q = ''] = h.split('?')
  return { path: p.split('/').filter(Boolean).map(decodeURIComponent), query: new URLSearchParams(q) }
}

let snapshot = current()
let raw = window.location.hash
const listeners = new Set<() => void>()
window.addEventListener('hashchange', () => {
  raw = window.location.hash
  snapshot = current()
  listeners.forEach((l) => l())
  window.scrollTo(0, 0)
})

export function useRoute() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => {
      if (raw !== window.location.hash) {
        raw = window.location.hash
        snapshot = current()
      }
      return snapshot
    },
  )
}

export function navigate(to: string) {
  window.location.hash = to.startsWith('#') ? to : `#/${to.replace(/^\//, '')}`
}

export const href = (to: string) => `#/${to.replace(/^\//, '')}`
