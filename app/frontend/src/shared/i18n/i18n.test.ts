import { describe, it, expect } from "vitest";
import {
  translate,
  translations,
  getLocale,
  formatDateLocale,
  formatShortDateLocale,
} from "./index";

describe("i18n Translation System", () => {
  describe("translate() in English mode", () => {
    it("returns English strings for common and navigation keys", () => {
      expect(translate("Tiếng Anh", "system_name")).toBe("Contributor Management");
      expect(translate("Tiếng Anh", "admin_view")).toBe("Administrator View");
      expect(translate("Tiếng Anh", "ctv_view")).toBe("Contributor View");
      expect(translate("Tiếng Anh", "save")).toBe("Save changes");
      expect(translate("Tiếng Anh", "cancel")).toBe("Cancel");
      expect(translate("Tiếng Anh", "close")).toBe("Close");
      expect(translate("Tiếng Anh", "confirm")).toBe("Confirm");
      expect(translate("Tiếng Anh", "delete")).toBe("Delete");
    });

    it("returns English strings for domain-specific keys", () => {
      expect(translate("Tiếng Anh", "role_admin")).toBe("Administrator");
      expect(translate("Tiếng Anh", "role_ctv")).toBe("Contributor");
      expect(translate("Tiếng Anh", "status_active")).toBe("Active");
      expect(translate("Tiếng Anh", "status_pending")).toBe("Pending");
      expect(translate("Tiếng Anh", "morning_shift")).toBe("Morning");
      expect(translate("Tiếng Anh", "afternoon_shift")).toBe("Afternoon");
    });

    it("returns English strings from nested domain modules", () => {
      expect(translate("Tiếng Anh", "auth.login_title")).toBe("Contributor Management");
      expect(translate("Tiếng Anh", "auth.login_subtitle")).toBe("Log in to continue to the system");
      expect(translate("Tiếng Anh", "auth.org_name")).toBe("Academy of Military Science and Technology");
      expect(translate("Tiếng Anh", "auth.logo_alt")).toBe("Academy of Military Science and Technology Logo");
      expect(translate("Tiếng Anh", "auth.account_pending_approval")).toBe("The account is awaiting approval");
      expect(translate("Tiếng Anh", "accounts.title")).toBe("Account Management");
      expect(translate("Tiếng Anh", "schedule.title")).toBe("Work Schedule");
      expect(translate("Tiếng Anh", "profile.title")).toBe("Personal Profile");
    });
  });

  describe("translate() in Vietnamese mode", () => {
    it("returns Vietnamese strings for common and navigation keys", () => {
      expect(translate("Tiếng Việt", "system_name")).toBe("Hệ thống Quản lý CTV");
      expect(translate("Tiếng Việt", "admin_view")).toBe("Giao diện Quản trị viên");
      expect(translate("Tiếng Việt", "ctv_view")).toBe("Giao diện Cộng tác viên");
      expect(translate("Tiếng Việt", "save")).toBe("Lưu thay đổi");
      expect(translate("Tiếng Việt", "cancel")).toBe("Hủy");
      expect(translate("Tiếng Việt", "close")).toBe("Đóng");
      expect(translate("Tiếng Việt", "confirm")).toBe("Xác nhận");
      expect(translate("Tiếng Việt", "delete")).toBe("Xóa");
    });

    it("returns Vietnamese strings for domain-specific keys", () => {
      expect(translate("Tiếng Việt", "role_admin")).toBe("Quản trị viên");
      expect(translate("Tiếng Việt", "role_ctv")).toBe("Cộng tác viên");
      expect(translate("Tiếng Việt", "status_active")).toBe("Kích hoạt");
      expect(translate("Tiếng Việt", "status_pending")).toBe("Chờ duyệt");
      expect(translate("Tiếng Việt", "morning_shift")).toBe("Ca Sáng");
      expect(translate("Tiếng Việt", "afternoon_shift")).toBe("Ca Chiều");
    });

    it("returns Vietnamese strings from nested domain modules", () => {
      expect(translate("Tiếng Việt", "auth.login_title")).toBe("Hệ thống Quản lý CTV");
      expect(translate("Tiếng Việt", "auth.login_subtitle")).toBe("Đăng nhập để tiếp tục vào hệ thống");
      expect(translate("Tiếng Việt", "auth.account_pending_approval")).toBe("Tài khoản đang được chờ duyệt");
      expect(translate("Tiếng Việt", "accounts.title")).toBe("Quản lý tài khoản");
      expect(translate("Tiếng Việt", "schedule.title")).toBe("Lịch làm việc");
      expect(translate("Tiếng Việt", "profile.title")).toBe("Hồ sơ cá nhân");
    });
  });

  describe("Parameter interpolation", () => {
    it("replaces {{param}} in translations", () => {
      const enResult = translate("Tiếng Anh", "accounts.view_profile_title", { name: "Nguyen Van A" });
      expect(enResult).toBe("View detailed profile of Nguyen Van A");

      const viResult = translate("Tiếng Việt", "accounts.view_profile_title", { name: "Nguyễn Văn A" });
      expect(viResult).toBe("Xem hồ sơ chi tiết của Nguyễn Văn A");
    });

    it("replaces {param} single brace format", () => {
      const result = translate("Tiếng Anh", "Welcome {name} to {place}", { name: "Alice", place: "Office" });
      expect(result).toBe("Welcome Alice to Office");
    });

    it("replaces {{ param }} with spaces inside braces", () => {
      const result = translate("Tiếng Anh", "Hello {{ name }}!", { name: "Bob" });
      expect(result).toBe("Hello Bob!");
    });

    it("handles numeric parameters", () => {
      const enResult = translate("Tiếng Anh", "pagination.aria_page", { page: 3 });
      expect(enResult).toBe("Page 3");

      const viResult = translate("Tiếng Việt", "pagination.aria_page", { page: 3 });
      expect(viResult).toBe("Trang 3");
    });

    it("interpolates multiple parameters in a single string", () => {
      const result = translate("Tiếng Anh", "User {user} registered on {date}", {
        user: "admin",
        date: "2026-09-11",
      });
      expect(result).toBe("User admin registered on 2026-09-11");
    });
  });

  describe("Locale symmetry and completeness", () => {
    const viKeys = Object.keys(translations["Tiếng Việt"]);
    const enKeys = Object.keys(translations["Tiếng Anh"]);

    it("contains translations for both Vietnamese and English", () => {
      expect(viKeys.length).toBeGreaterThan(0);
      expect(enKeys.length).toBeGreaterThan(0);
    });

    it("every key in translations['Tiếng Việt'] exists in translations['Tiếng Anh']", () => {
      const missingInEn: string[] = [];
      for (const key of viKeys) {
        if (!(key in translations["Tiếng Anh"])) {
          missingInEn.push(key);
        }
      }
      expect(missingInEn).toEqual([]);
    });

    it("every key in translations['Tiếng Anh'] exists in translations['Tiếng Việt']", () => {
      const missingInVi: string[] = [];
      for (const key of enKeys) {
        if (!(key in translations["Tiếng Việt"])) {
          missingInVi.push(key);
        }
      }
      expect(missingInVi).toEqual([]);
    });

    it("every translation in 'Tiếng Việt' is a non-empty string", () => {
      const emptyViKeys: string[] = [];
      for (const key of viKeys) {
        const val = translations["Tiếng Việt"][key];
        if (typeof val !== "string" || val.trim().length === 0) {
          emptyViKeys.push(key);
        }
      }
      expect(emptyViKeys).toEqual([]);
    });

    it("every translation in 'Tiếng Anh' is a non-empty string", () => {
      const emptyEnKeys: string[] = [];
      for (const key of enKeys) {
        const val = translations["Tiếng Anh"][key];
        if (typeof val !== "string" || val.trim().length === 0) {
          emptyEnKeys.push(key);
        }
      }
      expect(emptyEnKeys).toEqual([]);
    });

    it("both locales have exactly the same number of keys", () => {
      expect(viKeys.length).toBe(enKeys.length);
    });
  });

  describe("Locale and Date Helpers", () => {
    it("returns correct BCP 47 locale", () => {
      expect(getLocale("Tiếng Việt")).toBe("vi-VN");
      expect(getLocale("Tiếng Anh")).toBe("en-US");
    });

    it("formats dates with locale-aware format", () => {
      const sampleDate = new Date("2026-09-11T12:00:00Z");
      const viFormatted = formatDateLocale(sampleDate, "Tiếng Việt");
      const enFormatted = formatDateLocale(sampleDate, "Tiếng Anh");

      expect(viFormatted).toBeTruthy();
      expect(enFormatted).toBeTruthy();
    });

    it("formats short dates correctly", () => {
      const sampleDate = "2026-09-11T12:00:00Z";
      const viShort = formatShortDateLocale(sampleDate, "Tiếng Việt");
      const enShort = formatShortDateLocale(sampleDate, "Tiếng Anh");

      expect(viShort).toBeTruthy();
      expect(enShort).toBeTruthy();
    });
  });
});
