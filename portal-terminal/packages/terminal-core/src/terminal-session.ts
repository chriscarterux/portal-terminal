import { TerminalSession as ITerminalSession, CommandBlock } from './types';

export class TerminalSession implements ITerminalSession {
  public id: string;
  public name: string;
  public blocks: CommandBlock[];
  public workingDirectory: string;
  public environment: Record<string, string>;
  public createdAt: Date;
  public updatedAt: Date;

  constructor(name: string, workingDirectory: string = process.cwd()) {
    this.id = Date.now().toString();
    this.name = name;
    this.blocks = [];
    this.workingDirectory = workingDirectory;
    this.environment = Object.fromEntries(
      Object.entries(process.env).filter(([_, value]) => value !== undefined)
    ) as Record<string, string>;
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }

  addBlock(block: CommandBlock): void {
    this.blocks.push(block);
    this.updatedAt = new Date();
  }

  getBlock(id: string): CommandBlock | undefined {
    return this.blocks.find(block => block.id === id);
  }

  getRecentBlocks(count: number = 10): CommandBlock[] {
    return this.blocks.slice(-count);
  }

  toJSON(): ITerminalSession {
    return {
      id: this.id,
      name: this.name,
      blocks: this.blocks,
      workingDirectory: this.workingDirectory,
      environment: this.environment,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}