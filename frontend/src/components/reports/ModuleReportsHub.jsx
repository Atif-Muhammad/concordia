import React, { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileBarChart2 } from "lucide-react";
import ReportEngineView from "./ReportEngineView";

/**
 * Shared module-level Reports tab container.
 * Lets any module display a clean card selector over its subset of the 47 unified reports
 * and render the selected report via ReportEngineView.
 */
export const ModuleReportsHub = ({
  reports = [],
  defaultReportKey = null,
  renderExtraContent,
  extraSheetsProvider,
}) => {
  const [activeKey, setActiveKey] = useState(
    () => defaultReportKey || reports[0]?.key || ""
  );
  const [drillFilters, setDrillFilters] = useState({});

  useEffect(() => {
    if (defaultReportKey) setActiveKey(defaultReportKey);
    else if (reports.length && !reports.some((r) => r.key === activeKey)) {
      setActiveKey(reports[0].key);
    }
  }, [defaultReportKey, reports]);

  const activeMeta = reports.find((r) => r.key === activeKey) || reports[0];

  if (!reports.length) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-sm text-muted-foreground">
          No reports available for your current permissions.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {reports.length > 1 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {reports.map((rep) => {
            const Icon = rep.icon || FileBarChart2;
            const isActive = rep.key === activeKey;
            return (
              <Card
                key={rep.key}
                onClick={() => {
                  setDrillFilters({});
                  setActiveKey(rep.key);
                }}
                className={`cursor-pointer transition border ${
                  isActive
                    ? "border-[#F7941E] bg-orange-50/50 shadow-sm ring-1 ring-[#F7941E]/40"
                    : "hover:border-orange-300 bg-white"
                }`}
              >
                <CardContent className="p-3.5 flex items-start gap-3">
                  <div
                    className={`p-2 rounded-lg shrink-0 ${
                      isActive ? "bg-[#F7941E] text-white" : "bg-orange-100 text-[#F7941E]"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-semibold text-slate-900 truncate">
                        {rep.title}
                      </span>
                      {rep.badge && (
                        <Badge variant="outline" className="text-[10px] shrink-0">
                          {rep.badge}
                        </Badge>
                      )}
                    </div>
                    {rep.description && (
                      <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">
                        {rep.description}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {activeMeta?.customComponent ? (
        <div className="space-y-2">
          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              className="text-xs"
              onClick={() => setActiveKey(reports[0]?.key)}
            >
              Back to Unified Engine
            </Button>
          </div>
          {activeMeta.customComponent}
        </div>
      ) : (
        <ReportEngineView
          reportKey={activeKey}
          initialFilters={drillFilters}
          renderExtraContent={
            renderExtraContent ? (payload) => renderExtraContent(activeKey, payload) : undefined
          }
          extraSheets={extraSheetsProvider ? extraSheetsProvider(activeKey) : []}
          onDrillDown={(targetKey, nextFilters) => {
            if (reports.some((r) => r.key === targetKey)) {
              setDrillFilters(nextFilters || {});
              setActiveKey(targetKey);
            }
          }}
        />
      )}
    </div>
  );
};

export const ReportsModeWrapper = ({
  reports = [],
  classicLabel = "Classic Reports & Charts",
  unifiedLabel = "ERP Report Templates",
  defaultMode = "classic",
  children,
}) => {
  const [mode, setMode] = useState(defaultMode);

  if (!reports.length) return children;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-orange-200/80 bg-orange-50/40 px-3 py-2">
        <div className="inline-flex rounded-lg border bg-white p-0.5 shadow-2xs">
          <button
            type="button"
            onClick={() => setMode("classic")}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${
              mode === "classic"
                ? "bg-[#F7941E] text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            {classicLabel}
          </button>
          <button
            type="button"
            onClick={() => setMode("unified")}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition flex items-center gap-1.5 ${
              mode === "unified"
                ? "bg-[#F7941E] text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <FileBarChart2 className="w-3.5 h-3.5" />
            {unifiedLabel}
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                mode === "unified" ? "bg-white/25 text-white" : "bg-orange-100 text-[#F7941E]"
              }`}
            >
              {reports.length}
            </span>
          </button>
        </div>
        <span className="text-[11px] text-slate-500 hidden sm:inline">
          Includes standardized print/PDF, Excel export &amp; audit trail
        </span>
      </div>

      {mode === "unified" ? <ModuleReportsHub reports={reports} /> : children}
    </div>
  );
};

export default ModuleReportsHub;
