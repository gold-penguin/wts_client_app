import axios from 'axios';

const isDev = window.location.protocol === 'http:' || window.location.protocol === 'https:';

const api = axios.create({
  baseURL: isDev ? '/api' : 'http://idc.mocomsys.com:9080/api',
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

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('wts_user');
      window.location.hash = '#/login';
    }
    return Promise.reject(err);
  },
);

export default api;
