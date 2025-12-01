class WebSocketClient {
  constructor(url) {
    this.url = url
    this.ws = null
    this.listeners = new Map()
    this.reconnectInterval = 3000
    this.reconnectTimeout = null
    this.isIntentionallyClosed = false
  }

  connect() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log('WebSocket already connected')
      return
    }

    try {
      this.ws = new WebSocket(this.url)

      this.ws.onopen = () => {
        console.log('✅ WebSocket connected to backend')
        this.emit('connection', { status: 'connected' })
      }

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          console.log('📨 WebSocket message:', data)
          this.emit(data.type, data)
        } catch (error) {
          console.error('Error parsing WebSocket message:', error)
        }
      }

      this.ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error)
        this.emit('error', { error })
      }

      this.ws.onclose = () => {
        console.log('🔌 WebSocket disconnected')
        this.emit('connection', { status: 'disconnected' })

        // Attempt to reconnect if not intentionally closed
        if (!this.isIntentionallyClosed) {
          console.log(`Attempting to reconnect in ${this.reconnectInterval / 1000}s...`)
          this.reconnectTimeout = setTimeout(() => {
            this.connect()
          }, this.reconnectInterval)
        }
      }
    } catch (error) {
      console.error('Error creating WebSocket connection:', error)
    }
  }

  disconnect() {
    this.isIntentionallyClosed = true
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout)
    }
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }

  on(eventType, callback) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, [])
    }
    this.listeners.get(eventType).push(callback)
  }

  off(eventType, callback) {
    if (!this.listeners.has(eventType)) return

    const callbacks = this.listeners.get(eventType)
    const index = callbacks.indexOf(callback)
    if (index > -1) {
      callbacks.splice(index, 1)
    }
  }

  emit(eventType, data) {
    if (!this.listeners.has(eventType)) return

    const callbacks = this.listeners.get(eventType)
    callbacks.forEach((callback) => {
      try {
        callback(data)
      } catch (error) {
        console.error(`Error in ${eventType} listener:`, error)
      }
    })
  }

  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data))
    } else {
      console.warn('WebSocket not connected. Cannot send message.')
    }
  }
}

// Create singleton instance
// Use /ws proxy path to work through Vite proxy and ngrok
const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
const wsUrl = `${protocol}//${window.location.host}/ws`

console.log('🔌 WebSocket connecting to:', wsUrl)
const wsClient = new WebSocketClient(wsUrl)

export default wsClient
