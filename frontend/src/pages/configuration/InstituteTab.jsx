import React, { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Building, Sun, Moon, Monitor, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  getInstituteSettings,
  updateInstituteSettings,
} from "@/services/api";
import usePermissions from "@/hooks/usePermissions";

export const InstituteTab = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { theme, setTheme } = useTheme();
  const { canUpdate } = usePermissions("Configuration", "institute");

  const [savingConfig, setSavingConfig] = useState(false);
  const [configForm, setConfigForm] = useState({
    instituteName: "",
    email: "",
    phone: "",
    address: "",
    facebook: "",
    instagram: "",
    logo: "",
    challanPrefix: "",
  });

  useEffect(() => {
    const loadInstituteSettings = async () => {
      try {
        const settings = await getInstituteSettings();
        if (settings) {
          setConfigForm({
            instituteName: settings.instituteName || "",
            email: settings.email || "",
            phone: settings.phone || "",
            address: settings.address || "",
            facebook: settings.facebook || "",
            instagram: settings.instagram || "",
            logo: settings.logo || "",
            challanPrefix: settings.challanPrefix || "",
          });
        }
      } catch (error) {
        console.error("Failed to fetch institute settings:", error);
        toast({
          title: "Error",
          description: error.message || "Failed to fetch institute settings",
          variant: "destructive",
        });
      }
    };
    loadInstituteSettings();
  }, [toast]);

  const handleConfigUpdate = async () => {
    setSavingConfig(true);
    try {
      await updateInstituteSettings(configForm);
      queryClient.invalidateQueries({ queryKey: ["instituteSettings"] });
      toast({
        title: "Configuration updated successfully",
      });
    } catch (error) {
      console.error("Failed to update institute settings:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to update configuration",
        variant: "destructive",
      });
    } finally {
      setSavingConfig(false);
    }
  };

  const renderButtonContent = (loading, loadingText, defaultContent) =>
    loading ? (
      <>
        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        {loadingText}
      </>
    ) : (
      defaultContent
    );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building className="w-5 h-5" />
          Institute Information
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>Appearance Mode</Label>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => setTheme("light")}
              className={cn(
                "rounded-lg border p-4 text-left transition-colors",
                theme === "light"
                  ? "border-primary bg-primary/10 ring-1 ring-primary/40"
                  : "border-border bg-card hover:bg-muted/50"
              )}
            >
              <Sun className="h-5 w-5 mb-2 text-amber-500" />
              <p className="text-sm font-semibold">Light</p>
              <p className="text-xs text-muted-foreground">Bright and clear</p>
            </button>
            <button
              type="button"
              onClick={() => setTheme("dark")}
              className={cn(
                "rounded-lg border p-4 text-left transition-colors",
                theme === "dark"
                  ? "border-primary bg-primary/10 ring-1 ring-primary/40"
                  : "border-border bg-card hover:bg-muted/50"
              )}
            >
              <Moon className="h-5 w-5 mb-2 text-indigo-500" />
              <p className="text-sm font-semibold">Dark</p>
              <p className="text-xs text-muted-foreground">Comfortable at night</p>
            </button>
            <button
              type="button"
              onClick={() => setTheme("system")}
              className={cn(
                "rounded-lg border p-4 text-left transition-colors",
                theme === "system"
                  ? "border-primary bg-primary/10 ring-1 ring-primary/40"
                  : "border-border bg-card hover:bg-muted/50"
              )}
            >
              <Monitor className="h-5 w-5 mb-2 text-emerald-500" />
              <p className="text-sm font-semibold">System</p>
              <p className="text-xs text-muted-foreground">Follow device setting</p>
            </button>
          </div>
        </div>
        <div>
          <Label>Institute Name</Label>
          <Input
            disabled={!canUpdate}
            value={configForm.instituteName}
            onChange={(e) =>
              setConfigForm({
                ...configForm,
                instituteName: e.target.value,
              })
            }
          />
        </div>
        <div>
          <Label>Email</Label>
          <Input
            type="email"
            disabled={!canUpdate}
            value={configForm.email}
            onChange={(e) =>
              setConfigForm({
                ...configForm,
                email: e.target.value,
              })
            }
          />
        </div>
        <div>
          <Label>Phone</Label>
          <Input
            disabled={!canUpdate}
            value={configForm.phone}
            onChange={(e) =>
              setConfigForm({
                ...configForm,
                phone: e.target.value,
              })
            }
          />
        </div>
        <div>
          <Label>Address</Label>
          <Textarea
            disabled={!canUpdate}
            value={configForm.address}
            onChange={(e) =>
              setConfigForm({
                ...configForm,
                address: e.target.value,
              })
            }
          />
        </div>
        <div>
          <Label>Facebook</Label>
          <Input
            disabled={!canUpdate}
            value={configForm.facebook}
            onChange={(e) =>
              setConfigForm({
                ...configForm,
                facebook: e.target.value,
              })
            }
          />
        </div>
        <div>
          <Label>Instagram</Label>
          <Input
            disabled={!canUpdate}
            value={configForm.instagram}
            onChange={(e) =>
              setConfigForm({
                ...configForm,
                instagram: e.target.value,
              })
            }
          />
        </div>
        <div>
          <Label>Challan Number Prefix</Label>
          <Input
            placeholder="e.g. CPC, HMS, PSH..."
            disabled={!canUpdate}
            value={configForm.challanPrefix}
            onChange={(e) =>
              setConfigForm({
                ...configForm,
                challanPrefix: e.target.value,
              })
            }
          />
          <p className="text-xs text-muted-foreground mt-1">
            Sets the prefix for generated challan numbers (e.g. CPC-000001)
          </p>
        </div>
        {canUpdate && (
          <Button onClick={handleConfigUpdate} disabled={savingConfig}>
            {renderButtonContent(savingConfig, "Saving...", "Save Configuration")}
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

export default InstituteTab;
