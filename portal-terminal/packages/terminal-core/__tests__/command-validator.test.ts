import { CommandValidator } from '../src/command-validator';

describe('CommandValidator', () => {
  describe('validateCommand', () => {
    it('should validate safe commands', () => {
      const result = CommandValidator.validateCommand('ls -la');
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect dangerous commands', () => {
      const result = CommandValidator.validateCommand('rm -rf /');
      
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('dangerous');
    });

    it('should detect dangerous patterns', () => {
      const result = CommandValidator.validateCommand('dd if=/dev/zero of=/dev/sda');
      
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should suggest corrections for typos', () => {
      const result = CommandValidator.validateCommand('sl');
      
      expect(result.suggestions).toContain('Did you mean: ls?');
    });

    it('should warn about risky operations', () => {
      const result = CommandValidator.validateCommand('sudo rm file.txt');
      
      expect(result.isValid).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain('sudo rm');
    });
  });

  describe('isInteractiveCommand', () => {
    it('should detect interactive commands', () => {
      expect(CommandValidator.isInteractiveCommand('vim file.txt')).toBe(true);
      expect(CommandValidator.isInteractiveCommand('top')).toBe(true);
      expect(CommandValidator.isInteractiveCommand('ls')).toBe(false);
    });
  });

  describe('requiresElevation', () => {
    it('should detect elevation commands', () => {
      expect(CommandValidator.requiresElevation('sudo ls')).toBe(true);
      expect(CommandValidator.requiresElevation('su - user')).toBe(true);
      expect(CommandValidator.requiresElevation('ls')).toBe(false);
    });
  });
});