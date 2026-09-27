import React from "react";
import { useLocation } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, BookOpen, Award, Trophy } from "lucide-react";
import { getRouteSubmoduleId } from "@/lib/navigation.jsx";
import {
  ExamsTab,
  MarksEntryTab,
  ResultsTab,
  PositionsTab,
} from "./examination/index.js";

const Examination = () => {
  const location = useLocation();
  const routeTab = getRouteSubmoduleId(location.pathname, "Examination", "exams");

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-full overflow-x-hidden">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-xl font-semibold flex items-center gap-2">
              <FileText className="w-8 h-8 text-primary" />
              Examination Management
            </h1>
            <p className="text-muted-foreground mt-1">
              Create exams, enter marks, and generate results
            </p>
          </div>
        </div>

        <Tabs value={routeTab} className="space-y-6">
          <TabsList className="hidden">
            <TabsTrigger value="exams" className="gap-2">
              <BookOpen className="w-4 h-4" />Exams
            </TabsTrigger>
            <TabsTrigger value="marks" className="gap-2">
              <FileText className="w-4 h-4" />Marks Entry
            </TabsTrigger>
            <TabsTrigger value="results" className="gap-2">
              <Award className="w-4 h-4" />Results
            </TabsTrigger>
            <TabsTrigger value="positions" className="gap-2">
              <Trophy className="w-4 h-4" />Positions
            </TabsTrigger>
          </TabsList>

          <TabsContent value="exams">
            <ExamsTab />
          </TabsContent>

          <TabsContent value="marks">
            <MarksEntryTab />
          </TabsContent>

          <TabsContent value="results">
            <ResultsTab />
          </TabsContent>

          <TabsContent value="positions">
            <PositionsTab />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Examination;
