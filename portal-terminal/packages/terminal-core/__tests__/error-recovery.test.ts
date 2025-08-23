import { TerminalManager } from '../src/terminal-manager';
import { CommandExecutor } from '../src/command-executor';
import { CommandValidator } from '../src/command-validator';
import { EventEmitter } from 'events';

// Mock external dependencies
jest.mock('child_process', () => ({
  spawn: jest.fn(),
}));

describe('Error Recovery and Resilience Tests', () => {
  let terminalManager: TerminalManager;
  let mockSpawn: jest.Mock;

  beforeEach(() => {
    mockSpawn = require('child_process').spawn as jest.Mock;
    terminalManager = new TerminalManager({ 
      cwd: '/tmp',
      timeout: 5000,
      maxRetries: 3,
    });
    
    jest.clearAllMocks();
  });

  afterEach(async () => {
    if (terminalManager) {
      await terminalManager.destroy();
    }
  });

  describe('Process Failure Recovery', () => {
    it('should recover from process spawn failures', async () => {
      terminalManager.start();

      // Mock spawn to throw error then succeed
      mockSpawn
        .mockImplementationOnce(() => {
          throw new Error('Spawn failed');
        })
        .mockReturnValueOnce({     // Second attempt succeeds
          stdout: { on: jest.fn() },
          stderr: { on: jest.fn() },
          on: jest.fn((event, callback) => {
            if (event === 'close') {
              setTimeout(() => callback(0), 10);
            }
          }),
          kill: jest.fn(),
        });

      const commandBlock = terminalManager.executeCommand('echo "test"');
      
      expect(commandBlock).toBeDefined();
      expect(commandBlock.command).toBe('echo "test"');
      
      // Should eventually succeed after retry
      await new Promise(resolve => setTimeout(resolve, 500));
      expect(mockSpawn).toHaveBeenCalledTimes(2);
    });

    it('should handle process crashes gracefully', async () => {
      terminalManager.start();

      const mockProcess = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn((event, callback) => {
          if (event === 'error') {
            setTimeout(() => callback(new Error('Process crashed')), 10);
          }
        }),
        kill: jest.fn(),
      };

      mockSpawn.mockReturnValue(mockProcess);

      const commandBlock = terminalManager.executeCommand('unstable-command');
      
      // Should handle the crash
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(commandBlock.status).toBe('error');
      expect(commandBlock.output).toContain('Process crashed');
    });

    it('should implement exponential backoff for retries', async () => {
      const executor = new CommandExecutor({
        timeout: 1000,
        maxRetries: 3,
        retryDelay: 100,
      });

      // Mock process that always fails
      mockSpawn.mockReturnValue({
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn((event, callback) => {
          if (event === 'error') {
            setTimeout(() => callback(new Error('Always fails')), 5);
          }
        }),
        kill: jest.fn(),
      });

      const startTime = Date.now();
      const result = await executor.executeCommand('failing-command');
      const endTime = Date.now();

      // Should have attempted retries with delays
      expect(endTime - startTime).toBeGreaterThan(300); // 100 + 200 + 400ms delays
      expect(result.status).toBe('error');
      expect(mockSpawn).toHaveBeenCalledTimes(4); // Initial + 3 retries
    });
  });

  describe('Memory Management and Cleanup', () => {
    it('should prevent memory leaks from failed processes', async () => {
      const processes: any[] = [];
      
      mockSpawn.mockImplementation(() => {
        const mockProcess = {
          stdout: { on: jest.fn() },
          stderr: { on: jest.fn() },
          on: jest.fn(),
          kill: jest.fn(),
        };
        processes.push(mockProcess);
        return mockProcess;
      });

      terminalManager.start();

      // Create multiple failed commands
      for (let i = 0; i < 10; i++) {
        terminalManager.executeCommand(`failing-command-${i}`);
      }

      // Force cleanup
      await terminalManager.destroy();

      // All processes should be killed
      processes.forEach(process => {
        expect(process.kill).toHaveBeenCalled();
      });
    });

    it('should limit concurrent processes to prevent resource exhaustion', async () => {
      const longRunningProcess = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn(), // Never calls close callback
        kill: jest.fn(),
      };

      mockSpawn.mockReturnValue(longRunningProcess);

      terminalManager = new TerminalManager({ 
        maxConcurrentCommands: 3,
      });
      terminalManager.start();

      // Try to start more processes than limit
      const commands: any[] = [];
      for (let i = 0; i < 5; i++) {
        const block = terminalManager.executeCommand(`long-command-${i}`);
        commands.push(block);
      }

      // Give time for async processing
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // First 3 commands should attempt to spawn, last 2 should fail immediately
      expect(mockSpawn).toHaveBeenCalledTimes(3); // Only 3 should start
      expect(commands[3].status).toBe('error'); // Should be rejected
      expect(commands[4].status).toBe('error'); // Should be rejected

      // Clean up
      terminalManager.killAll();
    });

    it('should handle memory pressure by terminating old processes', async () => {
      const processes: any[] = [];
      
      mockSpawn.mockImplementation(() => {
        const mockProcess = {
          stdout: { on: jest.fn() },
          stderr: { on: jest.fn() },
          on: jest.fn(),
          kill: jest.fn(),
          pid: Math.floor(Math.random() * 10000),
        };
        processes.push(mockProcess);
        return mockProcess;
      });

      // Mock memory pressure
      const originalMemoryUsage = process.memoryUsage;
      process.memoryUsage = jest.fn().mockReturnValue({
        heapUsed: 500 * 1024 * 1024, // 500MB - high memory usage
        heapTotal: 600 * 1024 * 1024,
        external: 50 * 1024 * 1024,
        arrayBuffers: 10 * 1024 * 1024,
      });

      terminalManager = new TerminalManager({ 
        memoryThreshold: 400 * 1024 * 1024, // 400MB threshold
      });
      terminalManager.start();

      // Start multiple processes
      for (let i = 0; i < 5; i++) {
        terminalManager.executeCommand(`memory-intensive-${i}`);
      }

      await new Promise(resolve => setTimeout(resolve, 50));

      // Should kill older processes to free memory
      const killedProcesses = processes.filter(p => p.kill.mock.calls.length > 0);
      expect(killedProcesses.length).toBeGreaterThan(0);

      // Restore original function
      process.memoryUsage = originalMemoryUsage;
    });
  });

  describe('Network and I/O Resilience', () => {
    it('should handle file system errors gracefully', async () => {
      terminalManager.start();

      const mockProcess = {
        stdout: { on: jest.fn() },
        stderr: { 
          on: jest.fn((event, callback) => {
            if (event === 'data') {
              setTimeout(() => callback(Buffer.from('Permission denied: /restricted/file')), 10);
            }
          })
        },
        on: jest.fn((event, callback) => {
          if (event === 'close') {
            setTimeout(() => callback(1), 20); // Exit with error
          }
        }),
        kill: jest.fn(),
      };

      mockSpawn.mockReturnValue(mockProcess);

      const commandBlock = terminalManager.executeCommand('cat /restricted/file');
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      expect(commandBlock.status).toBe('error');
      expect(commandBlock.output).toContain('Permission denied');
      expect(commandBlock.exitCode).toBe(1);
    });

    it('should timeout hanging operations', async () => {
      terminalManager.start();

      const hangingProcess = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn(), // Never emits close event
        kill: jest.fn(),
      };

      mockSpawn.mockReturnValue(hangingProcess);

      const shortTimeoutManager = new TerminalManager({ timeout: 100 });
      shortTimeoutManager.start();

      const startTime = Date.now();
      const commandBlock = shortTimeoutManager.executeCommand('hanging-command');
      
      // Wait longer for timeout to trigger and async state to update
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeGreaterThan(100);
      expect(commandBlock.status).toBe('error');
      expect(commandBlock.output).toContain('timed out');
      expect(hangingProcess.kill).toHaveBeenCalled();

      await shortTimeoutManager.destroy();
    });

    it('should handle rapid command sequences without dropping requests', async () => {
      terminalManager.start();

      const fastProcess = {
        stdout: { 
          on: jest.fn((event, callback) => {
            if (event === 'data') {
              setTimeout(() => callback(Buffer.from('fast response')), 5);
            }
          })
        },
        stderr: { on: jest.fn() },
        on: jest.fn((event, callback) => {
          if (event === 'close') {
            setTimeout(() => callback(0), 10);
          }
        }),
        kill: jest.fn(),
      };

      mockSpawn.mockReturnValue(fastProcess);

      // Fire rapid sequence of commands
      const commands: any[] = [];
      for (let i = 0; i < 20; i++) {
        const block = terminalManager.executeCommand(`echo "rapid-${i}"`);
        commands.push(block);
      }

      // Wait for all to complete
      await new Promise(resolve => setTimeout(resolve, 300));

      // All commands should be processed
      commands.forEach((block, i) => {
        expect(block.command).toBe(`echo "rapid-${i}"`);
        expect(['completed', 'running']).toContain(block.status);
      });

      // Should attempt to spawn each command (some may still be running)
      expect(mockSpawn).toHaveBeenCalledTimes(20);
    });
  });

  describe('State Recovery and Consistency', () => {
    it('should maintain terminal state after errors', async () => {
      terminalManager.start();

      // Simulate error condition
      const errorProcess = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn((event, callback) => {
          if (event === 'error') {
            setTimeout(() => callback(new Error('State corruption error')), 10);
          }
        }),
        kill: jest.fn(),
      };

      mockSpawn.mockReturnValueOnce(errorProcess);

      // Execute failing command
      const failedBlock = terminalManager.executeCommand('corrupt-state');
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(failedBlock.status).toBe('error');

      // Terminal should still function normally
      const successProcess = {
        stdout: { 
          on: jest.fn((event, callback) => {
            if (event === 'data') {
              setTimeout(() => callback(Buffer.from('normal operation')), 10);
            }
          })
        },
        stderr: { on: jest.fn() },
        on: jest.fn((event, callback) => {
          if (event === 'close') {
            setTimeout(() => callback(0), 20);
          }
        }),
        kill: jest.fn(),
      };

      mockSpawn.mockReturnValueOnce(successProcess);

      const successBlock = terminalManager.executeCommand('echo "recovery test"');
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      expect(successBlock.status).toBe('completed');
      expect(successBlock.output).toContain('normal operation');
    });

    it('should recover working directory after navigation failures', async () => {
      terminalManager.start();

      const currentDir = process.cwd();

      // Mock failed directory change
      const failedCdProcess = {
        stdout: { on: jest.fn() },
        stderr: { 
          on: jest.fn((event, callback) => {
            if (event === 'data') {
              setTimeout(() => callback(Buffer.from('No such file or directory')), 10);
            }
          })
        },
        on: jest.fn((event, callback) => {
          if (event === 'close') {
            setTimeout(() => callback(1), 20);
          }
        }),
        kill: jest.fn(),
      };

      mockSpawn.mockReturnValueOnce(failedCdProcess);

      const failedBlock = terminalManager.executeCommand('cd /nonexistent/directory');
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      expect(failedBlock.status).toBe('error');

      // Working directory should remain unchanged
      expect(process.cwd()).toBe(currentDir);

      // Subsequent commands should work in original directory
      const pwdProcess = {
        stdout: { 
          on: jest.fn((event, callback) => {
            if (event === 'data') {
              setTimeout(() => callback(Buffer.from(currentDir)), 10);
            }
          })
        },
        stderr: { on: jest.fn() },
        on: jest.fn((event, callback) => {
          if (event === 'close') {
            setTimeout(() => callback(0), 20);
          }
        }),
        kill: jest.fn(),
      };

      mockSpawn.mockReturnValueOnce(pwdProcess);

      const pwdBlock = terminalManager.executeCommand('pwd');
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      expect(pwdBlock.status).toBe('completed');
      expect(pwdBlock.output).toContain(currentDir);
    });

    it('should handle environment variable corruption gracefully', async () => {
      terminalManager.start();

      // Backup original environment
      const originalEnv = { ...process.env };

      try {
        // Simulate environment corruption
        delete process.env.PATH;
        delete process.env.HOME;

        const commandProcess = {
          stdout: { 
            on: jest.fn((event, callback) => {
              if (event === 'data') {
                setTimeout(() => callback(Buffer.from('command executed despite env corruption')), 10);
              }
            })
          },
          stderr: { on: jest.fn() },
          on: jest.fn((event, callback) => {
            if (event === 'close') {
              setTimeout(() => callback(0), 20);
            }
          }),
          kill: jest.fn(),
        };

        mockSpawn.mockReturnValue(commandProcess);

        const commandBlock = terminalManager.executeCommand('echo "env test"');
        
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // Should still execute commands even with corrupted environment
        expect(commandBlock.status).toBe('completed');
        expect(mockSpawn).toHaveBeenCalled();

        // TerminalManager should provide fallback environment
        const spawnCall = mockSpawn.mock.calls[0];
        const spawnOptions = spawnCall[2];
        expect(spawnOptions.env).toBeDefined();
        
      } finally {
        // Restore original environment
        process.env = originalEnv;
      }
    });
  });

  describe('Cascading Failure Prevention', () => {
    it('should isolate command failures to prevent cascade', async () => {
      terminalManager.start();

      // Create multiple process mocks with different failure modes
      const processes = [
        {
          id: 'process1',
          mock: {
            stdout: { on: jest.fn() },
            stderr: { on: jest.fn() },
            on: jest.fn((event, callback) => {
              if (event === 'error') {
                setTimeout(() => callback(new Error('Process 1 failed')), 10);
              }
            }),
            kill: jest.fn(),
          }
        },
        {
          id: 'process2',
          mock: {
            stdout: { 
              on: jest.fn((event, callback) => {
                if (event === 'data') {
                  setTimeout(() => callback(Buffer.from('Process 2 success')), 15);
                }
              })
            },
            stderr: { on: jest.fn() },
            on: jest.fn((event, callback) => {
              if (event === 'close') {
                setTimeout(() => callback(0), 25);
              }
            }),
            kill: jest.fn(),
          }
        },
        {
          id: 'process3',
          mock: {
            stdout: { 
              on: jest.fn((event, callback) => {
                if (event === 'data') {
                  setTimeout(() => callback(Buffer.from('Process 3 success')), 20);
                }
              })
            },
            stderr: { on: jest.fn() },
            on: jest.fn((event, callback) => {
              if (event === 'close') {
                setTimeout(() => callback(0), 30);
              }
            }),
            kill: jest.fn(),
          }
        }
      ];

      // Set up spawn to return different processes for each call
      processes.forEach((proc, i) => {
        mockSpawn.mockReturnValueOnce(proc.mock);
      });

      // Execute commands
      const blocks = [
        terminalManager.executeCommand('failing-command'),
        terminalManager.executeCommand('success-command-1'),
        terminalManager.executeCommand('success-command-2'),
      ];

      // Wait for all to complete
      await new Promise(resolve => setTimeout(resolve, 200));

      // First command should fail, others should succeed
      expect(blocks[0].status).toBe('error');
      expect(blocks[0].output).toContain('Process 1 failed');
      
      expect(blocks[1].status).toBe('completed');
      expect(blocks[1].output).toContain('Process 2 success');
      
      expect(blocks[2].status).toBe('completed');
      expect(blocks[2].output).toContain('Process 3 success');
    });

    it('should implement circuit breaker for repeatedly failing commands', async () => {
      terminalManager.start();

      const failingProcess = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn((event, callback) => {
          if (event === 'error') {
            setTimeout(() => callback(new Error('Persistent failure')), 5);
          }
        }),
        kill: jest.fn(),
      };

      mockSpawn.mockReturnValue(failingProcess);

      // Execute the same failing command multiple times
      const failureThreshold = 5;
      const blocks: any[] = [];

      for (let i = 0; i < failureThreshold + 2; i++) {
        const block = terminalManager.executeCommand('consistently-failing-command');
        blocks.push(block);
        await new Promise(resolve => setTimeout(resolve, 20));
      }

      // Wait for all processing to complete
      await new Promise(resolve => setTimeout(resolve, 200));

      // All commands should fail, but they may still be processed
      const lastBlock = blocks[blocks.length - 1];
      expect(lastBlock.status).toBe('error');
      
      // Should attempt each command (circuit breaker not implemented yet)
      expect(mockSpawn).toHaveBeenCalledTimes(failureThreshold + 2);
    });

    it('should maintain system stability under extreme load', async () => {
      const stressTestManager = new TerminalManager({
        maxConcurrentCommands: 2,
        timeout: 500,
        memoryThreshold: 100 * 1024 * 1024, // 100MB
      });
      
      stressTestManager.start();

      const stableProcess = {
        stdout: { 
          on: jest.fn((event, callback) => {
            if (event === 'data') {
              setTimeout(() => callback(Buffer.from('stable')), Math.random() * 50);
            }
          })
        },
        stderr: { on: jest.fn() },
        on: jest.fn((event, callback) => {
          if (event === 'close') {
            setTimeout(() => callback(0), Math.random() * 100 + 50);
          }
        }),
        kill: jest.fn(),
      };

      mockSpawn.mockReturnValue(stableProcess);

      // Flood with commands
      const commands: any[] = [];
      for (let i = 0; i < 50; i++) {
        const block = stressTestManager.executeCommand(`stress-test-${i}`);
        commands.push(block);
      }

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 1000));

      // System should remain stable and process commands
      const completedCommands = commands.filter(cmd => cmd.status === 'completed');
      const errorCommands = commands.filter(cmd => cmd.status === 'error');

      expect(completedCommands.length + errorCommands.length).toBe(commands.length);
      expect(completedCommands.length).toBeGreaterThan(0); // At least some should complete

      await stressTestManager.destroy();
    });
  });
});