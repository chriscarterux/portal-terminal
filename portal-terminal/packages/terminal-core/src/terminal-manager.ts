import { CommandExecutor, ICommandExecutorOptions } from './command-executor';
import { CommandValidator } from './command-validator';
import { ShellDetector } from './shell-detector';
import { CommandBlock } from './command-block';
import { TerminalOptions } from './types';

export class TerminalManager {
  private executor: CommandExecutor;
  protected dataCallback?: (data: string) => void;
  private exitCallback?: (exitCode: number) => void;
  private isStarted = false;
  private activeProcesses: Map<string, CommandBlock> = new Map();
  private maxConcurrentCommands: number;
  private memoryThreshold: number;

  constructor(protected options: TerminalOptions = {}) {
    this.maxConcurrentCommands = options.maxConcurrentCommands || 10;
    this.memoryThreshold = options.memoryThreshold || 500 * 1024 * 1024; // 500MB default

    const executorOptions: ICommandExecutorOptions = {
      shell: options.shell,
      cwd: options.cwd,
      env: options.env,
      timeout: options.timeout || 30000, // 30 second timeout
      maxRetries: options.maxRetries || 3,
      retryDelay: options.retryDelay || 100,
    };
    
    this.executor = new CommandExecutor(executorOptions);
  }

  start(): void {
    this.isStarted = true;
    
    // Send initial shell info
    const shellInfo = ShellDetector.detectDefaultShell();
    const welcomeMessage = `Welcome to Portal Terminal\nShell: ${shellInfo.name} (${shellInfo.path})\nCWD: ${this.options.cwd || process.cwd()}\n\n`;
    
    setTimeout(() => {
      this.dataCallback?.(welcomeMessage);
      this.dataCallback?.('$ ');
    }, 100);
  }

  async write(data: string): Promise<void> {
    if (!this.isStarted) {
      throw new Error('Terminal not started');
    }

    // Echo the input character
    this.dataCallback?.(data);

    // Handle Enter key (carriage return)
    if (data === '\r') {
      this.dataCallback?.('\n');
      
      // Get the current command (this is simplified - in a real implementation,
      // we'd track the current line being typed)
      // For now, we'll implement a simple echo
      this.dataCallback?.('$ ');
    }
  }

  executeCommand(command: string): CommandBlock {
    if (!this.isStarted) {
      throw new Error('Terminal not started');
    }

    // Check memory pressure
    this.checkMemoryPressure();

    // Check concurrent process limit
    if (this.activeProcesses.size >= this.maxConcurrentCommands) {
      const block = new CommandBlock(command);
      block.addOutput('Error: Maximum concurrent commands reached\n');
      block.setCompleted(1);
      return block;
    }

    // Validate command first
    const validation = CommandValidator.validateCommand(command);
    
    if (!validation.isValid) {
      const block = new CommandBlock(command);
      block.addOutput(`Error: ${validation.errors.join(', ')}\n`);
      block.setCompleted(1);
      return block;
    }

    // Show warnings if any
    if (validation.warnings.length > 0) {
      this.dataCallback?.(`Warning: ${validation.warnings.join(', ')}\n`);
    }

    // Create command block and track it
    const block = new CommandBlock(command);
    this.activeProcesses.set(block.id, block);

    // Execute the command asynchronously
    this.executeCommandAsync(block).catch(error => {
      block.addOutput(`Error: ${error instanceof Error ? error.message : String(error)}\n`);
      block.setCompleted(1);
      this.activeProcesses.delete(block.id);
      
      this.dataCallback?.(block.output);
      this.dataCallback?.('\n$ ');
    });

    return block;
  }

  private async executeCommandAsync(block: CommandBlock): Promise<void> {
    try {
      const result = await this.executor.executeCommand(block.command);
      
      // Update the block with results
      block.addOutput(result.output);
      block.setCompleted(result.exitCode);
      
      // Send output to terminal
      this.dataCallback?.(result.output);
      this.dataCallback?.('\n$ ');
      
    } catch (error) {
      block.addOutput(`Error: ${error instanceof Error ? error.message : String(error)}\n`);
      block.setCompleted(1);
      
      this.dataCallback?.(block.output);
      this.dataCallback?.('\n$ ');
    } finally {
      // Remove from active processes
      this.activeProcesses.delete(block.id);
    }
  }

  onData(callback: (data: string) => void): void {
    this.dataCallback = callback;
  }

  onExit(callback: (exitCode: number) => void): void {
    this.exitCallback = callback;
  }

  resize(cols: number, rows: number): void {
    // Store dimensions for future PTY integration
    console.log(`Terminal resized to ${cols}x${rows}`);
  }

  killAll(): void {
    // Kill all active processes
    this.activeProcesses.forEach((block) => {
      if (block.status === 'running') {
        block.addOutput('\nProcess terminated by user\n');
        block.setCompleted(130); // SIGINT exit code
      }
    });
    this.activeProcesses.clear();
    this.executor.kill();
  }

  private checkMemoryPressure(): void {
    const memUsage = process.memoryUsage();
    if (memUsage.heapUsed > this.memoryThreshold) {
      // Kill oldest processes to free memory
      const sortedProcesses = Array.from(this.activeProcesses.entries())
        .sort(([, a], [, b]) => a.timestamp.getTime() - b.timestamp.getTime());
      
      // Kill half of the active processes
      const processesToKill = sortedProcesses.slice(0, Math.ceil(sortedProcesses.length / 2));
      processesToKill.forEach(([id, block]) => {
        block.addOutput('\nProcess terminated due to memory pressure\n');
        block.setCompleted(137); // SIGKILL exit code
        this.activeProcesses.delete(id);
      });
    }
  }

  async destroy(): Promise<void> {
    this.killAll();
    this.isStarted = false;
  }
}