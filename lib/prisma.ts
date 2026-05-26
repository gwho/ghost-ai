import { PrismaClient } from '@/lib/generated/prisma'
import { PrismaPg } from '@prisma/adapter-pg'

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

function createPrismaClient(): PrismaClient {
  const url = process.env.DATABASE_URL

  if (!url || url.trim() === '') {
    throw new Error('Missing DATABASE_URL environment variable')
  }

  if (url.startsWith('prisma+postgres://')) {
    return new PrismaClient({ accelerateUrl: url })
  }

  const adapter = new PrismaPg({ connectionString: url })
  return new PrismaClient({ adapter })
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
