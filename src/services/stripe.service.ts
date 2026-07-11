import Stripe from 'stripe';
import { prisma } from '../app';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16'
});

export class StripeService {
  async createPaymentIntent(rentalOrderId: string, amount: number, currency: string = 'usd') {
    try {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Convert to cents
        currency,
        metadata: {
          rentalOrderId,
        }
      });

      // Create payment record
      const payment = await prisma.payment.create({
        data: {
          transactionId: paymentIntent.id,
          rentalOrderId,
          amount,
          currency,
          provider: 'STRIPE',
          status: 'PENDING',
          paymentIntentId: paymentIntent.id
        }
      });

      return {
        clientSecret: paymentIntent.client_secret,
        paymentId: payment.id,
        transactionId: paymentIntent.id
      };
    } catch (error: any) {
      throw new Error(`Stripe payment creation failed: ${error.message}`);
    }
  }

  async confirmPayment(paymentIntentId: string) {
    try {
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
      
      const succeeded = paymentIntent.status === 'succeeded';
      const payment = await prisma.payment.update({
        where: { transactionId: paymentIntentId },
        data: {
          status: succeeded ? 'COMPLETED' : 'FAILED',
          paidAt: succeeded ? new Date() : null,
          failureReason: succeeded ? null : (paymentIntent.last_payment_error?.message || `Payment status: ${paymentIntent.status}`)
        }
      });

      // Update rental order status if payment succeeded
      if (payment.status === 'COMPLETED') {
        await prisma.rentalOrder.update({
          where: { id: payment.rentalOrderId },
          data: { status: 'PAID' }
        });
      }

      return payment;
    } catch (error: any) {
      throw new Error(`Payment confirmation failed: ${error.message}`);
    }
  }

  async handleWebhook(signature: string, payload: Buffer) {
    try {
      const event = stripe.webhooks.constructEvent(
        payload,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET!
      );

      switch (event.type) {
        case 'payment_intent.succeeded':
          await this.confirmPayment(event.data.object.id);
          break;
        case 'payment_intent.payment_failed':
          await this.confirmPayment(event.data.object.id);
          break;
        default:
          console.log(`Unhandled event type: ${event.type}`);
      }

      return { received: true };
    } catch (error: any) {
      throw new Error(`Webhook handling failed: ${error.message}`);
    }
  }
}