"use client";

import { AlertTriangle, Shield, Eye } from "lucide-react";

interface Alert {
  id: string;
  type: "attempted_access" | "content_detected" | "evasion";
  message: string;
  timestamp: string;
}

interface AlertListProps {
  alerts: Alert[];
}

const iconMap = {
  attempted_access: AlertTriangle,
  content_detected: Eye,
  evasion: Shield,
};

const colorMap = {
  attempted_access: "text-warning",
  content_detected: "text-danger",
  evasion: "text-danger",
};

const labelMap = {
  attempted_access: "Blocked",
  content_detected: "Flagged",
  evasion: "Evasion",
};

function timeAgo(timestamp: string): string {
  const seconds = Math.floor(
    (Date.now() - new Date(timestamp).getTime()) / 1000
  );
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export default function AlertList({ alerts }: AlertListProps) {
  if (alerts.length === 0) {
    return (
      <div className="bg-card-bg border border-card-border rounded-xl p-6 text-center">
        <Shield className="w-8 h-8 text-success mx-auto mb-2" />
        <p className="text-sm text-muted">No recent alerts. Keep it up.</p>
      </div>
    );
  }

  return (
    <div className="bg-card-bg border border-card-border rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-card-border">
        <h3 className="text-sm font-medium text-muted">Recent Alerts</h3>
      </div>
      <div className="divide-y divide-card-border">
        {alerts.map((alert) => {
          const Icon = iconMap[alert.type];
          return (
            <div key={alert.id} className="px-4 py-3 flex items-start gap-3">
              <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${colorMap[alert.type]}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-medium ${colorMap[alert.type]}`}>
                    {labelMap[alert.type]}
                  </span>
                  <span className="text-xs text-muted">{timeAgo(alert.timestamp)}</span>
                </div>
                <p className="text-sm text-foreground/80 mt-0.5 truncate">
                  {alert.message}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
