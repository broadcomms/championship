import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { ErrorDisplay, InlineError, EmptyState } from '../errors/ErrorDisplay'
import { NetworkError, ValidationError, NotFoundError } from '@/utils/errors'

describe('ErrorDisplay', () => {
  it('should render error with error severity', () => {
    const error = new NetworkError('Server error')
    
    render(<ErrorDisplay error={error} />)
    
    expect(screen.getByText('Network')).toBeInTheDocument()
    expect(screen.getByText(/Server error/)).toBeInTheDocument()
  })

  it('should render error with warning severity for ValidationError', () => {
    const error = new ValidationError('Invalid input', { 
      email: ['Invalid email format'] 
    })
    
    render(<ErrorDisplay error={error} />)
    
    expect(screen.getByText('Validation')).toBeInTheDocument()
    expect(screen.getByText(/Validation failed/)).toBeInTheDocument()
  })

  it('should render error with info severity for NotFoundError', () => {
    const error = new NotFoundError('Document', '123')
    
    render(<ErrorDisplay error={error} />)
    
    expect(screen.getByText('NotFound')).toBeInTheDocument()
    expect(screen.getByText(/could not be found/)).toBeInTheDocument()
  })

  it('should show Try again button when error is retryable', () => {
    const error = new NetworkError('Network error')
    const onRetry = jest.fn()
    
    render(<ErrorDisplay error={error} onRetry={onRetry} />)
    
    const retryButton = screen.getByRole('button', { name: /Try again/i })
    expect(retryButton).toBeInTheDocument()
  })

  it('should call onRetry when Try again is clicked', () => {
    const error = new NetworkError('Network error')
    const onRetry = jest.fn()
    
    render(<ErrorDisplay error={error} onRetry={onRetry} />)
    
    const retryButton = screen.getByRole('button', { name: /Try again/i })
    fireEvent.click(retryButton)
    
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('should show Dismiss button when onDismiss is provided', () => {
    const error = new NetworkError('Network error')
    const onDismiss = jest.fn()
    
    render(<ErrorDisplay error={error} onDismiss={onDismiss} />)
    
    // There are 2 dismiss buttons (text and icon)
    const dismissButtons = screen.getAllByRole('button', { name: 'Dismiss' })
    expect(dismissButtons).toHaveLength(2)
  })

  it('should call onDismiss when Dismiss is clicked', () => {
    const error = new NetworkError('Network error')
    const onDismiss = jest.fn()
    
    render(<ErrorDisplay error={error} onDismiss={onDismiss} />)
    
    const dismissButtons = screen.getAllByRole('button', { name: 'Dismiss' })
    fireEvent.click(dismissButtons[0]) // Click first dismiss button
    
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('should call onDismiss when close icon is clicked', () => {
    const error = new NetworkError('Network error')
    const onDismiss = jest.fn()
    
    render(<ErrorDisplay error={error} onDismiss={onDismiss} />)
    
    const dismissButtons = screen.getAllByRole('button', { name: 'Dismiss' })
    fireEvent.click(dismissButtons[1]) // Click second dismiss button (icon)
    
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('should show both Try again and Dismiss buttons when both callbacks provided', () => {
    const error = new NetworkError('Network error')
    const onRetry = jest.fn()
    const onDismiss = jest.fn()
    
    render(<ErrorDisplay error={error} onRetry={onRetry} onDismiss={onDismiss} />)
    
    expect(screen.getByRole('button', { name: /Try again/i })).toBeInTheDocument()
    const dismissButtons = screen.getAllByRole('button', { name: 'Dismiss' })
    expect(dismissButtons).toHaveLength(2)
  })

  it('should not show Try again button when error is not retryable', () => {
    const error = new ValidationError('Invalid input', { 
      email: ['Invalid email format'] 
    })
    const onRetry = jest.fn()
    
    render(<ErrorDisplay error={error} onRetry={onRetry} />)
    
    expect(screen.queryByRole('button', { name: /Try again/i })).not.toBeInTheDocument()
  })

  it('should apply custom className', () => {
    const error = new NetworkError('Network error')
    
    const { container } = render(
      <ErrorDisplay error={error} className="custom-class" />
    )
    
    expect(container.firstChild).toHaveClass('custom-class')
  })

  it('should render error icon for error severity', () => {
    const error = new NetworkError('Network error')
    
    const { container } = render(<ErrorDisplay error={error} />)
    
    const icon = container.querySelector('svg')
    expect(icon).toBeInTheDocument()
  })

  it('should render warning icon for warning severity', () => {
    const error = new ValidationError('Invalid input', { 
      email: ['Invalid email format'] 
    })
    
    const { container } = render(<ErrorDisplay error={error} />)
    
    const icon = container.querySelector('svg')
    expect(icon).toBeInTheDocument()
  })

  it('should render info icon for info severity', () => {
    const error = new NotFoundError('Document', '123')
    
    const { container } = render(<ErrorDisplay error={error} />)
    
    const icon = container.querySelector('svg')
    expect(icon).toBeInTheDocument()
  })

  it('should handle string errors', () => {
    render(<ErrorDisplay error="Simple error message" />)
    
    expect(screen.getByText('App')).toBeInTheDocument()
    expect(screen.getByText('Simple error message')).toBeInTheDocument()
  })

  it('should handle Error objects', () => {
    const error = new Error('Generic error')
    
    render(<ErrorDisplay error={error} />)
    
    expect(screen.getByText('App')).toBeInTheDocument()
    expect(screen.getByText('Generic error')).toBeInTheDocument()
  })
})

describe('InlineError', () => {
  it('should render error message', () => {
    render(<InlineError message="Field is required" />)
    
    expect(screen.getByText('Field is required')).toBeInTheDocument()
  })

  it('should render error icon', () => {
    const { container } = render(<InlineError message="Field is required" />)
    
    const icon = container.querySelector('svg')
    expect(icon).toBeInTheDocument()
  })

  it('should apply custom className', () => {
    const { container } = render(
      <InlineError message="Field is required" className="custom-inline-class" />
    )
    
    expect(container.firstChild).toHaveClass('custom-inline-class')
  })

  it('should have red text color', () => {
    const { container } = render(<InlineError message="Field is required" />)
    
    expect(container.firstChild).toHaveClass('text-red-600')
  })
})

describe('EmptyState', () => {
  it('should render empty state with title and message', () => {
    render(
      <EmptyState
        title="No documents"
        message="Upload a document to get started"
      />
    )
    
    expect(screen.getByText('No documents')).toBeInTheDocument()
    expect(screen.getByText('Upload a document to get started')).toBeInTheDocument()
  })

  it('should render empty state icon', () => {
    const { container } = render(
      <EmptyState
        title="No documents"
        message="Upload a document to get started"
      />
    )
    
    const icon = container.querySelector('svg')
    expect(icon).toBeInTheDocument()
  })

  it('should render action button when provided', () => {
    render(
      <EmptyState
        title="No documents"
        message="Upload a document to get started"
        action={<button>Upload Document</button>}
      />
    )
    
    expect(screen.getByRole('button', { name: 'Upload Document' })).toBeInTheDocument()
  })

  it('should render error display when error provided', () => {
    const error = new NetworkError('Failed to load documents')
    const onRetry = jest.fn()
    
    render(
      <EmptyState
        title="No documents"
        message="Upload a document to get started"
        error={error}
        onRetry={onRetry}
      />
    )
    
    // Should show error instead of empty state
    expect(screen.getByText('Network')).toBeInTheDocument()
    expect(screen.getByText(/Failed to load documents/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Try again/i })).toBeInTheDocument()
    
    // Should not show empty state
    expect(screen.queryByText('No documents')).not.toBeInTheDocument()
  })

  it('should call onRetry when error retry button is clicked', () => {
    const error = new NetworkError('Failed to load documents')
    const onRetry = jest.fn()
    
    render(
      <EmptyState
        title="No documents"
        message="Upload a document to get started"
        error={error}
        onRetry={onRetry}
      />
    )
    
    const retryButton = screen.getByRole('button', { name: /Try again/i })
    fireEvent.click(retryButton)
    
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('should render empty state without error when no error provided', () => {
    render(
      <EmptyState
        title="No documents"
        message="Upload a document to get started"
      />
    )
    
    expect(screen.getByText('No documents')).toBeInTheDocument()
    expect(screen.queryByText('Network')).not.toBeInTheDocument()
  })
})
