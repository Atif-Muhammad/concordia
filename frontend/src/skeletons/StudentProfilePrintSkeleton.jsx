import React from "react";
import { Skeleton } from "@/components/ui/skeleton";

export const StudentProfilePrintSkeleton = () => {
  return (
    <div className="max-w-[820px] mx-auto bg-white border border-slate-300 rounded-lg p-6 sm:p-8 shadow-sm space-y-6">
      {/* Header with Logo */}
      <div className="flex items-center justify-between border-b pb-4">
        <div className="flex items-center gap-4">
          <Skeleton className="h-16 w-16 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-56" />
            <Skeleton className="h-3.5 w-44" />
            <Skeleton className="h-3 w-36" />
          </div>
        </div>
        <Skeleton className="h-24 w-20 rounded border" />
      </div>

      {/* Form Title */}
      <div className="flex justify-between items-center py-2">
        <Skeleton className="h-6 w-64" />
        <Skeleton className="h-5 w-24" />
      </div>

      {/* Student Particulars Table Skeleton */}
      <div className="border rounded-md overflow-hidden space-y-0">
        <div className="bg-slate-100 p-2.5 border-b">
          <Skeleton className="h-4 w-36" />
        </div>
        <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-4">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-4 w-32" />
            </div>
          ))}
        </div>
      </div>

      {/* Documents Checklist Skeleton */}
      <div className="border rounded-md overflow-hidden space-y-0">
        <div className="bg-slate-100 p-2.5 border-b">
          <Skeleton className="h-4 w-44" />
        </div>
        <div className="p-4 grid grid-cols-2 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2">
              <Skeleton className="h-4 w-4 rounded" />
              <Skeleton className="h-3.5 w-36" />
            </div>
          ))}
        </div>
      </div>

      {/* Fee Installments Skeleton */}
      <div className="border rounded-md overflow-hidden space-y-0">
        <div className="bg-slate-100 p-2.5 border-b">
          <Skeleton className="h-4 w-48" />
        </div>
        <div className="p-4 space-y-2">
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-full" />
        </div>
      </div>
    </div>
  );
};

export default StudentProfilePrintSkeleton;
