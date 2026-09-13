import { describe, it, expect } from 'vitest';
import {
  accountDtoToDomain,
  accountDtosToDomain,
} from '../src/features/accounts/mappers/account.mapper';
import {
  registrationRequestDtoToDomain,
  registrationRequestDtosToDomain,
} from '../src/features/registration/mappers/registration-request.mapper';
import {
  weeklyScheduleDtoToSlots,
  summaryCellsToSlots,
} from '../src/features/schedule/mappers/schedule.mapper';
import type { AccountDto } from '../src/features/accounts/types/account.dto';
import type { RegistrationRequestDto } from '../src/features/registration/types/registration-request.dto';
import type {
  ApiScheduleData,
  ApiWeeklySummaryCell,
} from '../src/features/schedule/types/schedule.dto';
import type { UserAccount } from '../src/shared/types';

describe('Frontend DTO Mappers', () => {
  describe('account.mapper', () => {
    it('maps AccountDto to domain UserAccount accurately', () => {
      const dto: AccountDto = {
        id: 'acc-1',
        email: 'ctv@test.local',
        displayName: 'Nguyen Van A',
        phone: '0912345678',
        ctvCode: 'CTV-2026-001',
        role: 'CTV',
        status: 'ACTIVE',
        version: 1,
        gender: 'Nam',
        dateOfBirth: '2000-01-15T00:00:00.000Z',
        address: 'Ha Noi',
        createdAt: '2026-01-01T00:00:00.000Z',
        files: [
          {
            category: 'AVATAR',
            fileId: 'file-avatar-1',
            file: {
              id: 'file-avatar-1',
              originalName: 'avatar.jpg',
              mimeType: 'image/jpeg',
              sizeBytes: 1024,
            },
          },
        ],
      };

      const domain = accountDtoToDomain(dto, 0);
      expect(domain.id).toBe('acc-1');
      expect(domain.stt).toBe(1);
      expect(domain.name).toBe('Nguyen Van A');
      expect(domain.role).toBe('Cộng tác viên');
      expect(domain.status).toBe('Kích hoạt');
      expect(domain.avatar).toBe('/api/v1/files/file-avatar-1/content');
      expect(domain.cctvCode).toBe('CTV-2026-001');
    });

    it('maps multiple AccountDto rows with sequential stt', () => {
      const dtos: AccountDto[] = [
        {
          id: '1',
          email: 'a@test.local',
          displayName: 'A',
          role: 'CTV',
          status: 'ACTIVE',
          version: 1,
        },
        {
          id: '2',
          email: 'b@test.local',
          displayName: 'B',
          role: 'ADMIN',
          status: 'DISABLED',
          version: 1,
        },
      ];
      const result = accountDtosToDomain(dtos);
      expect(result).toHaveLength(2);
      expect(result[0].stt).toBe(1);
      expect(result[1].stt).toBe(2);
      expect(result[1].role).toBe('Admin');
      expect(result[1].status).toBe('Vô hiệu hóa');
    });
  });

  describe('registration-request.mapper', () => {
    it('maps RegistrationRequestDto to domain RegistrationRequest', () => {
      const dto: RegistrationRequestDto = {
        id: 'req-1',
        email: 'applicant@test.local',
        displayName: 'Tran Thi B',
        phone: '0987654321',
        status: 'PENDING',
        submittedAt: '2026-02-01T10:00:00.000Z',
        files: [
          {
            category: 'CV',
            fileId: 'file-cv-1',
            originalName: 'resume.pdf',
            mimeType: 'application/pdf',
            sizeBytes: 2048,
          },
        ],
      };

      const domain = registrationRequestDtoToDomain(dto, 2);
      expect(domain.id).toBe('req-1');
      expect(domain.stt).toBe(3);
      expect(domain.name).toBe('Tran Thi B');
      expect(domain.status).toBe('Chờ duyệt');
      expect(domain.cvFile).toBe('/api/v1/files/file-cv-1/content');
      expect(domain.cvFileName).toBe('resume.pdf');
    });

    it('maps multiple registration requests with sequential index', () => {
      const dtos: RegistrationRequestDto[] = [
        { id: '1', email: 'a@x.com', displayName: 'A', status: 'APPROVED' },
        { id: '2', email: 'b@x.com', displayName: 'B', status: 'REJECTED' },
      ];
      const result = registrationRequestDtosToDomain(dtos);
      expect(result).toHaveLength(2);
      expect(result[0].status).toBe('Đã duyệt');
      expect(result[1].status).toBe('Từ chối');
    });
  });

  describe('schedule.mapper', () => {
    it('maps weekly schedule registration to slots for current user', () => {
      const scheduleData: ApiScheduleData = {
        roomCode: 'ROOM_1',
        shifts: [
          { weekday: 1, period: 'MORNING' },
          { weekday: 2, period: 'AFTERNOON' },
        ],
      };
      const user: UserAccount = {
        id: 'u1',
        stt: 1,
        name: 'User 1',
        email: 'u1@test.com',
        phone: '',
        role: 'Cộng tác viên',
        status: 'Kích hoạt',
        registerDate: '',
      };

      const slots = weeklyScheduleDtoToSlots(scheduleData, user);
      expect(slots.length).toBeGreaterThan(0);
      const registered = slots.filter((s) => s.assignedCTVs && s.assignedCTVs.length > 0);
      expect(registered.length).toBe(2);
    });

    it('maps weekly summary cells to summary slots', () => {
      const cells: ApiWeeklySummaryCell[] = [
        {
          weekday: 1,
          period: 'MORNING',
          count: 2,
          shiftAssignments: [
            { id: 'as1', accountId: 'acc1', displayName: 'CTV 1', status: 'ASSIGNED' },
            { id: 'as2', accountId: 'acc2', displayName: 'CTV 2', status: 'ASSIGNED' },
          ],
        },
      ];

      const slots = summaryCellsToSlots(cells);
      expect(slots.length).toBeGreaterThan(0);
      const mondayMorning = slots.find((s) => s.dayIndex === 0 && s.shiftType === 'morning');
      expect(mondayMorning).toBeDefined();
      expect(mondayMorning?.assignedCTVs).toHaveLength(2);
    });
  });
});
