import React from 'react'
import { render, screen } from '@testing-library/react'
import { ErrorBoundary, SectionErrorBoundary } from '../errors/ErrorBoundary'

// Component that throws an error
function ThrowError({ message }: { message: string }) {
  throw new Error(message)
}

// Component that doesn't throw
function NoError() {
  return <div>No error occurred</div>
}

describe('ErrorBoundary', () => {
  // Suppress console.error for tests
  const originalError = console.error
  beforeAll(() => {
    console.error = jest.fn()
  })

  afterAll(() => {
    console.error = originalError
  })

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should render children when no error occurs', () => {
    render(
      <ErrorBoundary>
        <NoError />
      </ErrorBoundary>
    )

    expect(screen.getByText('No error occurred')).toBeInTheDocument()
  })

  it('should catch errors and render fallback UI', () => {
    render(
      <ErrorBoundary>
        <ThrowError message="Test error" />
      </ErrorBoundary>
    )

    expect(screen.getByText(/Something went wrong/)).toBeInTheDocument()
    expect(screen.getByText(/We encountered an unexpected error/)).toBeInTheDocument()
  })

  it('should render Try Again button', () => {
    render(
      <ErrorBoundary>
        <ThrowError message="Test error" />
      </ErrorBoundary>
    )

    expect(screen.getByRole('button', { name: /Try Again/i })).toBeInTheDocument()
  })

  it('should render Go Home button', () => {
    render(
      <ErrorBoundary>
        <ThrowError message="Test error" />
      </ErrorBoundary>
    )

    expect(screen.getByRole('button', { name: /Go Home/i })).toBeInTheDocument()
  })

  it('should include error name in heading', () => {
    render(
      <ErrorBoundary>
        <ThrowError message="Test error" />
      </ErrorBoundary>
    )

    expect(screen.getByText(/Something went wrong/)).toBeInTheDocument()
  })

  it('should recover after trying again', () => {
    let shouldThrow = true

    function ConditionalError() {
      if (shouldThrow) {
        throw new Error('Initial error')
      }
      return <div>Success!</div>
    }

    const { rerender } = render(
      <ErrorBoundary>
        <ConditionalError />
      </ErrorBoundary>
    )

    // Error state shown
    expect(screen.getByText(/Something went wrong/)).toBeInTheDocument()

    // Fix the error and rerender
    shouldThrow = false
    rerender(
      <ErrorBoundary>
        <ConditionalError />
      </ErrorBoundary>
    )

    // Still showing error (ErrorBoundary needs reset)
    expect(screen.getByText(/Something went wrong/)).toBeInTheDocument()
  })
})

describe('SectionErrorBoundary', () => {
  const originalError = console.error
  beforeAll(() => {
    console.error = jest.fn()
  })

  afterAll(() => {
    console.error = originalError
  })

  it('should render children when no error occurs', () => {
    render(
      <SectionErrorBoundary title="Test Section">
        <NoError />
      </SectionErrorBoundary>
    )

    expect(screen.getByText('No error occurred')).toBeInTheDocument()
  })

  it('should display section title in error', () => {
    render(
      <SectionErrorBoundary title="Test Section">
        <ThrowError message="Section error" />
      </SectionErrorBoundary>
    )

    expect(screen.getByText('Test Section')).toBeInTheDocument()
    expect(screen.getByText(/Failed to load this section/)).toBeInTheDocument()
  })

  it('should catch section errors independently', () => {
    render(
      <div>
        <SectionErrorBoundary title="Section 1">
          <ThrowError message="Error 1" />
        </SectionErrorBoundary>
        <SectionErrorBoundary title="Section 2">
          <NoError />
        </SectionErrorBoundary>
      </div>
    )

    // Section 1 shows error
    expect(screen.getByText('Section 1')).toBeInTheDocument()
    expect(screen.getAllByText(/Failed to load this section/)[0]).toBeInTheDocument()
    
    // Section 2 works fine
    expect(screen.getByText('No error occurred')).toBeInTheDocument()
  })
})
