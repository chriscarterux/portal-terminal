import { ShellDetector } from '../src/shell-detector';
import * as os from 'os';

// Mock os module
jest.mock('os');
const mockOs = os as jest.Mocked<typeof os>;

describe('ShellDetector', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('detectDefaultShell', () => {
    it('should detect macOS shell', () => {
      mockOs.platform.mockReturnValue('darwin');
      process.env.SHELL = '/bin/zsh';
      
      const shell = ShellDetector.detectDefaultShell();
      
      expect(shell.name).toBe('zsh');
      expect(shell.path).toBe('/bin/zsh');
      expect(shell.args).toContain('--login');
      expect(shell.env.TERM).toBe('xterm-256color');
    });

    it('should detect Linux shell', () => {
      mockOs.platform.mockReturnValue('linux');
      process.env.SHELL = '/bin/bash';
      
      const shell = ShellDetector.detectDefaultShell();
      
      expect(shell.name).toBe('bash');
      expect(shell.path).toBe('/bin/bash');
      expect(shell.env.TERM).toBe('xterm-256color');
    });

    it('should detect Windows shell', () => {
      mockOs.platform.mockReturnValue('win32');
      
      const shell = ShellDetector.detectDefaultShell();
      
      expect(['pwsh', 'powershell', 'cmd']).toContain(shell.name);
      expect(shell.env.TERM).toBe('xterm-256color');
    });

    it('should provide fallback for unknown platforms', () => {
      mockOs.platform.mockReturnValue('freebsd' as any);
      
      const shell = ShellDetector.detectDefaultShell();
      
      expect(shell.name).toBe('sh');
      expect(shell.path).toBe('/bin/sh');
    });
  });
});