import api from './client';
import type { ResultSaveRequest, ResultUpdateRequest } from '../types/result';

export const resultApi = {
  list: (emp_uid: number, month: string) =>
    api.get('/result/list', { params: { emp_uid, month } }),

  day: (emp_uid: number, reg_date: string) =>
    api.get('/result/day', { params: { emp_uid, reg_date } }),

  lastEndTime: (emp_uid: number, reg_date: string) =>
    api.get('/result/last-end-time', { params: { emp_uid, reg_date } }),

  calendarDetail: (emp_uid: number, month: string, team_emp_uids?: string) =>
    api.get('/result/calendar-detail', { params: { emp_uid, month, team_emp_uids } }),

  recent: (emp_uid: number, limit?: number) =>
    api.get('/result/recent', { params: { emp_uid, limit } }),

  monthlySummary: (emp_uid: number, month: string) =>
    api.get('/result/monthly-summary', { params: { emp_uid, month } }),

  team: (dept_uid: number, month: string) =>
    api.get('/result/team', { params: { dept_uid, month } }),

  teamMonthly: (emp_uids: string, month: string) =>
    api.get('/result/team-monthly', { params: { emp_uids, month } }),

  teamDay: (emp_uids: string, reg_date: string) =>
    api.get('/result/team-day', { params: { emp_uids, reg_date } }),

  save: (data: ResultSaveRequest) =>
    api.post('/result/save', data),

  update: (data: ResultUpdateRequest) =>
    api.put('/result/update', data),

  delete: (report_uid: number) =>
    api.delete(`/result/${report_uid}`),

  detailFull: (report_uid: number) =>
    api.get(`/result/detail-full/${report_uid}`),
};
