import { Response } from 'express';
import { prisma } from '../app';
import { AuthRequest } from '../middleware/auth.middleware';

export class AdminController {
  // Get all users with filters
  async getAllUsers(req: AuthRequest, res: Response) {
    try {
      const { role, isActive, search, page = 1, limit = 10 } = req.query;
      
      const skip = (Number(page) - 1) * Number(limit);
      const take = Number(limit);

      // Build where clause
      const where: any = {};
      if (role) where.role = role;
      if (isActive !== undefined) where.isActive = isActive === 'true';
      if (search) {
        where.OR = [
          { name: { contains: search as string, mode: 'insensitive' } },
          { email: { contains: search as string, mode: 'insensitive' } }
        ];
      }

      const [users, total] = await Promise.all([
        prisma.user.findMany({
          where,
          select: {
            id: true,
            email: true,
            name: true,
            phone: true,
            address: true,
            role: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
            _count: {
              select: {
                gearItems: true,
                rentals: true
              }
            }
          },
          skip,
          take,
          orderBy: { createdAt: 'desc' }
        }),
        prisma.user.count({ where })
      ]);

      return res.json({
        success: true,
        data: {
          users,
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
        message: 'Failed to fetch users',
        errorDetails: error.message
      });
    }
  }

  // Get user by ID
  async getUserById(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      const user = await prisma.user.findUnique({
        where: { id },
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
          address: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          gearItems: {
            select: {
              id: true,
              name: true,
              pricePerDay: true,
              availability: true,
              _count: {
                select: {
                  rentalItems: true
                }
              }
            }
          },
          rentals: {
            select: {
              id: true,
              orderNumber: true,
              totalAmount: true,
              status: true,
              createdAt: true
            },
            take: 5,
            orderBy: { createdAt: 'desc' }
          },
          _count: {
            select: {
              gearItems: true,
              rentals: true,
              reviews: true
            }
          }
        }
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
          errorDetails: 'Invalid user ID'
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

  // Update user status (activate/suspend)
  async updateUserStatus(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { isActive } = req.body;

      if (isActive === undefined) {
        return res.status(400).json({
          success: false,
          message: 'isActive field is required',
          errorDetails: 'Missing field'
        });
      }

      // Check if user exists
      const existingUser = await prisma.user.findUnique({
        where: { id }
      });

      if (!existingUser) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
          errorDetails: 'Invalid user ID'
        });
      }

      // Prevent admin from deactivating themselves
      if (id === req.userId && existingUser.role === 'ADMIN') {
        return res.status(403).json({
          success: false,
          message: 'Cannot deactivate own admin account',
          errorDetails: 'Action not allowed'
        });
      }

      const user = await prisma.user.update({
        where: { id },
        data: { isActive },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          updatedAt: true
        }
      });

