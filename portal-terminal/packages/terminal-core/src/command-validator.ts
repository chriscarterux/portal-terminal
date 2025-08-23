export interface ICommandValidationResult {
  isValid: boolean;
  warnings: string[];
  errors: string[];
  suggestions?: string[];
}

export class CommandValidator {
  private static readonly DANGEROUS_COMMANDS = [
    'rm -rf /',
    'sudo rm -rf',
    'format c:',
    'del /s /q c:\\',
    'shutdown',
    'reboot',
    'halt',
    'init 0',
    'init 6',
  ];

  private static readonly DANGEROUS_PATTERNS = [
    /rm\s+-rf\s+\/(?:\s|$)/,
    /rm\s+-rf\s+\~(?:\s|$)/,
    /dd\s+if=.*of=\/dev\/[sh]d[a-z]/,
    /:\(\)\{\s*:\|\:&\s*\};\:/,  // Fork bomb
  ];

  static validateCommand(command: string): ICommandValidationResult {
    const result: ICommandValidationResult = {
      isValid: true,
      warnings: [],
      errors: [],
      suggestions: [],
    };

    const trimmedCommand = command.trim().toLowerCase();

    // Check for empty command
    if (!trimmedCommand) {
      result.isValid = false;
      result.errors.push('Empty command');
      return result;
    }

    // Check for dangerous commands
    for (const dangerous of this.DANGEROUS_COMMANDS) {
      if (trimmedCommand.includes(dangerous.toLowerCase())) {
        result.isValid = false;
        result.errors.push(`Potentially dangerous command detected: ${dangerous}`);
      }
    }

    // Check for dangerous patterns
    for (const pattern of this.DANGEROUS_PATTERNS) {
      if (pattern.test(command)) {
        result.isValid = false;
        result.errors.push('Potentially destructive command pattern detected');
      }
    }

    // Check for common typos and suggest corrections
    this.addTypoSuggestions(trimmedCommand, result);

    // Add warnings for potentially risky operations
    this.addWarnings(trimmedCommand, result);

    return result;
  }

  private static addTypoSuggestions(command: string, result: ICommandValidationResult): void {
    const commonTypos: Record<string, string> = {
      'sl': 'ls',
      'gti': 'git',
      'git psuh': 'git push',
      'git plul': 'git pull',
      'cd..': 'cd ..',
      'claer': 'clear',
      'exot': 'exit',
    };

    const firstWord = command.split(' ')[0];
    if (commonTypos[firstWord]) {
      result.suggestions?.push(`Did you mean: ${commonTypos[firstWord]}?`);
    }
  }

  private static addWarnings(command: string, result: ICommandValidationResult): void {
    const warnings: Array<{ pattern: RegExp; message: string }> = [
      {
        pattern: /sudo\s+rm/,
        message: 'Using sudo rm - be careful with file deletion',
      },
      {
        pattern: /chmod\s+777/,
        message: 'Setting 777 permissions is generally unsafe',
      },
      {
        pattern: /curl.*\|\s*sh/,
        message: 'Piping curl output to shell can be dangerous',
      },
      {
        pattern: /wget.*\|\s*sh/,
        message: 'Piping wget output to shell can be dangerous',
      },
    ];

    for (const warning of warnings) {
      if (warning.pattern.test(command)) {
        result.warnings.push(warning.message);
      }
    }
  }

  static isInteractiveCommand(command: string): boolean {
    const interactiveCommands = [
      'vim', 'nvim', 'emacs', 'nano',
      'top', 'htop', 'less', 'more',
      'man', 'ssh', 'telnet',
      'mysql', 'psql', 'mongo',
      'python', 'node', 'irb',
    ];

    const firstWord = command.trim().split(' ')[0];
    return interactiveCommands.includes(firstWord);
  }

  static requiresElevation(command: string): boolean {
    const elevatedCommands = ['sudo', 'su', 'doas'];
    const firstWord = command.trim().split(' ')[0];
    return elevatedCommands.includes(firstWord);
  }
}