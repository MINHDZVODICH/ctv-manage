import React from 'react';
import { NotificationItem } from '../../types';

interface NotificationsPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: NotificationItem[];
  onMarkAllAsRead: () => void;
  onClearNotifications: () => void;
}

export const NotificationsPopover: React.FC<NotificationsPopoverProps> = ({
  isOpen,
  onClose,
  notifications,
  onMarkAllAsRead,
  onClearNotifications
}) => {
  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-30" onClick={onClose}></div>
      <div className="absolute right-12 top-16 w-80 sm:w-96 bg-white rounded-xl border border-[#E2E8F0] shadow-2xl z-40 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
        <div className="p-4 border-b border-[#E2E8F0] bg-[#F8FAFC] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h4 className="font-bold text-sm text-[#1a1b1e]">Thông báo</h4>
            <span className="bg-[#1b365d] text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
              {notifications.filter((n) => !n.read).length}
            </span>
          </div>
          <button
            onClick={onMarkAllAsRead}
            className="text-[11px] font-semibold text-[#002046] hover:underline cursor-pointer"
          >
            Đánh dấu đã đọc
          </button>
        </div>

        <div className="max-h-80 overflow-y-auto divide-y divide-[#E2E8F0]">
          {notifications.length === 0 ? (
            <div className="p-6 text-center text-xs text-[#74777f]">
              Không có thông báo mới nào.
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                className={`p-3.5 transition-colors flex gap-3 ${
                  !n.read ? 'bg-[#d6e3ff]/10 font-medium' : 'hover:bg-[#F8FAFC]'
                }`}
              >
                <div className="mt-0.5">
                  {n.type === 'info' && (
                    <span className="material-symbols-outlined text-[#0284C7] text-[18px]">info</span>
                  )}
                  {n.type === 'warning' && (
                    <span className="material-symbols-outlined text-[#EA580C] text-[18px]">warning</span>
                  )}
                  {n.type === 'success' && (
                    <span className="material-symbols-outlined text-[#16A34A] text-[18px]">check_circle</span>
                  )}
                  {n.type === 'danger' && (
                    <span className="material-symbols-outlined text-[#DC2626] text-[18px]">error</span>
                  )}
                </div>
                <div className="flex-1">
                  <h5 className="text-xs font-bold text-[#1a1b1e]">{n.title}</h5>
                  <p className="text-xs text-[#44474e] mt-0.5 leading-snug">{n.message}</p>
                  <span className="text-[10px] text-[#74777f] mt-1 block">{n.time}</span>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-3 border-t border-[#E2E8F0] bg-[#F8FAFC] text-center">
          <button
            onClick={onClearNotifications}
            className="text-xs font-semibold text-[#74777f] hover:text-[#DC2626] transition-colors cursor-pointer"
          >
            Xóa tất cả thông báo
          </button>
        </div>
      </div>
    </>
  );
};
