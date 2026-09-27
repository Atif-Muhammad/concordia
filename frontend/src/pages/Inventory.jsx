import { useLocation } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { useQuery } from "@tanstack/react-query";
import {
    getSchoolInventoryItems,
    getInventoryExpenses,
} from "../../config/apis";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Package, DollarSign, TrendingUp, AlertCircle, Wrench } from "lucide-react";
import { getRouteSubmoduleId } from "@/lib/navigation.jsx";
import { InventoryItemsTab, InventoryExpensesTab } from "./inventory/index.js";

const Inventory = () => {
    const location = useLocation();
    const routeTab = getRouteSubmoduleId(location.pathname, "Inventory", "inventory");

    const { data: schoolInventory = [] } = useQuery({
        queryKey: ["schoolInventory"],
        queryFn: getSchoolInventoryItems
    });

    const { data: inventoryExpenses = [] } = useQuery({
        queryKey: ["inventoryExpenses"],
        queryFn: getInventoryExpenses
    });

    const totalInventoryValue = schoolInventory?.reduce((sum, item) => sum + item.totalValue, 0) || 0;
    const totalMaintenanceCost = inventoryExpenses?.reduce((sum, exp) => sum + exp.amount, 0) || 0;
    const totalItems = schoolInventory?.reduce((sum, item) => sum + item.quantity, 0) || 0;

    return (
        <DashboardLayout>
            <div className="space-y-6 max-w-full overflow-x-hidden">
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <h1 className="text-xl font-semibold flex items-center gap-2">
                            <Package className="w-8 h-8 text-primary" />
                            Inventory Management
                        </h1>
                        <p className="text-muted-foreground mt-1">
                            Track assets, assignments, and maintenance costs
                        </p>
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total Items</CardTitle>
                            <Package className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{totalItems}</div>
                            <p className="text-xs text-muted-foreground">{schoolInventory?.length || 0} unique items</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total Value</CardTitle>
                            <DollarSign className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">PKR {totalInventoryValue.toLocaleString()}</div>
                            <p className="text-xs text-muted-foreground">Combined asset value</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Maintenance Costs</CardTitle>
                            <TrendingUp className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">PKR {totalMaintenanceCost.toLocaleString()}</div>
                            <p className="text-xs text-muted-foreground">{inventoryExpenses?.length || 0} expenses recorded</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Need Attention</CardTitle>
                            <AlertCircle className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">
                                {schoolInventory?.filter(item => item.condition === "Needs Repair" || item.condition === "Damaged").length}
                            </div>
                            <p className="text-xs text-muted-foreground">Require repair</p>
                        </CardContent>
                    </Card>
                </div>

                <Tabs value={routeTab} className="space-y-4">
                    <TabsList className="hidden">
                        <TabsTrigger value="inventory">
                            <Package className="mr-2 h-4 w-4" />
                            Inventory Items
                        </TabsTrigger>
                        <TabsTrigger value="expenses">
                            <Wrench className="mr-2 h-4 w-4" />
                            Expenses
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="inventory" className="space-y-4">
                        <InventoryItemsTab />
                    </TabsContent>

                    <TabsContent value="expenses" className="space-y-4">
                        <InventoryExpensesTab />
                    </TabsContent>
                </Tabs>
            </div>
        </DashboardLayout>
    );
};

export default Inventory;
