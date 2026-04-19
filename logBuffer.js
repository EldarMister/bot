const DEFAULT_CAPACITY = 1000

export class RingLogBuffer {
  constructor(capacity = DEFAULT_CAPACITY) {
    this.capacity = Math.max(50, Number(capacity) || DEFAULT_CAPACITY)
    this.items = []
    this.seq = 0
  }

  push(level, line) {
    const text = String(line ?? '').trim()
    if (!text) return
    this.seq += 1
    this.items.push({
      id: this.seq,
      ts: new Date().toISOString(),
      level: String(level || 'info').toLowerCase(),
      text,
    })
    if (this.items.length > this.capacity) {
      this.items.splice(0, this.items.length - this.capacity)
    }
  }

  info(line) { this.push('info', line) }
  warn(line) { this.push('warn', line) }
  error(line) { this.push('error', line) }

  tail(limit = 200, sinceId = 0) {
    const start = sinceId > 0
      ? this.items.findIndex((it) => it.id > sinceId)
      : Math.max(0, this.items.length - limit)
    if (start < 0) return []
    return this.items.slice(start, start + Math.max(1, Math.min(this.capacity, limit)))
  }

  all() {
    return this.items.slice()
  }
}
