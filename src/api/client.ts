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

let isRelogging = false;

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

    if (err.response?.status === 401 && !err.config._retried) {
      if (getAutoLogin() && !isRelogging) {
        const creds = getStoredCredentials();
        if (creds) {
          isRelogging = true;
          try {
            const res = await axios.post(`${baseURL}/auth/login`, creds, {
              headers: { 'Content-Type': 'application/json' },
            });
            setUser(res.data);
            err.config._retried = true;
            err.config.headers.Authorization = `Bearer ${res.data.token}`;
            return api.request(err.config);
          } catch {
            clearUser();
            window.location.hash = '#/login';
          } finally {
            isRelogging = false;
          }
          return Promise.reject(err);
        }
      }
      clearUser();
      window.location.hash = '#/login';
    }
    return Promise.reject(err);
  },
);

export default api;
