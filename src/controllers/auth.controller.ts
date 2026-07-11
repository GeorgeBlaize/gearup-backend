import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../app';
import { AuthRequest } from '../middleware/auth.middleware';

export class AuthController {
  async register(req: Request, res: Response) {
    try {
      const { email, password, name, phone, address, role } = req.body;

      // Check if user exists
      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'User already exists with this email',
          errorDetails: 'Email already registered'
        });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create user
      const user = await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          name,
          phone,
          address,
          role: role || 'CUSTOMER'
        },
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
          address: true,
          role: true,
          isActive: true,
          createdAt: true
        }
      });

      // Generate JWT
      const token = jwt.sign(
        { userId: user.id, email: user.email, role: user.role },
        process.env.JWT_SECRET!,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' } as jwt.SignOptions
      );

      return res.status(201).json({
        success: true,
        message: 'User registered successfully',
        data: { user, token }
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: 'Registration failed',
        errorDetails: error.message
      });
    }
  }

  async login(req: Request, res: Response) {
    try {
      const { email, password } = req.body;

      // Find user
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials',
          errorDetails: 'User not found'
        });
      }

      // Check if user is active
      if (!user.isActive) {
        return res.status(403).json({
          success: false,
          message: 'Account is suspended',
          errorDetails: 'Please contact support'
        });
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials',
          errorDetails: 'Incorrect password'
        });
      }

      // Generate JWT
      const token = jwt.sign(
        { userId: user.id, email: user.email, role: user.role },
        process.env.JWT_SECRET!,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' } as jwt.SignOptions
      );

      // Remove password from response
      const { password: _, ...userWithoutPassword } = user;

      return res.json({
        success: true,
        message: 'Login successful',
        data: { user: userWithoutPassword, token }
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: 'Login failed',
        errorDetails: error.message
      });
    }
  }

  async getMe(req: AuthRequest, res: Response) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.userId },
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
          address: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true
        }
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
          errorDetails: 'User does not exist'
        });
      }

      return res.json({
        success: true,
        data: { user }
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch user',
        errorDetails: error.message
      });
    }
  }
}