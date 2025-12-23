import type { SelectorStrategy } from './selectors.js';

/**
 * Selector with metadata for priority-based fallback (Phase 2)
 */
export interface SelectorWithMetadata {
  strategy:
    | 'id'
    | 'aria-label'
    | 'name'
    | 'text-content'
    | 'src-pattern'
    | 'css'
    | 'xpath'
    | 'position'
    | 'css-semantic' // CSS with :has-text() pseudo-selector
    | 'href-pattern'; // Link href pattern matching
  value: any;
  context?: string; // Optional context for scoped searches (e.g., "swal2-actions")
  priority: number; // 1-11 (lower = higher priority)
  confidence: number; // 0-100 (higher = more reliable)
}

/**
 * Content signature for fallback element identification (Phase 2)
 */
export interface ContentSignature {
  elementType: string; // 'div', 'li', 'article', etc.
  listContainer?: string; // CSS selector for parent list
  contentFingerprint: {
    heading?: string;
    subheading?: string;
    imageAlt?: string;
    imageSrc?: string;
    linkHref?: string;
    price?: string;
    rating?: string;
  };
  visualHints?: {
    position?: number;
    nearText?: string;
  };
  fallbackPosition?: number; // Last resort: position in list
}

/**
 * Navigation intent metadata from recorder
 */
export interface NavigationIntentMetadata {
  navigationIntent?:
    | 'checkout-complete'
    | 'submit-form'
    | 'close-modal-and-redirect'
    | 'navigate-to-page'
    | 'logout'
    | 'none';
  expectedUrlChange?: {
    type: 'success' | 'redirect' | 'same-page' | 'error';
    patterns: string[];
    isSuccessFlow: boolean;
    beforeUrl?: string;
    afterUrl?: string;
  };
  isTerminalAction?: boolean;
  actionGroup?: string;
  dependentActions?: string[];
  isInsideModal?: boolean;
  modalId?: string;
}

/**
 * Base interface for all action types
 */
export interface BaseAction {
  id: string; // Unique action ID (act_xxx)
  type: ActionType;
  timestamp: number; // Unix timestamp in milliseconds (action START time)
  completedAt?: number; // Unix timestamp when action completed (action END time)
  url: string; // Current page URL
  frameId?: string; // iFrame identifier if in frame
  frameUrl?: string; // iFrame URL if in frame
  frameSelector?: string; // Selector to target frame
  context?: NavigationIntentMetadata; // Navigation intent metadata from recorder

  // Phase 2: Optional action flags
  isOptional?: boolean;
  skipIfNotFound?: boolean;
  reason?: string; // Why optional (e.g., "modal-close-button", "hover-preview")

  // Phase 2: Multi-strategy selectors (for new recordings)
  selectors?: SelectorWithMetadata[];

  // Phase 2: Content signature for fallback
  contentSignature?: ContentSignature;
}

/**
 * Click action (left, right, middle, double-click)
 */
export interface ClickAction extends BaseAction {
  type: 'click';
  selector: SelectorStrategy; // Multi-strategy selector object (legacy)
  tagName: string;
  text?: string; // Button/link text content
  coordinates: { x: number; y: number };
  coordinatesRelativeTo: 'element' | 'viewport' | 'document';
  button: 'left' | 'right' | 'middle';
  clickCount: number; // 1 = single, 2 = double
  modifiers: ModifierKey[]; // ['ctrl', 'shift', 'alt', 'meta']

  // Phase 2: Modal context support
  modalContext?: {
    withinModal: boolean;
    modalDetected: boolean;
    modalId?: string;
    requiresModalState?: boolean;
  };

  // Phase 2.5: AJAX form detection support (from recorder)
  expectsNavigation?: boolean; // False for AJAX forms that don't cause page navigation
  isAjaxForm?: boolean; // True for forms that submit via AJAX without redirecting
  clickType?: 'standard' | 'submit' | 'toggle-input' | 'dropdown-trigger'; // Type classification
}

/**
 * Input action (text, email, password, etc.)
 */
export interface InputAction extends BaseAction {
  type: 'input';
  selector: SelectorStrategy;
  tagName: string;
  value: string; // Masked if sensitive
  inputType: string; // text, email, password, etc.
  isSensitive: boolean; // True for passwords/cards
  simulationType: 'type' | 'setValue'; // Keystroke vs instant
  typingDelay?: number; // Delay between keystrokes (ms)
}

