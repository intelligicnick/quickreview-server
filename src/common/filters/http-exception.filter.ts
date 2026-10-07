import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ERROR_CODES } from '../constants';
import { ErrorResponse } from '../dto/api-response';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code: string = ERROR_CODES.INTERNAL_ERROR;
    let message = 'Something went wrong';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
      } else if (typeof body === 'object' && body !== null) {
        const record = body as Record<string, unknown>;
        if (typeof record.code === 'string') code = record.code;
        if (typeof record.message === 'string') {
          message = record.message;
        } else if (Array.isArray(record.message)) {
          code = ERROR_CODES.VALIDATION_ERROR;
          message = record.message.join(', ');
        }
      }
      if (status === HttpStatus.UNAUTHORIZED && code === ERROR_CODES.INTERNAL_ERROR) {
        code = ERROR_CODES.UNAUTHORIZED;
      }
      if (status === HttpStatus.FORBIDDEN && code === ERROR_CODES.INTERNAL_ERROR) {
        code = ERROR_CODES.FORBIDDEN;
      }
      if (status === HttpStatus.NOT_FOUND && code === ERROR_CODES.INTERNAL_ERROR) {
        code = ERROR_CODES.NOT_FOUND;
      }
      if (status === HttpStatus.CONFLICT && code === ERROR_CODES.INTERNAL_ERROR) {
        code = ERROR_CODES.CONFLICT;
      }
      if (status === HttpStatus.PAYMENT_REQUIRED) {
        code = ERROR_CODES.PAYMENT_REQUIRED;
      }
      if (status === HttpStatus.TOO_MANY_REQUESTS) {
        code = ERROR_CODES.RATE_LIMITED;
        message = 'Too many requests';
      }
    } else {
      this.logger.error(
        `${request.method} ${request.url}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
      if (process.env.NODE_ENV === 'production') {
        message = 'Something went wrong';
      } else if (exception instanceof Error) {
        message = exception.message;
      }
    }

    const payload: ErrorResponse = {
      success: false,
      error: { code, message },
    };
    response.status(status).json(payload);
  }
}
