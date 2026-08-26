export class AppError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}
export const Errors = {
  invalidCredentials: () => new AppError(401, 'INVALID_CREDENTIALS', 'Email hoặc mật khẩu không đúng'),
  accountDisabled: () => new AppError(403, 'ACCOUNT_DISABLED', 'Tài khoản đã bị vô hiệu hóa'),
  unauthorized: () => new AppError(401, 'UNAUTHORIZED', 'Chưa đăng nhập'),
  forbidden: () => new AppError(403, 'FORBIDDEN', 'Không có quyền truy cập'),
  notFound: (msg = 'Không tìm thấy') => new AppError(404, 'NOT_FOUND', msg),
  conflict: (code: string, msg: string) => new AppError(409, code, msg),
  badRequest: (code: string, msg: string) => new AppError(400, code, msg),
};

export function toErrorBody(err: AppError) {
  return { error: { code: err.code, message: err.message } };
}
