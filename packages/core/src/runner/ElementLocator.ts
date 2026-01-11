import type { Page, Locator } from 'playwright';
import type { SelectorStrategy, SelectorWithMetadata, ContentSignature } from '../types/index.js';

/**
 * Locates elements using multi-strategy fallback approach with intelligent handling of multiple matches
 */
export class ElementLocator {
  /**
   * Find element using selector strategy with priority fallback and retry logic (LEGACY)
   * Enhanced with smart visibility recovery for hidden elements
   */
  async findElement(page: Page, selector: SelectorStrategy): Promise<Locator>;

  /**
   * Find element using Phase 2 multi-strategy selectors with priority and confidence
   */
  async findElement(
    page: Page,
    selectors: SelectorWithMetadata[],
    contentSignature?: ContentSignature
  ): Promise<Locator | null>;

  /**
   * Implementation supporting both legacy and Phase 2 signatures
   */
  async findElement(
    page: Page,
    selectorOrSelectors: SelectorStrategy | SelectorWithMetadata[],
    contentSignature?: ContentSignature
  ): Promise<Locator | null> {
    // Check if this is Phase 2 multi-strategy selector
    if (Array.isArray(selectorOrSelectors)) {
      return this.findElementWithMetadata(page, selectorOrSelectors, contentSignature);
    }

    // Legacy path - use existing logic
    return this.findElementLegacy(page, selectorOrSelectors);
  }

  /**
   * Phase 2: Find element with priority-sorted selectors and content signature fallback
   * Enhanced with retry logic for dynamically-loaded content
   */
  private async findElementWithMetadata(
    page: Page,
    selectors: SelectorWithMetadata[],
    contentSignature?: ContentSignature
  ): Promise<Locator | null> {
    // Sort by priority (ascending - lower priority number = higher priority)
    // **FIX: Always prefer CSS/xpath/semantic selectors over text-content for buttons**
    const sortedSelectors = [...selectors].sort((a, b) => {
      // Check if we're dealing with button-related selectors
      const aIsButtonCss =
        a.strategy === 'css' && typeof a.value === 'string' && a.value.includes('button');
      const bIsButtonCss =
        b.strategy === 'css' && typeof b.value === 'string' && b.value.includes('button');
      const aIsTextContent = a.strategy === 'text-content';
      const bIsTextContent = b.strategy === 'text-content';

      // Always prioritize button CSS over text-content
      if (aIsButtonCss && bIsTextContent) {
        console.log(`  🎯 Boosting button CSS selector over text-content`);
        return -1; // A comes first
      }
      if (bIsButtonCss && aIsTextContent) {
        console.log(`  🎯 Boosting button CSS selector over text-content`);
        return 1; // B comes first
      }

      // For button clicks, also prefer css-semantic over text-content
      const aIsCssSemantic = a.strategy === 'css-semantic';
      const bIsCssSemantic = b.strategy === 'css-semantic';

      if (aIsCssSemantic && bIsTextContent) {
        console.log(`  🎯 Boosting css-semantic over text-content`);
        return -1;
      }
      if (bIsCssSemantic && aIsTextContent) {
        console.log(`  🎯 Boosting css-semantic over text-content`);
        return 1;
      }

      // Otherwise use normal priority sorting
      return a.priority - b.priority;
    });

    console.log(`🔍 Trying ${sortedSelectors.length} selector strategies in priority order...`);

    // **FIX #1: Retry with exponential backoff for dynamic content**
    const maxRetries = 3;
    const retryDelays = [1000, 2000, 3000]; // 1s, 2s, 3s

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      // Try each selector in priority order
      for (const selector of sortedSelectors) {
        try {
          const locator = await this.getLocatorByStrategy(page, selector);

          // Check if element exists
          const count = await locator.count();

          if (count === 0) {
            if (attempt === 0) {
              console.log(`✗ ${selector.strategy} (priority ${selector.priority}): not found`);
            }
            continue;
          }

          // For high-confidence selectors, ensure single match
          if (selector.confidence >= 80) {
            if (count === 1) {
              console.log(
                `✓ Found using ${selector.strategy} (priority ${selector.priority}, confidence ${selector.confidence}%)`
              );
              await locator.waitFor({ state: 'attached', timeout: 5000 });
              return locator;
            } else {
              console.log(
                `⚠️ ${selector.strategy} matched ${count} elements (too many for high confidence ${selector.confidence}%)`
              );
              continue;
            }
          } else {
            // Lower confidence - accept first match
            console.log(
              `⚠️ Found using ${selector.strategy} (priority ${selector.priority}, low confidence ${selector.confidence}%)`
            );
            await locator.first().waitFor({ state: 'attached', timeout: 5000 });
            return locator.first();
          }
        } catch (error: any) {
          if (attempt === 0) {
            console.log(`✗ ${selector.strategy} failed: ${error.message?.split('\n')[0]}`);
          }
          continue;
        }
      }

      // If not found on this attempt and we have retries left
      if (attempt < maxRetries) {
        const delay = retryDelays[attempt];
        console.log(
          `⏳ Element not found, waiting ${delay}ms for dynamic content to load (attempt ${attempt + 1}/${maxRetries})...`
        );
        await page.waitForTimeout(delay);

        // Also wait for any pending network requests
        try {
          await page.waitForLoadState('networkidle', { timeout: 3000 });
        } catch {
          // Network might not settle, continue anyway
        }
      }
    }

