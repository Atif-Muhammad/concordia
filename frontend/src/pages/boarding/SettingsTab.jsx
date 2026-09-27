import React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import usePermissions from "@/hooks/usePermissions";
import { getInstituteSettings, updateInstituteSettings } from "@/services/api";

export const SettingsTab = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { canUpdate } = usePermissions("Boarding", "settings");

  const { data: instituteSettings } = useQuery({
    queryKey: ['instituteSettings'],
    queryFn: getInstituteSettings,
    staleTime: 5 * 60 * 1000,
  });

  const hostelLateFee = instituteSettings?.hostelLateFee ?? 0;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Boarding Fee Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 max-w-sm">
          <div className="space-y-1.5">
            <Label>Late Fee Fine (PKR per day)</Label>
            <p className="text-xs text-muted-foreground">
              Applied automatically when a challan's due date has passed. Amount × overdue days = late fee.
            </p>
            <div className="flex gap-2">
              <Input
                type="number"
                min={0}
                placeholder="0"
                defaultValue={hostelLateFee}
                key={hostelLateFee}
                id="hostelLateFeeInput"
                disabled={!canUpdate}
              />
              {canUpdate && (
                <Button onClick={async () => {
                  const val = Number(document.getElementById('hostelLateFeeInput').value) || 0;
                  try {
                    await updateInstituteSettings({ hostelLateFee: val });
                    queryClient.invalidateQueries({ queryKey: ['instituteSettings'] });
                    toast({ title: "Settings saved" });
                  } catch (e) {
                    toast({ title: e.message || "Failed to save", variant: "destructive" });
                  }
                }}>Save</Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
