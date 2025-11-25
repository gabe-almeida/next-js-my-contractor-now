import { prisma } from '../src/lib/prisma';

async function testBuyerOperations() {
  console.log('========================================');
  console.log('Testing Buyer Prisma Operations');
  console.log('========================================\n');

  try {
    // Test 1: List all buyers
    console.log('1. List all buyers with counts:');
    const buyers = await prisma.buyer.findMany({
      where: { active: true },
      include: {
        _count: {
          select: {
            serviceConfigs: true,
            serviceZipCodes: true,
            wonLeads: true
          }
        }
      },
      take: 3
    });
    console.log(`Found ${buyers.length} active buyers`);
    buyers.forEach(b => {
      console.log(`  - ${b.name} (${b.type}): ${b._count.serviceZipCodes} ZIPs, ${b._count.wonLeads} leads won`);
    });

    // Test 2: Get single buyer with relations
    console.log('\n2. Get buyer with full relations:');
    const buyerId = buyers[0].id;
    const buyer = await prisma.buyer.findUnique({
      where: { id: buyerId },
      include: {
        serviceConfigs: {
          include: {
            serviceType: {
              select: {
                id: true,
                name: true,
                displayName: true
              }
            }
          }
        },
        _count: {
          select: {
            serviceZipCodes: true,
            wonLeads: true,
            transactions: true
          }
        }
      }
    });
    console.log(`  Name: ${buyer!.name}`);
    console.log(`  Type: ${buyer!.type}`);
    console.log(`  Service Configs: ${buyer!.serviceConfigs.length}`);
    console.log(`  ZIP Codes: ${buyer!._count.serviceZipCodes}`);
    console.log(`  Transactions: ${buyer!._count.transactions}`);

    // Test 3: Create new buyer
    console.log('\n3. Create new buyer:');
    const newBuyer = await prisma.buyer.create({
      data: {
        name: 'Test Contractor API',
        type: 'CONTRACTOR',
        apiUrl: 'https://test.com/api',
        authConfig: JSON.stringify({
          type: 'bearer',
          credentials: { token: 'test123' }
        }),
        active: true,
        contactName: 'Test Person',
        contactEmail: 'test@test.com'
      }
    });
    console.log(`  Created: ${newBuyer.name} (ID: ${newBuyer.id})`);

    // Test 4: Update buyer
    console.log('\n4. Update buyer:');
    const updated = await prisma.buyer.update({
      where: { id: newBuyer.id },
      data: {
        contactPhone: '555-1234',
        active: false
      }
    });
    console.log(`  Updated: ${updated.name}, active=${updated.active}, phone=${updated.contactPhone}`);

    // Test 5: Check for conflicts (duplicate name)
    console.log('\n5. Test duplicate name check:');
    const duplicate = await prisma.buyer.findFirst({
      where: {
        name: newBuyer.name
      }
    });
    console.log(`  Duplicate check result: ${duplicate ? 'Found' : 'Not found'}`);

    // Test 6: Delete buyer
    console.log('\n6. Delete test buyer:');
    await prisma.buyer.delete({
      where: { id: newBuyer.id }
    });
    console.log(`  Deleted: ${newBuyer.name}`);

    // Test 7: Pagination
    console.log('\n7. Test pagination:');
    const [paginatedBuyers, total] = await Promise.all([
      prisma.buyer.findMany({
        skip: 0,
        take: 2,
        orderBy: { createdAt: 'desc' }
      }),
      prisma.buyer.count()
    ]);
    console.log(`  Page 1: ${paginatedBuyers.length} buyers (Total: ${total}, Pages: ${Math.ceil(total / 2)})`);

    // Test 8: Filter by type
    console.log('\n8. Test filter by type:');
    const networks = await prisma.buyer.findMany({
      where: { type: 'NETWORK' }
    });
    console.log(`  NETWORK buyers: ${networks.map(b => b.name).join(', ')}`);

    console.log('\n========================================');
    console.log('✅ All Prisma operations successful!');
    console.log('========================================');

  } catch (error) {
    console.error('\n❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testBuyerOperations();
