"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getEffectiveSubscriptionStatus } from "@/lib/subscription";

interface Props {
  subscriptionStatus: string;
  userId: string | null;
  stripeCustomerId: string | null;
  subscriptionLapseDate: string | null;
  children: React.ReactNode;
}

const LOCKED_STATUSES = ["expired", "past_due", "trial_expired"];

export default function SubscriptionGate({
  subscriptionStatus,
  userId,
  stripeCustomerId,
  subscriptionLapseDate,
  children,
}: Props) {
  const router = useRouter();
  const effectiveSubscriptionStatus = getEffectiveSubscriptionStatus(
    subscriptionStatus,
    subscriptionLapseDate,
  );

  useEffect(() => {
    if (LOCKED_STATUSES.includes(effectiveSubscriptionStatus)) {
      router.push("/locked");
    }
  }, [effectiveSubscriptionStatus, router]);

  if (LOCKED_STATUSES.includes(effectiveSubscriptionStatus)) {
    return null; // Will redirect to /locked page
  }

  return <>{children}</>;
}
