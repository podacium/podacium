"use client";

import React from "react";

type SkeletonVariant =
  "card" | "list" | "stats" | "detail" | "table" | "activity";

interface HubSkeletonProps {
  variant: SkeletonVariant;
  count?: number;
  className?: string;
}

const CardSkeleton: React.FC<{ height?: string }> = ({ height = "h-64" }) => (
  <div
    className={`animate-pulse bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-slate-800/50 shadow-sm p-6 ${height}`}
  >
    <div className="flex items-start justify-between mb-4">
      <div className="w-3/4 h-6 bg-gradient-to-r from-gray-200 to-gray-300 rounded" />
      <div className="w-16 h-6 bg-gray-200 dark:bg-slate-800/90 rounded" />
    </div>
    <div className="h-4 bg-gray-200 dark:bg-slate-800/90 rounded mb-3" />
    <div className="h-3 bg-gray-200 dark:bg-slate-800/90 rounded mb-3 w-2/3" />
    <div className="flex flex-wrap gap-2 mb-4">
      <div className="w-16 h-6 bg-gray-200 dark:bg-slate-800/90 rounded" />
      <div className="w-20 h-6 bg-gray-200 dark:bg-slate-800/90 rounded" />
    </div>
    <div className="flex items-center justify-between mt-4">
      <div className="flex items-center space-x-2">
        <div className="w-8 h-8 bg-gray-200 dark:bg-slate-800/90 rounded-full" />
        <div className="w-20 h-4 bg-gray-200 dark:bg-slate-800/90 rounded" />
      </div>
      <div className="w-24 h-10 bg-gray-200 dark:bg-slate-800/90 rounded-lg" />
    </div>
  </div>
);

const FreelancerCardSkeleton: React.FC = () => (
  <div className="animate-pulse bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-slate-800/50 shadow-sm p-6 h-72">
    <div className="flex items-center space-x-4 mb-4">
      <div className="w-16 h-16 bg-gradient-to-br from-gray-200 to-gray-300 rounded-full" />
      <div className="flex-1">
        <div className="h-6 bg-gradient-to-r from-gray-200 to-gray-300 rounded mb-2" />
        <div className="h-4 bg-gray-200 dark:bg-slate-800/90 rounded w-3/4" />
      </div>
    </div>
    <div className="h-4 bg-gray-200 dark:bg-slate-800/90 rounded mb-3" />
    <div className="flex flex-wrap gap-2 mb-4">
      <div className="w-16 h-6 bg-gray-200 dark:bg-slate-800/90 rounded" />
      <div className="w-20 h-6 bg-gray-200 dark:bg-slate-800/90 rounded" />
      <div className="w-14 h-6 bg-gray-200 dark:bg-slate-800/90 rounded" />
    </div>
    <div className="grid grid-cols-3 gap-4 mb-4">
      <div className="text-center">
        <div className="h-6 bg-gray-200 dark:bg-slate-800/90 rounded mb-1" />
        <div className="h-4 bg-gray-200 dark:bg-slate-800/90 rounded w-full" />
      </div>
      <div className="text-center">
        <div className="h-6 bg-gray-200 dark:bg-slate-800/90 rounded mb-1" />
        <div className="h-4 bg-gray-200 dark:bg-slate-800/90 rounded w-full" />
      </div>
      <div className="text-center">
        <div className="h-6 bg-gray-200 dark:bg-slate-800/90 rounded mb-1" />
        <div className="h-4 bg-gray-200 dark:bg-slate-800/90 rounded w-full" />
      </div>
    </div>
    <div className="h-10 bg-gray-200 dark:bg-slate-800/90 rounded-lg" />
  </div>
);

