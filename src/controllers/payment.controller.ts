import { Request, Response } from 'express';
import { prisma } from '../app';
import { StripeService } from '../services/stripe.service';
import { AuthRequest } from '../middleware/auth.middleware';

const stripeService = new StripeService();

export class PaymentController {
  async createPayment(req: AuthRequest, res: Response) {
    try {
      const { rentalOrderId, provider = 'STRIPE' } = req.body;
      const customerId = req.userId;

      // Verify rental order belongs to customer
      const rentalOrder = await prisma.rentalOrder.findUnique({
        where: { id: rentalOrderId },
        include: { payment: true }
      });

      if (!rentalOrder) {
        return res.status(404).json({
          success: false,
          message: 'Rental order not found',
          errorDetails: 'Invalid rental order ID'
        });
      }

      if (rentalOrder.customerId !== customerId) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized',
          errorDetails: 'You can only pay for your own orders'
        });
      }

      if (rentalOrder.payment) {
        return res.status(400).json({
          success: false,
          message: 'Payment already exists for this order',
          errorDetails: 'Duplicate payment'
        });
      }

      if (provider !== 'STRIPE') {
        return res.status(400).json({
          success: false,
          message: 'Invalid payment provider',
          errorDetails: 'Supported providers: STRIPE'
        });
      }

      const paymentResult = await stripeService.createPaymentIntent(
        rentalOrderId,
        rentalOrder.totalAmount,
        'usd'
      );

      return res.json({
        success: true,
        message: 'Payment created successfully',
        data: paymentResult
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: 'Payment creation failed',
        errorDetails: error.message
      });
    }
  }

  async confirmPayment(req: Request, res: Response) {
    try {
      const { paymentIntentId } = req.body;

      const result = await stripeService.confirmPayment(paymentIntentId);

      return res.json({
        success: true,
        message: 'Payment confirmed successfully',
        data: result
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: 'Payment confirmation failed',
        errorDetails: error.message
      });
    }
  }

  async getPaymentHistory(req: AuthRequest, res: Response) {
    try {
      const payments = await prisma.payment.findMany({
        where: {
          rentalOrder: {
            customerId: req.userId
          }
        },
        include: {
          rentalOrder: {
            include: {
              rentalItems: {
                include: {
                  gearItem: {
                    select: {
                      name: true,
                      id: true
                    }
                  }
                }
              }
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      return res.json({
        success: true,
        data: { payments }
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch payment history',
        errorDetails: error.message
      });
    }
  }

  async getPaymentDetails(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const payment = await prisma.payment.findUnique({
        where: { id },
        include: {
          rentalOrder: {
            include: {
              customer: {
                select: {
                  name: true,
                  email: true
                }
              },
              rentalItems: {
                include: {
                  gearItem: true
                }
              }
            }
          }
        }
      });

      if (!payment) {
        return res.status(404).json({
          success: false,
          message: 'Payment not found',
          errorDetails: 'Invalid payment ID'
        });
      }

      return res.json({
        success: true,
        data: { payment }
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch payment details',
        errorDetails: error.message
      });
    }
  }

  async webhook(req: Request, res: Response) {
    try {
      const signature = req.headers['stripe-signature'] as string;
      await stripeService.handleWebhook(signature, req.body);
      return res.json({ received: true });
    } catch (error: any) {
      return res.status(400).json({
        success: false,
        message: 'Webhook processing failed',
        errorDetails: error.message
      });
    }
  }
}