import type { Page } from 'playwright';

/**
 * Tracks navigation history to enable intelligent back/forward navigation
 */
export class NavigationHistoryManager {
  private historyStack: string[] = [];
  private currentIndex: number = -1;

  /**
   * Record a navigation to the history stack
   */
  recordNavigation(url: string): void {
    // If we're not at the end of history, clear forward history
    if (this.currentIndex < this.historyStack.length - 1) {
      this.historyStack = this.historyStack.slice(0, this.currentIndex + 1);
    }

    // Add new URL to history
    this.historyStack.push(url);
    this.currentIndex = this.historyStack.length - 1;

    console.log(`📚 History: [${this.currentIndex}] ${url} (total: ${this.historyStack.length})`);
  }

  /**
   * Determine optimal navigation strategy for target URL
   */
  getNavigationStrategy(targetUrl: string): {
    method: 'goBack' | 'goForward' | 'goto';
    distance: number;
  } {
    // Check if target URL exists in history
    const targetIndex = this.historyStack.lastIndexOf(targetUrl);

    if (targetIndex === -1) {
      // URL not in history - must use goto
      return { method: 'goto', distance: 0 };
    }

    const distance = targetIndex - this.currentIndex;

    if (distance === 0) {
      // Already on target URL
      return { method: 'goto', distance: 0 };
    } else if (distance < 0) {
      // Target is behind us in history - go back
      return { method: 'goBack', distance: Math.abs(distance) };
    } else {
      // Target is ahead in history - go forward
      return { method: 'goForward', distance };
    }
  }

  /**
   * Execute navigation using optimal strategy
   */
  async navigate(
    page: Page,
    targetUrl: string,
    timeout: number = 30000
  ): Promise<{ success: boolean; method: string }> {
    const strategy = this.getNavigationStrategy(targetUrl);

    try {
      if (strategy.method === 'goBack') {
        console.log(`🔙 Going back ${strategy.distance} step(s) to ${targetUrl}`);

        // Go back multiple times if needed
        for (let i = 0; i < strategy.distance; i++) {
          try {
            // Use commit instead of load/domcontentloaded for cached pages
            await page.goBack({ waitUntil: 'commit', timeout: 5000 });
          } catch (backError: any) {
            // If goBack times out, check if URL actually changed
            console.warn(`⚠️ goBack() timeout, checking if navigation succeeded...`);
            const currentUrl = page.url();
            
            // If we're on a different URL, consider it successful
            if (currentUrl !== this.historyStack[this.currentIndex]) {
              console.log(`✓ URL changed to ${currentUrl}, continuing`);
            } else {
              // goBack truly failed, use fallback
              throw backError;
            }
          }
          this.currentIndex--;
        }

        // Verify we reached the target
        const afterUrl = page.url();
        if (afterUrl === 'about:blank' || !this.urlsMatch(afterUrl, targetUrl)) {
          console.warn(`⚠️ goBack() didn't reach target, using direct navigation`);
          await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout });
          this.recordNavigation(targetUrl);
          return { success: true, method: 'goto-fallback' };
        }

        // Wait for page to be interactive (short timeout, best effort)
        await page.waitForLoadState('domcontentloaded', { timeout: 3000 }).catch(() => {});
        return { success: true, method: 'goBack' };
      } else if (strategy.method === 'goForward') {
        console.log(`🔜 Going forward ${strategy.distance} step(s) to ${targetUrl}`);

        // Go forward multiple times if needed
        for (let i = 0; i < strategy.distance; i++) {
          await page.goForward({ waitUntil: 'domcontentloaded', timeout: 10000 });
          this.currentIndex++;
        }

        // Verify we reached the target
        const afterUrl = page.url();
        if (afterUrl === 'about:blank' || !this.urlsMatch(afterUrl, targetUrl)) {
          console.warn(`⚠️ goForward() didn't reach target, using direct navigation`);
          await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout });
          this.recordNavigation(targetUrl);
          return { success: true, method: 'goto-fallback' };
        }

        await page.waitForLoadState('networkidle', { timeout: 3000 }).catch(() => {});
        return { success: true, method: 'goForward' };
      } else {
        // Use direct navigation
        console.log(`➡️ Direct navigation to ${targetUrl}`);
        await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout });
        this.recordNavigation(targetUrl);
        await page.waitForLoadState('networkidle', { timeout: 3000 }).catch(() => {});
        return { success: true, method: 'goto' };
      }
    } catch (error: any) {
      console.error(`❌ Navigation failed: ${error.message}`);
      // Final fallback - always try goto
      try {
        await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout });
        this.recordNavigation(targetUrl);
        return { success: true, method: 'goto-error-fallback' };
      } catch (gotoError) {
        return { success: false, method: 'all-failed' };
      }
    }
  }

  /**
   * Get current position in history
   */
  getCurrentUrl(): string | null {
    if (this.currentIndex >= 0 && this.currentIndex < this.historyStack.length) {
      return this.historyStack[this.currentIndex];
    }
    return null;
  }

  /**
   * Check if two URLs match (hostname + pathname)
   */
  private urlsMatch(url1: string, url2: string): boolean {
    try {
      const u1 = new URL(url1);
      const u2 = new URL(url2);
      return u1.hostname === u2.hostname && u1.pathname === u2.pathname;
    } catch {
      return url1 === url2;
    }
  }
}
