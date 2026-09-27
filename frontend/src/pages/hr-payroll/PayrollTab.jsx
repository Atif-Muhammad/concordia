import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import PayrollManagementDialog from "@/components/PayrollManagementDialog";

export const PayrollTab = () => {
  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>Payroll Management</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <PayrollManagementDialog open={true} onOpenChange={() => {}} />
      </CardContent>
    </Card>
  );
};

export default PayrollTab;
