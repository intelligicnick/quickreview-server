import { ErrorCode } from '../constants';

export type SuccessResponse<T> = {
  success: true;
  data: T;
};

export type ErrorResponse = {
  success: false;
  error: {
    code: ErrorCode | string;
    message: string;
  };
};

export function ok<T>(data: T): SuccessResponse<T> {
  return { success: true, data };
}
