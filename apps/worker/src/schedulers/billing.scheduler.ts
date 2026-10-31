import { runBilling } from "../../../api/src/modules/billing/billing.service";
import { todayUtc } from "../../../api/src/shared/utils/date";

const HOUR = 3_600_000;

export function startBillingScheduler() {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const result = await runBilling(todayUtc());
      if (result.billed || result.closed || result.failed) console.log("[billing]", result);
    } catch (err) {
      console.error("[billing] run failed", err);
    } finally {
      running = false;
    }
  };
  void tick();
  return setInterval(tick, HOUR);
}
