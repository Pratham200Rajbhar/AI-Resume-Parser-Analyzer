import type { JobProgressEvent } from '@/types'

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:8000'
const MAX_RECONNECT_ATTEMPTS = 3
const RECONNECT_DELAY_MS = 2000

export class JobProgressSocket {
  private ws: WebSocket | null = null
  private jobId: string
  private callback: ((event: JobProgressEvent) => void) | null = null
  private reconnectAttempts = 0
  private intentionalClose = false

  constructor(jobId: string) {
    this.jobId = jobId
    this.connect()
  }

  private connect() {
    const url = `${WS_URL}/ws/jobs/${this.jobId}`
    this.ws = new WebSocket(url)

    this.ws.onopen = () => {
      this.reconnectAttempts = 0
    }

    this.ws.onmessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data as string) as JobProgressEvent
        if (this.callback) {
          this.callback(data)
        }
      } catch {
        // ignore malformed messages
      }
    }

    this.ws.onclose = (event: CloseEvent) => {
      if (!this.intentionalClose && this.reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        this.reconnectAttempts++
        setTimeout(() => {
          this.connect()
        }, RECONNECT_DELAY_MS * this.reconnectAttempts)
      }
    }

    this.ws.onerror = () => {
      // error handling is done in onclose
    }
  }

  onEvent(callback: (event: JobProgressEvent) => void) {
    this.callback = callback
  }

  disconnect() {
    this.intentionalClose = true
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }
}