/**
 * Select dropdown action
 */
export interface SelectAction extends BaseAction {
  type: 'select';
  selector: SelectorStrategy;
  tagName: 'select';
  selectedValue: string;
  selectedText: string;
  selectedIndex: number;
}

/**
 * Navigation action (page transitions)
 */
export interface NavigationAction extends BaseAction {
  type: 'navigation';
  from: string;
  to: string;
  navigationTrigger: 'click' | 'form-submit' | 'manual' | 'redirect' | 'back' | 'forward';
  waitUntil: 'load' | 'domcontentloaded' | 'networkidle';
  duration: number; // Navigation duration in ms
}

/**
 * Hover action (mouse hover over element)
 */
export interface HoverAction extends BaseAction {
  type: 'hover';
  selector: SelectorStrategy;
  tagName: string;
  text?: string;
  duration: number; // How long user hovered (ms)
  isDropdownParent?: boolean; // True if hovering to open dropdown
}

/**
 * Scroll action (window or element)
 */
export interface ScrollAction extends BaseAction {
  type: 'scroll';
  scrollX: number;
  scrollY: number;
  element: 'window' | SelectorStrategy; // Window or specific element
}

/**
 * Keypress action (Enter, Tab, Escape, etc.)
 */
export interface KeypressAction extends BaseAction {
  type: 'keypress';
  key: string; // 'Enter', 'Escape', 'Tab', etc.
  code: string; // KeyboardEvent.code
  modifiers: ModifierKey[];
}

/**
 * Form submit action
 */
export interface SubmitAction extends BaseAction {
  type: 'submit';
  selector: SelectorStrategy; // Form selector
  tagName: 'form';
  formData?: Record<string, string>; // Sanitized form data
}

/**
 * Auto-generated checkpoint for validation
 */
export interface CheckpointAction extends BaseAction {
  type: 'checkpoint';
  checkType: 'urlMatch' | 'elementVisible' | 'elementText' | 'pageLoad';
  expectedUrl?: string;
  actualUrl?: string;
  selector?: SelectorStrategy;
  expectedValue?: string;
  actualValue?: string;
  passed: boolean;
}

/**
 * Modal lifecycle event (Phase 2)
 */
export interface ModalLifecycleAction extends BaseAction {
  type: 'modal-lifecycle';
  event: 'modal-opened' | 'modal-state-changed' | 'modal-closed';
  modalElement: {
    id: string | null;
    classes: string | null;
    role: string | null;
    zIndex: string | null;
  };
}

/**
 * Modifier keys (Ctrl, Shift, Alt, Meta/Cmd)
 */
export type ModifierKey = 'ctrl' | 'shift' | 'alt' | 'meta';

/**
 * All possible action types
 */
export type ActionType =
  | 'click'
  | 'input'
  | 'hover'
  | 'select'
  | 'navigation'
  | 'scroll'
  | 'keypress'
  | 'submit'
  | 'checkpoint'
  | 'modal-lifecycle'; // Phase 2

/**
 * Union type of all actions
 */
export type Action =
  | ClickAction
  | InputAction
  | HoverAction
  | SelectAction
  | NavigationAction
  | ScrollAction
  | KeypressAction
  | SubmitAction
  | CheckpointAction
  | ModalLifecycleAction; // Phase 2

/**
 * Type guard for ClickAction
 */
export function isClickAction(action: Action): action is ClickAction {
  return action.type === 'click';
}

/**
 * Type guard for InputAction
 */
export function isInputAction(action: Action): action is InputAction {
  return action.type === 'input';
}

/**
 * Type guard for NavigationAction
 */
export function isNavigationAction(action: Action): action is NavigationAction {
  return action.type === 'navigation';
}

/**
 * Type guard for HoverAction
 */
export function isHoverAction(action: Action): action is HoverAction {
  return action.type === 'hover';
}

/**
 * Type guard for ScrollAction
 */
export function isScrollAction(action: Action): action is ScrollAction {
  return action.type === 'scroll';
}

/**
 * Type guard for SelectAction
 */
export function isSelectAction(action: Action): action is SelectAction {
  return action.type === 'select';
}

/**
 * Type guard for ModalLifecycleAction (Phase 2)
 */
export function isModalLifecycleAction(action: Action): action is ModalLifecycleAction {
  return action.type === 'modal-lifecycle';
}
