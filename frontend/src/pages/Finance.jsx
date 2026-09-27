import React from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp } from "lucide-react";
import { useLocation } from "react-router-dom";
import { getRouteSubmoduleId } from "@/lib/navigation.jsx";
import {
  FinanceDashboardTab,
  IncomeTab,
  ExpenseTab,
  FinanceReportsTab,
  ClosingTab,
} from "./finance/index.js";

const Finance = () => {
  const location = useLocation();
  const activeTab = getRouteSubmoduleId(location.pathname, "Finance", "dashboard");

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-full overflow-x-hidden">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-xl font-semibold flex items-center gap-2">
              <TrendingUp className="w-8 h-8 text-primary" />
              Finance Management
            </h1>
            <p className="text-muted-foreground mt-1">
              Track income, expenses, and financial reports
            </p>
          </div>
        </div>

        <Tabs value={activeTab}>
          <TabsList className="hidden">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="income">Income</TabsTrigger>
            <TabsTrigger value="expense">Expense</TabsTrigger>
            <TabsTrigger value="reports">Reports</TabsTrigger>
            <TabsTrigger value="closing">Closing</TabsTrigger>
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
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Finance;
