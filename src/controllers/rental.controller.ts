import { Request, Response } from 'express';
import { prisma } from '../app';
import { AuthRequest } from '../middleware/auth.middleware';

export class RentalController {
  // Create new rental order
  async createRental(req: AuthRequest, res: Response) {
    try {
      const { gearItems, startDate, endDate } = req.body;
      const customerId = req.userId;

      // Validate dates
      const start = new Date(startDate);
      const end = new Date(endDate);
      const now = new Date();

      if (start < now) {
        return res.status(400).json({
          success: false,
          message: 'Start date cannot be in the past',
          errorDetails: 'Invalid date'
        });
      }

      if (end <= start) {
        return res.status(400).json({
          success: false,
          message: 'End date must be after start date',
          errorDetails: 'Invalid date range'
        });
      }

      const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      if (days < 1) {
        return res.status(400).json({
          success: false,
          message: 'Minimum rental period is 1 day',
          errorDetails: 'Invalid duration'
        });
      }

      // Validate gear items and calculate total
      let totalAmount = 0;
      const rentalItems: any[] = [];
      const providerIds = new Set();

      for (const item of gearItems) {
        const gear = await prisma.gearItem.findUnique({
          where: { id: item.gearItemId },
          include: {
            provider: {
              select: {
                id: true
              }
            }
          }
        });

        if (!gear) {
          return res.status(404).json({
            success: false,
            message: `Gear item ${item.gearItemId} not found`,
            errorDetails: 'Invalid gear item'
          });
        }

        if (!gear.availability || gear.quantity < item.quantity) {
          return res.status(400).json({
            success: false,
            message: `${gear.name} is not available in requested quantity`,
            errorDetails: 'Insufficient quantity'
          });
        }

        // Check for date conflicts
        const conflictingRentals = await prisma.rentalItem.findMany({
          where: {
            gearItemId: gear.id,
            rentalOrder: {
              status: {
                in: ['PLACED', 'CONFIRMED', 'PAID', 'PICKED_UP']
              },
              AND: [
                { startDate: { lte: end } },
                { endDate: { gte: start } }
              ]
            }
          }
        });

        if (conflictingRentals.length > 0) {
          return res.status(400).json({
            success: false,
            message: `${gear.name} is already booked for the selected dates`,
            errorDetails: 'Date conflict'
          });
        }

        const itemTotal = gear.pricePerDay * item.quantity * days;
        totalAmount += itemTotal;

        rentalItems.push({
          gearItemId: gear.id,
          quantity: item.quantity,
          pricePerDayAtRental: gear.pricePerDay
        });

        providerIds.add(gear.providerId);
      }

      // Ensure all items are from the same provider (or handle multiple providers)
      if (providerIds.size > 1) {
        return res.status(400).json({
          success: false,
          message: 'All items must be from the same provider',
          errorDetails: 'Multiple providers selected'
        });
      }

      const providerId = Array.from(providerIds)[0] as string;

      // Generate order number
      const orderNumber = `GR-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

      // Create rental order
      const rentalOrder = await prisma.rentalOrder.create({
        data: {
          orderNumber,
          customerId: customerId!,
          providerId,
          startDate: start,
          endDate: end,
          totalAmount,
          status: 'PLACED',
          rentalItems: {
            create: rentalItems
          }
        },
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true
            }
          },
          provider: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true
            }
          },
          rentalItems: {
            include: {
              gearItem: {
                select: {
                  id: true,
                  name: true,
                  brand: true,
                  images: true,
                  pricePerDay: true
                }
              }
            }
          }
        }
      });

      return res.status(201).json({
        success: true,
        message: 'Rental order created successfully',
        data: {
          rental: rentalOrder,
          days,
          items: rentalItems.length
        }
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: 'Failed to create rental order',
        errorDetails: error.message
      });
    }
  }

  // Get user's rental orders
  async getMyRentals(req: AuthRequest, res: Response) {
    try {
      const { status, page = 1, limit = 10 } = req.query;
      
      const skip = (Number(page) - 1) * Number(limit);
      const take = Number(limit);

      const where: any = {
        customerId: req.userId
      };
      if (status) where.status = status;

      const [rentals, total] = await Promise.all([
        prisma.rentalOrder.findMany({
          where,
          include: {
            provider: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true
              }
            },
            payment: {
              select: {
                id: true,
                transactionId: true,
                amount: true,
                status: true,
                provider: true,
                paidAt: true
              }
            },
            rentalItems: {
              include: {
                gearItem: {
                  select: {
                    id: true,
                    name: true,
                    brand: true,
                    images: true
                  }
                }
              }
            },
            _count: {
              select: {
                rentalItems: true
              }
            }
          },
          skip,
          take,
          orderBy: { createdAt: 'desc' }
        }),
        prisma.rentalOrder.count({ where })
      ]);

      return res.json({
        success: true,
        data: {
          rentals,
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total,
            pages: Math.ceil(total / Number(limit))
          }
        }
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch rentals',
        errorDetails: error.message
      });
    }
  }

  // Get rental order details
  async getRentalDetails(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      const rental = await prisma.rentalOrder.findUnique({
        where: { id },
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              address: true
            }
          },
          provider: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              address: true
            }
          },
          payment: true,
          rentalItems: {
            include: {
              gearItem: {
                include: {
                  category: {
                    select: {
                      id: true,
                      name: true
                    }
                  },
                  reviews: {
                    where: {
                      customerId: req.userId
                    },
                    take: 1
                  }
                }
              }
            }
          }
        }
      });

      if (!rental) {
        return res.status(404).json({
          success: false,
          message: 'Rental order not found',
          errorDetails: 'Invalid rental ID'
        });
      }

      // Check authorization
      if (rental.customerId !== req.userId && 
          rental.providerId !== req.userId && 
          req.userRole !== 'ADMIN') {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized',
          errorDetails: 'You can only view your own rentals'
        });
      }

      // Calculate days remaining
      const now = new Date();
      const endDate = new Date(rental.endDate);
      const daysRemaining = Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

      return res.json({
        success: true,
        data: {
          ...rental,
          daysRemaining,
          canReview: rental.status === 'RETURNED' && 
                     !rental.rentalItems.some(item => item.gearItem.reviews.length > 0)
        }
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch rental details',
        errorDetails: error.message
      });
    }
  }

  // Cancel rental order (Customer only)
  async cancelRental(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      const rental = await prisma.rentalOrder.findUnique({
        where: { id },
        include: {
          payment: true
        }
      });

      if (!rental) {
        return res.status(404).json({
          success: false,
          message: 'Rental order not found',
          errorDetails: 'Invalid rental ID'
        });
      }

      if (rental.customerId !== req.userId) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized',
          errorDetails: 'You can only cancel your own rentals'
        });
      }

      if (!['PLACED', 'CONFIRMED'].includes(rental.status)) {
        return res.status(400).json({
          success: false,
          message: `Cannot cancel order with status ${rental.status}`,
          errorDetails: 'Invalid status transition'
        });
      }

      // Check if payment is already completed
      if (rental.payment?.status === 'COMPLETED') {
        return res.status(400).json({
          success: false,
          message: 'Cannot cancel order with completed payment',
          errorDetails: 'Contact support for refund'
        });
      }

      const cancelledRental = await prisma.rentalOrder.update({
        where: { id },
        data: { 
          status: 'CANCELLED'
        },
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          rentalItems: {
            include: {
              gearItem: {
                select: {
                  id: true,
                  name: true
                }
              }
            }
          }
        }
      });

      return res.json({
        success: true,
        message: 'Rental order cancelled successfully',
        data: { rental: cancelledRental }
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: 'Failed to cancel rental',
        errorDetails: error.message
      });
    }
  }

  // Check gear availability for date range
  async checkAvailability(req: Request, res: Response) {
    try {
      const { gearId, startDate, endDate } = req.query;

      if (!gearId || !startDate || !endDate) {
        return res.status(400).json({
          success: false,
          message: 'Missing required parameters',
          errorDetails: 'gearId, startDate, and endDate are required'
        });
      }

      const start = new Date(startDate as string);
      const end = new Date(endDate as string);

      if (end <= start) {
        return res.status(400).json({
          success: false,
          message: 'End date must be after start date',
          errorDetails: 'Invalid date range'
        });
      }

      const gear = await prisma.gearItem.findUnique({
        where: { id: gearId as string },
        include: {
          rentalItems: {
            where: {
              rentalOrder: {
                status: {
                  in: ['PLACED', 'CONFIRMED', 'PAID', 'PICKED_UP']
                },
                AND: [
                  { startDate: { lte: end } },
                  { endDate: { gte: start } }
                ]
              }
            }
          }
        }
      });

      if (!gear) {
        return res.status(404).json({
          success: false,
          message: 'Gear item not found',
          errorDetails: 'Invalid gear ID'
        });
      }

      const bookedQuantity = gear.rentalItems.reduce((sum, item) => sum + item.quantity, 0);
      const availableQuantity = gear.quantity - bookedQuantity;
      const isAvailable = gear.availability && availableQuantity > 0;

      return res.json({
        success: true,
        data: {
          gearId: gear.id,
          name: gear.name,
          totalQuantity: gear.quantity,
          bookedQuantity,
          availableQuantity,
          isAvailable,
          pricePerDay: gear.pricePerDay
        }
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: 'Failed to check availability',
        errorDetails: error.message
      });
    }
  }
}