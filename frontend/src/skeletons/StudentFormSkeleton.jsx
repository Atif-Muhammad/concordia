import React from "react";
import { Skeleton } from "@/components/ui/skeleton";

export const StudentFormSkeleton = () => {
  return (
    <div className="space-y-6 py-2">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Left Photo Skeleton */}
        <div className="md:col-span-1 flex flex-col items-center justify-start space-y-3 pt-2">
          <Skeleton className="w-32 h-32 rounded-full" />
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-3 w-36" />
        </div>

        {/* Right Form Fields Skeleton */}
        <div className="md:col-span-3 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-10 w-full" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-10 w-full" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-10 w-full" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-10 w-full" />
            </div>
          </div>
        </div>
      </div>

      {/* Additional / Fee Section Skeleton */}
      <div className="border rounded-lg p-4 space-y-3">
        <div className="flex justify-between items-center">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-8 w-24" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          <Skeleton className="h-12 w-full rounded" />
          <Skeleton className="h-12 w-full rounded" />
          <Skeleton className="h-12 w-full rounded" />
          <Skeleton className="h-12 w-full rounded" />
        </div>
      </div>

      {/* Actions footer */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <Skeleton className="h-10 w-24" />
        <Skeleton className="h-10 w-32" />
      </div>
    </div>
  );
};

export default StudentFormSkeleton;
