export default function BiReportsLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 animate-pulse">
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-100 dark:bg-indigo-950/60 dark:bg-indigo-900/50 rounded-full blur-3xl opacity-50" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-100 dark:bg-purple-950/60 dark:bg-purple-900/50 rounded-full blur-3xl opacity-50" />
      </div>
      <div className="h-16 bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-slate-800" />
      <div className="relative z-10 pt-24 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-8">
        <nav className="flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400">
          <div className="h-4 w-16 bg-gradient-to-r from-gray-200 to-gray-300 rounded" />
          <div className="h-4 w-4 bg-gradient-to-r from-gray-200 to-gray-300 rounded" />
          <div className="h-4 w-24 bg-gradient-to-r from-gray-200 to-gray-300 rounded" />
        </nav>
        <div className="h-10 w-48 bg-gradient-to-r from-gray-200 to-gray-300 rounded-lg" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-slate-800/50 shadow-sm p-6 space-y-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-gray-200 to-gray-300 rounded-xl shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gradient-to-r from-gray-200 to-gray-300 rounded w-1/2" />
                  <div className="h-3 bg-gradient-to-r from-gray-200 to-gray-300 rounded w-1/3" />
                </div>
              </div>
              <div className="h-24 bg-gradient-to-br from-gray-100 to-gray-200 rounded-xl" />
            </div>
          ))}
        </div>
      </div>
      <div className="h-32 bg-gray-50 dark:bg-slate-900/60" />
    </div>
  );
}
