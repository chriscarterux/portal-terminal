import '@testing-library/jest-dom';

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock window.electronAPI
const mockElectronAPI = {
  terminal: {
    create: jest.fn().mockResolvedValue('terminal-1'),
    write: jest.fn().mockResolvedValue(undefined),
    resize: jest.fn().mockResolvedValue(undefined),
    kill: jest.fn().mockResolvedValue(undefined),
    onData: jest.fn(),
    onExit: jest.fn(),
  },
  window: {
    close: jest.fn().mockResolvedValue(undefined),
    minimize: jest.fn().mockResolvedValue(undefined),
    maximize: jest.fn().mockResolvedValue(undefined),
    isMaximized: jest.fn().mockResolvedValue(false),
  },
};

Object.defineProperty(window, 'electronAPI', {
  value: mockElectronAPI,
  writable: true,
});