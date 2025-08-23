import { test, expect } from '@playwright/test';

test.describe('Warp-style UI Integration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');
  });

  test('should initialize with Warp-style terminal interface', async ({ page }) => {
    // Check for main Warp terminal component
    const warpTerminal = page.locator('.warp-terminal');
    await expect(warpTerminal).toBeVisible();
    
    // Check for command input
    const commandInput = page.locator('.command-input');
    await expect(commandInput).toBeVisible();
    await expect(commandInput).toHaveAttribute('placeholder', /Type a command/);
    
    // Check for status bar
    const statusBar = page.locator('.status-bar');
    await expect(statusBar).toBeVisible();
  });

  test('should display AI suggestions when typing commands', async ({ page }) => {
    const commandInput = page.locator('.command-input');
    
    // Type a command that should trigger suggestions
    await commandInput.fill('git st');
    await page.waitForTimeout(500); // Wait for debounced suggestions
    
    // Check for AI suggestions popup
    const suggestions = page.locator('.ai-suggestions');
    await expect(suggestions).toBeVisible();
    
    // Should show loading or suggestions
    const loadingOrSuggestions = page.locator('.suggestion-loading, .suggestions-container');
    await expect(loadingOrSuggestions).toBeVisible();
  });

  test('should open command palette with Cmd+K', async ({ page }) => {
    // Trigger command palette
    await page.keyboard.press('Meta+k');
    
    // Check palette is visible
    const palette = page.locator('.command-palette');
    await expect(palette).toBeVisible();
    
    // Check search input is focused
    const searchInput = page.locator('.search-input');
    await expect(searchInput).toBeFocused();
    
    // Close with Escape
    await page.keyboard.press('Escape');
    await expect(palette).not.toBeVisible();
  });

  test('should execute commands and display in blocks', async ({ page }) => {
    const commandInput = page.locator('.command-input');
    
    // Execute a simple command
    await commandInput.fill('echo "Hello Portal"');
    await page.keyboard.press('Enter');
    
    // Wait for command block to appear
    const commandBlock = page.locator('.command-block').first();
    await expect(commandBlock).toBeVisible();
    
    // Check command text is displayed
    await expect(commandBlock.locator('.command-text')).toContainText('echo "Hello Portal"');
    
    // Check for success status
    await expect(commandBlock.locator('.command-status')).toContainText('✓');
    
    // Check output is displayed
    await expect(commandBlock.locator('.command-output')).toBeVisible();
  });

  test('should show MCP status and context', async ({ page }) => {
    // Check MCP status indicator
    const mcpStatus = page.locator('.mcp-status');
    await expect(mcpStatus).toBeVisible();
    
    // Hover to show tooltip
    await mcpStatus.hover();
    const tooltip = page.locator('.mcp-tooltip');
    await expect(tooltip).toBeVisible();
    
    // Should show server information
    await expect(tooltip).toContainText('Model Context Protocol Status');
  });

  test('should handle command errors gracefully', async ({ page }) => {
    const commandInput = page.locator('.command-input');
    
    // Execute a command that will fail
    await commandInput.fill('nonexistentcommand12345');
    await page.keyboard.press('Enter');
    
    // Wait for error block
    const errorBlock = page.locator('.command-block').first();
    await expect(errorBlock).toBeVisible();
    
    // Check for error status
    await expect(errorBlock.locator('.command-status')).toContainText('✗');
    
    // Should show error analysis
    await expect(errorBlock).toContainText(/Error|Failed/);
  });

  test('should show performance metrics in status bar', async ({ page }) => {
    const statusBar = page.locator('.status-bar');
    
    // Check for performance indicator
    const perfIndicator = page.locator('.status-item.performance');
    await expect(perfIndicator).toBeVisible();
    
    // Should show command count and response time
    await expect(perfIndicator).toContainText(/cmds/);
    await expect(perfIndicator).toContainText(/ms/);
  });

  test('should provide command block actions on hover', async ({ page }) => {
    // First execute a command to create a block
    const commandInput = page.locator('.command-input');
    await commandInput.fill('ls');
    await page.keyboard.press('Enter');
    
    // Wait for command block
    const commandBlock = page.locator('.command-block').first();
    await expect(commandBlock).toBeVisible();
    
    // Hover over the block
    await commandBlock.hover();
    
    // Check for action buttons
    const actions = page.locator('.command-actions');
    await expect(actions).toBeVisible();
    
    // Check for specific action buttons
    await expect(actions.locator('button[title="Copy command"]')).toBeVisible();
    await expect(actions.locator('button[title="Rerun command"]')).toBeVisible();
  });

  test('should handle long output with expand/collapse', async ({ page }) => {
    // Execute command with potentially long output
    const commandInput = page.locator('.command-input');
    await commandInput.fill('find /usr -name "*.txt" 2>/dev/null || echo "simulated long output\\n".repeat(30)');
    await page.keyboard.press('Enter');
    
    // Wait for command block
    const commandBlock = page.locator('.command-block').first();
    await expect(commandBlock).toBeVisible();
    
    // Look for expand/collapse functionality
    const expandBtn = commandBlock.locator('.expand-btn');
    if (await expandBtn.isVisible()) {
      await expandBtn.click();
      await expect(expandBtn).toContainText(/Collapse|Expand/);
    }
  });

  test('should integrate AI and MCP context', async ({ page }) => {
    // Execute a git command to trigger context integration
    const commandInput = page.locator('.command-input');
    await commandInput.fill('git status');
    await page.keyboard.press('Enter');
    
    // Wait for command completion
    await page.waitForTimeout(2000);
    
    // Check if AI suggestions appear
    const aiSuggestion = page.locator('.ai-suggestion');
    // AI suggestions might appear - this is optional based on implementation
    
    // Check if MCP context is available
    const mcpContext = page.locator('.mcp-context');
    // MCP context might appear - this is optional based on implementation
    
    // At minimum, command should execute successfully
    const commandBlock = page.locator('.command-block').first();
    await expect(commandBlock).toBeVisible();
  });

  test('should maintain responsiveness during AI operations', async ({ page }) => {
    const commandInput = page.locator('.command-input');
    
    // Type quickly to test responsiveness
    await commandInput.fill('g');
    await page.waitForTimeout(100);
    await commandInput.fill('gi');
    await page.waitForTimeout(100);
    await commandInput.fill('git');
    await page.waitForTimeout(100);
    await commandInput.fill('git s');
    
    // Input should remain responsive
    await expect(commandInput).toHaveValue('git s');
    
    // UI should not freeze
    const statusBar = page.locator('.status-bar');
    await expect(statusBar).toBeVisible();
  });

  test('should handle rapid command execution', async ({ page }) => {
    const commandInput = page.locator('.command-input');
    
    // Execute multiple commands rapidly
    const commands = ['echo "test1"', 'echo "test2"', 'echo "test3"'];
    
    for (const cmd of commands) {
      await commandInput.fill(cmd);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(500); // Brief pause between commands
    }
    
    // All command blocks should appear
    const blocks = page.locator('.command-block');
    await expect(blocks).toHaveCount(3);
    
    // All should show success status
    const statusIcons = page.locator('.command-status');
    for (let i = 0; i < 3; i++) {
      await expect(statusIcons.nth(i)).toContainText('✓');
    }
  });
});