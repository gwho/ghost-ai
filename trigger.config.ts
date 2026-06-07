import { config as loadEnv } from "dotenv";
import { defineConfig } from "@trigger.dev/sdk";
import { prismaExtension } from "@trigger.dev/build/extensions/prisma";

loadEnv({ path: ".env.local" });

const project = process.env.TRIGGER_PROJECT_REF;

if (!project) {
  throw new Error(
    "Missing TRIGGER_PROJECT_REF. Add it to .env.local from your Trigger.dev project settings."
  );
}

export default defineConfig({
  project,
  dirs: ["trigger"],
  runtime: "node",
  logLevel: "info",
  maxDuration: 300,

  retries: {
    enabledInDev: false,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 1000,
      maxTimeoutInMs: 10000,
      factor: 2,
    },
  },

  build: {
    extensions: [
      prismaExtension({
        mode: "legacy",
        schema: "prisma/schema.prisma",
      }),
    ],
  },
});
