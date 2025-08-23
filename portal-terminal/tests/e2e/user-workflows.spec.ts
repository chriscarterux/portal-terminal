import { test, expect, Page } from '@playwright/test';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

test.describe('Portal Terminal User Workflows', () => {
  let page: Page;

  test.beforeEach(async ({ page: testPage }) => {
    page = testPage;
    await page.goto('/');
    
    // Wait for terminal to be ready
    await expect(page.locator('.terminal-container')).toBeVisible();
    await expect(page.locator('.command-input')).toBeFocused();
  });

  test.describe('First-time User Onboarding', () => {
    test('should display welcome message and feature overview', async () => {
      // Check welcome message
      await expect(page.locator('.output')).toContainText('Welcome to Portal Terminal');
      await expect(page.locator('.output')).toContainText('AI-powered terminal');
      
      // Check feature highlights
      const output = await page.locator('.output').textContent();
      expect(output).toContain('Shell:');
      expect(output).toContain('CWD:');
    });

    test('should show help command on first interaction', async () => {
      const commandInput = page.locator('.command-input');
      
      // Type help command
      await commandInput.fill('help');
      await commandInput.press('Enter');
      
      await expect(page.locator('.output')).toContainText('Portal Terminal Commands');
      await expect(page.locator('.output')).toContainText('AI assistance');
      await expect(page.locator('.output')).toContainText('MCP integration');
    });

    test('should provide AI suggestions for first command', async () => {
      const commandInput = page.locator('.command-input');
      
      // Start typing a common command
      await commandInput.fill('ls');
      
      // Should show AI suggestions (mocked for E2E)
      await expect(page.locator('.ai-suggestion')).toBeVisible({ timeout: 1000 });
      await expect(page.locator('.ai-suggestion')).toContainText('List directory contents');
    });
  });

  test.describe('Daily Development Workflow', () => {
    test('should handle project navigation workflow', async () => {
      const commandInput = page.locator('.command-input');
      
      // Navigate to a directory
      await commandInput.fill('cd /tmp');
      await commandInput.press('Enter');
      
      await expect(page.locator('.output')).toContainText('$ cd /tmp');
      
      // List directory contents
      await commandInput.fill('ls -la');
      await commandInput.press('Enter');
      
      await expect(page.locator('.output')).toContainText('$ ls -la');
      
      // Check current directory
      await commandInput.fill('pwd');
      await commandInput.press('Enter');
      
      await expect(page.locator('.output')).toContainText('/tmp');
    });

    test('should handle git workflow with AI assistance', async () => {
      const commandInput = page.locator('.command-input');
      
      // Git status command
      await commandInput.fill('git status');
      await commandInput.press('Enter');
      
      await expect(page.locator('.output')).toContainText('$ git status');
      
      // Should show AI context suggestion
      await expect(page.locator('.ai-context')).toBeVisible({ timeout: 2000 });
      await expect(page.locator('.ai-context')).toContainText('Git repository status');
      
      // Git log command
      await commandInput.fill('git log --oneline');
      await commandInput.press('Enter');
      
      await expect(page.locator('.output')).toContainText('$ git log --oneline');
    });

    test('should handle build commands with performance monitoring', async () => {
      const commandInput = page.locator('.command-input');
      
      // Simulate build command
      await commandInput.fill('npm run build');
      await commandInput.press('Enter');
      
      await expect(page.locator('.output')).toContainText('$ npm run build');
      
      // Should show performance monitoring
      await expect(page.locator('.performance-indicator')).toBeVisible({ timeout: 1000 });
      
      // Wait for command completion
      await expect(page.locator('.command-status.completed')).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('AI Assistance Discovery', () => {
    test('should provide contextual help for unknown commands', async () => {
      const commandInput = page.locator('.command-input');
      
      // Type an uncommon command
      await commandInput.fill('rsync');
      
      // Should show AI explanation
      await expect(page.locator('.ai-help')).toBeVisible({ timeout: 1500 });
      await expect(page.locator('.ai-help')).toContainText('file synchronization');
    });

    test('should suggest alternatives for typos', async () => {
      const commandInput = page.locator('.command-input');
      
      // Type command with typo
      await commandInput.fill('gti status');
      await commandInput.press('Enter');
      
      // Should suggest correction
      await expect(page.locator('.ai-suggestion')).toContainText('Did you mean: git status?');
      
      // User can accept suggestion
      await page.locator('.suggestion-accept').click();
      await expect(commandInput).toHaveValue('git status');
    });

    test('should provide command examples and explanations', async () => {
      const commandInput = page.locator('.command-input');
      
      // Request help for specific command
      await commandInput.fill('explain docker');
      await commandInput.press('Enter');
      
      await expect(page.locator('.output')).toContainText('Docker is a containerization platform');
      await expect(page.locator('.output')).toContainText('Example commands:');
      await expect(page.locator('.output')).toContainText('docker run');
      await expect(page.locator('.output')).toContainText('docker build');
    });
  });

  test.describe('Error Handling and Recovery', () => {
    test('should handle command not found errors with AI suggestions', async () => {
      const commandInput = page.locator('.command-input');
      
      // Run non-existent command
      await commandInput.fill('nonexistentcommand');
      await commandInput.press('Enter');
      
      await expect(page.locator('.output')).toContainText('command not found');
      
      // Should provide AI analysis
      await expect(page.locator('.ai-error-analysis')).toBeVisible({ timeout: 2000 });
      await expect(page.locator('.ai-error-analysis')).toContainText('Command not found');
      await expect(page.locator('.ai-error-analysis')).toContainText('suggestions:');
    });

    test('should analyze permission errors', async () => {
      const commandInput = page.locator('.command-input');
      
      // Simulate permission error
      await commandInput.fill('cat /etc/shadow');
      await commandInput.press('Enter');
      
      await expect(page.locator('.output')).toContainText('Permission denied');
      
      // Should provide AI analysis
      await expect(page.locator('.ai-error-analysis')).toContainText('Permission denied');
      await expect(page.locator('.ai-error-analysis')).toContainText('sudo');
    });

    test('should handle syntax errors with corrections', async () => {
      const commandInput = page.locator('.command-input');
      
      // Command with syntax error
      await commandInput.fill('find . -name "*.js" -exec echo {} +');
      await commandInput.press('Enter');
      
      // Wait for potential syntax error
      await page.waitForTimeout(1000);
      
      // Should show AI syntax help if error occurs
      const hasError = await page.locator('.ai-syntax-help').isVisible();
      if (hasError) {
        await expect(page.locator('.ai-syntax-help')).toContainText('syntax');
      }
    });
  });

  test.describe('Performance Under Load', () => {
    test('should maintain responsiveness with rapid commands', async () => {
      const commandInput = page.locator('.command-input');
      const commands = ['pwd', 'date', 'whoami', 'echo "test"', 'ls'];
      
      const startTime = Date.now();
      
      for (const cmd of commands) {
        await commandInput.fill(cmd);
        await commandInput.press('Enter');
        
        // Wait for command to complete
        await expect(page.locator('.command-status.completed').last()).toBeVisible({ timeout: 2000 });
      }
      
      const totalTime = Date.now() - startTime;
      
      // Should complete all commands quickly
      expect(totalTime).toBeLessThan(10000); // 10 seconds max
      
      // Terminal should still be responsive
      await expect(commandInput).toBeFocused();
    });

    test('should handle long-running commands gracefully', async () => {
      const commandInput = page.locator('.command-input');
      
      // Start long-running command (simulated)
      await commandInput.fill('sleep 3');
      await commandInput.press('Enter');
      
      // Should show running indicator
      await expect(page.locator('.command-status.running')).toBeVisible();
      
      // Should be able to cancel
      await page.keyboard.press('Control+C');
      
      // Should show cancelled status
      await expect(page.locator('.command-status.cancelled')).toBeVisible({ timeout: 1000 });
      
      // Terminal should be responsive again
      await expect(commandInput).toBeFocused();
    });

    test('should monitor memory usage during heavy operations', async () => {
      const commandInput = page.locator('.command-input');
      
      // Run memory-intensive operations
      const heavyCommands = [
        'find / -name "*.log" 2>/dev/null || true',
        'ps aux',
        'env',
      ];
      
      for (const cmd of heavyCommands) {
        await commandInput.fill(cmd);
        await commandInput.press('Enter');
        
        await expect(page.locator('.command-status.completed').last()).toBeVisible({ timeout: 5000 });
        
        // Check memory indicator if available
        const memoryIndicator = page.locator('.memory-usage');
        if (await memoryIndicator.isVisible()) {
          const memoryText = await memoryIndicator.textContent();
          expect(memoryText).toMatch(/\d+MB/);
        }
      }
    });
  });

  test.describe('MCP Integration Workflows', () => {
    test('should show MCP server status', async () => {
      const commandInput = page.locator('.command-input');
      
      // Check MCP status
      await commandInput.fill('mcp status');
      await commandInput.press('Enter');
      
      await expect(page.locator('.output')).toContainText('MCP Servers:');
      await expect(page.locator('.output')).toContainText('Context7');
      await expect(page.locator('.output')).toContainText('Memory Bank');
      await expect(page.locator('.output')).toContainText('Filesystem');
    });

    test('should utilize MCP context in AI responses', async () => {
      const commandInput = page.locator('.command-input');
      
      // Command that should trigger MCP context usage
      await commandInput.fill('explain this project structure');
      await commandInput.press('Enter');
      
      // Should show AI response enhanced with MCP context
      await expect(page.locator('.ai-response')).toBeVisible({ timeout: 3000 });
      await expect(page.locator('.ai-response')).toContainText('project');
      
      // Should indicate MCP context usage
      await expect(page.locator('.mcp-context-indicator')).toBeVisible();
    });

    test('should handle MCP server failures gracefully', async () => {
      // This test would simulate MCP server failure
      // For now, we'll test the UI response to server unavailability
      
      const mcpStatus = page.locator('.mcp-status');
      if (await mcpStatus.isVisible()) {
        await expect(mcpStatus).toContainText('servers');
        
        // Should still function even if some servers are down
        const commandInput = page.locator('.command-input');
        await commandInput.fill('ls');
        await commandInput.press('Enter');
        
        await expect(page.locator('.output')).toContainText('$ ls');
      }
    });
  });

  test.describe('Terminal Features and UI', () => {
    test('should support terminal scrolling and history', async () => {
      const commandInput = page.locator('.command-input');
      
      // Generate some output to scroll
      for (let i = 0; i < 10; i++) {
        await commandInput.fill(`echo "Line ${i}"`);
        await commandInput.press('Enter');
      }
      
      // Test command history with arrow keys
      await commandInput.press('ArrowUp');
      await expect(commandInput).toHaveValue('echo "Line 9"');
      
      await commandInput.press('ArrowUp');
      await expect(commandInput).toHaveValue('echo "Line 8"');
      
      // Test scrolling
      const terminal = page.locator('.terminal-container');
      await terminal.evaluate(el => el.scrollTop = 0);
      
      // Should be able to scroll through history
      expect(await terminal.evaluate(el => el.scrollHeight)).toBeGreaterThan(
        await terminal.evaluate(el => el.clientHeight)
      );
    });

    test('should support copy and paste', async () => {
      const commandInput = page.locator('.command-input');
      
      // Type a command
      await commandInput.fill('echo "test for copy"');
      await commandInput.press('Enter');
      
      // Select output text (this would be implementation-specific)
      const output = page.locator('.output').last();
      await output.click();
      
      // Copy functionality would depend on terminal implementation
      // For now, just verify the output is selectable
      await expect(output).toBeVisible();
    });

    test('should handle terminal resize', async () => {
      // Change viewport size to test responsive behavior
      await page.setViewportSize({ width: 1200, height: 800 });
      
      const terminal = page.locator('.terminal-container');
      await expect(terminal).toBeVisible();
      
      // Change to smaller size
      await page.setViewportSize({ width: 800, height: 600 });
      await expect(terminal).toBeVisible();
      
      // Terminal should adapt to new size
      const commandInput = page.locator('.command-input');
      await expect(commandInput).toBeFocused();
    });
  });

  test.describe('Cross-Platform Compatibility', () => {
    test('should detect and adapt to shell type', async () => {
      const commandInput = page.locator('.command-input');
      
      // Check shell detection in output
      const welcomeOutput = await page.locator('.output').first().textContent();
      expect(welcomeOutput).toMatch(/Shell: (bash|zsh|fish|sh)/);
      
      // Commands should work regardless of shell
      await commandInput.fill('pwd');
      await commandInput.press('Enter');
      
      await expect(page.locator('.output')).toContainText('/');
    });

    test('should handle platform-specific commands appropriately', async () => {
      const commandInput = page.locator('.command-input');
      
      // Use a command that exists on most platforms
      await commandInput.fill('echo $HOME');
      await commandInput.press('Enter');
      
      // Should show environment variable
      await expect(page.locator('.output')).toContainText('/');
      
      // Try platform detection
      await commandInput.fill('uname -s');
      await commandInput.press('Enter');
      
      // Should show OS name
      const output = await page.locator('.output').last().textContent();
      expect(output).toMatch(/(Darwin|Linux|Windows)/);
    });
  });

  test.describe('Accessibility and Usability', () => {
    test('should support keyboard navigation', async () => {
      const commandInput = page.locator('.command-input');
      
      // Tab should focus command input
      await page.keyboard.press('Tab');
      await expect(commandInput).toBeFocused();
      
      // Ctrl+L should clear screen (if implemented)
      await commandInput.fill('echo "before clear"');
      await commandInput.press('Enter');
      
      await page.keyboard.press('Control+L');
      
      // Should clear or scroll to top
      await expect(commandInput).toBeFocused();
    });

    test('should have appropriate ARIA labels', async () => {
      const commandInput = page.locator('.command-input');
      
      // Should have accessibility attributes
      await expect(commandInput).toHaveAttribute('role', 'textbox');
      await expect(commandInput).toHaveAttribute('aria-label', /command|input/i);
      
      // Terminal container should have appropriate role
      const terminal = page.locator('.terminal-container');
      await expect(terminal).toHaveAttribute('role', /log|region/);
    });

    test('should support high contrast and dark themes', async () => {
      // Test theme switching if available
      const themeToggle = page.locator('.theme-toggle');
      
      if (await themeToggle.isVisible()) {
        await themeToggle.click();
        
        // Should apply dark theme
        await expect(page.locator('body')).toHaveClass(/dark|theme-dark/);
        
        // Toggle back
        await themeToggle.click();
        await expect(page.locator('body')).not.toHaveClass(/dark|theme-dark/);
      }
    });
  });

  test.describe('Data Persistence and Recovery', () => {
    test('should persist command history across sessions', async () => {
      const commandInput = page.locator('.command-input');
      
      // Run some commands
      await commandInput.fill('echo "persistent command"');
      await commandInput.press('Enter');
      
      // Reload the page to simulate session restart
      await page.reload();
      
      // Wait for terminal to be ready again
      await expect(page.locator('.terminal-container')).toBeVisible();
      await expect(page.locator('.command-input')).toBeFocused();
      
      // Check if command history is available
      const newCommandInput = page.locator('.command-input');
      await newCommandInput.press('ArrowUp');
      
      // Should restore previous command
      const inputValue = await newCommandInput.inputValue();
      expect(inputValue.length).toBeGreaterThan(0);
    });

    test('should recover from unexpected errors', async () => {
      const commandInput = page.locator('.command-input');
      
      // Try to cause an error (this is context-dependent)
      await commandInput.fill('undefined_command_that_should_fail');
      await commandInput.press('Enter');
      
      // Should show error but remain functional
      await expect(page.locator('.output')).toContainText('not found');
      
      // Terminal should still be responsive
      await commandInput.fill('echo "recovery test"');
      await commandInput.press('Enter');
      
      await expect(page.locator('.output')).toContainText('recovery test');
      await expect(commandInput).toBeFocused();
    });
  });
});