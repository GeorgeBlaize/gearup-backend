import { body, param } from 'express-validator';

export const gearValidators = {
  create: [
    body('name')
      .notEmpty()
      .withMessage('Gear name is required')
      .isLength({ min: 3, max: 100 })
      .withMessage('Name must be between 3 and 100 characters'),
    
    body('description')
      .notEmpty()
      .withMessage('Description is required')
      .isLength({ min: 10, max: 1000 })
      .withMessage('Description must be between 10 and 1000 characters'),
    
    body('pricePerDay')
      .isFloat({ min: 0.01 })
      .withMessage('Price per day must be a positive number'),
    
    body('categoryId')
      .notEmpty()
      .withMessage('Category ID is required')
      .isString()
      .withMessage('Invalid category ID format'),
    
    body('brand')
      .optional()
      .isString()
      .isLength({ max: 50 })
      .withMessage('Brand must not exceed 50 characters'),
    
    body('condition')
      .notEmpty()
      .withMessage('Condition is required')
      .isIn(['Excellent', 'Good', 'Fair', 'Poor'])
      .withMessage('Condition must be Excellent, Good, Fair, or Poor'),
    
    body('quantity')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Quantity must be at least 1')
      .isInt({ max: 100 })
      .withMessage('Quantity cannot exceed 100'),
    
    body('images')
      .optional()
      .isArray()
      .withMessage('Images must be an array')
      .custom((value) => {
        if (value && value.length > 10) {
          throw new Error('Maximum 10 images allowed');
        }
        return true;
      }),
    
    body('images.*')
      .optional()
      .isURL()
      .withMessage('Each image must be a valid URL')
  ],

  update: [
    param('id')
      .isString()
      .withMessage('Invalid gear ID format'),
    
    body('name')
      .optional()
      .isLength({ min: 3, max: 100 })
      .withMessage('Name must be between 3 and 100 characters'),
    
    body('description')
      .optional()
      .isLength({ min: 10, max: 1000 })
      .withMessage('Description must be between 10 and 1000 characters'),
    
    body('pricePerDay')
      .optional()
      .isFloat({ min: 0.01 })
      .withMessage('Price per day must be a positive number'),
    
    body('categoryId')
      .optional()
      .isString()
      .withMessage('Invalid category ID format'),
    
    body('brand')
      .optional()
      .isString()
      .isLength({ max: 50 })
      .withMessage('Brand must not exceed 50 characters'),
    
    body('condition')
      .optional()
      .isIn(['Excellent', 'Good', 'Fair', 'Poor'])
      .withMessage('Condition must be Excellent, Good, Fair, or Poor'),
    
    body('quantity')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Quantity must be at least 1')
      .isInt({ max: 100 })
      .withMessage('Quantity cannot exceed 100'),
    
    body('availability')
      .optional()
      .isBoolean()
      .withMessage('Availability must be a boolean'),
    
    body('images')
      .optional()
      .isArray()
      .withMessage('Images must be an array'),
    
    body('images.*')
      .optional()
      .isURL()
      .withMessage('Each image must be a valid URL')
  ],

  getById: [
    param('id')
      .isString()
      .withMessage('Invalid gear ID format')
  ],

  delete: [
    param('id')
      .isString()
      .withMessage('Invalid gear ID format')
  ],

  search: [
    body('categoryId')
      .optional()
      .isString()
      .withMessage('Invalid category ID format'),
    
    body('minPrice')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Minimum price must be a positive number'),
    
    body('maxPrice')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Maximum price must be a positive number')
      .custom((value, { req }) => {
        if (req.body.minPrice && value <= req.body.minPrice) {
          throw new Error('Maximum price must be greater than minimum price');
        }
        return true;
      }),
    
    body('brand')
      .optional()
      .isString()
      .isLength({ max: 50 })
      .withMessage('Brand must not exceed 50 characters'),
    
    body('availability')
      .optional()
      .isBoolean()
      .withMessage('Availability must be a boolean')
  ]
};