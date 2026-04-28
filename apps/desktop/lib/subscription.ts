export function getEffectiveSubscriptionStatus(
  subscriptionStatus: string,
  subscriptionLapseDate: string | null,
): string {
  if (subscriptionStatus === "trial") {
    if (!subscriptionLapseDate) {
      console.log("return without date");
      
      return subscriptionStatus;
    }
    const lapseTimestamp = Date.parse(subscriptionLapseDate);
    if (Number.isNaN(lapseTimestamp)) {
      console.log("return without valid date");
      return subscriptionStatus;
    }
    console.log("lapse timestamp", lapseTimestamp, "current timestamp", Date.now());
    return lapseTimestamp <= Date.now() ? "trial_expired" : "trial";
  }

  if (subscriptionStatus !== "cancelled") {
    return subscriptionStatus;
  }

  if (!subscriptionLapseDate) {
    return subscriptionStatus;
  }

  const lapseTimestamp = Date.parse(subscriptionLapseDate);
  if (Number.isNaN(lapseTimestamp)) {
    return subscriptionStatus;
  }

  return lapseTimestamp <= Date.now() ? "expired" : "active";
}