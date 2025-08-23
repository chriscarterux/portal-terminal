import { test, expect } from '@playwright/test';

test.describe('Portal Terminal Basic Functionality', () => {
  test('should display welcome message on startup', async ({ page }) => {
    await page.goto('/');
    
    await expect(page.locator('.output')).toContainText('Welcome to Portal Terminal');
  });

  test('should accept command input', async ({ page }) => {
    await page.goto('/');
    
    const commandInput = page.locator('.command-input');
    await expect(commandInput).toBeVisible();
    await expect(commandInput).toBeFocused();
    
    await commandInput.fill('echo "hello world"');
    await expect(commandInput).toHaveValue('echo "hello world"');
  });

  test('should execute commands when submitted', async ({ page }) => {
    await page.goto('/');
    
    const commandInput = page.locator('.command-input');
    await commandInput.fill('echo "test command"');
    await commandInput.press('Enter');
    
    await expect(page.locator('.output')).toContainText('$ echo "test command"');
    await expect(commandInput).toHaveValue('');
  });

  test('should display command prompt', async ({ page }) => {
    await page.goto('/');
    
    await expect(page.locator('.prompt')).toContainText('$');
    await expect(page.locator('.prompt')).toHaveCSS('color', 'rgb(0, 212, 170)');
  });
});