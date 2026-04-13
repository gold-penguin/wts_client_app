export interface LoginRequest {
  user_id: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  emp_uid: number;
  user_name: string;
  grade: string | null;
  dept_uid: number;
  dept_name: string;
  work_level: number;
  level_name: string;
}

export interface ProfileUpdateRequest {
  emp_uid: number;
  email?: string | null;
  office_phone?: string | null;
  mobile_phone?: string | null;
  birthdate?: string | null;
}

export interface PasswordChangeRequest {
  emp_uid: number;
  current_password: string;
  new_password: string;
}