      return res.json({
        success: true,
        message: `User ${isActive ? 'activated' : 'suspended'} successfully`,
        data: { user }
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: 'Failed to update user status',
        errorDetails: error.message
      });
    }
  }

  // Get all gear listings (admin view)
  async getAllGear(req: AuthRequest, res: Response) {
    try {
      const { categoryId, providerId, availability, search, page = 1, limit = 10 } = req.query;
      
      const skip = (Number(page) - 1) * Number(limit);
      const take = Number(limit);

      const where: any = {};
      if (categoryId) where.categoryId = categoryId;
      if (providerId) where.providerId = providerId;
      if (availability !== undefined) where.availability = availability === 'true';
      if (search) {
        where.OR = [
          { name: { contains: search as string, mode: 'insensitive' } },
          { description: { contains: search as string, mode: 'insensitive' } },
          { brand: { contains: search as string, mode: 'insensitive' } }
        ];
      }

      const [gear, total] = await Promise.all([
        prisma.gearItem.findMany({
          where,
          include: {
            category: {
              select: {
                id: true,
                name: true
              }
            },
            provider: {
              select: {
                id: true,
                name: true,
                email: true
              }
            },
            _count: {
              select: {
                rentalItems: true,
                reviews: true
              }
            }
          },
          skip,
          take,
          orderBy: { createdAt: 'desc' }
        }),
        prisma.gearItem.count({ where })
      ]);

      return res.json({
        success: true,
        data: {
          gear,
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
        message: 'Failed to fetch gear listings',
        errorDetails: error.message
      });
    }
  }

  // Delete any gear item (admin only)
  async deleteGearItem(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      // Check if gear exists
      const gear = await prisma.gearItem.findUnique({
        where: { id },
        include: {
          rentalItems: {
            where: {
              rentalOrder: {
                status: {
                  in: ['PLACED', 'CONFIRMED', 'PAID', 'PICKED_UP']
                }
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

      // Check if gear has active rentals
      if (gear.rentalItems.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Cannot delete gear with active rentals',
          errorDetails: 'Gear is currently rented'
        });
      }

      // Delete associated reviews first
      await prisma.review.deleteMany({
        where: { gearItemId: id }
      });

      // Delete the gear item
      await prisma.gearItem.delete({
        where: { id }
      });

      return res.json({
        success: true,
        message: 'Gear item deleted successfully'
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: 'Failed to delete gear item',
        errorDetails: error.message
      });
    }
  }

  // Get all rental orders (admin view)
  async getAllRentals(req: AuthRequest, res: Response) {
    try {
      const { status, customerId, providerId, fromDate, toDate, page = 1, limit = 10 } = req.query;
      
      const skip = (Number(page) - 1) * Number(limit);
      const take = Number(limit);

      const where: any = {};
      if (status) where.status = status;
      if (customerId) where.customerId = customerId;
      if (providerId) where.providerId = providerId;
      if (fromDate) where.startDate = { gte: new Date(fromDate as string) };
      if (toDate) where.endDate = { lte: new Date(toDate as string) };

      const [rentals, total] = await Promise.all([
        prisma.rentalOrder.findMany({
          where,
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

  // Get rental details by ID (admin view)
  async getRentalById(req: AuthRequest, res: Response) {
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

      return res.json({
        success: true,
        data: { rental }
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch rental details',
        errorDetails: error.message
      });
    }
  }

  // Update rental status (admin override)
  async updateRentalStatus(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { status, reason } = req.body;

      const validStatuses = ['PLACED', 'CONFIRMED', 'PAID', 'PICKED_UP', 'RETURNED', 'CANCELLED'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid status',
          errorDetails: `Status must be one of: ${validStatuses.join(', ')}`
        });
      }

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

      // Validate status transitions
      if (status === 'PAID' && rental.payment?.status !== 'COMPLETED') {
        return res.status(400).json({
          success: false,
          message: 'Cannot mark as PAID without completed payment',
          errorDetails: 'Payment not completed'
        });
      }

      const updatedRental = await prisma.rentalOrder.update({
        where: { id },
        data: { status },
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          provider: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        }
      });

      return res.json({
        success: true,
        message: `Rental status updated to ${status}`,
        data: { 
          rental: updatedRental,
          adminNote: reason || 'Status updated by admin'
        }
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: 'Failed to update rental status',
        errorDetails: error.message
      });
    }
  }

  // Get dashboard statistics (admin)
  async getDashboardStats(_req: AuthRequest, res: Response) {
    try {
      const [totalUsers, totalProviders, totalGear, totalRentals, recentRentals, revenueStats] = await Promise.all([
        prisma.user.count(),
        prisma.user.count({ where: { role: 'PROVIDER' } }),
        prisma.gearItem.count(),
        prisma.rentalOrder.count(),
        prisma.rentalOrder.findMany({
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: {
            customer: {
              select: {
                name: true,
                email: true
              }
            },
            provider: {
              select: {
                name: true
              }
            }
          }
        }),
        prisma.payment.aggregate({
          where: {
            status: 'COMPLETED',
            paidAt: {
              gte: new Date(new Date().setMonth(new Date().getMonth() - 1))
            }
          },
          _sum: {
            amount: true
          },
          _count: {
            id: true
          }
        })
      ]);

      // Get rental status breakdown
      const statusBreakdown = await prisma.rentalOrder.groupBy({
        by: ['status'],
        _count: {
          status: true
        }
      });

      // Get monthly revenue
      const monthlyRevenueRaw = await prisma.$queryRaw<{ month: Date; revenue: number; transactions: bigint }[]>`
        SELECT
          DATE_TRUNC('month', "paidAt") as month,
          SUM(amount) as revenue,
          COUNT(*) as transactions
        FROM "payments"
        WHERE status = 'COMPLETED'
        AND "paidAt" IS NOT NULL
        GROUP BY DATE_TRUNC('month', "paidAt")
        ORDER BY month DESC
        LIMIT 6
      `;
      // Postgres COUNT(*) comes back as a BigInt, which JSON.stringify can't serialize.
      const monthlyRevenue = monthlyRevenueRaw.map(row => ({
        ...row,
        transactions: Number(row.transactions)
      }));

      return res.json({
        success: true,
        data: {
          overview: {
            totalUsers,
            totalProviders,
            totalGearItems: totalGear,
            totalRentals,
            monthlyRevenue: revenueStats._sum.amount || 0,
            monthlyTransactions: revenueStats._count.id || 0
          },
          statusBreakdown,
          recentRentals,
          monthlyRevenue
        }
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch dashboard statistics',
        errorDetails: error.message
      });
    }
  }
}