export interface JobCreateRequest {
  job_scope_code: string;
  job_name: string;
  customer_uid?: number | null;
  site_ma_uid?: number | null;
  ex_uid?: number | null;
  ito_uid?: number | null;
  ps_uid?: number | null;
  pt_uid?: number | null;
  site_state_uid?: number | null;
  is_cowork?: number;
  req_person?: string | null;
  req_date?: string | null;
  expected_start_date?: string | null;
  expected_end_date?: string | null;
  expected_period?: number;
  note?: string | null;
  charge_emp_uids?: number[];
  main_emp_uid?: number | null;
  dept_uids?: number[];
  product_uids?: number[];
  dept_job_uids?: number[];
}

export interface JobUpdateRequest {
  job_name?: string | null;
  note?: string | null;
  status?: number | null;
  req_person?: string | null;
  expected_start_date?: string | null;
  expected_end_date?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  charge_emp_uids?: number[] | null;
  main_emp_uid?: number | null;
  dept_uids?: number[] | null;
}

export interface StatusChangeRequest {
  status: number;
  end_date?: string | null;
  note?: string | null;
}