const ListSkeleton: React.FC = () => (
  <div className="animate-pulse bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-slate-800/50 shadow-sm p-6">
    <div className="flex items-start justify-between">
      <div className="flex-1 min-w-0">
        <div className="flex items-center space-x-4 mb-4">
          <div className="w-12 h-12 bg-gradient-to-br from-gray-200 to-gray-300 rounded-xl" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <div className="w-48 h-6 bg-gradient-to-r from-gray-200 to-gray-300 rounded" />
              <div className="w-20 h-6 bg-gray-200 dark:bg-slate-800/90 rounded-full" />
            </div>
            <div className="w-full h-4 bg-gray-200 dark:bg-slate-800/90 rounded mt-2" />
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          <div className="space-y-1">
            <div className="w-16 h-3 bg-gray-200 dark:bg-slate-800/90 rounded" />
            <div className="w-24 h-4 bg-gray-200 dark:bg-slate-800/90 rounded" />
          </div>
          <div className="space-y-1">
            <div className="w-16 h-3 bg-gray-200 dark:bg-slate-800/90 rounded" />
            <div className="w-32 h-4 bg-gray-200 dark:bg-slate-800/90 rounded" />
          </div>
          <div className="space-y-1">
            <div className="w-16 h-3 bg-gray-200 dark:bg-slate-800/90 rounded" />
            <div className="w-20 h-4 bg-gray-200 dark:bg-slate-800/90 rounded" />
          </div>
          <div className="space-y-1">
            <div className="w-16 h-3 bg-gray-200 dark:bg-slate-800/90 rounded" />
            <div className="w-24 h-4 bg-gray-200 dark:bg-slate-800/90 rounded" />
          </div>
        </div>
        <div className="flex items-center justify-between mt-6 pt-6 border-t border-gray-200/50 dark:border-slate-800/50">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gray-200 dark:bg-slate-800/90 rounded-full" />
              <div>
                <div className="w-12 h-3 bg-gray-200 dark:bg-slate-800/90 rounded mb-1" />
                <div className="w-16 h-3 bg-gray-200 dark:bg-slate-800/90 rounded" />
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gray-200 dark:bg-slate-800/90 rounded-full" />
              <div>
                <div className="w-12 h-3 bg-gray-200 dark:bg-slate-800/90 rounded mb-1" />
                <div className="w-16 h-3 bg-gray-200 dark:bg-slate-800/90 rounded" />
              </div>
            </div>
          </div>
          <div className="w-24 h-6 bg-gray-200 dark:bg-slate-800/90 rounded" />
        </div>
      </div>
    </div>
  </div>
);

const StatsSkeleton: React.FC = () => (
  <div className="animate-pulse bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-slate-800/50 shadow-sm p-6">
    <div className="flex items-start justify-between mb-4">
      <div className="w-12 h-12 bg-gradient-to-br from-gray-200 to-gray-300 rounded-xl" />
      <div className="w-16 h-6 bg-gray-200 dark:bg-slate-800/90 rounded-lg" />
    </div>
    <div className="space-y-2">
      <div className="h-8 bg-gradient-to-r from-gray-200 to-gray-300 rounded-lg" />
      <div className="h-4 bg-gray-200 dark:bg-slate-800/90 rounded-lg w-3/4" />
    </div>
  </div>
);

const ActivitySkeleton: React.FC = () => (
  <div className="flex items-start space-x-4 p-4 border-b border-gray-200/50 dark:border-slate-800/50 last:border-b-0">
    <div className="w-10 h-10 bg-gradient-to-br from-gray-200 to-gray-300 rounded-lg" />
    <div className="flex-1 space-y-2">
      <div className="flex justify-between">
        <div className="w-32 h-5 bg-gradient-to-r from-gray-200 to-gray-300 rounded" />
        <div className="w-16 h-4 bg-gray-200 dark:bg-slate-800/90 rounded" />
      </div>
      <div className="w-full h-4 bg-gray-200 dark:bg-slate-800/90 rounded" />
      <div className="w-2/3 h-3 bg-gray-200 dark:bg-slate-800/90 rounded" />
    </div>
  </div>
);

