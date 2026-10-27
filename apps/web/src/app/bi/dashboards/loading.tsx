export default function BiDashboardsLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 animate-pulse">
      <div className="h-16 bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-slate-800" />
      <main className="pt-28 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-8">
        <nav className="flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400 mb-2">
          <div className="h-4 w-16 bg-gradient-to-r from-gray-200 to-gray-300 rounded" />
          <div className="h-4 w-4 bg-gradient-to-r from-gray-200 to-gray-300 rounded" />
          <div className="h-4 w-20 bg-gradient-to-r from-gray-200 to-gray-300 rounded" />
        </nav>
        <div className="h-10 w-48 bg-gradient-to-r from-gray-200 to-gray-300 rounded-lg" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-slate-800/50 shadow-sm p-6 space-y-3"
            >
              <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-xl" />
              <div className="h-4 bg-gradient-to-r from-gray-200 to-gray-300 rounded w-1/2" />
            </div>
          ))}
        </div>
        <div className="h-64 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-slate-800/50 shadow-sm p-6">
          <div className="h-4 bg-gradient-to-r from-gray-200 to-gray-300 rounded w-1/4 mb-6" />
          <div className="h-48 bg-gradient-to-br from-gray-100 to-blue-100/30 rounded-xl" />
        </div>
      </main>
    </div>
  );
}
