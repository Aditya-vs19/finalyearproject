import { vi } from 'vitest';
import dotenv from 'dotenv';

// Load test environment variables
dotenv.config({ path: '.env' });

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.CLOUDINARY_CLOUD_NAME = 'test-cloud';
process.env.CLOUDINARY_API_KEY = 'test-key';
process.env.CLOUDINARY_API_SECRET = 'test-secret';

// Global test utilities
global.createMockFile = (overrides = {}) => ({
  fieldname: 'image',
  originalname: 'test.jpg',
  encoding: '7bit',
  mimetype: 'image/jpeg',
  size: 1024,
  path: 'https://res.cloudinary.com/test/image/upload/test.jpg',
  filename: 'gp-connect-posts/test123',
  ...overrides
});

global.createMockRequest = (overrides = {}) => ({
  body: {},
  file: null,
  user: { _id: 'user123' },
  ...overrides
});

global.createMockResponse = () => {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis()
  };
  return res;
};

// Suppress console logs during tests unless explicitly needed
const originalConsole = { ...console };
global.console = {
  ...console,
  log: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn()
};

// Restore console for specific tests that need it
global.restoreConsole = () => {
  global.console = originalConsole;
};

// Mock setTimeout for tests that use delays
global.mockSetTimeout = () => {
  const originalSetTimeout = global.setTimeout;
  global.setTimeout = vi.fn((fn) => fn());
  return () => {
    global.setTimeout = originalSetTimeout;
  };
};