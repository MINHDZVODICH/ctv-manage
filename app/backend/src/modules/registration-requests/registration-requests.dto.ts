export const formatRequestDto = (req: any, index = 1) => {
  const cccdFrontFile = req.files?.find((f: any) => f.category === 'CCCD_FRONT')?.file;
  const cccdBackFile = req.files?.find((f: any) => f.category === 'CCCD_BACK')?.file;
  const cvFileAsset = req.files?.find((f: any) => f.category === 'CV')?.file;

  const initials = req.displayName
    ? req.displayName
        .split(' ')
        .filter(Boolean)
        .slice(-2)
        .map((part: string) => part[0])
        .join('')
        .toUpperCase() || req.displayName.slice(0, 2).toUpperCase()
    : 'U';

  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const statusMap: Record<string, string> = {
    PENDING: 'Chờ duyệt',
    APPROVED: 'Đã duyệt',
    REJECTED: 'Từ chối',
  };

  return {
    id: req.id,
    stt: index,
    name: req.displayName,
    email: req.email,
    phone: req.phone,
    submittedAt: req.submittedAt.toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }),
    status: statusMap[req.status] || req.status,
    initials,
    dob: req.dateOfBirth || '',
    cccd: req.citizenId || '',
    address: req.address || '',
    experience: req.experience || '',
    rejectionReason: req.rejectionReason,
    cccdFront: cccdFrontFile ? `/api/v1/files/${cccdFrontFile.id}/content` : undefined,
    cccdBack: cccdBackFile ? `/api/v1/files/${cccdBackFile.id}/content` : undefined,
    cvFile: cvFileAsset ? `/api/v1/files/${cvFileAsset.id}/content` : undefined,
    cvFileName: cvFileAsset ? cvFileAsset.originalName : undefined,
    cvFileSize: cvFileAsset ? formatFileSize(cvFileAsset.sizeBytes) : undefined,
    notes: cvFileAsset ? `Đã đính kèm hồ sơ CV: ${cvFileAsset.originalName}` : undefined,
  };
};
