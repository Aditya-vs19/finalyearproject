import React from 'react';
import { globalImageErrorHandler, getErrorMessage } from '../services/imageErrorHandler.js';
import { getPlaceholderImage } from '../utils/imageUtils.js';
import './ImageErrorBoundary.css';

/**
 * Error boundary component for image-related operations
 * Addresses Requirements: 2.4, 5.3, 5.4
 */
class ImageErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorMessage: null,
      retryCount: 0
    };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error: error
    };
  }

  componentDidCatch(error, errorInfo) {
    // Log the error using our image error handler
    const errorMessage = getErrorMessage(error);
    
    this.setState({
      error,
      errorInfo,
      errorMessage
    });

    // Log to our error handler
    globalImageErrorHandler.logError(
      this.props.imageUrl || 'unknown',
      error,
      'component_error',
      {
        component: this.props.componentName || 'ImageErrorBoundary',
        errorInfo,
        props: this.props
      }
    );

    // Call parent error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleRetry = () => {
    this.setState(prevState => ({
      hasError: false,
      error: null,
      errorInfo: null,
      errorMessage: null,
      retryCount: prevState.retryCount + 1
    }));
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.handleRetry);
      }

      // Default fallback UI
      return (
        <div className="image-error-boundary">
          <div className="error-content">
            <img 
              src={getPlaceholderImage(this.props.imageType || 'post')} 
              alt="Error placeholder"
              className="error-placeholder-img"
            />
            <div className="error-details">
              <h4>Something went wrong</h4>
              <p>{this.state.errorMessage || 'An unexpected error occurred while loading the image.'}</p>
              {this.props.showRetry !== false && (
                <button 
                  onClick={this.handleRetry}
                  className="retry-button"
                  type="button"
                >
                  Try Again
                </button>
              )}

            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Higher-order component to wrap components with image error boundary
 * @param {React.Component} WrappedComponent - Component to wrap
 * @param {Object} boundaryProps - Props for the error boundary
 * @returns {React.Component} - Wrapped component
 */
export const withImageErrorBoundary = (WrappedComponent, boundaryProps = {}) => {
  return function ImageErrorBoundaryWrapper(props) {
    return (
      <ImageErrorBoundary {...boundaryProps}>
        <WrappedComponent {...props} />
      </ImageErrorBoundary>
    );
  };
};

/**
 * Hook for handling image errors in functional components
 * @param {Object} options - Error handling options
 * @returns {Object} - Error handling utilities
 */
export const useImageErrorHandler = (options = {}) => {
  const [errorState, setErrorState] = React.useState({
    hasError: false,
    error: null,
    errorMessage: null,
    retryCount: 0
  });

  const handleError = React.useCallback((error, context = {}) => {
    const errorMessage = getErrorMessage(error);
    
    setErrorState(prev => ({
      hasError: true,
      error,
      errorMessage,
      retryCount: prev.retryCount + 1
    }));

    // Log error
    globalImageErrorHandler.logError(
      context.imageUrl || 'unknown',
      error,
      'hook_error',
      {
        ...context,
        component: options.componentName || 'useImageErrorHandler'
      }
    );

    if (options.onError) {
      options.onError(error, context);
    }
  }, [options]);

  const clearError = React.useCallback(() => {
    setErrorState({
      hasError: false,
      error: null,
      errorMessage: null,
      retryCount: 0
    });
  }, []);

  const retry = React.useCallback(() => {
    clearError();
    if (options.onRetry) {
      options.onRetry();
    }
  }, [clearError, options]);

  return {
    errorState,
    handleError,
    clearError,
    retry,
    hasError: errorState.hasError
  };
};

export default ImageErrorBoundary;