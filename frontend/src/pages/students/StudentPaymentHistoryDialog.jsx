import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";

export const StudentPaymentHistoryDialog = ({
  open,
  onOpenChange,
  challan,
}) => {
  let history = [];
  if (challan?.paymentHistory) {
    try {
      history = typeof challan.paymentHistory === "string"
        ? JSON.parse(challan.paymentHistory)
        : challan.paymentHistory;
    } catch {
      history = [];
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Transaction History - {challan?.challanNumber}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="py-2 px-3 text-sm w-[120px]">Date</TableHead>
                  <TableHead className="py-2 px-3 text-sm">Received</TableHead>
                  <TableHead className="py-2 px-3 text-sm">Discount</TableHead>
                  <TableHead className="py-2 px-3 text-sm">Method</TableHead>
                  <TableHead className="py-2 px-3 text-sm">Remarks</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!Array.isArray(history) || history.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-2 px-3 text-sm text-center py-8 text-muted-foreground">
                      No transaction history found.
                    </TableCell>
                  </TableRow>
                ) : (
                  history.map((entry, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="py-2 px-3 text-sm text-xs">
                        {new Date(entry.date).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="py-2 px-3 text-sm font-bold text-green-600">
                        PKR {Math.round(entry.amount).toLocaleString()}
                      </TableCell>
                      <TableCell className="py-2 px-3 text-sm font-bold text-orange-600">
                        PKR {Math.round(entry.discount || 0).toLocaleString()}
                      </TableCell>
                      <TableCell className="py-2 px-3 text-sm text-xs">
                        {entry.method || "Cash"}
                      </TableCell>
                      <TableCell className="py-2 px-3 text-sm text-xs italic">
                        {entry.remarks || "-"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <div className="flex justify-end pt-2">
            <Button onClick={() => onOpenChange(false)}>Close</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default StudentPaymentHistoryDialog;
