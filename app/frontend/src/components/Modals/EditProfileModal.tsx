import React, { useState, useRef } from "react";
import { UserAccount } from "../../types";

interface EditProfileModalProps {
  isOpen: boolean;
  user: UserAccount;
  onClose: () => void;
  onSave: (updatedData: Partial<UserAccount>) => void;
}

export const EditProfileModal: React.FC<EditProfileModalProps> = ({
  isOpen,
  user,
  onClose,
  onSave,
}) => {
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone);
  const [dob, setDob] = useState(user.dob || "15/08/1990");
  const [gender, setGender] = useState(user.gender || "Nam");
  const [address, setAddress] = useState(user.address || "");
  const [cvFile, setCvFile] = useState<string | undefined>(user.cvFile);
  const [cvFileName, setCvFileName] = useState<string | undefined>(
    user.cvFileName || (user.cvFile ? `CV_${user.name.replace(/\s+/g, "_")}.pdf` : undefined),
  );
  const [cvFileSize, setCvFileSize] = useState<string | undefined>(user.cvFileSize || "1.8 MB");

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleCvChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === "string") {
          setCvFile(reader.result);
          setCvFileName(file.name);
          setCvFileSize(formatFileSize(file.size));
        }
      };
      reader.readAsDataURL(file);
    }
    e.target.value = "";
  };

  const handleRemoveCv = () => {
    setCvFile(undefined);
    setCvFileName(undefined);
    setCvFileSize(undefined);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      name,
      phone,
      dob,
      gender,
      address,
      cvFile: cvFile || undefined,
      cvFileName: cvFileName || undefined,
      cvFileSize: cvFileSize || undefined,
    });
    onClose();
  };

  const isPdf = (cvFileName || "").toLowerCase().endsWith(".pdf");

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between p-5 border-b border-[#E2E8F0] bg-[#F8FAFC]">
          <h3 className="text-lg font-bold text-[#1a1b1e]">Chỉnh sửa thông tin cá nhân</h3>
          <button
            onClick={onClose}
            className="text-[#74777f] hover:text-[#1a1b1e] p-1 rounded-full hover:bg-gray-200 transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          <div>
            <label className="block text-xs font-semibold text-[#1a1b1e] mb-1">Họ và tên</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-[#c4c6cf] rounded text-sm text-[#1a1b1e] focus:border-[#002046] outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#1a1b1e] mb-1">
                Số điện thoại
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3 py-2 border border-[#c4c6cf] rounded text-sm text-[#1a1b1e] focus:border-[#002046] outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#1a1b1e] mb-1">Ngày sinh</label>
              <input
                type="text"
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                placeholder="15/08/1990"
                className="w-full px-3 py-2 border border-[#c4c6cf] rounded text-sm text-[#1a1b1e] focus:border-[#002046] outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#1a1b1e] mb-1">Giới tính</label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                className="w-full px-3 py-2 border border-[#c4c6cf] rounded text-sm text-[#1a1b1e] focus:border-[#002046] outline-none"
              >
                <option value="Nam">Nam</option>
                <option value="Nữ">Nữ</option>
                <option value="Khác">Khác</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#1a1b1e] mb-1">Địa chỉ</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="TP. Hồ Chí Minh"
                className="w-full px-3 py-2 border border-[#c4c6cf] rounded text-sm text-[#1a1b1e] focus:border-[#002046] outline-none"
              />
            </div>
          </div>

          {/* Hồ sơ ứng tuyển (CV) Edit Section */}
          <div className="pt-2 border-t border-[#E2E8F0]">
            <label className="block text-xs font-bold text-[#1b365d] uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px]">description</span>
              <span>Hồ sơ ứng tuyển (CV)</span>
            </label>

            <input
              type="file"
              ref={fileInputRef}
              accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="hidden"
              onChange={handleCvChange}
            />

            {cvFileName || cvFile ? (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      isPdf ? "bg-red-50 text-red-600" : "bg-blue-50 text-blue-600"
                    }`}
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {isPdf ? "picture_as_pdf" : "description"}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-800 truncate">{cvFileName}</p>
                    {cvFileSize && <p className="text-[10px] text-slate-500">{cvFileSize}</p>}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-2.5 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-50 border border-blue-200 rounded transition-colors cursor-pointer"
                  >
                    Thay đổi
                  </button>
                  <button
                    type="button"
                    onClick={handleRemoveCv}
                    className="p-1 text-rose-600 hover:bg-rose-50 border border-rose-200 rounded transition-colors cursor-pointer"
                    title="Xóa CV"
                  >
                    <span className="material-symbols-outlined text-[16px]">delete</span>
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-3 px-4 border-2 border-dashed border-slate-300 rounded-lg text-xs font-semibold text-slate-600 hover:text-blue-600 hover:border-blue-400 hover:bg-blue-50/40 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">upload_file</span>
                <span>Tải lên file CV (.pdf, .doc, .docx)</span>
              </button>
            )}
          </div>

          <div className="pt-4 border-t border-[#E2E8F0] flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-[#E2E8F0] rounded text-xs font-semibold text-[#44474e] hover:bg-gray-100 transition-colors"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-accent hover:opacity-90 text-white rounded text-xs font-semibold transition-colors cursor-pointer"
            >
              Lưu thay đổi
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
