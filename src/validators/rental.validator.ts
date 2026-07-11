import { body, param, query } from 'express-validator';

export const rentalValidators = {
  create: [
    body('gearItems')
      .isArray({ min: 1 })
      .withMessage('At least one gear item is required')
      .custom((value) => {
        // Check for duplicate gear items
        const ids = value.map((item: any) => item.gearItemId);
        if (new Set(ids).size !== ids.length) {
          throw new Error('Duplicate gear items are not allowed');
        }
        return true;
      }),
    
    body('gearItems.*.gearItemId')
      .notEmpty()
      .withMessage('Gear item ID is required')
      .isString()
      .withMessage('Invalid gear item ID format'),
    
    body('gearItems.*.quantity')
      .isInt({ min: 1 })
      .withMessage('Quantity must be at least 1')
      .isInt({ max: 10 })
      .withMessage('Maximum 10 units per gear item allowed'),
    
    body('startDate')
      .notEmpty()
      .withMessage('Start date is required')
      .isISO8601()
      .withMessage('Invalid start date format')
      .custom((value) => {
        const date = new Date(value);
        const now = new Date();
        if (date < now) {
          throw new Error('Start date cannot be in the past');
        }
        return true;
      }),
    
    body('endDate')
      .notEmpty()
      .withMessage('End date is required')
      .isISO8601()
      .withMessage('Invalid end date format')
      .custom((value, { req }) => {
        const start = new Date(req.body.startDate);
        const end = new Date(value);
        if (end <= start) {
          throw new Error('End date must be after start date');
        }
        const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
        if (days > 30) {
          throw new Error('Maximum rental period is 30 days');
        }
        return true;
      })
  ],

  updateStatus: [
    param('id')
      .isString()
      .withMessage('Invalid rental ID format'),
    
    body('status')
      .notEmpty()
      .withMessage('Status is required')
      .isIn(['CONFIRMED', 'PICKED_UP', 'RETURNED', 'CANCELLED'])
      .withMessage('Status must be CONFIRMED, PICKED_UP, RETURNED, or CANCELLED'),
    
    body('note')
      .optional()
      .isString()
      .isLength({ max: 500 })
      .withMessage('Note must not exceed 500 characters')
  ],

  cancel: [
    param('id')
      .isString()
      .withMessage('Invalid rental ID format'),
    
    body('reason')
      .optional()
      .isString()
      .isLength({ max: 200 })
      .withMessage('Reason must not exceed 200 characters')
  ],

  getById: [
    param('id')
      .isString()
      .withMessage('Invalid rental ID format')
  ],

  checkAvailability: [
    query('gearId')
      .notEmpty()
      .withMessage('Gear ID is required')
      .isString()
      .withMessage('Invalid gear ID format'),

    query('startDate')
      .notEmpty()
      .withMessage('Start date is required')
      .isISO8601()
      .withMessage('Invalid start date format'),

    query('endDate')
      .notEmpty()
      .withMessage('End date is required')
      .isISO8601()
      .withMessage('Invalid end date format')
      .custom((value, { req }) => {
        const start = new Date(req.query!.startDate as string);
        const end = new Date(value);
        if (end <= start) {
          throw new Error('End date must be after start date');
        }
        return true;
      })
  ],

  getMyRentals: [
    body('status')
      .optional()
      .isIn(['PLACED', 'CONFIRMED', 'PAID', 'PICKED_UP', 'RETURNED', 'CANCELLED'])
      .withMessage('Invalid status'),
    
    body('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
    
    body('limit')
      .optional()
      .isInt({ min: 1, max: 50 })
      .withMessage('Limit must be between 1 and 50')
  ],

  providerOrders: [
    body('status')
      .optional()
      .isIn(['PLACED', 'CONFIRMED', 'PAID', 'PICKED_UP', 'RETURNED', 'CANCELLED'])
      .withMessage('Invalid status'),
    
    body('fromDate')
      .optional()
      .isISO8601()
      .withMessage('Invalid from date format'),
    
    body('toDate')
      .optional()
      .isISO8601()
      .withMessage('Invalid to date format')
      .custom((value, { req }) => {
        if (req.body.fromDate && new Date(value) <= new Date(req.body.fromDate)) {
          throw new Error('To date must be after from date');
        }
        return true;
      })
  ],

  review: [
    param('id')
      .isString()
      .withMessage('Invalid rental ID format'),
    
    body('rating')
      .notEmpty()
      .withMessage('Rating is required')
      .isInt({ min: 1, max: 5 })
      .withMessage('Rating must be between 1 and 5'),
    
    body('comment')
      .optional()
      .isString()
      .isLength({ min: 3, max: 500 })
      .withMessage('Comment must be between 3 and 500 characters')
  ]
};