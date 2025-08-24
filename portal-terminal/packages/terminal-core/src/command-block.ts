import { CommandBlock as ICommandBlock } from './types';

export class CommandBlock implements ICommandBlock {
  public id: string;
  public command: string;
  public output: string;
  public timestamp: Date;
  public status: 'pending' | 'running' | 'completed' | 'error';
  public exitCode?: number;

  constructor(command: string) {
    this.id = Date.now().toString();
    this.command = command;
    this.output = '';
    this.timestamp = new Date();
    this.status = 'pending';
  }

  setRunning(): void {
    this.status = 'running';
  }

  addOutput(data: string): void {
    this.output += data;
  }

  setCompleted(exitCode?: number): void {
    this.status = exitCode === 0 ? 'completed' : 'error';
    this.exitCode = exitCode;
  }

  toJSON(): ICommandBlock {
    return {
      id: this.id,
      command: this.command,
      output: this.output,
      timestamp: this.timestamp,
      status: this.status,
      exitCode: this.exitCode,
    };
  }
}