import api from './client';

export const deptApi = {
  list: () => api.get('/dept/list'),

  myTeam: (emp_uid: number, dept_uid: number, work_level: number) =>
    api.get('/dept/my-team', { params: { emp_uid, dept_uid, work_level } }),

  empList: () => api.get('/dept/emp/list'),

  employees: (dept_uid: number, include_child?: number) =>
    api.get(`/dept/${dept_uid}/employees`, { params: { include_child } }),
};