const DetailSkeleton: React.FC = () => (
  <div className="animate-pulse bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-slate-800/50 shadow-sm p-6 h-80">
    <div className="flex justify-between items-start mb-4">
      <div className="w-20 h-6 bg-gradient-to-r from-gray-200 to-gray-300 rounded-full" />
      <div className="w-12 h-4 bg-gray-200 dark:bg-slate-800/90 rounded" />
    </div>
    <div className="space-y-3 mb-6">
      <div className="h-6 bg-gradient-to-r from-gray-200 to-gray-300 rounded" />
      <div className="h-4 bg-gray-200 dark:bg-slate-800/90 rounded" />
      <div className="h-3 bg-gray-200 dark:bg-slate-800/90 rounded w-2/3" />
    </div>
    <div className="space-y-4 mb-6">
      <div className="flex justify-between">
        <div className="w-16 h-4 bg-gray-200 dark:bg-slate-800/90 rounded" />
        <div className="w-20 h-4 bg-gray-200 dark:bg-slate-800/90 rounded" />
      </div>
      <div className="flex justify-between">
        <div className="w-16 h-4 bg-gray-200 dark:bg-slate-800/90 rounded" />
        <div className="w-24 h-4 bg-gray-200 dark:bg-slate-800/90 rounded" />
      </div>
    </div>
    <div className="pt-6 border-t border-gray-200/50 dark:border-slate-800/50">
      <div className="flex justify-between mb-4">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-gray-200 dark:bg-slate-800/90 rounded-full" />
          <div>
            <div className="w-12 h-3 bg-gray-200 dark:bg-slate-800/90 rounded mb-1" />
            <div className="w-16 h-3 bg-gray-200 dark:bg-slate-800/90 rounded" />
          </div>
        </div>
      </div>
      <div className="w-full h-10 bg-gray-200 dark:bg-slate-800/90 rounded-xl" />
    </div>
  </div>
);

const TableSkeleton: React.FC = () => (
  <div className="space-y-4">
    {[...Array(5)].map((_, i) => (
      <div key={i} className="animate-pulse">
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-slate-800/50 shadow-sm p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="w-3/4 h-6 bg-gradient-to-r from-gray-200 to-gray-300 rounded" />
            <div className="w-16 h-6 bg-gray-200 dark:bg-slate-800/90 rounded" />
          </div>
          <div className="h-4 bg-gray-200 dark:bg-slate-800/90 rounded mb-3" />
          <div className="h-3 bg-gray-200 dark:bg-slate-800/90 rounded mb-3 w-2/3" />
          <div className="flex items-center justify-between mt-4">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gray-200 dark:bg-slate-800/90 rounded-full" />
              <div className="w-20 h-4 bg-gray-200 dark:bg-slate-800/90 rounded" />
            </div>
            <div className="w-24 h-10 bg-gray-200 dark:bg-slate-800/90 rounded-lg" />
          </div>
        </div>
      </div>
    ))}
  </div>
);

const GridContainer: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
    {children}
  </div>
);

const ListContainer: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => <div className="space-y-4">{children}</div>;

const ActivityContainer: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => (
  <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-slate-800/50 shadow-sm overflow-hidden">
    {children}
  </div>
);

export const HubSkeleton: React.FC<HubSkeletonProps> = ({
  variant,
  count = 6,
  className = "",
}) => {
  const items = Array.from({ length: count }, (_, i) => i);

  switch (variant) {
    case "card":
      return (
        <div className={className}>
          <GridContainer>
            {items.map((i) => (
              <CardSkeleton key={i} />
            ))}
          </GridContainer>
        </div>
      );
    case "list":
      return (
        <div className={className}>
          <ListContainer>
            {items.map((i) => (
              <ListSkeleton key={i} />
            ))}
          </ListContainer>
        </div>
      );
    case "stats":
      return (
        <div
          className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 ${className}`}
        >
          {items.slice(0, 4).map((i) => (
            <StatsSkeleton key={i} />
          ))}
        </div>
      );
    case "detail":
      return (
        <div className={className}>
          <GridContainer>
            {items.slice(0, Math.min(count, 6)).map((i) => (
              <DetailSkeleton key={i} />
            ))}
          </GridContainer>
        </div>
      );
    case "table":
      return (
        <div className={className}>
          <TableSkeleton />
        </div>
      );
    case "activity":
      return (
        <div className={className}>
          <ActivityContainer>
            {items.slice(0, Math.min(count, 5)).map((i) => (
              <ActivitySkeleton key={i} />
            ))}
          </ActivityContainer>
        </div>
      );
    default:
      return null;
  }
};

export default HubSkeleton;
