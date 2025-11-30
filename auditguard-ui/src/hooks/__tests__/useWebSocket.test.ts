import { renderHook, act, waitFor } from '@testing-library/react'
import { useWebSocket, WebSocketMessage } from '../useWebSocket'

// Mock WebSocket
class MockWebSocket {
  static CONNECTING = 0
  static OPEN = 1
  static CLOSING = 2
  static CLOSED = 3
  static lastInstance: MockWebSocket | null = null

  url: string
  readyState: number = MockWebSocket.CONNECTING
  onopen: ((event: Event) => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null
  onclose: ((event: CloseEvent) => void) | null = null
  send: jest.Mock
  close: jest.Mock
  
  constructor(url: string) {
    this.url = url
    MockWebSocket.lastInstance = this
    
    // Create jest mocks for methods
    this.send = jest.fn()
    this.close = jest.fn(() => {
      this.readyState = MockWebSocket.CLOSED
      if (this.onclose) {
        this.onclose(new CloseEvent('close'))
      }
    })
    
    // Simulate async connection
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN
      if (this.onopen) {
        this.onopen(new Event('open'))
      }
    }, 0)
  }

  addEventListener(event: string, handler: (event: CloseEvent) => void) {
    if (event === 'close') {
      const originalOnClose = this.onclose
      this.onclose = (e) => {
        originalOnClose?.(e)
        handler(e)
      }
    }
  }

  // Helper to simulate receiving a message
  simulateMessage(message: WebSocketMessage) {
    if (this.onmessage) {
      const event = new MessageEvent('message', {
        data: JSON.stringify(message),
      })
      this.onmessage(event)
    }
  }

  // Helper to simulate error
  simulateError() {
    if (this.onerror) {
      this.onerror(new Event('error'))
    }
  }
}

type GlobalWithWebSocket = typeof global & {
  WebSocket: jest.Mock & {
    CONNECTING?: number
    OPEN?: number
    CLOSING?: number
    CLOSED?: number
  }
}

const globalWithWebSocket = global as GlobalWithWebSocket

