import { retryWithBackoff, retryFetch, createRetryable, isRetryableError, useRetry } from '../../utils/retry'
import { ValidationError } from '../../utils/errors'
import { renderHook, waitFor, act } from '@testing-library/react'

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

describe('createRetryable', () => {
  it('should create a retryable function', async () => {
    const mockFn = jest.fn()
      .mockRejectedValueOnce(new Error('Temporary error'))
      .mockResolvedValueOnce('success')

    const retryableFn = createRetryable(mockFn, { initialDelay: 10 })
    
    const result = await retryableFn()

    expect(result).toBe('success')
    expect(mockFn).toHaveBeenCalledTimes(2)
  })

  it('should pass arguments to the wrapped function', async () => {
    const mockFn = jest.fn().mockResolvedValue('result')
    const retryableFn = createRetryable(
      async (arg1: string, arg2: number) => mockFn(arg1, arg2),
      { initialDelay: 10 }
    )

    await retryableFn('test', 123)

    expect(mockFn).toHaveBeenCalledWith('test', 123)
  })

  it('should work with multiple arguments', async () => {
    const mockFn = jest.fn().mockResolvedValue('done')
    const retryableFn = createRetryable(
      async (a: string, b: number, c: boolean) => mockFn(a, b, c),
      { maxAttempts: 3, initialDelay: 10 }
    )

    await retryableFn('hello', 42, true)

    expect(mockFn).toHaveBeenCalledWith('hello', 42, true)
  })
})

describe('isRetryableError', () => {
  it('should identify network fetch errors as retryable', () => {
    const error = new TypeError('Failed to fetch')
    expect(isRetryableError(error)).toBe(true)
  })

  it('should identify timeout errors as retryable', () => {
    const error = new Error('Request timeout')
    expect(isRetryableError(error)).toBe(true)
  })

  it('should identify AbortError as retryable', () => {
    const error = new Error('Request aborted')
    error.name = 'AbortError'
    expect(isRetryableError(error)).toBe(true)
  })

  it('should identify 5xx server errors as retryable', () => {
    const error = new Error('HTTP 500: Internal Server Error')
    expect(isRetryableError(error)).toBe(true)
  })

  it('should identify 503 Service Unavailable as retryable', () => {
    const error = new Error('HTTP 503: Service Unavailable')
    expect(isRetryableError(error)).toBe(true)
  })

  it('should identify rate limit errors (429) as retryable', () => {
    const error = new Error('HTTP 429: Too Many Requests')
    expect(isRetryableError(error)).toBe(true)
  })

  it('should not identify 4xx client errors as retryable', () => {
    const error = new Error('HTTP 400: Bad Request')
    expect(isRetryableError(error)).toBe(false)
  })

  it('should not identify 404 errors as retryable', () => {
    const error = new Error('HTTP 404: Not Found')
    expect(isRetryableError(error)).toBe(false)
  })

  it('should not identify validation errors as retryable', () => {
    const error = new Error('Validation failed')
    expect(isRetryableError(error)).toBe(false)
  })

  it('should not identify generic errors as retryable', () => {
    const error = new Error('Something went wrong')
    expect(isRetryableError(error)).toBe(false)
  })
})

describe('useRetry', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should initialize with loading false and no error', () => {
    const mockFn = jest.fn().mockResolvedValue('success')
    const { result } = renderHook(() => useRetry(mockFn))

    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBe(null)
    expect(result.current.data).toBe(null)
  })

  it('should set loading to true during execution', async () => {
    const mockFn = jest.fn().mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve('success'), 100))
    )
    const { result } = renderHook(() => useRetry(mockFn))

    act(() => {
      result.current.execute()
    })

    expect(result.current.loading).toBe(true)

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })
  })

  it('should set data on successful execution', async () => {
    const mockFn = jest.fn().mockResolvedValue('success')
    const { result } = renderHook(() => useRetry(mockFn, { initialDelay: 10 }))

    await act(async () => {
      await result.current.execute()
    })

    expect(result.current.data).toBe('success')
    expect(result.current.error).toBe(null)
    expect(result.current.loading).toBe(false)
  })

  it('should set error on failed execution', async () => {
    const mockError = new Error('Test error')
    const mockFn = jest.fn().mockRejectedValue(mockError)
    const { result } = renderHook(() => useRetry(mockFn, { maxAttempts: 1, initialDelay: 10 }))

    await act(async () => {
      try {
        await result.current.execute()
      } catch {
        // Expected to throw
      }
    })

    expect(result.current.error).toEqual(mockError)
    expect(result.current.data).toBe(null)
    expect(result.current.loading).toBe(false)
  })

  it('should retry on error', async () => {
    const mockFn = jest.fn()
      .mockRejectedValueOnce(new Error('First attempt'))
      .mockResolvedValueOnce('success')

    const { result } = renderHook(() => useRetry(mockFn, { initialDelay: 10 }))

    await act(async () => {
      await result.current.execute()
    })

    expect(mockFn).toHaveBeenCalledTimes(2)
    expect(result.current.data).toBe('success')
  })

  it('should have a retry function that executes again', async () => {
    const mockFn = jest.fn().mockResolvedValue('success')
    const { result } = renderHook(() => useRetry(mockFn, { initialDelay: 10 }))

    await act(async () => {
      await result.current.execute()
    })

    expect(mockFn).toHaveBeenCalledTimes(1)

    await act(async () => {
      await result.current.retry()
    })

    expect(mockFn).toHaveBeenCalledTimes(2)
  })

  it('should convert non-Error objects to Error instances', async () => {
    const mockFn = jest.fn().mockRejectedValue('string error')
    const { result } = renderHook(() => useRetry(mockFn, { maxAttempts: 1, initialDelay: 10 }))

    await act(async () => {
      try {
        await result.current.execute()
      } catch {
        // Expected to throw
      }
    })

    expect(result.current.error).toBeInstanceOf(Error)
    expect(result.current.error?.message).toBe('string error')
  })
})

