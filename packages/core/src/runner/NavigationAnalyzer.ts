import type { Action, Recording } from '../types/index.js';

/**
 * Analyzes navigation actions to determine real navigation type
 */
export class NavigationAnalyzer {
  /**
   * Analyze navigation action to determine real trigger type
   */
  analyzeNavigation(
    navigationAction: any,
    previousAction: Action | undefined,
    _recording: Recording,
    _actionIndex: number
  ): {
    realTrigger: 'back' | 'forward' | 'form-submit' | 'link-click' | 'redirect' | 'unknown';
    confidence: 'high' | 'medium' | 'low';
    reason: string;
  } {
    const fromUrl = navigationAction.from;
    const toUrl = navigationAction.to || navigationAction.url;

    // Analysis 1: Check previous action
    if (previousAction) {
      const timeDiff = navigationAction.timestamp - previousAction.timestamp;

      // If previous action was form submit (within 2 seconds)
      if (previousAction.type === 'submit' && timeDiff < 2000) {
        return {
          realTrigger: 'form-submit',
          confidence: 'high',
          reason: 'Previous action was form submit',
        };
      }

      // If previous action was click on link/button (within 2 seconds)
      if (previousAction.type === 'click' && timeDiff < 2000) {
        const clickSelector = (previousAction as any).selector;

        // Check if clicked element is a link
        if (
          clickSelector?.css?.includes('<a') ||
          clickSelector?.tagName === 'a' ||
          clickSelector?.css?.includes('href')
        ) {
          return {
            realTrigger: 'link-click',
            confidence: 'high',
            reason: 'Previous action was click on link',
          };
        }

        return {
          realTrigger: 'link-click',
          confidence: 'medium',
          reason: 'Previous action was click (likely triggered navigation)',
        };
      }
    }

    // Analysis 2: URL pattern analysis
    const urlRelationship = this.analyzeUrlRelationship(fromUrl, toUrl);

    if (urlRelationship === 'parent-to-child') {
      return {
        realTrigger: 'link-click',
        confidence: 'high',
        reason: 'URL moved deeper into site hierarchy (forward navigation)',
      };
    }

    if (urlRelationship === 'child-to-parent') {
      return {
        realTrigger: 'back',
        confidence: 'medium',
        reason: 'URL moved up in site hierarchy (likely back button)',
      };
    }

    if (urlRelationship === 'same-level') {
      return {
        realTrigger: 'link-click',
        confidence: 'low',
        reason: 'URL at same hierarchy level (likely link click)',
      };
    }

    // Analysis 3: Check if there's NO previous action (gap in timeline)
    if (!previousAction || navigationAction.timestamp - previousAction.timestamp > 3000) {
      return {
        realTrigger: 'back',
        confidence: 'medium',
        reason: 'No recent action triggered this (likely browser button)',
      };
    }

    // Default: Unknown
    return {
      realTrigger: 'unknown',
      confidence: 'low',
      reason: 'Could not determine navigation trigger',
    };
  }

  /**
   * Analyze URL relationship (parent/child/sibling)
   */
  private analyzeUrlRelationship(
    fromUrl: string,
    toUrl: string
  ): 'parent-to-child' | 'child-to-parent' | 'same-level' | 'different-domain' {
    try {
      const from = new URL(fromUrl);
      const to = new URL(toUrl);

      // Different domains
      if (from.hostname !== to.hostname) {
        return 'different-domain';
      }

      const fromParts = from.pathname.split('/').filter((p) => p);
      const toParts = to.pathname.split('/').filter((p) => p);

      // Parent to child: /search/ → /search/detail/123
      if (toParts.length > fromParts.length) {
        const isChild = fromParts.every((part, i) => part === toParts[i]);
        if (isChild) return 'parent-to-child';
      }

      // Child to parent: /search/detail/123 → /search/
      if (fromParts.length > toParts.length) {
        const isParent = toParts.every((part, i) => part === fromParts[i]);
        if (isParent) return 'child-to-parent';
      }

      // Same level
      return 'same-level';
    } catch {
      return 'same-level';
    }
  }

