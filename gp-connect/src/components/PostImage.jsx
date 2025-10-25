import React, { useState, useEffect, useRef } from 'react';
import { getPostImageUrl, validateImageUrl, getPlaceholderImage, isLocalhostUrl } from '../utils/imageUtils.js';
import { globalImageErrorHandler, gracefulImageDegradation, getErrorMessage } from '../services/imageErrorHandler.js';
import './PostImage.css';

/**
 * Enhanced image component with loading states, error handling, and retry mechanism
 * Addresses Requirements: 2.4, 5.3, 5.4
 */
const PostImage = ({ 
  src, 
  alt = 'Post image', 
  className = '', 
  onLoad = null,
  onError = null,
  maxRetries = 3,
  retryDelay = 1000,
  showRetryButton = true,
  placeholder = null
}) => {
  const [imageState, setImageState] = useState({
    loading: true,
    error: false,
    retryCount: 0,
    src: null,
    errorMessage: null,
    errorType: null,
    fallbackImage: null
  });
  
  const imgRef = useRef(null);
  const retryTimeoutRef = useRef(null);

  // Initialize image source
  useEffect(() => {
    if (src) {
      const imageUrl = getPostImageUrl(src);
      
      // If imageUrl is null (localhost URL detected), immediately show error state
      if (imageUrl === null) {
        setImageState(prev => ({
          ...prev,
          loading: false,
          error: true,
          src: null,
          errorMessage: 'Image was uploaded from another device and is not accessible',
          errorType: 'localhost_unavailable',
          fallbackImage: getPlaceholderImage('post')
        }));
        return;
      }
      
      setImageState(prev => ({
        ...prev,
        src: imageUrl,
        loading: true,
        error: false,
        retryCount: 0
      }));
    } else {
      setImageState(prev => ({
        ...prev,
        loading: false,
        error: true,
        src: null
      }));
    }
  }, [src]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, []);

  const handleImageLoad = () => {
    // Reset error handler retry count on successful load
    globalImageErrorHandler.resetRetryCount(imageState.src);
    
    setImageState(prev => ({
      ...prev,
      loading: false,
      error: false,
      errorMessage: null,
      errorType: null,
      fallbackImage: null
    }));
    
    if (onLoad) {
      onLoad();
    }
  };

  const handleImageError = async (event) => {
    const error = new Error(`Image failed to load: ${event?.target?.src || imageState.src}`);
    console.error('Image failed to load:', imageState.src, error);
    
    // Use comprehensive error handling
    const degradation = await gracefulImageDegradation(imageState.src, error, {
      enableValidation: true,
      fallbackType: 'post',
      context: {
        component: 'PostImage',
        retryAttempt: imageState.retryCount + 1,
        maxRetries,
        src: imageState.src
      }
    });

    // Update error handler retry count
    globalImageErrorHandler.incrementRetryCount(imageState.src);
    
    // If retry is recommended and we haven't exceeded max retries
    if (degradation.shouldRetry && imageState.retryCount < maxRetries) {
      console.log(`Attempting retry ${imageState.retryCount + 1}/${maxRetries} for image:`, imageState.src);
      
      setImageState(prev => ({
        ...prev,
        retryCount: prev.retryCount + 1,
        errorMessage: degradation.errorMessage,
        errorType: degradation.errorType
      }));
      
      // Retry after delay with exponential backoff
      const delay = degradation.retryDelay * Math.pow(2, imageState.retryCount);
      retryTimeoutRef.current = setTimeout(() => {
        if (imgRef.current) {
          // Force reload by adding timestamp
          const newSrc = `${imageState.src}?retry=${Date.now()}`;
          imgRef.current.src = newSrc;
        }
      }, delay);
    } else {
      // Max retries exceeded or retry not recommended, show error state
      setImageState(prev => ({
        ...prev,
        loading: false,
        error: true,
        errorMessage: degradation.errorMessage,
        errorType: degradation.errorType,
        fallbackImage: degradation.fallbackImage
      }));
      
      if (onError) {
        onError(error);
      }
    }
  };

  const handleManualRetry = () => {
    if (imageState.src) {
      // Reset error handler retry count for manual retry
      globalImageErrorHandler.resetRetryCount(imageState.src);
      
      setImageState(prev => ({
        ...prev,
        loading: true,
        error: false,
        retryCount: 0,
        errorMessage: null,
        errorType: null,
        fallbackImage: null
      }));
      
      // Force reload with timestamp
      if (imgRef.current) {
        const newSrc = `${imageState.src}?retry=${Date.now()}`;
        imgRef.current.src = newSrc;
      }
    }
  };

  const getPlaceholderSrc = () => {
    // Use fallback image from error handler if available
    if (imageState.fallbackImage) {
      return imageState.fallbackImage;
    }
    return placeholder || getPlaceholderImage('post');
  };

  // If no source provided, show placeholder
  if (!src) {
    return (
      <div className={`post-image-container no-image ${className}`}>
        <div className="image-placeholder">
          <img 
            src={getPlaceholderSrc()} 
            alt="No image available" 
            className="placeholder-img"
          />
        </div>
      </div>
    );
  }

  // If error state and no retry available, show error placeholder
  if (imageState.error && (!showRetryButton || imageState.retryCount >= maxRetries)) {
    const containerClass = imageState.errorType === 'localhost_unavailable' 
      ? 'localhost-unavailable' 
      : 'error-state';
      
    return (
      <div className={`post-image-container ${containerClass} ${className}`}>
        <div className="image-error-placeholder">
          <img 
            src={getPlaceholderSrc()} 
            alt="Image not available" 
            className="placeholder-img"
          />
          <div className="error-message">
            <p>{imageState.errorMessage || 'Image not available'}</p>
            {imageState.errorType && (
              <p className="error-type">Error: {imageState.errorType.replace('_', ' ')}</p>
            )}
            {showRetryButton && imageState.errorType !== 'localhost_unavailable' && (
              <button 
                onClick={handleManualRetry}
                className="retry-button"
                type="button"
                title="Try loading the image again"
              >
                Try Again
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // If error state but retries available, show retry option
  if (imageState.error && showRetryButton && imageState.retryCount < maxRetries) {
    return (
      <div className={`post-image-container retry-state ${className}`}>
        <div className="image-retry-placeholder">
          <img 
            src={getPlaceholderSrc()} 
            alt="Image failed to load" 
            className="placeholder-img"
          />
          <div className="retry-message">
            <p>{imageState.errorMessage || 'Failed to load image'}</p>
            {imageState.errorType && (
              <p className="error-type">Error: {imageState.errorType.replace('_', ' ')}</p>
            )}
            <button 
              onClick={handleManualRetry}
              className="retry-button"
              type="button"
              title={`Try loading the image again. ${maxRetries - imageState.retryCount} attempts remaining.`}
            >
              Retry ({maxRetries - imageState.retryCount} attempts left)
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`post-image-container ${imageState.loading ? 'loading' : ''} ${className}`}>
      {imageState.loading && (
        <div className="image-loading-overlay">
          <div className="loading-spinner"></div>
          <p>Loading image...</p>
        </div>
      )}
      
      <img
        ref={imgRef}
        src={imageState.src}
        alt={alt}
        className={`post-image ${imageState.loading ? 'loading' : ''}`}
        onLoad={handleImageLoad}
        onError={handleImageError}
        style={{ 
          display: imageState.loading ? 'none' : 'block',
          opacity: imageState.loading ? 0 : 1
        }}
      />
      
      {imageState.retryCount > 0 && !imageState.error && (
        <div className="retry-indicator">
          Retry attempt {imageState.retryCount}
        </div>
      )}
    </div>
  );
};

export default PostImage;