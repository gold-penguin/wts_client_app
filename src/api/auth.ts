import api from './client';
import type { LoginRequest, LoginResponse, ProfileUpdateRequest, PasswordChangeRequest } from '../types/auth';

export const authApi = {
  login: (data: LoginRequest) =>
    api.post<LoginResponse>('/auth/login', data),

  getProfile: (emp_uid: number) =>
    api.get('/auth/profile', { params: { emp_uid } }),

  updateProfile: (data: ProfileUpdateRequest) =>
    api.put('/auth/profile', data),

  changePassword: (data: PasswordChangeRequest) =>
    api.put('/auth/password', data),

  getDepts: (emp_uid: number) =>
    api.get('/auth/depts', { params: { emp_uid } }),
};
