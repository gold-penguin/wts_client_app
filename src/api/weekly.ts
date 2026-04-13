import api from './client';

export const weeklyApi = {
  report: (params?: { dept_uid?: number; week?: string }) =>
    api.get('/weekly/report', { params }),

  reportDetails: (wreport_uid: number) =>
    api.get(`/weekly/report/${wreport_uid}/details`),

  updateDetails: (updates: Array<{ wreport_detail_uid: number; thisweek_note?: string; nextweek_note?: string; progress?: number }>) =>
    api.put('/weekly/report/details', updates),

  myJobs: (emp_uid: number, week: string) =>
    api.get('/weekly/my-jobs', { params: { emp_uid, week } }),

  partJobs: (dept_uid: number, week: string, emp_uids: string) =>
    api.get('/weekly/part-jobs', { params: { dept_uid, week, emp_uids } }),

  individualHistory: (emp_uid: number, job_uid: number) =>
    api.get('/weekly/individual-history', { params: { emp_uid, job_uid } }),

  individual: (emp_uid: number, week?: string) =>
    api.get('/weekly/individual', { params: { emp_uid, week } }),

  updateIndividual: (updates: Array<{ wreport_charge_uid: number; thisweek_note?: string; nextweek_note?: string }>) =>
    api.put('/weekly/individual', updates),

  saveIndividual: (data: { emp_uid: number; week: string; entries: Array<{ job_uid: number; wreport_charge_uid?: number; thisweek_note?: string }> }) =>
    api.post('/weekly/individual/save', data),

  teamIndividual: (emp_uids: string, week: string) =>
    api.get('/weekly/team-individual', { params: { emp_uids, week } }),

  partReportHistory: (dept_uid: number, job_uid: number) =>
    api.get('/weekly/part-report-history', { params: { dept_uid, job_uid } }),

  toggleMajor: (dept_uid: number, week: string, job_uid: number, is_major: number) =>
    api.put('/weekly/toggle-major', null, { params: { dept_uid, week, job_uid, is_major } }),

  savePartReport: (data: object) =>
    api.post('/weekly/save-part-report', data),

  generate: (dept_uid: number, week: string) =>
    api.post('/weekly/generate', null, { params: { dept_uid, week } }),

  partResults: (dept_uid: number, week: string) =>
    api.get('/weekly/part-results', { params: { dept_uid, week } }),

  jobCharges: (job_uids: string) =>
    api.get('/weekly/job-charges', { params: { job_uids } }),

  prevReportDetails: (dept_uid: number, week: string) =>
    api.get('/weekly/prev-report-details', { params: { dept_uid, week } }),

  reportsByDepts: (dept_uids: string, week: string) =>
    api.get('/weekly/reports-by-depts', { params: { dept_uids, week } }),
};
