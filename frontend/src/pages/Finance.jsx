import React from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, Sliders, ArrowRight, ArrowLeft } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { getRouteSubmoduleId } from "@/lib/navigation.jsx";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  FinanceDashboardTab,
  IncomeTab,
  ExpenseTab,
  FinanceReportsTab,
  ClosingTab,
  FinanceSettingsTab,
} from "./finance/index.js";

const Finance = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const activeTab = getRouteSubmoduleId(location.pathname, "Finance", "dashboard");
  const isSettings = activeTab === "settings";

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-full overflow-x-hidden">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
          <div>
            <h1 className="text-xl font-semibold flex items-center gap-2">
              <TrendingUp className="w-8 h-8 text-primary" />
              Finance Management
            </h1>
            <p className="text-muted-foreground mt-1">
              Track income, expenses, and financial reports
            </p>
          </div>

          {!isSettings ? (
            <Card
              className="cursor-pointer hover:border-primary/50 hover:shadow-sm transition-all bg-card p-3 flex items-center gap-3 border"
              onClick={() => navigate("/finance/settings")}
            >
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <Sliders className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-semibold">Settings</p>
                <p className="text-xs text-muted-foreground">Categories & Sub-categories</p>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground ml-2" />
            </Card>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => navigate("/finance/dashboard")}
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Dashboard
            </Button>
          )}
        </div>

        <Tabs value={activeTab}>
          <TabsList className="hidden">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="income">Income</TabsTrigger>
            <TabsTrigger value="expense">Expense</TabsTrigger>
            <TabsTrigger value="reports">Reports</TabsTrigger>
            <TabsTrigger value="closing">Closing</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-4">
            <FinanceDashboardTab />
          </TabsContent>

          <TabsContent value="income" className="space-y-4">
            <IncomeTab />
          </TabsContent>

          <TabsContent value="expense" className="space-y-4">
            <ExpenseTab />
          </TabsContent>

          <TabsContent value="reports" className="space-y-4">
            <FinanceReportsTab />
          </TabsContent>

          <TabsContent value="closing" className="space-y-4">
            <ClosingTab />
          </TabsContent>

          <TabsContent value="settings" className="space-y-4">
            <FinanceSettingsTab />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Finance;
