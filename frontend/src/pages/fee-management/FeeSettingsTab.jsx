import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getNewFeeSettings, updateNewFeeSettings } from "@/services/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import usePermissions from "@/hooks/usePermissions";
import { Clock, CheckCircle2, Save, Loader2 } from "lucide-react";

export const FeeSettingsTab = ({
  instituteSettings = null,
  newFeeSettings: propFeeSettings = null,
}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { canUpdate } = usePermissions("Fee Management", "settings");

  // Form State
  const [lateFeeRatePerDay, setLateFeeRatePerDay] = useState(0);
  const [extraChallanLateFee, setExtraChallanLateFee] = useState(0);

  const { data: newFeeSettings, isLoading } = useQuery({
    queryKey: ['newFeeSettings'],
    queryFn: getNewFeeSettings,
    initialData: propFeeSettings || undefined,
  });

  useEffect(() => {
    const s = newFeeSettings || propFeeSettings;
    if (s) {
      if (s.lateFeeRatePerDay !== undefined) {
        setLateFeeRatePerDay(Number(s.lateFeeRatePerDay) || 0);
      } else if (s.lateFeeFinePerDay !== undefined) {
        setLateFeeRatePerDay(Number(s.lateFeeFinePerDay) || 0);
      } else if (instituteSettings?.lateFeeRatePerDay !== undefined) {
        setLateFeeRatePerDay(Number(instituteSettings.lateFeeRatePerDay) || 0);
      }

      if (s.extraChallanLateFee !== undefined) {
        setExtraChallanLateFee(Number(s.extraChallanLateFee) || 0);
      }
    }
  }, [newFeeSettings, propFeeSettings, instituteSettings]);

  const updateNewFeeSettingsMutation = useMutation({
    mutationFn: updateNewFeeSettings,
    onSuccess: () => {
      queryClient.invalidateQueries(['newFeeSettings']);
      queryClient.invalidateQueries(['instituteSettings']);
      queryClient.invalidateQueries(['feeChallans']);
      queryClient.invalidateQueries(['extraChallans']);
      queryClient.invalidateQueries(['installmentPlans']);
      queryClient.invalidateQueries(['students']);
      queryClient.invalidateQueries(['feeInstallments']);
      toast({
        title: "Fee settings saved successfully",
        description: "Updated late fee rates have been applied across all fee operations.",
      });
    },
    onError: (error) => toast({
      title: error.message || "Failed to update fee settings",
      variant: "destructive"
    }),
  });

  const handleSave = (e) => {
    if (e) e.preventDefault();
    updateNewFeeSettingsMutation.mutate({
      lateFeeRatePerDay: Number(lateFeeRatePerDay) || 0,
      extraChallanLateFee: Number(extraChallanLateFee) || 0,
    });
  };

  const isSaving = updateNewFeeSettingsMutation.isPending;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-card border rounded-lg p-4 shadow-sm">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
            Late Fee Rules & Configuration
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configure automated late fee accrual rates for regular tuition installments and extra challans.
          </p>
        </div>
        {canUpdate && (
          <Button
            onClick={handleSave}
            disabled={isSaving || isLoading}
            className="h-9 gap-1.5 shadow-sm text-xs font-semibold shrink-0"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Saving Changes...</span>
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                <span>Save Settings</span>
              </>
            )}
          </Button>
        )}
      </div>

      <div className="max-w-2xl">
        {/* Late Fee Configuration Card */}
        <Card className="shadow-sm border">
          <CardHeader className="pb-3 border-b bg-muted/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <CardTitle className="text-base font-semibold">Late Fee Rules</CardTitle>
                  <CardDescription className="text-xs">
                    Fine calculation rules applied to overdue installment challans and extra fees
                  </CardDescription>
                </div>
              </div>
              <Badge variant="outline" className="text-[10px] font-medium border-amber-300 bg-amber-50 text-amber-800">
                Auto-calculated
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="lateFeeRatePerDay" className="text-xs font-semibold text-foreground">
                Installment Late Fee Rate (PKR / Day)
              </Label>
              <div className="flex gap-2 items-center">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-2 text-xs font-medium text-muted-foreground">PKR</span>
                  <Input
                    id="lateFeeRatePerDay"
                    type="number"
                    min="0"
                    step="1"
                    className="pl-11 h-9 text-xs font-medium"
                    value={lateFeeRatePerDay}
                    onChange={(e) => setLateFeeRatePerDay(parseFloat(e.target.value) || 0)}
                    placeholder="e.g. 50"
                    disabled={!canUpdate || isSaving}
                  />
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Charged per overdue day for regular tuition fee installments once past the due date. Linked directly to monthly Challan generation and payment recording.
              </p>
            </div>

            <div className="space-y-1.5 pt-3 border-t">
              <Label htmlFor="extraChallanLateFee" className="text-xs font-semibold text-foreground">
                Extra Challan Late Fee Rate (PKR / Day)
              </Label>
              <div className="flex gap-2 items-center">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-2 text-xs font-medium text-muted-foreground">PKR</span>
                  <Input
                    id="extraChallanLateFee"
                    type="number"
                    min="0"
                    step="1"
                    className="pl-11 h-9 text-xs font-medium"
                    value={extraChallanLateFee}
                    onChange={(e) => setExtraChallanLateFee(parseFloat(e.target.value) || 0)}
                    placeholder="e.g. 20"
                    disabled={!canUpdate || isSaving}
                  />
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Charged per overdue day on non-tuition extra challans (Prospectus, Lab charges, Allied dues). Dynamically reflected in the Extra Challans table and payment dialogue.
              </p>
            </div>

            {canUpdate && (
              <div className="pt-2 flex justify-end">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleSave}
                  disabled={isSaving}
                  className="h-8 text-xs font-medium"
                >
                  Save Late Fee Rules
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Info Notice Banner */}
      <div className="bg-slate-50 dark:bg-slate-900 border rounded-lg p-3.5 flex items-start gap-3 text-xs text-muted-foreground max-w-2xl">
        <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
        <div className="space-y-1">
          <p className="font-semibold text-foreground">Integrated Late Fee & Arrears Engine</p>
          <p className="text-[11px] leading-relaxed">
            Changing the <strong>Installment Late Fee Rate</strong> or <strong>Extra Challan Late Fee Rate</strong> takes effect instantly across all active challan views. Overdue unpaid challans will automatically calculate and display the daily accrued fine, which is included in both the challan table and the payment collection dialog.
          </p>
        </div>
      </div>
    </div>
  );
};
