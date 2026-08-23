const WEEKDAY_NAMES = [
  'Thứ 2',
  'Thứ 3',
  'Thứ 4',
  'Thứ 5',
  'Thứ 6',
  'Thứ 7',
  'Chủ Nhật',
];

const PERIOD_TO_TYPE: Record<string, 'morning' | 'afternoon' | 'evening'> = {
  MORNING: 'morning',
  AFTERNOON: 'afternoon',
  EVENING: 'evening',
};

const PERIOD_LABELS: Record<string, string> = {
  MORNING: '08:00 - 12:00',
  AFTERNOON: '13:30 - 17:30',
  EVENING: '18:00 - 21:00',
};

const ROOM_DISPLAY: Record<string, string> = {
  ROOM_1: 'Buồng 1',
  ROOM_2: 'Buồng 2',
  ROOM_3: 'Buồng 3',
  ROOM_4: 'Buồng 4',
};

export const roomCodeToDisplay = (code?: string): string => {
  if (!code) return 'Buồng 1';
  return ROOM_DISPLAY[code] || code;
};

export const displayToRoomCode = (display?: string): string => {
  if (!display) return 'ROOM_1';
  for (const [k, v] of Object.entries(ROOM_DISPLAY)) {
    if (v === display || k === display) return k;
  }
  return 'ROOM_1';
};

export const formatShiftSlotDto = (shift: any, currentAccountId?: string) => {
  const [year, month, day] = shift.workDate.split('-');
  const dateStr = `${day}/${month}`;
  const shiftType = PERIOD_TO_TYPE[shift.period] || 'morning';
  const shiftTimeLabel = PERIOD_LABELS[shift.period] || '08:00 - 12:00';
  const dayName = WEEKDAY_NAMES[shift.weekday] || 'Thứ 2';
  const room = roomCodeToDisplay(shift.roomCode);

  const assignedCTVs = (shift.assignments || []).map((as: any) => {
    const avatarFile = as.account?.files?.find((f: any) => f.category === 'AVATAR')?.file;
    const name = as.account?.displayName || 'CTV';
    const initials = name
      .split(' ')
      .filter(Boolean)
      .slice(-2)
      .map((part: string) => part[0])
      .join('')
      .toUpperCase() || name.slice(0, 2).toUpperCase();

    return {
      id: as.account?.id || as.accountId,
      assignmentId: as.id,
      name,
      avatar: avatarFile ? `/api/v1/files/${avatarFile.id}/content` : undefined,
      initials,
      phone: as.account?.phone,
      cctvCode: as.account?.ctvCode,
      status: as.status === 'APPROVED' ? 'Đã duyệt' : 'Chờ duyệt',
      room,
      taskContent: as.taskContent || as.registration?.workContent || 'Theo sự phân công của phụ trách ca',
      roomDisplay: room,
      taskDisplay: as.taskContent || as.registration?.workContent || 'Theo sự phân công của phụ trách ca',
    };
  });

  // Check current account assignment status
  let status: 'Đã đăng ký' | 'Chưa đăng ký' | 'Chờ duyệt' | 'Nghỉ' = 'Chưa đăng ký';
  let userAssignment: any = null;

  if (currentAccountId) {
    userAssignment = (shift.assignments || []).find((as: any) => as.accountId === currentAccountId);
    if (userAssignment) {
      if (userAssignment.status === 'APPROVED') {
        status = 'Đã đăng ký';
      } else if (userAssignment.status === 'PENDING') {
        status = 'Chờ duyệt';
      } else if (userAssignment.status === 'CANCELLED') {
        status = 'Nghỉ';
      }
    }
  }

  return {
    id: userAssignment?.id || shift.id,
    shiftId: shift.id,
    dayIndex: shift.weekday,
    dayName,
    dateStr,
    shiftType,
    shiftTimeLabel,
    status,
    allowRegister: shift.allowRegistration && shift.status === 'OPEN',
    assignedCTVs,
    targetCapacity: shift.targetCapacity || 4,
    workDate: shift.workDate,
    room,
    workContent: userAssignment?.taskContent || userAssignment?.registration?.workContent,
    registrationId: userAssignment?.registrationId,
    registrationStartDate: userAssignment?.registration?.startDate,
    registrationEndDate: userAssignment?.registration?.endDate,
  };
};
