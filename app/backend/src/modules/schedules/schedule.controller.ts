import { Request, Response, NextFunction } from 'express';
import * as service from './schedule.service.js';
import { saveScheduleRegistrationSchema, cancelShiftSchema } from './schedule.schemas.js';

export const getMyRegistration = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const reg = await service.getUserScheduleRegistration(req.user.id);
    return res.status(200).json({ data: reg });
  } catch (error) {
    next(error);
  }
};

export const saveMyRegistration = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = saveScheduleRegistrationSchema.parse(req.body);
    const result = await service.saveUserScheduleRegistration(
      req.user.id,
      validated,
      req.requestId,
    );
    return res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
};

export const getMyShifts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;
    const month = req.query.month as string | undefined;

    const list = await service.getUserShifts(req.user.id, { startDate, endDate, month });
    return res.status(200).json({ data: list });
  } catch (error) {
    next(error);
  }
};

export const cancelMyShift = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const queryValidated = cancelShiftSchema.parse(req.query);
    const result = await service.cancelShift(
      req.params.id,
      req.user.id,
      queryValidated.scope,
      queryValidated.fromDate,
      queryValidated.reason,
      req.requestId,
    );
    return res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
};

export const getScheduleSummary = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const month = req.query.month as string | undefined;
    const summary = await service.getScheduleSummary(month);
    return res.status(200).json({ data: summary });
  } catch (error) {
    next(error);
  }
};

export const getShiftDetail = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const shift = await service.getShiftDetail(req.params.id);
    return res.status(200).json({ data: shift });
  } catch (error) {
    next(error);
  }
};
