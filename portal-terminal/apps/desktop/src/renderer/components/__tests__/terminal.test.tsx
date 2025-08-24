import React from 'react';
import { render, screen } from '@testing-library/react';
import { TerminalComponent } from '../terminal';

// Mock xterm
jest.mock('@xterm/xterm', () => ({
  Terminal: jest.fn().mockImplementation(() => ({
    open: jest.fn(),
    write: jest.fn(),
    onData: jest.fn(),
    dispose: jest.fn(),
    cols: 80,
    rows: 24,
    loadAddon: jest.fn(),
  })),
}));

jest.mock('@xterm/addon-fit', () => ({
  FitAddon: jest.fn().mockImplementation(() => ({
    fit: jest.fn(),
  })),
}));

jest.mock('@xterm/addon-web-links', () => ({
  WebLinksAddon: jest.fn(),
}));

// Mock window.electronAPI
const mockElectronAPI = {
  terminal: {
    create: jest.fn().mockResolvedValue('terminal-1'),
    write: jest.fn(),
    resize: jest.fn(),
    kill: jest.fn(),
    onData: jest.fn(),
    onExit: jest.fn(),
  },
};

Object.defineProperty(window, 'electronAPI', {
  value: mockElectronAPI,
  writable: true,
});

describe('TerminalComponent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render terminal container', () => {
    render(<TerminalComponent />);
    
    const container = document.querySelector('.terminal-container');
    expect(container).toBeInTheDocument();
  });

  it('should create terminal session on mount', async () => {
    render(<TerminalComponent />);
    
    expect(mockElectronAPI.terminal.create).toHaveBeenCalledWith({
      cols: 80,
      rows: 24,
    });
  });

  it('should set up event listeners', () => {
    render(<TerminalComponent />);
    
    expect(mockElectronAPI.terminal.onData).toHaveBeenCalled();
    expect(mockElectronAPI.terminal.onExit).toHaveBeenCalled();
  });
});