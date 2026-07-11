import { body, param } from 'express-validator';

export const paymentValidators = {
  create: [
    body('rentalOrderId')
      .notEmpty()
      .withMessage('Rental order ID is required')
      .isString()
      .withMessage('Invalid rental order ID format'),

    body('provider')
      .optional()
      .isIn(['STRIPE'])
      .withMessage('Supported providers: STRIPE')
  ],

  confirm: [
    body('paymentIntentId')
      .notEmpty()
      .withMessage('Payment intent ID is required')
      .isString()
      .withMessage('Invalid payment intent ID format')
  ],

  getById: [
    param('id')
      .isString()
      .withMessage('Invalid payment ID format')
  ]
};
