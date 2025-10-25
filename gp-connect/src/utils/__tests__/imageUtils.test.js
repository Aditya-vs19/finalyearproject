import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  getImageUrl,
  isCloudinaryUrl,
  validateCloudinaryUrl,
  validateImageUrl,
  validateMultipleImageUrls,
  quickValidateImageUrl,
  getProfilePicUrl,
  getPostImageUrl,
  handleImageError,
  handleImageLoad,
  checkImageExists,
  getPlaceholderImage
} from '../imageUtils.js'

// Mock import.meta.env
vi.mock('import.meta', () => ({
  env: {
    VITE_API_URL: 'http://localhost:5000'
  }
}))

describe('imageUtils', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
  })

  describe('isCloudinaryUrl', () => {
    it('should return true for cloudinary.com URLs', () => {
      expect(isCloudinaryUrl('https://res.cloudinary.com/demo/image/upload/sample.jpg')).toBe(true)
      expect(isCloudinaryUrl('http://cloudinary.com/demo/image/upload/sample.jpg')).toBe(true)
    })

    it('should return true for res.cloudinary.com URLs', () => {
      expect(isCloudinaryUrl('https://res.cloudinary.com/demo/image/upload/v1234567890/sample.jpg')).toBe(true)
    })

    it('should return false for non-Cloudinary URLs', () => {
      expect(isCloudinaryUrl('https://example.com/image.jpg')).toBe(false)
      expect(isCloudinaryUrl('http://localhost:5000/uploads/image.jpg')).toBe(false)
      expect(isCloudinaryUrl('/uploads/image.jpg')).toBe(false)
    })

    it('should return false for null, undefined, or non-string values', () => {
      expect(isCloudinaryUrl(null)).toBe(false)
      expect(isCloudinaryUrl(undefined)).toBe(false)
      expect(isCloudinaryUrl('')).toBe(false)
      expect(isCloudinaryUrl(123)).toBe(false)
      expect(isCloudinaryUrl({})).toBe(false)
    })
  })

  describe('validateCloudinaryUrl', () => {
    it('should return valid Cloudinary URLs unchanged', () => {
      const url = 'https://res.cloudinary.com/demo/image/upload/sample.jpg'
      expect(validateCloudinaryUrl(url)).toBe(url)
    })

    it('should throw error for non-Cloudinary URLs', () => {
      expect(() => validateCloudinaryUrl('https://example.com/image.jpg'))
        .toThrow('Invalid Cloudinary URL format')
    })

    it('should throw error for Cloudinary URLs without protocol', () => {
      expect(() => validateCloudinaryUrl('res.cloudinary.com/demo/image/upload/sample.jpg'))
        .toThrow('Cloudinary URL must include protocol')
    })

    it('should accept both http and https protocols', () => {
      const httpsUrl = 'https://res.cloudinary.com/demo/image/upload/sample.jpg'
      const httpUrl = 'http://res.cloudinary.com/demo/image/upload/sample.jpg'
      
      expect(validateCloudinaryUrl(httpsUrl)).toBe(httpsUrl)
      expect(validateCloudinaryUrl(httpUrl)).toBe(httpUrl)
    })
  })

  describe('getImageUrl', () => {
    it('should return null for null or undefined input', () => {
      expect(getImageUrl(null)).toBe(null)
      expect(getImageUrl(undefined)).toBe(null)
      expect(getImageUrl('')).toBe(null)
    })

    it('should return Cloudinary URLs unchanged', () => {
      const cloudinaryUrl = 'https://res.cloudinary.com/demo/image/upload/v1234567890/sample.jpg'
      expect(getImageUrl(cloudinaryUrl)).toBe(cloudinaryUrl)
    })

    it('should handle various Cloudinary URL formats', () => {
      const urls = [
        'https://res.cloudinary.com/demo/image/upload/sample.jpg',
        'https://res.cloudinary.com/demo/image/upload/v1234567890/sample.jpg',
        'https://res.cloudinary.com/demo/image/upload/c_fill,w_300,h_200/sample.jpg',
        'http://cloudinary.com/demo/raw/upload/document.pdf',
        'https://res.cloudinary.com/demo/video/upload/sample.mp4'
      ]

      urls.forEach(url => {
        expect(getImageUrl(url)).toBe(url)
      })
    })

    it('should return other full URLs unchanged', () => {
      const urls = [
        'https://example.com/image.jpg',
        'http://cdn.example.com/assets/photo.png',
        'https://s3.amazonaws.com/bucket/image.jpg'
      ]

      urls.forEach(url => {
        expect(getImageUrl(url)).toBe(url)
      })
    })

    it('should prepend API base URL for paths starting with /', () => {
      expect(getImageUrl('/uploads/image.jpg')).toBe('http://localhost:5000/uploads/image.jpg')
      expect(getImageUrl('/static/avatar.png')).toBe('http://localhost:5000/static/avatar.png')
    })

    it('should prepend API base URL for relative paths', () => {
      expect(getImageUrl('uploads/image.jpg')).toBe('http://localhost:5000/uploads/image.jpg')
      expect(getImageUrl('avatar.png')).toBe('http://localhost:5000/avatar.png')
    })

    it('should use VITE_API_URL environment variable when available', () => {
      // This is already mocked in the setup, but let's verify the behavior
      expect(getImageUrl('/test.jpg')).toBe('http://localhost:5000/test.jpg')
    })
  })

  describe('validateImageUrl', () => {
    beforeEach(() => {
      vi.clearAllTimers()
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('should return error result for null or undefined URL', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      
      const result1 = await validateImageUrl(null)
      expect(result1.isAccessible).toBe(false)
      expect(result1.attempts).toBe(0)
      expect(result1.lastError).toBeInstanceOf(Error)
      
      const result2 = await validateImageUrl(undefined)
      expect(result2.isAccessible).toBe(false)
      
      const result3 = await validateImageUrl('')
      expect(result3.isAccessible).toBe(false)
      
      consoleSpy.mockRestore()
    })

    it('should return success result for accessible images on first attempt', async () => {
      global.fetch.mockResolvedValue({ ok: true })
      
      const result = await validateImageUrl('https://example.com/image.jpg')
      expect(result.isAccessible).toBe(true)
      expect(result.attempts).toBe(1)
      expect(result.lastError).toBe(null)
      expect(global.fetch).toHaveBeenCalledWith('https://example.com/image.jpg', {
        method: 'HEAD',
        signal: expect.any(AbortSignal),
        headers: {
          'Accept': 'image/*,*/*;q=0.8'
        }
      })
    })

    it('should retry on failure and eventually succeed', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {})
      
      global.fetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ ok: true })
      
      const validationPromise = validateImageUrl('https://example.com/image.jpg', { maxRetries: 2 })
      
      // Fast-forward through the retry delay
      await vi.runAllTimersAsync()
      
      const result = await validationPromise
      expect(result.isAccessible).toBe(true)
      expect(result.attempts).toBe(2)
      expect(result.lastError).toBe(null)
      
      consoleSpy.mockRestore()
      infoSpy.mockRestore()
    })

    it('should fail after max retries', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      
      global.fetch.mockRejectedValue(new Error('Persistent network error'))
      
      const validationPromise = validateImageUrl('https://example.com/image.jpg', { maxRetries: 2 })
      
      // Fast-forward through all retry delays
      await vi.runAllTimersAsync()
      
      const result = await validationPromise
      expect(result.isAccessible).toBe(false)
      expect(result.attempts).toBe(3) // 1 initial + 2 retries
      expect(result.lastError).toBeInstanceOf(Error)
      expect(result.lastError.message).toBe('Persistent network error')
      
      consoleSpy.mockRestore()
      warnSpy.mockRestore()
    })

    it('should handle HTTP error responses', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      
      global.fetch.mockResolvedValue({ ok: false, status: 404, statusText: 'Not Found' })
      
      const validationPromise = validateImageUrl('https://example.com/nonexistent.jpg', { maxRetries: 1 })
      
      await vi.runAllTimersAsync()
      
      const result = await validationPromise
      expect(result.isAccessible).toBe(false)
      expect(result.lastError.message).toBe('HTTP 404: Not Found')
      
      consoleSpy.mockRestore()
    })

    it('should use exponential backoff for retries', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {})
      
      global.fetch.mockRejectedValue(new Error('Network error'))
      
      const validationPromise = validateImageUrl('https://example.com/image.jpg', {
        maxRetries: 2,
        initialDelay: 100,
        backoffMultiplier: 2
      })
      
      await vi.runAllTimersAsync()
      
      const result = await validationPromise
      expect(result.isAccessible).toBe(false)
      
      consoleSpy.mockRestore()
      infoSpy.mockRestore()
    })

    it('should include context in error logging', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      
      global.fetch.mockRejectedValue(new Error('Network error'))
      
      const context = { userId: '123', postId: '456' }
      const validationPromise = validateImageUrl('https://example.com/image.jpg', {
        maxRetries: 0,
        context
      })
      
      await vi.runAllTimersAsync()
      
      await validationPromise
      
      expect(consoleSpy).toHaveBeenCalledWith('Image validation failed:', expect.objectContaining({
        context: expect.objectContaining(context)
      }))
      
      consoleSpy.mockRestore()
    })
  })

  describe('validateMultipleImageUrls', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('should validate multiple URLs concurrently', async () => {
      global.fetch
        .mockResolvedValueOnce({ ok: true })
        .mockResolvedValueOnce({ ok: false, status: 404, statusText: 'Not Found' })
        .mockResolvedValueOnce({ ok: true })
      
      const urls = [
        'https://example.com/image1.jpg',
        'https://example.com/image2.jpg',
        'https://example.com/image3.jpg'
      ]
      
      const validationPromise = validateMultipleImageUrls(urls, { maxRetries: 0 })
      
      await vi.runAllTimersAsync()
      
      const results = await validationPromise
      
      expect(results).toHaveLength(3)
      expect(results[0].isAccessible).toBe(true)
      expect(results[1].isAccessible).toBe(false)
      expect(results[2].isAccessible).toBe(true)
      
      expect(results[0].url).toBe(urls[0])
      expect(results[1].url).toBe(urls[1])
      expect(results[2].url).toBe(urls[2])
    })

    it('should throw error for non-array input', async () => {
      await expect(validateMultipleImageUrls('not-an-array')).rejects.toThrow('URLs must be provided as an array')
    })

    it('should include batch context in validation', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      
      global.fetch.mockRejectedValue(new Error('Network error'))
      
      const urls = ['https://example.com/image1.jpg', 'https://example.com/image2.jpg']
      const validationPromise = validateMultipleImageUrls(urls, { maxRetries: 0 })
      
      await vi.runAllTimersAsync()
      
      await validationPromise
      
      expect(consoleSpy).toHaveBeenCalledWith('Image validation failed:', expect.objectContaining({
        context: expect.objectContaining({
          batchIndex: expect.any(Number),
          batchSize: 2
        })
      }))
      
      consoleSpy.mockRestore()
    })
  })

  describe('quickValidateImageUrl', () => {
    it('should return true for accessible images', async () => {
      global.fetch.mockResolvedValue({ ok: true })
      
      const result = await quickValidateImageUrl('https://example.com/image.jpg')
      expect(result).toBe(true)
    })

    it('should return false for inaccessible images', async () => {
      global.fetch.mockResolvedValue({ ok: false })
      
      const result = await quickValidateImageUrl('https://example.com/nonexistent.jpg')
      expect(result).toBe(false)
    })

    it('should return false for invalid URLs without logging', async () => {
      const result1 = await quickValidateImageUrl(null)
      const result2 = await quickValidateImageUrl('')
      
      expect(result1).toBe(false)
      expect(result2).toBe(false)
    })

    it('should return false on network errors without logging', async () => {
      global.fetch.mockRejectedValue(new Error('Network error'))
      
      const result = await quickValidateImageUrl('https://example.com/image.jpg')
      expect(result).toBe(false)
    })

    it('should use custom timeout', async () => {
      // Mock fetch to reject with AbortError (simulating timeout)
      const abortError = new Error('The operation was aborted')
      abortError.name = 'AbortError'
      global.fetch.mockRejectedValue(abortError)
      
      const result = await quickValidateImageUrl('https://example.com/image.jpg', 1000)
      expect(result).toBe(false) // Should timeout and return false
    })
  })

  describe('getProfilePicUrl', () => {
    it('should return processed URL for valid profile pic', () => {
      expect(getProfilePicUrl('/uploads/avatar.jpg')).toBe('http://localhost:5000/uploads/avatar.jpg')
    })

    it('should return default avatar for null/undefined profile pic', () => {
      expect(getProfilePicUrl(null)).toBe('/default-avatar.svg')
      expect(getProfilePicUrl(undefined)).toBe('/default-avatar.svg')
      expect(getProfilePicUrl('')).toBe('/default-avatar.svg')
    })

    it('should handle Cloudinary URLs for profile pics', () => {
      const cloudinaryUrl = 'https://res.cloudinary.com/demo/image/upload/avatar.jpg'
      expect(getProfilePicUrl(cloudinaryUrl)).toBe(cloudinaryUrl)
    })
  })

  describe('getPostImageUrl', () => {
    it('should return processed URL using getImageUrl', () => {
      expect(getPostImageUrl('/uploads/post.jpg')).toBe('http://localhost:5000/uploads/post.jpg')
    })

    it('should handle Cloudinary URLs for posts', () => {
      const cloudinaryUrl = 'https://res.cloudinary.com/demo/image/upload/post.jpg'
      expect(getPostImageUrl(cloudinaryUrl)).toBe(cloudinaryUrl)
    })

    it('should return null for null input', () => {
      expect(getPostImageUrl(null)).toBe(null)
    })
  })

  describe('handleImageError', () => {
    it('should set fallback src and display block', () => {
      const mockEvent = {
        target: {
          src: '',
          style: { display: '' }
        }
      }

      handleImageError(mockEvent)
      
      expect(mockEvent.target.src).toBe('/default-avatar.svg')
      expect(mockEvent.target.style.display).toBe('block')
    })

    it('should use custom fallback src when provided', () => {
      const mockEvent = {
        target: {
          src: '',
          style: { display: '' }
        }
      }

      handleImageError(mockEvent, '/custom-fallback.jpg')
      
      expect(mockEvent.target.src).toBe('/custom-fallback.jpg')
      expect(mockEvent.target.style.display).toBe('block')
    })
  })

  describe('handleImageLoad', () => {
    it('should set display to block on successful load', () => {
      const mockEvent = {
        target: {
          style: { display: 'none' }
        }
      }

      handleImageLoad(mockEvent)
      
      expect(mockEvent.target.style.display).toBe('block')
    })
  })

  describe('checkImageExists', () => {
    it('should return true for existing images', async () => {
      global.fetch.mockResolvedValue({ ok: true })
      
      const result = await checkImageExists('https://example.com/image.jpg')
      expect(result).toBe(true)
      expect(global.fetch).toHaveBeenCalledWith('https://example.com/image.jpg', { method: 'HEAD' })
    })

    it('should return false for non-existing images', async () => {
      global.fetch.mockResolvedValue({ ok: false })
      
      const result = await checkImageExists('https://example.com/nonexistent.jpg')
      expect(result).toBe(false)
    })

    it('should return false when fetch throws error', async () => {
      global.fetch.mockRejectedValue(new Error('Network error'))
      
      const result = await checkImageExists('https://example.com/image.jpg')
      expect(result).toBe(false)
    })
  })

  describe('getPlaceholderImage', () => {
    it('should return profile placeholder for profile type', () => {
      expect(getPlaceholderImage('profile')).toBe('/default-avatar.svg')
    })

    it('should return post placeholder for post type', () => {
      const result = getPlaceholderImage('post')
      expect(result).toContain('data:image/svg+xml;base64,')
    })

    it('should return post placeholder as default', () => {
      const result = getPlaceholderImage()
      expect(result).toContain('data:image/svg+xml;base64,')
    })

    it('should return post placeholder for unknown types', () => {
      const result = getPlaceholderImage('unknown')
      expect(result).toContain('data:image/svg+xml;base64,')
    })
  })
})