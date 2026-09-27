import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

export const MODERN_CHART_COLORS = {
  primary: "#2563eb",
  secondary: "#7c3aed",
  success: "#16a34a",
  warning: "#f59e0b",
  danger: "#ef4444",
  sky: "#0ea5e9",
  teal: "#14b8a6",
  pink: "#ec4899",
  slate: "#64748b",
};

export const ModernTooltip = ({ active, payload, label, valueFormatter }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border/70 bg-background/95 shadow-xl backdrop-blur px-3 py-2 min-w-[140px]">
      {label ? <p className="text-[11px] text-muted-foreground mb-1">{label}</p> : null}
      <div className="space-y-1">
        {payload.map((item) => (
          <div key={`${item.dataKey}-${item.name}`} className="flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
              <span className="text-muted-foreground">{item.name || item.dataKey}</span>
            </div>
            <span className="font-semibold text-foreground">
              {valueFormatter ? valueFormatter(item.value, item) : Number(item.value || 0).toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export const ChartLegendPills = ({ items = [] }) => (
  <div className="flex flex-wrap gap-2">
    {items.map((item) => (
      <span
        key={item.label}
        className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[11px] border bg-muted/40"
      >
        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
        {item.label}
      </span>
    ))}
  </div>
);

export const NoDataOverlay = ({ message = "No data available for selected filters" }) => (
  <div className="absolute inset-0 flex items-center justify-center">
    <div className="px-3 py-1.5 rounded-lg border border-dashed text-xs text-muted-foreground bg-background/80">
      {message}
    </div>
  </div>
);

export const ModernChartCard = ({
  title,
  subtitle,
  actions,
  loading = false,
  empty = false,
  emptyMessage,
  children,
  contentClassName,
}) => (
  <Card className="border border-border/60 shadow-sm">
    <CardHeader className="pb-2">
      <div className="flex items-center justify-between gap-2">
        <div>
          <CardTitle className="text-base">{title}</CardTitle>
          {subtitle ? <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p> : null}
        </div>
        {actions}
      </div>
    </CardHeader>
    <CardContent className={cn("relative", contentClassName)}>
      {loading ? (
        <div className="h-[260px] rounded-xl bg-muted/30 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {children}
          {empty ? <NoDataOverlay message={emptyMessage} /> : null}
        </>
      )}
    </CardContent>
  </Card>
);
