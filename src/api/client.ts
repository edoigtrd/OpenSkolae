import * as SecureStore from 'expo-secure-store';

const AUTH_BASE = 'https://authentication.kordis.fr';
const API_BASE = 'https://api.kordis.fr';
const TOKEN_KEY = 'skolae_access_token';

const OKHTTP_HEADERS: Record<string, string> = {
  'User-Agent': 'okhttp/3.13.1',
  'Connection': 'Keep-Alive',
  'Accept-Encoding': 'gzip',
};

export async function saveToken(token: string) {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function loadToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function clearToken() {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export async function login(username: string, password: string): Promise<string> {
  const credentials = btoa(`${username}:${password}`);
  const url = `${AUTH_BASE}/oauth/authorize?response_type=token&client_id=skolae-app`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      ...OKHTTP_HEADERS,
      'Authorization': `Basic ${credentials}`,
    },
    redirect: 'manual',
  });

  const location = response.headers.get('Location') || response.url || '';
  if (!location.includes('access_token')) {
    throw new Error('Identifiants invalides');
  }

  const fragment = location.split('#')[1] || '';
  const params = Object.fromEntries(fragment.split('&').map(p => p.split('=')));
  const token = params['access_token'];
  if (!token) throw new Error('Token introuvable dans la réponse');
  return token;
}

async function request<T>(
  path: string,
  token: string,
  options: RequestInit = {}
): Promise<T> {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      ...OKHTTP_HEADERS,
      'Authorization': `Bearer ${token}`,
      ...(options.headers as Record<string, string> || {}),
    },
  });

  if (response.status === 401) {
    throw new AuthError('Session expirée, veuillez vous reconnecter.');
  }
  if (response.status === 423) {
    throw new LockError('Application verrouillée.');
  }
  if (!response.ok) {
    throw new Error(`Erreur serveur (${response.status})`);
  }

  const json = await response.json();
  return json.result as T;
}

export function apiGet<T>(path: string, token: string, params?: Record<string, string | number>): Promise<T> {
  const url = params
    ? `${path}?${new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString()}`
    : path;
  return request<T>(url, token);
}

export function apiPost<T>(path: string, token: string, body?: object): Promise<T> {
  return request<T>(path, token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=UTF-8' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

export function apiPut<T>(path: string, token: string, body?: object): Promise<T> {
  return request<T>(path, token, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json; charset=UTF-8' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

export function apiPatch<T>(path: string, token: string, body?: object): Promise<T> {
  return request<T>(path, token, {
    method: 'PATCH',
    headers: body ? { 'Content-Type': 'application/json; charset=UTF-8' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
}

export function apiDelete<T>(path: string, token: string): Promise<T> {
  return request<T>(path, token, { method: 'DELETE' });
}

export class AuthError extends Error {}
export class LockError extends Error {}
