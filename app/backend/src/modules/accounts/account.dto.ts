export const formatAccountDto = (account: any, index = 1) => {
  const avatarFile = account.files?.find((f: any) => f.category === 'AVATAR')?.file;
  const cccdFrontFile = account.files?.find((f: any) => f.category === 'CCCD_FRONT')?.file;
  const cccdBackFile = account.files?.find((f: any) => f.category === 'CCCD_BACK')?.file;
  const cvFileAsset = account.files?.find((f: any) => f.category === 'CV')?.file;

  const initials = account.displayName
    ? account.displayName
        .split(' ')
        .filter(Boolean)
        .slice(-2)
        .map((part: string) => part[0])
        .join('')
        .toUpperCase() || account.displayName.slice(0, 2).toUpperCase()
    : 'U';

  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return {
    id: account.id,
    stt: index,
    name: account.displayName,
    email: account.email,
    phone: account.phone,
    role: account.role,
    status: account.status,
    mustChangePassword: account.mustChangePassword,
    avatar: avatarFile ? `/api/v1/files/${avatarFile.id}/content` : undefined,
    initials,
    registerDate: account.createdAt.toLocaleDateString('vi-VN'),
    dob: account.dateOfBirth || '',
    gender: account.gender || 'Nam',
    cccd: account.citizenId || '',
    cccdFront: cccdFrontFile ? `/api/v1/files/${cccdFrontFile.id}/content` : undefined,
    cccdBack: cccdBackFile ? `/api/v1/files/${cccdBackFile.id}/content` : undefined,
    cvFile: cvFileAsset ? `/api/v1/files/${cvFileAsset.id}/content` : undefined,
    cvFileName: cvFileAsset ? cvFileAsset.originalName : undefined,
    cvFileSize: cvFileAsset ? formatFileSize(cvFileAsset.sizeBytes) : undefined,
    address: account.address || '',
    cctvCode: account.ctvCode || '',
    joinDate: account.joinedAt ? account.joinedAt.toLocaleDateString('vi-VN') : '',
    shiftsCompleted: account._count?.shiftAssignments || 0,
    rating: 5.0,
    skills: account.skills ? account.skills.map((s: any) => s.skill?.name || s.name).filter(Boolean) : [],
    notes: account.adminNotes || '',
  };
};
