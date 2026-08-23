import React, { useState } from 'react';
import { MeetingItem, UserAccount } from '../../types';

interface MeetingsScreenProps {
  meetings: MeetingItem[];
  accounts?: UserAccount[];
  onCreateMeeting: () => void;
  onCancelMeeting: (meetingId: string) => void;
  onSendNotification: (meetingId: string) => void;
  onViewAccountDetail?: (account: UserAccount) => void;
  currentUser?: UserAccount;
  userRole?: 'Admin' | 'Cộng tác viên';
}

export const MeetingsScreen: React.FC<MeetingsScreenProps> = ({
  meetings,
  accounts = [],
  onCreateMeeting,
  onCancelMeeting,
  onSendNotification,
  onViewAccountDetail,
  currentUser,
  userRole = 'Admin'
}) => {
  const isCTV = userRole === 'Cộng tác viên';
  const [selectedMeeting, setSelectedMeeting] = useState<MeetingItem | null>(meetings[0] || null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'week' | 'list'>('week');
  const [monthTitle, setMonthTitle] = useState('Tháng 10, 2023');
  const [rsvpStatus, setRsvpStatus] = useState<Record<string, 'confirmed' | 'declined'>>({});

  const openDrawer = (meeting: MeetingItem) => {
    setSelectedMeeting(meeting);
    setIsDrawerOpen(true);
  };

  const closeDrawer = () => {
    setIsDrawerOpen(false);
  };

  const DAYS = [
    { index: 0, label: 'T2', date: '16', fullDate: '16/10/2023', isToday: false },
    { index: 1, label: 'T3', date: '17', fullDate: '17/10/2023', isToday: false },
    { index: 2, label: 'T4', date: '18', fullDate: '18/10/2023', isToday: true },
    { index: 3, label: 'T5', date: '19', fullDate: '19/10/2023', isToday: false },
    { index: 4, label: 'T6', date: '20', fullDate: '20/10/2023', isToday: false },
  ];

  const filteredMeetings = meetings;

  return (
    <div className="space-y-6 relative">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold text-[#1a1b1e] dark:text-slate-100 tracking-tight">
              Lịch họp
            </h2>
            <span className="bg-[#e2e8f0] dark:bg-slate-800 text-[#002046] dark:text-slate-200 font-bold text-xs px-2.5 py-0.5 rounded-full">
              {meetings.length} phiên
            </span>
          </div>
          <p className="text-sm text-[#44474e] dark:text-slate-400 mt-1">
            Quản lý và theo dõi lịch họp theo khung giờ bắt đầu thực tế.
          </p>
        </div>

        {!isCTV && (
          <button
            onClick={onCreateMeeting}
            className="bg-accent hover:opacity-90 text-white font-semibold text-sm px-5 py-2.5 rounded-lg flex items-center gap-2 transition-colors shadow-xs cursor-pointer self-start sm:self-auto"
          >
            <span className="material-symbols-outlined text-[20px]">add</span>
            <span>Tạo phiên họp</span>
          </button>
        )}
      </div>

      {/* Control Bar */}
      <div className="bg-white dark:bg-[#1e1f26] p-4 rounded-xl border border-[#E2E8F0] dark:border-slate-800 shadow-2xs flex items-center justify-between gap-4">
        {/* Left: Date Selector */}
        <div className="flex items-center gap-1 text-[#44474e] dark:text-slate-300 bg-[#F8FAFC] dark:bg-[#121318] border border-[#E2E8F0] dark:border-slate-700 px-2 py-1 rounded-lg">
          <button
            onClick={() => setMonthTitle('Tháng 9, 2023')}
            className="w-7 h-7 rounded hover:bg-[#e2e8f0] dark:hover:bg-slate-700 flex items-center justify-center transition-colors cursor-pointer"
            title="Tuần trước"
          >
            <span className="material-symbols-outlined text-[18px]">chevron_left</span>
          </button>
          <span className="text-xs font-bold text-[#1a1b1e] dark:text-slate-200 px-2 min-w-[100px] text-center">
            {monthTitle}
          </span>
          <button
            onClick={() => setMonthTitle('Tháng 11, 2023')}
            className="w-7 h-7 rounded hover:bg-[#e2e8f0] dark:hover:bg-slate-700 flex items-center justify-center transition-colors cursor-pointer"
            title="Tuần sau"
          >
            <span className="material-symbols-outlined text-[18px]">chevron_right</span>
          </button>
        </div>

        {/* Right: View Mode Toggle */}
        <div className="flex bg-[#F1F5F9] dark:bg-[#121318] rounded-lg p-1 border border-[#E2E8F0] dark:border-slate-700">
          <button
            onClick={() => setViewMode('week')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-colors ${
              viewMode === 'week'
                ? 'bg-white dark:bg-[#28292d] shadow-2xs text-[#1a1b1e] dark:text-white'
                : 'text-[#64748B] dark:text-slate-400 hover:text-[#1a1b1e] dark:hover:text-slate-200'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">calendar_view_week</span>
            <span>Lịch tuần</span>
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-colors ${
              viewMode === 'list'
                ? 'bg-white dark:bg-[#28292d] shadow-2xs text-[#1a1b1e] dark:text-white'
                : 'text-[#64748B] dark:text-slate-400 hover:text-[#1a1b1e] dark:hover:text-slate-200'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">format_list_bulleted</span>
            <span>Danh sách</span>
          </button>
        </div>
      </div>

      {/* Main Calendar View Container */}
      <div className="bg-white dark:bg-[#1e1f26] rounded-xl border border-[#E2E8F0] dark:border-slate-800 shadow-xs flex flex-col min-h-[550px] overflow-hidden">
        {viewMode === 'week' ? (
          <div className="flex-1 flex flex-col overflow-x-auto">
            {/* Week Headers */}
            <div className="grid grid-cols-5 border-b border-[#E2E8F0] dark:border-slate-800 bg-[#F8FAFC] dark:bg-[#181920] min-w-[700px]">
              {DAYS.map((day) => (
                <div
                  key={day.index}
                  className={`p-3 text-center border-r border-[#E2E8F0] dark:border-slate-800 last:border-r-0 ${
                    day.isToday ? 'bg-accent/10' : ''
                  }`}
                >
                  <div
                    className={`text-xs font-semibold uppercase tracking-wider ${
                      day.isToday
                        ? 'text-accent font-bold'
                        : 'text-[#64748B] dark:text-slate-400'
                    }`}
                  >
                    {day.label}
                  </div>
                  {day.isToday ? (
                    <div className="text-base font-extrabold text-white bg-accent w-8 h-8 rounded-full flex items-center justify-center mx-auto mt-1 shadow-2xs">
                      {day.date}
                    </div>
                  ) : (
                    <div className="text-base font-bold text-[#1a1b1e] dark:text-slate-200 mt-1">{day.date}</div>
                  )}
                </div>
              ))}
            </div>

            {/* Week Grid Content - Sorted strictly by Start Time */}
            <div className="grid grid-cols-5 bg-white dark:bg-[#1e1f26] min-h-[420px] min-w-[700px] divide-x divide-[#E2E8F0] dark:divide-slate-800">
              {DAYS.map((day) => {
                const dayMeetings = filteredMeetings
                  .filter((m) => m.dayIndex === day.index)
                  .sort((a, b) => (a.startTime || '00:00').localeCompare(b.startTime || '00:00'));

                return (
                  <div
                    key={day.index}
                    className={`p-2 space-y-3 ${day.isToday ? 'bg-accent/5' : ''}`}
                  >
                    {dayMeetings.length === 0 ? (
                      <div className="h-full flex items-center justify-center p-2 min-h-[120px]">
                        <span className="text-[11px] text-[#94A3B8] dark:text-slate-500 italic">Không có lịch họp</span>
                      </div>
                    ) : (
                      dayMeetings.map((meet) => (
                        <div
                          key={meet.id}
                          onClick={() => openDrawer(meet)}
                          className="p-3 bg-slate-50 dark:bg-[#262730] hover:bg-slate-100/90 dark:hover:bg-[#2f313d] border border-slate-200 dark:border-slate-700 border-l-4 border-l-accent rounded-lg cursor-pointer hover:shadow-md transition-all space-y-2 group"
                        >
                          <div className="flex items-center gap-1">
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded bg-accent text-white">
                              <span className="material-symbols-outlined text-[13px]">schedule</span>
                              {meet.startTime || 'Chưa định giờ'}
                            </span>
                          </div>

                          <h4 className="font-bold text-xs text-[#1a1b1e] dark:text-slate-100 leading-snug line-clamp-2 group-hover:text-accent">
                            {meet.title}
                          </h4>

                          {meet.timeRange && (
                            <p className="text-[11px] text-[#64748B] dark:text-slate-400 flex items-center gap-1">
                              <span className="material-symbols-outlined text-[12px]">schedule</span>
                              {meet.timeRange}
                            </p>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* List View */
          <div className="p-6 divide-y divide-[#E2E8F0] dark:divide-slate-800">
            {filteredMeetings.length === 0 ? (
              <div className="text-center py-16 text-sm text-[#64748B] dark:text-slate-400">
                Không tìm thấy cuộc họp nào phù hợp với từ khóa tìm kiếm.
              </div>
            ) : (
              filteredMeetings
                .sort((a, b) => (a.startTime || '00:00').localeCompare(b.startTime || '00:00'))
                .map((meet) => {
                  return (
                    <div
                      key={meet.id}
                      onClick={() => openDrawer(meet)}
                      className="py-4 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50 dark:hover:bg-[#262730] p-3 rounded-xl transition-colors cursor-pointer group"
                    >
                      <div className="space-y-1.5 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-md bg-accent text-white">
                            <span className="material-symbols-outlined text-[14px]">schedule</span>
                            Bắt đầu: {meet.startTime || '09:00'}
                          </span>
                          <span className="text-xs font-medium text-[#64748B] dark:text-slate-400">
                            {meet.dateDisplay}
                          </span>
                          <span className="text-xs text-slate-300 dark:text-slate-600">•</span>
                          <span className="text-xs text-[#64748B] dark:text-slate-400">
                            Chủ trì: <strong className="text-[#1a1b1e] dark:text-slate-200">{meet.organizer}</strong>
                          </span>
                        </div>

                        <h4 className="text-base font-bold text-[#1a1b1e] dark:text-slate-100 group-hover:text-accent transition-colors">
                          {meet.title}
                        </h4>

                        <div className="flex items-center gap-4 text-xs text-[#475569] dark:text-slate-400">
                          {meet.timeRange && (
                            <span className="flex items-center gap-1 font-medium text-accent">
                              <span className="material-symbols-outlined text-[15px]">schedule</span>
                              {meet.timeRange}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <span className="material-symbols-outlined text-[16px] text-[#64748B] dark:text-slate-400">group</span>
                            {meet.participants.length} thành viên
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span className="material-symbols-outlined text-[#94A3B8] dark:text-slate-500 group-hover:translate-x-1 transition-transform">
                          chevron_right
                        </span>
                      </div>
                    </div>
                  );
                })
            )}
          </div>
        )}
      </div>

      {/* Side Drawer Overlay */}
      {isDrawerOpen && (
        <div
          onClick={closeDrawer}
          className="fixed inset-0 bg-black/60 z-40 transition-opacity"
        ></div>
      )}

      {/* Side Drawer (Chi tiết phiên họp) */}
      <aside
        className={`fixed top-0 right-0 w-full sm:w-[420px] h-screen bg-white dark:bg-[#1e1f26] text-slate-800 dark:text-slate-100 z-50 transform transition-transform duration-300 ease-in-out flex flex-col shadow-2xl ${
          isDrawerOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Drawer Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#E2E8F0] dark:border-slate-800 bg-[#F8FAFC] dark:bg-[#181920]">
          <h3 className="text-lg font-bold text-[#1a1b1e] dark:text-slate-100">Chi tiết phiên họp</h3>
          <button
            onClick={closeDrawer}
            className="w-8 h-8 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center text-[#64748B] dark:text-slate-400 transition-colors cursor-pointer"
            title="Đóng"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Drawer Content */}
        {selectedMeeting && (
          <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
            {/* Header info */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full bg-accent text-white">
                  <span className="material-symbols-outlined text-[16px]">schedule</span>
                  <span>Bắt đầu lúc {selectedMeeting.startTime || '09:00'}</span>
                </span>
              </div>

              <h2 className="text-xl font-bold text-[#1a1b1e] dark:text-slate-100 leading-snug mb-4">
                {selectedMeeting.title}
              </h2>

              <div className="flex flex-col gap-3 bg-slate-50 dark:bg-[#262730] p-4 rounded-xl border border-slate-200/80 dark:border-slate-700">
                <div className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-[#64748B] dark:text-slate-400 mt-0.5">event</span>
                  <div>
                    <p className="text-xs text-[#64748B] dark:text-slate-400">Thời gian</p>
                    <p className="font-semibold text-sm text-[#1a1b1e] dark:text-slate-200">
                      {selectedMeeting.dateDisplay} ({selectedMeeting.timeRange || selectedMeeting.startTime})
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-[#64748B] dark:text-slate-400 mt-0.5">person</span>
                  <div>
                    <p className="text-xs text-[#64748B] dark:text-slate-400">Chủ trì / Tổ chức</p>
                    <button
                      type="button"
                      onClick={() => {
                        if (onViewAccountDetail) {
                          const matched = accounts.find(
                            (a) => a.name.toLowerCase() === selectedMeeting.organizer.toLowerCase()
                          );
                          if (matched) {
                            onViewAccountDetail(matched);
                          } else {
                            onViewAccountDetail({
                              id: `org-${Date.now()}`,
                              stt: 1,
                              name: selectedMeeting.organizer,
                              email: 'organizer@company.vn',
                              phone: '090 999 8888',
                              role: 'Trưởng ban',
                              status: 'Kích hoạt',
                              registerDate: '01/01/2023',
                              initials: selectedMeeting.organizer.substring(0, 2),
                              cctvCode: 'ADMIN-2023',
                              joinDate: '01/01/2023',
                              shiftsCompleted: 24,
                              rating: 5.0
                            });
                          }
                        }
                      }}
                      className="font-semibold text-sm text-[#1a1b1e] dark:text-slate-200 hover:text-accent hover:underline text-left cursor-pointer"
                      title={`Xem hồ sơ của ${selectedMeeting.organizer}`}
                    >
                      {selectedMeeting.organizer}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <hr className="border-[#E2E8F0] dark:border-slate-800" />

            {/* Participants */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-sm text-[#1a1b1e] dark:text-slate-200">
                  Thành viên tham gia ({selectedMeeting.participants.length})
                </h4>
              </div>

              <div className="flex flex-col gap-2">
                {selectedMeeting.participants.map((p) => {
                  const handleUserClick = () => {
                    if (onViewAccountDetail) {
                      const matched = accounts.find(
                        (a) => a.name.toLowerCase() === p.name.toLowerCase() || a.id === p.id
                      );
                      if (matched) {
                        onViewAccountDetail(matched);
                      } else {
                        onViewAccountDetail({
                          id: p.id,
                          stt: 1,
                          name: p.name,
                          email: `${p.id}@company.vn`,
                          phone: '090 123 4567',
                          role: p.role as any,
                          status: 'Kích hoạt',
                          registerDate: '01/01/2023',
                          initials: p.initials || p.name.substring(0, 2),
                          avatar: p.avatar,
                          cctvCode: `CTV-2023-${p.id}`,
                          joinDate: '15/01/2023',
                          shiftsCompleted: 12,
                          rating: 4.8
                        });
                      }
                    }
                  };
                  return (
                    <div
                      key={p.id}
                      className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50/50 dark:bg-[#262730] border border-slate-200/60 dark:border-slate-700 hover:border-accent/30 transition-colors"
                    >
                      <button
                        type="button"
                        onClick={handleUserClick}
                        className="flex items-center gap-3 text-left cursor-pointer group/user focus:outline-none"
                        title={`Xem hồ sơ của ${p.name}`}
                      >
                        {p.avatar ? (
                          <img
                            src={p.avatar}
                            alt={p.name}
                            className="w-8 h-8 rounded-full object-cover border border-[#E2E8F0] dark:border-slate-700 group-hover/user:ring-2 group-hover/user:ring-accent transition-all shrink-0"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-[#c7ecc7] dark:bg-emerald-900/60 text-[#4c6c4f] dark:text-emerald-300 flex items-center justify-center font-bold text-xs group-hover/user:ring-2 group-hover/user:ring-accent transition-all shrink-0">
                            {p.initials || p.name.substring(0, 2)}
                          </div>
                        )}
                        <div>
                          <p className="font-semibold text-xs text-[#1a1b1e] dark:text-slate-200 group-hover/user:text-accent group-hover/user:underline transition-colors">
                            {p.name}
                          </p>
                          <p className="text-[11px] text-[#64748B] dark:text-slate-400">{p.role}</p>
                        </div>
                      </button>

                      {p.status === 'confirmed' && (
                        <span
                          className="material-symbols-outlined text-emerald-600 dark:text-emerald-400 text-[18px]"
                          title="Đã xác nhận"
                        >
                          check_circle
                        </span>
                      )}
                      {p.status === 'pending' && (
                        <span
                          className="material-symbols-outlined text-amber-600 dark:text-amber-400 text-[18px]"
                          title="Chờ xác nhận"
                        >
                          schedule
                        </span>
                      )}
                      {p.status === 'declined' && (
                        <span
                          className="material-symbols-outlined text-rose-600 dark:text-rose-400 text-[18px]"
                          title="Từ chối"
                        >
                          cancel
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        {selectedMeeting && (
          <div className="p-4 border-t border-[#E2E8F0] dark:border-slate-800 bg-[#F8FAFC] dark:bg-[#181920] flex gap-3">
            {!isCTV ? (
              <>
                <button
                  onClick={() => {
                    onCancelMeeting(selectedMeeting.id);
                    closeDrawer();
                  }}
                  className="flex-1 h-10 rounded-lg border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-400 font-semibold text-xs hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                >
                  Hủy cuộc họp
                </button>
                <button
                  onClick={() => onSendNotification(selectedMeeting.id)}
                  className="flex-1 h-10 rounded-lg bg-accent text-white font-semibold text-xs hover:opacity-90 transition-colors cursor-pointer shadow-2xs"
                >
                  Gửi thông báo
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => {
                    setRsvpStatus((prev) => ({ ...prev, [selectedMeeting.id]: 'declined' }));
                    closeDrawer();
                  }}
                  className="flex-1 h-10 rounded-lg border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-400 font-semibold text-xs hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer flex items-center justify-center gap-1"
                >
                  <span className="material-symbols-outlined text-[16px]">cancel</span>
                  <span>Báo vắng</span>
                </button>
                <button
                  onClick={() => {
                    setRsvpStatus((prev) => ({ ...prev, [selectedMeeting.id]: 'confirmed' }));
                    closeDrawer();
                  }}
                  className="flex-1 h-10 rounded-lg bg-emerald-700 text-white font-semibold text-xs hover:bg-emerald-800 transition-colors cursor-pointer shadow-2xs flex items-center justify-center gap-1"
                >
                  <span className="material-symbols-outlined text-[16px]">check_circle</span>
                  <span>Xác nhận tham gia</span>
                </button>
              </>
            )}
          </div>
        )}
      </aside>
    </div>
  );
};
