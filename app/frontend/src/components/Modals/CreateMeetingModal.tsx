import React, { useState } from 'react';
import { UserAccount, Participant } from '../../types';

interface CreateMeetingModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts?: UserAccount[];
  onSubmit: (data: {
    title: string;
    dateDisplay: string;
    startTime: string;
    timeRange: string;
    location: string;
    description: string;
    isOnline: boolean;
    participants?: Participant[];
  }) => void;
}

export const CreateMeetingModal: React.FC<CreateMeetingModalProps> = ({
  isOpen,
  onClose,
  accounts = [],
  onSubmit
}) => {
  const [title, setTitle] = useState('');
  const [dateStr, setDateStr] = useState('2023-10-19');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:30');
  const [selectedParticipants, setSelectedParticipants] = useState<Participant[]>([
    {
      id: 'usr-1',
      name: 'Nguyễn Văn An',
      role: 'Admin',
      status: 'confirmed'
    }
  ]);
  const [customParticipantName, setCustomParticipantName] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState('');

  if (!isOpen) return null;

  const handleAddAccountParticipant = (accId: string) => {
    if (!accId) return;
    const acc = accounts.find((a) => a.id === accId);
    if (acc && !selectedParticipants.some((p) => p.name === acc.name)) {
      setSelectedParticipants([
        ...selectedParticipants,
        {
          id: acc.id,
          name: acc.name,
          role: acc.role,
          avatar: acc.avatar,
          initials: acc.initials,
          status: 'confirmed'
        }
      ]);
    }
    setSelectedAccountId('');
  };

  const handleAddCustomParticipant = () => {
    if (!customParticipantName.trim()) return;
    if (!selectedParticipants.some((p) => p.name.toLowerCase() === customParticipantName.trim().toLowerCase())) {
      setSelectedParticipants([
        ...selectedParticipants,
        {
          id: `p-custom-${Date.now()}`,
          name: customParticipantName.trim(),
          role: 'Thành viên',
          status: 'confirmed'
        }
      ]);
    }
    setCustomParticipantName('');
  };

  const handleRemoveParticipant = (id: string) => {
    setSelectedParticipants((prev) => prev.filter((p) => p.id !== id));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const formattedRange = endTime ? `${startTime} - ${endTime}` : startTime;
    onSubmit({
      title,
      dateDisplay: `Thứ Năm, ${dateStr}`,
      startTime,
      timeRange: formattedRange,
      location: 'Phòng họp',
      description: '',
      isOnline: false,
      participants: selectedParticipants
    });
    // Reset
    setTitle('');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-[#1a1b1e]/50 backdrop-blur-2xs z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-[#E2E8F0] w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between p-4 border-b border-[#E2E8F0] bg-[#F8FAFC] shrink-0">
          <h3 className="font-bold text-base text-[#1a1b1e] flex items-center gap-2">
            <span className="material-symbols-outlined text-[#1b365d] text-[20px]">
              calendar_add_on
            </span>
            <span>Tạo phiên họp mới</span>
          </h3>
          <button
            onClick={onClose}
            type="button"
            className="w-8 h-8 rounded-lg hover:bg-slate-200 flex items-center justify-center text-[#64748B] transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="p-6 space-y-4 overflow-y-auto flex-1">
            <div>
              <label className="block text-xs font-semibold text-[#1a1b1e] mb-1">
                Tiêu đề cuộc họp *
              </label>
              <input
                type="text"
                required
                placeholder="VD: Họp giao ban phòng điều phối..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 border border-[#E2E8F0] rounded-lg text-xs text-[#1a1b1e] focus:border-[#002046] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#1a1b1e] mb-1">
                Ngày họp *
              </label>
              <input
                type="date"
                required
                value={dateStr}
                onChange={(e) => setDateStr(e.target.value)}
                className="w-full px-3 py-2 border border-[#E2E8F0] rounded-lg text-xs text-[#1a1b1e] focus:border-[#002046] focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#1a1b1e] mb-1">
                  Giờ bắt đầu *
                </label>
                <input
                  type="time"
                  required
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full px-3 py-2 border border-[#E2E8F0] rounded-lg text-xs text-[#1a1b1e] focus:border-[#002046] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1a1b1e] mb-1">
                  Giờ kết thúc
                </label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full px-3 py-2 border border-[#E2E8F0] rounded-lg text-xs text-[#1a1b1e] focus:border-[#002046] focus:outline-none"
                />
              </div>
            </div>

            {/* Thành viên tham gia */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-[#1a1b1e]">
                Thành viên tham gia
              </label>

              {/* Selector / Custom add */}
              <div className="flex gap-2">
                {accounts.length > 0 && (
                  <select
                    value={selectedAccountId}
                    onChange={(e) => {
                      setSelectedAccountId(e.target.value);
                      handleAddAccountParticipant(e.target.value);
                    }}
                    className="flex-1 px-3 py-2 border border-[#E2E8F0] rounded-lg text-xs text-[#1a1b1e] focus:border-[#002046] focus:outline-none cursor-pointer bg-white"
                  >
                    <option value="">-- Chọn thành viên từ danh sách --</option>
                    {accounts.map((acc) => (
                      <option
                        key={acc.id}
                        value={acc.id}
                        disabled={selectedParticipants.some((p) => p.name === acc.name)}
                      >
                        {acc.name} ({acc.role})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Hoặc nhập tên thành viên khác..."
                  value={customParticipantName}
                  onChange={(e) => setCustomParticipantName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddCustomParticipant();
                    }
                  }}
                  className="flex-1 px-3 py-2 border border-[#E2E8F0] rounded-lg text-xs text-[#1a1b1e] focus:border-[#002046] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleAddCustomParticipant}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg text-xs font-semibold text-[#1a1b1e] transition-colors cursor-pointer shrink-0"
                >
                  Thêm
                </button>
              </div>

              {/* Selected List Chips */}
              <div className="flex flex-wrap gap-2 pt-1 max-h-32 overflow-y-auto">
                {selectedParticipants.length === 0 ? (
                  <p className="text-[11px] text-[#64748B] italic">Chưa chọn thành viên nào.</p>
                ) : (
                  selectedParticipants.map((p) => (
                    <span
                      key={p.id}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#F1F5F9] border border-[#E2E8F0] rounded-full text-xs font-medium text-[#1a1b1e]"
                    >
                      {p.avatar ? (
                        <img src={p.avatar} alt={p.name} className="w-4 h-4 rounded-full object-cover" />
                      ) : (
                        <span className="w-4 h-4 rounded-full bg-[#1b365d] text-white text-[9px] font-bold flex items-center justify-center">
                          {p.name.charAt(0)}
                        </span>
                      )}
                      <span>{p.name}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveParticipant(p.id)}
                        className="text-[#94A3B8] hover:text-red-500 rounded-full p-0.5 transition-colors cursor-pointer"
                        title="Xóa"
                      >
                        <span className="material-symbols-outlined text-[14px]">close</span>
                      </button>
                    </span>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 p-4 border-t border-[#E2E8F0] bg-[#F8FAFC] shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-[#E2E8F0] rounded-lg text-xs font-semibold text-[#64748B] hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-accent hover:opacity-90 text-white rounded-lg text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
            >
              Tạo cuộc họp
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

