import { redirect } from '@sveltejs/kit';
import { getApiBaseUrl } from '$lib/config/public-config';
import type { LayoutLoad } from './$types';

export const ssr: boolean = false;

type SessionResponse =
  | { readonly authenticated: false }
  | { readonly authenticated: true; readonly user: { readonly userId: string; readonly username: string } };

export const load: LayoutLoad = async ({ url, fetch }) => {
  const pathname: string = url.pathname;
  const isLoginRoute: boolean = pathname === '/login' || pathname.startsWith('/login/');
  const base: string = getApiBaseUrl().replace(/\/+$/, '');
  let isAuthenticated: boolean = false;
  try {
    const sessionResponse: Response = await fetch(`${base}/auth/session`, {
      method: 'GET',
      credentials: 'include',
      headers: { accept: 'application/json' },
    });
    if (sessionResponse.ok) {
      const session: SessionResponse = (await sessionResponse.json()) as SessionResponse;
      isAuthenticated = session.authenticated === true;
    }
  } catch {
    isAuthenticated = false;
  }
  if (isLoginRoute) {
    if (isAuthenticated) {
      throw redirect(302, '/dashboard');
    }
    return {};
  }
  if (!isAuthenticated) {
    throw redirect(302, '/login');
  }
  return {};
};

