import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const homeadvisor = await prisma.buyer.findFirst({ where: { name: 'HomeAdvisor' } })
  const modernize = await prisma.buyer.findFirst({ where: { name: 'Modernize' } })
  const windows = await prisma.serviceType.findFirst({ where: { name: 'windows' } })
  const roofing = await prisma.serviceType.findFirst({ where: { name: 'roofing' } })
  const sampleZip = await prisma.buyerServiceZipCode.findFirst()

  console.log(JSON.stringify({
    homeadvisorId: homeadvisor?.id,
    modernizeId: modernize?.id,
    windowsId: windows?.id,
    roofingId: roofing?.id,
    sampleZipId: sampleZip?.id
  }, null, 2))
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
