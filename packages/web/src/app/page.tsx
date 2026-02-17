import { redirect } from 'next/navigation';

/**
 * Root page redirects to projects list (home) or login based on auth state.
 * The AuthProvider handles redirecting unauthenticated users to /login.
 */
export default function RootPage() {
  redirect('/projects');
}
