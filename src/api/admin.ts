import api from './client';

export const adminApi = {
  users: (emp_uid: number) => api.get('/admin/users', { params: { emp_uid } }),
  authLevels: (emp_uid: number) => api.get('/admin/auth-levels', { params: { emp_uid } }),
  grades: (emp_uid: number) => api.get('/admin/grades', { params: { emp_uid } }),
  depts: (emp_uid: number) => api.get('/admin/depts', { params: { emp_uid } }),
  deptLevels: (emp_uid: number) => api.get('/admin/dept-levels', { params: { emp_uid } }),

  createDept: (data: { admin_emp_uid: number; dept_name: string; dept_level: number; p_dept_uid?: number; print_priority?: number }) =>
    api.post('/admin/dept', data),

  updateDept: (dept_uid: number, data: { admin_emp_uid: number; dept_name: string; dept_level: number; p_dept_uid?: number; print_priority?: number }) =>
    api.put(`/admin/dept/${dept_uid}`, data),

  toggleDept: (dept_uid: number, data: { admin_emp_uid: number; is_current: number }) =>
    api.put(`/admin/dept/${dept_uid}/toggle`, data),

  createUser: (data: { admin_emp_uid: number; userid: string; name: string; grade?: string; password?: string; dept_uid?: number; level?: number }) =>
    api.post('/admin/user', data),

  toggleUser: (emp_uid: number, data: { admin_emp_uid: number; is_enable: number }) =>
    api.put(`/admin/user/${emp_uid}/toggle`, data),

  resetPassword: (emp_uid: number, data: { admin_emp_uid: number; new_password?: string }) =>
    api.put(`/admin/user/${emp_uid}/reset-password`, data),

  updateUserLevel: (emp_uid: number, data: { admin_emp_uid: number; level: number }) =>
    api.put(`/admin/user/${emp_uid}/level`, data),

  updateUserGrade: (emp_uid: number, data: { admin_emp_uid: number; grade: string }) =>
    api.put(`/admin/user/${emp_uid}/grade`, data),

  updateUserDept: (emp_uid: number, data: { admin_emp_uid: number; dept_uid: number }) =>
    api.put(`/admin/user/${emp_uid}/dept`, data),
};
