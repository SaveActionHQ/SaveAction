/**
 * Custom DOM events for cross-component communication.
 *
 * Used to notify the sidebar (and other listeners) about data mutations
 * that happen without a navigation (e.g., deleting a test or suite).
 */

const SIDEBAR_REFRESH_EVENT = 'saveaction:sidebar-refresh';

/**
 * Trigger a sidebar data refresh.
 * Call this after any mutation that should be reflected in the sidebar
 * (create/delete suites, create/delete tests) when no navigation occurs.
 */
export function refreshSidebar(): void {
  window.dispatchEvent(new CustomEvent(SIDEBAR_REFRESH_EVENT));
}

/**
 * Subscribe to sidebar refresh events.
 * Returns an unsubscribe function.
 */
export function onSidebarRefresh(callback: () => void): () => void {
  window.addEventListener(SIDEBAR_REFRESH_EVENT, callback);
  return () => window.removeEventListener(SIDEBAR_REFRESH_EVENT, callback);
}
