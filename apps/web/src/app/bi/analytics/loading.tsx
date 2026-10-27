export default function BiAnalyticsLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 animate-pulse">
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-100 dark:bg-indigo-950/60 rounded-full blur-3xl opacity-50" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-100 dark:bg-purple-950/60 rounded-full blur-3xl opacity-50" />
      </div>
      <div className="h-16 bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-slate-800" />
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-32 pb-16 space-y-12">
        <div className="text-center space-y-6">
          <div className="inline-flex h-7 w-48 items-center gap-2 px-4 py-1.5 rounded-full bg-blue-100 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800/80">
            <div className="w-4 h-4 bg-gradient-to-r from-blue-200 to-indigo-200 rounded-full" />
            <div className="h-3 w-20 bg-gradient-to-r from-blue-200 to-indigo-200 rounded" />
          </div>
          <div className="space-y-4">
            <div className="h-16 w-3/4 bg-gradient-to-r from-gray-200 to-gray-300 rounded-2xl mx-auto" />
            <div className="h-6 w-1/2 bg-gradient-to-r from-gray-200 to-gray-300 rounded-xl mx-auto" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-slate-800/50 shadow-sm p-6 space-y-3"
            >
              <div className="w-10 h-10 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-xl" />
              <div className="h-4 bg-gradient-to-r from-gray-200 to-gray-300 rounded w-2/3" />
              <div className="h-3 bg-gradient-to-r from-gray-200 to-gray-300 rounded w-1/2" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
