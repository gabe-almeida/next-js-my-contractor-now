import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({ log: ['query', 'error'] })

async function main() {
  console.log('Testing database queries...\n')

  try {
    console.log('1. Testing raw query to check buyers table:')
    const result = await prisma.$queryRaw`SELECT * FROM buyers LIMIT 1`
    console.log(JSON.stringify(result, null, 2))

    console.log('\n2. Testing Prisma findFirst:')
    const buyer = await prisma.buyer.findFirst()
    console.log(JSON.stringify(buyer, null, 2))

    console.log('\n3. Testing Prisma findUnique:')
    const homeadvisor = await prisma.buyer.findUnique({
      where: { id: '25e8aa15-3b20-438b-89c0-c7debc908cf7' }
    })
    console.log(JSON.stringify(homeadvisor, null, 2))

  } catch (error) {
    console.error('Error:', error)
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
