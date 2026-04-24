export function getEffectiveSubscriptionStatus(
  subscriptionStatus: string,
  subscriptionLapseDate: string | null,
): string {
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