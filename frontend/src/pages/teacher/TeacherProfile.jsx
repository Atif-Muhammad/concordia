import React from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { Loader2, User, Mail, Phone, MapPin, Briefcase } from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import { userWho, refreshTokens } from '../../../config/apis';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const base_url = 'http://localhost:3003/api';

export default function TeacherProfile() {
  const { data: currentUser, isLoading: isUserLoading } = useQuery({
    queryKey: ['currentUser'],
    queryFn: async () => {
      try {
        const res = await userWho();
        return res;
      } catch (error) {
        if (error.response?.status === 401) {
          await refreshTokens();
          return userWho();
        }
        throw error;
      }
    },
  });

  const { data: staffData, isLoading: isStaffLoading } = useQuery({
    queryKey: ['staffProfile', currentUser?.refId],
    queryFn: async () => {
      const { data } = await axios.get(`${base_url}/staff/get/single?id=${currentUser?.refId}`, { withCredentials: true });
      return data;
    },
    enabled: !!currentUser?.refId,
  });

  if (isUserLoading || isStaffLoading) {
    return (
      <DashboardLayout>
        <div className="flex h-[50vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  const profile = staffData?.data;

  return (
    <DashboardLayout>
      <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
        <div className="flex items-center justify-between space-y-2">
          <h2 className="text-3xl font-bold tracking-tight">My Profile</h2>
        </div>
        
        {profile ? (
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="col-span-1">
              <CardHeader className="text-center pb-2">
                <div className="mx-auto bg-muted rounded-full w-24 h-24 flex items-center justify-center mb-4">
                  <User className="h-12 w-12 text-muted-foreground" />
                </div>
                <CardTitle>{profile.firstName} {profile.lastName}</CardTitle>
                <p className="text-sm text-muted-foreground">{profile.designation}</p>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 pt-4">
                  <div className="flex items-center text-sm">
                    <Mail className="mr-2 h-4 w-4 text-muted-foreground" />
                    {profile.email || 'N/A'}
                  </div>
                  <div className="flex items-center text-sm">
                    <Phone className="mr-2 h-4 w-4 text-muted-foreground" />
                    {profile.phone || 'N/A'}
                  </div>
                  <div className="flex items-center text-sm">
                    <MapPin className="mr-2 h-4 w-4 text-muted-foreground" />
                    {profile.address || 'N/A'}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="col-span-2">
              <CardHeader>
                <CardTitle>Professional Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-1">Employee ID</h4>
                    <p className="text-base font-medium">{profile.staffId || 'N/A'}</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-1">Department</h4>
                    <p className="text-base font-medium">{profile.department || 'N/A'}</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-1">Joining Date</h4>
                    <p className="text-base font-medium">
                      {profile.joiningDate ? new Date(profile.joiningDate).toLocaleDateString() : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-1">Employment Type</h4>
                    <p className="text-base font-medium">{profile.employmentType || 'Full Time'}</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-1">Qualification</h4>
                    <p className="text-base font-medium">{profile.qualification || 'N/A'}</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-1">Experience</h4>
                    <p className="text-base font-medium">{profile.experience || 'N/A'}</p>
                  </div>
                </div>

                {profile.payrollInfo && (
                  <div className="pt-4 border-t">
                    <h3 className="text-lg font-medium mb-4">Payroll Summary</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <h4 className="text-sm font-medium text-muted-foreground mb-1">Basic Salary</h4>
                        <p className="text-base font-medium">
                          {profile.payrollInfo.basicSalary ? `PKR ${profile.payrollInfo.basicSalary.toLocaleString()}` : 'N/A'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center h-[200px]">
              <AlertCircle className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-muted-foreground">Profile information not available.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
