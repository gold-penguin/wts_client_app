import type { LoginResponse } from '../types/auth';

const STORAGE_KEY = 'wts_user';

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
