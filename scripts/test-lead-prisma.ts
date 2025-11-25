import { prisma } from '../src/lib/prisma';

async function testLeadOperations() {
  console.log('========================================');
  console.log('Testing Lead Prisma Operations');
  console.log('========================================\n');

  try {
    // Test 1: List all leads with filters
    console.log('1. List all leads with counts:');
    const leads = await prisma.lead.findMany({
      include: {
        serviceType: {
          select: {
            id: true,
            name: true,
            displayName: true
          }
        },
        winningBuyer: {
          select: {
            id: true,
            name: true
          }
        },
        _count: {
          select: {
            transactions: true,
            complianceAudits: true
          }
        }
      },
      take: 5
    });
    console.log(`Found ${leads.length} leads`);
    leads.forEach(lead => {
      console.log(`  - ${lead.id} (${lead.status}): ${lead.serviceType.displayName}, ${lead._count.transactions} transactions`);
    });

    // Test 2: Get single lead with full relations
    console.log('\n2. Get lead with full relations:');
    const leadId = leads[0].id;
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      include: {
        serviceType: true,
        winningBuyer: true,
        transactions: {
          orderBy: {
            createdAt: 'desc'
          }
        },
        complianceAudits: {
          orderBy: {
            createdAt: 'desc'
          }
        }
      }
    });
    console.log(`  Lead: ${lead!.id}`);
    console.log(`  Status: ${lead!.status}`);
    console.log(`  Service: ${lead!.serviceType.displayName}`);
    console.log(`  ZIP: ${lead!.zipCode}`);
    console.log(`  Transactions: ${lead!.transactions.length}`);
    console.log(`  Compliance Audits: ${lead!.complianceAudits.length}`);
    console.log(`  Winning Buyer: ${lead!.winningBuyer?.name || 'None'}`);
    console.log(`  Winning Bid: ${lead!.winningBid || 'N/A'}`);

    // Test 3: Filter by status
    console.log('\n3. Filter by status:');
    const pendingLeads = await prisma.lead.count({
      where: { status: 'PENDING' }
    });
    const soldLeads = await prisma.lead.count({
      where: { status: 'SOLD' }
    });
    console.log(`  PENDING: ${pendingLeads}`);
    console.log(`  SOLD: ${soldLeads}`);

    // Test 4: Filter by date range
    console.log('\n4. Filter by date range (last 7 days):');
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentLeads = await prisma.lead.count({
      where: {
        createdAt: {
          gte: sevenDaysAgo
        }
      }
    });
    console.log(`  Leads created in last 7 days: ${recentLeads}`);

    // Test 5: Filter by service type
    console.log('\n5. Filter by service type:');
    const serviceTypeId = leads[0].serviceTypeId;
    const serviceLeads = await prisma.lead.count({
      where: { serviceTypeId }
    });
    console.log(`  Leads for ${leads[0].serviceType.displayName}: ${serviceLeads}`);

    // Test 6: Pagination
    console.log('\n6. Test pagination:');
    const [paginatedLeads, total] = await Promise.all([
      prisma.lead.findMany({
        skip: 0,
        take: 10,
        orderBy: { createdAt: 'desc' }
      }),
      prisma.lead.count()
    ]);
    console.log(`  Page 1: ${paginatedLeads.length} leads (Total: ${total}, Pages: ${Math.ceil(total / 10)})`);

    // Test 7: Update lead status
    console.log('\n7. Test status update:');
    const testLead = await prisma.lead.findFirst({
      where: { status: 'PENDING' }
    });
    if (testLead) {
      const updated = await prisma.lead.update({
        where: { id: testLead.id },
        data: { status: 'PROCESSING' }
      });
      console.log(`  Updated lead ${testLead.id}: PENDING -> ${updated.status}`);

      // Create audit log
      await prisma.complianceAuditLog.create({
        data: {
          leadId: testLead.id,
          eventType: 'ADMIN_STATUS_CHANGE',
          eventData: JSON.stringify({ oldStatus: 'PENDING', newStatus: 'PROCESSING' })
        }
      });
      console.log(`  Created compliance audit log`);

      // Revert status
      await prisma.lead.update({
        where: { id: testLead.id },
        data: { status: 'PENDING' }
      });
      console.log(`  Reverted status back to PENDING`);
    } else {
      console.log(`  No PENDING leads found to test with`);
    }

    // Test 8: Lead analytics - status counts
    console.log('\n8. Lead analytics - Status distribution:');
    const statusCounts = await prisma.lead.groupBy({
      by: ['status'],
      _count: true
    });
    statusCounts.forEach(s => {
      console.log(`  ${s.status}: ${s._count}`);
    });

    // Test 9: Lead analytics - revenue by service type
    console.log('\n9. Revenue analytics by service type:');
    const revenueByType = await prisma.lead.groupBy({
      by: ['serviceTypeId'],
      _avg: {
        winningBid: true
      },
      _count: true,
      where: {
        winningBid: {
          not: null
        }
      }
    });

    for (const item of revenueByType) {
      const serviceType = await prisma.serviceType.findUnique({
        where: { id: item.serviceTypeId }
      });
      console.log(`  ${serviceType?.displayName}: ${item._count} sold, avg bid: $${item._avg.winningBid?.toFixed(2)}`);
    }

    // Test 10: Transaction analytics
    console.log('\n10. Transaction analytics:');
    const transactionStats = await prisma.transaction.groupBy({
      by: ['status'],
      _count: true,
      _sum: {
        bidAmount: true
      },
      where: {
        status: 'SUCCESS'
      }
    });
    transactionStats.forEach(stat => {
      console.log(`  ${stat.status}: ${stat._count} transactions, $${stat._sum.bidAmount?.toFixed(2)} revenue`);
    });

    console.log('\n========================================');
    console.log('✅ All Lead Prisma operations successful!');
    console.log('========================================');

  } catch (error) {
    console.error('\n❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testLeadOperations();
