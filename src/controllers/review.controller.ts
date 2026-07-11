import { Request, Response } from 'express';
import { prisma } from '../app';
import { AuthRequest } from '../middleware/auth.middleware';

export class ReviewController {
  // Create review for a gear item
  async createReview(req: AuthRequest, res: Response) {
    try {
      const { gearItemId, rating, comment } = req.body;
      const customerId = req.userId;

      // Validate rating
      if (rating < 1 || rating > 5) {
        return res.status(400).json({
          success: false,
          message: 'Rating must be between 1 and 5',
          errorDetails: 'Invalid rating'
        });
      }

      // Check if gear item exists
      const gearItem = await prisma.gearItem.findUnique({
        where: { id: gearItemId }
      });

      if (!gearItem) {
        return res.status(404).json({
          success: false,
          message: 'Gear item not found',
          errorDetails: 'Invalid gear ID'
        });
      }

      // Check if user has rented this gear and returned it
      const rentalHistory = await prisma.rentalOrder.findFirst({
        where: {
          customerId: customerId!,
          status: 'RETURNED',
          rentalItems: {
            some: {
              gearItemId
            }
          }
        }
      });

      if (!rentalHistory) {
        return res.status(403).json({
          success: false,
          message: 'You can only review gear you have rented and returned',
          errorDetails: 'No rental history found'
        });
      }

      // Check if user already reviewed this gear
      const existingReview = await prisma.review.findFirst({
        where: {
          customerId: customerId!,
          gearItemId
        }
      });

      if (existingReview) {
        return res.status(400).json({
          success: false,
          message: 'You have already reviewed this gear',
          errorDetails: 'Duplicate review'
        });
      }

      const review = await prisma.review.create({
        data: {
          rating,
          comment,
          customerId: customerId!,
          gearItemId
        },
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          gearItem: {
            select: {
              id: true,
              name: true,
              brand: true
            }
          }
        }
      });

      return res.status(201).json({
        success: true,
        message: 'Review created successfully',
        data: { review }
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: 'Failed to create review',
        errorDetails: error.message
      });
    }
  }

  // Get reviews for a gear item
  async getGearReviews(req: Request, res: Response) {
    try {
      const { gearId } = req.params;
      const { page = 1, limit = 10 } = req.query;

      const skip = (Number(page) - 1) * Number(limit);
      const take = Number(limit);

      const [reviews, total] = await Promise.all([
        prisma.review.findMany({
          where: { gearItemId: gearId },
          include: {
            customer: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          },
          skip,
          take,
          orderBy: { createdAt: 'desc' }
        }),
        prisma.review.count({
          where: { gearItemId: gearId }
        })
      ]);

      // Calculate rating statistics
      const ratingStats = await prisma.review.aggregate({
        where: { gearItemId: gearId },
        _avg: {
          rating: true
        },
        _count: {
          rating: true
        }
      });

      // Get rating distribution
      const ratingDistribution = await prisma.review.groupBy({
        by: ['rating'],
        where: { gearItemId: gearId },
        _count: {
          rating: true
        }
      });

      return res.json({
        success: true,
        data: {
          reviews,
          stats: {
            averageRating: Math.round((ratingStats._avg.rating || 0) * 10) / 10,
            totalReviews: ratingStats._count.rating || 0,
            distribution: ratingDistribution.map(r => ({
              rating: r.rating,
              count: r._count.rating
            }))
          },
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
        message: 'Failed to fetch reviews',
        errorDetails: error.message
      });
    }
  }

  // Get user's reviews
  async getMyReviews(req: AuthRequest, res: Response) {
    try {
      const { page = 1, limit = 10 } = req.query;

      const skip = (Number(page) - 1) * Number(limit);
      const take = Number(limit);

      const [reviews, total] = await Promise.all([
        prisma.review.findMany({
          where: { customerId: req.userId },
          include: {
            gearItem: {
              select: {
                id: true,
                name: true,
                brand: true,
                images: true,
                provider: {
                  select: {
                    id: true,
                    name: true
                  }
                }
              }
            }
          },
          skip,
          take,
          orderBy: { createdAt: 'desc' }
        }),
        prisma.review.count({
          where: { customerId: req.userId }
        })
      ]);

      return res.json({
        success: true,
        data: {
          reviews,
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
        message: 'Failed to fetch reviews',
        errorDetails: error.message
      });
    }
  }

  // Update review
  async updateReview(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { rating, comment } = req.body;

      // Check if review exists and belongs to user
      const existingReview = await prisma.review.findUnique({
        where: { id }
      });

      if (!existingReview) {
        return res.status(404).json({
          success: false,
          message: 'Review not found',
          errorDetails: 'Invalid review ID'
        });
      }

      if (existingReview.customerId !== req.userId && req.userRole !== 'ADMIN') {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized',
          errorDetails: 'You can only update your own reviews'
        });
      }

      // Validate rating
      if (rating && (rating < 1 || rating > 5)) {
        return res.status(400).json({
          success: false,
          message: 'Rating must be between 1 and 5',
          errorDetails: 'Invalid rating'
        });
      }

      const updateData: any = {};
      if (rating) updateData.rating = rating;
      if (comment !== undefined) updateData.comment = comment;

      const review = await prisma.review.update({
        where: { id },
        data: updateData,
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          gearItem: {
            select: {
              id: true,
              name: true,
              brand: true
            }
          }
        }
      });

      return res.json({
        success: true,
        message: 'Review updated successfully',
        data: { review }
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: 'Failed to update review',
        errorDetails: error.message
      });
    }
  }

  // Delete review
  async deleteReview(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      // Check if review exists and belongs to user
      const existingReview = await prisma.review.findUnique({
        where: { id }
      });

      if (!existingReview) {
        return res.status(404).json({
          success: false,
          message: 'Review not found',
          errorDetails: 'Invalid review ID'
        });
      }

      if (existingReview.customerId !== req.userId && req.userRole !== 'ADMIN') {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized',
          errorDetails: 'You can only delete your own reviews'
        });
      }

      await prisma.review.delete({
        where: { id }
      });

      return res.json({
        success: true,
        message: 'Review deleted successfully'
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: 'Failed to delete review',
        errorDetails: error.message
      });
    }
  }
}