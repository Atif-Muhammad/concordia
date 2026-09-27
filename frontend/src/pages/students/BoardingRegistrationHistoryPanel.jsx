import React from "react";
import { useQuery } from "@tanstack/react-query";
import { getHostelRegistrationHistory } from "@/services/api";

export function BoardingRegistrationHistoryPanel({ regId }) {
  const { data: history = [], isLoading } = useQuery({
    queryKey: ['boardingRegHistory', regId],
    queryFn: () => getHostelRegistrationHistory(regId),
    enabled: !!regId,
  });

  const actionMeta = {
    registered:  { label: 'Registered',  color: 'bg-green-100 text-green-700' },
    terminated:  { label: 'Terminated',  color: 'bg-red-100 text-red-700' },
    withdrawn:   { label: 'Withdrawn',   color: 'bg-gray-100 text-gray-700' },
    readmitted:  { label: 'Readmitted',  color: 'bg-blue-100 text-blue-700' },
  };

  if (isLoading) return <div className="py-8 flex justify-center text-sm text-muted-foreground">Loading history...</div>;
  if (!history.length) return <p className="text-sm text-muted-foreground text-center py-6">No history yet.</p>;

  return (
    <div className="relative pl-5 space-y-0 max-h-72 overflow-y-auto">
      <div className="absolute left-[9px] top-2 bottom-2 w-px bg-border" />
      {[...history].reverse().map((entry, i) => {
        const meta = actionMeta[entry.action] || { label: entry.action, color: 'bg-muted text-muted-foreground' };
        return (
          <div key={i} className="relative flex gap-3 pb-4">
            <div className="mt-1 w-3 h-3 rounded-full border-2 border-background bg-primary shrink-0 z-10" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded ${meta.color}`}>{meta.label}</span>
                {entry.previousStatus && (
                  <span className="text-[10px] text-muted-foreground">from {entry.previousStatus}</span>
                )}
              </div>
              {entry.reason && (
                <p className="text-xs text-muted-foreground mt-0.5 italic">"{entry.reason}"</p>
              )}
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {entry.timestamp ? new Date(entry.timestamp).toLocaleString() : '—'}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default BoardingRegistrationHistoryPanel;
