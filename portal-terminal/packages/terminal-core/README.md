# @portal/terminal-core

Core terminal functionality for Portal Terminal including PTY management, command execution, and the block-based interface system.

## Features

- **TerminalManager**: Manages PTY processes and command execution
- **CommandBlock**: Represents individual command blocks with metadata
- **TerminalSession**: Manages collections of command blocks and session state
- **Cross-platform**: Works on macOS, Windows, and Linux

## Usage

```typescript
import { TerminalManager, TerminalSession } from '@portal/terminal-core';

const session = new TerminalSession('main');
const terminal = new TerminalManager({ cwd: '/home/user' });

terminal.start();
const block = terminal.executeCommand('ls -la');
session.addBlock(block);
```

## API

### TerminalManager
- `start()` - Initialize PTY process
- `executeCommand(command: string)` - Execute command and return block
- `resize(cols: number, rows: number)` - Resize terminal
- `destroy()` - Clean up resources

### CommandBlock
- `setRunning()` - Mark block as running
- `addOutput(data: string)` - Append output data
- `setCompleted(exitCode?: number)` - Mark block complete

### TerminalSession
- `addBlock(block: CommandBlock)` - Add block to session
- `getBlock(id: string)` - Get block by ID
- `getRecentBlocks(count: number)` - Get recent blocks