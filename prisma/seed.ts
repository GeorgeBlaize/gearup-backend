import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create admin user
  const adminPassword = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'admin123456', 10);
  
  const admin = await prisma.user.upsert({
    where: { email: process.env.ADMIN_EMAIL || 'admin@gearup.com' },
    update: {},
    create: {
      email: process.env.ADMIN_EMAIL || 'admin@gearup.com',
      password: adminPassword,
      name: 'GearUp Admin',
      role: UserRole.ADMIN,
      isActive: true
    }
  });

  console.log(`✅ Admin created: ${admin.email}`);

  // Create sample categories
  const categories = [
    { name: 'Cycling', description: 'Bicycles, parts, and accessories' },
    { name: 'Camping', description: 'Tents, sleeping bags, and camping gear' },
    { name: 'Fitness', description: 'Exercise equipment and accessories' },
    { name: 'Water Sports', description: 'Kayaks, surfboards, and water gear' },
    { name: 'Winter Sports', description: 'Skis, snowboards, and winter equipment' },
    { name: 'Team Sports', description: 'Balls, equipment for team sports' }
  ];

  for (const category of categories) {
    await prisma.category.upsert({
      where: { name: category.name },
      update: {},
      create: category
    });
  }

  console.log('✅ Categories seeded');

  // Create sample provider
  const providerPassword = await bcrypt.hash('provider123', 10);
  const provider = await prisma.user.upsert({
    where: { email: 'provider@gearup.com' },
    update: {},
    create: {
      email: 'provider@gearup.com',
      password: providerPassword,
      name: 'Sports Pro Rentals',
      phone: '+8801712345678',
      address: '123 Sports Avenue, Dhaka',
      role: UserRole.PROVIDER,
      isActive: true
    }
  });

  console.log(`✅ Provider created: ${provider.email}`);

  // Create sample customer
  const customerPassword = await bcrypt.hash('customer123', 10);
  const customer = await prisma.user.upsert({
    where: { email: 'customer@gearup.com' },
    update: {},
    create: {
      email: 'customer@gearup.com',
      password: customerPassword,
      name: 'Jamie Customer',
      phone: '+8801812345678',
      address: '45 Renter Road, Dhaka',
      role: UserRole.CUSTOMER,
      isActive: true
    }
  });

  console.log(`✅ Customer created: ${customer.email}`);

  // Create sample gear items
  const cyclingCategory = await prisma.category.findUnique({ where: { name: 'Cycling' } });

  let seededGear: { id: string; pricePerDay: number } | null = null;

  if (cyclingCategory) {
    const gearItems = [
      {
        name: 'Mountain Bike Pro',
        description: 'High-end mountain bike with full suspension. Perfect for trail riding.',
        pricePerDay: 25.00,
        brand: 'Trek',
        condition: 'Excellent',
        availability: true,
        quantity: 3,
        categoryId: cyclingCategory.id,
        providerId: provider.id,
        images: ['bike1.jpg', 'bike2.jpg']
      },
      {
        name: 'Road Bike Carbon',
        description: 'Lightweight carbon fiber road bike for speed enthusiasts.',
        pricePerDay: 35.00,
        brand: 'Specialized',
        condition: 'Good',
        availability: true,
        quantity: 2,
        categoryId: cyclingCategory.id,
        providerId: provider.id,
        images: ['roadbike1.jpg']
      }
    ];

    for (const gear of gearItems) {
      const created = await prisma.gearItem.create({ data: gear });
      if (gear.name === 'Mountain Bike Pro') {
        seededGear = { id: created.id, pricePerDay: created.pricePerDay };
      }
    }
  }

  console.log('✅ Gear items seeded');

  // Create a full-lifecycle sample rental (PLACED -> ... -> RETURNED) with a
  // completed payment and a review, so every role's flow is demoable right
  // after seeding without manually walking an order through its lifecycle.
  if (seededGear) {
    const days = 3;
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + days);
    const totalAmount = seededGear.pricePerDay * days;

    const rentalOrder = await prisma.rentalOrder.upsert({
      where: { orderNumber: 'GR-SEED-0001' },
      update: {},
      create: {
        orderNumber: 'GR-SEED-0001',
        customerId: customer.id,
        providerId: provider.id,
        startDate,
        endDate,
        totalAmount,
        status: 'RETURNED',
        rentalItems: {
          create: [
            {
              gearItemId: seededGear.id,
              quantity: 1,
              pricePerDayAtRental: seededGear.pricePerDay
            }
          ]
        }
      }
    });

    await prisma.payment.upsert({
      where: { rentalOrderId: rentalOrder.id },
      update: {},
      create: {
        transactionId: 'SEED-TXN-0001',
        rentalOrderId: rentalOrder.id,
        amount: totalAmount,
        currency: 'usd',
        provider: 'STRIPE',
        status: 'COMPLETED',
        paymentIntentId: 'pi_seed_0001',
        paidAt: new Date()
      }
    });

    const existingReview = await prisma.review.findFirst({
      where: { customerId: customer.id, gearItemId: seededGear.id }
    });
    if (!existingReview) {
      await prisma.review.create({
        data: {
          rating: 5,
          comment: 'Great bike, smooth ride and well maintained!',
          customerId: customer.id,
          gearItemId: seededGear.id
        }
      });
    }

    console.log('✅ Sample rental lifecycle (order + payment + review) seeded');
  }

  console.log('🎉 Database seeding completed!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });