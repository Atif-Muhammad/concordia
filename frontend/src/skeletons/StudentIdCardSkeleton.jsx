import React from "react";
import { Skeleton } from "@/components/ui/skeleton";

export const StudentIdCardSkeleton = () => {
  return (
    <div className="flex flex-col items-center justify-center py-6">
      <div className="w-[340px] sm:w-[380px] border-2 rounded-xl p-5 bg-card shadow-md space-y-4">
        {/* Card Header */}
        <div className="flex items-center gap-3 border-b pb-3">
          <Skeleton className="h-10 w-10 rounded-full shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>

        {/* Card Center: Photo and Details */}
        <div className="flex flex-col items-center space-y-3 py-2">
          <Skeleton className="h-28 w-24 rounded-lg border-2" />
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-28" />
        </div>

        {/* Card Details Grid */}
        <div className="space-y-2 border-t pt-3 text-xs">
          <div className="flex justify-between items-center">
            <Skeleton className="h-3.5 w-20" />
            <Skeleton className="h-3.5 w-28" />
          </div>
          <div className="flex justify-between items-center">
            <Skeleton className="h-3.5 w-16" />
            <Skeleton className="h-3.5 w-32" />
          </div>
          <div className="flex justify-between items-center">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-3.5 w-24" />
          </div>
          <div className="flex justify-between items-center">
            <Skeleton className="h-3.5 w-14" />
            <Skeleton className="h-3.5 w-28" />
          </div>
        </div>

        {/* Card Footer Barcode */}
        <div className="border-t pt-3 flex flex-col items-center space-y-1">
          <Skeleton className="h-8 w-44" />
          <Skeleton className="h-2.5 w-24" />
        </div>
      </div>
    </div>
  );
};

export default StudentIdCardSkeleton;
