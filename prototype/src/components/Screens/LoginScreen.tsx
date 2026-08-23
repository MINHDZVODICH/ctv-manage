import React, { useState, useEffect, useRef } from "react";
import { RegistrationRequest } from "../../types";

interface LoginScreenProps {
  onLoginSuccess: (email: string) => void;
  onRequestRegister?: (requestData: RegistrationRequest) => void;
  onForgotPassword?: () => void;
}

type AuthMode = "login" | "register" | "forgot_email" | "forgot_otp" | "register_success";

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess, onRequestRegister }) => {
  const [mode, setMode] = useState<AuthMode>("login");

  // Login form state
  const [loginEmail, setLoginEmail] = useState("nhapemail@vienkhcn.vn");
  const [loginPassword, setLoginPassword] = useState("12345678");
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  // Register form state
  const [regName, setRegName] = useState("");
  const [regDay, setRegDay] = useState("01");
  const [regMonth, setRegMonth] = useState("01");
  const [regYear, setRegYear] = useState("1998");
  const [regEmail, setRegEmail] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirmPassword, setRegConfirmPassword] = useState("");
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showRegConfirmPassword, setShowRegConfirmPassword] = useState(false);

  // Upload files state
  const [cccdFront, setCccdFront] = useState<string | null>(null);
  const [cccdBack, setCccdBack] = useState<string | null>(null);
  const [cvFile, setCvFile] = useState<string | null>(null);
  const [cvFileName, setCvFileName] = useState<string>("");
  const [cvFileSize, setCvFileSize] = useState<string>("");

  // Drag over states
  const [isDraggingFront, setIsDraggingFront] = useState(false);
  const [isDraggingBack, setIsDraggingBack] = useState(false);
  const [isDraggingCv, setIsDraggingCv] = useState(false);

  // Lightbox preview for uploaded CCCD photos
  const [previewImage, setPreviewImage] = useState<{ title: string; url: string } | null>(null);

  // File input refs
  const cccdFrontInputRef = useRef<HTMLInputElement>(null);
  const cccdBackInputRef = useRef<HTMLInputElement>(null);
  const cvFileInputRef = useRef<HTMLInputElement>(null);

  const [regErrors, setRegErrors] = useState<{ [key: string]: string }>({});

  // Countdown timer for register success
  const [countdown, setCountdown] = useState(5);

  // Forgot password state
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotEmailError, setForgotEmailError] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpError, setOtpError] = useState("");
  const [otpNotice, setOtpNotice] = useState("");

  // Format file size helper
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // CCCD Front handlers
  const handleCccdFrontChange = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setRegErrors((prev) => ({ ...prev, cccdFront: "Vui lòng chọn file hình ảnh (JPG, PNG, WebP)!" }));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setCccdFront(reader.result);
        setRegErrors((prev) => {
          const next = { ...prev };
          delete next.cccdFront;
          return next;
        });
      }
    };
    reader.readAsDataURL(file);
  };

  // CCCD Back handlers
  const handleCccdBackChange = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setRegErrors((prev) => ({ ...prev, cccdBack: "Vui lòng chọn file hình ảnh (JPG, PNG, WebP)!" }));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setCccdBack(reader.result);
        setRegErrors((prev) => {
          const next = { ...prev };
          delete next.cccdBack;
          return next;
        });
      }
    };
    reader.readAsDataURL(file);
  };

  // CV File handlers (PDF, DOC, DOCX)
  const handleCvFileChange = (file?: File) => {
    if (!file) return;
    const name = file.name.toLowerCase();
    const isAllowed = name.endsWith(".pdf") || name.endsWith(".doc") || name.endsWith(".docx");
    if (!isAllowed) {
      setRegErrors((prev) => ({ ...prev, cvFile: "Vui lòng chọn file định dạng PDF (.pdf) hoặc Word (.doc, .docx)!" }));
      return;
    }
    setCvFileName(file.name);
    setCvFileSize(formatFileSize(file.size));
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setCvFile(reader.result);
        setRegErrors((prev) => {
          const next = { ...prev };
          delete next.cvFile;
          return next;
        });
      }
    };
    reader.readAsDataURL(file);
  };

  // Handle countdown when register_success
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (mode === "register_success") {
      setCountdown(5);
      timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            setMode("login");
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [mode]);

  // Submit Login
  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    if (!loginEmail) {
      setLoginError("Vui lòng nhập trường này!");
      return;
    }
    if (!loginPassword) {
      setLoginError("Vui lòng nhập trường này!");
      return;
    }

    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      onLoginSuccess(loginEmail);
    }, 600);
  };

  // Submit Register
  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errors: { [key: string]: string } = {};

    if (!regName.trim()) errors.regName = "Vui lòng nhập họ và tên!";
    if (!regEmail.trim()) errors.regEmail = "Vui lòng nhập email!";
    if (!regPhone.trim()) errors.regPhone = "Vui lòng nhập số điện thoại!";
    if (!regPassword) errors.regPassword = "Vui lòng nhập mật khẩu!";
    if (!regConfirmPassword) errors.regConfirmPassword = "Vui lòng nhập lại mật khẩu!";

    if (regEmail.toLowerCase() === "existing@vienkhcn.vn") {
      errors.regEmail = "Email đã có người sử dụng. Vui lòng chọn email khác!";
    }

    if (regPassword && regConfirmPassword && regPassword !== regConfirmPassword) {
      errors.regConfirmPassword = "Mật khẩu phải trùng khớp!";
    }

    if (Object.keys(errors).length > 0) {
      setRegErrors(errors);
      return;
    }

    setRegErrors({});
    setIsProcessing(true);

    const newRequest: RegistrationRequest = {
      id: `req-${Date.now()}`,
      stt: 1,
      name: regName.trim(),
      email: regEmail.trim(),
      phone: regPhone.trim(),
      dob: `${regDay}/${regMonth}/${regYear}`,
      submittedAt: new Date().toLocaleString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
      status: "Chờ duyệt",
      initials: regName.trim().substring(0, 2).toUpperCase(),
      cccdFront: cccdFront || undefined,
      cccdBack: cccdBack || undefined,
      cvFile: cvFile || undefined,
      cvFileName: cvFileName || undefined,
      cvFileSize: cvFileSize || undefined,
      notes: cvFileName ? `Đã đính kèm hồ sơ CV: ${cvFileName}` : undefined,
    };

    setTimeout(() => {
      setIsProcessing(false);
      if (onRequestRegister) {
        onRequestRegister(newRequest);
      }
      setMode("register_success");
    }, 600);
  };

  // Submit Forgot Email
  const handleForgotEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setForgotEmailError("");
    if (!forgotEmail) {
      setForgotEmailError("Vui lòng nhập trường này!");
      return;
    }
    if (forgotEmail.toLowerCase() === "notfound@vienkhcn.vn") {
      setForgotEmailError("Email không tồn tại trong hệ thống!");
      return;
    }

    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      setMode("forgot_otp");
    }, 600);
  };

  // Submit Forgot OTP
  const handleOtpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setOtpError("");
    if (!otpCode) {
      setOtpError("Vui lòng nhập trường này!");
      return;
    }
    if (otpCode !== "123456" && otpCode.length < 6) {
      setOtpError("Số bạn đã nhập không khớp với mã. Vui lòng thử lại!");
      return;
    }

    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      onLoginSuccess(forgotEmail || "nhapemail@vienkhcn.vn");
    }, 600);
  };

  return (
    <div className="bg-[#faf9fd] text-[#1a1b1e] min-h-screen flex items-center justify-center font-['Inter',sans-serif] p-4 sm:p-6">
      <main
        className={`w-full ${
          mode === "register" ? "max-w-xl" : "max-w-md"
        } bg-white rounded-2xl border border-[#E2E8F0] p-6 sm:p-8 flex flex-col relative overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.06)] transition-all duration-200`}
      >
        {/* Header Branding */}
        <div className="flex flex-col items-center mb-6">
          <div className="w-14 h-14 bg-[#1b365d] rounded-full flex items-center justify-center mb-3 shadow-xs">
            <span
              className="material-symbols-outlined text-white text-2xl"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              assured_workload
            </span>
          </div>
          <span className="text-xs font-bold text-[#1b365d] uppercase tracking-wider text-center">
            Viện Khoa học và Công nghệ Quân sự
          </span>
          <p className="text-[11px] text-[#74777f] text-center mt-0.5">
            Hệ thống Quản lý và Điều phối Lịch trình Cộng tác viên
          </p>
        </div>

        {/* MODE: LOGIN */}
        {mode === "login" && (
          <div>
            <h1 className="text-xl font-bold text-[#002046] text-center mb-6">Đăng nhập</h1>

            {loginError && (
              <p className="text-xs font-semibold text-[#DC2626] mb-4 text-center bg-[#ffdad6] p-2 rounded">
                {loginError}
              </p>
            )}

            <form onSubmit={handleLoginSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#1a1b1e] block">Email</label>
                <input
                  type="email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="nhapemail@vienkhcn.vn"
                  disabled={isProcessing}
                  className="w-full px-3 py-2 bg-[#faf9fd] border border-[#c4c6cf] rounded-lg text-[#1a1b1e] text-sm focus:outline-none focus:border-[#002046] h-[40px]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#1a1b1e] block">Mật khẩu</label>
                <div className="relative">
                  <input
                    type={showLoginPassword ? "text" : "password"}
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••"
                    disabled={isProcessing}
                    className="w-full pl-3 pr-10 py-2 bg-[#faf9fd] border border-[#c4c6cf] rounded-lg text-[#1a1b1e] text-sm focus:outline-none focus:border-[#002046] h-[40px]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#74777f] hover:text-[#002046]"
                  >
                    <span className="material-symbols-outlined text-[20px]">
                      {showLoginPassword ? "visibility" : "visibility_off"}
                    </span>
                  </button>
                </div>
                <div className="flex justify-end pt-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      setMode("forgot_email");
                      setForgotEmail("");
                      setForgotEmailError("");
                    }}
                    className="text-xs font-semibold text-[#002046] hover:underline cursor-pointer"
                  >
                    Quên mật khẩu?
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isProcessing}
                className="w-full bg-[#1b365d] hover:bg-[#002046] text-white font-semibold text-sm py-2 px-4 rounded-lg h-[42px] transition-colors flex items-center justify-center gap-2 shadow-xs cursor-pointer disabled:opacity-50"
              >
                <span>{isProcessing ? "Đang xử lý..." : "Đăng nhập"}</span>
              </button>

              <div className="text-center pt-4 border-t border-[#E2E8F0]">
                <p className="text-xs text-[#44474e]">
                  Chưa có tài khoản?{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setMode("register");
                      setRegErrors({});
                    }}
                    className="text-[#002046] font-bold hover:underline cursor-pointer ml-1"
                  >
                    Tạo tài khoản mới
                  </button>
                </p>
              </div>
            </form>
          </div>
        )}

        {/* MODE: REGISTER */}
        {mode === "register" && (
          <div>
            <h1 className="text-xl font-bold text-[#002046] text-center mb-5">Đăng ký tài khoản</h1>

            <form onSubmit={handleRegisterSubmit} className="space-y-4">
              {/* Họ và tên */}
              <div>
                <label className="text-xs font-semibold text-[#1a1b1e] block mb-1">
                  Họ và tên <span className="text-[#DC2626]">*</span>
                </label>
                <input
                  type="text"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  placeholder="Nguyễn Văn A"
                  className={`w-full px-3 py-2 bg-[#faf9fd] border rounded-lg text-sm h-[38px] ${
                    regErrors.regName ? "border-[#DC2626]" : "border-[#c4c6cf]"
                  }`}
                />
                {regErrors.regName && (
                  <p className="text-[11px] text-[#DC2626] mt-1 font-medium">{regErrors.regName}</p>
                )}
              </div>

              {/* Ngày sinh (3 dropdowns: Ngày, Tháng, Năm) */}
              <div>
                <label className="text-xs font-semibold text-[#1a1b1e] block mb-1">Ngày sinh</label>
                <div className="grid grid-cols-3 gap-2">
                  <select
                    value={regDay}
                    onChange={(e) => setRegDay(e.target.value)}
                    className="px-2 py-1.5 border border-[#c4c6cf] rounded-lg text-xs bg-[#faf9fd] h-[38px]"
                  >
                    {Array.from({ length: 31 }, (_, i) => {
                      const d = String(i + 1).padStart(2, "0");
                      return (
                        <option key={d} value={d}>
                          Ngày {d}
                        </option>
                      );
                    })}
                  </select>
                  <select
                    value={regMonth}
                    onChange={(e) => setRegMonth(e.target.value)}
                    className="px-2 py-1.5 border border-[#c4c6cf] rounded-lg text-xs bg-[#faf9fd] h-[38px]"
                  >
                    {Array.from({ length: 12 }, (_, i) => {
                      const m = String(i + 1).padStart(2, "0");
                      return (
                        <option key={m} value={m}>
                          Tháng {m}
                        </option>
                      );
                    })}
                  </select>
                  <select
                    value={regYear}
                    onChange={(e) => setRegYear(e.target.value)}
                    className="px-2 py-1.5 border border-[#c4c6cf] rounded-lg text-xs bg-[#faf9fd] h-[38px]"
                  >
                    {Array.from({ length: 45 }, (_, i) => {
                      const y = String(1970 + i);
                      return (
                        <option key={y} value={y}>
                          {y}
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>

              {/* Email & Số điện thoại (Responsive Grid) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Email */}
                <div>
                  <label className="text-xs font-semibold text-[#1a1b1e] block mb-1">
                    Email <span className="text-[#DC2626]">*</span>
                  </label>
                  <input
                    type="email"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="nguyenvana@vienkhcn.vn"
                    className={`w-full px-3 py-2 bg-[#faf9fd] border rounded-lg text-sm h-[38px] ${
                      regErrors.regEmail ? "border-[#DC2626]" : "border-[#c4c6cf]"
                    }`}
                  />
                  {regErrors.regEmail && (
                    <p className="text-[11px] text-[#DC2626] mt-1 font-medium">
                      {regErrors.regEmail}
                    </p>
                  )}
                </div>

                {/* Số điện thoại */}
                <div>
                  <label className="text-xs font-semibold text-[#1a1b1e] block mb-1">
                    Số điện thoại <span className="text-[#DC2626]">*</span>
                  </label>
                  <input
                    type="tel"
                    value={regPhone}
                    onChange={(e) => setRegPhone(e.target.value)}
                    placeholder="0987654321"
                    className={`w-full px-3 py-2 bg-[#faf9fd] border rounded-lg text-sm h-[38px] ${
                      regErrors.regPhone ? "border-[#DC2626]" : "border-[#c4c6cf]"
                    }`}
                  />
                  {regErrors.regPhone && (
                    <p className="text-[11px] text-[#DC2626] mt-1 font-medium">
                      {regErrors.regPhone}
                    </p>
                  )}
                </div>
              </div>

              {/* PHẦN 1 & 2: UPLOAD ẢNH CCCD MẶT TRƯỚC VÀ MẶT SAU */}
              <div className="pt-2">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-[#1a1b1e] flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[#1b365d] text-[18px]">
                      badge
                    </span>
                    <span>Ảnh CCCD (Mặt trước & Mặt sau)</span>
                  </label>
                  <span className="text-[11px] text-[#74777f]">Định dạng JPG, PNG</span>
                </div>

                {/* Hidden File Inputs for CCCD */}
                <input
                  type="file"
                  ref={cccdFrontInputRef}
                  accept="image/png, image/jpeg, image/jpg, image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    handleCccdFrontChange(file);
                    e.target.value = "";
                  }}
                />
                <input
                  type="file"
                  ref={cccdBackInputRef}
                  accept="image/png, image/jpeg, image/jpg, image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    handleCccdBackChange(file);
                    e.target.value = "";
                  }}
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* CCCD Mặt trước */}
                  <div>
                    <div className="text-[11px] font-medium text-[#44474e] mb-1 flex items-center justify-between">
                      <span>Mặt trước</span>
                      {cccdFront && (
                        <button
                          type="button"
                          onClick={() => setCccdFront(null)}
                          className="text-[11px] text-[#DC2626] hover:underline cursor-pointer"
                        >
                          Xóa
                        </button>
                      )}
                    </div>

                    {cccdFront ? (
                      <div className="relative group rounded-xl border border-slate-200 bg-slate-50 overflow-hidden h-28 flex items-center justify-center shadow-2xs">
                        <img
                          src={cccdFront}
                          alt="CCCD Mặt trước"
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setPreviewImage({ title: "CCCD Mặt trước", url: cccdFront })
                            }
                            className="p-1.5 bg-white/90 hover:bg-white text-[#1b365d] rounded-full shadow-xs cursor-pointer"
                            title="Phóng to xem ảnh"
                          >
                            <span className="material-symbols-outlined text-[18px]">zoom_in</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => cccdFrontInputRef.current?.click()}
                            className="p-1.5 bg-white/90 hover:bg-white text-[#1b365d] rounded-full shadow-xs cursor-pointer"
                            title="Đổi ảnh khác"
                          >
                            <span className="material-symbols-outlined text-[18px]">sync</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div
                        onClick={() => cccdFrontInputRef.current?.click()}
                        onDragOver={(e) => {
                          e.preventDefault();
                          setIsDraggingFront(true);
                        }}
                        onDragLeave={() => setIsDraggingFront(false)}
                        onDrop={(e) => {
                          e.preventDefault();
                          setIsDraggingFront(false);
                          const file = e.dataTransfer.files?.[0];
                          handleCccdFrontChange(file);
                        }}
                        className={`h-28 rounded-xl border-2 border-dashed transition-all cursor-pointer flex flex-col items-center justify-center p-3 text-center ${
                          isDraggingFront
                            ? "border-[#1b365d] bg-blue-50/50"
                            : "border-slate-300 hover:border-[#1b365d] bg-[#faf9fd] hover:bg-blue-50/20"
                        }`}
                      >
                        <span className="material-symbols-outlined text-slate-400 text-[24px] mb-1">
                          add_a_photo
                        </span>
                        <p className="text-[11px] font-semibold text-[#1b365d]">Tải ảnh mặt trước</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">Kéo thả hoặc nhấn để chọn</p>
                      </div>
                    )}
                    {regErrors.cccdFront && (
                      <p className="text-[11px] text-[#DC2626] mt-1 font-medium">
                        {regErrors.cccdFront}
                      </p>
                    )}
                  </div>

                  {/* CCCD Mặt sau */}
                  <div>
                    <div className="text-[11px] font-medium text-[#44474e] mb-1 flex items-center justify-between">
                      <span>Mặt sau</span>
                      {cccdBack && (
                        <button
                          type="button"
                          onClick={() => setCccdBack(null)}
                          className="text-[11px] text-[#DC2626] hover:underline cursor-pointer"
                        >
                          Xóa
                        </button>
                      )}
                    </div>

                    {cccdBack ? (
                      <div className="relative group rounded-xl border border-slate-200 bg-slate-50 overflow-hidden h-28 flex items-center justify-center shadow-2xs">
                        <img
                          src={cccdBack}
                          alt="CCCD Mặt sau"
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setPreviewImage({ title: "CCCD Mặt sau", url: cccdBack })
                            }
                            className="p-1.5 bg-white/90 hover:bg-white text-[#1b365d] rounded-full shadow-xs cursor-pointer"
                            title="Phóng to xem ảnh"
                          >
                            <span className="material-symbols-outlined text-[18px]">zoom_in</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => cccdBackInputRef.current?.click()}
                            className="p-1.5 bg-white/90 hover:bg-white text-[#1b365d] rounded-full shadow-xs cursor-pointer"
                            title="Đổi ảnh khác"
                          >
                            <span className="material-symbols-outlined text-[18px]">sync</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div
                        onClick={() => cccdBackInputRef.current?.click()}
                        onDragOver={(e) => {
                          e.preventDefault();
                          setIsDraggingBack(true);
                        }}
                        onDragLeave={() => setIsDraggingBack(false)}
                        onDrop={(e) => {
                          e.preventDefault();
                          setIsDraggingBack(false);
                          const file = e.dataTransfer.files?.[0];
                          handleCccdBackChange(file);
                        }}
                        className={`h-28 rounded-xl border-2 border-dashed transition-all cursor-pointer flex flex-col items-center justify-center p-3 text-center ${
                          isDraggingBack
                            ? "border-[#1b365d] bg-blue-50/50"
                            : "border-slate-300 hover:border-[#1b365d] bg-[#faf9fd] hover:bg-blue-50/20"
                        }`}
                      >
                        <span className="material-symbols-outlined text-slate-400 text-[24px] mb-1">
                          add_a_photo
                        </span>
                        <p className="text-[11px] font-semibold text-[#1b365d]">Tải ảnh mặt sau</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">Kéo thả hoặc nhấn để chọn</p>
                      </div>
                    )}
                    {regErrors.cccdBack && (
                      <p className="text-[11px] text-[#DC2626] mt-1 font-medium">
                        {regErrors.cccdBack}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* PHẦN 3: UPLOAD FILE PDF / WORD CV */}
              <div className="pt-2">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-[#1a1b1e] flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[#1b365d] text-[18px]">
                      description
                    </span>
                    <span>CV ứng tuyển (File PDF, Word)</span>
                  </label>
                  <span className="text-[11px] text-[#74777f]">.pdf, .doc, .docx</span>
                </div>

                {/* Hidden File Input for CV */}
                <input
                  type="file"
                  ref={cvFileInputRef}
                  accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    handleCvFileChange(file);
                    e.target.value = "";
                  }}
                />

                {cvFileName ? (
                  <div className="p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl flex items-center justify-between gap-3 shadow-2xs">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                          cvFileName.toLowerCase().endsWith(".pdf")
                            ? "bg-red-50 text-red-600 border border-red-200"
                            : "bg-blue-50 text-blue-600 border border-blue-200"
                        }`}
                      >
                        <span className="material-symbols-outlined text-[22px]">
                          {cvFileName.toLowerCase().endsWith(".pdf") ? "picture_as_pdf" : "description"}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-[#1a1b1e] truncate">{cvFileName}</p>
                        <div className="flex items-center gap-2 text-[11px] text-[#74777f]">
                          <span>{cvFileSize}</span>
                          <span>•</span>
                          <span className="uppercase font-semibold text-[10px] bg-slate-200 px-1.5 py-0.5 rounded text-slate-700">
                            {cvFileName.split(".").pop()}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => cvFileInputRef.current?.click()}
                        className="p-1.5 text-slate-500 hover:text-[#1b365d] hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                        title="Thay file khác"
                      >
                        <span className="material-symbols-outlined text-[18px]">sync</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setCvFile(null);
                          setCvFileName("");
                          setCvFileSize("");
                        }}
                        className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                        title="Xóa file CV"
                      >
                        <span className="material-symbols-outlined text-[18px]">delete</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => cvFileInputRef.current?.click()}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDraggingCv(true);
                    }}
                    onDragLeave={() => setIsDraggingCv(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDraggingCv(false);
                      const file = e.dataTransfer.files?.[0];
                      handleCvFileChange(file);
                    }}
                    className={`py-4 px-3 rounded-xl border-2 border-dashed transition-all cursor-pointer flex flex-col items-center justify-center text-center ${
                      isDraggingCv
                        ? "border-[#1b365d] bg-blue-50/50"
                        : "border-slate-300 hover:border-[#1b365d] bg-[#faf9fd] hover:bg-blue-50/20"
                    }`}
                  >
                    <div className="flex items-center gap-2 text-slate-400 mb-1">
                      <span className="material-symbols-outlined text-[22px]">upload_file</span>
                    </div>
                    <p className="text-[12px] font-semibold text-[#1b365d]">
                      Tải lên CV cá nhân (PDF hoặc Word)
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Kéo thả file vào đây hoặc nhấn để chọn từ thiết bị (.pdf, .doc, .docx)
                    </p>
                  </div>
                )}
                {regErrors.cvFile && (
                  <p className="text-[11px] text-[#DC2626] mt-1 font-medium">{regErrors.cvFile}</p>
                )}
              </div>

              {/* Mật khẩu & Nhập lại mật khẩu (Responsive Grid) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                {/* Mật khẩu */}
                <div>
                  <label className="text-xs font-semibold text-[#1a1b1e] block mb-1">
                    Mật khẩu <span className="text-[#DC2626]">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showRegPassword ? "text" : "password"}
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="••••••••"
                      className={`w-full pl-3 pr-9 py-2 bg-[#faf9fd] border rounded-lg text-sm h-[38px] ${
                        regErrors.regPassword ? "border-[#DC2626]" : "border-[#c4c6cf]"
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegPassword(!showRegPassword)}
                      className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-[#74777f] hover:text-[#002046]"
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        {showRegPassword ? "visibility" : "visibility_off"}
                      </span>
                    </button>
                  </div>
                  {regErrors.regPassword && (
                    <p className="text-[11px] text-[#DC2626] mt-1 font-medium">
                      {regErrors.regPassword}
                    </p>
                  )}
                </div>

                {/* Nhập lại mật khẩu */}
                <div>
                  <label className="text-xs font-semibold text-[#1a1b1e] block mb-1">
                    Nhập lại mật khẩu <span className="text-[#DC2626]">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showRegConfirmPassword ? "text" : "password"}
                      value={regConfirmPassword}
                      onChange={(e) => setRegConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className={`w-full pl-3 pr-9 py-2 bg-[#faf9fd] border rounded-lg text-sm h-[38px] ${
                        regErrors.regConfirmPassword ? "border-[#DC2626]" : "border-[#c4c6cf]"
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegConfirmPassword(!showRegConfirmPassword)}
                      className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-[#74777f] hover:text-[#002046]"
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        {showRegConfirmPassword ? "visibility" : "visibility_off"}
                      </span>
                    </button>
                  </div>
                  {regErrors.regConfirmPassword && (
                    <p className="text-[11px] text-[#DC2626] mt-1 font-medium">
                      {regErrors.regConfirmPassword}
                    </p>
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={isProcessing}
                className="w-full bg-[#1b365d] hover:bg-[#002046] text-white font-semibold text-sm py-2.5 px-4 rounded-lg h-[42px] transition-colors mt-3 cursor-pointer shadow-xs disabled:opacity-50"
              >
                {isProcessing ? "Đang xử lý..." : "Đăng ký"}
              </button>

              <div className="text-center pt-3 border-t border-[#E2E8F0]">
                <button
                  type="button"
                  onClick={() => setMode("login")}
                  className="text-[#002046] text-xs font-bold hover:underline cursor-pointer"
                >
                  Đăng nhập
                </button>
              </div>
            </form>
          </div>
        )}

        {/* MODE: REGISTER SUCCESS */}
        {mode === "register_success" && (
          <div className="text-center space-y-4 py-4">
            <div className="w-14 h-14 bg-[#c7ecc7] text-[#16A34A] rounded-full flex items-center justify-center mx-auto shadow-xs">
              <span className="material-symbols-outlined text-3xl">check_circle</span>
            </div>
            <h3 className="text-lg font-bold text-[#1a1b1e]">Gửi yêu cầu đăng ký thành công!</h3>
            <p className="text-xs text-[#44474e] leading-relaxed max-w-sm mx-auto">
              Hồ sơ ứng tuyển và thông tin của bạn đang được Ban Quản trị xem xét phê duyệt. Vui lòng theo dõi email để nhận thông báo kết quả.
            </p>
            <div className="p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-xs text-[#74777f]">
              Tự động chuyển đến trang đăng nhập sau <span className="font-bold text-[#1b365d]">{countdown}</span> giây
            </div>
            <button
              onClick={() => setMode("login")}
              className="text-xs text-[#1b365d] font-bold hover:underline cursor-pointer block mx-auto"
            >
              Chuyển sang trang đăng nhập ngay
            </button>
          </div>
        )}

        {/* MODE: FORGOT EMAIL */}
        {mode === "forgot_email" && (
          <div>
            <h1 className="text-xl font-bold text-[#002046] text-center mb-5">Quên mật khẩu</h1>

            <form onSubmit={handleForgotEmailSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-[#1a1b1e] block mb-1">
                  Nhập email nhận mã
                </label>
                <input
                  type="email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="nhapemail@vienkhcn.vn"
                  className={`w-full px-3 py-2 bg-[#faf9fd] border rounded-lg text-sm h-[40px] ${
                    forgotEmailError ? "border-[#DC2626]" : "border-[#c4c6cf]"
                  }`}
                />
                {forgotEmailError && (
                  <p className="text-[11px] text-[#DC2626] mt-1 font-medium">{forgotEmailError}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={isProcessing}
                className="w-full bg-[#1b365d] hover:bg-[#002046] text-white font-semibold text-sm py-2 px-4 rounded-lg h-[42px] transition-colors cursor-pointer disabled:opacity-50"
              >
                {isProcessing ? "Đang gửi..." : "Nhận mã"}
              </button>

              <div className="text-center pt-3 border-t border-[#E2E8F0]">
                <button
                  type="button"
                  onClick={() => setMode("login")}
                  className="text-xs text-[#44474e] hover:text-[#002046] font-semibold cursor-pointer"
                >
                  Quay lại đăng nhập
                </button>
              </div>
            </form>
          </div>
        )}

        {/* MODE: FORGOT OTP */}
        {mode === "forgot_otp" && (
          <div>
            <h1 className="text-xl font-bold text-[#002046] text-center mb-2">
              Xác nhận tài khoản
            </h1>
            <p className="text-xs text-[#44474e] text-center mb-5">
              Chúng tôi đã gửi mã đến email của bạn. Hãy nhập mã đó để xác nhận tài khoản.
            </p>

            <form onSubmit={handleOtpSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-[#1a1b1e] block mb-1">Nhập mã</label>
                <input
                  type="text"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  placeholder="Nhập mã 6 chữ số (ví dụ: 123456)"
                  className={`w-full px-3 py-2 bg-[#faf9fd] border rounded-lg text-sm h-[40px] tracking-widest text-center font-mono ${
                    otpError ? "border-[#DC2626]" : "border-[#c4c6cf]"
                  }`}
                />
                {otpError && (
                  <p className="text-[11px] text-[#DC2626] mt-1 font-medium">{otpError}</p>
                )}
              </div>

              {otpNotice && (
                <p className="text-[11px] text-[#002046] bg-[#f4f3f7] p-2 rounded text-center">
                  {otpNotice}
                </p>
              )}

              <button
                type="submit"
                disabled={isProcessing}
                className="w-full bg-[#1b365d] hover:bg-[#002046] text-white font-semibold text-sm py-2 px-4 rounded-lg h-[42px] transition-colors cursor-pointer disabled:opacity-50"
              >
                {isProcessing ? "Đang xác nhận..." : "Tiếp tục"}
              </button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() =>
                    setOtpNotice(
                      "Vui lòng đợi vài phút để nhận mã gồm 6 chữ số trước khi yêu cầu mã khác.",
                    )
                  }
                  className="text-xs text-[#002046] font-semibold hover:underline cursor-pointer"
                >
                  Không nhận được mã?
                </button>
              </div>

              <div className="text-center pt-3 border-t border-[#E2E8F0]">
                <button
                  type="button"
                  onClick={() => setMode("login")}
                  className="text-xs text-[#44474e] hover:text-[#002046] font-semibold cursor-pointer"
                >
                  Hủy bỏ
                </button>
              </div>
            </form>
          </div>
        )}
      </main>

      {/* Lightbox Preview Modal for CCCD Photos */}
      {previewImage && (
        <div className="fixed inset-0 z-60 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-xl w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#1b365d] text-[20px]">badge</span>
                <h3 className="font-bold text-sm text-[#1b365d]">{previewImage.title}</h3>
              </div>
              <button
                onClick={() => setPreviewImage(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-full cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-900 flex items-center justify-center max-h-[60vh]">
              <img
                src={previewImage.url}
                alt={previewImage.title}
                className="w-full h-auto object-contain max-h-[60vh]"
              />
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setPreviewImage(null)}
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

export default LoginScreen;
