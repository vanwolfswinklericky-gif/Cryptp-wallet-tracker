// prisma.config.ts
import { defineConfig } from 'prisma/config';
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

export default defineConfig({
  datasource: {
    url: process.env.DATABASE_URL!,
  },
  adapter: () => {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });
    return new PrismaPg(pool);
  },
});