  /**
   * Pre-process recording to detect and correct mislabeled navigations
   */
  preprocessRecording(recording: Recording): {
    correctedActions: Action[];
    warnings: string[];
  } {
    const correctedActions: Action[] = [];
    const warnings: string[] = [];

    for (let i = 0; i < recording.actions.length; i++) {
      const action = recording.actions[i];

      // Only process navigation actions
      if (action.type !== 'navigation') {
        correctedActions.push(action);
        continue;
      }

      const navAction = action as any;
      const previousAction = i > 0 ? recording.actions[i - 1] : undefined;

      // Analyze the navigation
      const analysis = this.analyzeNavigation(navAction, previousAction, recording, i);

      // Check if extension's label matches our analysis
      const extensionTrigger = navAction.navigationTrigger;

      if (analysis.confidence === 'high' && extensionTrigger !== analysis.realTrigger) {
        warnings.push(
          `[${action.id}] Navigation mislabeled: Extension says "${extensionTrigger}", but analysis indicates "${analysis.realTrigger}" (${analysis.reason})`
        );

        // Correct the trigger
        const correctedAction = {
          ...navAction,
          navigationTrigger: analysis.realTrigger,
          _originalTrigger: extensionTrigger,
          _correctionReason: analysis.reason,
        };

        correctedActions.push(correctedAction);
      } else {
        correctedActions.push(action);
      }
    }

    return { correctedActions, warnings };
  }

  /**
   * Detect missing prerequisite actions (e.g., hover before clicking dropdown)
   */
  detectMissingPrerequisites(recording: Recording): {
    insertions: Array<{
      afterIndex: number;
      syntheticAction: Partial<Action>;
      reason: string;
    }>;
  } {
    const insertions: Array<{
      afterIndex: number;
      syntheticAction: Partial<Action>;
      reason: string;
    }> = [];

    for (let i = 0; i < recording.actions.length; i++) {
      const action = recording.actions[i];

      // Check for click actions on dropdown/menu items
      if (action.type === 'click') {
        const clickAction = action as any;
        const selector = clickAction.selector;

        // Detect if element is inside dropdown/menu
        const isDropdownItem =
          selector?.css?.includes('dropdown') ||
          selector?.css?.includes('menu-item') ||
          selector?.css?.includes('submenu') ||
          selector?.xpath?.includes('menu') ||
          selector?.text?.length > 0;

        if (isDropdownItem && selector?.css) {
          // Check if there's a recent hover or click on parent
          const hasRecentParentInteraction = this.checkRecentParentInteraction(
            recording.actions,
            i,
            selector.css
          );

          if (!hasRecentParentInteraction) {
            // Extract parent selector
            const parentSelector = this.extractParentSelector(selector.css);

            if (parentSelector) {
              // Insert synthetic hover action
              insertions.push({
                afterIndex: i - 1,
                syntheticAction: {
                  id: `act_synthetic_hover_${i}`,
                  type: 'hover' as any,
                  timestamp: clickAction.timestamp - 100,
                  url: clickAction.url,
                  selector: {
                    css: parentSelector,
                    priority: ['css'],
                  },
                },
                reason: `Dropdown item click requires parent hover: ${parentSelector}`,
              });
            }
          }
        }
      }
    }

    return { insertions };
  }

  /**
   * Check if there's a recent interaction on parent element
   */
  private checkRecentParentInteraction(
    actions: Action[],
    currentIndex: number,
    currentCss: string
  ): boolean {
    // Look back up to 3 actions or 2 seconds
    const lookbackLimit = Math.max(0, currentIndex - 3);

    for (let i = currentIndex - 1; i >= lookbackLimit; i--) {
      const prevAction = actions[i];
      const timeDiff = (actions[currentIndex] as any).timestamp - (prevAction as any).timestamp;

      if (timeDiff > 2000) break;

      if (prevAction.type === 'click' || (prevAction as any).type === 'hover') {
        const prevSelector = (prevAction as any).selector?.css;
        if (prevSelector && currentCss.startsWith(prevSelector)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Extract parent selector from dropdown item CSS
   */
  private extractParentSelector(css: string): string | null {
    // Remove last part of CSS selector (the dropdown item)
    // Example: "div.menu > ul.dropdown > li" → "div.menu > ul.dropdown"

    const parts = css.split('>').map((p) => p.trim());
    if (parts.length > 1) {
      return parts.slice(0, -1).join(' > ');
    }

    // Try space separator
    const spaceParts = css.split(' ').filter((p) => p.trim());
    if (spaceParts.length > 1) {
      return spaceParts.slice(0, -1).join(' ');
    }

    return null;
  }
}
