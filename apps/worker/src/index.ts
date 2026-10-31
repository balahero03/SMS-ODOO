import { prisma } from "../../api/src/config/database";
import { startBillingScheduler } from "./schedulers/billing.scheduler";

const timer = startBillingScheduler();
console.log("Billing worker started");

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, async () => {
    clearInterval(timer);
    await prisma.$disconnect();
    process.exit(0);
  });
}
