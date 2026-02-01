import { redirect } from 'next/navigation';

/**
 * Root page redirects to dashboard or login based on auth state.
 * For now, redirect to login since we don't have auth state yet.
 */
export default function RootPage() {
  // TODO: Check auth state and redirect accordingly
  // For now, always redirect to login
  redirect('/login');
}
