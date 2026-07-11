import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../app';

export interface AuthRequest extends Request {
  userId?: string;
  userRole?: string;
}

export const authMiddleware = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        errorDetails: 'No token provided'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
      userId: string;
      email: string;
      role: string;
    };

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, role: true, isActive: true }
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication failed',
        errorDetails: 'User not found'
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Account is suspended',
        errorDetails: 'Contact support for assistance'
      });
    }

    req.userId = user.id;
    req.userRole = user.role;
    return next();
  } catch (error: any) {
    return res.status(401).json({
      success: false,
      message: 'Authentication failed',
      errorDetails: error.message
    });
  }
};