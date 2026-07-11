import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

import authRoutes from './routes/auth.routes';
import gearRoutes from './routes/gear.routes';
import rentalRoutes from './routes/rental.routes';
import paymentRoutes from './routes/payment.routes';
import providerRoutes from './routes/provider.routes';
import reviewRoutes from './routes/review.routes';
import adminRoutes from './routes/admin.routes';
import { GearController } from './controllers/gear.controller';
import { PaymentController } from './controllers/payment.controller';
import { errorHandler, notFoundHandler } from './utils/errorHandler';

// Load environment variables
dotenv.config();

// Initialize Express
const app = express();
const prisma = new PrismaClient();

const gearController = new GearController();
const paymentController = new PaymentController();

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? ['https://your-frontend-domain.com']
    : '*',
  credentials: true
}));
app.use(morgan('combined'));

// Stripe webhooks must receive the raw body for signature verification,
// so this route is mounted before the global JSON parser.
app.post('/api/payments/webhook', express.raw({ type: 'application/json' }), (req, res) =>
  paymentController.webhook(req, res)
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/gear', gearRoutes);
app.get('/api/categories', (req, res) => gearController.getCategories(req, res));
app.use('/api/rentals', rentalRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/provider', providerRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/admin', adminRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV
  });
});

// Root route
app.get('/', (_req, res) => {
  res.json({
    name: 'GearUp API',
    version: '1.0.0',
    status: 'running',
    documentation: '/api/health'
  });
});

// 404 handler
app.use(notFoundHandler);

// Error handling middleware
app.use(errorHandler);

export { app, prisma };
