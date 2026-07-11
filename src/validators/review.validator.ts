import { body, param } from 'express-validator';

export const reviewValidators = {
  create: [
    body('gearItemId')
      .notEmpty()
      .withMessage('Gear item ID is required')
      .isString()
      .withMessage('Invalid gear item ID format'),

    body('rating')
      .notEmpty()
      .withMessage('Rating is required')
      .isInt({ min: 1, max: 5 })
      .withMessage('Rating must be between 1 and 5'),

    body('comment')
      .optional()
      .isString()
      .isLength({ max: 500 })
      .withMessage('Comment must not exceed 500 characters')
  ],

  update: [
    param('id')
      .isString()
      .withMessage('Invalid review ID format'),

    body('rating')
      .optional()
      .isInt({ min: 1, max: 5 })
      .withMessage('Rating must be between 1 and 5'),

    body('comment')
      .optional()
      .isString()
      .isLength({ max: 500 })
      .withMessage('Comment must not exceed 500 characters')
  ],

  delete: [
    param('id')
      .isString()
      .withMessage('Invalid review ID format')
  ],

  getByGear: [
    param('gearId')
      .isString()
      .withMessage('Invalid gear ID format')
  ]
};
