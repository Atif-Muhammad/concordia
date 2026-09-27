import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText } from "lucide-react";

export default function AssignmentsTab() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="w-5 h-5" /> Assignments
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">
          Assignment management features coming soon.
        </p>
      </CardContent>
    </Card>
  );
}
