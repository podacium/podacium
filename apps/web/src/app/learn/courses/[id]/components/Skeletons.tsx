import React from "react";

export const CourseHeaderSkeleton: React.FC = () => (
  <div className="space-y-6">
    <div className="h-12 bg-gradient-to-r from-gray-200 to-gray-300 rounded-lg animate-pulse w-3/4" />
    <div className="h-6 bg-gray-200 dark:bg-slate-800/90 rounded-lg animate-pulse w-1/2" />
    <div className="h-4 bg-gray-200 dark:bg-slate-800/90 rounded-lg animate-pulse w-2/3" />
    <div className="flex flex-wrap gap-4">
      {[...Array(5)].map((_, i) => (
        <div
          key={i}
          className="h-10 bg-gray-200 dark:bg-slate-800/90 rounded-lg animate-pulse w-24"
        />
      ))}
    </div>
  </div>
);

export const CurriculumSkeleton: React.FC = () => (
  <div className="space-y-6">
    <div className="h-8 bg-gradient-to-r from-gray-200 to-gray-300 rounded-lg animate-pulse w-1/3" />
    <div className="space-y-4">
      {[...Array(5)].map((_, i) => (
        <div
          key={i}
          className="h-20 bg-gradient-to-br from-gray-100 to-gray-200 rounded-xl animate-pulse"
        />
      ))}
    </div>
  </div>
);

export const InstructorCardSkeleton: React.FC = () => (
  <div className="flex items-start space-x-4">
    <div className="w-16 h-16 bg-gradient-to-br from-gray-200 to-gray-300 rounded-full animate-pulse" />
    <div className="flex-1 space-y-3">
      <div className="h-6 bg-gradient-to-r from-gray-200 to-gray-300 rounded-lg animate-pulse w-1/2" />
      <div className="h-4 bg-gray-200 dark:bg-slate-800/90 rounded-lg animate-pulse w-3/4" />
      <div className="h-4 bg-gray-200 dark:bg-slate-800/90 rounded-lg animate-pulse w-full" />
    </div>
  </div>
);
