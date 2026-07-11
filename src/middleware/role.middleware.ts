import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.middleware';

export const roleMiddleware = (...allowedRoles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): Response | void => {
    if (!req.userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        errorDetails: 'User not authenticated'
      });
    }

    if (!allowedRoles.includes(req.userRole || '')) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
        errorDetails: `This action requires one of these roles: ${allowedRoles.join(', ')}`
      });
    }

    return next();
  };
};