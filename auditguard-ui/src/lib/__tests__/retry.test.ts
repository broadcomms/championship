import { retryWithBackoff, retryFetch } from '../../utils/retry'
import { NetworkError, ValidationError } from '../../utils/errors'

describe('retryWithBackoff', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should succeed on first attempt', async () => {
    const operation = jest.fn().mockResolvedValue('success')
    
    const result = await retryWithBackoff(operation)

    expect(result).toBe('success')
    expect(operation).toHaveBeenCalledTimes(1)
  })

  it('should retry on failure and succeed', async () => {
    const operation = jest
      .fn()
      .mockRejectedValueOnce(new Error('Temporary failure'))
      .mockResolvedValueOnce('success')
    
    const onRetry = jest.fn()
    const result = await retryWithBackoff(operation, { 
      initialDelay: 10,
      onRetry 
    })

    expect(result).toBe('success')
    expect(operation).toHaveBeenCalledTimes(2)
    expect(onRetry).toHaveBeenCalledWith(expect.any(Error), 1, 10)
  })

  it('should respect maxAttempts', async () => {
    const operation = jest.fn().mockRejectedValue(new Error('Always fails'))
    
    await expect(retryWithBackoff(operation, { 
      maxAttempts: 3,
      initialDelay: 10 
    })).rejects.toThrow('Always fails')
    
    expect(operation).toHaveBeenCalledTimes(3)
  })

  it('should use exponential backoff delays', async () => {
    const operation = jest.fn().mockRejectedValue(new Error('Failure'))
    const delays: number[] = []
    
    const onRetry = jest.fn((error, attempt, delay) => {
      delays.push(delay)
    })

    await expect(retryWithBackoff(operation, { 
      maxAttempts: 4,
      initialDelay: 10,
      backoffMultiplier: 2,
      onRetry 
    })).rejects.toThrow('Failure')
    
    expect(operation).toHaveBeenCalledTimes(4)
    expect(delays.length).toBe(3)
    // Delays should grow exponentially: 10, 20, 40
    expect(delays[0]).toBe(10)
    expect(delays[1]).toBe(20)
    expect(delays[2]).toBe(40)
  })

  it('should not exceed max delay', async () => {
    const operation = jest.fn().mockRejectedValue(new Error('Failure'))
    const delays: number[] = []
    
    const onRetry = jest.fn((error, attempt, delay) => {
      delays.push(delay)
    })

    await expect(retryWithBackoff(operation, { 
      maxAttempts: 5,
      initialDelay: 10,
      maxDelay: 25,
      backoffMultiplier: 2,
      onRetry
    })).rejects.toThrow('Failure')
    
    expect(operation).toHaveBeenCalledTimes(5)
    // All delays should be capped at maxDelay
    expect(delays.every(d => d <= 25)).toBe(true)
  })

  it('should not retry ValidationErrors', async () => {
    const operation = jest.fn().mockRejectedValue(
      new ValidationError('Invalid input', { email: ['Invalid email format'] })
    )
    
    await expect(retryWithBackoff(operation, {
      initialDelay: 10,
      shouldRetry: (error) => !(error instanceof ValidationError)
    })).rejects.toThrow('Invalid input')
    
    expect(operation).toHaveBeenCalledTimes(1)
  })
})

describe('retryFetch', () => {
  const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>

  beforeEach(() => {
    jest.clearAllMocks()
    global.fetch = jest.fn()
  })

  it('should fetch successfully on first attempt', async () => {
    const mockResponse = new Response(JSON.stringify({ data: 'test' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
    
    ;(global.fetch as jest.Mock).mockResolvedValue(mockResponse)

    const response = await retryFetch('/api/test', {}, { initialDelay: 10 })

    expect(response.status).toBe(200)
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  it('should retry on network error', async () => {
    ;(global.fetch as jest.Mock)
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: 'test' }), { status: 200 })
      )

    const response = await retryFetch('/api/test', {}, { initialDelay: 10 })

    expect(response.status).toBe(200)
    expect(global.fetch).toHaveBeenCalledTimes(2)
  })

  it('should retry on 500 error', async () => {
    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce(new Response('Server Error', { status: 500 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: 'test' }), { status: 200 })
      )

    const response = await retryFetch('/api/test', {}, { initialDelay: 10 })

    expect(response.status).toBe(200)
    expect(global.fetch).toHaveBeenCalledTimes(2)
  })

  it('should retry on 503 error', async () => {
    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce(new Response('Service Unavailable', { status: 503 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: 'test' }), { status: 200 })
      )

    const response = await retryFetch('/api/test', {}, { initialDelay: 10 })

    expect(response.status).toBe(200)
    expect(global.fetch).toHaveBeenCalledTimes(2)
  })

  it('should NOT retry on 400 error', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue(
      new Response('Bad Request', { status: 400 })
    )

    const response = await retryFetch('/api/test', {}, { initialDelay: 10 })

    expect(response.status).toBe(400)
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  it('should NOT retry on 404 error', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue(
      new Response('Not Found', { status: 404 })
    )

    const response = await retryFetch('/api/test', {}, { initialDelay: 10 })

    expect(response.status).toBe(404)
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  it('should pass fetch options', async () => {
    const mockResponse = new Response(JSON.stringify({ data: 'test' }), {
      status: 200,
    })
    
    ;(global.fetch as jest.Mock).mockResolvedValue(mockResponse)

    const options: RequestInit = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ test: 'data' }),
    }

    await retryFetch('/api/test', options, { initialDelay: 10 })

    expect(global.fetch).toHaveBeenCalledWith('/api/test', options)
  })

  it('should respect custom retry options', async () => {
    ;(global.fetch as jest.Mock).mockRejectedValue(new TypeError('Failed to fetch'))

    await expect(retryFetch('/api/test', {}, { 
      maxAttempts: 2,
      initialDelay: 10 
    })).rejects.toThrow('Failed to fetch')
    
    expect(global.fetch).toHaveBeenCalledTimes(2)
  })
})
