import { config } from 'dotenv'
import path from 'node:path'
import { defineConfig, env } from 'prisma/config'

config({ path: '.env.local' })

export default defineConfig({
  schema: path.join('prisma'),
  datasource: {
    url: env('DATABASE_URL'),
  },
})
