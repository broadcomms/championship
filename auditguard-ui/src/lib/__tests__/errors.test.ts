import {
  AppError,
  NetworkError,
  ValidationError,
  AuthError,
  NotFoundError,
  BusinessError,
  TimeoutError,
  toAppError,
  getErrorDisplay,
} from '../../utils/errors'

describe('AppError', () => {
  it('should create base AppError', () => {
    const error = new AppError('Test error')
    
    expect(error.message).toBe('Test error')
    expect(error.name).toBe('AppError')
    expect(error.statusCode).toBeUndefined()
    expect(error.context.timestamp).toBeDefined()
  })

  it('should include context', () => {
    const context = { userId: '123', action: 'test' }
    const error = new AppError('Test error', context)
    
    expect(error.context.userId).toBe('123')
    expect(error.context.action).toBe('test')
    expect(error.context.timestamp).toBeDefined()
  })

  it('should get user message with default', () => {
    const error = new AppError('Test error')
    
    expect(error.getUserMessage()).toBe('Test error')
  })

  it('should get user message with custom', () => {
    const error = new AppError('Test error', { userMessage: 'Custom message' })
    
    expect(error.getUserMessage()).toBe('Custom message')
  })
})

describe('NetworkError', () => {
  it('should create NetworkError', () => {
    const error = new NetworkError('Network failed')
    
    expect(error.name).toBe('NetworkError')
    expect(error.message).toBe('Network failed')
    expect(error.statusCode).toBeUndefined()
  })

  it('should create from fetch error', () => {
    const fetchError = new TypeError('Failed to fetch')
    const error = NetworkError.fromFetchError(fetchError, '/api/test')
    
    expect(error.name).toBe('NetworkError')
    expect(error.message).toBe('Failed to fetch')
    expect(error.context.debugInfo).toBeDefined()
  })

  it('should create from response with text', async () => {
    const response = new Response('Server Error', { 
      status: 500,
      statusText: 'Internal Server Error',
    })
    
    const error = NetworkError.fromResponse(response)
    
    expect(error.statusCode).toBe(500)
    expect(error.message).toContain('500')
    expect(error.context.debugInfo?.statusText).toBe('Internal Server Error')
  })

  it('should create from response with JSON', async () => {
    const response = new Response(
      JSON.stringify({ message: 'Custom error', details: 'More info' }),
      { 
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    )
    
    const error = NetworkError.fromResponse(response)
    
    expect(error.statusCode).toBe(400)
    expect(error.message).toContain('400')
  })
})

describe('ValidationError', () => {
  it('should create ValidationError', () => {
    const error = new ValidationError('Validation failed')
    
    expect(error.name).toBe('ValidationError')
    expect(error.message).toBe('Validation failed')
    expect(error.statusCode).toBe(400)
  })

  it('should include field errors', () => {
    const fieldErrors = {
      email: ['Invalid email format'],
      password: ['Password too short'],
    }
    const error = new ValidationError('Validation failed', fieldErrors)
    
    expect(error.fields).toEqual(fieldErrors)
  })

  it('should get user message with field errors', () => {
    const fieldErrors = {
      email: ['Invalid email format'],
    }
    const error = new ValidationError('Validation failed', fieldErrors)
    
    const message = error.getUserMessage()
    expect(message).toContain('Validation failed')
  })
})

describe('AuthError', () => {
  it('should create AuthError', () => {
    const error = new AuthError('Unauthorized')
    
    expect(error.name).toBe('AuthError')
    expect(error.statusCode).toBe(401)
  })
})

describe('NotFoundError', () => {
  it('should create NotFoundError', () => {
    const error = new NotFoundError('Document', '123')
    
    expect(error.name).toBe('NotFoundError')
    expect(error.statusCode).toBe(404)
    expect(error.message).toContain('Document not found')
    expect(error.message).toContain('123')
  })

  it('should include resource info in debug', () => {
    const error = new NotFoundError('Document', '123')
    
    expect(error.context.debugInfo).toEqual({
      resourceType: 'Document',
      resourceId: '123',
    })
  })
})

describe('BusinessError', () => {
  it('should create BusinessError', () => {
    const error = new BusinessError('Business rule violated')
    
    expect(error.name).toBe('BusinessError')
    expect(error.statusCode).toBe(400)
  })
})

describe('TimeoutError', () => {
  it('should create TimeoutError', () => {
    const error = new TimeoutError('api_request', 5000)
    
    expect(error.name).toBe('TimeoutError')
    expect(error.statusCode).toBe(408)
    expect(error.message).toContain('timed out')
    expect(error.message).toContain('5000ms')
  })
})

describe('toAppError', () => {
  it('should pass through AppError', () => {
    const originalError = new ValidationError('Test')
    const result = toAppError(originalError)
    
    expect(result).toBe(originalError)
  })

  it('should convert Error to AppError', () => {
    const originalError = new Error('Generic error')
    const result = toAppError(originalError)
    
    expect(result).toBeInstanceOf(AppError)
    expect(result.message).toBe('Generic error')
    expect(result.context.debugInfo).toBeDefined()
  })

  it('should convert string to AppError', () => {
    const result = toAppError('String error')
    
    expect(result).toBeInstanceOf(AppError)
    expect(result.message).toBe('String error')
  })

  it('should convert unknown to AppError', () => {
    const result = toAppError({ weird: 'object' })
    
    expect(result).toBeInstanceOf(AppError)
    expect(result.message).toBe('[object Object]')
  })

  it('should preserve error information in context', () => {
    const originalError = new TypeError('Type error')
    const result = toAppError(originalError)
    
    expect(result.context.debugInfo).toBeDefined()
    expect(result.message).toBe('Type error')
  })
})

describe('getErrorDisplay', () => {
  it('should extract AppError display', () => {
    const error = new ValidationError('Test error', { email: ['Invalid email'] })
    
    const display = getErrorDisplay(error)
    
    expect(display.message).toBe('Validation failed: email: Invalid email')
    expect(display.title).toBe('Validation')
    expect(display.severity).toBe('warning')
  })

  it('should extract Error display', () => {
    const error = new Error('Generic error')
    
    const display = getErrorDisplay(error)
    
    expect(display.message).toBe('Generic error')
    expect(display.title).toBe('App')
  })

  it('should extract string display', () => {
    const display = getErrorDisplay('String error')
    
    expect(display.message).toBe('String error')
    expect(display.title).toBe('App')
  })

  it('should extract unknown display', () => {
    const display = getErrorDisplay({ weird: 'object' })
    
    expect(display.message).toBe('[object Object]')
    expect(display.title).toBe('App')
  })

  it('should include status code in title when available', () => {
    const error = new NetworkError('Test error')
    
    const display = getErrorDisplay(error)
    
    expect(display.title).toBe('Network')
    expect(display.canRetry).toBe(true)
  })
})
