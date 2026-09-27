import React from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageSquare } from "lucide-react";
import { useLocation } from "react-router-dom";
import { getRouteSubmoduleId } from "@/lib/navigation.jsx";
import {
  InquiryTab,
  VisitorTab,
  ComplaintTab,
  ContactsTab,
} from "./front-office/index.js";

const FrontOffice = () => {
  const location = useLocation();
  const routeTab = getRouteSubmoduleId(location.pathname, "Front Office", "inquiry");

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-full overflow-x-hidden">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-xl font-semibold flex items-center gap-2">
              <MessageSquare className="w-8 h-8 text-primary" />
              Front Office Management
            </h1>
            <p className="text-muted-foreground mt-1">
              Handle inquiries, visitors, complaints, and contacts
            </p>
          </div>
        </div>

        <Tabs value={routeTab} className="w-full">
          <TabsList className="hidden">
            <TabsTrigger value="inquiry">Inquiry</TabsTrigger>
            <TabsTrigger value="visitor">Visitor Book</TabsTrigger>
            <TabsTrigger value="complaint">Complaints</TabsTrigger>
            <TabsTrigger value="contacts">Contacts</TabsTrigger>
          </TabsList>

          <TabsContent value="inquiry" className="space-y-4">
            <InquiryTab />
          </TabsContent>

          <TabsContent value="visitor" className="space-y-4">
            <VisitorTab />
          </TabsContent>

          <TabsContent value="complaint" className="space-y-4">
            <ComplaintTab />
          </TabsContent>

          <TabsContent value="contacts" className="space-y-4">
            <ContactsTab />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default FrontOffice;
