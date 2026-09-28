import axios from 'axios';
import { getAutoLogin, getStoredCredentials, setUser, clearUser } from '../stores/authStore';

const isDev = window.location.protocol === 'http:' || window.location.protocol === 'https:';

const baseURL = isDev ? '/api' : 'http://idc.mocomsys.com:9080/api';

const api = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const raw = localStorage.getItem('wts_user');
  if (raw) {
    const user = JSON.parse(raw);
    if (user.token) {
      config.headers.Authorization = `Bearer ${user.token}`;
    }
  }
  return config;
});

// Shared in-flight re-login so concurrent 401s wait for one login instead of logging out
let reloginPromise: Promise<string> | null = null;

function relogin(creds: { user_id: string; password: string }): Promise<string> {
  if (!reloginPromise) {
    reloginPromise = axios
      .post(`${baseURL}/auth/login`, creds, { headers: { 'Content-Type': 'application/json' } })
      .then((res) => {
        setUser(res.data);
        return res.data.token as string;
      })
      .finally(() => {
        reloginPromise = null;
      });
  }
  return reloginPromise;
}

function currentToken(): string | undefined {
  const raw = localStorage.getItem('wts_user');
  return raw ? JSON.parse(raw).token : undefined;
}

function redirectToLogin() {
  clearUser();
  // Widget window shows its own "login in main window" screen instead of the login page
  if (window.location.hash.startsWith('#/widget')) {
    window.dispatchEvent(new Event('auth-sync'));
    return;
  }
  window.location.hash = '#/login';
}

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const electron = (window as unknown as { wtsElectron?: { log?: { error: (...args: unknown[]) => void } } }).wtsElectron;
    if (electron?.log) {
      electron.log.error(
        `[API] ${err.config?.method?.toUpperCase()} ${err.config?.url} → ${err.response?.status ?? 'NETWORK_ERROR'}`,
        err.response?.data ?? err.message,
      );
    }

    if (err.response?.status === 401 && err.config && !err.config._retried) {
      err.config._retried = true;

      // Token was already refreshed by another request (or window) after this one was sent
      const token = currentToken();
      if (token && err.config.headers.Authorization !== `Bearer ${token}`) {
        err.config.headers.Authorization = `Bearer ${token}`;
        return api.request(err.config);
      }

      const creds = getAutoLogin() ? getStoredCredentials() : null;
      if (creds) {
        try {
          const newToken = await relogin(creds);
          err.config.headers.Authorization = `Bearer ${newToken}`;
          return api.request(err.config);
        } catch {
          redirectToLogin();
          return Promise.reject(err);
        }
      }
      redirectToLogin();
    }
    return Promise.reject(err);
  },
);

export default api;
