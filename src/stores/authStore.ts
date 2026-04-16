import type { LoginResponse } from '../types/auth';

const STORAGE_KEY = 'wts_user';
const AUTO_LOGIN_KEY = 'wts_auto_login';
const CREDENTIALS_KEY = 'wts_credentials';

function notifyElectron() {
  const w = window as unknown as { wtsElectron?: { notifyAuthChanged: () => void } };
  if (w.wtsElectron?.notifyAuthChanged) {
    w.wtsElectron.notifyAuthChanged();
  }
}

export function getUser(): LoginResponse | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  return JSON.parse(raw) as LoginResponse;
}

export function setUser(user: LoginResponse) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  notifyElectron();
}

export function clearUser() {
  localStorage.removeItem(STORAGE_KEY);
  notifyElectron();
}

export function isLoggedIn(): boolean {
  return getUser() !== null;
}

export function setAutoLogin(enabled: boolean, credentials?: { user_id: string; password: string }) {
  if (enabled && credentials) {
    localStorage.setItem(AUTO_LOGIN_KEY, 'true');
    localStorage.setItem(CREDENTIALS_KEY, JSON.stringify(credentials));
  } else {
    localStorage.removeItem(AUTO_LOGIN_KEY);
    localStorage.removeItem(CREDENTIALS_KEY);
  }
}

export function getAutoLogin(): boolean {
  return localStorage.getItem(AUTO_LOGIN_KEY) === 'true';
}

export function getStoredCredentials(): { user_id: string; password: string } | null {
  const raw = localStorage.getItem(CREDENTIALS_KEY);
  if (!raw) return null;
  return JSON.parse(raw);
}
