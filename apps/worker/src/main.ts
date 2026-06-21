import { shouldExpireHold } from "./hold-expiry.js";

// The queue processor is connected in the booking infrastructure task.
// Keep the process bootable while domain behavior is developed independently.
if (shouldExpireHold(new Date(0), new Date())) {
  process.stdout.write("CourtLink worker ready\n");
}
