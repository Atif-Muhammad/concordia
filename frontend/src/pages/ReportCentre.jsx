import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  FileBarChart2, History, Loader2, Search, ArrowLeft,
} from "lucide-react";
import ReportEngineView from "@/components/reports/ReportEngineView";
import {
  getReportCatalog,
} from "../../config/apis";

const CATEGORY_ORDER = [
  "All",
  "Admissions",
  "Students",
  "Fee Management",
  "Examination",
  "Attendance",
  "Academics",
  "Staff",
  "HR & Payroll",
  "Finance",
  "Front Office",
  "Complaints",
  "Boarding",
  "Inventory",
  "Executive Dashboard",
  "Combined",
  "Report Centre",
];

const ReportCentre = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const urlKey = searchParams.get("key") || "";
  const urlCat = searchParams.get("category") || "All";

  const [selectedKey, setSelectedKey] = useState(urlKey);
  const [activeCategory, setActiveCategory] = useState(urlCat);
  const [searchText, setSearchText] = useState("");
  const [initialFilters, setInitialFilters] = useState({});
  const [activeTopTab, setActiveTopTab] = useState(
    urlKey === "report-centre-audit-log" ? "audit" : "catalog"
  );

  useEffect(() => {
    if (urlKey) setSelectedKey(urlKey);
    if (urlCat) setActiveCategory(urlCat);
  }, [urlKey, urlCat]);

  const { data: catalogData, isLoading: catalogLoading } = useQuery({
    queryKey: ["report-catalog"],
    queryFn: getReportCatalog,
    staleTime: 60_000,
  });

  const reports = catalogData?.reports || [];

  const availableCategories = useMemo(() => {
    const present = new Set(reports.map((r) => r.module));
    return CATEGORY_ORDER.filter((c) => c === "All" || present.has(c));
  }, [reports]);

  const filteredReports = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    return reports.filter((r) => {
      if (activeCategory !== "All" && r.module !== activeCategory) return false;
      if (!q) return true;
      return (
        r.title.toLowerCase().includes(q) ||
        r.purpose.toLowerCase().includes(q) ||
        r.module.toLowerCase().includes(q) ||
        String(r.pageNumber).includes(q)
      );
    });
  }, [reports, activeCategory, searchText]);

  const openReport = (key, filters = {}) => {
    setInitialFilters(filters);
    setSelectedKey(key);
    setSearchParams(key ? { key } : {});
  };

  const activeReportMeta = reports.find((r) => r.key === selectedKey);

  return (
    <DashboardLayout>
      <div className="space-y-5 max-w-full overflow-x-hidden">
        {/* Top Branded Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-orange-200 pb-4">
          <div>
            <div className="text-[11px] font-bold tracking-wider uppercase text-[#F7941E]">
              CONCORDIA COLLEGE PESHAWAR
            </div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <FileBarChart2 className="w-7 h-7 text-[#F7941E]" />
              ERP Report Centre
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Unified institutional reporting engine across all modules — live KPIs, drill-downs, saved views, PDF &amp; Excel exports.
            </p>
          </div>
          {selectedKey && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 self-start sm:self-auto"
              onClick={() => openReport("", {})}
            >
              <ArrowLeft className="w-4 h-4" /> All 47 Reports
            </Button>
          )}
        </div>

        <Tabs
          value={selectedKey ? "viewer" : activeTopTab}
          onValueChange={(v) => {
            if (v !== "viewer") {
              setSelectedKey("");
              setSearchParams({});
              setActiveTopTab(v);
            }
          }}
        >
          <TabsList>
            <TabsTrigger value="catalog" className="gap-1.5">
              <FileBarChart2 className="w-4 h-4" />
              Report Catalog ({reports.length})
            </TabsTrigger>
            <TabsTrigger
              value="audit"
              className="gap-1.5"
              onClick={() => openReport("report-centre-audit-log", {})}
            >
              <History className="w-4 h-4" />
              Export Activity Log
            </TabsTrigger>
            {selectedKey && (
              <TabsTrigger value="viewer" className="gap-1.5">
                Active Report (#{activeReportMeta?.pageNumber || ""})
              </TabsTrigger>
            )}
          </TabsList>

          {/* Catalog View */}
          <TabsContent value="catalog" className="space-y-4 mt-4">
            <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
              <div className="relative w-full md:w-80">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <Input
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  placeholder="Search report name, module, or #..."
                  className="pl-9 h-9"
                />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {availableCategories.map((cat) => (
                  <Button
                    key={cat}
                    size="sm"
                    variant={activeCategory === cat ? "default" : "outline"}
                    className={`h-7 text-xs px-2.5 ${
                      activeCategory === cat
                        ? "bg-[#F7941E] hover:bg-[#e08212] text-white"
                        : "hover:border-orange-300"
                    }`}
                    onClick={() => setActiveCategory(cat)}
                  >
                    {cat}
                  </Button>
                ))}
              </div>
            </div>

            {catalogLoading ? (
              <div className="py-16 flex items-center justify-center text-muted-foreground gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-[#F7941E]" /> Loading catalog...
              </div>
            ) : filteredReports.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center text-sm text-muted-foreground">
                  No reports match your filter criteria.
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredReports.map((rep) => (
                  <Card
                    key={rep.key}
                    onClick={() => openReport(rep.key, {})}
                    className="cursor-pointer hover:border-[#F7941E] hover:shadow-md transition border-slate-200"
                  >
                    <CardContent className="p-4 flex flex-col justify-between h-full gap-2">
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100 text-[10px]">
                            {rep.module}
                          </Badge>
                          <span className="text-[11px] font-mono text-slate-400">
                            #{rep.pageNumber}
                          </span>
                        </div>
                        <h3 className="font-semibold text-sm text-slate-900">
                          {rep.title}
                        </h3>
                        <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                          {rep.purpose}
                        </p>
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px] text-[#F7941E] font-medium">
                        <span>Open Report</span>
                        <span>{(rep.filterSchema || []).length} filters</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Active Report Viewer */}
          {selectedKey && (
            <TabsContent value="viewer" className="mt-4">
              <ReportEngineView
                reportKey={selectedKey}
                initialFilters={initialFilters}
                onDrillDown={(targetKey, nextFilters) => openReport(targetKey, nextFilters)}
              />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default ReportCentre;
