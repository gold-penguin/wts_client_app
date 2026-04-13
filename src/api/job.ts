import api from './client';
import type { JobCreateRequest, JobUpdateRequest, StatusChangeRequest } from '../types/job';

export const jobApi = {
  list: (params?: { scope?: string; status?: number; dept_uid?: number; keyword?: string; emp_uid?: number }) =>
    api.get('/job/list', { params }),

  detail: (job_uid: number) =>
    api.get(`/job/${job_uid}`),

  create: (data: JobCreateRequest) =>
    api.post('/job/create', data),

  update: (job_uid: number, data: JobUpdateRequest) =>
    api.put(`/job/${job_uid}`, data),

  delete: (job_uid: number) =>
    api.delete(`/job/${job_uid}`),

  updateStatus: (job_uid: number, data: StatusChangeRequest) =>
    api.put(`/job/${job_uid}/status`, data),

  results: (job_uid: number) =>
    api.get(`/job/${job_uid}/results`),
};
