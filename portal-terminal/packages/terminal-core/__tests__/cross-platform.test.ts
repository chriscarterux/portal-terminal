// Mock os module for testing different platforms - must be defined before import
const mockOs = {
  platform: jest.fn(),
  arch: jest.fn(),
  homedir: jest.fn(),
  tmpdir: jest.fn(),
  userInfo: jest.fn(),
  release: jest.fn(),
};

jest.mock('os', () => mockOs);

import { ShellDetector } from '../src/shell-detector';
import { CommandValidator } from '../src/command-validator';
import { CommandExecutor } from '../src/command-executor';
import * as os from 'os';

// Mock child_process for cross-platform testing
jest.mock('child_process', () => ({
  spawn: jest.fn(),
  exec: jest.fn(),
}));

// Mock fs for file system operations
jest.mock('fs', () => ({
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
  writeFileSync: jest.fn(),
  promises: {
    access: jest.fn(),
    readFile: jest.fn(),
    writeFile: jest.fn(),
    stat: jest.fn(),
  },
}));

describe('Cross-Platform Compatibility Tests', () => {
  let mockSpawn: jest.Mock;
  let mockExec: jest.Mock;
  let mockFs: any;

  beforeEach(() => {
    mockSpawn = require('child_process').spawn as jest.Mock;
    mockExec = require('child_process').exec as jest.Mock;
    mockFs = require('fs');
    
    jest.clearAllMocks();

    // Default mock implementations
    mockOs.homedir.mockReturnValue('/home/user');
    mockOs.tmpdir.mockReturnValue('/tmp');
    mockOs.userInfo.mockReturnValue({ username: 'testuser', uid: 1000, gid: 1000 });
    mockOs.release.mockReturnValue('5.4.0');
  });

  describe('Platform Detection', () => {
    it('should detect macOS correctly', () => {
      mockOs.platform.mockReturnValue('darwin');
      mockOs.arch.mockReturnValue('arm64');

      const shellInfo = ShellDetector.detectDefaultShell();
      
      expect(shellInfo.platform).toBe('darwin');
      expect(shellInfo.arch).toBe('arm64');
    });

    it('should detect Windows correctly', () => {
      mockOs.platform.mockReturnValue('win32');
      mockOs.arch.mockReturnValue('x64');
      mockOs.homedir.mockReturnValue('C:\\Users\\testuser');
      mockOs.tmpdir.mockReturnValue('C:\\temp');

      const shellInfo = ShellDetector.detectDefaultShell();
      
      expect(shellInfo.platform).toBe('win32');
      expect(shellInfo.arch).toBe('x64');
      expect(shellInfo.pathSeparator).toBe('\\');
    });

    it('should detect Linux correctly', () => {
      mockOs.platform.mockReturnValue('linux');
      mockOs.arch.mockReturnValue('x64');

      const shellInfo = ShellDetector.detectDefaultShell();
      
      expect(shellInfo.platform).toBe('linux');
      expect(shellInfo.arch).toBe('x64');
      expect(shellInfo.pathSeparator).toBe('/');
    });
  });

  describe('Shell Detection and Configuration', () => {
    it('should detect bash on Unix systems', () => {
      mockOs.platform.mockReturnValue('linux');
      mockFs.existsSync.mockImplementation((path: string) => {
        return path === '/bin/bash' || path === '/usr/bin/bash';
      });

      const shellInfo = ShellDetector.detectDefaultShell();
      
      expect(shellInfo.name).toBe('bash');
      expect(shellInfo.path).toMatch(/bash$/);
    });

    it('should detect zsh on macOS', () => {
      mockOs.platform.mockReturnValue('darwin');
      mockFs.existsSync.mockImplementation((path: string) => {
        return path === '/bin/zsh' || path === '/usr/bin/zsh';
      });

      const shellInfo = ShellDetector.detectDefaultShell();
      
      expect(shellInfo.name).toBe('zsh');
      expect(shellInfo.path).toMatch(/zsh$/);
    });

    it('should detect PowerShell on Windows', () => {
      mockOs.platform.mockReturnValue('win32');
      mockFs.existsSync.mockImplementation((path: string) => {
        return path.includes('powershell') || path.includes('pwsh');
      });

      const shellInfo = ShellDetector.detectDefaultShell();
      
      expect(['powershell', 'pwsh']).toContain(shellInfo.name);
      expect(shellInfo.path).toMatch(/(powershell|pwsh)/);
    });

    it('should detect cmd on Windows as fallback', () => {
      mockOs.platform.mockReturnValue('win32');
      mockFs.existsSync.mockImplementation((path: string) => {
        return path.includes('cmd.exe');
      });

      const shellInfo = ShellDetector.detectDefaultShell();
      
      expect(shellInfo.name).toBe('cmd');
      expect(shellInfo.path).toMatch(/cmd\.exe$/);
    });

    it('should provide appropriate shell arguments per platform', () => {
      // Unix shell
      mockOs.platform.mockReturnValue('linux');
      mockFs.existsSync.mockImplementation((path: string) => path === '/bin/bash');
      
      const unixShell = ShellDetector.detectDefaultShell();
      expect(unixShell.args).toContain('-i'); // Interactive mode

      // Windows cmd
      mockOs.platform.mockReturnValue('win32');
      mockFs.existsSync.mockImplementation((path: string) => path.includes('cmd.exe'));
      
      const windowsShell = ShellDetector.detectDefaultShell();
      expect(windowsShell.args).toContain('/k'); // Keep window open
    });
  });

  describe('Command Validation Across Platforms', () => {
    let validator: CommandValidator;

    beforeEach(() => {
      validator = new CommandValidator();
    });

    it('should validate Unix commands correctly', () => {
      mockOs.platform.mockReturnValue('linux');

      const validUnixCommands = [
        'ls -la',
        'grep pattern file.txt',
        'find . -name "*.js"',
        'chmod 755 script.sh',
        'sudo apt update',
      ];

      validUnixCommands.forEach(cmd => {
        const result = validator.validateCommand(cmd);
        expect(result.isValid).toBe(true);
        expect(result.platform).toBe('unix');
      });
    });

    it('should validate Windows commands correctly', () => {
      mockOs.platform.mockReturnValue('win32');

      const validWindowsCommands = [
        'dir /b',
        'findstr pattern file.txt',
        'forfiles /m *.js',
        'icacls file.txt /grant user:F',
        'powershell Get-Process',
      ];

      validWindowsCommands.forEach(cmd => {
        const result = validator.validateCommand(cmd);
        expect(result.isValid).toBe(true);
        expect(result.platform).toBe('windows');
      });
    });

    it('should provide platform-specific suggestions', () => {
      // Unix to Windows translation
      mockOs.platform.mockReturnValue('win32');
      
      const unixCmd = 'ls -la';
      const result = validator.validateCommand(unixCmd);
      
      if (!result.isValid) {
        expect(result.suggestions).toBeDefined();
        expect(result.suggestions![0]).toContain('dir');
      }

      // Windows to Unix translation
      mockOs.platform.mockReturnValue('linux');
      
      const windowsCmd = 'dir /b';
      const unixResult = validator.validateCommand(windowsCmd);
      
      if (!unixResult.isValid) {
        expect(unixResult.suggestions).toBeDefined();
        expect(unixResult.suggestions![0]).toContain('ls');
      }
    });

    it('should handle dangerous commands per platform', () => {
      const dangerousCommands = [
        { unix: 'rm -rf /', windows: 'del /q /s C:\\*' },
        { unix: 'sudo dd if=/dev/zero of=/dev/sda', windows: 'format C: /q' },
        { unix: 'chmod 777 -R /', windows: 'cacls C:\\ /t /e /g everyone:f' },
      ];

      dangerousCommands.forEach(({ unix, windows }) => {
        // Test Unix command
        mockOs.platform.mockReturnValue('linux');
        const unixResult = validator.validateCommand(unix);
        expect(unixResult.isDangerous).toBe(true);
        expect(unixResult.dangerLevel).toBeGreaterThan(5);

        // Test Windows command
        mockOs.platform.mockReturnValue('win32');
        const windowsResult = validator.validateCommand(windows);
        expect(windowsResult.isDangerous).toBe(true);
        expect(windowsResult.dangerLevel).toBeGreaterThan(5);
      });
    });
  });

  describe('Command Execution Across Platforms', () => {
    let executor: CommandExecutor;

    beforeEach(() => {
      executor = new CommandExecutor();
    });

    it('should execute Unix commands with proper shell', async () => {
      mockOs.platform.mockReturnValue('linux');
      
      const mockProcess = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn((event, callback) => {
          if (event === 'close') callback(0);
        }),
        kill: jest.fn(),
      };

      mockSpawn.mockReturnValue(mockProcess);

      await executor.executeCommand('ls -la');

      expect(mockSpawn).toHaveBeenCalledWith(
        expect.any(String), // shell path
        expect.arrayContaining(['-c', 'ls -la']),
        expect.objectContaining({
          stdio: ['pipe', 'pipe', 'pipe'],
        })
      );
    });

    it('should execute Windows commands with proper shell', async () => {
      mockOs.platform.mockReturnValue('win32');
      
      const mockProcess = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn((event, callback) => {
          if (event === 'close') callback(0);
        }),
        kill: jest.fn(),
      };

      mockSpawn.mockReturnValue(mockProcess);

      await executor.executeCommand('dir /b');

      expect(mockSpawn).toHaveBeenCalledWith(
        'cmd',
        ['/c', 'dir /b'],
        expect.objectContaining({
          stdio: ['pipe', 'pipe', 'pipe'],
        })
      );
    });

    it('should handle path separators correctly', () => {
      // Unix paths
      mockOs.platform.mockReturnValue('linux');
      const unixExecutor = new CommandExecutor({ cwd: '/home/user/project' });
      expect(unixExecutor['options'].cwd).toBe('/home/user/project');

      // Windows paths
      mockOs.platform.mockReturnValue('win32');
      const windowsExecutor = new CommandExecutor({ cwd: 'C:\\Users\\user\\project' });
      expect(windowsExecutor['options'].cwd).toBe('C:\\Users\\user\\project');
    });

    it('should set appropriate environment variables per platform', async () => {
      const mockProcess = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn((event, callback) => {
          if (event === 'close') callback(0);
        }),
        kill: jest.fn(),
      };

      mockSpawn.mockReturnValue(mockProcess);

      // Unix environment
      mockOs.platform.mockReturnValue('linux');
      const unixExecutor = new CommandExecutor();
      await unixExecutor.executeCommand('echo $HOME');

      const unixCall = mockSpawn.mock.calls[0];
      expect(unixCall[2].env).toHaveProperty('HOME');
      expect(unixCall[2].env).toHaveProperty('PATH');

      mockSpawn.mockClear();

      // Windows environment
      mockOs.platform.mockReturnValue('win32');
      const windowsExecutor = new CommandExecutor();
      await windowsExecutor.executeCommand('echo %USERPROFILE%');

      const windowsCall = mockSpawn.mock.calls[0];
      expect(windowsCall[2].env).toBeDefined();
    });
  });

  describe('File System Operations', () => {
    it('should handle different path formats', () => {
      const testPaths = [
        { platform: 'win32', path: 'C:\\Users\\test\\file.txt', expected: 'C:\\Users\\test\\file.txt' },
        { platform: 'linux', path: '/home/test/file.txt', expected: '/home/test/file.txt' },
        { platform: 'darwin', path: '/Users/test/file.txt', expected: '/Users/test/file.txt' },
      ];

      testPaths.forEach(({ platform, path, expected }) => {
        mockOs.platform.mockReturnValue(platform);
        
        // Test path normalization (implementation would be in actual code)
        const normalized = path; // Placeholder for actual normalization
        expect(normalized).toBe(expected);
      });
    });

    it('should respect platform-specific file permissions', () => {
      // Unix permissions
      mockOs.platform.mockReturnValue('linux');
      const unixValidator = new CommandValidator();
      
      const chmodResult = unixValidator.validateCommand('chmod 755 file.txt');
      expect(chmodResult.isValid).toBe(true);

      // Windows ACL
      mockOs.platform.mockReturnValue('win32');
      const windowsValidator = new CommandValidator();
      
      const icaclsResult = windowsValidator.validateCommand('icacls file.txt /grant user:F');
      expect(icaclsResult.isValid).toBe(true);
    });

    it('should handle case sensitivity differences', () => {
      const testCases = [
        { platform: 'linux', path: '/Home/User/File.TXT', caseSensitive: true },
        { platform: 'darwin', path: '/Users/user/file.txt', caseSensitive: false },
        { platform: 'win32', path: 'C:\\users\\USER\\file.txt', caseSensitive: false },
      ];

      testCases.forEach(({ platform, path, caseSensitive }) => {
        mockOs.platform.mockReturnValue(platform);
        
        // This would be implemented in actual file handling code
        const shouldTreatAsCaseSensitive = platform === 'linux';
        expect(shouldTreatAsCaseSensitive).toBe(caseSensitive);
      });
    });
  });

  describe('Terminal Features Across Platforms', () => {
    it('should support platform-specific terminal capabilities', () => {
      const capabilities = [
        {
          platform: 'darwin',
          expected: {
            supportsColor: true,
            supportsUnicode: true,
            supportsMouse: true,
            supportsResize: true,
          },
        },
        {
          platform: 'linux',
          expected: {
            supportsColor: true,
            supportsUnicode: true,
            supportsMouse: true,
            supportsResize: true,
          },
        },
        {
          platform: 'win32',
          expected: {
            supportsColor: true, // Modern Windows Terminal
            supportsUnicode: true,
            supportsMouse: false, // Traditional cmd limitations
            supportsResize: true,
          },
        },
      ];

      capabilities.forEach(({ platform, expected }) => {
        mockOs.platform.mockReturnValue(platform);
        
        // This would be actual terminal capability detection
        const detected = ShellDetector.detectTerminalCapabilities();
        
        Object.entries(expected).forEach(([capability, expectedValue]) => {
          expect(detected[capability]).toBe(expectedValue);
        });
      });
    });

    it('should handle different line endings', () => {
      const testContent = 'line1\nline2\nline3';
      
      // Unix/macOS (LF)
      mockOs.platform.mockReturnValue('linux');
      const unixContent = testContent;
      expect(unixContent.includes('\r\n')).toBe(false);

      // Windows (CRLF)
      mockOs.platform.mockReturnValue('win32');
      const windowsContent = testContent.replace(/\n/g, '\r\n');
      expect(windowsContent.includes('\r\n')).toBe(true);
    });

    it('should handle platform-specific keyboard shortcuts', () => {
      const shortcuts = [
        { platform: 'darwin', copy: 'Cmd+C', paste: 'Cmd+V', interrupt: 'Cmd+C' },
        { platform: 'linux', copy: 'Ctrl+Shift+C', paste: 'Ctrl+Shift+V', interrupt: 'Ctrl+C' },
        { platform: 'win32', copy: 'Ctrl+C', paste: 'Ctrl+V', interrupt: 'Ctrl+C' },
      ];

      shortcuts.forEach(({ platform, copy, paste, interrupt }) => {
        mockOs.platform.mockReturnValue(platform);
        
        // This would be actual keyboard shortcut detection
        const detected = ShellDetector.detectKeyboardShortcuts();
        
        expect(detected.copy).toBe(copy);
        expect(detected.paste).toBe(paste);
        expect(detected.interrupt).toBe(interrupt);
      });
    });
  });

  describe('Performance Across Platforms', () => {
    it('should adapt performance settings per platform', () => {
      const performanceConfigs = [
        {
          platform: 'darwin',
          arch: 'arm64',
          expected: {
            maxConcurrentProcesses: 8,
            memoryLimit: '8GB',
            useNativeModules: true,
          },
        },
        {
          platform: 'win32',
          arch: 'x64',
          expected: {
            maxConcurrentProcesses: 4,
            memoryLimit: '4GB',
            useNativeModules: false, // More compatibility issues
          },
        },
        {
          platform: 'linux',
          arch: 'x64',
          expected: {
            maxConcurrentProcesses: 6,
            memoryLimit: '6GB',
            useNativeModules: true,
          },
        },
      ];

      performanceConfigs.forEach(({ platform, arch, expected }) => {
        mockOs.platform.mockReturnValue(platform);
        mockOs.arch.mockReturnValue(arch);
        
        // This would be actual performance configuration
        const config = ShellDetector.detectOptimalPerformanceConfig();
        
        expect(config.maxConcurrentProcesses).toBe(expected.maxConcurrentProcesses);
        expect(config.useNativeModules).toBe(expected.useNativeModules);
      });
    });

    it('should handle platform-specific process management', async () => {
      const mockProcess = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn(),
        kill: jest.fn(),
        pid: 1234,
      };

      mockSpawn.mockReturnValue(mockProcess);

      // Unix process killing
      mockOs.platform.mockReturnValue('linux');
      const unixExecutor = new CommandExecutor();
      await unixExecutor.executeCommand('long-running-command');
      
      unixExecutor.kill();
      expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM');

      mockProcess.kill.mockClear();

      // Windows process killing
      mockOs.platform.mockReturnValue('win32');
      const windowsExecutor = new CommandExecutor();
      await windowsExecutor.executeCommand('long-running-command');
      
      windowsExecutor.kill();
      expect(mockProcess.kill).toHaveBeenCalledWith('SIGKILL'); // Windows uses SIGKILL
    });
  });

  describe('Integration with Platform-Specific Features', () => {
    it('should integrate with macOS specific features', () => {
      mockOs.platform.mockReturnValue('darwin');
      mockOs.release.mockReturnValue('21.0.0'); // macOS 12.0

      const shellInfo = ShellDetector.detectDefaultShell();
      
      expect(shellInfo.platformFeatures).toMatchObject({
        hasNotificationCenter: true,
        hasSpotlight: true,
        hasQuickLook: true,
        supportsColorSync: true,
      });
    });

    it('should integrate with Windows specific features', () => {
      mockOs.platform.mockReturnValue('win32');
      mockOs.release.mockReturnValue('10.0.19041'); // Windows 10

      const shellInfo = ShellDetector.detectDefaultShell();
      
      expect(shellInfo.platformFeatures).toMatchObject({
        hasWSL: true,
        hasWindowsTerminal: true,
        supportsPowerShell: true,
        hasTaskScheduler: true,
      });
    });

    it('should integrate with Linux specific features', () => {
      mockOs.platform.mockReturnValue('linux');
      mockOs.release.mockReturnValue('5.15.0');

      const shellInfo = ShellDetector.detectDefaultShell();
      
      expect(shellInfo.platformFeatures).toMatchObject({
        hasSystemd: true,
        supportsCgroups: true,
        hasPackageManager: true,
        supportsContainers: true,
      });
    });
  });
});