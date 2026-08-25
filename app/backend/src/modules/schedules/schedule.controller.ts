import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import type { AuthLocals } from '../../middleware/auth.middleware.js';
import { ApiError } from '../../shared/api-error.js';
import {
  assignmentIdParamsSchema,
  cancelSeriesQuerySchema,
  myShiftsQuerySchema,
  scheduleSummaryQuerySchema,
  registrationIdParamsSchema,
  scheduleRegistrationSchema,
  shiftIdParamsSchema,
} from './schedule.schemas.js';
import { ScheduleService } from './schedule.service.js';

export class ScheduleController {
  constructor(private readonly service: ScheduleService) {}

  currentRegistration = async (_request: Request, response: Response, next: NextFunction) => {
    try { response.status(200).json({ data: await this.service.getCurrentRegistration(actor(response).id) }); }
    catch (error) { next(validationError(error)); }
  };

  saveRegistration = async (request: Request, response: Response, next: NextFunction) => {
    try {
      response.status(200).json({ data: await this.service.upsertRegistration(
        actor(response).id, scheduleRegistrationSchema.parse(request.body),
      ) });
    } catch (error) { next(validationError(error)); }
  };

  myShifts = async (request: Request, response: Response, next: NextFunction) => {
    try {
      response.status(200).json({ data: await this.service.listMyShifts(
        actor(response).id, myShiftsQuerySchema.parse(request.query),
      ) });
    } catch (error) { next(validationError(error)); }
  };

  monthlySummary = async (request: Request, response: Response, next: NextFunction) => {
    try { response.status(200).json({ data: await this.service.getMonthlySummary(scheduleSummaryQuerySchema.parse(request.query)) }); }
    catch (error) { next(validationError(error)); }
  };

  shiftDetail = async (request: Request, response: Response, next: NextFunction) => {
    try {
      const { shiftId } = shiftIdParamsSchema.parse(request.params);
      const account = actor(response);
      response.status(200).json({ data: await this.service.getShift(
        { id: account.id, role: account.role }, shiftId,
      ) });
    } catch (error) { next(validationError(error)); }
  };

  cancelOne = async (request: Request, response: Response, next: NextFunction) => {
    try {
      const { assignmentId } = assignmentIdParamsSchema.parse(request.params);
      response.status(200).json({ data: await this.service.cancelOne(actor(response).id, assignmentId) });
    } catch (error) { next(validationError(error)); }
  };

  cancelSeries = async (request: Request, response: Response, next: NextFunction) => {
    try {
      const { registrationId } = registrationIdParamsSchema.parse(request.params);
      response.status(200).json({ data: await this.service.cancelSeries(
        actor(response).id, registrationId, cancelSeriesQuerySchema.parse(request.query),
      ) });
    } catch (error) { next(validationError(error)); }
  };
}

function actor(response: Response) {
  const account = (response.locals as AuthLocals).auth?.account;
  if (!account) throw new ApiError(401, 'AUTHENTICATION_REQUIRED', 'A valid session is required.');
  return account;
}

function validationError(error: unknown): unknown {
  if (!(error instanceof ZodError)) return error;
  return new ApiError(422, 'VALIDATION_FAILED', 'Request validation failed.', error.flatten());
}
