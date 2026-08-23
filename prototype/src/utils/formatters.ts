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
