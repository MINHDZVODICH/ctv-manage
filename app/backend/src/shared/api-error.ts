export class ApiError extends Error {
  public statusCode: number;
  public code: string;
  public details?: any;

  constructor(statusCode: number, code: string, message: string, details?: any) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, ApiError.prototype);
  }

  static badRequest(message: string, code = 'BAD_REQUEST', details?: any) {
    return new ApiError(400, code, message, details);
  }

  static unauthorized(message = 'Chưa đăng nhập hoặc phiên đăng nhập đã hết hạn', code = 'UNAUTHORIZED') {
    return new ApiError(401, code, message);
  }

  static forbidden(message = 'Bạn không có quyền thực hiện hành động này', code = 'FORBIDDEN') {
    return new ApiError(403, code, message);
  }

  static notFound(message = 'Không tìm thấy tài nguyên', code = 'NOT_FOUND') {
    return new ApiError(404, code, message);
  }

  static conflict(message: string, code = 'CONFLICT', details?: any) {
    return new ApiError(409, code, message, details);
  }

  static unprocessable(message: string, code = 'UNPROCESSABLE_ENTITY', details?: any) {
    return new ApiError(422, code, message, details);
  }

  static internal(message = 'Lỗi hệ thống nội bộ', code = 'INTERNAL_ERROR') {
    return new ApiError(500, code, message);
  }
}
