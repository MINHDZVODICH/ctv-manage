export const CANONICAL_WORK_DATE_PREV = '2026-09-01';
export const CANONICAL_WORK_DATE_TODAY = '2026-09-02';

export const canonicalCtvHistoryPayload = {
  data: {
    month: '2026-09',
    entries: [
      {
        id: 'hist-prev-morning',
        workDate: CANONICAL_WORK_DATE_PREV,
        period: 'MORNING',
        roomCode: 'ROOM_1',
        status: 'COMPLETED',
      },
      {
        id: 'hist-today-morning',
        workDate: CANONICAL_WORK_DATE_TODAY,
        period: 'MORNING',
        roomCode: 'ROOM_2',
        status: 'COMPLETED',
      },
      {
        id: 'hist-today-afternoon',
        workDate: CANONICAL_WORK_DATE_TODAY,
        period: 'AFTERNOON',
        roomCode: 'ROOM_3',
        status: 'COMPLETED',
      },
    ],
  },
};

export const canonicalSummaryHistoryPayload = {
  data: {
    month: '2026-09',
    cells: [
      {
        shiftId: 'cell-prev-morning',
        workDate: CANONICAL_WORK_DATE_PREV,
        period: 'MORNING',
        count: 1,
        shiftAssignments: [
          {
            id: 'assign-prev',
            accountId: 'ctv-active-id',
            displayName: 'CTV Active',
            phone: '0900000001',
            roomCode: 'ROOM_1',
            status: 'COMPLETED',
          },
        ],
      },
      {
        shiftId: 'cell-today-morning',
        workDate: CANONICAL_WORK_DATE_TODAY,
        period: 'MORNING',
        count: 1,
        shiftAssignments: [
          {
            id: 'assign-today-m',
            accountId: 'ctv-active-id',
            displayName: 'CTV Active',
            phone: '0900000001',
            roomCode: 'ROOM_2',
            status: 'COMPLETED',
          },
        ],
      },
      {
        shiftId: 'cell-today-afternoon',
        workDate: CANONICAL_WORK_DATE_TODAY,
        period: 'AFTERNOON',
        count: 1,
        shiftAssignments: [
          {
            id: 'assign-today-a',
            accountId: 'ctv-active-id',
            displayName: 'CTV Active',
            phone: '0900000001',
            roomCode: 'ROOM_3',
            status: 'COMPLETED',
          },
        ],
      },
    ],
  },
};

export const canonicalEmptyHistoryPayload = {
  data: {
    month: '2026-09',
    entries: [],
    cells: [],
  },
};
