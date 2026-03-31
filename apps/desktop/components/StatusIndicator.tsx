"use client";

interface StatusIndicatorProps {
  status: "active" | "paused" | "stopped";
  partnerName?: string;
  partnerConnected?: boolean;
}

export default function StatusIndicator({
  status,
  partnerName,
  partnerConnected,
}: StatusIndicatorProps) {
  const statusConfig = {
    active: { label: "Active", color: "bg-success", pulse: true },
    paused: { label: "Paused", color: "bg-warning", pulse: false },
    stopped: { label: "Stopped", color: "bg-danger", pulse: false },
  };

  const config = statusConfig[status];

  return (
    <div className="bg-card-bg border border-card-border rounded-xl p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className={`w-3 h-3 rounded-full ${config.color}`} />
            {config.pulse && (
              <div className={`absolute inset-0 w-3 h-3 rounded-full ${config.color} animate-ping opacity-50`} />
            )}
          </div>
          <div>
            <div className="text-sm font-medium text-foreground">
              Monitoring: {config.label}
            </div>
            {partnerName && (
              <div className="text-xs text-muted mt-0.5">
                Partner: {partnerName}{" "}
                <span className={partnerConnected ? "text-success" : "text-muted"}>
                  {partnerConnected ? "connected" : "pending"}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
