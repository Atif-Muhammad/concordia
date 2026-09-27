import { useLocation } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users } from "lucide-react";
import { getRouteSubmoduleId } from "@/lib/navigation.jsx";
import {
    StaffDirectoryTab,
    StaffSettingsTab,
    StaffAttendanceTab,
} from "./staff/index.js";

export default function Staff() {
    const location = useLocation();
    const activeTab = getRouteSubmoduleId(location.pathname, "Staff", "directory");

    return (
        <DashboardLayout>
            <div className="space-y-6">
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <h1 className="text-xl font-semibold flex items-center gap-2">
                            <Users className="w-8 h-8 text-primary" />
                            Staff Management
                        </h1>
                        <p className="text-muted-foreground mt-1">
                            Manage teaching and non-teaching staff members
                        </p>
                    </div>
                </div>

                <Tabs value={activeTab} className="space-y-6">
                    <TabsList className="hidden">
                        <TabsTrigger value="directory">Staff Directory</TabsTrigger>
                        <TabsTrigger value="settings">Settings</TabsTrigger>
                        <TabsTrigger value="attendance">Attendance</TabsTrigger>
                    </TabsList>

                    <TabsContent value="directory" className="space-y-6">
                        <StaffDirectoryTab />
                    </TabsContent>

                    <TabsContent value="settings" className="space-y-6">
                        <StaffSettingsTab />
                    </TabsContent>

                    <TabsContent value="attendance" className="space-y-6">
                        <StaffAttendanceTab />
                    </TabsContent>
                </Tabs>
            </div>
        </DashboardLayout>
    );
}
