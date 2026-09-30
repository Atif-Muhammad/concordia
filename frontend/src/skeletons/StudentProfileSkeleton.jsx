import React from "react";
import { Skeleton } from "@/components/ui/skeleton";

export const StudentProfileSkeleton = () => {
  return (
    <div className="space-y-6 py-2">
      {/* Top Profile Header */}
      <div className="flex items-start gap-4 mb-6">
        <Skeleton className="w-24 h-24 rounded-full shrink-0" />
        <div className="flex-1 space-y-2.5">
          <Skeleton className="h-7 w-48" />
          <div className="flex items-center gap-3">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-36" />
          </div>
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-5 w-44 rounded-full" />
        </div>
      </div>

      {/* Tabs Skeleton */}
      <div className="grid grid-cols-6 gap-1 bg-muted/60 p-1 rounded-lg">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-full rounded-md" />
        ))}
      </div>

      {/* Info Grid Skeleton */}
      <div className="border rounded-lg p-5 space-y-4">
        <Skeleton className="h-5 w-36 mb-2" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-5 w-3/4" />
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Summary Cards Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="border rounded-lg p-4 space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-6 w-32" />
          </div>
        ))}
      </div>
    </div>
  );
};

export default StudentProfileSkeleton;
