import api from './client';

export const customerApi = {
  list: () => api.get('/customer/list'),
  create: (data: object) => api.post('/customer/create', data),
  update: (customer_uid: number, data: object) => api.put(`/customer/customer/${customer_uid}`, data),

  // Sites
  sites: (params?: { search_scope?: number; site_state_group?: string; keyword?: string }) =>
    api.get('/customer/sites', { params }),
  siteDetail: (site_uid: number) => api.get(`/customer/site/${site_uid}`),
  siteCreate: (data: object) => api.post('/customer/site/create', data),
  siteUpdate: (site_uid: number, data: object) => api.put(`/customer/site/${site_uid}`, data),
  siteDelete: (site_uid: number) => api.delete(`/customer/site/${site_uid}`),

  // MA
  maUpdate: (site_ma_uid: number, data: object) => api.put(`/customer/ma/${site_ma_uid}`, data),

  // EX
  exList: (status?: number) => api.get('/customer/ex/list', { params: { status } }),
  exDetail: (ex_uid: number) => api.get(`/customer/ex/detail/${ex_uid}`),
  exCreate: (data: object) => api.post('/customer/ex/create', data),
  exUpdate: (ex_uid: number, data: object) => api.put(`/customer/ex/${ex_uid}`, data),
  exDelete: (ex_uid: number) => api.delete(`/customer/ex/delete/${ex_uid}`),

  // PS
  psList: (status?: number) => api.get('/customer/ps/list', { params: { status } }),
  psDetail: (ps_uid: number) => api.get(`/customer/ps/detail/${ps_uid}`),
  psCreate: (data: object) => api.post('/customer/ps/create', data),
  psUpdate: (ps_uid: number, data: object) => api.put(`/customer/ps/${ps_uid}`, data),
  psDelete: (ps_uid: number) => api.delete(`/customer/ps/delete/${ps_uid}`),
};
