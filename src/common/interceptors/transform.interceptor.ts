import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, map } from 'rxjs';
import { SuccessResponse } from '../dto/api-response';

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, SuccessResponse<T>> {
  intercept(_context: ExecutionContext, next: CallHandler<T>): Observable<SuccessResponse<T>> {
    return next.handle().pipe(map((data) => {
      if (data && typeof data === 'object' && 'success' in (data as object)) {
        return data as unknown as SuccessResponse<T>;
      }
      return { success: true, data: (data ?? null) as T };
    }));
  }
}
