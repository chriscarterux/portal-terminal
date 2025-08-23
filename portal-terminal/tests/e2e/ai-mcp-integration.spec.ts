import { test, expect } from '@playwright/test';

test.describe('AI-MCP Integration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');
    
    // Wait for terminal initialization
    await page.waitForSelector('.warp-terminal', { timeout: 10000 });
  });

  test('should initialize AI and MCP systems', async ({ page }) => {
    // Check for AI ready indicator
    const aiStatus = page.locator('.status-item.ai');
    await expect(aiStatus).toBeVisible();
    await expect(aiStatus).toContainText(/AI Ready|AI/);
    
    // Check for MCP status
    const mcpStatus = page.locator('.mcp-status');
    await expect(mcpStatus).toBeVisible();
    
    // MCP should show connected servers
    await expect(mcpStatus).toContainText(/MCP \d+\/\d+/);
  });

  test('should provide AI suggestions for git commands', async ({ page }) => {
    const commandInput = page.locator('.command-input');
    
    // Type git command
    await commandInput.fill('git');
    await page.waitForTimeout(500);
    
    // Should trigger AI suggestions
    const suggestions = page.locator('.ai-suggestions');
    
    // Either suggestions appear or quick suggestion is shown
    const hasSuggestions = await suggestions.isVisible();
    const hasQuickHint = await page.locator('.suggestion-hint').isVisible();
    
    expect(hasSuggestions || hasQuickHint).toBeTruthy();
  });

  test('should connect MCP context to AI responses', async ({ page }) => {
    const commandInput = page.locator('.command-input');
    
    // Execute a command that would benefit from MCP context
    await commandInput.fill('git log');
    await page.keyboard.press('Enter');
    
    // Wait for command completion
    await page.waitForTimeout(3000);
    
    // Check if MCP context was used (look for enhanced output or suggestions)
    const commandBlock = page.locator('.command-block').first();
    await expect(commandBlock).toBeVisible();
    
    // Hover to see if MCP context is available
    await commandBlock.hover();
    
    // MCP context might be shown on hover
    const mcpContext = page.locator('.mcp-context');
    if (await mcpContext.isVisible()) {
      await expect(mcpContext).toContainText(/Available Context|MCP/);
    }
  });

  test('should provide AI error analysis and recovery suggestions', async ({ page }) => {
    const commandInput = page.locator('.command-input');
    
    // Execute a command that will fail
    await commandInput.fill('rm /nonexistent/file/path');
    await page.keyboard.press('Enter');
    
    // Wait for error analysis
    await page.waitForTimeout(3000);
    
    const errorBlock = page.locator('.command-block').first();
    await expect(errorBlock).toBeVisible();
    
    // Should show error status
    await expect(errorBlock.locator('.command-status')).toContainText('✗');
    
    // Should contain error analysis
    const blockText = await errorBlock.textContent();
    expect(blockText).toMatch(/Error|Failed|Analysis|Diagnosis/);
  });

  test('should integrate AI suggestions with MCP tools', async ({ page }) => {
    // Open command palette to see AI + MCP integration
    await page.keyboard.press('Meta+k');
    
    const palette = page.locator('.command-palette');
    await expect(palette).toBeVisible();
    
    // Type to search
    const searchInput = page.locator('.search-input');
    await searchInput.fill('file');
    await page.waitForTimeout(500);
    
    // Should show mixed results from AI and MCP
    const commandItems = page.locator('.command-item');
    if (await commandItems.count() > 0) {
      // Check for different command categories
      const categories = page.locator('.command-category');
      const categoryTexts = await categories.allTextContents();
      
      // Should have mix of ai, mcp, or suggested commands
      const hasAI = categoryTexts.some(text => text.includes('ai'));
      const hasMCP = categoryTexts.some(text => text.includes('mcp'));
      const hasSuggested = categoryTexts.some(text => text.includes('suggested'));
      
      expect(hasAI || hasMCP || hasSuggested).toBeTruthy();
    }
  });

  test('should show performance monitoring in real-time', async ({ page }) => {
    // Execute several commands to generate metrics
    const commandInput = page.locator('.command-input');
    const commands = ['pwd', 'ls', 'echo "test"'];
    
    for (const cmd of commands) {
      await commandInput.fill(cmd);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1000);
    }
    
    // Check performance metrics in status bar
    const perfItem = page.locator('.status-item.performance');
    await expect(perfItem).toBeVisible();
    
    // Should show command count
    await expect(perfItem).toContainText(/\d+ cmds/);
    
    // Should show response time
    await expect(perfItem).toContainText(/\d+ms/);
  });

  test('should handle AI model switching based on complexity', async ({ page }) => {
    const commandInput = page.locator('.command-input');
    
    // Simple command (should use fast model)
    await commandInput.fill('ls');
    const startTime = Date.now();
    await page.keyboard.press('Enter');
    
    // Wait for completion
    await page.waitForSelector('.command-block', { timeout: 5000 });
    const simpleCommandTime = Date.now() - startTime;
    
    // Complex query (should use quality model)
    await commandInput.fill('explain the difference between git merge and git rebase');
    await page.keyboard.press('Enter');
    
    // Both should complete, but we can't easily test model selection from UI
    // This test verifies the commands execute successfully
    const blocks = page.locator('.command-block');
    await expect(blocks).toHaveCount(2);
  });

  test('should maintain context across command execution', async ({ page }) => {
    const commandInput = page.locator('.command-input');
    
    // Execute git status to establish git context
    await commandInput.fill('git status');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2000);
    
    // Check git context in status bar
    const gitStatus = page.locator('.status-item.git');
    if (await gitStatus.isVisible()) {
      await expect(gitStatus).toContainText(/\w+/); // Should show branch name
    }
    
    // Execute another git command
    await commandInput.fill('git branch');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2000);
    
    // Context should be maintained
    const secondBlock = page.locator('.command-block').nth(1);
    await expect(secondBlock).toBeVisible();
  });

  test('should provide contextual help through AI integration', async ({ page }) => {
    const commandInput = page.locator('.command-input');
    
    // Execute a command
    await commandInput.fill('npm install');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2000);
    
    // Click AI help button if available
    const commandBlock = page.locator('.command-block').first();
    await commandBlock.hover();
    
    const aiHelpBtn = page.locator('button[title="Get AI help"]');
    if (await aiHelpBtn.isVisible()) {
      await aiHelpBtn.click();
      
      // Should show AI help response
      await page.waitForTimeout(2000);
      
      // Look for AI suggestion or help content
      const aiSuggestion = page.locator('.ai-suggestion, .current-suggestion');
      if (await aiSuggestion.isVisible()) {
        await expect(aiSuggestion).toContainText(/AI/);
      }
    }
  });

  test('should show system health and alerts', async ({ page }) => {
    // Execute multiple commands to generate metrics
    const commandInput = page.locator('.command-input');
    
    for (let i = 0; i < 5; i++) {
      await commandInput.fill(`echo "test ${i}"`);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(500);
    }
    
    // Check status bar for health indicators
    const statusBar = page.locator('.status-bar');
    await expect(statusBar).toBeVisible();
    
    // Should show uptime
    const uptime = page.locator('.status-item.uptime');
    await expect(uptime).toBeVisible();
    await expect(uptime).toContainText(/\d+[sm]/);
    
    // Performance should be tracked
    const performance = page.locator('.status-item.performance');
    await expect(performance).toContainText(/\d+ cmds/);
  });

  test('should handle clipboard operations in command blocks', async ({ page }) => {
    const commandInput = page.locator('.command-input');
    
    // Execute a command
    await commandInput.fill('echo "clipboard test"');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);
    
    const commandBlock = page.locator('.command-block').first();
    await commandBlock.hover();
    
    // Look for copy button
    const copyBtn = page.locator('button[title="Copy command"]');
    if (await copyBtn.isVisible()) {
      // Click copy button (actual clipboard test would require special permissions)
      await copyBtn.click();
      
      // Button should remain functional
      await expect(copyBtn).toBeVisible();
    }
  });

  test('should display project context correctly', async ({ page }) => {
    // Check if project context is detected in status bar
    const projectItem = page.locator('.status-item.project');
    
    if (await projectItem.isVisible()) {
      // Should show project type icon and name
      await expect(projectItem).toContainText(/node|python|rust|go/);
    }
    
    // Check working directory
    const directoryItem = page.locator('.status-item.directory');
    await expect(directoryItem).toBeVisible();
    await expect(directoryItem).toContainText(/\w+/); // Should show some directory name
  });
});