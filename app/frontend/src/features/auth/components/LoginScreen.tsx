import React, { useState, useEffect, useRef } from 'react';
import amstLogo from '../../../assets/logo.png';
import { validateBirthDateString } from '../../../shared/utils/formatters';
import { useSystemSettings } from '../../../shared/context/SystemSettingsContext';
import { normalizeErrorMessage, getApiErrorCode } from '../../../shared/api/errors';

interface LoginScreenProps {
  onLoginSuccess: (email: string, password: string) => Promise<void>;
  onRequestRegister?: (formData: FormData) => Promise<void>;
}

type AuthMode = 'login' | 'register' | 'register_success';

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess, onRequestRegister }) => {
  const { t } = useSystemSettings();
  const [mode, setMode] = useState<AuthMode>('login');

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [loginFieldErrors, setLoginFieldErrors] = useState<{
    email?: string;
    password?: string;
  }>({});
  const [isProcessing, setIsProcessing] = useState(false);

  // Register form state
  const [regName, setRegName] = useState('');
  const [regDay, setRegDay] = useState('');
  const [regMonth, setRegMonth] = useState('');
  const [regYear, setRegYear] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showRegConfirmPassword, setShowRegConfirmPassword] = useState(false);

  // Upload files state (base64 for preview)
  const [cccdFront, setCccdFront] = useState<string | null>(null);
  const [cccdBack, setCccdBack] = useState<string | null>(null);
  const [cvFile, setCvFile] = useState<string | null>(null);
  const [cvFileName, setCvFileName] = useState<string>('');
  const [cvFileSize, setCvFileSize] = useState<string>('');
  // actual File objects for API upload
  const [cccdFrontFile, setCccdFrontFile] = useState<File | null>(null);
  const [cccdBackFile, setCccdBackFile] = useState<File | null>(null);
  const [cvFileObj, setCvFileObj] = useState<File | null>(null);

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
  const [regGeneralError, setRegGeneralError] = useState('');

  // Countdown timer for register success
  const [countdown, setCountdown] = useState(5);

  // Format file size helper
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // CCCD Front handlers
  const handleCccdFrontChange = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setRegErrors((prev) => ({ ...prev, cccdFront: 'auth.error_invalid_image' }));
      return;
    }
    setCccdFrontFile(file);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
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
    if (!file.type.startsWith('image/')) {
      setRegErrors((prev) => ({ ...prev, cccdBack: 'auth.error_invalid_image' }));
      return;
    }
    setCccdBackFile(file);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
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

  // CV File handlers (PDF only)
  const handleCvFileChange = (file?: File) => {
    if (!file) return;
    const name = file.name.toLowerCase();
    const isAllowed = name.endsWith('.pdf');
    if (!isAllowed) {
      setRegErrors((prev) => ({ ...prev, cvFile: 'auth.error_invalid_cv' }));
      return;
    }
    setCvFileName(file.name);
    setCvFileSize(formatFileSize(file.size));
    setCvFileObj(file);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
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
    if (mode === 'register_success') {
      setCountdown(5);
      timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            setMode('login');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [mode]);

  // Submit Login
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    const fieldErrors: { email?: string; password?: string } = {};
    if (!loginEmail.trim()) fieldErrors.email = 'auth.field_required';
    if (!loginPassword) fieldErrors.password = 'auth.field_required';
    setLoginFieldErrors(fieldErrors);

    if (Object.keys(fieldErrors).length > 0) {
      return;
    }

    setIsProcessing(true);
    try {
      await onLoginSuccess(loginEmail, loginPassword);
    } catch (err: unknown) {
      const code = getApiErrorCode(err);
      const msg = normalizeErrorMessage(err, '');
      const lower = msg.toLowerCase();
      if (
        code === 'ACCOUNT_PENDING_APPROVAL' ||
        lower.includes('chờ duyệt') ||
        lower.includes('awaiting approval')
      ) {
        setLoginError('auth.account_pending_approval');
      } else if (
        code === 'ACCOUNT_DISABLED' ||
        lower.includes('vô hiệu hóa') ||
        lower.includes('disabled')
      ) {
        setLoginError('auth.account_disabled');
      } else if (
        lower.includes('email hoặc mật khẩu không đúng') ||
        lower.includes('invalid credentials') ||
        lower.includes('invalid email or password')
      ) {
        setLoginError('auth.invalid_credentials');
      } else if (msg) {
        setLoginError(msg);
      } else {
        setLoginError('auth.login_failed');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const clearRegError = (field: string) => {
    setRegGeneralError('');
    setRegErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  // Submit Register
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegGeneralError('');
    const errors: { [key: string]: string } = {};

    if (!regName.trim()) errors.regName = 'auth.error_name_required';
    if (!regEmail.trim()) errors.regEmail = 'auth.error_email_required';
    if (regPhone.trim() && !/^\d{10,11}$/.test(regPhone.trim())) {
      errors.regPhone = 'auth.error_phone_format';
    }
    if (!cccdFrontFile) errors.cccdFront = 'auth.error_cccd_front_required';
    if (!cccdBackFile) errors.cccdBack = 'auth.error_cccd_back_required';
    if (!regPassword) {
      errors.regPassword = 'auth.error_password_required';
    } else if (regPassword.length < 6) {
      errors.regPassword = 'auth.error_password_min_length';
    }
    if (!regConfirmPassword) {
      errors.regConfirmPassword = 'auth.error_confirm_password_required';
    } else if (regPassword && regConfirmPassword && regPassword !== regConfirmPassword) {
      errors.regConfirmPassword = 'auth.error_password_mismatch';
    }

    const hasAnyDobPart = Boolean(regDay || regMonth || regYear);
    const hasAllDobParts = Boolean(regDay && regMonth && regYear);

    if (hasAnyDobPart && !hasAllDobParts) {
      errors.regDob = 'auth.error_dob_format';
    } else if (hasAllDobParts) {
      const dobValidation = validateBirthDateString(`${regDay}/${regMonth}/${regYear}`);
      if (!dobValidation.isValid) {
        const errText = dobValidation.error || '';
        if (errText.includes('tương lai') || errText.includes('future')) {
          errors.regDob = 'auth.error_dob_future';
        } else if (errText.includes('Định dạng') || errText.includes('format')) {
          errors.regDob = 'auth.error_dob_format';
        } else {
          errors.regDob = errText || 'auth.error_dob_invalid';
        }
      }
    }

    if (Object.keys(errors).length > 0) {
      setRegErrors(errors);
      return;
    }

    setRegErrors({});
    setIsProcessing(true);

    try {
      const form = new FormData();
      form.append('email', regEmail.trim());
      form.append('displayName', regName.trim());
      if (regPhone.trim()) {
        form.append('phone', regPhone.trim());
      }
      form.append('password', regPassword);
      if (regDay && regMonth && regYear) {
        form.append('dateOfBirth', `${regYear}-${regMonth}-${regDay}`);
      }
      if (cccdFrontFile) form.append('cccdFront', cccdFrontFile);
      if (cccdBackFile) form.append('cccdBack', cccdBackFile);
      if (cvFileObj) form.append('cv', cvFileObj);

      if (onRequestRegister) {
        await onRequestRegister(form);
      }
      setMode('register_success');
    } catch (err: unknown) {
      const msg: string = normalizeErrorMessage(err, '');
      const lower = msg.toLowerCase();
      if (lower.includes('email already') || lower.includes('email đã')) {
        setRegErrors({ regEmail: 'auth.error_email_exists' });
      } else if (lower.includes('email')) {
        setRegErrors({ regEmail: msg });
      } else if (lower.includes('mật khẩu') || lower.includes('password')) {
        setRegErrors({ regPassword: msg });
      } else if (lower.includes('cccd') || lower.includes('ảnh')) {
        setRegErrors({ cccdFront: msg });
      } else if (lower.includes('cv') || lower.includes('pdf')) {
        setRegErrors({ cvFile: msg });
      } else if (lower.includes('phone already') || lower.includes('số điện thoại đã')) {
        setRegErrors({ regPhone: 'auth.error_phone_exists' });
      } else if (lower.includes('điện thoại') || lower.includes('phone')) {
        setRegErrors({ regPhone: msg });
      } else if (lower.includes('ngày sinh') || lower.includes('birth')) {
        setRegErrors({ regDob: msg });
      } else if (
        lower.includes('họ và tên') ||
        lower.includes('displayname') ||
        lower.includes('tên')
      ) {
        setRegErrors({ regName: msg });
      } else if (msg) {
        setRegGeneralError(msg);
      } else {
        setRegGeneralError('auth.registration_failed');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="bg-[#faf9fd] dark:bg-[#121318] text-[#1a1b1e] dark:text-[#f1f5f9] min-h-screen flex items-center justify-center font-['Inter',sans-serif] p-4 sm:p-6">
      <main
        className={`w-full ${
          mode === 'register' ? 'max-w-xl' : 'max-w-md'
        } bg-white dark:bg-[#1e1f26] rounded-2xl border border-[#E2E8F0] dark:border-[#2d303a] p-6 sm:p-8 flex flex-col relative overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.06)] transition-all duration-200`}
      >
        {/* Header Branding */}
        <div className="flex flex-col items-center mb-6">
          <div className="w-20 h-20 sm:w-24 sm:h-24 flex items-center justify-center mb-3">
            <img
              src={amstLogo}
              alt={t('auth.logo_alt')}
              className="w-full h-full object-contain drop-shadow-xs"
            />
          </div>
          <span className="text-xs sm:text-sm font-bold text-[#1b365d] dark:text-[#93c5fd] uppercase tracking-wider text-center">
            {t('auth.org_name')}
          </span>
          <p className="text-[11px] sm:text-xs text-[#74777f] dark:text-slate-400 text-center mt-0.5 font-medium">
            {t('auth.system_subtitle')}
          </p>
        </div>

        {/* MODE: LOGIN */}
        {mode === 'login' && (
          <div>
            <h1
              className={`text-xl font-bold text-[#002046] dark:text-white text-center ${
                loginError ? 'mb-2' : 'mb-6'
              }`}
            >
              {t('auth.login_heading')}
            </h1>
            {loginError && (
              <p className="mb-6 text-center text-[11px] font-medium text-[#DC2626]">
                {t(loginError)}
              </p>
            )}

            <form onSubmit={handleLoginSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#1a1b1e] dark:text-slate-200 block">
                  {t('auth.email')}
                </label>
                <input
                  type="email"
                  value={loginEmail}
                  onChange={(e) => {
                    setLoginEmail(e.target.value);
                    setLoginFieldErrors((current) => ({ ...current, email: undefined }));
                    setLoginError('');
                  }}
                  disabled={isProcessing}
                  className={`w-full px-3 py-2 bg-[#faf9fd] dark:bg-[#262730] border rounded-lg text-[#1a1b1e] dark:text-[#f1f5f9] text-sm focus:outline-none focus:border-[#002046] dark:focus:border-blue-400 h-[40px] ${
                    loginFieldErrors.email
                      ? 'border-[#DC2626]'
                      : 'border-[#c4c6cf] dark:border-[#3b3d48]'
                  }`}
                />
                {loginFieldErrors.email && (
                  <p className="text-right text-[11px] font-medium text-[#DC2626]">
                    {t(loginFieldErrors.email)}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#1a1b1e] dark:text-slate-200 block">
                  {t('auth.password')}
                </label>
                <div className="relative">
                  <input
                    type={showLoginPassword ? 'text' : 'password'}
                    value={loginPassword}
                    onChange={(e) => {
                      setLoginPassword(e.target.value);
                      setLoginFieldErrors((current) => ({ ...current, password: undefined }));
                      setLoginError('');
                    }}
                    disabled={isProcessing}
                    className={`w-full pl-3 pr-10 py-2 bg-[#faf9fd] dark:bg-[#262730] border rounded-lg text-[#1a1b1e] dark:text-[#f1f5f9] text-sm focus:outline-none focus:border-[#002046] dark:focus:border-blue-400 h-[40px] ${
                      loginFieldErrors.password
                        ? 'border-[#DC2626]'
                        : 'border-[#c4c6cf] dark:border-[#3b3d48]'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                    aria-label={
                      showLoginPassword ? t('auth.hide_password') : t('auth.show_password')
                    }
                    title={showLoginPassword ? t('auth.hide_password') : t('auth.show_password')}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#74777f] dark:text-slate-400 hover:text-[#002046] dark:hover:text-white cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[20px]">
                      {showLoginPassword ? 'visibility' : 'visibility_off'}
                    </span>
                  </button>
                </div>
                {loginFieldErrors.password && (
                  <p className="text-right text-[11px] font-medium text-[#DC2626]">
                    {t(loginFieldErrors.password)}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={isProcessing}
                className="w-full bg-accent hover:bg-accent-hover text-white font-semibold text-sm py-2 px-4 rounded-lg h-[42px] transition-colors flex items-center justify-center gap-2 shadow-xs cursor-pointer disabled:opacity-50"
              >
                <span>{isProcessing ? t('auth.logging_in') : t('auth.login_btn')}</span>
              </button>

              <div className="text-center pt-4 border-t border-[#E2E8F0] dark:border-[#2d303a]">
                <p className="text-xs text-[#44474e] dark:text-slate-400">
                  {t('auth.no_account')}{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setMode('register');
                      setRegErrors({});
                      setRegGeneralError('');
                    }}
                    className="text-[#002046] dark:text-blue-400 font-bold hover:underline cursor-pointer ml-1"
                  >
                    {t('auth.create_new_account')}
                  </button>
                </p>
              </div>
            </form>
          </div>
        )}

        {/* MODE: REGISTER */}
        {mode === 'register' && (
          <div>
            <h1 className="text-xl font-bold text-[#002046] dark:text-white text-center mb-5">
              {t('auth.register_heading')}
            </h1>

            {regGeneralError && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-xs rounded-xl flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-red-600 dark:text-red-400">
                  error
                </span>
                <span>{t(regGeneralError)}</span>
              </div>
            )}

            <form onSubmit={handleRegisterSubmit} className="space-y-4" autoComplete="off">
              {/* Họ và tên */}
              <div>
                <label className="text-xs font-semibold text-[#1a1b1e] dark:text-slate-200 block mb-1">
                  {t('auth.full_name')} <span className="text-[#DC2626]">*</span>
                </label>
                <input
                  type="text"
                  autoComplete="off"
                  value={regName}
                  onFocus={() => clearRegError('regName')}
                  onClick={() => clearRegError('regName')}
                  onChange={(e) => {
                    setRegName(e.target.value);
                    clearRegError('regName');
                  }}
                  className={`w-full px-3 py-2 bg-[#faf9fd] dark:bg-[#262730] border rounded-lg text-sm text-[#1a1b1e] dark:text-[#f1f5f9] h-[38px] ${
                    regErrors.regName
                      ? 'border-[#DC2626]'
                      : 'border-[#c4c6cf] dark:border-[#3b3d48]'
                  }`}
                />
                {regErrors.regName && (
                  <p className="text-[11px] text-[#DC2626] mt-1 font-medium">
                    {t(regErrors.regName)}
                  </p>
                )}
              </div>

              {/* Ngày sinh (3 dropdowns: Ngày, Tháng, Năm) */}
              <div>
                <label className="text-xs font-semibold text-[#1a1b1e] dark:text-slate-200 block mb-1">
                  {t('auth.dob')}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <select
                    value={regDay}
                    onFocus={() => clearRegError('regDob')}
                    onClick={() => clearRegError('regDob')}
                    onChange={(e) => {
                      setRegDay(e.target.value);
                      clearRegError('regDob');
                    }}
                    className="px-2 py-1.5 border border-[#c4c6cf] dark:border-[#3b3d48] rounded-lg text-xs bg-[#faf9fd] dark:bg-[#262730] text-[#1a1b1e] dark:text-[#f1f5f9] h-[38px] cursor-pointer"
                  >
                    <option value="">--</option>
                    {Array.from(
                      {
                        length: new Date(
                          parseInt(regYear || '2000', 10),
                          parseInt(regMonth || '1', 10),
                          0,
                        ).getDate(),
                      },
                      (_, i) => {
                        const d = String(i + 1).padStart(2, '0');
                        return (
                          <option key={d} value={d}>
                            {t('auth.day_option', { day: d })}
                          </option>
                        );
                      },
                    )}
                  </select>
                  <select
                    value={regMonth}
                    onFocus={() => clearRegError('regDob')}
                    onClick={() => clearRegError('regDob')}
                    onChange={(e) => {
                      const newMonth = e.target.value;
                      setRegMonth(newMonth);
                      if (newMonth && regDay) {
                        const maxDays = new Date(
                          parseInt(regYear || '2000', 10),
                          parseInt(newMonth, 10),
                          0,
                        ).getDate();
                        if (parseInt(regDay, 10) > maxDays) {
                          setRegDay(String(maxDays).padStart(2, '0'));
                        }
                      }
                      clearRegError('regDob');
                    }}
                    className="px-2 py-1.5 border border-[#c4c6cf] dark:border-[#3b3d48] rounded-lg text-xs bg-[#faf9fd] dark:bg-[#262730] text-[#1a1b1e] dark:text-[#f1f5f9] h-[38px] cursor-pointer"
                  >
                    <option value="">--</option>
                    {Array.from({ length: 12 }, (_, i) => {
                      const m = String(i + 1).padStart(2, '0');
                      return (
                        <option key={m} value={m}>
                          {t('auth.month_option', { month: m })}
                        </option>
                      );
                    })}
                  </select>
                  <select
                    value={regYear}
                    onFocus={() => clearRegError('regDob')}
                    onClick={() => clearRegError('regDob')}
                    onChange={(e) => {
                      const newYear = e.target.value;
                      setRegYear(newYear);
                      if (newYear && regMonth && regDay) {
                        const maxDays = new Date(
                          parseInt(newYear, 10),
                          parseInt(regMonth, 10),
                          0,
                        ).getDate();
                        if (parseInt(regDay, 10) > maxDays) {
                          setRegDay(String(maxDays).padStart(2, '0'));
                        }
                      }
                      clearRegError('regDob');
                    }}
                    className="px-2 py-1.5 border border-[#c4c6cf] dark:border-[#3b3d48] rounded-lg text-xs bg-[#faf9fd] dark:bg-[#262730] text-[#1a1b1e] dark:text-[#f1f5f9] h-[38px] cursor-pointer"
                  >
                    <option value="">--</option>
                    {Array.from({ length: new Date().getFullYear() - 1949 }, (_, i) => {
                      const y = String(1950 + i);
                      return (
                        <option key={y} value={y}>
                          {y}
                        </option>
                      );
                    }).reverse()}
                  </select>
                </div>
                {regErrors.regDob && (
                  <p className="text-[11px] text-[#DC2626] mt-1 font-medium">
                    {t(regErrors.regDob)}
                  </p>
                )}
              </div>

              {/* Email & Số điện thoại (Responsive Grid) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Email */}
                <div>
                  <label className="text-xs font-semibold text-[#1a1b1e] dark:text-slate-200 block mb-1">
                    {t('auth.email')} <span className="text-[#DC2626]">*</span>
                  </label>
                  <input
                    type="email"
                    autoComplete="off"
                    value={regEmail}
                    onFocus={() => clearRegError('regEmail')}
                    onClick={() => clearRegError('regEmail')}
                    onChange={(e) => {
                      setRegEmail(e.target.value);
                      clearRegError('regEmail');
                    }}
                    className={`w-full px-3 py-2 bg-[#faf9fd] dark:bg-[#262730] border rounded-lg text-sm text-[#1a1b1e] dark:text-[#f1f5f9] h-[38px] ${
                      regErrors.regEmail
                        ? 'border-[#DC2626]'
                        : 'border-[#c4c6cf] dark:border-[#3b3d48]'
                    }`}
                  />
                  {regErrors.regEmail && (
                    <p className="text-[11px] text-[#DC2626] mt-1 font-medium">
                      {t(regErrors.regEmail)}
                    </p>
                  )}
                </div>

                {/* Số điện thoại */}
                <div>
                  <label className="text-xs font-semibold text-[#1a1b1e] dark:text-slate-200 block mb-1">
                    {t('auth.phone')}
                  </label>
                  <input
                    type="tel"
                    autoComplete="off"
                    value={regPhone}
                    onFocus={() => clearRegError('regPhone')}
                    onClick={() => clearRegError('regPhone')}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 11);
                      setRegPhone(val);
                      clearRegError('regPhone');
                    }}
                    className={`w-full px-3 py-2 bg-[#faf9fd] dark:bg-[#262730] border rounded-lg text-sm text-[#1a1b1e] dark:text-[#f1f5f9] h-[38px] ${
                      regErrors.regPhone
                        ? 'border-[#DC2626]'
                        : 'border-[#c4c6cf] dark:border-[#3b3d48]'
                    }`}
                  />
                  {regErrors.regPhone && (
                    <p className="text-[11px] text-[#DC2626] mt-1 font-medium">
                      {t(regErrors.regPhone)}
                    </p>
                  )}
                </div>
              </div>

              {/* PHẦN 1 & 2: UPLOAD ẢNH CCCD MẶT TRƯỚC VÀ MẶT SAU */}
              <div className="pt-2">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-[#1a1b1e] dark:text-slate-200 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[#1b365d] dark:text-blue-400 text-[18px]">
                      badge
                    </span>
                    <span>
                      {t('auth.cccd_section_title')} <span className="text-[#DC2626]">*</span>
                    </span>
                  </label>
                  <span className="text-[11px] text-[#74777f] dark:text-slate-400">
                    {t('auth.cccd_format_hint')}
                  </span>
                </div>

                {/* Hidden File Inputs for CCCD */}
                <input
                  type="file"
                  ref={cccdFrontInputRef}
                  data-testid="registration-cccd-front"
                  accept="image/png, image/jpeg, image/jpg, image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    handleCccdFrontChange(file);
                    e.target.value = '';
                  }}
                />
                <input
                  type="file"
                  ref={cccdBackInputRef}
                  data-testid="registration-cccd-back"
                  accept="image/png, image/jpeg, image/jpg, image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    handleCccdBackChange(file);
                    e.target.value = '';
                  }}
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* CCCD Mặt trước */}
                  <div onClick={() => clearRegError('cccdFront')}>
                    <div className="text-[11px] font-medium text-[#44474e] dark:text-slate-400 mb-1 flex items-center justify-between">
                      <span>{t('auth.front_side')}</span>
                      {cccdFront && (
                        <button
                          type="button"
                          onClick={() => {
                            setCccdFront(null);
                            setCccdFrontFile(null);
                          }}
                          className="text-[11px] text-[#DC2626] hover:underline cursor-pointer"
                        >
                          {t('auth.remove')}
                        </button>
                      )}
                    </div>

                    {cccdFront ? (
                      <div className="relative group rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 overflow-hidden h-28 flex items-center justify-center shadow-2xs">
                        <img
                          src={cccdFront}
                          alt={t('auth.cccd_front')}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setPreviewImage({ title: t('auth.cccd_front'), url: cccdFront })
                            }
                            className="p-1.5 bg-white/90 hover:bg-white text-[#1b365d] rounded-full shadow-xs cursor-pointer"
                            title={t('auth.zoom_image')}
                            aria-label={t('auth.zoom_image')}
                          >
                            <span className="material-symbols-outlined text-[18px]">zoom_in</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => cccdFrontInputRef.current?.click()}
                            className="p-1.5 bg-white/90 hover:bg-white text-[#1b365d] rounded-full shadow-xs cursor-pointer"
                            title={t('auth.change_image')}
                            aria-label={t('auth.change_image')}
                          >
                            <span className="material-symbols-outlined text-[18px]">sync</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div
                        data-testid="registration-cccd-front-dropzone"
                        onClick={() => {
                          clearRegError('cccdFront');
                          cccdFrontInputRef.current?.click();
                        }}
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
                          regErrors.cccdFront
                            ? 'border-[#DC2626] bg-red-50/20 dark:border-[#DC2626] dark:bg-red-950/20'
                            : isDraggingFront
                              ? 'border-[#1b365d] bg-blue-50/50 dark:border-blue-400 dark:bg-blue-950/30'
                              : 'border-slate-300 dark:border-slate-700 hover:border-[#1b365d] dark:hover:border-blue-400 bg-[#faf9fd] dark:bg-[#25262f] hover:bg-blue-50/20 dark:hover:bg-slate-800/60'
                        }`}
                      >
                        <span className="material-symbols-outlined text-slate-400 dark:text-blue-400/80 text-[24px] mb-1">
                          add_a_photo
                        </span>
                        <p className="text-[11px] font-semibold text-[#1b365d] dark:text-blue-300">
                          {t('auth.upload_photo')}
                        </p>
                        <p className="text-[10px] text-slate-400 dark:text-slate-400 mt-0.5">
                          {t('auth.drag_drop_photo_hint')}
                        </p>
                      </div>
                    )}
                    {regErrors.cccdFront && (
                      <p className="text-[11px] text-[#DC2626] mt-1 font-medium">
                        {t(regErrors.cccdFront)}
                      </p>
                    )}
                  </div>

                  {/* CCCD Mặt sau */}
                  <div onClick={() => clearRegError('cccdBack')}>
                    <div className="text-[11px] font-medium text-[#44474e] dark:text-slate-400 mb-1 flex items-center justify-between">
                      <span>{t('auth.back_side')}</span>
                      {cccdBack && (
                        <button
                          type="button"
                          onClick={() => {
                            setCccdBack(null);
                            setCccdBackFile(null);
                          }}
                          className="text-[11px] text-[#DC2626] hover:underline cursor-pointer"
                        >
                          {t('auth.remove')}
                        </button>
                      )}
                    </div>

                    {cccdBack ? (
                      <div className="relative group rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 overflow-hidden h-28 flex items-center justify-center shadow-2xs">
                        <img
                          src={cccdBack}
                          alt={t('auth.cccd_back')}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setPreviewImage({ title: t('auth.cccd_back'), url: cccdBack })
                            }
                            className="p-1.5 bg-white/90 hover:bg-white text-[#1b365d] rounded-full shadow-xs cursor-pointer"
                            title={t('auth.zoom_image')}
                            aria-label={t('auth.zoom_image')}
                          >
                            <span className="material-symbols-outlined text-[18px]">zoom_in</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => cccdBackInputRef.current?.click()}
                            className="p-1.5 bg-white/90 hover:bg-white text-[#1b365d] rounded-full shadow-xs cursor-pointer"
                            title={t('auth.change_image')}
                            aria-label={t('auth.change_image')}
                          >
                            <span className="material-symbols-outlined text-[18px]">sync</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div
                        data-testid="registration-cccd-back-dropzone"
                        onClick={() => {
                          clearRegError('cccdBack');
                          cccdBackInputRef.current?.click();
                        }}
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
                          regErrors.cccdBack
                            ? 'border-[#DC2626] bg-red-50/20 dark:border-[#DC2626] dark:bg-red-950/20'
                            : isDraggingBack
                              ? 'border-[#1b365d] bg-blue-50/50 dark:border-blue-400 dark:bg-blue-950/30'
                              : 'border-slate-300 dark:border-slate-700 hover:border-[#1b365d] dark:hover:border-blue-400 bg-[#faf9fd] dark:bg-[#25262f] hover:bg-blue-50/20 dark:hover:bg-slate-800/60'
                        }`}
                      >
                        <span className="material-symbols-outlined text-slate-400 dark:text-blue-400/80 text-[24px] mb-1">
                          add_a_photo
                        </span>
                        <p className="text-[11px] font-semibold text-[#1b365d] dark:text-blue-300">
                          {t('auth.upload_photo')}
                        </p>
                        <p className="text-[10px] text-slate-400 dark:text-slate-400 mt-0.5">
                          {t('auth.drag_drop_photo_hint')}
                        </p>
                      </div>
                    )}
                    {regErrors.cccdBack && (
                      <p className="text-[11px] text-[#DC2626] mt-1 font-medium">
                        {t(regErrors.cccdBack)}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* PHẦN 3: UPLOAD FILE PDF CV */}
              <div className="pt-2">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-[#1a1b1e] dark:text-slate-200 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[#1b365d] dark:text-blue-400 text-[18px]">
                      description
                    </span>
                    <span>{t('auth.cv')}</span>
                  </label>
                  <span className="text-[11px] text-[#74777f] dark:text-slate-400">.pdf</span>
                </div>

                {/* Hidden File Input for CV */}
                <input
                  type="file"
                  ref={cvFileInputRef}
                  data-testid="registration-cv"
                  accept=".pdf,application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    handleCvFileChange(file);
                    e.target.value = '';
                  }}
                />

                {cvFileName ? (
                  <div className="p-3 bg-[#F8FAFC] dark:bg-[#181920] border border-[#E2E8F0] dark:border-[#2d303a] rounded-xl flex items-center justify-between gap-3 shadow-2xs">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/60">
                        <span className="material-symbols-outlined text-[22px]">
                          picture_as_pdf
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-[#1a1b1e] dark:text-slate-100 truncate">
                          {cvFileName}
                        </p>
                        <div className="flex items-center gap-2 text-[11px] text-[#74777f] dark:text-slate-400">
                          <span>{cvFileSize}</span>
                          <span>•</span>
                          <span className="uppercase font-semibold text-[10px] bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-700 dark:text-slate-300">
                            PDF
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => cvFileInputRef.current?.click()}
                        className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-[#1b365d] dark:hover:text-blue-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                        title={t('auth.change_file_cv')}
                        aria-label={t('auth.change_file_cv')}
                      >
                        <span className="material-symbols-outlined text-[18px]">sync</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setCvFile(null);
                          setCvFileName('');
                          setCvFileSize('');
                          setCvFileObj(null);
                        }}
                        className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-lg transition-colors cursor-pointer"
                        title={t('auth.remove_file_cv')}
                        aria-label={t('auth.remove_file_cv')}
                      >
                        <span className="material-symbols-outlined text-[18px]">delete</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => {
                      clearRegError('cvFile');
                      cvFileInputRef.current?.click();
                    }}
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
                      regErrors.cvFile
                        ? 'border-[#DC2626] bg-red-50/20 dark:border-[#DC2626] dark:bg-red-950/20'
                        : isDraggingCv
                          ? 'border-[#1b365d] bg-blue-50/50 dark:border-blue-400 dark:bg-blue-950/30'
                          : 'border-slate-300 dark:border-slate-700 hover:border-[#1b365d] dark:hover:border-blue-400 bg-[#faf9fd] dark:bg-[#25262f] hover:bg-blue-50/20 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="flex items-center gap-2 text-slate-400 dark:text-blue-400/80 mb-1">
                      <span className="material-symbols-outlined text-[22px]">upload_file</span>
                    </div>
                    <p className="text-[12px] font-semibold text-[#1b365d] dark:text-blue-300">
                      {t('auth.upload_cv')}
                    </p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-400 mt-0.5">
                      {t('auth.drag_drop_cv_hint')}
                    </p>
                  </div>
                )}
                {regErrors.cvFile && (
                  <p className="text-[11px] text-[#DC2626] mt-1 font-medium">
                    {t(regErrors.cvFile)}
                  </p>
                )}
              </div>

              {/* Mật khẩu & Nhập lại mật khẩu (Responsive Grid) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                {/* Mật khẩu */}
                <div>
                  <label className="text-xs font-semibold text-[#1a1b1e] dark:text-slate-200 block mb-1">
                    {t('auth.password')} <span className="text-[#DC2626]">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showRegPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={regPassword}
                      onFocus={() => clearRegError('regPassword')}
                      onClick={() => clearRegError('regPassword')}
                      onChange={(e) => {
                        setRegPassword(e.target.value);
                        clearRegError('regPassword');
                      }}
                      className={`w-full pl-3 pr-9 py-2 bg-[#faf9fd] dark:bg-[#262730] border rounded-lg text-sm text-[#1a1b1e] dark:text-[#f1f5f9] h-[38px] ${
                        regErrors.regPassword
                          ? 'border-[#DC2626]'
                          : 'border-[#c4c6cf] dark:border-[#3b3d48]'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegPassword(!showRegPassword)}
                      aria-label={
                        showRegPassword ? t('auth.hide_password') : t('auth.show_password')
                      }
                      title={showRegPassword ? t('auth.hide_password') : t('auth.show_password')}
                      className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-[#74777f] dark:text-slate-400 hover:text-[#002046] dark:hover:text-white cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        {showRegPassword ? 'visibility' : 'visibility_off'}
                      </span>
                    </button>
                  </div>
                  {regErrors.regPassword && (
                    <p className="text-[11px] text-[#DC2626] mt-1 font-medium">
                      {t(regErrors.regPassword)}
                    </p>
                  )}
                </div>

                {/* Nhập lại mật khẩu */}
                <div>
                  <label className="text-xs font-semibold text-[#1a1b1e] dark:text-slate-200 block mb-1">
                    {t('auth.confirm_password')} <span className="text-[#DC2626]">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showRegConfirmPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={regConfirmPassword}
                      onFocus={() => clearRegError('regConfirmPassword')}
                      onClick={() => clearRegError('regConfirmPassword')}
                      onChange={(e) => {
                        setRegConfirmPassword(e.target.value);
                        clearRegError('regConfirmPassword');
                      }}
                      className={`w-full pl-3 pr-9 py-2 bg-[#faf9fd] dark:bg-[#262730] border rounded-lg text-sm text-[#1a1b1e] dark:text-[#f1f5f9] h-[38px] ${
                        regErrors.regConfirmPassword
                          ? 'border-[#DC2626]'
                          : 'border-[#c4c6cf] dark:border-[#3b3d48]'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegConfirmPassword(!showRegConfirmPassword)}
                      aria-label={
                        showRegConfirmPassword ? t('auth.hide_password') : t('auth.show_password')
                      }
                      title={
                        showRegConfirmPassword ? t('auth.hide_password') : t('auth.show_password')
                      }
                      className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-[#74777f] dark:text-slate-400 hover:text-[#002046] dark:hover:text-white cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        {showRegConfirmPassword ? 'visibility' : 'visibility_off'}
                      </span>
                    </button>
                  </div>
                  {regErrors.regConfirmPassword && (
                    <p className="text-[11px] text-[#DC2626] mt-1 font-medium">
                      {t(regErrors.regConfirmPassword)}
                    </p>
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={isProcessing}
                className="w-full bg-accent hover:bg-accent-hover text-white font-semibold text-sm py-2.5 px-4 rounded-lg h-[42px] transition-colors mt-3 cursor-pointer shadow-xs disabled:opacity-50"
              >
                {isProcessing ? t('auth.submitting') : t('auth.submit_registration')}
              </button>

              <div className="text-center pt-3 border-t border-[#E2E8F0] dark:border-[#2d303a]">
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  className="text-[#002046] dark:text-blue-400 text-xs font-bold hover:underline cursor-pointer"
                >
                  {t('auth.back_to_login')}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* MODE: REGISTER SUCCESS */}
        {mode === 'register_success' && (
          <div className="text-center space-y-4 py-4">
            <h3 className="text-lg font-bold text-[#1a1b1e] dark:text-white">
              {t('auth.reg_success_title')}
            </h3>
            <p className="text-xs text-[#44474e] dark:text-slate-300 leading-relaxed max-w-sm mx-auto">
              {t('auth.reg_success_desc')}
            </p>
            <div className="p-3 bg-[#F8FAFC] dark:bg-[#181920] border border-[#E2E8F0] dark:border-[#2d303a] rounded-xl text-xs text-[#74777f] dark:text-slate-400">
              {t('auth.redirect_countdown_prefix')}
              <span className="font-bold text-[#1b365d] dark:text-blue-400">{countdown}</span>
              {t('auth.redirect_countdown_suffix')}
            </div>
            <button
              onClick={() => setMode('login')}
              className="text-xs text-[#1b365d] dark:text-blue-400 font-bold hover:underline cursor-pointer block mx-auto"
            >
              {t('auth.go_to_login_now')}
            </button>
          </div>
        )}
      </main>

      {/* Lightbox Preview Modal for CCCD Photos */}
      {previewImage && (
        <div className="fixed inset-0 z-60 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#1e1f26] rounded-2xl border border-slate-200 dark:border-slate-700 max-w-xl w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#1b365d] dark:text-blue-400 text-[20px]">
                  badge
                </span>
                <h3 className="font-bold text-sm text-[#1b365d] dark:text-white">
                  {previewImage.title}
                </h3>
              </div>
              <button
                onClick={() => setPreviewImage(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-full cursor-pointer"
                title={t('auth.close')}
                aria-label={t('auth.close')}
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-900 flex items-center justify-center max-h-[60vh]">
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
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                {t('auth.close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LoginScreen;
