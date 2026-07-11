import { Request, Response } from 'express';
import { prisma } from '../app';
import { AuthRequest } from '../middleware/auth.middleware';

export class GearController {
  // Get all gear with filters
  async getAllGear(req: Request, res: Response) {
    try {
      const { 
        categoryId, 
        minPrice, 
        maxPrice, 
        brand, 
        availability,
        search,
        sortBy = 'createdAt',
        sortOrder = 'desc',
        page = 1, 
        limit = 10 
      } = req.query;

      const skip = (Number(page) - 1) * Number(limit);
      const take = Number(limit);

      const where: any = {};
      if (categoryId) where.categoryId = categoryId;
      if (brand) where.brand = { contains: brand as string, mode: 'insensitive' };
      if (availability !== undefined) where.availability = availability === 'true';
      if (search) {
        where.OR = [
          { name: { contains: search as string, mode: 'insensitive' } },
          { description: { contains: search as string, mode: 'insensitive' } },
          { brand: { contains: search as string, mode: 'insensitive' } }
        ];
      }
      if (minPrice || maxPrice) {
        where.pricePerDay = {};
        if (minPrice) where.pricePerDay.gte = Number(minPrice);
        if (maxPrice) where.pricePerDay.lte = Number(maxPrice);
      }

      const orderBy: any = {};
      orderBy[sortBy as string] = sortOrder;

      const [gear, total, minMaxPrice] = await Promise.all([
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
                email: true,
                phone: true
              }
            },
            reviews: {
              select: {
                rating: true,
                comment: true,
                customer: {
                  select: {
                    name: true
                  }
                },
                createdAt: true
              },
              orderBy: {
                createdAt: 'desc'
              },
              take: 3
            },
            _count: {
              select: {
                reviews: true,
                rentalItems: true
              }
            }
          },
          skip,
          take,
          orderBy
        }),
        prisma.gearItem.count({ where }),
        prisma.gearItem.aggregate({
          where,
          _min: {
            pricePerDay: true
          },
          _max: {
            pricePerDay: true
          }
        })
      ]);

      // Calculate average rating for each gear item
      const gearWithRating = gear.map(item => {
        const totalRating = item.reviews.reduce((sum, review) => sum + review.rating, 0);
        const avgRating = item.reviews.length > 0 ? totalRating / item.reviews.length : 0;
        return {
          ...item,
          averageRating: Math.round(avgRating * 10) / 10,
          reviewCount: item._count.reviews
        };
      });

      return res.json({
        success: true,
        data: {
          gear: gearWithRating,
          filters: {
            minPrice: minMaxPrice._min.pricePerDay || 0,
            maxPrice: minMaxPrice._max.pricePerDay || 0
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
        message: 'Failed to fetch gear',
        errorDetails: error.message
      });
    }
  }

  // Get gear by ID
  async getGearById(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const gear = await prisma.gearItem.findUnique({
        where: { id },
        include: {
          category: {
            select: {
              id: true,
              name: true,
              description: true
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
          reviews: {
            include: {
              customer: {
                select: {
                  id: true,
                  name: true
                }
              }
            },
            orderBy: {
              createdAt: 'desc'
            }
          },
          _count: {
            select: {
              reviews: true,
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

      // Calculate average rating
      const totalRating = gear.reviews.reduce((sum, review) => sum + review.rating, 0);
      const averageRating = gear.reviews.length > 0 ? totalRating / gear.reviews.length : 0;

      // Check availability
      const isAvailable = gear.availability && gear.quantity > 0;

      return res.json({
        success: true,
        data: {
          ...gear,
          averageRating: Math.round(averageRating * 10) / 10,
          available: isAvailable,
          activeRentals: gear._count.rentalItems
        }
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch gear details',
        errorDetails: error.message
      });
    }
  }

  // Create new gear item (Provider)
  async createGear(req: AuthRequest, res: Response) {
    try {
      const {
        name,
        description,
        pricePerDay,
        brand,
        condition,
        quantity,
        categoryId,
        images = []
      } = req.body;

      // Check if category exists
      const category = await prisma.category.findUnique({
        where: { id: categoryId }
      });

      if (!category) {
        return res.status(404).json({
          success: false,
          message: 'Category not found',
          errorDetails: 'Invalid category ID'
        });
      }

      const gear = await prisma.gearItem.create({
        data: {
          name,
          description,
          pricePerDay,
          brand,
          condition,
          quantity,
          images,
          categoryId,
          providerId: req.userId!,
          availability: true
        },
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
          }
        }
      });

      return res.status(201).json({
        success: true,
        message: 'Gear item created successfully',
        data: { gear }
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: 'Failed to create gear item',
        errorDetails: error.message
      });
    }
  }

  // Update gear item (Provider)
  async updateGear(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const {
        name,
        description,
        pricePerDay,
        brand,
        condition,
        quantity,
        categoryId,
        images,
        availability
      } = req.body;

      // Check if gear exists and belongs to provider
      const existingGear = await prisma.gearItem.findUnique({
        where: { id }
      });

      if (!existingGear) {
        return res.status(404).json({
          success: false,
          message: 'Gear item not found',
          errorDetails: 'Invalid gear ID'
        });
      }

      // Check ownership
      if (existingGear.providerId !== req.userId && req.userRole !== 'ADMIN') {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized',
          errorDetails: 'You can only update your own gear'
        });
      }

      // If categoryId provided, verify it exists
      if (categoryId) {
        const category = await prisma.category.findUnique({
          where: { id: categoryId }
        });
        if (!category) {
          return res.status(404).json({
            success: false,
            message: 'Category not found',
            errorDetails: 'Invalid category ID'
          });
        }
      }

      const updateData: any = {};
      if (name) updateData.name = name;
      if (description) updateData.description = description;
      if (pricePerDay) updateData.pricePerDay = pricePerDay;
      if (brand) updateData.brand = brand;
      if (condition) updateData.condition = condition;
      if (quantity !== undefined) updateData.quantity = quantity;
      if (categoryId) updateData.categoryId = categoryId;
      if (images) updateData.images = images;
      if (availability !== undefined) updateData.availability = availability;

      const gear = await prisma.gearItem.update({
        where: { id },
        data: updateData,
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
          }
        }
      });

      return res.json({
        success: true,
        message: 'Gear item updated successfully',
        data: { gear }
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: 'Failed to update gear item',
        errorDetails: error.message
      });
    }
  }

  // Delete gear item (Provider)
  async deleteGear(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      // Check if gear exists and belongs to provider
      const existingGear = await prisma.gearItem.findUnique({
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

      if (!existingGear) {
        return res.status(404).json({
          success: false,
          message: 'Gear item not found',
          errorDetails: 'Invalid gear ID'
        });
      }

      // Check ownership
      if (existingGear.providerId !== req.userId && req.userRole !== 'ADMIN') {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized',
          errorDetails: 'You can only delete your own gear'
        });
      }

      // Check if gear has active rentals
      if (existingGear.rentalItems.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Cannot delete gear with active rentals',
          errorDetails: 'Gear is currently rented'
        });
      }

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

  // Get categories
  async getCategories(_req: Request, res: Response) {
    try {
      const categories = await prisma.category.findMany({
        include: {
          _count: {
            select: {
              gearItems: {
                where: {
                  availability: true,
                  quantity: { gt: 0 }
                }
              }
            }
          }
        },
        orderBy: {
          name: 'asc'
        }
      });

      return res.json({
        success: true,
        data: { categories }
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch categories',
        errorDetails: error.message
      });
    }
  }
}