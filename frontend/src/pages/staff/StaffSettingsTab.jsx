import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    getStaffIdSettingsAPI,
    updateStaffIdSettingsAPI,
} from "../../../config/apis";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import usePermissions from "@/hooks/usePermissions";

export default function StaffSettingsTab() {
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const { canUpdate } = usePermissions("Staff", "settings");

    const [staffIdSettingsForm, setStaffIdSettingsForm] = useState({
        teachingPrefix: "",
        nonTeachingPrefix: "",
        dualPrefix: "",
        supportingPrefix: "",
    });

    const { data: staffIdSettings } = useQuery({
        queryKey: ["staffIdSettings"],
        queryFn: getStaffIdSettingsAPI,
    });

    useEffect(() => {
        if (!staffIdSettings) return;
        setStaffIdSettingsForm({
            teachingPrefix: staffIdSettings.teachingPrefix || "",
            nonTeachingPrefix: staffIdSettings.nonTeachingPrefix || "",
            dualPrefix: staffIdSettings.dualPrefix || "",
            supportingPrefix: staffIdSettings.supportingPrefix || "",
        });
    }, [staffIdSettings]);

    const updateStaffIdSettingsMutation = useMutation({
        mutationFn: updateStaffIdSettingsAPI,
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ["staffIdSettings"] });
            setStaffIdSettingsForm({
                teachingPrefix: data?.teachingPrefix || "",
                nonTeachingPrefix: data?.nonTeachingPrefix || "",
                dualPrefix: data?.dualPrefix || "",
                supportingPrefix: data?.supportingPrefix || "",
            });
            toast({ title: "Staff ID settings updated successfully" });
        },
        onError: (error) => {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        },
    });

    const handleSaveStaffIdSettings = () => {
        updateStaffIdSettingsMutation.mutate({
            teachingPrefix: staffIdSettingsForm.teachingPrefix,
            nonTeachingPrefix: staffIdSettingsForm.nonTeachingPrefix,
            dualPrefix: staffIdSettingsForm.dualPrefix,
            supportingPrefix: staffIdSettingsForm.supportingPrefix,
        });
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Staff ID Settings</CardTitle>
                    <p className="text-sm text-muted-foreground">
                        Configure prefixes for Teaching, Non-Teaching, Dual-role, and Supporting Staff IDs.
                    </p>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                            <Label>Teaching Prefix</Label>
                            <Input
                                value={staffIdSettingsForm.teachingPrefix}
                                onChange={(e) =>
                                    setStaffIdSettingsForm((prev) => ({ ...prev, teachingPrefix: e.target.value }))
                                }
                                placeholder="PSH-TCR-"
                                disabled={!canUpdate}
                            />
                        </div>
                        <div>
                            <Label>Non-Teaching Prefix</Label>
                            <Input
                                value={staffIdSettingsForm.nonTeachingPrefix}
                                onChange={(e) =>
                                    setStaffIdSettingsForm((prev) => ({ ...prev, nonTeachingPrefix: e.target.value }))
                                }
                                placeholder="PSH-NT-"
                                disabled={!canUpdate}
                            />
                        </div>
                        <div>
                            <Label>Dual Role Prefix</Label>
                            <Input
                                value={staffIdSettingsForm.dualPrefix}
                                onChange={(e) =>
                                    setStaffIdSettingsForm((prev) => ({ ...prev, dualPrefix: e.target.value }))
                                }
                                placeholder="PSH-DUAL-"
                                disabled={!canUpdate}
                            />
                        </div>
                        <div>
                            <Label>Supporting Staff Prefix</Label>
                            <Input
                                value={staffIdSettingsForm.supportingPrefix}
                                onChange={(e) =>
                                    setStaffIdSettingsForm((prev) => ({ ...prev, supportingPrefix: e.target.value }))
                                }
                                placeholder="SS-"
                                disabled={!canUpdate}
                            />
                        </div>
                    </div>
                    {canUpdate && (
                        <div className="flex justify-end">
                            <Button
                                onClick={handleSaveStaffIdSettings}
                                disabled={!canUpdate || updateStaffIdSettingsMutation.isPending}
                            >
                                {updateStaffIdSettingsMutation.isPending && (
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                )}
                                {updateStaffIdSettingsMutation.isPending ? "Saving..." : "Save Settings"}
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
