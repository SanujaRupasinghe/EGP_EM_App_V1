export type Role = "admin" | "office";

export type Profile = {
  id: string;
  full_name: string;
  role: Role;
  created_at: string;
};

export type Employee = {
  id: string;
  code: string;
  name: string;
  gender: "M" | "F" | null;
  active: boolean;
  created_at: string;
};

export type Section = {
  id: string;
  code: string;
  active: boolean;
  area_acres: number | null;
  created_at: string;
};

export type WorkType = {
  id: string;
  code: string;
  requires_quantity: boolean;
  active: boolean;
  created_at: string;
};

export type TimePreset = {
  id: string;
  label: string;
  start_time: string;
  end_time: string;
  day_fraction: number;
  active: boolean;
  created_at: string;
};

export type PayRateSetting = {
  id: string;
  effective_from: string;
  day_rate: number;
  free_kg_threshold: number;
  extra_kg_rate: number;
  created_by: string | null;
  created_at: string;
};

export type Holiday = {
  id: string;
  date: string;
  reason: string | null;
  created_by: string | null;
  created_at: string;
};

export type DailyReport = {
  id: string;
  report_date: string;
  status: "draft" | "finalized";
  created_by: string | null;
  created_at: string;
  last_amended_by: string | null;
  last_amended_at: string | null;
  amendment_count: number;
  unlocked_by: string | null;
  unlocked_at: string | null;
  csv_imported_at: string | null;
};

export type JobLine = {
  id: string;
  attendance_id: string;
  section_id: string;
  work_type_id: string;
  quantity_kg: number | null;
};

export type Attendance = {
  id: string;
  daily_report_id: string;
  employee_id: string;
  time_preset_id: string;
  advance_amount: number;
  created_at: string;
  job_lines?: JobLine[];
};

export type TransportLog = {
  daily_report_id: string;
  login_available: boolean;
  login_time: string | null;
  logout_available: boolean;
  logout_time: string | null;
};

export type TeaCollector = {
  daily_report_id: string;
  arrived: boolean;
  amount_kg: number | null;
};

export type CashSummary = {
  daily_report_id: string;
  receive: number;
  expenses: number;
  balance: number;
  description: string | null;
  remarks: string | null;
};

export type CashEntry = {
  id: string;
  daily_report_id: string;
  type: "income" | "expense";
  reason: string;
  amount: number;
  created_at: string;
};

export type PayrollAdjustment = {
  id: string;
  employee_id: string;
  period_start: string;
  period_end: string;
  allowance: number;
  loan: number;
  updated_by: string | null;
  updated_at: string;
};

export type AttendancePayRow = {
  attendance_id: string;
  daily_report_id: string;
  report_date: string;
  employee_id: string;
  employee_code: string;
  employee_name: string;
  time_preset_id: string;
  day_fraction: number;
  advance_amount: number;
  day_rate: number;
  free_kg_threshold: number;
  extra_kg_rate: number;
  plucked_kg: number;
  has_plucking: boolean;
  final_pay: number;
};

export type JobLineDetailRow = {
  job_line_id: string;
  attendance_id: string;
  report_date: string;
  employee_id: string;
  employee_code: string;
  employee_name: string;
  section_id: string;
  section_code: string;
  work_type_id: string;
  work_type_code: string;
  quantity_kg: number | null;
  day_fraction: number;
};

export type AuditLogRow = {
  id: string;
  table_name: string;
  record_id: string | null;
  action: string;
  diff: unknown;
  changed_by: string | null;
  changed_at: string;
};