    // Fallback: Try content signature if available
    if (contentSignature) {
      console.log('⚡ Trying content signature fallback...');
      const result = await this.findByContentSignature(page, contentSignature);
      if (result) {
        return result;
      }
    }

    // Element not found - return null instead of throwing
    console.warn(`⚠️ Element not found after trying ${sortedSelectors.length} strategies`);
    return null;
  }

  /**
   * Phase 2: Get Playwright locator based on selector strategy and value
   * **FIX #2: Respect context scoping for more precise element matching**
   */
  private async getLocatorByStrategy(page: Page, selector: SelectorWithMetadata): Promise<Locator> {
    switch (selector.strategy) {
      case 'id':
        return page.locator(`#${selector.value}`);

      case 'aria-label':
        return page.getByLabel(selector.value);

      case 'name':
        return page.locator(`[name="${selector.value}"]`);

      case 'text-content':
        // **FIX: Use context to scope text search**
        if ((selector as any).context) {
          const context = (selector as any).context;
          // Search within context container (e.g., .swal2-actions, .modal-body, etc.)
          return page.locator(`.${context}`).getByText(selector.value, { exact: false });
        }
        return page.getByText(selector.value, { exact: false });

      case 'css-semantic':
        // **FIX: Handle Playwright's :has-text() pseudo-selector**
        // Convert recorder's css-semantic to Playwright's locator syntax
        return page.locator(selector.value);

      case 'href-pattern':
        // **FIX: Handle href pattern matching for links**
        return page.locator(`a[href*="${selector.value}"]`);

      case 'src-pattern':
        // Match images with src containing pattern
        return page.locator(`img[src*="${selector.value}"]`);

      case 'css':
        return page.locator(selector.value);

      case 'xpath':
        return page.locator(`xpath=${selector.value}`);

      case 'position':
        // Position-based selector
        if (typeof selector.value === 'string') {
          // Handle string format: "parent > :nth-child(n)"
          return page.locator(selector.value);
        } else {
          // Handle object format: { parent, index }
          const { parent, index } = selector.value as { parent: string; index: number };
          return page.locator(`${parent} > :nth-child(${index + 1})`);
        }

      default:
        throw new Error(`Unknown selector strategy: ${selector.strategy}`);
    }
  }

  /**
   * Phase 2: Find element by content signature
   */
  private async findByContentSignature(
    page: Page,
    signature: ContentSignature
  ): Promise<Locator | null> {
    const { elementType, contentFingerprint } = signature;

    // Build content-based locators
    const attempts: { selector: string; description: string }[] = [];

    if (contentFingerprint.heading) {
      attempts.push({
        selector: `${elementType}:has-text("${contentFingerprint.heading}")`,
        description: `heading "${contentFingerprint.heading}"`,
      });
    }

    if (contentFingerprint.linkHref) {
      attempts.push({
        selector: `a[href*="${contentFingerprint.linkHref}"]`,
        description: `link with href containing "${contentFingerprint.linkHref}"`,
      });
    }

    if (contentFingerprint.imageSrc) {
      attempts.push({
        selector: `img[src*="${contentFingerprint.imageSrc}"]`,
        description: `image with src containing "${contentFingerprint.imageSrc}"`,
      });
    }

    if (contentFingerprint.price) {
      attempts.push({
        selector: `${elementType}:has-text("${contentFingerprint.price}")`,
        description: `price "${contentFingerprint.price}"`,
      });
    }

    // Try each content selector
    for (const attempt of attempts) {
      try {
        const locator = page.locator(attempt.selector);
        const count = await locator.count();

        if (count > 0) {
          console.log(`✓ Found by content: ${attempt.description}`);
          await locator.first().waitFor({ state: 'attached', timeout: 5000 });
          return locator.first();
        }
      } catch (error) {
        continue;
      }
    }

    // Try fallback position if available
    if (signature.fallbackPosition !== undefined && signature.listContainer) {
      try {
        const locator = page.locator(
          `${signature.listContainer} > ${elementType}:nth-child(${signature.fallbackPosition + 1})`
        );
        const count = await locator.count();

        if (count > 0) {
          console.log(
            `⚠️ Using fallback position ${signature.fallbackPosition} in ${signature.listContainer}`
          );
          await locator.waitFor({ state: 'attached', timeout: 5000 });
          return locator;
        }
      } catch (error) {
        // Fallback position didn't work
      }
    }

    return null;
  }

  /**
   * Legacy implementation - maintains backward compatibility
   */
  private async findElementLegacy(page: Page, selector: SelectorStrategy): Promise<Locator> {
    const maxRetries = 3;
    const baseDelay = 500;

    // DEBUG: Log what we're looking for
    console.log(`\n🔍 [DEBUG] Searching for element with ${selector.priority.length} strategies:`);
    console.log(`   CSS: ${selector.css?.substring(0, 80)}...`);
    console.log(`   Has validation: ${!!(selector as any).validation}`);
    console.log(`   cssMatches from recording: ${(selector as any).validation?.cssMatches}`);

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      if (attempt > 0) {
        console.log(`   🔄 Retry attempt ${attempt + 1}/${maxRetries}`);
      }

      try {
        // Try selectors in priority order
        for (const selectorType of selector.priority) {
          const selectorValue = (selector as any)[selectorType];
          if (!selectorValue) continue;

          try {
            const locator = this.getLocator(page, selectorType, selectorValue);
            const count = await locator.count();

            console.log(`   [${selectorType}] Matched ${count} elements`);

            if (count === 1) {
              // Perfect match - single element found
              await locator.waitFor({ state: 'attached', timeout: 5000 });

              // Solution 2: Check if element is hidden and try to make it visible
              const isVisible = await locator.isVisible().catch(() => false);
              if (!isVisible) {
                const madeVisible = await this.attemptVisibilityRecovery(page, locator, selector);
                if (madeVisible) {
                  console.log(`✓ Successfully made hidden element visible`);
                  return locator;
                }
                console.warn(`⚠️ Element found but hidden, attempting interaction anyway`);
              }

              return locator;
            } else if (count > 1) {
              // Multiple matches - use intelligent filtering
              return await this.handleMultipleMatches(page, locator, selector, count);
            }
          } catch (error) {
            // Continue to next selector strategy
            continue;
          }
        }

        // No selector worked - apply recovery strategies based on attempt
        if (attempt < maxRetries - 1) {
          await this.applyRecoveryStrategy(page, attempt);
          const delay = baseDelay * Math.pow(2, attempt);
          await page.waitForTimeout(delay);
        }
      } catch (error) {
        if (attempt < maxRetries - 1) {
          const delay = baseDelay * Math.pow(2, attempt);
          await page.waitForTimeout(delay);
        }
      }
    }

    throw new Error(`Element not found with any selector strategy: ${JSON.stringify(selector)}`);
  }

  /**
   * Handle cases where selector matches multiple elements
   */
  private async handleMultipleMatches(
    page: Page,
    locator: Locator,
    selector: SelectorStrategy,
    count: number
  ): Promise<Locator> {
    // Strategy 1: Try text filtering if available
    if (selector.textContains && selector.textContains.length > 3) {
      const filtered = locator.filter({ hasText: selector.textContains });
      const filteredCount = await filtered.count();

      if (filteredCount === 1) {
        console.log(`✓ Filtered ${count} elements to 1 using text: "${selector.textContains}"`);
        await filtered.waitFor({ state: 'attached', timeout: 5000 });
        return filtered;
      } else if (filteredCount > 0 && filteredCount < count) {
        // Reduced matches, use first visible of filtered
        const visibleFiltered = await this.getFirstVisibleElement(page, filtered, filteredCount);
        if (visibleFiltered) {
          console.warn(
            `⚠️ Text filter reduced ${count} to ${filteredCount} elements, using first visible`
          );
          return visibleFiltered;
        }
        console.warn(`⚠️ Text filter reduced ${count} to ${filteredCount} elements, using first`);
        await filtered.first().waitFor({ state: 'attached', timeout: 5000 });
        return filtered.first();
      }
    } // Strategy 2: Check if this is an autocomplete/dropdown scenario
    // BUT EXCLUDE carousel controls and elements with validated unique selectors
    const hasCarouselIndicators =
      selector.css?.includes('carousel') ||
      selector.css?.includes('arrow') ||
      selector.css?.includes('.next') ||
      selector.css?.includes('.prev') ||
      selector.css?.includes('slide') ||
      selector.css?.includes('swiper');

    const hasValidatedUniqueSelector =
      (selector as any).validation?.cssMatches === 1 &&
      (selector as any).validation?.isUnique === true;

    const isAutocomplete =
      !hasCarouselIndicators && // Don't treat carousels as autocomplete
      !hasValidatedUniqueSelector && // Trust validated unique selectors
      (selector.css?.includes('autocomplete') ||
        selector.css?.includes('dropdown') ||
        selector.css?.includes('suggestion') ||
        selector.css?.includes('menu-item') ||
        (selector.css?.includes('ul') && selector.css?.includes('li')));

    if (isAutocomplete) {
      // Try to find first visible element
      const visibleElement = await this.getFirstVisibleElement(page, locator, count);
      if (visibleElement) {
        console.warn(
          `⚠️ Autocomplete/dropdown matched ${count} items, ${count} total, using first visible`
        );
        return visibleElement;
      }
      console.warn(`⚠️ Autocomplete/dropdown matched ${count} items, selecting first item`);
      await locator.first().waitFor({ state: 'attached', timeout: 5000 });
      return locator.first();
    } // Strategy 3: Check if selector has position info
    if (selector.position && selector.position.index !== undefined) {
      const { parent, index } = selector.position;
      const positioned = page.locator(`${parent} > *:nth-child(${index + 1})`);
      const posCount = await positioned.count();

      if (posCount > 0) {
        console.log(`✓ Using position-based selector (index ${index})`);
        await positioned.waitFor({ state: 'attached', timeout: 5000 });
        return positioned;
      }
    }

    // Strategy 4: Last resort - try visible elements first
    const visibleElement = await this.getFirstVisibleElement(page, locator, count);
    if (visibleElement) {
      console.warn(`⚠️ Ambiguous selector matched ${count} elements, using first visible`);
      return visibleElement;
    }

    // Absolute last resort - use first element even if hidden
    console.warn(
      `⚠️ Ambiguous selector matched ${count} elements, using first match (may be hidden)`
    );
    await locator.first().waitFor({ state: 'attached', timeout: 5000 });
    return locator.first();
  }

  /**
   * Get first visible element from a locator with multiple matches
   */
  private async getFirstVisibleElement(
    _page: Page,
    locator: Locator,
    count: number
  ): Promise<Locator | null> {
    try {
      // Check each element for visibility
      for (let i = 0; i < count && i < 10; i++) {
        // Check max 10 elements
        const element = locator.nth(i);
        const isVisible = await element.isVisible().catch(() => false);

        if (isVisible) {
          await element.waitFor({ state: 'attached', timeout: 5000 });
          return element;
        }
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Solution 2: Attempt to make hidden element visible by interacting with parent
   * Enhanced with deep parent chain analysis and progressive interaction
   */
  private async attemptVisibilityRecovery(
    page: Page,
    locator: Locator,
    _selector: SelectorStrategy
  ): Promise<boolean> {
    try {
      console.log(`🔍 Attempting to make hidden element visible...`);

      // Level 1: Deep parent chain analysis (up to 5 levels)
      const trigger = await this.analyzeDeepParentChain(page, locator);

      if (trigger && trigger.confidence !== 'low') {
        console.log(
          `✓ Found ${trigger.interactionType} trigger at level ${trigger.level} (confidence: ${trigger.confidence})`
        );

        // Try progressive interaction (hover then click with transition waiting)
        const success = await this.tryProgressiveInteraction(
          page,
          trigger.triggerElement!,
          locator
        );
        if (success) {
          return true;
        }
      }

      // Level 2: Try multiple ancestor levels with simple approach
      console.log('   → Trying multiple parent levels...');
      for (let level = 1; level <= 3; level++) {
        const parent = await this.getParentAtLevel(page, locator, level);
        if (parent) {
          const parentVisible = await parent.isVisible().catch(() => false);
          if (!parentVisible) continue;

          // Try hover
          await parent.hover({ timeout: 2000 }).catch(() => {});
          await this.waitForTransitions(page, 500);

          let nowVisible = await locator.isVisible().catch(() => false);
          if (nowVisible) {
            console.log(`✓ Element became visible after hovering parent (level ${level})`);
            return true;
          }

          // Try click
          await parent.click({ timeout: 2000 }).catch(() => {});
          await this.waitForTransitions(page, 500);

          nowVisible = await locator.isVisible().catch(() => false);
          if (nowVisible) {
            console.log(`✓ Element became visible after clicking parent (level ${level})`);
            return true;
          }
        }
      }

      // Level 3: Alternative interactions (keyboard, scroll)
      console.log('   → Trying alternative interactions...');
      const altSuccess = await this.tryAlternativeInteractions(page, locator);
      if (altSuccess) {
        return true;
      }

      // Level 4: Report clear failure (NO FORCE CLICK - keeping realistic behavior)
      console.log('⚠️ Cannot make element visible using realistic interactions');
      return false;
    } catch (error) {
      return false;
    }
  }

  /**
   * Apply recovery strategies between retry attempts
   */
  private async applyRecoveryStrategy(page: Page, attempt: number): Promise<void> {
    try {
      switch (attempt) {
        case 0:
          // First retry: Wait for network to be idle
          await page.waitForLoadState('networkidle', { timeout: 2000 }).catch(() => {});
          break;

        case 1:
          // Second retry: Dismiss any overlays (ESC key)
          await page.keyboard.press('Escape');
          await page.waitForTimeout(300);
          break;

        case 2:
          // Third retry: Scroll down to potentially load lazy content
          await page.evaluate(() => (globalThis as any).window.scrollBy(0, 300));
          await page.waitForTimeout(300);
          break;
      }
    } catch {
      // Recovery strategy failed, continue anyway
    }
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

        // Special handling: Modal library selectors (SweetAlert, Bootstrap, etc.)
        // If selector has complex parent chain with modal classes, add simpler fallback
        const modalPatterns = ['.swal2-', '.modal-', '.sweetalert-', '.dialog-', '.popup-'];
        const hasModalPattern = modalPatterns.some((pattern) => value.includes(pattern));
        const hasParentChain = value.includes('>');

        if (hasModalPattern && hasParentChain) {
          // Extract the final target selector (after last >)
          const parts = value.split('>').map((p: string) => p.trim());
          const targetSelector = parts[parts.length - 1];

          // Also create more lenient parent selectors (SweetAlert adds dynamic classes)
          // Example: div.swal2-container.swal2-center becomes div.swal2-container
          const lenientParts = parts.map((part: string) => {
            // If part has swal2-container, keep only the base class
            if (part.includes('.swal2-container')) {
              return 'div.swal2-container';
            }
            // If part has swal2-popup, keep only base class
            if (part.includes('.swal2-popup')) {
              return 'div.swal2-popup';
            }
            return part;
          });
          const lenientSelector = lenientParts.join(' > ');

          // Create multiple fallbacks: original OR lenient parent chain OR simple target
          console.log(`🔍 Modal selector with fallbacks: ${targetSelector}`);
          return page.locator(`${value}, ${lenientSelector}, ${targetSelector}`);
        }

        return page.locator(value);

      case 'xpath':
        return page.locator(`xpath=${value}`);

      case 'xpathAbsolute':
        // For absolute XPath, check if it's a modal element and prefer simpler strategies
        // Absolute XPath is fragile for dynamic modals
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

  /**
   * Analyze deep parent chain (up to 5 levels) to find interactive trigger elements
   */
  private async analyzeDeepParentChain(
    _page: Page,
    locator: Locator
  ): Promise<{
    triggerElement: string | null;
    interactionType: 'hover' | 'click';
    confidence: 'high' | 'medium' | 'low';
    level: number;
  } | null> {
    try {
      // Evaluate parent chain up to 5 levels
      const parentAnalysis = await locator.evaluate((element: any) => {
        const results = [];
        let current = element.parentElement;
        let level = 1;

        while (current && level <= 5) {
          // @ts-ignore - window is available in browser context
          const styles = window.getComputedStyle(current);
          const classes = current.className || '';
          const role = current.getAttribute('role') || '';
          const tagName = current.tagName.toLowerCase();

          // Check visibility
          const isVisible =
            styles.display !== 'none' && styles.visibility !== 'hidden' && styles.opacity !== '0';

          // Check for menu/dropdown patterns
          const hasMenuPattern = /menu|dropdown|accordion|tab|popover|nav/i.test(
            classes + role + tagName
          );

          // Check for interactive indicators
          const hasClickHandler =
            current.onclick ||
            current.getAttribute('onclick') ||
            /button|link|trigger/i.test(classes + role);

          // Build CSS selector for this parent
          const id = current.id ? `#${current.id}` : '';
          const classNames = classes
            .split(' ')
            .filter((c: string) => c.trim())
            .slice(0, 3)
            .join('.');
          const selector = `${tagName}${id}${classNames ? '.' + classNames : ''}`;

          // Calculate confidence score
          let confidence = 0;
          if (hasMenuPattern) confidence += 3;
          if (hasClickHandler) confidence += 2;
          if (isVisible) confidence += 1;
          if (level === 1) confidence += 1; // Prefer closer parents

          results.push({
            level,
            selector,
            isVisible,
            hasMenuPattern,
            hasClickHandler,
            confidence,
          });

          current = current.parentElement;
          level++;
        }

        return results;
      });

      // Find best trigger candidate
      const candidates = parentAnalysis
        .filter((p: any) => p.isVisible && p.confidence > 0)
        .sort((a: any, b: any) => b.confidence - a.confidence);

      if (candidates.length === 0) {
        return null;
      }

      const best = candidates[0];

      return {
        triggerElement: best.selector,
        interactionType: best.hasMenuPattern ? 'hover' : 'click',
        confidence: best.confidence >= 5 ? 'high' : best.confidence >= 3 ? 'medium' : 'low',
        level: best.level,
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Wait for CSS transitions to complete
   */
  private async waitForTransitions(page: Page, maxWait: number): Promise<void> {
    try {
      await Promise.race([
        // Wait for transitionend event
        page.evaluate(() => {
          return new Promise<void>((resolve) => {
            const handler = () => {
              // @ts-ignore - document is available in browser context
              document.removeEventListener('transitionend', handler);
              resolve();
            };
            // @ts-ignore - document is available in browser context
            document.addEventListener('transitionend', handler);
            // Fallback in case no transitions occur
            setTimeout(() => {
              // @ts-ignore - document is available in browser context
              document.removeEventListener('transitionend', handler);
              resolve();
            }, 1000);
          });
        }),
        // Or timeout
        page.waitForTimeout(maxWait),
      ]);
    } catch (error) {
      // Ignore errors, just wait the timeout
      await page.waitForTimeout(500);
    }
  }

  /**
   * Try progressive interaction with parent element (hover then click)
   */
  private async tryProgressiveInteraction(
    page: Page,
    triggerSelector: string,
    targetLocator: Locator
  ): Promise<boolean> {
    try {
      const trigger = page.locator(triggerSelector).first();

      // Check if trigger is visible
      const triggerVisible = await trigger.isVisible().catch(() => false);
      if (!triggerVisible) {
        return false;
      }

      // Strategy 1: Hover and wait for transitions
      console.log(`   → Hovering on trigger: ${triggerSelector}`);
      await trigger.hover({ timeout: 3000 });
      await this.waitForTransitions(page, 2000);

      // Check if target is now visible
      let nowVisible = await targetLocator.isVisible().catch(() => false);
      if (nowVisible) {
        console.log(`✓ Target became visible after hover`);
        return true;
      }

      // Strategy 2: Click trigger and wait
      console.log(`   → Clicking trigger: ${triggerSelector}`);
      await trigger.click({ timeout: 3000 });
      await this.waitForTransitions(page, 2000);

      // Check again
      nowVisible = await targetLocator.isVisible().catch(() => false);
      if (nowVisible) {
        console.log(`✓ Target became visible after click`);
        return true;
      }

      return false;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get parent element at specific level
   */
  private async getParentAtLevel(
    page: Page,
    locator: Locator,
    level: number
  ): Promise<Locator | null> {
    try {
      const parentSelector = await locator.evaluate((element: any, lvl: number) => {
        let current = element;
        for (let i = 0; i < lvl; i++) {
          if (!current.parentElement) return null;
          current = current.parentElement;
        }

        // Build CSS selector
        const tagName = current.tagName.toLowerCase();
        const id = current.id ? `#${current.id}` : '';
        const classes = (current.className || '')
          .split(' ')
          .filter((c: string) => c.trim())
          .slice(0, 3)
          .join('.');

        return `${tagName}${id}${classes ? '.' + classes : ''}`;
      }, level);

      if (!parentSelector) return null;

      return page.locator(parentSelector).first();
    } catch (error) {
      return null;
    }
  }

  /**
   * Try alternative interaction methods (keyboard, scroll, etc.)
   */
  private async tryAlternativeInteractions(page: Page, locator: Locator): Promise<boolean> {
    try {
      // Try Tab navigation
      console.log(`   → Trying keyboard navigation (Tab)`);
      for (let i = 0; i < 5; i++) {
        await page.keyboard.press('Tab');
        await page.waitForTimeout(200);

        const visible = await locator.isVisible().catch(() => false);
        if (visible) {
          console.log(`✓ Element became visible after Tab navigation`);
          return true;
        }
      }

      // Try scrolling into view
      console.log(`   → Trying scroll into view`);
      await locator.scrollIntoViewIfNeeded({ timeout: 2000 });
      await page.waitForTimeout(500);

      const visible = await locator.isVisible().catch(() => false);
      if (visible) {
        console.log(`✓ Element became visible after scrolling`);
        return true;
      }

      return false;
    } catch (error) {
      return false;
    }
  }
}
