import React, { useState } from "react";
import { ShiftSlot, UserAccount, AssignedCTV } from "../../types";
import { CTVScheduleWorkspace } from "./CTVScheduleWorkspace";

interface ScheduleScreenProps {
  shifts: ShiftSlot[];
  accounts: UserAccount[];
  onUpdateShifts: (updatedShifts: ShiftSlot[]) => void;
  onShowToast: (msg: string) => void;
  onViewAccountDetail?: (account: UserAccount) => void;
  currentUser?: UserAccount;
  userRole?: "Admin" | "Cộng tác viên";
}

type ViewMode = "my_schedule" | "grid" | "ctv";

export const ScheduleScreen: React.FC<ScheduleScreenProps> = ({
  shifts,
  accounts,
  onUpdateShifts,
  onShowToast,
  onViewAccountDetail,
  currentUser,
  userRole = "Admin",
}) => {
  const isCTV = userRole === "Cộng tác viên";
  const [viewMode, setViewMode] = useState<ViewMode>(isCTV ? "my_schedule" : "grid");
  const [isGateOpen, setIsGateOpen] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedShiftFilter, setSelectedShiftFilter] = useState<
    "all" | "morning" | "afternoon" | "evening"
  >("all");
  const [pendingOnlyFilter, setPendingOnlyFilter] = useState(false);

  // Active CTV user object fallback
  const ctvUser = currentUser || accounts.find((a) => a.role === "Cộng tác viên") || accounts[0];

  // CTV Shift Handlers
  const handleRegisterMyShift = (
    dayIndex: number,
    shiftType: "morning" | "afternoon" | "evening",
  ) => {
    if (!isGateOpen) {
      onShowToast("Cổng đăng ký ca hiện đang đóng!");
      return;
    }

    let slot = shifts.find((s) => s.dayIndex === dayIndex && s.shiftType === shiftType);
    const dayObj = daysHeader.find((d) => d.index === dayIndex);

    const newCTV: AssignedCTV = {
      id: ctvUser.id,
      name: ctvUser.name,
      avatar: ctvUser.avatar,
      initials: ctvUser.initials || ctvUser.name.slice(0, 2).toUpperCase(),
      phone: ctvUser.phone,
      cctvCode: ctvUser.cctvCode,
      status: "Chờ duyệt",
    };

    let updatedShifts: ShiftSlot[];

    if (slot) {
      const isAlreadyAssigned = (slot.assignedCTVs || []).some((c) => c.id === ctvUser.id);
      if (isAlreadyAssigned) {
        onShowToast("Bạn đã đăng ký ca này rồi!");
        return;
      }
      updatedShifts = shifts.map((s) => {
        if (s.id !== slot!.id) return s;
        return {
          ...s,
          assignedCTVs: [...(s.assignedCTVs || []), newCTV],
          status: "Chờ duyệt" as const,
        };
      });
    } else {
      const newSlot: ShiftSlot = {
        id: `shift-${Date.now()}`,
        dayIndex,
        dayName: dayObj?.label || "Thứ 2",
        dateStr: dayObj?.date || "06/07",
        shiftType,
        shiftTimeLabel:
          shiftType === "morning"
            ? "08:00 - 12:00"
            : shiftType === "afternoon"
              ? "13:30 - 17:30"
              : "18:00 - 21:00",
        status: "Chờ duyệt",
        allowRegister: true,
        assignedCTVs: [newCTV],
      };
      updatedShifts = [...shifts, newSlot];
    }

    onUpdateShifts(updatedShifts);
    onShowToast(
      `Đã gửi yêu cầu đăng ký ca ${shiftType === "morning" ? "Sáng" : shiftType === "afternoon" ? "Chiều" : "Tối"} ${dayObj?.label}!`,
    );
  };

  const handleCancelMyShift = (
    dayIndex: number,
    shiftType: "morning" | "afternoon" | "evening",
  ) => {
    const slot = shifts.find((s) => s.dayIndex === dayIndex && s.shiftType === shiftType);
    if (!slot) return;

    const updatedShifts = shifts.map((s) => {
      if (s.id !== slot.id) return s;
      const updatedCTVs = (s.assignedCTVs || []).filter((c) => c.id !== ctvUser.id);
      return {
        ...s,
        assignedCTVs: updatedCTVs,
        status: updatedCTVs.length > 0 ? ("Đã đăng ký" as const) : ("Chưa đăng ký" as const),
      };
    });

    onUpdateShifts(updatedShifts);
    onShowToast("Đã hủy đăng ký ca làm việc thành công!");
  };

  const handleSaveRegistration = () => {
    onShowToast("Đã lưu lịch đăng ký ca làm việc thành công!");
    setIsRegistrationMode(false);
  };

  // Modals & Sub-views state
  const [isRegistrationMode, setIsRegistrationMode] = useState(false);
  const [selectedCell, setSelectedCell] = useState<{
    dayIndex: number;
    shiftType: "morning" | "afternoon" | "evening";
  } | null>(null);
  const [isQuickAssignOpen, setIsQuickAssignOpen] = useState(false);

  // Leave request modal state
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [leaveShiftType, setLeaveShiftType] = useState("today_morning");
  const [leaveReason, setLeaveReason] = useState("Bận việc cá nhân");
  const [leaveNote, setLeaveNote] = useState("");

  // Quick Assign form state
  const [assignUser, setAssignUser] = useState("");
  const [assignDay, setAssignDay] = useState(0);
  const [assignType, setAssignType] = useState<"morning" | "afternoon" | "evening">("morning");

  // Days of current week (Monday to Friday)
  const daysHeader = [
    { label: "Thứ 2", date: "06/07", isWeekend: false, isSunday: false, index: 0 },
    { label: "Thứ 3", date: "07/07", isWeekend: false, isSunday: false, index: 1 },
    { label: "Thứ 4", date: "08/07", isWeekend: false, isSunday: false, index: 2 },
    { label: "Thứ 5", date: "09/07", isWeekend: false, isSunday: false, index: 3 },
    { label: "Thứ 6", date: "10/07", isWeekend: false, isSunday: false, index: 4 },
  ];

  // Shift row definitions
  const shiftTypes: Array<{
    type: "morning" | "afternoon" | "evening";
    name: string;
    timeLabel: string;
    icon: string;
    badgeBg: string;
  }> = [
    {
      type: "morning",
      name: "Buổi Sáng",
      timeLabel: "08:00 - 12:00",
      icon: "wb_sunny",
      badgeBg: "bg-amber-50 text-amber-700 border-amber-200",
    },
    {
      type: "afternoon",
      name: "Buổi Chiều",
      timeLabel: "13:30 - 17:30",
      icon: "wb_twilight",
      badgeBg: "bg-purple-50 text-purple-700 border-purple-200",
    },
  ];

  // Helper to get shift slot object
  const getSlot = (
    dayIndex: number,
    shiftType: "morning" | "afternoon" | "evening",
  ): ShiftSlot | undefined => {
    return shifts.find((s) => s.dayIndex === dayIndex && s.shiftType === shiftType);
  };

  // Helper to filter CTVs within a slot based on search term
  const getFilteredCTVs = (ctvs: AssignedCTV[] = []) => {
    const nonAdminCTVs = ctvs.filter((c) => {
      const userAcc = accounts.find(
        (a) => a.id === c.id || a.name.toLowerCase() === c.name.toLowerCase(),
      );
      return !userAcc || userAcc.role !== "Admin";
    });
    if (!searchTerm.trim() && !pendingOnlyFilter) return nonAdminCTVs;
    return nonAdminCTVs.filter((c) => {
      const matchesSearch =
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.cctvCode && c.cctvCode.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (c.phone && c.phone.includes(searchTerm));
      const matchesPending = pendingOnlyFilter ? c.status === "Chờ duyệt" : true;
      return matchesSearch && matchesPending;
    });
  };

  // KPI Statistics
  const totalAssignedSlots = shifts.reduce(
    (acc, s) =>
      acc +
      (s.assignedCTVs
        ? s.assignedCTVs.filter((c) => {
            const userAcc = accounts.find(
              (a) => a.id === c.id || a.name.toLowerCase() === c.name.toLowerCase(),
            );
            return c.status === "Đã duyệt" && (!userAcc || userAcc.role !== "Admin");
          }).length
        : 0),
    0,
  );

  const pendingApprovalCount = shifts.reduce(
    (acc, s) =>
      acc +
      (s.assignedCTVs
        ? s.assignedCTVs.filter((c) => {
            const userAcc = accounts.find(
              (a) => a.id === c.id || a.name.toLowerCase() === c.name.toLowerCase(),
            );
            return c.status === "Chờ duyệt" && (!userAcc || userAcc.role !== "Admin");
          }).length
        : 0),
    0,
  );

  const uniqueScheduledCTVs = new Set(
    shifts.flatMap((s) =>
      (s.assignedCTVs || [])
        .filter((c) => {
          const userAcc = accounts.find(
            (a) => a.id === c.id || a.name.toLowerCase() === c.name.toLowerCase(),
          );
          return !userAcc || userAcc.role !== "Admin";
        })
        .map((c) => c.id),
    ),
  ).size;

  const activeAccounts = accounts.filter((a) => a.role !== "Admin");

  // Handlers for Shift CTV Operations
  const handleApproveCTVInShift = (shiftId: string, ctvId: string) => {
    const updated = shifts.map((s) => {
      if (s.id !== shiftId) return s;
      const updatedCTVs = (s.assignedCTVs || []).map((c) =>
        c.id === ctvId ? { ...c, status: "Đã duyệt" as const } : c,
      );
      return { ...s, assignedCTVs: updatedCTVs };
    });
    onUpdateShifts(updated);
    onShowToast("Đã phê duyệt lịch làm việc cho CTV");
  };

  const handleRemoveCTVFromShift = (shiftId: string, ctvId: string) => {
    const updated = shifts.map((s) => {
      if (s.id !== shiftId) return s;
      const updatedCTVs = (s.assignedCTVs || []).filter((c) => c.id !== ctvId);
      return { ...s, assignedCTVs: updatedCTVs };
    });
    onUpdateShifts(updated);
    onShowToast("Đã xóa CTV khỏi ca làm việc");
  };

  const handleAddCTVToShiftSlot = (shiftId: string, ctvUser: UserAccount) => {
    const slot = shifts.find((s) => s.id === shiftId);
    if (!slot) return;

    const existing = (slot.assignedCTVs || []).find((c) => c.id === ctvUser.id);
    if (existing) {
      onShowToast(`${ctvUser.name} đã có trong ca này!`);
      return;
    }

    const newCTV: AssignedCTV = {
      id: ctvUser.id,
      name: ctvUser.name,
      avatar: ctvUser.avatar,
      initials: ctvUser.initials || ctvUser.name.slice(0, 2).toUpperCase(),
      phone: ctvUser.phone,
      cctvCode: ctvUser.cctvCode,
      status: "Đã duyệt",
    };

    const updated = shifts.map((s) => {
      if (s.id !== shiftId) return s;
      return {
        ...s,
        assignedCTVs: [...(s.assignedCTVs || []), newCTV],
        status: "Đã đăng ký" as const,
      };
    });

    onUpdateShifts(updated);
    onShowToast(`Đã thêm ${ctvUser.name} vào ca`);
  };

  // Quick Assign submit handler
  const handleQuickAssignSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignUser) {
      onShowToast("Vui lòng chọn CTV!");
      return;
    }

    const userObj = activeAccounts.find((a) => a.id === assignUser);
    if (!userObj) return;

    let slot = getSlot(assignDay, assignType);
    if (!slot) {
      // create new slot if not exists
      const dayObj = daysHeader.find((d) => d.index === assignDay);
      slot = {
        id: `shift-${Date.now()}`,
        dayIndex: assignDay,
        dayName: dayObj?.label || "Thứ 2",
        dateStr: dayObj?.date || "06/07",
        shiftType: assignType,
        shiftTimeLabel:
          assignType === "morning"
            ? "08:00 - 12:00"
            : assignType === "afternoon"
              ? "13:30 - 17:30"
              : "18:00 - 21:00",
        status: "Đã đăng ký",
        allowRegister: true,
        assignedCTVs: [],
      };
      shifts.push(slot);
    }

    handleAddCTVToShiftSlot(slot.id, userObj);
    setIsQuickAssignOpen(false);
    setAssignUser("");
  };

  const handleToggleGate = () => {
    setIsGateOpen(!isGateOpen);
    onShowToast(`Đã ${!isGateOpen ? "mở" : "đóng"} cổng đăng ký ca làm việc!`);
  };

  // Modal active shift slot object
  const modalSlot = selectedCell
    ? getSlot(selectedCell.dayIndex, selectedCell.shiftType)
    : undefined;
  const modalDayHeader = selectedCell
    ? daysHeader.find((d) => d.index === selectedCell.dayIndex)
    : undefined;
  const modalShiftMeta = selectedCell
    ? shiftTypes.find((s) => s.type === selectedCell.shiftType)
    : undefined;

  // Today's shift calculation for CTV view (Default to Wednesday 08/07 as today)
  const todayIndex = 2;
  const todayHeader = daysHeader.find((d) => d.index === todayIndex);

  const todayShifts = shiftTypes
    .map((st) => {
      const slot = getSlot(todayIndex, st.type);
      const assigned = slot?.assignedCTVs?.find((c) => c.id === ctvUser.id);
      return {
        type: st.type,
        name: st.name,
        timeLabel: st.timeLabel,
        icon: st.icon,
        badgeBg: st.badgeBg,
        slot,
        assigned,
      };
    })
    .filter((item) => item.assigned);

  const handleSubmitLeaveRequest = () => {
    if (!leaveReason) {
      onShowToast("Vui lòng chọn hoặc nhập lý do xin nghỉ!");
      return;
    }

    let targetShiftType: "morning" | "afternoon" | "evening" = "morning";
    if (leaveShiftType === "today_afternoon") {
      targetShiftType = "afternoon";
    } else if (leaveShiftType === "today_morning") {
      targetShiftType = "morning";
    }

    const slot = shifts.find((s) => s.dayIndex === todayIndex && s.shiftType === targetShiftType);
    if (slot) {
      const updatedShifts = shifts.map((s) => {
        if (s.id !== slot.id) return s;
        const updatedCTVs = (s.assignedCTVs || []).map((c) =>
          c.id === ctvUser.id ? { ...c, status: "Xin nghỉ" as any } : c,
        );
        return { ...s, assignedCTVs: updatedCTVs };
      });
      onUpdateShifts(updatedShifts);
    }

    onShowToast(
      `Đã gửi đơn xin nghỉ ca ${targetShiftType === "morning" ? "Sáng" : "Chiều"} (${todayHeader?.label})! Đang chờ Admin phê duyệt.`,
    );
    setIsLeaveModalOpen(false);
    setLeaveNote("");
  };

  if (isCTV) {
    return (
      <CTVScheduleWorkspace
        shifts={shifts}
        currentUser={ctvUser}
        onUpdateShifts={onUpdateShifts}
        onShowToast={onShowToast}
      />
    );
  }

  return (
    <div className="space-y-4 pb-8">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-[#1b365d] dark:text-[#d6e3ff] tracking-tight">
            Lịch trình làm việc
          </h2>
        </div>
      </div>

      {/* VIEW MODE: CA LÀM VIỆC CÁ NHÂN & ĐĂNG KÝ CA (CTV PERSONAL VIEW) */}
      {viewMode === "my_schedule" && (
        <div className="space-y-6">
          {/* Card: Ca làm việc hôm nay */}
          <div className="bg-white dark:bg-[#25262b] border border-[#E2E8F0] dark:border-[#3b3d45] rounded-2xl p-5 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E2E8F0] dark:border-[#3b3d45]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[22px]">today</span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-base text-[#1b365d] dark:text-[#d6e3ff]">
                      Ca làm việc hôm nay
                    </h3>
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                      {todayHeader?.label}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {todayShifts.length > 0
                      ? `Bạn có ${todayShifts.length} ca làm việc được phân công trong hôm nay`
                      : "Hôm nay bạn không có ca làm việc nào được phân công"}
                  </p>
                </div>
              </div>

              {/* Action: Nút Xin nghỉ */}
              <button
                type="button"
                onClick={() => setIsLeaveModalOpen(true)}
                className="px-4 py-2 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer border border-rose-200 dark:border-rose-800/60 shadow-2xs self-start sm:self-auto"
              >
                <span className="material-symbols-outlined text-[18px]">event_busy</span>
                <span>Xin nghỉ</span>
              </button>
            </div>

            {/* List of today's shifts or empty state */}
            <div className="pt-4">
              {todayShifts.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {todayShifts.map((s) => (
                    <div
                      key={s.type}
                      className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#1f2023] flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`material-symbols-outlined text-[20px] p-2 rounded-lg ${s.badgeBg}`}
                        >
                          {s.icon}
                        </span>
                        <div>
                          <div className="font-bold text-sm text-[#1b365d] dark:text-[#d6e3ff]">
                            {s.name}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                            <span className="material-symbols-outlined text-[14px]">schedule</span>
                            <span>{s.timeLabel}</span>
                          </div>
                        </div>
                      </div>

                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                          s.assigned?.status === "Đã duyệt"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                            : s.assigned?.status === "Chờ duyệt"
                              ? "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800"
                              : "bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800"
                        }`}
                      >
                        {s.assigned?.status || "Đã phân công"}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-4 px-4 bg-slate-50 dark:bg-[#1f2023] rounded-xl border border-dashed border-slate-200 dark:border-slate-700 text-center flex items-center justify-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                  <span className="material-symbols-outlined text-[18px]">info</span>
                  <span>Hôm nay bạn không có ca làm việc. Chúc bạn một ngày tốt lành!</span>
                </div>
              )}
            </div>
          </div>
          {/* Registration Matrix Table */}
          <div className="bg-white dark:bg-[#25262b] border border-[#E2E8F0] dark:border-[#3b3d45] rounded-2xl overflow-hidden shadow-2xs">
            <div className="p-4 border-b border-[#E2E8F0] dark:border-[#3b3d45] bg-[#F8FAFC] dark:bg-[#1f2023] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px] text-[#1b365d] dark:text-[#d6e3ff]">
                  {isRegistrationMode ? "edit_calendar" : "calendar_month"}
                </span>
                <h3 className="font-bold text-base text-[#1b365d] dark:text-[#d6e3ff]">
                  {isRegistrationMode ? "Đăng ký ca làm việc" : "Lịch trình làm việc"}
                </h3>
              </div>

              {/* Action Button at top-right replacing old gate status pill */}
              {!isRegistrationMode ? (
                <button
                  onClick={() => setIsRegistrationMode(true)}
                  className="bg-accent hover:opacity-90 text-white px-4 py-1.5 rounded-xl font-bold text-xs transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[16px]">how_to_reg</span>
                  <span>Đăng ký ca</span>
                </button>
              ) : (
                <button
                  onClick={() => setIsRegistrationMode(false)}
                  className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-[#1b365d] dark:text-[#d6e3ff] px-3.5 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer flex items-center gap-1.5 border border-slate-300 dark:border-slate-600"
                >
                  <span className="material-symbols-outlined text-[16px]">arrow_back</span>
                  <span>Quay lại Lịch trình</span>
                </button>
              )}
            </div>

            <div className="overflow-x-auto">
              <div className="min-w-[900px]">
                {/* Header: Days Row */}
                <div className="grid grid-cols-[140px_repeat(5,1fr)] border-b border-[#E2E8F0] dark:border-[#3b3d45] bg-[#F8FAFC] dark:bg-[#1f2023]">
                  <div className="p-3.5 border-r border-[#E2E8F0] dark:border-[#3b3d45] text-xs font-bold text-[#1b365d] dark:text-[#d6e3ff] text-center">
                    Buổi / Ngày
                  </div>
                  {daysHeader.map((d) => (
                    <div
                      key={d.index}
                      className={`p-3 border-r border-[#E2E8F0] dark:border-[#3b3d45] last:border-r-0 text-center ${
                        d.isSunday ? "bg-rose-50/30 dark:bg-rose-950/10" : ""
                      }`}
                    >
                      <div
                        className={`font-bold text-sm ${
                          d.isSunday
                            ? "text-rose-600 dark:text-rose-400"
                            : d.isWeekend
                              ? "text-amber-600 dark:text-amber-400"
                              : "text-[#1b365d] dark:text-[#d6e3ff]"
                        }`}
                      >
                        {d.label}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Rows for Shifts (Sáng, Chiều) */}
                {shiftTypes.map((st) => (
                  <div
                    key={st.type}
                    className="grid grid-cols-[140px_repeat(5,1fr)] border-b border-[#E2E8F0] dark:border-[#3b3d45] last:border-b-0 min-h-[120px]"
                  >
                    {/* Left Sticky Column */}
                    <div className="p-3 border-r border-[#E2E8F0] dark:border-[#3b3d45] flex flex-col items-center justify-center bg-[#F8FAFC] dark:bg-[#1f2023] text-center">
                      <div className="w-8 h-8 rounded-full bg-[#1b365d]/10 dark:bg-[#1b365d]/30 text-[#1b365d] dark:text-[#87a0cd] flex items-center justify-center mb-1">
                        <span className="material-symbols-outlined text-[18px]">{st.icon}</span>
                      </div>
                      <span className="text-xs font-bold text-[#1b365d] dark:text-[#d6e3ff]">
                        {st.name}
                      </span>
                      <span className="text-[10px] text-[#74777f] dark:text-[#c4c6cf] mt-0.5 font-mono">
                        {st.timeLabel}
                      </span>
                    </div>

                    {/* Day Cells */}
                    {daysHeader.map((d) => {
                      const slot = getSlot(d.index, st.type);
                      const assignedList = slot?.assignedCTVs || [];
                      const myRecord = assignedList.find(
                        (c) => c.id === ctvUser.id || c.name === ctvUser.name,
                      );
                      const isMyRegistered = !!myRecord;

                      return (
                        <div
                          key={`my-${st.type}-${d.index}`}
                          className={`p-3 border-r border-[#E2E8F0] dark:border-[#3b3d45] last:border-r-0 flex flex-col items-center justify-center min-h-[95px] transition-colors ${
                            isMyRegistered
                              ? "bg-emerald-50/60 dark:bg-emerald-950/20"
                              : d.isWeekend
                                ? "bg-slate-50/60 dark:bg-[#1e1f23]"
                                : "bg-white dark:bg-[#25262b]"
                          }`}
                        >
                          {/* 1. VIEW MODE: LỊCH TRÌNH LÀM VIỆC (Strictly displays status, NO action buttons) */}
                          {!isRegistrationMode ? (
                            isMyRegistered ? (
                              <span className="px-3.5 py-1.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-900/60 dark:text-emerald-300 flex items-center gap-1.5 shadow-2xs">
                                <span className="material-symbols-outlined text-[16px]">
                                  check_circle
                                </span>
                                <span>Đi làm</span>
                              </span>
                            ) : (
                              <span className="px-3.5 py-1.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-500 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700 flex items-center gap-1">
                                <span>Nghỉ</span>
                              </span>
                            )
                          ) : /* 2. REGISTRATION MODE: ĐĂNG KÝ CA (Interactive actions) */
                          isMyRegistered ? (
                            <div className="flex flex-col items-center justify-center gap-2">
                              <button
                                onClick={() => handleCancelMyShift(d.index, st.type)}
                                className="px-4 py-1.5 rounded-xl text-xs font-bold text-rose-600 hover:text-white bg-rose-50 hover:bg-rose-600 border border-rose-200 dark:bg-rose-950/30 dark:border-rose-800/60 transition-all cursor-pointer flex items-center gap-1 shadow-2xs"
                              >
                                <span className="material-symbols-outlined text-[16px]">close</span>
                                <span>Hủy ca</span>
                              </button>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center justify-center gap-2">
                              <button
                                onClick={() => handleRegisterMyShift(d.index, st.type)}
                                className="px-4 py-1.5 bg-blue-50 text-blue-600 border border-blue-200 hover:bg-emerald-600 hover:text-white hover:border-emerald-600 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800/60 dark:hover:bg-emerald-600 dark:hover:text-white dark:hover:border-emerald-600 rounded-xl text-xs font-bold transition-all shadow-2xs hover:shadow-xs flex items-center gap-1 cursor-pointer"
                              >
                                <span className="material-symbols-outlined text-[16px]">
                                  add_circle
                                </span>
                                <span>Đăng ký</span>
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>

            {/* Card Footer with Save Button at Bottom Right - Only in Registration mode */}
            {isRegistrationMode && (
              <div className="p-3.5 px-5 border-t border-[#E2E8F0] dark:border-[#3b3d45] bg-[#F8FAFC] dark:bg-[#1f2023] flex items-center justify-end gap-3">
                <button
                  onClick={handleSaveRegistration}
                  className="px-6 py-2 bg-accent hover:opacity-90 text-white rounded-xl text-xs font-bold transition-all shadow-2xs hover:shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">save</span>
                  <span>Lưu</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEW MODE 1: LƯỚI PHÂN CA THEO BUỔI (GRID VIEW) */}
      {viewMode === "grid" && (
        <div className="bg-white dark:bg-[#25262b] border border-[#E2E8F0] dark:border-[#3b3d45] rounded-xl overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <div className="min-w-[1000px]">
              {/* Header: Days Row */}
              <div className="grid grid-cols-[130px_repeat(5,1fr)] border-b border-[#E2E8F0] dark:border-[#3b3d45] bg-[#F8FAFC] dark:bg-[#1f2023]">
                <div className="p-3.5 border-r border-[#E2E8F0] dark:border-[#3b3d45] text-xs font-bold text-[#1b365d] dark:text-[#d6e3ff] flex items-center justify-center">
                  Ca / Buổi
                </div>
                {daysHeader.map((d) => (
                  <div
                    key={d.index}
                    className={`p-3 border-r border-[#E2E8F0] dark:border-[#3b3d45] last:border-r-0 text-center ${
                      d.isSunday ? "bg-rose-50/30 dark:bg-rose-950/10" : ""
                    }`}
                  >
                    <div
                      className={`font-bold text-sm ${
                        d.isSunday
                          ? "text-rose-600 dark:text-rose-400"
                          : d.isWeekend
                            ? "text-amber-600 dark:text-amber-400"
                            : "text-[#1b365d] dark:text-[#d6e3ff]"
                      }`}
                    >
                      {d.label}
                    </div>
                  </div>
                ))}
              </div>

              {/* Rows for Shifts (Sáng, Chiều) */}
              {shiftTypes
                .filter((st) => selectedShiftFilter === "all" || selectedShiftFilter === st.type)
                .map((st) => (
                  <div
                    key={st.type}
                    className="grid grid-cols-[130px_repeat(5,1fr)] border-b border-[#E2E8F0] dark:border-[#3b3d45] last:border-b-0 min-h-[150px]"
                  >
                    {/* Left Sticky Column: Shift Label */}
                    <div className="p-3 border-r border-[#E2E8F0] dark:border-[#3b3d45] flex flex-col items-center justify-center bg-[#F8FAFC] dark:bg-[#1f2023] text-center">
                      <div className="w-8 h-8 rounded-full bg-[#1b365d]/10 dark:bg-[#1b365d]/30 text-[#1b365d] dark:text-[#87a0cd] flex items-center justify-center mb-1">
                        <span className="material-symbols-outlined text-[18px]">{st.icon}</span>
                      </div>
                      <span className="text-xs font-bold text-[#1b365d] dark:text-[#d6e3ff]">
                        {st.name}
                      </span>
                      <span className="text-[10px] text-[#74777f] dark:text-[#c4c6cf] mt-0.5 font-mono">
                        {st.timeLabel}
                      </span>
                    </div>

                    {/* Day Cells */}
                    {daysHeader.map((d) => {
                      const slot = getSlot(d.index, st.type);
                      const allCTVs = slot?.assignedCTVs || [];
                      const filteredCTVs = getFilteredCTVs(allCTVs);
                      const approvedCount = allCTVs.filter((c) => c.status === "Đã duyệt").length;
                      const pendingCount = allCTVs.filter((c) => c.status === "Chờ duyệt").length;
                      const isOff = slot?.status === "Nghỉ";

                      return (
                        <div
                          key={`${st.type}-${d.index}`}
                          className={`p-2 border-r border-[#E2E8F0] dark:border-[#3b3d45] last:border-r-0 flex flex-col justify-between transition-colors ${
                            d.isWeekend
                              ? "bg-slate-50/60 dark:bg-[#1e1f23]"
                              : "bg-white dark:bg-[#25262b]"
                          } hover:bg-slate-50 dark:hover:bg-[#2c2d33]`}
                        >
                          {/* Cell Top Header */}
                          <div className="flex items-center justify-between mb-1.5">
                            {isOff ? (
                              <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                                Nghỉ
                              </span>
                            ) : (
                              <div className="flex items-center gap-1">
                                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800 px-1.5 py-0.5 rounded-full">
                                  {approvedCount} CTV
                                </span>
                                {pendingCount > 0 && (
                                  <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800 px-1.5 py-0.5 rounded-full animate-pulse">
                                    +{pendingCount} chờ
                                  </span>
                                )}
                              </div>
                            )}

                            <button
                              onClick={() =>
                                setSelectedCell({ dayIndex: d.index, shiftType: st.type })
                              }
                              title="Quản lý CTV ca này"
                              className="text-[#74777f] hover:text-[#1b365d] dark:hover:text-white p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                            >
                              <span className="material-symbols-outlined text-[16px]">
                                edit_square
                              </span>
                            </button>
                          </div>

                          {/* List of Assigned CTVs in this shift */}
                          <div className="flex-1 space-y-1.5 my-1">
                            {filteredCTVs.length > 0 ? (
                              filteredCTVs.map((ctv) => (
                                <div
                                  key={ctv.id}
                                  className={`p-1.5 rounded-lg border text-xs flex items-center justify-between gap-1 group transition-all ${
                                    ctv.status === "Đã duyệt"
                                      ? "bg-slate-50 border-slate-200 dark:bg-[#1a1b1e] dark:border-[#3b3d45]"
                                      : "bg-amber-50/70 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800/50"
                                  }`}
                                >
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    {ctv.avatar ? (
                                      <img
                                        src={ctv.avatar}
                                        alt={ctv.name}
                                        className="w-5 h-5 rounded-full object-cover shrink-0"
                                      />
                                    ) : (
                                      <div className="w-5 h-5 rounded-full bg-accent text-white font-bold text-[9px] flex items-center justify-center shrink-0">
                                        {ctv.initials || "CTV"}
                                      </div>
                                    )}
                                    <span className="font-semibold text-[#1a1b1e] dark:text-[#d6e3ff] truncate text-[11px]">
                                      {ctv.name}
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-1 shrink-0">
                                    {ctv.status === "Chờ duyệt" ? (
                                      <button
                                        onClick={() =>
                                          slot && handleApproveCTVInShift(slot.id, ctv.id)
                                        }
                                        title="Duyệt CTV này"
                                        className="text-emerald-600 hover:text-emerald-700 bg-emerald-100 dark:bg-emerald-900/50 p-0.5 rounded text-[10px] font-bold"
                                      >
                                        Duyệt
                                      </button>
                                    ) : (
                                      <span
                                        className="w-2 h-2 rounded-full bg-emerald-500 inline-block"
                                        title="Đã duyệt"
                                      />
                                    )}

                                    <button
                                      onClick={() =>
                                        slot && handleRemoveCTVFromShift(slot.id, ctv.id)
                                      }
                                      title="Xóa khỏi ca"
                                      className="opacity-0 group-hover:opacity-100 text-rose-500 hover:text-rose-700 p-0.5 transition-opacity cursor-pointer"
                                    >
                                      <span className="material-symbols-outlined text-[14px]">
                                        close
                                      </span>
                                    </button>
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div className="h-full flex flex-col items-center justify-center text-center p-2 text-[11px] text-slate-300 dark:text-slate-600 italic">
                                {isOff ? "Không mở ca" : "Chưa có CTV"}
                              </div>
                            )}
                          </div>

                          {/* Cell Bottom Action: Quick Add CTV */}
                          {!isOff && (
                            <button
                              onClick={() =>
                                setSelectedCell({ dayIndex: d.index, shiftType: st.type })
                              }
                              className="mt-1 w-full py-1 rounded border border-dashed border-slate-200 dark:border-slate-700 hover:border-[#1b365d] hover:bg-[#1b365d]/5 text-[11px] text-[#74777f] hover:text-[#1b365d] dark:hover:text-white transition-all font-medium flex items-center justify-center gap-1 cursor-pointer"
                            >
                              <span className="material-symbols-outlined text-[14px]">add</span>
                              <span>Phân ca</span>
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* VIEW MODE 2: LỊCH LÀM THEO DANH SÁCH CTV (PER-CTV VIEW) */}
      {viewMode === "ctv" && (
        <div className="bg-white dark:bg-[#25262b] border border-[#E2E8F0] dark:border-[#3b3d45] rounded-xl overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F8FAFC] dark:bg-[#1f2023] border-b border-[#E2E8F0] dark:border-[#3b3d45] text-[#1b365d] dark:text-[#d6e3ff]">
                <tr>
                  <th className="p-3.5 font-bold w-[220px]">Cộng tác viên</th>
                  {daysHeader.map((d) => (
                    <th
                      key={d.index}
                      className="p-3.5 font-bold text-center border-l border-[#E2E8F0] dark:border-[#3b3d45]"
                    >
                      <div>{d.label}</div>
                    </th>
                  ))}
                  <th className="p-3.5 font-bold text-center border-l border-[#E2E8F0] dark:border-[#3b3d45] w-[100px]">
                    Tổng ca
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0] dark:divide-[#3b3d45]">
                {activeAccounts.map((acc) => {
                  let totalShiftsForCTV = 0;

                  return (
                    <tr
                      key={acc.id}
                      className="hover:bg-slate-50 dark:hover:bg-[#2c2d33] transition-colors"
                    >
                      {/* CTV Info Column */}
                      <td className="p-3.5">
                        <div className="flex items-center gap-2.5">
                          {acc.avatar ? (
                            <img
                              src={acc.avatar}
                              alt={acc.name}
                              className="w-8 h-8 rounded-full object-cover border border-[#1b365d]/10 shrink-0"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-[#1b365d] text-white font-bold text-xs flex items-center justify-center shrink-0">
                              {acc.initials || acc.name.slice(0, 2).toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="font-bold text-[#1b365d] dark:text-[#d6e3ff] truncate text-xs">
                              {acc.name}
                            </p>
                            <p className="text-[10px] text-[#74777f] dark:text-[#c4c6cf] font-mono truncate">
                              {acc.cctvCode || acc.phone}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Mon to Sun Shift Badges for this CTV */}
                      {daysHeader.map((d) => {
                        // find shifts where this CTV is assigned
                        const dayShifts = shifts.filter(
                          (s) =>
                            s.dayIndex === d.index &&
                            (s.assignedCTVs || []).some((c) => c.id === acc.id),
                        );

                        totalShiftsForCTV += dayShifts.length;

                        return (
                          <td
                            key={d.index}
                            className="p-2 border-l border-[#E2E8F0] dark:border-[#3b3d45] text-center align-middle"
                          >
                            {dayShifts.length > 0 ? (
                              <div className="flex flex-wrap items-center justify-center gap-1">
                                {dayShifts.map((s) => {
                                  const ctvRecord = (s.assignedCTVs || []).find(
                                    (c) => c.id === acc.id,
                                  );
                                  const isPending = ctvRecord?.status === "Chờ duyệt";

                                  return (
                                    <span
                                      key={s.id}
                                      className={`px-2 py-1 rounded text-[10px] font-bold border ${
                                        s.shiftType === "morning"
                                          ? "bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300"
                                          : s.shiftType === "afternoon"
                                            ? "bg-blue-50 text-blue-800 border-blue-300 dark:bg-blue-950/40 dark:text-blue-300"
                                            : "bg-purple-50 text-purple-800 border-purple-300 dark:bg-purple-950/40 dark:text-purple-300"
                                      } ${isPending ? "border-dashed opacity-80" : ""}`}
                                    >
                                      {s.shiftType === "morning"
                                        ? "Sáng"
                                        : s.shiftType === "afternoon"
                                          ? "Chiều"
                                          : "Tối"}
                                      {isPending ? " (?)" : ""}
                                    </span>
                                  );
                                })}
                              </div>
                            ) : (
                              <span className="text-slate-300 dark:text-slate-600 text-[11px]">
                                -
                              </span>
                            )}
                          </td>
                        );
                      })}

                      {/* Total Shifts Column */}
                      <td className="p-3.5 border-l border-[#E2E8F0] dark:border-[#3b3d45] text-center font-bold text-sm text-[#1b365d] dark:text-[#d6e3ff]">
                        <span className="bg-[#1b365d]/10 text-[#1b365d] dark:bg-[#1b365d]/30 dark:text-[#87a0cd] px-2.5 py-1 rounded-full text-xs">
                          {totalShiftsForCTV} ca
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL 1: Phân ca CTV cho Ô được chọn (Shift Detail & Assign Modal) */}
      {selectedCell && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#25262b] border border-[#E2E8F0] dark:border-[#3b3d45] rounded-2xl max-w-lg w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setSelectedCell(null)}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 dark:hover:text-white"
            >
              <span className="material-symbols-outlined">close</span>
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-[#1b365d] text-white flex items-center justify-center">
                <span className="material-symbols-outlined text-[22px]">
                  {modalShiftMeta?.icon || "event"}
                </span>
              </div>
              <div>
                <h3 className="text-lg font-bold text-[#1b365d] dark:text-[#d6e3ff]">
                  Phân ca làm việc - {modalDayHeader?.label} ({modalDayHeader?.date})
                </h3>
                <p className="text-xs text-[#74777f] dark:text-[#c4c6cf]">
                  Ca:{" "}
                  <span className="font-semibold text-[#1b365d] dark:text-white">
                    {modalShiftMeta?.name}
                  </span>{" "}
                  ({modalShiftMeta?.timeLabel})
                </p>
              </div>
            </div>

            {/* Current CTV list in this shift */}
            <div className="space-y-3 mb-6">
              <label className="text-xs font-bold text-[#1b365d] dark:text-[#d6e3ff] block">
                Danh sách CTV trong ca này ({modalSlot?.assignedCTVs?.length || 0}):
              </label>

              <div className="max-h-52 overflow-y-auto space-y-2 border border-[#E2E8F0] dark:border-[#3b3d45] rounded-xl p-2 bg-[#f4f3f7]/50 dark:bg-[#1a1b1e]">
                {modalSlot?.assignedCTVs && modalSlot.assignedCTVs.length > 0 ? (
                  modalSlot.assignedCTVs.map((ctv) => (
                    <div
                      key={ctv.id}
                      className="p-2.5 bg-white dark:bg-[#25262b] border border-[#E2E8F0] dark:border-[#3b3d45] rounded-lg flex items-center justify-between"
                    >
                      <div
                        onClick={() => {
                          if (onViewAccountDetail) {
                            const matched = accounts.find(
                              (a) => a.id === ctv.id || a.name === ctv.name,
                            );
                            if (matched) {
                              onViewAccountDetail(matched);
                            } else {
                              onViewAccountDetail({
                                id: ctv.id,
                                stt: 1,
                                name: ctv.name,
                                email: `${ctv.id}@company.vn`,
                                phone: ctv.phone || "090 123 4567",
                                role: "Cộng tác viên",
                                status: "Kích hoạt",
                                registerDate: "01/01/2023",
                                initials: ctv.initials || ctv.name.slice(0, 2).toUpperCase(),
                                avatar: ctv.avatar,
                                cctvCode: ctv.cctvCode || `CTV-2023-${ctv.id}`,
                                joinDate: "15/01/2023",
                                shiftsCompleted: 8,
                                rating: 5.0,
                              });
                            }
                          }
                        }}
                        className="flex items-center gap-2.5 cursor-pointer group/ctv hover:opacity-80 transition-opacity"
                        title={`Xem hồ sơ của ${ctv.name}`}
                      >
                        {ctv.avatar ? (
                          <img
                            src={ctv.avatar}
                            alt={ctv.name}
                            className="w-7 h-7 rounded-full object-cover group-hover/ctv:ring-2 group-hover/ctv:ring-accent transition-all"
                          />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-[#1b365d] text-white font-bold text-xs flex items-center justify-center group-hover/ctv:ring-2 group-hover/ctv:ring-accent transition-all">
                            {ctv.initials || "CTV"}
                          </div>
                        )}
                        <div>
                          <p className="font-bold text-xs text-[#1b365d] dark:text-[#d6e3ff] group-hover/ctv:text-accent group-hover/ctv:underline transition-colors">
                            {ctv.name}
                          </p>
                          <p className="text-[10px] text-[#74777f]">{ctv.cctvCode || ctv.phone}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {ctv.status === "Chờ duyệt" ? (
                          <button
                            onClick={() =>
                              modalSlot && handleApproveCTVInShift(modalSlot.id, ctv.id)
                            }
                            className="bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold px-2 py-1 rounded"
                          >
                            Duyệt ca
                          </button>
                        ) : (
                          <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            Đã duyệt
                          </span>
                        )}

                        <button
                          onClick={() =>
                            modalSlot && handleRemoveCTVFromShift(modalSlot.id, ctv.id)
                          }
                          className="text-rose-500 hover:text-rose-700 p-1"
                          title="Xóa khỏi ca"
                        >
                          <span className="material-symbols-outlined text-[16px]">delete</span>
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-6 text-xs text-[#74777f] italic">
                    Chưa có Cộng tác viên nào đăng ký ca này.
                  </div>
                )}
              </div>
            </div>

            {/* Form to add a CTV to this shift */}
            <div className="space-y-3 pt-3 border-t border-[#E2E8F0] dark:border-[#3b3d45]">
              <label className="text-xs font-bold text-[#1b365d] dark:text-[#d6e3ff] block">
                Thêm CTV vào ca này:
              </label>
              <div className="flex gap-2">
                <select
                  value={assignUser}
                  onChange={(e) => setAssignUser(e.target.value)}
                  className="flex-1 p-2 bg-[#f4f3f7] dark:bg-[#1a1b1e] border border-[#E2E8F0] dark:border-[#3b3d45] rounded-xl text-xs font-medium text-[#1b365d] dark:text-[#d6e3ff]"
                >
                  <option value="">-- Chọn Cộng tác viên --</option>
                  {activeAccounts
                    .filter((acc) => !(modalSlot?.assignedCTVs || []).some((c) => c.id === acc.id))
                    .map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} ({acc.cctvCode || acc.phone})
                      </option>
                    ))}
                </select>

                <button
                  disabled={!assignUser}
                  onClick={() => {
                    const userObj = activeAccounts.find((a) => a.id === assignUser);
                    if (userObj && modalSlot) {
                      handleAddCTVToShiftSlot(modalSlot.id, userObj);
                      setAssignUser("");
                    }
                  }}
                  className="bg-[#1b365d] hover:bg-[#002046] disabled:opacity-50 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all cursor-pointer"
                >
                  Thêm CTV
                </button>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setSelectedCell(null)}
                className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs px-5 py-2 rounded-xl cursor-pointer"
              >
                Hoàn tất
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Phân ca nhanh CTV (Quick Assign Modal) */}
      {isQuickAssignOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#25262b] border border-[#E2E8F0] dark:border-[#3b3d45] rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setIsQuickAssignOpen(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 dark:hover:text-white"
            >
              <span className="material-symbols-outlined">close</span>
            </button>

            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-[#1b365d] text-white flex items-center justify-center">
                <span className="material-symbols-outlined text-[22px]">person_add</span>
              </div>
              <div>
                <h3 className="text-lg font-bold text-[#1b365d] dark:text-[#d6e3ff]">
                  Phân ca nhanh cho CTV
                </h3>
                <p className="text-xs text-[#74777f]">
                  Chọn CTV và buổi làm việc cần sắp xếp trong tuần
                </p>
              </div>
            </div>

            <form onSubmit={handleQuickAssignSubmit} className="space-y-4">
              {/* Select CTV */}
              <div>
                <label className="text-xs font-bold text-[#1b365d] dark:text-[#d6e3ff] block mb-1.5">
                  1. Chọn Cộng tác viên:
                </label>
                <select
                  required
                  value={assignUser}
                  onChange={(e) => setAssignUser(e.target.value)}
                  className="w-full p-2.5 bg-[#f4f3f7] dark:bg-[#1a1b1e] border border-[#E2E8F0] dark:border-[#3b3d45] rounded-xl text-xs font-medium text-[#1b365d] dark:text-[#d6e3ff]"
                >
                  <option value="">-- Chọn CTV --</option>
                  {activeAccounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} ({acc.cctvCode || acc.phone})
                    </option>
                  ))}
                </select>
              </div>

              {/* Select Day */}
              <div>
                <label className="text-xs font-bold text-[#1b365d] dark:text-[#d6e3ff] block mb-1.5">
                  2. Chọn ngày trong tuần:
                </label>
                <select
                  value={assignDay}
                  onChange={(e) => setAssignDay(Number(e.target.value))}
                  className="w-full p-2.5 bg-[#f4f3f7] dark:bg-[#1a1b1e] border border-[#E2E8F0] dark:border-[#3b3d45] rounded-xl text-xs font-medium text-[#1b365d] dark:text-[#d6e3ff]"
                >
                  {daysHeader.map((d) => (
                    <option key={d.index} value={d.index}>
                      {d.label} ({d.date})
                    </option>
                  ))}
                </select>
              </div>

              {/* Select Shift Type */}
              <div>
                <label className="text-xs font-bold text-[#1b365d] dark:text-[#d6e3ff] block mb-1.5">
                  3. Chọn Buổi làm việc:
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {shiftTypes.map((st) => (
                    <button
                      type="button"
                      key={st.type}
                      onClick={() => setAssignType(st.type)}
                      className={`p-2.5 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition-all cursor-pointer ${
                        assignType === st.type
                          ? "bg-[#1b365d] text-white border-[#1b365d] shadow-2xs"
                          : "bg-[#f4f3f7] dark:bg-[#1a1b1e] border-[#E2E8F0] dark:border-[#3b3d45] text-[#1b365d] dark:text-[#d6e3ff] hover:bg-slate-200"
                      }`}
                    >
                      <span className="material-symbols-outlined text-[18px]">{st.icon}</span>
                      <span>{st.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="pt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsQuickAssignOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-[#1b365d] hover:bg-[#002046] text-white transition-all cursor-pointer shadow-2xs"
                >
                  Xác nhận phân ca
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* LEAVE REQUEST MODAL */}
      {isLeaveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#25262b] border border-slate-200 dark:border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[20px]">event_busy</span>
                </div>
                <h3 className="text-base font-bold text-[#1b365d] dark:text-[#d6e3ff]">
                  Đơn xin nghỉ ca làm việc
                </h3>
              </div>
              <button
                onClick={() => setIsLeaveModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="space-y-3.5">
              {/* Select Shift to Take Leave */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Chọn ca xin nghỉ
                </label>
                <select
                  value={leaveShiftType}
                  onChange={(e) => setLeaveShiftType(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#1a1b1e] border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-[#1b365d] dark:text-[#d6e3ff] outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="today_morning">Ca Sáng - Hôm nay ({todayHeader?.label})</option>
                  <option value="today_afternoon">Ca Chiều - Hôm nay ({todayHeader?.label})</option>
                  <option value="other">Toàn bộ ca trong tuần này</option>
                </select>
              </div>

              {/* Reason Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Lý do nghỉ
                </label>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  {[
                    "Bận việc cá nhân",
                    "Nghỉ ốm / Sức khỏe",
                    "Bận lịch học / Thi cử",
                    "Lý do đột xuất",
                  ].map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setLeaveReason(r)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border text-left transition-all cursor-pointer ${
                        leaveReason === r
                          ? "bg-rose-50 dark:bg-rose-950/60 border-rose-500 text-rose-700 dark:text-rose-300 font-bold"
                          : "bg-slate-50 dark:bg-[#1a1b1e] border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100"
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              {/* Note input */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Ghi chú chi tiết (không bắt buộc)
                </label>
                <textarea
                  rows={3}
                  value={leaveNote}
                  onChange={(e) => setLeaveNote(e.target.value)}
                  placeholder="Nhập lý do chi tiết để Admin xét duyệt..."
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#1a1b1e] border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-[#1b365d] dark:text-[#d6e3ff] outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                />
              </div>
            </div>

            {/* Modal Footer Buttons */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setIsLeaveModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSubmitLeaveRequest}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 transition-colors shadow-2xs cursor-pointer flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[16px]">send</span>
                <span>Gửi đơn xin nghỉ</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
