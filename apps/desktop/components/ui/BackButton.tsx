"use client";

import { useRouter } from "next/navigation";
import { ChevronLeftIcon } from "@/components/icons";

interface BackButtonProps {
  href?: string;
}

/** Shown at the top of onboarding steps that have a previous step to go back to. */
export function BackButton({ href }: BackButtonProps) {
  const router = useRouter();

  function handleClick() {
    if (href) router.push(href);
    else router.back();
  }

  return (
    <div style={{ padding: "var(--spacing-lg) var(--spacing-lg) 0" }}>
      <button
        onClick={handleClick}
        className="inline-flex items-center gap-1 transition-opacity hover:opacity-70"
        style={{
          fontFamily: "var(--font-auth)",
          fontSize: "var(--font-size-auth-label)",
          color: "var(--color-accent)",
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: 0,
        }}
      >
        <ChevronLeftIcon size={16} />
        Back
      </button>
    </div>
  );
}
