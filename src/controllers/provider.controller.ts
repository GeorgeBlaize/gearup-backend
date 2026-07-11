import { Response } from 'express';
import { prisma } from '../app';
import { AuthRequest } from '../middleware/auth.middleware';

export class ProviderController {
  // Get provider's gear inventory
  async getMyGear(req: AuthRequest, res: Response) {
    try {
      const { categoryId, availability, search, page = 1, limit = 10 } = req.query;
      
      const skip = (Number(page) - 1) * Number(limit);
      const take = Number(limit);

      const where: any = {
        providerId: req.userId
      };
      if (categoryId) where.categoryId = categoryId;
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
            _count: {
              select: {
                rentalItems: {
                  where: {
                    rentalOrder: {
                      status: {
                        in: ['PLACED', 'CONFIRMED', 'PAID', 'PICKED_UP']
                      }
                    }
                  }
                },
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
        message: 'Failed to fetch gear inventory',
        errorDetails: error.message
      });
    }
  }

  // Get provider's incoming orders
  async getIncomingOrders(req: AuthRequest, res: Response) {
    try {
      const { status, fromDate, toDate, page = 1, limit = 10 } = req.query;
      
      const skip = (Number(page) - 1) * Number(limit);
      const take = Number(limit);

      const where: any = {
        providerId: req.userId
      };
      if (status) where.status = status;
      if (fromDate) where.startDate = { gte: new Date(fromDate as string) };
      if (toDate) where.endDate = { lte: new Date(toDate as string) };

      const [orders, total] = await Promise.all([
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
          orders,
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
        message: 'Failed to fetch incoming orders',
        errorDetails: error.message
      });
    }
  }

  // Update rental order status (Provider)
  async updateOrderStatus(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { status, note } = req.body;

      const validStatuses = ['CONFIRMED', 'PICKED_UP', 'RETURNED', 'CANCELLED'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid status',
          errorDetails: `Status must be one of: ${validStatuses.join(', ')}`
        });
      }

      // Check if order exists and belongs to provider
      const order = await prisma.rentalOrder.findUnique({
        where: { id },
        include: {
          payment: true,
          rentalItems: {
            include: {
              gearItem: true
            }
          }
        }
      });

      if (!order) {
        return res.status(404).json({
          success: false,
          message: 'Order not found',
          errorDetails: 'Invalid order ID'
        });
      }

      if (order.providerId !== req.userId && req.userRole !== 'ADMIN') {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized',
          errorDetails: 'You can only update your own orders'
        });
      }

      // Validate status transitions
      if (order.status === 'CANCELLED') {
        return res.status(400).json({
          success: false,
          message: 'Cannot update cancelled order',
          errorDetails: 'Order is already cancelled'
        });
      }

      // Update gear availability when order is picked up or returned
      const updates: any = { status };
      
      if (status === 'PICKED_UP') {
        // Reduce gear quantity when picked up
        for (const item of order.rentalItems) {
          await prisma.gearItem.update({
            where: { id: item.gearItemId },
            data: {
              quantity: {
                decrement: item.quantity
              },
              availability: {
                set: true // Will be updated based on quantity
              }
            }
          });
        }
      }

      if (status === 'RETURNED') {
        // Increase gear quantity when returned
        for (const item of order.rentalItems) {
          await prisma.gearItem.update({
            where: { id: item.gearItemId },
            data: {
              quantity: {
                increment: item.quantity
              }
            }
          });
        }
      }

      const updatedOrder = await prisma.rentalOrder.update({
        where: { id },
        data: updates,
        include: {
          customer: {
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
              status: true
            }
          },
          rentalItems: {
            include: {
              gearItem: {
                select: {
                  id: true,
                  name: true,
                  brand: true
                }
              }
            }
          }
        }
      });

      // If order is returned, allow customer to review
      if (status === 'RETURNED') {
        // You could send notification here
        console.log(`Order ${order.orderNumber} returned, customer can now review`);
      }

      return res.json({
        success: true,
        message: `Order status updated to ${status}`,
        data: { 
          order: updatedOrder,
          providerNote: note || null
        }
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: 'Failed to update order status',
        errorDetails: error.message
      });
    }
  }

  // Get order details (Provider)
  async getOrderDetails(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      const order = await prisma.rentalOrder.findUnique({
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

      if (!order) {
        return res.status(404).json({
          success: false,
          message: 'Order not found',
          errorDetails: 'Invalid order ID'
        });
      }

      // Check authorization
      if (order.providerId !== req.userId && req.userRole !== 'ADMIN') {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized',
          errorDetails: 'You can only view your own orders'
        });
      }

      return res.json({
        success: true,
        data: { order }
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch order details',
        errorDetails: error.message
      });
    }
  }

  // Get provider statistics
  async getStats(req: AuthRequest, res: Response) {
    try {
      const [totalGear, totalOrders, completedOrders, pendingOrders, revenue] = await Promise.all([
        prisma.gearItem.count({
          where: { providerId: req.userId }
        }),
        prisma.rentalOrder.count({
          where: { providerId: req.userId }
        }),
        prisma.rentalOrder.count({
          where: { 
            providerId: req.userId,
            status: 'RETURNED'
          }
        }),
        prisma.rentalOrder.count({
          where: { 
            providerId: req.userId,
            status: { in: ['PLACED', 'CONFIRMED', 'PAID', 'PICKED_UP'] }
          }
        }),
        prisma.payment.aggregate({
          where: {
            rentalOrder: {
              providerId: req.userId
            },
            status: 'COMPLETED'
          },
          _sum: {
            amount: true
          }
        })
      ]);

      // Get recent orders
      const recentOrders = await prisma.rentalOrder.findMany({
        where: { providerId: req.userId },
        include: {
          customer: {
            select: {
              name: true,
              email: true
            }
          },
          rentalItems: {
            include: {
              gearItem: {
                select: {
                  name: true
                }
              }
            }
          },
          payment: {
            select: {
              amount: true,
              status: true
            }
          }
        },
        take: 5,
        orderBy: { createdAt: 'desc' }
      });

      // Get monthly rental trends
      const monthlyTrendsRaw = await prisma.$queryRaw<{ month: Date; orders: bigint; revenue: number }[]>`
        SELECT
          DATE_TRUNC('month', "createdAt") as month,
          COUNT(*) as orders,
          SUM("totalAmount") as revenue
        FROM "rental_orders"
        WHERE "providerId" = ${req.userId}
        AND status = 'RETURNED'
        GROUP BY DATE_TRUNC('month', "createdAt")
        ORDER BY month DESC
        LIMIT 6
      `;
      // Postgres COUNT(*) comes back as a BigInt, which JSON.stringify can't serialize.
      const monthlyTrends = monthlyTrendsRaw.map(row => ({
        ...row,
        orders: Number(row.orders)
      }));

      return res.json({
        success: true,
        data: {
          overview: {
            totalGear,
            totalOrders,
            completedOrders,
            pendingOrders,
            totalRevenue: revenue._sum.amount || 0
          },
          recentOrders,
          monthlyTrends
        }
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch statistics',
        errorDetails: error.message
      });
    }
  }
}