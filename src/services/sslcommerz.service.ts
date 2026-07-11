import axios from 'axios';
import { prisma } from '../app';

interface SSLCommerzInitData {
  total_amount: number;
  currency: string;
  tran_id: string;
  success_url: string;
  fail_url: string;
  cancel_url: string;
  ipn_url?: string;
  shipping_method: string;
  product_name: string;
  product_category: string;
  product_profile: string;
  cus_name: string;
  cus_email: string;
  cus_phone: string;
  cus_add1: string;
  cus_city: string;
  cus_country: string;
  multi_card_name?: string;
  value_a?: string;
  value_b?: string;
  value_c?: string;
  value_d?: string;
}

export class SSLCommerzService {
  private storeId: string;
  private storePassword: string;
  private isSandbox: boolean;
  private baseUrl: string;

  constructor() {
    this.storeId = process.env.SSL_STORE_ID!;
    this.storePassword = process.env.SSL_STORE_PASSWORD!;
    this.isSandbox = process.env.SSL_SANDBOX_MODE === 'true';
    this.baseUrl = this.isSandbox
      ? 'https://sandbox.sslcommerz.com'
      : 'https://secure.sslcommerz.com';
  }

  async createSession(rentalOrderId: string, amount: number, customerDetails: any) {
    try {
      const tranId = `GR-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

      const data: SSLCommerzInitData = {
        total_amount: amount,
        currency: 'BDT',
        tran_id: tranId,
        success_url: `${process.env.API_URL}/api/payments/ssl/success`,
        fail_url: `${process.env.API_URL}/api/payments/ssl/fail`,
        cancel_url: `${process.env.API_URL}/api/payments/ssl/cancel`,
        ipn_url: `${process.env.API_URL}/api/payments/ssl/ipn`,
        shipping_method: 'No',
        product_name: 'Gear Rental',
        product_category: 'Rental',
        product_profile: 'general',
        cus_name: customerDetails.name || 'Customer',
        cus_email: customerDetails.email || 'customer@email.com',
        cus_phone: customerDetails.phone || '01700000000',
        cus_add1: customerDetails.address || 'Dhaka',
        cus_city: 'Dhaka',
        cus_country: 'Bangladesh',
        value_a: rentalOrderId,
        value_b: 'gearup',
      };

      const formData: Record<string, string> = {
        store_id: this.storeId,
        store_passwd: this.storePassword,
      };
      for (const [key, value] of Object.entries(data)) {
        if (value !== undefined) {
          formData[key] = String(value);
        }
      }

      const response = await axios.post(
        `${this.baseUrl}/gwprocess/v4/api.php`,
        new URLSearchParams(formData),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      if (response.data.status === 'SUCCESS') {
        // Create payment record
        const payment = await prisma.payment.create({
          data: {
            transactionId: tranId,
            rentalOrderId,
            amount,
            currency: 'BDT',
            provider: 'SSLCOMMERZ',
            status: 'PENDING',
            sessionId: response.data.sessionkey
          }
        });

        return {
          paymentId: payment.id,
          transactionId: tranId,
          redirectUrl: response.data.GatewayPageURL,
          sessionKey: response.data.sessionkey,
        };
      } else {
        throw new Error(`SSLCommerz initialization failed: ${response.data.failedreason || 'Unknown error'}`);
      }
    } catch (error: any) {
      throw new Error(`SSLCommerz session creation failed: ${error.message}`);
    }
  }

  async validatePayment(tranId: string) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/validator/api/validationserverAPI.php`,
        {
          params: {
            store_id: this.storeId,
            store_passwd: this.storePassword,
            tran_id: tranId,
            format: 'json',
          },
        }
      );

      if (response.data.status === 'VALID' || response.data.status === 'VALIDATED') {
        // Update payment status
        const payment = await prisma.payment.update({
          where: { transactionId: tranId },
          data: {
            status: 'COMPLETED',
            paidAt: new Date(),
          }
        });

        // Update rental order status
        await prisma.rentalOrder.update({
          where: { id: payment.rentalOrderId },
          data: { status: 'PAID' }
        });

        return payment;
      } else {
        // Payment failed
        const payment = await prisma.payment.update({
          where: { transactionId: tranId },
          data: {
            status: 'FAILED',
            failureReason: response.data.error || 'Payment validation failed',
          }
        });

        return payment;
      }
    } catch (error: any) {
      throw new Error(`SSLCommerz validation failed: ${error.message}`);
    }
  }

  async handleIPN(ipnData: any) {
    try {
      const { tran_id, status } = ipnData;

      if (status === 'VALID' || status === 'VALIDATED') {
        const payment = await prisma.payment.update({
          where: { transactionId: tran_id },
          data: {
            status: 'COMPLETED',
            paidAt: new Date(),
          }
        });

        await prisma.rentalOrder.update({
          where: { id: payment.rentalOrderId },
          data: { status: 'PAID' }
        });

        return payment;
      } else if (status === 'FAILED') {
        const payment = await prisma.payment.update({
          where: { transactionId: tran_id },
          data: {
            status: 'FAILED',
            failureReason: ipnData.error || 'Payment failed',
          }
        });

        return payment;
      }

      return null;
    } catch (error: any) {
      throw new Error(`SSLCommerz IPN handling failed: ${error.message}`);
    }
  }

  async getPaymentStatus(tranId: string) {
    try {
      const payment = await prisma.payment.findUnique({
        where: { transactionId: tranId },
        include: {
          rentalOrder: {
            select: {
              orderNumber: true,
              status: true,
              customer: {
                select: {
                  name: true,
                  email: true
                }
              }
            }
          }
        }
      });

      if (!payment) {
        throw new Error('Payment not found');
      }

      return payment;
    } catch (error: any) {
      throw new Error(`Failed to get payment status: ${error.message}`);
    }
  }
}