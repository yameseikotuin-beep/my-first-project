/** 一意なIDを作る（crypto.randomUUID は http の非セキュアコンテキストでは使えないため） */
export function newId(): string {
  const c = globalThis.crypto
  if (c && typeof c.randomUUID === 'function' && globalThis.isSecureContext !== false) return c.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}-${Math.random().toString(36).slice(2, 10)}`
}
