import { AppError } from './errors';

export function parseAndValidateDateOfBirth(input: unknown): Date | null {
  if (input === null || input === undefined || input === '') {
    return null;
  }

  let day: number, month: number, year: number;

  if (input instanceof Date) {
    if (isNaN(input.getTime())) {
      throw new AppError(400, 'INVALID_DATE_OF_BIRTH', 'Ngày sinh không hợp lệ');
    }
    day = input.getUTCDate();
    month = input.getUTCMonth() + 1;
    year = input.getUTCFullYear();
  } else if (typeof input === 'string') {
    const trimmed = input.trim();
    if (!trimmed) return null;

    const vnMatch = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    const isoMatch = trimmed.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);

    if (vnMatch) {
      day = parseInt(vnMatch[1], 10);
      month = parseInt(vnMatch[2], 10);
      year = parseInt(vnMatch[3], 10);
    } else if (isoMatch) {
      year = parseInt(isoMatch[1], 10);
      month = parseInt(isoMatch[2], 10);
      day = parseInt(isoMatch[3], 10);
    } else {
      const parsed = new Date(trimmed);
      if (isNaN(parsed.getTime())) {
        throw new AppError(400, 'INVALID_DATE_OF_BIRTH', 'Ngày sinh không đúng định dạng');
      }
      day = parsed.getUTCDate();
      month = parsed.getUTCMonth() + 1;
      year = parsed.getUTCFullYear();
    }
  } else {
    throw new AppError(400, 'INVALID_DATE_OF_BIRTH', 'Ngày sinh không hợp lệ');
  }

  const currentYear = new Date().getFullYear();
  if (year < 1900 || year > currentYear) {
    throw new AppError(400, 'INVALID_DATE_OF_BIRTH', `Năm sinh phải từ năm 1900 đến ${currentYear}`);
  }

  if (month < 1 || month > 12) {
    throw new AppError(400, 'INVALID_DATE_OF_BIRTH', 'Tháng sinh không hợp lệ (1 - 12)');
  }

  const daysInMonth = new Date(year, month, 0).getDate();
  if (day < 1 || day > daysInMonth) {
    throw new AppError(400, 'INVALID_DATE_OF_BIRTH', `Tháng ${month}/${year} chỉ có tối đa ${daysInMonth} ngày`);
  }

  const result = new Date(Date.UTC(year, month - 1, day));
  if (result.getTime() > Date.now()) {
    throw new AppError(400, 'INVALID_DATE_OF_BIRTH', 'Ngày sinh không được lớn hơn ngày hiện tại');
  }

  return result;
}
