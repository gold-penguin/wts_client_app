import api from './client';

export const commonApi = {
  jobScopes: () => api.get('/common/job-scopes'),
  jobTypes: () => api.get('/common/job-types'),
  jobMethods: () => api.get('/common/job-methods'),
  products: () => api.get('/common/products'),
  statuses: () => api.get('/common/statuses'),
  deptJobs: (dept_uid?: number) => api.get('/common/dept-jobs', { params: { dept_uid } }),
  coReqDepts: () => api.get('/common/co-req-depts'),
  siteStates: () => api.get('/common/site-states'),
  contractTypes: () => api.get('/common/contract-types'),
  ptList: () => api.get('/common/pt-list'),
  psList: () => api.get('/common/ps-list'),
  holidays: (year: number) => api.get('/common/holidays', { params: { year } }),
  calendar: (year: number, month: number) => api.get('/common/calendar', { params: { year, month } }),
};
