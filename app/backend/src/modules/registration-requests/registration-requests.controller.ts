import { Request, Response, NextFunction } from 'express';
import * as service from './registration-requests.service.js';
import { createRegistrationRequestSchema, reviewRequestSchema } from './registration-requests.schemas.js';

export const createRequest = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = createRegistrationRequestSchema.parse(req.body);
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;

    const cccdFront = files?.['cccdFront']?.[0];
    const cccdBack = files?.['cccdBack']?.[0];
    const cvFile = files?.['cvFile']?.[0];

    const result = await service.submitRegistration(
      {
        ...validated,
        files: {
          cccdFront,
          cccdBack,
          cvFile,
          cccdFrontBase64: req.body.cccdFrontBase64 || (typeof req.body.cccdFront === 'string' && req.body.cccdFront.startsWith('data:') ? req.body.cccdFront : undefined),
          cccdBackBase64: req.body.cccdBackBase64 || (typeof req.body.cccdBack === 'string' && req.body.cccdBack.startsWith('data:') ? req.body.cccdBack : undefined),
          cvFileBase64: req.body.cvFileBase64 || (typeof req.body.cvFile === 'string' && req.body.cvFile.startsWith('data:') ? req.body.cvFile : undefined),
          cvFileName: req.body.cvFileName,
        },
      },
      req.requestId,
    );

    return res.status(201).json({
      data: {
        id: result.id,
        message: 'Gửi hồ sơ đăng ký thành công. Vui lòng chờ quản trị viên phê duyệt.',
      },
    });
  } catch (error) {
    next(error);
  }
};

export const listRequests = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const status = req.query.status as string | undefined;
    const list = await service.listRegistrationRequests(status);
    return res.status(200).json({ data: list });
  } catch (error) {
    next(error);
  }
};

export const getRequestDetail = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const request = await service.getRegistrationRequestById(req.params.id);
    return res.status(200).json({ data: request });
  } catch (error) {
    next(error);
  }
};

export const reviewRequest = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = reviewRequestSchema.parse(req.body);
    if (validated.action === 'APPROVE') {
      const account = await service.approveRegistrationRequest(
        req.params.id,
        req.user.id,
        req.requestId,
      );
      return res.status(200).json({
        data: {
          message: 'Phê duyệt hồ sơ thành công',
          accountId: account.id,
        },
      });
    } else {
      await service.rejectRegistrationRequest(
        req.params.id,
        validated.rejectionReason || '',
        req.user.id,
        req.requestId,
      );
      return res.status(200).json({
        data: {
          message: 'Đã từ chối hồ sơ đăng ký',
        },
      });
    }
  } catch (error) {
    next(error);
  }
};
