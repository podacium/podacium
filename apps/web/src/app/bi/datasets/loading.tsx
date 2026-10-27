export default function BiDatasetsLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 animate-pulse">
      <div className="h-16 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800" />
      <div className="pt-32 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-8">
        <nav className="flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400">
          <div className="h-4 w-16 bg-gradient-to-r from-gray-200 to-gray-300 rounded" />
          <div className="h-4 w-4 bg-gradient-to-r from-gray-200 to-gray-300 rounded" />
          <div className="h-4 w-20 bg-gradient-to-r from-gray-200 to-gray-300 rounded" />
        </nav>
        <div className="flex items-center justify-between">
          <div className="h-10 w-40 bg-gradient-to-r from-gray-200 to-gray-300 rounded-lg" />
          <div className="h-10 w-32 bg-gradient-to-r from-blue-200 to-indigo-200 rounded-xl" />
        </div>
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-slate-800/50 shadow-sm p-4 flex items-center gap-4"
            >
              <div className="w-10 h-10 bg-gradient-to-br from-gray-200 to-gray-300 rounded-xl shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gradient-to-r from-gray-200 to-gray-300 rounded w-1/4" />
                <div className="h-3 bg-gradient-to-r from-gray-200 to-gray-300 rounded w-1/2" />
              </div>
              <div className="h-6 w-20 bg-gradient-to-r from-gray-200 to-gray-300 rounded-full" />
            </div>
          ))}
        </div>
      </div>
      <div className="h-64 bg-gray-50 dark:bg-slate-900/60" />
    </div>
  );
}
