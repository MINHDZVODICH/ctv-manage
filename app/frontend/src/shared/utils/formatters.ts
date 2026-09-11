export function formatPhoneNumber(phone?: string): string {
  if (!phone) return "";
  const cleaned = phone.replace(/\D/g, "");
  let digits = cleaned;
  if (digits.startsWith("84") && digits.length === 11) {
    digits = "0" + digits.slice(2);
  }
  if (digits.length === 10) {
    return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 10)}`;
  }
  if (digits.length === 11) {
    return `${digits.slice(0, 3)} ${digits.slice(3, 7)} ${digits.slice(7, 11)}`;
  }
  return phone;
}

export function formatDateOnly(dateTime?: string): string {
  if (!dateTime) return "";

  const value = dateTime.trim();
  if (!value) return "";

  const vietnameseDate = value.match(/(?:^|\s)(\d{1,2})\/(\d{1,2})\/(\d{4})(?=$|[,\s])/);
  if (vietnameseDate) {
    const [, day, month, year] = vietnameseDate;
    return `${day.padStart(2, "0")}/${month.padStart(2, "0")}/${year}`;
  }

  const isoDate = value.match(/(?:^|\s)(\d{4})-(\d{1,2})-(\d{1,2})(?=$|[T\s])/);
  if (isoDate) {
    const [, year, month, day] = isoDate;
    return `${day.padStart(2, "0")}/${month.padStart(2, "0")}/${year}`;
  }

  return value;
}

export function validateDateOfBirth(
  dob: string,
  t?: (key: string, params?: Record<string, string | number>) => string
): { isValid: boolean; error?: string; errorCode?: string } {
  const trimmed = dob?.trim();
  if (!trimmed) {
    return {
      isValid: false,
      errorCode: "validation.required",
      error: t ? t("validation.required") : "validation.required",
    };
  }

  let day: number, month: number, year: number;

  const vnMatch = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  const isoMatch = trimmed.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);

  if (vnMatch) {
    day = parseInt(vnMatch[1], 10);
    month = parseInt(vnMatch[2], 10);
    year = parseInt(vnMatch[3], 10);
  } else if (isoMatch) {
    year = parseInt(isoMatch[1], 10);
    month = parseInt(isoMatch[2], 10);
    day = parseInt(isoMatch[3], 10);
  } else {
    return {
      isValid: false,
      errorCode: "validation.dob_format",
      error: t ? t("validation.dob_format") : "validation.dob_format",
    };
  }

  const currentYear = new Date().getFullYear();
  if (year < 1900 || year > currentYear) {
    return {
      isValid: false,
      errorCode: "validation.dob_year_range",
      error: t ? t("validation.dob_year_range", { currentYear }) : "validation.dob_year_range",
    };
  }

  if (month < 1 || month > 12) {
    return {
      isValid: false,
      errorCode: "validation.dob_month_invalid",
      error: t ? t("validation.dob_month_invalid") : "validation.dob_month_invalid",
    };
  }

  const daysInMonth = new Date(year, month, 0).getDate();
  if (day < 1 || day > daysInMonth) {
    return {
      isValid: false,
      errorCode: "validation.dob_day_invalid",
      error: t ? t("validation.dob_day_invalid", { month, year, daysInMonth }) : "validation.dob_day_invalid",
    };
  }

  const dateObj = new Date(Date.UTC(year, month - 1, day));
  if (dateObj.getTime() > Date.now()) {
    return {
      isValid: false,
      errorCode: "validation.dob_future",
      error: t ? t("validation.dob_future") : "validation.dob_future",
    };
  }

  return { isValid: true };
}

export function validateBirthDateString(val?: string | null): { isValid: boolean; error?: string } {
  if (!val || !val.trim()) {
    return { isValid: true };
  }
  return validateDateOfBirth(val);
}

export const onlyDigits = (value: string, maxLength: number) =>
  value.replace(/\D/g, "").slice(0, maxLength);

export const formatDateDigits = (value: string) => {
  const digits = onlyDigits(value, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
};
