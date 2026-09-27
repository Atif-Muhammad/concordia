import React from "react";
import { useLocation } from "react-router-dom";
import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { getHostelRegistrations, getRooms, getInventoryItems } from "@/services/api";
import { getRouteSubmoduleId } from "@/lib/navigation.jsx";
import DashboardLayout from "@/components/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Home, Bed, Package } from "lucide-react";
import {
  RegistrationTab,
  RoomsTab,
  FeesTab,
  ExpensesTab,
  InventoryTab,
  RevenueReportsTab,
  SettingsTab,
} from "./boarding/index.js";

const Boarding = () => {
  const location = useLocation();
  const activeTab = getRouteSubmoduleId(location.pathname, "Boarding", "registration");

  const { data: regPages } = useInfiniteQuery({
    queryKey: ['hostelRegistrations', '', 'all', 'all'],
    queryFn: ({ pageParam = 1 }) => getHostelRegistrations({ page: pageParam, limit: 1 }),
    getNextPageParam: (lastPage) => lastPage.hasMore ? lastPage.page + 1 : undefined,
    initialPageParam: 1,
  });

  const { data: rooms = [] } = useQuery({
    queryKey: ['rooms'],
    queryFn: getRooms,
  });

  const { data: inventoryItems = [] } = useQuery({
    queryKey: ['inventoryItems'],
    queryFn: getInventoryItems,
  });

  const totalRegistrations = regPages?.pages[0]?.total ?? 0;
  const vacantRoomsCount = rooms.filter(r => r.status === "vacant").length;

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-full overflow-x-hidden">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-xl font-semibold flex items-center gap-2">
              <Home className="w-8 h-8 text-primary" />
              Boarding Management
            </h1>
            <p className="text-muted-foreground mt-1">
              Manage rooms, students, mess, and boarding finances
            </p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Registrations</CardTitle>
              <Home className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalRegistrations}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Available Rooms</CardTitle>
              <Bed className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{vacantRoomsCount} / {rooms.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Inventory</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{inventoryItems.length}</div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab}>
          <TabsList className="hidden">
            <TabsTrigger value="registration">Registration</TabsTrigger>
            <TabsTrigger value="rooms">Rooms</TabsTrigger>
            <TabsTrigger value="fees">Fees</TabsTrigger>
            <TabsTrigger value="expenses">Expenses</TabsTrigger>
            <TabsTrigger value="inventory">Inventory</TabsTrigger>
            <TabsTrigger value="revenue">Reports</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="registration">
            <RegistrationTab />
          </TabsContent>

          <TabsContent value="rooms">
            <RoomsTab />
          </TabsContent>

          <TabsContent value="fees">
            <FeesTab />
          </TabsContent>

          <TabsContent value="expenses">
            <ExpensesTab />
          </TabsContent>

          <TabsContent value="inventory">
            <InventoryTab />
          </TabsContent>

          <TabsContent value="revenue">
            <RevenueReportsTab />
          </TabsContent>

          <TabsContent value="settings">
            <SettingsTab />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Boarding;
