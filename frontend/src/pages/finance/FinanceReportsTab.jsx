import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Users,
  Scale,
  CalendarDays,
  ArrowRight,
  TrendingUp,
  FileSpreadsheet,
  Receipt,
  Layers,
} from "lucide-react";
import UserContributionReport from "./reports/UserContributionReport";
import ProfitLossReport from "./reports/ProfitLossReport";
import AnnualProfitLossReport from "./reports/AnnualProfitLossReport";

export default function FinanceReportsTab() {
  const [selectedReport, setSelectedReport] = useState(null); // null = cards menu; "userContribution" | "profitLoss" | "annualProfitLoss"

  // 1. Render Specific Report Views
  if (selectedReport === "userContribution") {
    return <UserContributionReport onBack={() => setSelectedReport(null)} />;
  }

  if (selectedReport === "profitLoss") {
    return <ProfitLossReport onBack={() => setSelectedReport(null)} />;
  }

  if (selectedReport === "annualProfitLoss") {
    return <AnnualProfitLossReport onBack={() => setSelectedReport(null)} />;
  }

  // 2. Default Cards Layout (No heavy queries on mount; high speed & clean UX)
  return (
    <div className="space-y-6 max-w-full">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-[#fdfcf8] dark:bg-card border border-[#eae8df] dark:border-border p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="min-w-0 max-w-2xl">
            <p className="text-[10.5px] font-bold tracking-[0.2em] text-[#8c887b] dark:text-muted-foreground uppercase mb-1">
              FINANCE MANAGEMENT • AUDITS &amp; STATEMENTS
            </p>
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-[#22211f] dark:text-foreground">
              Institutional Financial Statements &amp; Contribution Audits
            </h1>
            <p className="text-xs sm:text-[13px] text-[#66645d] dark:text-muted-foreground mt-1.5 leading-relaxed">
              Select a financial report module below to review staff contribution attribution, comprehensive profit &amp; loss statements, or multi-year annual audits.
            </p>
            <div className="w-10 h-1 bg-[#d97c38] rounded-full mt-2.5" />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Badge variant="outline" className="font-mono text-xs bg-white dark:bg-card px-3 py-1 border-[#eae8df]">
              3 Financial Modules Available
            </Badge>
          </div>
        </div>
      </div>

      {/* Grid of Report Navigation Cards (Matching Concordia ERP Navigation Cards) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {/* CARD 1: User Expense / Income Attribution Report */}
        <div
          onClick={() => setSelectedReport("userContribution")}
          className="group relative overflow-hidden rounded-2xl bg-[#fdfcf8] dark:bg-card border border-[#eae8df] dark:border-border p-5 flex flex-col justify-between shadow-xs hover:border-emerald-500/80 transition-all duration-200 cursor-pointer"
        >
          <div>
            <div className="w-11 h-11 rounded-xl bg-[#2e694d] flex items-center justify-center text-white shadow-sm shrink-0 mb-4">
              <Users className="w-5 h-5 text-white" strokeWidth={2.2} />
            </div>

            <div className="flex items-center gap-2">
              <h3 className="font-bold text-base text-[#22211f] dark:text-foreground tracking-tight group-hover:text-emerald-700 transition-colors">
                Staff Expense &amp; Income Attribution
              </h3>
            </div>
            <p className="mt-2 text-xs text-[#6e6b62] dark:text-muted-foreground leading-relaxed">
              Audit financial inflows (fee collections across all challan types + custom income) and operational expenses created by non-teaching and dual-role staff.
            </p>
          </div>

          <div className="mt-6 pt-3 border-t border-[#f0eee6] dark:border-border/60">
            <Button
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedReport("userContribution");
              }}
              className="w-full justify-between text-xs font-semibold shadow-xs bg-white hover:bg-emerald-50 text-slate-800 border-slate-200 dark:bg-card dark:text-foreground"
            >
              <span className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-emerald-600" />
                Open Staff Attribution Report
              </span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </Button>
          </div>
        </div>

        {/* CARD 2: Profit & Loss Statement (Period-Based) */}
        <div
          onClick={() => setSelectedReport("profitLoss")}
          className="group relative overflow-hidden rounded-2xl bg-[#fdfcf8] dark:bg-card border border-[#eae8df] dark:border-border p-5 flex flex-col justify-between shadow-xs hover:border-amber-500/80 transition-all duration-200 cursor-pointer"
        >
          <div>
            <div className="w-11 h-11 rounded-xl bg-[#c85a17] flex items-center justify-center text-white shadow-sm shrink-0 mb-4">
              <Scale className="w-5 h-5 text-white" strokeWidth={2.2} />
            </div>

            <h3 className="font-bold text-base text-[#22211f] dark:text-foreground tracking-tight group-hover:text-amber-700 transition-colors">
              Statement of Profit &amp; Loss
            </h3>
            <p className="mt-2 text-xs text-[#6e6b62] dark:text-muted-foreground leading-relaxed">
              Structured GAAP financial statement tracking institutional revenues against consolidated payroll and operational expenses with net margin calculations.
            </p>
          </div>

          <div className="mt-6 pt-3 border-t border-[#f0eee6] dark:border-border/60">
            <Button
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedReport("profitLoss");
              }}
              className="w-full justify-between text-xs font-semibold shadow-xs bg-white hover:bg-amber-50 text-slate-800 border-slate-200 dark:bg-card dark:text-foreground"
            >
              <span className="flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-amber-600" />
                Open Profit &amp; Loss Statement
              </span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </Button>
          </div>
        </div>

        {/* CARD 3: Annual Profit / Loss Audit (Multi-Year) */}
        <div
          onClick={() => setSelectedReport("annualProfitLoss")}
          className="group relative overflow-hidden rounded-2xl bg-[#fdfcf8] dark:bg-card border border-[#eae8df] dark:border-border p-5 flex flex-col justify-between shadow-xs hover:border-blue-500/80 transition-all duration-200 cursor-pointer"
        >
          <div>
            <div className="w-11 h-11 rounded-xl bg-[#1d4ed8] flex items-center justify-center text-white shadow-sm shrink-0 mb-4">
              <CalendarDays className="w-5 h-5 text-white" strokeWidth={2.2} />
            </div>

            <h3 className="font-bold text-base text-[#22211f] dark:text-foreground tracking-tight group-hover:text-blue-700 transition-colors">
              Annual Profit &amp; Loss Audit
            </h3>
            <p className="mt-2 text-xs text-[#6e6b62] dark:text-muted-foreground leading-relaxed">
              Multi-year comparative financial audit with visual combo bar &amp; trend line graphs, year-over-year revenue growth, and 12-month deep dive breakdowns.
            </p>
          </div>

          <div className="mt-6 pt-3 border-t border-[#f0eee6] dark:border-border/60">
            <Button
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedReport("annualProfitLoss");
              }}
              className="w-full justify-between text-xs font-semibold shadow-xs bg-white hover:bg-blue-50 text-slate-800 border-slate-200 dark:bg-card dark:text-foreground"
            >
              <span className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-blue-600" />
                Open Annual P&amp;L Audit
              </span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
