import React, { useState, useEffect, useMemo } from "react";
import { UserAccount, ShiftSlot } from "../../types";
import { formatPhoneNumber } from "../../utils/formatters";

interface ViewAccountDetailModalProps {
  account: UserAccount | null;
  shifts?: ShiftSlot[];
  onClose: () => void;
  onToggleStatus: (id: string) => void;
  onSaveNotes?: (id: string, notes: string) => void;
  onEndSchedule?: (id: string, startDate: string, endDate: string, reason: string) => void;
  onResetPassword?: (id: string, newPassword: string, requireChangeOnLogin: boolean) => void;
}

const DEFAULT_CCCD_FRONT =
  "https://images.unsplash.com/photo-1557804506-669a67965ba0?auto=format&fit=crop&w=600&q=80";
const DEFAULT_CCCD_BACK =
  "https://images.unsplash.com/photo-1586281380349-632531db7ed4?auto=format&fit=crop&w=600&q=80";

const WEEKDAYS = [
  { index: 0, dayName: "Thứ 2", shortName: "T2", dateStr: "06/07" },
  { index: 1, dayName: "Thứ 3", shortName: "T3", dateStr: "07/07" },
  { index: 2, dayName: "Thứ 4", shortName: "T4", dateStr: "08/07" },
  { index: 3, dayName: "Thứ 5", shortName: "T5", dateStr: "09/07" },
  { index: 4, dayName: "Thứ 6", shortName: "T6", dateStr: "10/07" },
];

