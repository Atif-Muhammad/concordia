import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import LeavesManagementDialog from "@/components/LeavesManagementDialog";

export const LeavesTab = () => {
  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>Leaves Management</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <LeavesManagementDialog />
      </CardContent>
    </Card>
  );
};

export default LeavesTab;
