import type { Page, Locator } from 'playwright';
import type { SelectorStrategy } from '../types/index.js';

/**
 * Locates elements using multi-strategy fallback approach
 */
export class ElementLocator {
  /**
   * Find element using selector strategy with priority fallback
   */
  async findElement(page: Page, selector: SelectorStrategy): Promise<Locator> {
    // Try selectors in priority order
    for (const selectorType of selector.priority) {
      const selectorValue = selector[selectorType];

      if (!selectorValue) continue;

      try {
        const locator = this.getLocator(page, selectorType, selectorValue);

        // Check if element exists
        const count = await locator.count();
        if (count > 0) {
          return locator;
        }
      } catch (error) {
        // Continue to next selector strategy
        continue;
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
        return page.locator(`#${value}`);

      case 'dataTestId':
        return page.getByTestId(value);

      case 'ariaLabel':
        return page.getByLabel(value);

      case 'name':
        return page.locator(`[name="${value}"]`);

      case 'css':
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