export const ViewAccountDetailModal: React.FC<ViewAccountDetailModalProps> = ({
  account,
  shifts = [],
  onClose,
  onSaveNotes,
  onEndSchedule,
  onResetPassword,
}) => {
  const [previewImg, setPreviewImg] = useState<{ title: string; url: string } | null>(null);
  const [previewDoc, setPreviewDoc] = useState<{
    fileName: string;
    fileSize: string;
    isPdf: boolean;
  } | null>(null);
  const [showWorkHistory, setShowWorkHistory] = useState<boolean>(false);
  const [historyDate, setHistoryDate] = useState<Date>(() => new Date());

  const [notesText, setNotesText] = useState(account?.notes || "");
  const [isSavedNotes, setIsSavedNotes] = useState(false);

  // End Schedule Popup states
  const [isEndScheduleModalOpen, setIsEndScheduleModalOpen] = useState(false);
  const [endScheduleEndDate, setEndScheduleEndDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [endScheduleReason, setEndScheduleReason] = useState("");
  const [endScheduleError, setEndScheduleError] = useState("");

  useEffect(() => {
    setNotesText(account?.notes || "");
    setIsSavedNotes(false);
  }, [account?.id, account?.notes]);

  // Compute registered start date for this CTV
  const userRegisteredStartDateISO = useMemo(() => {
    if (!account) return new Date().toISOString().split("T")[0];
    const userShifts = shifts.filter((s) =>
      (s.assignedCTVs || []).some((c) => c.id === account.id || c.name === account.name),
    );

    let earliest = "";
    userShifts.forEach((s) => {
      const candidate = s.registrationStartDate || s.workDate;
      if (candidate && /^\d{4}-\d{2}-\d{2}$/.test(candidate)) {
        if (!earliest || candidate < earliest) {
          earliest = candidate;
        }
      }
    });

    if (earliest) return earliest;

    if (account.joinDate) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(account.joinDate)) return account.joinDate;
      if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(account.joinDate)) {
        const parts = account.joinDate.split("/");
        return `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
      }
    }
    if (account.registerDate) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(account.registerDate)) return account.registerDate;
      if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(account.registerDate)) {
        const parts = account.registerDate.split("/");
        return `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
      }
    }

    return new Date().toISOString().split("T")[0];
  }, [account, shifts]);

  const userRegisteredStartDateFormatted = useMemo(() => {
    if (!userRegisteredStartDateISO) return "";
    const parts = userRegisteredStartDateISO.split("-");
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return userRegisteredStartDateISO;
  }, [userRegisteredStartDateISO]);

  if (!account) return null;

  const handleSaveNotes = () => {
    if (account) {
      if (onSaveNotes) {
        onSaveNotes(account.id, notesText);
      }
      setIsSavedNotes(true);
      setTimeout(() => setIsSavedNotes(false), 2000);
    }
  };

  const formatDisplayDate = (isoStr: string) => {
    if (!isoStr) return "";
    const parts = isoStr.split("-");
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return isoStr;
  };

  const handleConfirmEndSchedule = () => {
    if (!endScheduleEndDate) {
      setEndScheduleError("Vui lòng chọn ngày kết thúc làm việc.");
      return;
    }
    if (endScheduleEndDate < userRegisteredStartDateISO) {
      setEndScheduleError("Ngày kết thúc không thể trước ngày bắt đầu đăng ký làm việc.");
      return;
    }
    if (onEndSchedule && account) {
      onEndSchedule(
        account.id,
        userRegisteredStartDateFormatted,
        formatDisplayDate(endScheduleEndDate),
        endScheduleReason,
      );
    }
    setIsEndScheduleModalOpen(false);
  };

  const toISODate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const formatShortDate = (date: Date) => {
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    return `${day}/${month}`;
  };

  const todayISO = toISODate(new Date());
  const todayWeekdayIndex = (new Date().getDay() + 6) % 7;

  const changeHistoryMonth = (amount: number) => {
    setHistoryDate((current) => new Date(current.getFullYear(), current.getMonth() + amount, 1));
  };

  const monthStart = new Date(historyDate.getFullYear(), historyDate.getMonth(), 1);
  const monthWeeks: Array<Array<Date | null>> = [];
  let currentMonthWeek: Array<Date | null> = [null, null, null, null, null];
  const daysInMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate();

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(monthStart.getFullYear(), monthStart.getMonth(), day);
    const weekDay = date.getDay();
    if (weekDay < 1 || weekDay > 5) continue;

    currentMonthWeek[weekDay - 1] = date;
    if (weekDay === 5) {
      monthWeeks.push(currentMonthWeek);
      currentMonthWeek = [null, null, null, null, null];
    }
  }

  if (currentMonthWeek.some(Boolean)) monthWeeks.push(currentMonthWeek);

  const getHistoryShift = (date: Date, shiftType: "morning" | "afternoon") => {
    const dateISO = toISODate(date);

    return shifts.find(
      (s) =>
        s.workDate === dateISO &&
        s.shiftType === shiftType &&
        (s.assignedCTVs || []).some((c) => c.id === account.id || c.name === account.name),
    );
  };

  const cccdFrontUrl = account.cccdFront || DEFAULT_CCCD_FRONT;
  const cccdBackUrl = account.cccdBack || DEFAULT_CCCD_BACK;

  const cvFileName =
    account.cvFileName ||
    `CV_${account.name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]/g, "_")}_HoSo.pdf`;
  const cvFileSize = account.cvFileSize || "1.5 MB";
  const isPdf = cvFileName.toLowerCase().endsWith(".pdf");

  const handleDownloadCV = () => {
    if (account.cvFile) {
      const a = document.createElement("a");
      a.href = account.cvFile;
      a.download = cvFileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } else {
      const content = `=========================================
HỒ SƠ ỨNG TUYỂN CỘNG TÁC VIÊN (CV)
=========================================
Họ và tên: ${account.name}
Mã CTV: ${account.cctvCode || "N/A"}
Email: ${account.email}
Số điện thoại: ${account.phone}
Ngày sinh: ${account.dob || "N/A"}
Giới tính: ${account.gender || "N/A"}
Địa chỉ: ${account.address || "N/A"}

PHÒNG LÀM VIỆC ĐƯỢC CHỈ ĐỊNH:
- Phòng / Buồng: ${account.room || account.workRoom || "Buồng 1"}

KỸ NĂNG & CHUYÊN MÔN:
- ${account.skills && account.skills.length > 0 ? account.skills.join("\n- ") : "Kỹ năng chuyên môn, giao tiếp tốt"}

LỊCH SỬ HOẠT ĐỘNG:
- Ngày đăng ký: ${account.registerDate || "N/A"}
- Ngày gia nhập: ${account.joinDate || account.registerDate || "N/A"}
- Số ca hoàn thành: ${account.shiftsCompleted || 0} ca
- Đánh giá trung bình: ${account.rating || 5.0} / 5.0 ⭐
- Trạng thái tài khoản: ${account.status}
`;
      const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = cvFileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  // Check if user has explicit registered shifts in the shifts array
  const userShiftsInArray = shifts.filter((s) =>
    (s.assignedCTVs || []).some((c) => c.id === account.id || c.name === account.name),
  );

  const hasExplicitShifts = userShiftsInArray.length > 0;

  // Helper to get shift status for a specific day and shift type
  const getShiftStatus = (dayIndex: number, shiftType: "morning" | "afternoon") => {
    if (hasExplicitShifts) {
      const match = shifts.find(
        (s) =>
          s.dayIndex === dayIndex &&
          s.shiftType === shiftType &&
          (s.assignedCTVs || []).some((c) => c.id === account.id || c.name === account.name),
      );
      if (match) {
        const ctvObj = (match.assignedCTVs || []).find(
          (c) => c.id === account.id || c.name === account.name,
        );
        return ctvObj?.status === "Chờ duyệt" ? "pending" : "working";
      }
      return "off";
    }

    // Default schedule rules if user has no explicitly logged shifts in the array
    if (account.role === "Admin") {
      return "off"; // Admins do not register work schedules
    }

    // Fallback schedule pattern for CTVs based on account ID
    const charCode = account.id.charCodeAt(account.id.length - 1) || 0;
    if (shiftType === "morning") {
      // Mon, Wed, Fri
      return [0, 2, 4].includes(dayIndex) ? "working" : "off";
    } else {
      // Tue, Thu (or Mon, Wed if charCode is odd)
      return charCode % 2 === 0
        ? [1, 3].includes(dayIndex)
          ? "working"
          : "off"
        : [0, 2, 4].includes(dayIndex)
          ? "working"
          : "off";
    }
  };

  // Determine assigned work room for CTV
  const assignedWorkRoom = (() => {
    if (account.workRoom) return account.workRoom;
    if (account.room) return account.room;
    // Look up in shifts if available
    const userShift = shifts?.find((s) =>
      s.assignedCTVs?.some(
        (c) =>
          c.id === account.id ||
          c.name === account.name ||
          (c.cctvCode && c.cctvCode === account.cctvCode),
      ),
    );
    if (userShift?.room) return userShift.room;

    // Assign consistent default room based on cctvCode or initials
    const codeNum = parseInt(account.cctvCode?.replace(/\D/g, "") || "1", 10);
    const roomList = [
      "Buồng 1",
      "Buồng 2",
      "Phòng Kỹ thuật - Buồng 1",
      "Phòng Điều phối 102",
      "Buồng 3",
    ];
    return roomList[codeNum % roomList.length] || "Buồng 1";
  })();

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-[#25262b] rounded-2xl border border-[#E2E8F0] dark:border-[#3b3d45] shadow-2xl w-full max-w-3xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0] dark:border-[#3b3d45] bg-[#F8FAFC] dark:bg-[#1f2023]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#1b365d]/10 text-[#1b365d] dark:bg-[#1b365d]/30 dark:text-[#87a0cd] flex items-center justify-center font-bold">
              <span className="material-symbols-outlined text-[20px]">badge</span>
            </div>
            <h3 className="text-base font-bold text-[#1b365d] dark:text-[#d6e3ff]">
              Hồ sơ & Lịch trình tài khoản
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-[#74777f] hover:text-[#1b365d] dark:hover:text-white p-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          {/* User Profile Header Card */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl bg-[#F8FAFC] dark:bg-[#1e1f23] border border-[#E2E8F0] dark:border-[#3b3d45]">
            <div className="flex items-center gap-4">
              {account.avatar ? (
                <img
                  src={account.avatar}
                  alt={account.name}
                  className="w-16 h-16 rounded-full object-cover border-2 border-[#1b365d] shadow-xs"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-[#1b365d] text-white flex items-center justify-center font-bold text-xl shadow-xs">
                  {account.initials || account.name.substring(0, 2).toUpperCase()}
                </div>
              )}
              <div>
                <h4 className="text-lg font-bold text-[#1b365d] dark:text-[#d6e3ff]">
                  {account.name}
                </h4>
              </div>
            </div>

            <div className="flex flex-col sm:items-end gap-2 text-xs text-[#74777f] dark:text-[#c4c6cf]">
              <p>
                Ngày đăng ký:{" "}
                <span className="font-semibold text-[#1b365d] dark:text-white">
                  {account.registerDate || account.joinDate || "15/05/2023"}
                </span>
              </p>
            </div>
          </div>

          {/* Section 1: Detailed Profile Info */}
          <div>
            <h5 className="text-xs font-bold text-[#1b365d] dark:text-[#d6e3ff] uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px]">person</span>
              <span>Thông tin cá nhân & Tài khoản</span>
            </h5>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-[#F8FAFC] dark:bg-[#1e1f23] p-4 rounded-xl border border-[#E2E8F0] dark:border-[#3b3d45]">
              <div className="flex justify-between p-2 rounded bg-white dark:bg-[#25262b] border border-[#E2E8F0]/60 dark:border-[#3b3d45]">
                <span className="text-[#74777f]">Họ và tên:</span>
                <span className="font-semibold text-[#1b365d] dark:text-white">{account.name}</span>
              </div>
              <div className="flex justify-between p-2 rounded bg-white dark:bg-[#25262b] border border-[#E2E8F0]/60 dark:border-[#3b3d45]">
                <span className="text-[#74777f]">Email:</span>
                <span className="font-semibold text-[#1b365d] dark:text-white">
                  {account.email}
                </span>
              </div>
              <div className="flex justify-between p-2 rounded bg-white dark:bg-[#25262b] border border-[#E2E8F0]/60 dark:border-[#3b3d45]">
                <span className="text-[#74777f]">Số điện thoại:</span>
                <span className="font-semibold text-[#1b365d] dark:text-white">
                  {formatPhoneNumber(account.phone)}
                </span>
              </div>
              <div className="flex justify-between p-2 rounded bg-white dark:bg-[#25262b] border border-[#E2E8F0]/60 dark:border-[#3b3d45]">
                <span className="text-[#74777f]">Ngày sinh:</span>
                <span className="font-semibold text-[#1b365d] dark:text-white">
                  {account.dob || "15/08/1998"}
                </span>
              </div>
            </div>

            <div className="mt-3 p-3.5 rounded-xl bg-[#F8FAFC] dark:bg-[#1e1f23] border border-[#E2E8F0] dark:border-[#3b3d45]">
              <div className="flex items-center mb-2.5">
                <span className="text-[11px] font-bold text-[#1b365d] dark:text-[#d6e3ff] uppercase tracking-wider flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px]">badge</span>
                  <span>Ảnh chụp CCCD (Mặt trước & Mặt sau)</span>
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div
                  onClick={() =>
                    setPreviewImg({ title: `CCCD Mặt trước - ${account.name}`, url: cccdFrontUrl })
                  }
                  className="relative group rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#25262b] overflow-hidden h-28 cursor-pointer shadow-2xs hover:border-blue-400 transition-all"
                >
                  <img
                    src={cccdFrontUrl}
                    alt="CCCD Mặt trước"
                    className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1 text-white text-xs font-semibold">
                    <span className="material-symbols-outlined text-[18px]">zoom_in</span>
                    <span>Xem mặt trước</span>
                  </div>
                </div>

                <div
                  onClick={() =>
                    setPreviewImg({ title: `CCCD Mặt sau - ${account.name}`, url: cccdBackUrl })
                  }
                  className="relative group rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#25262b] overflow-hidden h-28 cursor-pointer shadow-2xs hover:border-blue-400 transition-all"
                >
                  <img
                    src={cccdBackUrl}
                    alt="CCCD Mặt sau"
                    className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1 text-white text-xs font-semibold">
                    <span className="material-symbols-outlined text-[18px]">zoom_in</span>
                    <span>Xem mặt sau</span>
                  </div>
                </div>
              </div>
            </div>

            {/* CV Document Box */}
            <div className="mt-3 p-3.5 rounded-xl bg-[#F8FAFC] dark:bg-[#1e1f23] border border-[#E2E8F0] dark:border-[#3b3d45]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-[#1b365d] dark:text-[#d6e3ff] uppercase tracking-wider flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px] text-indigo-600 dark:text-indigo-400">
                    description
                  </span>
                  <span>Hồ sơ ứng tuyển (CV)</span>
                </span>
              </div>
              <div className="p-2.5 bg-white dark:bg-[#25262b] border border-slate-200 dark:border-slate-700 rounded-xl flex items-center justify-between gap-3 shadow-2xs">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-2xs ${
                      isPdf
                        ? "bg-red-50 text-red-600 border border-red-200/80 dark:bg-red-950/50 dark:text-red-300 dark:border-red-900/60"
                        : "bg-blue-50 text-blue-600 border border-blue-200/80 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-900/60"
                    }`}
                  >
                    <span className="material-symbols-outlined text-[22px]">
                      {isPdf ? "picture_as_pdf" : "description"}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-[#1a1b1e] dark:text-white truncate">
                      {cvFileName}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <div className="relative group">
                    <button
                      type="button"
                      onClick={() =>
                        setPreviewDoc({
                          fileName: cvFileName,
                          fileSize: cvFileSize,
                          isPdf,
                        })
                      }
                      aria-label="Xem file"
                      className="w-9 h-9 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg transition-colors flex items-center justify-center shadow-2xs cursor-pointer border border-slate-200 dark:border-slate-700"
                    >
                      <span className="material-symbols-outlined text-[18px]">visibility</span>
                    </button>
                    <span
                      role="tooltip"
                      className="pointer-events-none absolute right-0 top-full z-20 mt-2 whitespace-nowrap rounded-lg bg-slate-900 px-2.5 py-1.5 text-[11px] font-semibold text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 dark:bg-slate-100 dark:text-slate-900"
                    >
                      Xem file
                    </span>
                  </div>

                  <div className="relative group">
                    <button
                      type="button"
                      onClick={handleDownloadCV}
                      aria-label="Tải về"
                      className="w-9 h-9 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg transition-colors flex items-center justify-center shadow-2xs cursor-pointer border border-slate-200 dark:border-slate-700"
                    >
                      <span className="material-symbols-outlined text-[18px]">download</span>
                    </button>
                    <span
                      role="tooltip"
                      className="pointer-events-none absolute right-0 top-full z-20 mt-2 whitespace-nowrap rounded-lg bg-slate-900 px-2.5 py-1.5 text-[11px] font-semibold text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 dark:bg-slate-100 dark:text-slate-900"
                    >
                      Tải về
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Monday - Friday Schedule (Ca sáng & Ca chiều) */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
              <h5 className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-slate-100">
                <span
                  className="material-symbols-outlined text-[22px] text-blue-700 dark:text-blue-300"
                  aria-hidden="true"
                >
                  calendar_view_week
                </span>
                <span>Lịch trình làm việc</span>
              </h5>
              <div className="flex items-center gap-2 flex-wrap justify-end">
                {/* Work room badge */}
                {account.role !== "Admin" && (
                  <div
                    title={`Phòng làm việc: ${assignedWorkRoom}`}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50/80 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200 border border-indigo-200/80 dark:border-indigo-800/80 rounded-lg text-xs font-semibold shadow-2xs"
                  >
                    <span className="material-symbols-outlined text-[15px] text-indigo-600 dark:text-indigo-400">
                      meeting_room
                    </span>
                    <span className="font-bold text-[#1b365d] dark:text-[#93c5fd]">
                      {assignedWorkRoom}
                    </span>
                  </div>
                )}
                <div className="group relative">
                  <button
                    type="button"
                    onClick={() => setShowWorkHistory(true)}
                    aria-label="Lịch sử làm việc"
                    className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-slate-200 bg-slate-100 text-slate-700 shadow-2xs transition-colors hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                  >
                    <span className="material-symbols-outlined text-[18px]">history</span>
                  </button>
                  <span
                    role="tooltip"
                    className="pointer-events-none absolute right-0 top-full z-20 mt-2 whitespace-nowrap rounded-lg bg-slate-900 px-2.5 py-1.5 text-[11px] font-semibold text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 dark:bg-slate-100 dark:text-slate-900"
                  >
                    Lịch sử làm việc
                  </span>
                </div>
              </div>
            </div>

            {account.role === "Admin" ? (
              <div className="p-4 bg-slate-50 dark:bg-[#1e1f23] rounded-xl border border-[#E2E8F0] dark:border-[#3b3d45] flex items-center gap-3 text-xs text-slate-600 dark:text-slate-300">
                <span className="material-symbols-outlined text-amber-500 text-[20px]">info</span>
                <span>Tài khoản Quản trị viên (Admin) không tham gia đăng ký lịch làm việc.</span>
              </div>
            ) : (
              <div className="overflow-x-auto pb-1">
                <div className="min-w-[650px] space-y-3">
                  <div className="grid grid-cols-5 gap-3">
                    {WEEKDAYS.map((day) => {
                      const isToday = day.index === todayWeekdayIndex;

                      return (
                        <div
                          key={day.index}
                          className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-center text-xs font-bold uppercase tracking-wider transition-colors ${
                            isToday
                              ? "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300"
                              : "bg-slate-100/90 text-slate-700 dark:bg-slate-800 dark:text-slate-200"
                          }`}
                        >
                          <span>{day.dayName}</span>
                          {isToday && (
                            <span className="rounded-md bg-blue-600 px-1.5 py-0.5 text-[10px] font-bold normal-case tracking-normal text-white">
                              Hôm nay
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div className="grid grid-cols-5 gap-3">
                    {WEEKDAYS.map((day) => {
                      const morning = getShiftStatus(day.index, "morning");
                      const afternoon = getShiftStatus(day.index, "afternoon");
                      const isToday = day.index === todayWeekdayIndex;

                      return (
                        <div
                          key={day.index}
                          className={`min-h-[104px] rounded-2xl border-2 bg-white p-3 shadow-2xs transition-colors dark:bg-slate-900 ${
                            isToday
                              ? "border-blue-600 dark:border-blue-400"
                              : "border-slate-200 dark:border-slate-800"
                          }`}
                        >
                          <div className="space-y-2">
                            {morning !== "off" ? (
                              <div
                                title={morning === "pending" ? "Ca sáng: Chờ duyệt" : "Ca sáng: Đi làm"}
                                className={`flex w-full items-center gap-2 whitespace-nowrap rounded-xl border px-3 py-2 text-xs font-bold shadow-xs ${
                                  morning === "pending"
                                    ? "border-amber-300 bg-amber-100 text-amber-900 dark:border-amber-700 dark:bg-amber-900/50 dark:text-amber-100"
                                    : "border-amber-200/90 bg-amber-50 text-amber-900 dark:border-amber-800/50 dark:bg-amber-950/40 dark:text-amber-200"
                                }`}
                              >
                                <span
                                  className="material-symbols-outlined text-[18px] text-amber-700 dark:text-amber-400"
                                  aria-hidden="true"
                                >
                                  wb_sunny
                                </span>
                                <span>Ca Sáng</span>
                              </div>
                            ) : afternoon !== "off" ? (
                              <div className="h-[38px]" aria-hidden="true" />
                            ) : null}

                            {afternoon !== "off" && (
                              <div
                                title={
                                  afternoon === "pending"
                                    ? "Ca chiều: Chờ duyệt"
                                    : "Ca chiều: Đi làm"
                                }
                                className={`flex w-full items-center gap-2 whitespace-nowrap rounded-xl border px-3 py-2 text-xs font-bold shadow-xs ${
                                  afternoon === "pending"
                                    ? "border-purple-300 bg-purple-100 text-purple-900 dark:border-purple-700 dark:bg-purple-900/50 dark:text-purple-100"
                                    : "border-purple-200/90 bg-purple-50 text-purple-900 dark:border-purple-800/50 dark:bg-purple-950/40 dark:text-purple-200"
                                }`}
                              >
                                <span
                                  className="material-symbols-outlined text-[18px] text-purple-700 dark:text-purple-400"
                                  aria-hidden="true"
                                >
                                  wb_twilight
                                </span>
                                <span>Ca Chiều</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Section 3: Notes (Ghi chú) */}
          <div className="p-4 rounded-xl bg-[#F8FAFC] dark:bg-[#1e1f23] border border-[#E2E8F0] dark:border-[#3b3d45] space-y-2.5">
            <div className="flex items-center justify-between">
              <h5 className="text-xs font-bold text-[#1b365d] dark:text-[#d6e3ff] uppercase tracking-wider flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px] text-amber-600 dark:text-amber-400">
                  edit_note
                </span>
                <span>Ghi chú</span>
              </h5>
              <button
                type="button"
                onClick={handleSaveNotes}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs ${
                  isSavedNotes
                    ? "bg-emerald-600 text-white"
                    : "bg-[#1b365d] hover:bg-[#002046] dark:bg-indigo-600 dark:hover:bg-indigo-700 text-white"
                }`}
              >
                <span className="material-symbols-outlined text-[15px]">
                  {isSavedNotes ? "check_circle" : "save"}
                </span>
                <span>{isSavedNotes ? "Đã lưu" : "Lưu"}</span>
              </button>
            </div>

            <div className="relative">
              <textarea
                value={notesText}
                onChange={(e) => setNotesText(e.target.value)}
                rows={3}
                className="w-full text-xs p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#25262b] text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all resize-none shadow-2xs leading-relaxed"
              />
            </div>

          </div>

        </div>
      </div>

      {/* END SCHEDULE POPUP MODAL */}
      {isEndScheduleModalOpen && (
        <div className="fixed inset-0 z-60 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#25262b] border border-slate-200 dark:border-slate-700 rounded-2xl max-w-lg w-full p-5 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-300 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[18px]">event_busy</span>
                </div>
                <div>
                  <h3 className="font-bold text-sm text-[#1b365d] dark:text-[#d6e3ff]">
                    Kết thúc lịch làm việc
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {account.name} {account.cctvCode ? `• ${account.cctvCode}` : ""}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsEndScheduleModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-full cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>




            {/* Explanation card */}
            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-xl text-amber-800 dark:text-amber-300 text-xs flex items-start gap-2.5">
              <span className="material-symbols-outlined text-[18px] shrink-0 text-amber-600 dark:text-amber-400 mt-0.5">
                info
              </span>
              <p className="leading-relaxed text-[11px]">
                Lịch làm việc từ <strong>ngày bắt đầu</strong> đến <strong>ngày kết thúc</strong>{" "}
                vẫn được ghi nhận. Hệ thống sẽ <strong>tự động loại bỏ các ca đăng ký thừa</strong>{" "}
                sau ngày kết thúc đã chọn để tránh lịch ảo.
              </p>
            </div>

            {/* Date Selection */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Ngày bắt đầu (CTV đã chọn để đăng ký) */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                  <span>Ngày bắt đầu</span>
                  <span className="text-[10px] font-normal text-slate-400">(CTV đã đăng ký)</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    readOnly
                    value={userRegisteredStartDateFormatted}
                    className="w-full text-xs font-semibold p-2.5 pl-8 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 cursor-not-allowed"
                  />
                  <span className="material-symbols-outlined text-[16px] text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2">
                    event_available
                  </span>
                </div>
              </div>

              {/* Ngày kết thúc (Admin sẽ chọn) */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                  <span>Ngày kết thúc</span>
                  <span className="text-rose-500 font-bold">*</span>
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={endScheduleEndDate}
                    min={userRegisteredStartDateISO}
                    onChange={(e) => {
                      setEndScheduleEndDate(e.target.value);
                      if (endScheduleError) setEndScheduleError("");
                    }}
                    className="w-full text-xs font-semibold p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#25262b] text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500/30 focus:border-rose-500 transition-all cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* Lý do kết thúc (Textarea) */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Lý do</label>
              <textarea
                value={endScheduleReason}
                onChange={(e) => {
                  setEndScheduleReason(e.target.value);
                  if (endScheduleError) setEndScheduleError("");
                }}
                placeholder="Nhập lý do kết thúc lịch làm việc (ví dụ: Nghỉ việc đột xuất, bận việc học/cá nhân, hoàn thành kỳ thực tập...)..."
                rows={3}
                className="w-full text-xs p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#25262b] text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500/30 focus:border-rose-500 transition-all resize-none shadow-2xs leading-relaxed"
              />
            </div>

            {endScheduleError && (
              <p className="text-xs font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px]">error</span>
                <span>{endScheduleError}</span>
              </p>
            )}

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setIsEndScheduleModalOpen(false)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleConfirmEndSchedule}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <span className="material-symbols-outlined text-[16px]">check_circle</span>
                <span>Xác nhận</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CCCD LIGHTBOX PREVIEW MODAL */}
      {previewImg && (
        <div className="fixed inset-0 z-60 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#25262b] border border-slate-200 dark:border-slate-700 rounded-2xl max-w-xl w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#1b365d] dark:text-[#87a0cd] text-[20px]">
                  badge
                </span>
                <h3 className="font-bold text-sm text-[#1b365d] dark:text-[#d6e3ff]">
                  {previewImg.title}
                </h3>
              </div>
              <button
                onClick={() => setPreviewImg(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-full cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-900 flex items-center justify-center max-h-[60vh]">
              <img
                src={previewImg.url}
                alt={previewImg.title}
                className="w-full h-auto object-contain max-h-[60vh]"
              />
            </div>
          </div>
        </div>
      )}

      {/* CV DOCUMENT PREVIEW MODAL */}
      {previewDoc && (
        <div className="fixed inset-0 z-60 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#25262b] border border-slate-200 dark:border-slate-700 rounded-2xl max-w-2xl w-full p-5 shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    previewDoc.isPdf
                      ? "bg-red-50 text-red-600 border border-red-200"
                      : "bg-blue-50 text-blue-600 border border-blue-200"
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {previewDoc.isPdf ? "picture_as_pdf" : "description"}
                  </span>
                </div>
                <div>
                  <h3 className="font-bold text-sm text-[#1b365d] dark:text-[#d6e3ff]">
                    {previewDoc.fileName}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {previewDoc.fileSize} • Hồ sơ đính kèm của CTV
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="relative group">
                  <button
                    type="button"
                    onClick={handleDownloadCV}
                    aria-label="Tải file về máy"
                    className="text-[#1b365d] hover:text-indigo-700 hover:bg-indigo-50 dark:text-indigo-300 dark:hover:text-indigo-200 dark:hover:bg-indigo-950/50 p-1.5 rounded-full transition-colors cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[20px]">download</span>
                  </button>
                  <span
                    role="tooltip"
                    className="pointer-events-none absolute right-0 top-full z-10 mt-2 whitespace-nowrap rounded-lg bg-slate-900 px-2.5 py-1.5 text-[11px] font-semibold text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 dark:bg-slate-100 dark:text-slate-900"
                  >
                    Tải file về máy
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setPreviewDoc(null)}
                  aria-label="Đóng cửa sổ xem CV"
                  className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:text-slate-200 dark:hover:bg-slate-800 p-1.5 rounded-full transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>
            </div>

            {/* Document Content Simulation Viewer (Single Clean Border) */}
            <div className="flex-1 overflow-y-auto p-6 bg-white dark:bg-[#1e1f23] rounded-xl border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 space-y-5 font-sans text-xs">
              {/* CV Header */}
              <div className="border-b border-slate-200 dark:border-slate-700 pb-4 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-base font-bold text-[#1b365d] dark:text-white uppercase tracking-wide">
                    {account.name}
                  </h2>
                  <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 mt-0.5">
                    Vị trí ứng tuyển: Cộng tác viên{" "}
                    {account.cctvCode ? `(${account.cctvCode})` : ""}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Phòng làm việc:{" "}
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      {assignedWorkRoom}
                    </span>
                  </p>
                </div>
                <div className="text-right text-[11px] text-slate-500 space-y-0.5 shrink-0">
                  <p>📧 {account.email}</p>
                  <p>📞 {account.phone}</p>
                  <p>📍 {account.address || "TP. Hồ Chí Minh"}</p>
                </div>
              </div>

              {/* Section 1: Thông tin cá nhân */}
              <div>
                <h4 className="text-xs font-bold text-[#1b365d] dark:text-indigo-300 uppercase tracking-wider mb-2 border-b border-slate-100 dark:border-slate-800 pb-1">
                  1. Thông tin chung
                </h4>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <p>
                    <span className="text-slate-500">Ngày sinh:</span>{" "}
                    <span className="font-medium">{account.dob || "Chưa cập nhật"}</span>
                  </p>
                  <p>
                    <span className="text-slate-500">Giới tính:</span>{" "}
                    <span className="font-medium">{account.gender || "Nam"}</span>
                  </p>
                  <p>
                    <span className="text-slate-500">Số CCCD:</span>{" "}
                    <span className="font-medium">{account.cccd || "Đã xác thực"}</span>
                  </p>
                  <p>
                    <span className="text-slate-500">Ngày tham gia:</span>{" "}
                    <span className="font-medium">
                      {account.joinDate || account.registerDate || "01/12/2023"}
                    </span>
                  </p>
                </div>
              </div>

              {/* Section 2: Kỹ năng & Chuyên môn */}
              <div>
                <h4 className="text-xs font-bold text-[#1b365d] dark:text-indigo-300 uppercase tracking-wider mb-2 border-b border-slate-100 dark:border-slate-800 pb-1">
                  2. Kỹ năng & Chuyên môn
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {(
                    account.skills || [
                      "Tin học văn phòng",
                      "Giao tiếp cơ bản",
                      "Hỗ trợ sự kiện",
                      "Làm việc nhóm",
                    ]
                  ).map((skill, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded text-[10px] font-medium"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>

              {/* Section 3: Quá trình hoạt động */}
              <div>
                <h4 className="text-xs font-bold text-[#1b365d] dark:text-indigo-300 uppercase tracking-wider mb-2 border-b border-slate-100 dark:border-slate-800 pb-1">
                  3. Lịch sử & Đánh giá công việc
                </h4>
                <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg text-[11px] space-y-1">
                  <p>
                    • <strong>Số ca đã hoàn thành:</strong> {account.shiftsCompleted || 0} ca trực
                  </p>
                  <p>
                    • <strong>Đánh giá hiệu suất:</strong> {account.rating || 5.0} / 5.0 ⭐ (Đạt
                    chuẩn)
                  </p>
                  <p>
                    • <strong>Tình trạng hồ sơ:</strong> Đã kiểm tra & phê duyệt hợp lệ
                  </p>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* WORK HISTORY MODAL */}
      {showWorkHistory && (
        <div className="fixed inset-0 z-60 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white dark:bg-[#25262b] border border-slate-200 dark:border-slate-700 rounded-2xl max-w-4xl w-full p-5 sm:p-6 shadow-2xl space-y-4 max-h-[90vh] flex flex-col my-auto">
            {/* Header matching image */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-[24px] text-blue-600 dark:text-blue-400">
                  calendar_month
                </span>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Lịch sử làm việc
                </h3>
              </div>

              <div className="flex items-center gap-3">
                <div
                  className="inline-flex min-h-10 items-center rounded-xl border border-slate-200 bg-slate-100/90 p-1 shadow-2xs dark:border-slate-700 dark:bg-slate-900"
                  role="group"
                  aria-label="Chuyển tháng"
                >
                  <button
                    type="button"
                    onClick={() => changeHistoryMonth(-1)}
                    className="flex min-h-8 min-w-8 items-center justify-center rounded-lg text-slate-700 transition-colors hover:bg-white focus:outline-none dark:text-slate-200 dark:hover:bg-slate-800 cursor-pointer"
                    aria-label="Xem tháng trước"
                  >
                    <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                  </button>
                  <span className="min-w-[120px] px-2 text-center text-xs font-bold text-slate-900 dark:text-slate-100">
                    Tháng {historyDate.getMonth() + 1}, {historyDate.getFullYear()}
                  </span>
                  <button
                    type="button"
                    onClick={() => changeHistoryMonth(1)}
                    className="flex min-h-8 min-w-8 items-center justify-center rounded-lg text-slate-700 transition-colors hover:bg-white focus:outline-none dark:text-slate-200 dark:hover:bg-slate-800 cursor-pointer"
                    aria-label="Xem tháng sau"
                  >
                    <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setShowWorkHistory(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>
            </div>

            {/* Grid calendar */}
            <div className="overflow-y-auto overflow-x-auto flex-1 pr-3 sm:pr-4 pb-2">
              <div className="min-w-[780px] space-y-3 mr-1">
                {/* 5 Column Weekday Header */}
                <div className="grid grid-cols-5 gap-3">
                  {["THỨ 2", "THỨ 3", "THỨ 4", "THỨ 5", "THỨ 6"].map((dayName, idx) => (
                    <div
                      key={idx}
                      className="rounded-xl border border-slate-200/80 bg-slate-100/90 py-2.5 text-center text-xs font-bold uppercase tracking-wider text-slate-700 dark:border-slate-800 dark:bg-[#1f2023] dark:text-slate-200"
                    >
                      {dayName}
                    </div>
                  ))}
                </div>

                {/* Weeks Rows */}
                <div className="space-y-3">
                  {monthWeeks.map((week, weekIndex) => (
                    <div key={weekIndex} className="grid grid-cols-5 gap-3">
                      {week.map((date, dayIndex) => {
                        if (!date) {
                          return (
                            <div
                              key={dayIndex}
                              className="min-h-[140px] rounded-2xl border border-dashed border-slate-200 bg-slate-50/40 opacity-40 dark:border-slate-800/60 dark:bg-[#1f2023]/30"
                            />
                          );
                        }

                        const dateISO = toISODate(date);
                        const isToday = dateISO === todayISO;
                        const dayStr = formatShortDate(date);
                        const morningShift = getHistoryShift(date, "morning");
                        const afternoonShift = getHistoryShift(date, "afternoon");

                        return (
                          <div
                            key={dateISO}
                            className={`flex min-h-[140px] flex-col justify-start rounded-2xl border p-3 transition-all ${
                              isToday
                                ? "border-blue-600 bg-white ring-2 ring-blue-600/30 dark:border-blue-500 dark:bg-slate-900"
                                : "border-slate-200/90 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-[#222327] dark:hover:border-slate-700"
                            }`}
                          >
                            <div className="mb-2.5 flex items-center justify-center gap-1.5 text-center">
                              <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                                {dayStr}
                              </span>
                              {isToday && (
                                <span className="rounded bg-blue-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                                  Hôm nay
                                </span>
                              )}
                            </div>

                            <div className="space-y-2 flex-1">
                              {morningShift ? (
                                <div
                                  className="flex w-full items-center gap-2 rounded-xl border border-amber-200/90 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-900 shadow-xs select-none pointer-events-none transition-colors dark:border-amber-800/50 dark:bg-amber-950/40 dark:text-amber-200"
                                >
                                  <span
                                    className="material-symbols-outlined text-[18px] text-amber-700 dark:text-amber-400"
                                    aria-hidden="true"
                                  >
                                    wb_sunny
                                  </span>
                                  <span className="text-amber-900 dark:text-amber-100">Ca Sáng</span>
                                </div>
                              ) : afternoonShift ? (
                                <div className="h-[38px]" aria-hidden="true" />
                              ) : null}

                              {afternoonShift && (
                                <div
                                  className="flex w-full items-center gap-2 rounded-xl border border-purple-200/90 bg-purple-50 px-3 py-2 text-xs font-bold text-purple-900 shadow-xs select-none pointer-events-none transition-colors dark:border-purple-800/50 dark:bg-purple-950/40 dark:text-purple-200"
                                >
                                  <span
                                    className="material-symbols-outlined text-[18px] text-purple-700 dark:text-purple-400"
                                    aria-hidden="true"
                                  >
                                    wb_twilight
                                  </span>
                                  <span className="text-purple-900 dark:text-purple-100">Ca Chiều</span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
