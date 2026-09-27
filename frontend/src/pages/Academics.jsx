import DashboardLayout from "@/components/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BookOpen } from "lucide-react";
import { useLocation } from "react-router-dom";
import { getRouteSubmoduleId } from "@/lib/navigation.jsx";
import {
  SessionsTab,
  ProgramsTab,
  ClassesTab,
  SectionsTab,
  SubjectsTab,
  SubjectClassMappingTab,
  TeacherClassMappingTab,
  TimetableTab,
  AssignmentsTab,
} from "./academics/index.js";

const Academics = () => {
  const location = useLocation();
  const routeTab = getRouteSubmoduleId(location.pathname, "Academics", "sessions");

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-full overflow-x-hidden">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-xl font-semibold flex items-center gap-2">
              <BookOpen className="w-8 h-8 text-primary" />
              Academics Management
            </h1>
            <p className="text-muted-foreground mt-1">
              Manage programs, classes, subjects, and timetables
            </p>
          </div>
        </div>

        <Tabs value={routeTab} className="space-y-6">
          <TabsList className="hidden">
            <TabsTrigger value="sessions">Sessions</TabsTrigger>
            <TabsTrigger value="programs">Programs</TabsTrigger>
            <TabsTrigger value="classes">Classes</TabsTrigger>
            <TabsTrigger value="sections">Sections</TabsTrigger>
            <TabsTrigger value="subjects">Subjects</TabsTrigger>
            <TabsTrigger value="scm">S-Class</TabsTrigger>
            <TabsTrigger value="classMapping">T-Class</TabsTrigger>
            <TabsTrigger value="timetable">Timetable</TabsTrigger>
            {/* <TabsTrigger value="assignments">Assignments</TabsTrigger> */}
          </TabsList>

          <TabsContent value="sessions">
            <SessionsTab />
          </TabsContent>

          <TabsContent value="timetable">
            <TimetableTab />
          </TabsContent>

          <TabsContent value="programs">
            <ProgramsTab />
          </TabsContent>

          <TabsContent value="classes">
            <ClassesTab />
          </TabsContent>

          <TabsContent value="sections">
            <SectionsTab />
          </TabsContent>

          <TabsContent value="subjects">
            <SubjectsTab />
          </TabsContent>

          <TabsContent value="scm">
            <SubjectClassMappingTab />
          </TabsContent>

          <TabsContent value="classMapping">
            <TeacherClassMappingTab />
          </TabsContent>

          <TabsContent value="assignments">
            <AssignmentsTab />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Academics;
