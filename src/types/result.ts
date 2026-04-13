export interface ResultSaveRequest {
  emp_uid: number;
  dept_uid: number;
  job_uid: number;
  job_type_uid: number;
  job_method_uid: number;
  dept_job_uid?: number | null;
  product_uid?: number | null;
  co_req_dept_uid?: number | null;
  reg_date: string;
  start_time: string;
  end_time: string;
  hours: number;
  is_holiday?: number;
  req_person?: string | null;
  note?: string;
}

export interface ResultUpdateRequest {
  report_uid: number;
  job_uid: number;
  job_type_uid: number;
  job_method_uid: number;
  dept_job_uid?: number | null;
  product_uid?: number | null;
  co_req_dept_uid?: number | null;
  reg_date: string;
  start_time: string;
  end_time: string;
  hours: number;
  is_holiday?: number;
  req_person?: string | null;
  note?: string;
}
