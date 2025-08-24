import { TerminalManager } from '../src/terminal-manager';

describe('TerminalManager', () => {
  let terminalManager: TerminalManager;

  beforeEach(() => {
    terminalManager = new TerminalManager({ cwd: '/tmp' });
  });

  afterEach(() => {
    terminalManager.destroy();
  });

  describe('initialization', () => {
    it('should create terminal manager with default options', () => {
      const manager = new TerminalManager();
      expect(manager).toBeInstanceOf(TerminalManager);
    });

    it('should create terminal manager with custom options', () => {
      const manager = new TerminalManager({ 
        shell: '/bin/bash',
        cwd: '/home/user',
        env: { CUSTOM_VAR: 'value' }
      });
      expect(manager).toBeInstanceOf(TerminalManager);
    });
  });

  describe('command execution', () => {
    it('should throw error when executing command before start', () => {
      expect(() => {
        terminalManager.executeCommand('ls');
      }).toThrow('Terminal not started');
    });

    it('should execute command after start', () => {
      terminalManager.start();
      const block = terminalManager.executeCommand('echo "test"');
      
      expect(block).toBeDefined();
      expect(block.command).toBe('echo "test"');
      expect(block.status).toBe('pending');
      expect(block.id).toBeDefined();
    });

    it('should handle invalid commands', () => {
      terminalManager.start();
      const block = terminalManager.executeCommand('');
      
      expect(block).toBeDefined();
      expect(block.status).toBe('error');
      expect(block.output).toContain('Error:');
    });
  });

  describe('resize', () => {
    it('should resize terminal dimensions', () => {
      terminalManager.start();
      expect(() => {
        terminalManager.resize(120, 40);
      }).not.toThrow();
    });
  });
});