import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../api/auth';
import { getUser, setUser, clearUser } from '../stores/authStore';
import type { LoginResponse } from '../types/auth';

export function useAuth() {
  const [user, setUserState] = useState<LoginResponse | null>(getUser);
  const navigate = useNavigate();

  const login = useCallback(async (user_id: string, password: string) => {
    const res = await authApi.login({ user_id, password });
    setUser(res.data);
    setUserState(res.data);
    navigate('/');
  }, [navigate]);

  const logout = useCallback(() => {
    clearUser();
    setUserState(null);
    navigate('/login');
  }, [navigate]);

  return { user, login, logout, isLoggedIn: user !== null };
}
