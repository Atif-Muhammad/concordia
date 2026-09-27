import React from "react";
import { useLocation } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings, Building, Shield, FileText, Wallet, History } from "lucide-react";
import { getRouteSubmoduleId } from "@/lib/navigation.jsx";
import {
  InstituteTab,
  AdminsTab,
  TemplatesTab,
  WalletsTab,
  ActivityLogsTab,
} from "./configuration/index.js";

const Configuration = () => {
  const location = useLocation();
  const routeTab = getRouteSubmoduleId(location.pathname, "Configuration", "institute");

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-full overflow-x-hidden">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-xl font-semibold flex items-center gap-2">
              <Settings className="w-8 h-8 text-primary" />
              System Configuration
            </h1>
            <p className="text-muted-foreground mt-1">
              Configure institute settings, users, and system preferences
            </p>
          </div>
        </div>

        <Tabs value={routeTab} className="space-y-6">
          <TabsList className="hidden">
            <TabsTrigger value="institute" className="gap-2">
              <Building className="w-4 h-4" />Institute
            </TabsTrigger>
            <TabsTrigger value="admins" className="gap-2">
              <Shield className="w-4 h-4" />Admins
            </TabsTrigger>
            <TabsTrigger value="templates" className="gap-2">
              <FileText className="w-4 h-4" />Templates
            </TabsTrigger>
            <TabsTrigger value="wallets" className="gap-2">
              <Wallet className="w-4 h-4" />Wallets / Accounts
            </TabsTrigger>
            <TabsTrigger value="logs" className="gap-2">
              <History className="w-4 h-4" />Activity Logs
            </TabsTrigger>
          </TabsList>

          <TabsContent value="institute">
            <InstituteTab />
          </TabsContent>

          <TabsContent value="admins">
            <AdminsTab />
          </TabsContent>

          <TabsContent value="templates">
            <TemplatesTab />
          </TabsContent>

          <TabsContent value="wallets">
            <WalletsTab />
          </TabsContent>

          <TabsContent value="logs">
            <ActivityLogsTab />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Configuration;
