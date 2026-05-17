export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
  request_id?: string;
}

export interface Pagination<T> {
  list: T[];
  page: number;
  page_size: number;
  total: number;
}

export interface ApiErrorField {
  field: string;
  msg: string;
}

export class ApiError extends Error {
  code: number;
  status?: number;
  fields?: ApiErrorField[];

  constructor(message: string, code: number, status?: number, fields?: ApiErrorField[]) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.fields = fields;
  }
}
