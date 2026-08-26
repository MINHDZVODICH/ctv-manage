import React, { useState } from "react";
import { RegistrationRequest } from "../../types";
import { formatPhoneNumber, formatDateOnly } from "../../utils/formatters";

interface ViewRequestModalProps {
  request: RegistrationRequest | null;
  onClose: () => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}

const DEFAULT_CCCD_FRONT =
  "https://images.unsplash.com/photo-1557804506-669a67965ba0?auto=format&fit=crop&w=600&q=80";
const DEFAULT_CCCD_BACK =
  "https://images.unsplash.com/photo-1586281380349-632531db7ed4?auto=format&fit=crop&w=600&q=80";

export const ViewRequestModal: React.FC<ViewRequestModalProps> = ({
  request,
  onClose,
  onApprove,
  onReject,
}) => {
  const [previewImg, setPreviewImg] = useState<{ title: string; url: string } | null>(null);

  if (!request) return null;

  const cccdFrontUrl = request.cccdFront || DEFAULT_CCCD_FRONT;
  const cccdBackUrl = request.cccdBack || DEFAULT_CCCD_BACK;

  const handleViewCV = () => {
    if (request.cvFile) {
      window.open(request.cvFile, "_blank", "noopener,noreferrer");
      return;
    }

    alert(`Đang mở tài liệu: ${request.cvFileName || "CV"}`);
  };

  const fallbackContent = [
    "HỒ SƠ ĐĂNG KÝ CỘNG TÁC VIÊN",
    "",
    `Họ và tên: ${request.name}`,
    `Số điện thoại: ${request.phone}`,
    `Email: ${request.email}`,
    `Ngày sinh: ${request.dob || "Chưa cập nhật"}`,
    `Ngày đăng ký: ${formatDateOnly(request.submittedAt)}`,
  ].join("\n");
  const fallbackName = `${(request.cvFileName || `CV_${request.name}`)
    .replace(/\.[^.]+$/, "")
    .replace(/\s+/g, "_")}.txt`;
  const downloadHref =
    request.cvFile || `data:text/plain;charset=utf-8,${encodeURIComponent(fallbackContent)}`;
  const downloadName = request.cvFile ? request.cvFileName || "CV.pdf" : fallbackName;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between p-5 border-b border-[#E2E8F0] bg-[#F8FAFC]">
          <h3 className="text-lg font-bold text-[#1a1b1e]">Chi tiết Hồ sơ Đăng ký CTV</h3>
          <button
            onClick={onClose}
            className="text-[#74777f] hover:text-[#1a1b1e] p-1 rounded-full hover:bg-gray-200 transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[85vh] overflow-y-auto">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-accent text-white flex items-center justify-center font-bold text-lg shadow-sm">
              {request.initials || request.name.substring(0, 2).toUpperCase()}
            </div>
            <div>
              <h4 className="text-xl font-bold text-[#1a1b1e]">{request.name}</h4>
              <p className="text-xs text-[#44474e]">
                Thời gian đăng ký: {formatDateOnly(request.submittedAt)}
              </p>
            </div>
          </div>

          <div className="bg-[#F8FAFC] p-4 rounded-lg border border-[#E2E8F0] space-y-2.5 text-xs">
            <div className="flex justify-between border-b border-slate-100 pb-2">
              <span className="text-[#74777f] font-medium">Họ và tên:</span>
              <span className="font-semibold text-[#1a1b1e]">{request.name}</span>
            </div>
            <div className="flex justify-between border-b border-slate-100 pb-2">
              <span className="text-[#74777f] font-medium">Số điện thoại:</span>
              <span className="font-semibold text-[#1a1b1e]">
                {formatPhoneNumber(request.phone)}
              </span>
            </div>
            <div className="flex justify-between border-b border-slate-100 pb-2">
              <span className="text-[#74777f] font-medium">Email:</span>
              <span className="font-semibold text-[#1a1b1e]">{request.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#74777f] font-medium">Ngày sinh:</span>
              <span className="font-semibold text-[#1a1b1e]">{request.dob || "14/05/1995"}</span>
            </div>
          </div>

          {/* CCCD Section */}
          <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-[#1b365d] uppercase tracking-wider flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px]">badge</span>
                <span>Ảnh chụp CCCD (Mặt trước & Mặt sau)</span>
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div
                onClick={() =>
                  setPreviewImg({ title: `CCCD Mặt trước - ${request.name}`, url: cccdFrontUrl })
                }
                className="relative group rounded-xl border border-slate-200 bg-white overflow-hidden h-24 cursor-pointer shadow-2xs hover:border-blue-400 transition-all"
              >
                <img
                  src={cccdFrontUrl}
                  alt="CCCD Mặt trước"
                  className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1 text-white text-xs font-semibold">
                  <span className="material-symbols-outlined text-[16px]">zoom_in</span>
                  <span>Mặt trước</span>
                </div>
              </div>

              <div
                onClick={() =>
                  setPreviewImg({ title: `CCCD Mặt sau - ${request.name}`, url: cccdBackUrl })
                }
                className="relative group rounded-xl border border-slate-200 bg-white overflow-hidden h-24 cursor-pointer shadow-2xs hover:border-blue-400 transition-all"
              >
                <img
                  src={cccdBackUrl}
                  alt="CCCD Mặt sau"
                  className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1 text-white text-xs font-semibold">
                  <span className="material-symbols-outlined text-[16px]">zoom_in</span>
                  <span>Mặt sau</span>
                </div>
              </div>
            </div>
          </div>

          {/* CV Section */}
          <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-[#1b365d] uppercase tracking-wider flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px]">description</span>
                <span>Hồ sơ ứng tuyển (CV)</span>
              </span>
            </div>

            {request.cvFileName || request.cvFile ? (
              <div className="p-2.5 bg-white border border-slate-200 rounded-xl flex items-center justify-between gap-3 shadow-2xs">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                      (request.cvFileName || "").toLowerCase().endsWith(".pdf")
                        ? "bg-red-50 text-red-600 border border-red-200"
                        : "bg-blue-50 text-blue-600 border border-blue-200"
                    }`}
                  >
                    <span className="material-symbols-outlined text-[20px]">
                      {(request.cvFileName || "").toLowerCase().endsWith(".pdf")
                        ? "picture_as_pdf"
                        : "description"}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-[#1a1b1e] truncate">
                      {request.cvFileName || "Ho_so_CV.pdf"}
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                  <div className="group relative">
                    <button
                      type="button"
                      onClick={handleViewCV}
                      aria-label="Xem file"
                      className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-slate-200 bg-slate-100 text-slate-700 shadow-2xs transition-colors hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
                    >
                      <span className="material-symbols-outlined text-[18px]">visibility</span>
                    </button>
                    <span
                      role="tooltip"
                      className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-slate-900 px-2.5 py-1.5 text-[11px] font-semibold text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
                    >
                      Xem file
                    </span>
                  </div>

                  <div className="group relative">
                    <a
                      href={downloadHref}
                      download={downloadName}
                      aria-label="Tải về"
                      className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-slate-200 bg-slate-100 text-slate-700 shadow-2xs transition-colors hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
                    >
                      <span className="material-symbols-outlined text-[18px]">download</span>
                    </a>
                    <span
                      role="tooltip"
                      className="pointer-events-none absolute bottom-full right-0 z-20 mb-2 whitespace-nowrap rounded-lg bg-slate-900 px-2.5 py-1.5 text-[11px] font-semibold text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
                    >
                      Tải về
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-white border border-dashed border-slate-200 rounded-xl text-center text-xs text-slate-400">
                Chưa đính kèm file CV
              </div>
            )}
          </div>
        </div>

        {/* Actions Footer */}
        <div className="p-4 border-t border-[#E2E8F0] bg-[#F8FAFC] flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={() => {
              onReject(request.id);
              onClose();
            }}
            className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[16px]">cancel</span>
            <span>Từ chối hồ sơ</span>
          </button>
          <button
            type="button"
            onClick={() => {
              onApprove(request.id);
              onClose();
            }}
            className="px-4 py-2 bg-[#16A34A] hover:bg-[#15803D] text-white rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
          >
            <span className="material-symbols-outlined text-[16px]">check_circle</span>
            <span>Phê duyệt</span>
          </button>
        </div>
      </div>

      {/* LIGHTBOX PREVIEW MODAL */}
      {previewImg && (
        <div className="fixed inset-0 z-60 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-xl w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#1b365d] text-[20px]">badge</span>
                <h3 className="font-bold text-sm text-[#1b365d]">{previewImg.title}</h3>
              </div>
              <button
                onClick={() => setPreviewImg(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-full cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-900 flex items-center justify-center max-h-[60vh]">
              <img
                src={previewImg.url}
                alt={previewImg.title}
                className="w-full h-auto object-contain max-h-[60vh]"
              />
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => setPreviewImg(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
