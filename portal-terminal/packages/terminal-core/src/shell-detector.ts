import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';

export interface IShellInfo {
  name: string;
  path: string;
  args: string[];
  env: Record<string, string>;
}

export class ShellDetector {
  static detectDefaultShell(): IShellInfo {
    const platform = os.platform();
    
    switch (platform) {
      case 'win32':
        return this.detectWindowsShell();
      case 'darwin':
        return this.detectMacShell();
      case 'linux':
        return this.detectLinuxShell();
      default:
        return this.getFallbackShell();
    }
  }

  private static detectWindowsShell(): IShellInfo {
    // Check for PowerShell Core first, then Windows PowerShell, then cmd
    const shells = [
      { name: 'pwsh', path: 'pwsh.exe', args: ['-NoLogo'] },
      { name: 'powershell', path: 'powershell.exe', args: ['-NoLogo'] },
      { name: 'cmd', path: 'cmd.exe', args: ['/K'] },
    ];

    for (const shell of shells) {
      if (this.shellExists(shell.path)) {
        return {
          ...shell,
          env: {
            TERM: 'xterm-256color',
            COLORTERM: 'truecolor',
          },
        };
      }
    }

    return this.getFallbackShell();
  }

  private static detectMacShell(): IShellInfo {
    // Check user's default shell from environment or /etc/passwd
    const userShell = process.env.SHELL || '/bin/zsh';
    const shellName = path.basename(userShell);

    return {
      name: shellName,
      path: userShell,
      args: shellName === 'zsh' ? ['--login'] : [],
      env: {
        TERM: 'xterm-256color',
        COLORTERM: 'truecolor',
        LANG: process.env.LANG || 'en_US.UTF-8',
      },
    };
  }

  private static detectLinuxShell(): IShellInfo {
    const userShell = process.env.SHELL || '/bin/bash';
    const shellName = path.basename(userShell);

    return {
      name: shellName,
      path: userShell,
      args: shellName === 'bash' ? ['--login'] : [],
      env: {
        TERM: 'xterm-256color',
        COLORTERM: 'truecolor',
        LANG: process.env.LANG || 'en_US.UTF-8',
      },
    };
  }

  private static shellExists(shellPath: string): boolean {
    try {
      return fs.existsSync(shellPath);
    } catch {
      return false;
    }
  }

  private static getFallbackShell(): IShellInfo {
    const platform = os.platform();
    
    if (platform === 'win32') {
      return {
        name: 'cmd',
        path: 'cmd.exe',
        args: ['/K'],
        env: { TERM: 'xterm-256color' },
      };
    } else {
      return {
        name: 'sh',
        path: '/bin/sh',
        args: [],
        env: { 
          TERM: 'xterm-256color',
          LANG: 'en_US.UTF-8',
        },
      };
    }
  }
}