describe('useWebSocket', () => {
  let mockWebSocket: MockWebSocket

  beforeEach(() => {
    jest.clearAllMocks()
    MockWebSocket.lastInstance = null
    // Set global WebSocket constants
    globalWithWebSocket.WebSocket = jest.fn((url: string) => {
      mockWebSocket = new MockWebSocket(url)
      return mockWebSocket
    })
    globalWithWebSocket.WebSocket.CONNECTING = MockWebSocket.CONNECTING
    globalWithWebSocket.WebSocket.OPEN = MockWebSocket.OPEN
    globalWithWebSocket.WebSocket.CLOSING = MockWebSocket.CLOSING
    globalWithWebSocket.WebSocket.CLOSED = MockWebSocket.CLOSED
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('should connect to WebSocket on mount', async () => {
    const { result } = renderHook(() =>
      useWebSocket({ workspaceId: 'test-workspace' })
    )

    // Initial state is connecting
    expect(result.current.status).toBe('connecting')

    // Wait for connection
    await waitFor(() => {
      expect(result.current.status).toBe('connected')
    })
  })

  it('should build correct WebSocket URL', () => {
    renderHook(() => useWebSocket({ workspaceId: 'test-workspace' }))

    expect(global.WebSocket).toHaveBeenCalledWith(
      expect.stringContaining('/api/realtime/test-workspace')
    )
  })

  it('should call onConnect when connected', async () => {
    const onConnect = jest.fn()

    renderHook(() =>
      useWebSocket({
        workspaceId: 'test-workspace',
        onConnect,
      })
    )

    await waitFor(() => {
      expect(onConnect).toHaveBeenCalledTimes(1)
    })
  })

  it('should send messages when connected', async () => {
    const { result } = renderHook(() =>
      useWebSocket({ workspaceId: 'workspace-1' })
    )

    await waitFor(() => {
      expect(result.current.status).toBe('connected')
    })

    const ws = MockWebSocket.lastInstance!
    
    act(() => {
      result.current.send({ type: 'test', data: { hello: 'world' } })
    })

    expect(ws.send).toHaveBeenCalledWith(
      JSON.stringify({ type: 'test', data: { hello: 'world' } })
    )
  })

  it('should not send messages when not connected', () => {
    const { result } = renderHook(() =>
      useWebSocket({ workspaceId: 'test-workspace' })
    )

    // Status is 'connecting', not 'connected' yet
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation()

    act(() => {
      result.current.send({ type: 'test' })
    })

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('WebSocket not connected'),
      expect.any(Object)
    )

    consoleSpy.mockRestore()
  })

  it('should subscribe to channels', async () => {
    const { result } = renderHook(() =>
      useWebSocket({ workspaceId: 'test-workspace' })
    )

    await waitFor(() => {
      expect(result.current.status).toBe('connected')
    })

    const ws = MockWebSocket.lastInstance!

    act(() => {
      result.current.subscribe('channel-1')
    })

    expect(ws.send).toHaveBeenCalledWith(
      JSON.stringify({ type: 'subscribe', channel: 'channel-1' })
    )
  })

  it('should unsubscribe from channels', async () => {
    const { result } = renderHook(() =>
      useWebSocket({ workspaceId: 'test-workspace' })
    )

    await waitFor(() => {
      expect(result.current.status).toBe('connected')
    })

    const ws = MockWebSocket.lastInstance!

    act(() => {
      result.current.subscribe('channel-1')
      result.current.unsubscribe('channel-1')
    })

    expect(ws.send).toHaveBeenCalledWith(
      JSON.stringify({ type: 'unsubscribe', channel: 'channel-1' })
    )
  })

  it('should re-subscribe to channels after reconnect', async () => {
    const { result } = renderHook(() =>
      useWebSocket({ workspaceId: 'test-workspace', reconnectInterval: 100 })
    )

    await waitFor(() => {
      expect(result.current.status).toBe('connected')
    })

    // Subscribe to a channel
    act(() => {
      result.current.subscribe('channel-1')
    })

    // Clear send calls from initial subscription
    MockWebSocket.lastInstance!.send.mockClear()

    // Simulate disconnect
    act(() => {
      mockWebSocket.close()
    })

    await waitFor(() => {
      expect(result.current.status).toBe('disconnected')
    })

    // Wait for automatic reconnection
    await waitFor(() => {
      expect(result.current.status).toBe('connected')
    }, { timeout: 500 })
    
    // Should have sent subscribe message on reconnect
    expect(MockWebSocket.lastInstance!.send).toHaveBeenCalledWith(
      JSON.stringify({ type: 'subscribe', channel: 'channel-1' })
    )
  })

  it('should receive messages', async () => {
    const onMessage = jest.fn()

    renderHook(() =>
      useWebSocket({
        workspaceId: 'test-workspace',
        onMessage,
      })
    )

    await waitFor(() => {
      expect(mockWebSocket.readyState).toBe(MockWebSocket.OPEN)
    })

    // Simulate receiving a message
    const message: WebSocketMessage = {
      type: 'document.updated',
      data: { id: '123', status: 'processed' },
    }

    act(() => {
      mockWebSocket.simulateMessage(message)
    })

    expect(onMessage).toHaveBeenCalledWith(message)
  })

  it('should ignore pong messages', async () => {
    const onMessage = jest.fn()

    renderHook(() =>
      useWebSocket({
        workspaceId: 'test-workspace',
        onMessage,
      })
    )

    await waitFor(() => {
      expect(mockWebSocket.readyState).toBe(MockWebSocket.OPEN)
    })

    // Simulate receiving a pong message
    act(() => {
      mockWebSocket.simulateMessage({ type: 'pong' })
    })

    expect(onMessage).not.toHaveBeenCalled()
  })

  it('should handle errors', async () => {
    const onError = jest.fn()

    const { result } = renderHook(() =>
      useWebSocket({
        workspaceId: 'test-workspace',
        onError,
      })
    )

    await waitFor(() => {
      expect(result.current.status).toBe('connected')
    })

    // Simulate error
    act(() => {
      mockWebSocket.simulateError()
    })

    await waitFor(() => {
      expect(result.current.status).toBe('error')
    })

    expect(onError).toHaveBeenCalledTimes(1)
  })

  it('should call onDisconnect when disconnected', async () => {
    const onDisconnect = jest.fn()

    const { result } = renderHook(() =>
      useWebSocket({
        workspaceId: 'test-workspace',
        onDisconnect,
      })
    )

    await waitFor(() => {
      expect(result.current.status).toBe('connected')
    })

    // Simulate disconnect
    act(() => {
      mockWebSocket.close()
    })

    await waitFor(() => {
      expect(result.current.status).toBe('disconnected')
    })

    expect(onDisconnect).toHaveBeenCalledTimes(1)
  })

  it('should attempt reconnection on disconnect', async () => {
    const { result } = renderHook(() =>
      useWebSocket({
        workspaceId: 'test-workspace',
        reconnectAttempts: 3,
        reconnectInterval: 100,
      })
    )

    await waitFor(() => {
      expect(result.current.status).toBe('connected')
    })

    // Simulate disconnect
    act(() => {
      mockWebSocket.close()
    })

    await waitFor(() => {
      expect(result.current.status).toBe('disconnected')
    })

    // Wait for reconnection attempt
    await waitFor(
      () => {
        expect(result.current.status).toBe('connected')
      },
      { timeout: 500 }
    )
  })

  it('should cleanup on unmount', async () => {
    const { result, unmount } = renderHook(() =>
      useWebSocket({ workspaceId: 'test-workspace' })
    )

    await waitFor(() => {
      expect(result.current.status).toBe('connected')
    })

    const closeSpy = jest.spyOn(mockWebSocket, 'close')

    unmount()

    expect(closeSpy).toHaveBeenCalled()
  })

  it('should handle manual reconnect', async () => {
    const onConnect = jest.fn()
    const { result } = renderHook(() =>
      useWebSocket({ workspaceId: 'test-workspace', onConnect })
    )

    await waitFor(() => {
      expect(result.current.status).toBe('connected')
    })

    expect(onConnect).toHaveBeenCalledTimes(1)

    // Manual reconnect should trigger a new connection
    act(() => {
      result.current.reconnect()
    })

    // Should reconnect (onConnect called again)
    await waitFor(() => {
      expect(onConnect).toHaveBeenCalledTimes(2)
    })

    expect(result.current.status).toBe('connected')
  })
})
