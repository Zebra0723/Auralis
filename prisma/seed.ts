import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

/** Plan limits are data, not constants in code, so they can change without a deploy. */
const PLANS = [
  {
    tier: "FREE" as const,
    name: "Free",
    priceMonthly: 0,
    maxConnections: 3,
    maxSyncs: 3,
    monthlyOps: 500,
    advancedRules: false,
    auditLogs: false,
    teamFeatures: false,
    prioritySync: false,
  },
  {
    tier: "PLUS" as const,
    name: "Plus",
    priceMonthly: 900,
    maxConnections: 15,
    maxSyncs: -1,
    monthlyOps: 10_000,
    advancedRules: true,
    auditLogs: false,
    teamFeatures: false,
    prioritySync: true,
  },
  {
    tier: "BUSINESS" as const,
    name: "Business",
    priceMonthly: 2900,
    maxConnections: -1,
    maxSyncs: -1,
    monthlyOps: 250_000,
    advancedRules: true,
    auditLogs: true,
    teamFeatures: true,
    prioritySync: true,
  },
];

async function main() {
  for (const plan of PLANS) {
    await db.plan.upsert({
      where: { tier: plan.tier },
      create: plan,
      update: plan,
    });
  }
  console.log(`Seeded ${PLANS.length} plans.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
