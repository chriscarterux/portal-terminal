import { CommandExecutor } from '../src/command-executor';
import { CommandBlock } from '../src/command-block';

// Mock child_process
jest.mock('child_process', () => ({
  spawn: jest.fn().mockReturnValue({
    stdout: {
      on: jest.fn((event, callback) => {
        if (event === 'data') {
          setTimeout(() => callback(Buffer.from('test output')), 10);
        }
      }),
    },
    stderr: {
      on: jest.fn(),
    },
    on: jest.fn((event, callback) => {
      if (event === 'close') {
        setTimeout(() => callback(0), 20);
      }
    }),
    kill: jest.fn(),
    killed: false,
  }),
}));

describe('CommandExecutor', () => {
  let executor: CommandExecutor;

  beforeEach(() => {
    executor = new CommandExecutor({ cwd: '/tmp' });
    jest.clearAllMocks();
  });

  describe('executeCommand', () => {
    it('should execute command and return block', async () => {
      const result = await executor.executeCommand('echo "hello"');
      
      expect(result).toBeInstanceOf(CommandBlock);
      expect(result.command).toBe('echo "hello"');
      expect(result.status).toBe('completed');
    });

    it('should handle command timeout', async () => {
      const timeoutExecutor = new CommandExecutor({ timeout: 50 });
      
      // Mock a long-running process that doesn't close
      const mockProcess = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn(),
        kill: jest.fn(),
        killed: false,
      };
      
      require('child_process').spawn.mockReturnValueOnce(mockProcess);

      const result = await timeoutExecutor.executeCommand('sleep 10');
      
      // The command should complete with an error status due to timeout
      expect(result.status).toBe('error');
      expect(result.exitCode).toBe(1);
      expect(result.output).toContain('Command timed out');
    });
  });

  describe('kill', () => {
    it('should kill running process', async () => {
      const mockProcess = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn((event, callback) => {
          if (event === 'close') {
            setTimeout(() => callback(1), 20); // Simulate killed process
          }
        }),
        kill: jest.fn(),
        killed: false,
      };
      
      require('child_process').spawn.mockReturnValueOnce(mockProcess);
      
      // Start a command to create a process
      const commandPromise = executor.executeCommand('long-running-command');
      
      // Give it a moment to start
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Kill the process
      executor.kill();
      
      // Wait for the command to complete
      await commandPromise;
      
      expect(mockProcess.kill).toHaveBeenCalled();
    }, 10000);
  });

  describe('isRunning', () => {
    it('should return false initially', () => {
      expect(executor.isRunning()).toBe(false);
    });
  });
});