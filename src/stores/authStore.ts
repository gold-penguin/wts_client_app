import type { LoginResponse } from '../types/auth';

const STORAGE_KEY = 'wts_user';
const AUTO_LOGIN_KEY = 'wts_auto_login';
const CREDENTIALS_KEY = 'wts_credentials';
// 마지막으로 로그인한 프로필(토큰 제외) — 서버에 연결할 수 없을 때 오프라인으로 시작하는 데 사용
const LAST_PROFILE_KEY = 'wts_last_profile';

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
  if (user.token) {
    const { token: _token, ...profile } = user;
    void _token;
    localStorage.setItem(LAST_PROFILE_KEY, JSON.stringify(profile));
  }
  notifyElectron();
}

export function clearUser() {
  localStorage.removeItem(STORAGE_KEY);
  notifyElectron();
}

export function isLoggedIn(): boolean {
  return getUser() !== null;
}

/** 사용자가 직접 로그아웃 — 오프라인 시작용 프로필도 지운다 */
export function logout() {
  localStorage.removeItem(LAST_PROFILE_KEY);
  clearUser();
}

/** 오프라인(토큰 없음)으로 들어온 세션인지 */
export const isOfflineUser = (user: LoginResponse | null) => !!user && !user.token;

/**
 * 서버 없이 시작할 프로필. 마지막 로그인 프로필이 없으면 이 PC에 '내 일정' 데이터가
 * 한 사람 것만 있을 때 그 사번으로, 그것도 없으면 fallbackEmpUid(네이버 연동에 저장된 사번)로
 * 최소 프로필을 만든다. 오프라인에선 이 PC의 데이터만 보인다.
 */
export function getOfflineProfile(fallbackEmpUid?: number | null): LoginResponse | null {
  try {
    const raw = localStorage.getItem(LAST_PROFILE_KEY);
    if (raw) return { ...(JSON.parse(raw) as Omit<LoginResponse, 'token'>), token: '' };
  } catch { /* fall through */ }
  const empUids = new Set<number>();
  for (let i = 0; i < localStorage.length; i++) {
    const m = /^wts_planner_(\d+)$/.exec(localStorage.key(i) || '');
    if (m) empUids.add(Number(m[1]));
  }
  let emp_uid: number;
  if (empUids.size === 1) [emp_uid] = [...empUids];
  else if (empUids.size === 0 && fallbackEmpUid) emp_uid = fallbackEmpUid;
  else return null;
  return { token: '', emp_uid, user_name: '오프라인 사용자', grade: null, dept_uid: 0, dept_name: '', work_level: 0, level_name: '' };
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
