import { HttpException, HttpStatus } from '@nestjs/common';
import type { ErrorCode } from '@farbite/shared';

// Domain error carrying one of the §10 error codes. The exception filter turns
// any of these into { error: { code, message, details? } }.
export class AppException extends HttpException {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    status: HttpStatus,
    public readonly details?: unknown,
  ) {
    super(message, status);
  }
}
