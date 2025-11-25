import type { Page, Locator } from 'playwright';
import type { SelectorStrategy } from '../types/index.js';

/**
 * Locates elements using multi-strategy fallback approach
 */
export class ElementLocator {
  /**
   * Find element using selector strategy with priority fallback and retry logic
   */
  async findElement(page: Page, selector: SelectorStrategy): Promise<Locator> {
    const maxRetries = 3;
    const baseDelay = 500; // Start with 500ms

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // Try selectors in priority order
        for (const selectorType of selector.priority) {
          const selectorValue = selector[selectorType];

          if (!selectorValue) continue;

          try {
            const locator = this.getLocator(page, selectorType, selectorValue);

            // Check if element exists - use a very short timeout to fail fast
            const count = await locator.count();
            if (count > 0) {
              // Element found - wait for it to be stable before returning
              try {
                await locator.first().waitFor({ state: 'attached', timeout: 5000 });
                return locator.first();
              } catch (waitError) {
                // Element became detached, continue to next selector
                continue;
              }
            }
          } catch (error) {
            // Continue to next selector strategy
            continue;
          }
        }

        // If we get here, no selector worked - retry with exponential backoff
        if (attempt < maxRetries - 1) {
          const delay = baseDelay * Math.pow(2, attempt);
          await page.waitForTimeout(delay);
        }
      } catch (error) {
        // Retry on error
        if (attempt < maxRetries - 1) {
          const delay = baseDelay * Math.pow(2, attempt);
          await page.waitForTimeout(delay);
        }
      }
    }

    throw new Error(`Element not found with any selector strategy: ${JSON.stringify(selector)}`);
  }

  /**
   * Get Playwright locator based on selector type
   */
  private getLocator(page: Page, type: string, value: any): Locator {
    switch (type) {
      case 'id':
        // If ID not found, try parent button with ga4 ID
        if (value === 'search-submit-text') {
          return page.locator(`#${value}, #ga4_homepage_search_businesses_button`);
        }
        return page.locator(`#${value}`);

      case 'dataTestId':
        return page.getByTestId(value);

      case 'ariaLabel':
        return page.getByLabel(value);

      case 'name':
        return page.locator(`[name="${value}"]`);

      case 'css':
        // Special handling: if CSS selector ends with > span and contains button, try parent too
        if (value.includes('> span') && value.includes('button')) {
          const buttonSelector = value.replace(/\s*>\s*span$/, '');
          return page.locator(`${value}, ${buttonSelector}`);
        }
        return page.locator(value);

      case 'xpath':
      case 'xpathAbsolute':
        return page.locator(`xpath=${value}`);

      case 'text':
        return page.getByText(value, { exact: true });

      case 'textContains':
        return page.getByText(value);

      case 'position':
        // For position-based, we'll use parent selector + nth-child
        const { parent, index } = value;
        return page.locator(`${parent} > :nth-child(${index + 1})`);

      default:
        throw new Error(`Unknown selector type: ${type}`);
    }
  }
}
