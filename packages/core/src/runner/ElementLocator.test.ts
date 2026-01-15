import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ElementLocator } from './ElementLocator.js';
import type { SelectorStrategy } from '../types/selectors.js';
import type { Page, Locator } from 'playwright';

describe('ElementLocator', () => {
  let locator: ElementLocator;
  let mockPage: Page;
  let mockLocator: Locator;

  beforeEach(() => {
    locator = new ElementLocator();
    
    // Create mock locator with all required methods for findElementLegacy
    mockLocator = {
      count: vi.fn().mockResolvedValue(1),
      first: vi.fn().mockReturnThis(),
      waitFor: vi.fn().mockResolvedValue(undefined),
      isVisible: vi.fn().mockResolvedValue(true),  // Element is visible
    } as unknown as Locator;

    // Create mock page with all necessary methods
    mockPage = {
      locator: vi.fn().mockReturnValue(mockLocator),
      getByRole: vi.fn().mockReturnValue(mockLocator),
      getByLabel: vi.fn().mockReturnValue(mockLocator),
      getByTestId: vi.fn().mockReturnValue(mockLocator),
      getByText: vi.fn().mockReturnValue(mockLocator),
      waitForTimeout: vi.fn().mockResolvedValue(undefined),
      waitForLoadState: vi.fn().mockResolvedValue(undefined),
      keyboard: {
        press: vi.fn().mockResolvedValue(undefined),
      },
      evaluate: vi.fn().mockResolvedValue(undefined),
    } as unknown as Page;
  });

  describe('findElement', () => {
    it('should find element using id selector', async () => {
      const selector: SelectorStrategy = {
        id: 'test-button',
        priority: ['id'],
      };

      const result = await locator.findElement(mockPage, selector);

      expect(result).toBe(mockLocator);
      expect(mockPage.locator).toHaveBeenCalledWith('#test-button');
    });

    it('should find element using dataTestId selector', async () => {
      const selector: SelectorStrategy = {
        dataTestId: 'test-button',
        priority: ['dataTestId'],
      };

      const result = await locator.findElement(mockPage, selector);

      expect(result).toBe(mockLocator);
      expect(mockPage.getByTestId).toHaveBeenCalledWith('test-button');
    });

    it('should find element using ariaLabel selector', async () => {
      const selector: SelectorStrategy = {
        ariaLabel: 'Submit button',
        priority: ['ariaLabel'],
      };

      const result = await locator.findElement(mockPage, selector);

      expect(result).toBe(mockLocator);
      expect(mockPage.getByLabel).toHaveBeenCalledWith('Submit button');
    });

    it('should find element using name selector', async () => {
      const selector: SelectorStrategy = {
        name: 'email',
        priority: ['name'],
      };

      const result = await locator.findElement(mockPage, selector);

      expect(result).toBe(mockLocator);
      expect(mockPage.locator).toHaveBeenCalledWith('[name="email"]');
    });

    it('should find element using css selector', async () => {
      const selector: SelectorStrategy = {
        css: '.btn-primary',
        priority: ['css'],
      };

      const result = await locator.findElement(mockPage, selector);

      expect(result).toBe(mockLocator);
      expect(mockPage.locator).toHaveBeenCalledWith('.btn-primary');
    });

    it('should find element using xpath selector', async () => {
      const selector: SelectorStrategy = {
        xpath: '//button[@id="submit"]',
        priority: ['xpath'],
      };

      const result = await locator.findElement(mockPage, selector);

      expect(result).toBe(mockLocator);
      expect(mockPage.locator).toHaveBeenCalledWith('xpath=//button[@id="submit"]');
    });

    it('should find element using position selector', async () => {
      const selector: SelectorStrategy = {
        position: { parent: 'div.container', index: 1 },
        priority: ['position'],
      };

      const result = await locator.findElement(mockPage, selector);

      expect(result).toBe(mockLocator);
      expect(mockPage.locator).toHaveBeenCalledWith('div.container > :nth-child(2)');
    });

    it('should find element using text selector', async () => {
      const selector: SelectorStrategy = {
        text: 'Click here',
        priority: ['text'],
      };

      const result = await locator.findElement(mockPage, selector);

      expect(result).toBe(mockLocator);
      expect(mockPage.getByText).toHaveBeenCalledWith('Click here', { exact: true });
    });

    it('should fallback through priority list when first selector returns no elements', async () => {
      const selector: SelectorStrategy = {
        id: 'test-button',
        css: '.btn-submit',
        priority: ['id', 'css'],
      };

      // Mock first selector to return 0 count, second to succeed
      const failingLocator = {
        count: vi.fn().mockResolvedValue(0),
      } as unknown as Locator;

      const succeedingLocator = {
        count: vi.fn().mockResolvedValue(1),
        first: vi.fn().mockReturnThis(),
        waitFor: vi.fn().mockResolvedValue(undefined),
        isVisible: vi.fn().mockResolvedValue(true),
      } as unknown as Locator;

      (mockPage.locator as any)
        .mockReturnValueOnce(failingLocator)
        .mockReturnValueOnce(succeedingLocator);

      const result = await locator.findElement(mockPage, selector);

      expect(result).toBe(succeedingLocator);
      expect(mockPage.locator).toHaveBeenCalledTimes(2);
      expect(mockPage.locator).toHaveBeenNthCalledWith(1, '#test-button');
      expect(mockPage.locator).toHaveBeenNthCalledWith(2, '.btn-submit');
    });

    it('should retry with exponential backoff when element not found', async () => {
      const selector: SelectorStrategy = {
        id: 'test-button',
        priority: ['id'],
      };

      // Mock to fail twice (count = 0), then succeed
      const failingLocator = {
        count: vi.fn().mockResolvedValue(0),
      } as unknown as Locator;

      const succeedingLocator = {
        count: vi.fn().mockResolvedValue(1),
        first: vi.fn().mockReturnThis(),
        waitFor: vi.fn().mockResolvedValue(undefined),
        isVisible: vi.fn().mockResolvedValue(true),
      } as unknown as Locator;

      (mockPage.locator as any)
        .mockReturnValueOnce(failingLocator)
        .mockReturnValueOnce(failingLocator)
        .mockReturnValueOnce(succeedingLocator);

      const result = await locator.findElement(mockPage, selector);

      expect(result).toBe(succeedingLocator);
      // Should have waited with exponential backoff delays (500ms, 1000ms)
      // Plus possible recovery strategy delays (300ms)
      expect(mockPage.waitForTimeout).toHaveBeenCalledWith(500);
      expect(mockPage.waitForTimeout).toHaveBeenCalledWith(1000);
    });

    it('should throw error after max retries exceeded', async () => {
      const selector: SelectorStrategy = {
        id: 'missing-button',
        priority: ['id'],
      };

      const failingLocator = {
        count: vi.fn().mockResolvedValue(0),
      } as unknown as Locator;

      (mockPage.locator as any).mockReturnValue(failingLocator);

      await expect(locator.findElement(mockPage, selector)).rejects.toThrow(
        'Element not found with any selector strategy'
      );

      // Should wait between retries with exponential backoff delays
      expect(mockPage.waitForTimeout).toHaveBeenCalledWith(500);
      expect(mockPage.waitForTimeout).toHaveBeenCalledWith(1000);
    });

    it('should handle special fallback for search-submit-text to ga4 button', async () => {
      const selector: SelectorStrategy = {
        id: 'search-submit-text',
        priority: ['id'],
      };

      const result = await locator.findElement(mockPage, selector);

      expect(result).toBe(mockLocator);
      // Should try both IDs in a single selector
      expect(mockPage.locator).toHaveBeenCalledWith('#search-submit-text, #ga4_homepage_search_businesses_button');
    });
  });

  describe('edge cases', () => {
    it('should handle empty priority array', async () => {
      const selector: SelectorStrategy = {
        id: 'test-button',
        priority: [],
      };

      await expect(locator.findElement(mockPage, selector)).rejects.toThrow(
        'Element not found with any selector strategy'
      );
    });

    it('should handle selector with all strategy types', async () => {
      const selector: SelectorStrategy = {
        id: 'btn',
        dataTestId: 'test-btn',
        ariaLabel: 'Click me',
        name: 'submit',
        css: '.btn',
        xpath: '//button',
        position: { parent: 'form', index: 1 },
        text: 'Submit',
        priority: ['id'],
      };

      const result = await locator.findElement(mockPage, selector);

      expect(result).toBe(mockLocator);
      // Should use first priority (id)
      expect(mockPage.locator).toHaveBeenCalledWith('#btn');
    });

    it('should handle css selector with button > span pattern', async () => {
      const selector: SelectorStrategy = {
        css: 'button.submit > span',
        priority: ['css'],
      };

      const result = await locator.findElement(mockPage, selector);

      expect(result).toBe(mockLocator);
      // Should try both the span and the parent button
      expect(mockPage.locator).toHaveBeenCalledWith('button.submit > span, button.submit');
    });
  });
});
