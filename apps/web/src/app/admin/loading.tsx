export default function AdminLoading() {
  return (
    <div className="min-h-screen bg-background p-8 animate-pulse">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="h-10 w-48 bg-gray-200 dark:bg-slate-800/90 rounded-lg" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="h-28 bg-gray-100 dark:bg-slate-800 rounded-2xl"
            />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-64 bg-gray-100 dark:bg-slate-800 rounded-2xl" />
          <div className="h-64 bg-gray-100 dark:bg-slate-800 rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
