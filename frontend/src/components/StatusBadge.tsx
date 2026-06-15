import React from "react";

export type InstrumentStatus = "Calibrated" | "Not Yet" | "Overdue";

interface StatusBadgeProps {
  status: InstrumentStatus;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const styles = {
    Calibrated: "bg-success/15 text-success border-success/30",
    "Not Yet": "bg-warning/15 text-warning border-warning/30",
    Overdue: "bg-overdue/15 text-overdue border-overdue/30",
  };

  return (
    <span 
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium font-mono ${styles[status]}`}
    >
      {status}
    </span>
  );
};

export default StatusBadge;