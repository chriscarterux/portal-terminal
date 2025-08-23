// Jest setup file
// Add any global test setup here

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  // Keep native behavior for log, but suppress warnings/errors in tests
  warn: jest.fn(),
  error: jest.fn(),
  log: console.log,
  info: console.info,
};