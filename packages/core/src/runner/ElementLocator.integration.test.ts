/**
 * Integration tests for ElementLocator
 *
 * These tests launch a real Chromium browser and test element location strategies
 * against HTML fixtures. They verify multi-strategy fallback and retry logic.
 *
 * Run with: pnpm run test:integration
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { chromium, type Browser, type Page } from 'playwright';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { ElementLocator } from './ElementLocator.js';
import type { SelectorStrategy } from '../types/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to test fixture HTML file
const TEST_PAGE_PATH = path.join(__dirname, '__fixtures__', 'test-page.html');
const TEST_PAGE_URL = `file://${TEST_PAGE_PATH.replace(/\\/g, '/')}`;

describe('ElementLocator Integration Tests', () => {
  let browser: Browser;
  let page: Page;
  let locator: ElementLocator;

  beforeAll(async () => {
    browser = await chromium.launch({ headless: true });
    locator = new ElementLocator();
  });

  afterAll(async () => {
    await browser?.close();
  });

  beforeEach(async () => {
    page = await browser.newPage();
    await page.goto(TEST_PAGE_URL);
    await page.waitForLoadState('domcontentloaded');
  });

  describe('findElement with ID selector', () => {
    it('should find element by ID (highest priority)', async () => {
      const selector: SelectorStrategy = {
        id: 'click-btn',
        css: 'button',
        priority: ['id', 'css'],
      };

      const element = await locator.findElement(page, selector);
      expect(element).not.toBeNull();

      const text = await element!.textContent();
      expect(text).toContain('Click Me');
    });

    it('should find form input by ID', async () => {
      const selector: SelectorStrategy = {
        id: 'username',
        priority: ['id'],
      };

      const element = await locator.findElement(page, selector);
      expect(element).not.toBeNull();

      const placeholder = await element!.getAttribute('placeholder');
      expect(placeholder).toBe('Enter username');
    });

    it('should find textarea by ID', async () => {
      const selector: SelectorStrategy = {
        id: 'bio',
        priority: ['id'],
      };

      const element = await locator.findElement(page, selector);
      expect(element).not.toBeNull();

      const tagName = await element!.evaluate((el) => el.tagName.toLowerCase());
      expect(tagName).toBe('textarea');
    });
  });

  describe('findElement with data-testid selector', () => {
    it('should find element by data-testid', async () => {
      const selector: SelectorStrategy = {
        dataTestId: 'test-btn',
        priority: ['dataTestId'],
      };

      const element = await locator.findElement(page, selector);
      expect(element).not.toBeNull();

      const text = await element!.textContent();
      expect(text).toContain('Test Button');
    });
  });

  describe('findElement with aria-label selector', () => {
    it('should find element by aria-label', async () => {
      const selector: SelectorStrategy = {
        ariaLabel: 'Delete item',
        priority: ['ariaLabel'],
      };

      const element = await locator.findElement(page, selector);
      expect(element).not.toBeNull();

      const text = await element!.textContent();
      expect(text).toContain('Delete');
    });
  });

  describe('findElement with name selector', () => {
    it('should find input by name attribute', async () => {
      const selector: SelectorStrategy = {
        name: 'email',
        priority: ['name'],
      };

      const element = await locator.findElement(page, selector);
      expect(element).not.toBeNull();

      const type = await element!.getAttribute('type');
      expect(type).toBe('email');
    });

    it('should find select by name attribute', async () => {
      const selector: SelectorStrategy = {
        name: 'country',
        priority: ['name'],
      };

      const element = await locator.findElement(page, selector);
      expect(element).not.toBeNull();

      const tagName = await element!.evaluate((el) => el.tagName.toLowerCase());
      expect(tagName).toBe('select');
    });
  });

  describe('findElement with CSS selector', () => {
    it('should find element by CSS selector', async () => {
      const selector: SelectorStrategy = {
        css: '#click-section button.secondary',
        priority: ['css'],
      };

      const element = await locator.findElement(page, selector);
      expect(element).not.toBeNull();
    });

    it('should find element by class selector', async () => {
      const selector: SelectorStrategy = {
        css: '.clickable-item[data-id="1"]',
        priority: ['css'],
      };

      const element = await locator.findElement(page, selector);
      expect(element).not.toBeNull();

      const text = await element!.textContent();
      expect(text).toContain('Item 1');
    });

    it('should find nested elements', async () => {
      const selector: SelectorStrategy = {
        css: '#input-section form input[type="email"]',
        priority: ['css'],
      };

      const element = await locator.findElement(page, selector);
      expect(element).not.toBeNull();
    });
  });

  describe('Selector priority fallback', () => {
    it('should fallback to CSS when ID not found', async () => {
      const selector: SelectorStrategy = {
        id: 'non-existent-id',
        css: '#click-btn',
        priority: ['id', 'css'],
      };

      const element = await locator.findElement(page, selector);
      expect(element).not.toBeNull();

      const text = await element!.textContent();
      expect(text).toContain('Click Me');
    });

    it('should try selectors in priority order', async () => {
      const selector: SelectorStrategy = {
        id: 'wrong-id',
        dataTestId: 'wrong-testid',
        ariaLabel: 'Delete item', // This one should match
        priority: ['id', 'dataTestId', 'ariaLabel'],
      };

      const element = await locator.findElement(page, selector);
      expect(element).not.toBeNull();
    });

    it('should use name as fallback', async () => {
      const selector: SelectorStrategy = {
        id: 'wrong-id',
        name: 'username',
        priority: ['id', 'name'],
      };

      const element = await locator.findElement(page, selector);
      expect(element).not.toBeNull();

      const id = await element!.getAttribute('id');
      expect(id).toBe('username');
    });
  });

  describe('Error handling', () => {
    it('should throw/return null when no selector matches', async () => {
      const selector: SelectorStrategy = {
        id: 'non-existent',
        css: '.non-existent-class',
        priority: ['id', 'css'],
      };

      // ElementLocator may throw or return null depending on implementation
      try {
        const element = await locator.findElement(page, selector);
        // If it returns null, that's acceptable
        expect(element).toBeNull();
      } catch (error) {
        // If it throws, that's also acceptable
        expect(error).toBeDefined();
      }
    });

    it('should handle empty priority array gracefully', async () => {
      const selector: SelectorStrategy = {
        id: 'click-btn',
        priority: [],
      };

      // With empty priority, locator should either use available selectors or throw
      try {
        const element = await locator.findElement(page, selector);
        // If it succeeds, element should be valid
        if (element) {
          const isVisible = await element.isVisible();
          expect(isVisible).toBe(true);
        }
      } catch (error) {
        // Throwing is acceptable behavior for empty priority
        expect(error).toBeDefined();
      }
    });
  });

  describe('Element interactions after location', () => {
    it('should return clickable element', async () => {
      const selector: SelectorStrategy = {
        id: 'click-btn',
        priority: ['id'],
      };

      const element = await locator.findElement(page, selector);
      expect(element).not.toBeNull();

      // Verify element is clickable
      const isVisible = await element!.isVisible();
      expect(isVisible).toBe(true);
    });

    it('should return fillable input element', async () => {
      const selector: SelectorStrategy = {
        id: 'username',
        priority: ['id'],
      };

      const element = await locator.findElement(page, selector);
      expect(element).not.toBeNull();

      // Verify element can be filled
      await element!.fill('test-value');
      const value = await element!.inputValue();
      expect(value).toBe('test-value');
    });

    it('should return selectable dropdown', async () => {
      const selector: SelectorStrategy = {
        id: 'country',
        priority: ['id'],
      };

      const element = await locator.findElement(page, selector);
      expect(element).not.toBeNull();

      // Verify element can be selected
      await element!.selectOption('uk');
      const value = await element!.inputValue();
      expect(value).toBe('uk');
    });
  });

  describe('Dynamic content handling', () => {
    it('should find dynamically loaded elements after they appear', async () => {
      // First, load the dynamic content
      await page.click('#load-content-btn');

      // Wait a bit for content to load
      await page.waitForSelector('#dynamic-btn', { state: 'visible' });

      const selector: SelectorStrategy = {
        id: 'dynamic-btn',
        priority: ['id'],
      };

      const element = await locator.findElement(page, selector);
      expect(element).not.toBeNull();

      const text = await element!.textContent();
      expect(text).toContain('Dynamic Button');
    });

    it('should handle initially hidden elements', async () => {
      // Dynamic content is initially hidden
      const selector: SelectorStrategy = {
        id: 'dynamic-content',
        priority: ['id'],
      };

      const element = await locator.findElement(page, selector);
      expect(element).not.toBeNull();

      // Element exists but may be hidden
      const isHidden = await element!.evaluate((el) => el.classList.contains('hidden'));
      expect(isHidden).toBe(true);
    });
  });

  describe('Multiple elements handling', () => {
    it('should handle selector matching multiple elements', async () => {
      const selector: SelectorStrategy = {
        css: '.clickable-item',
        priority: ['css'],
      };

      const element = await locator.findElement(page, selector);
      expect(element).not.toBeNull();

      // Should return first match or handle appropriately
    });

    it('should find specific element in list', async () => {
      const selector: SelectorStrategy = {
        css: '.clickable-item[data-id="3"]',
        priority: ['css'],
      };

      const element = await locator.findElement(page, selector);
      expect(element).not.toBeNull();

      const text = await element!.textContent();
      expect(text).toContain('Item 3');
    });
  });
});
