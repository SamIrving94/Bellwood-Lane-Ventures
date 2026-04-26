import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

export const keys = () =>
  createEnv({
    server: {
      EPC_API_EMAIL: z.string().email().optional(),
      EPC_API_KEY: z.string().min(1).optional(),
      COMPANIES_HOUSE_API_KEY: z.string().min(1).optional(),
      OS_PLACES_API_KEY: z.string().min(1).optional(),
      // PropertyData REST API. Server-only — never exposed to the browser.
      // Key issued by propertydata.co.uk; credit usage logged per call.
      PROPERTYDATA_API_KEY: z.string().min(1).optional(),
    },
    runtimeEnv: {
      EPC_API_EMAIL: process.env.EPC_API_EMAIL,
      EPC_API_KEY: process.env.EPC_API_KEY,
      COMPANIES_HOUSE_API_KEY: process.env.COMPANIES_HOUSE_API_KEY,
      OS_PLACES_API_KEY: process.env.OS_PLACES_API_KEY,
      PROPERTYDATA_API_KEY: process.env.PROPERTYDATA_API_KEY,
    },
  });
