export default function MessagesLoading() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900/60 animate-pulse">
      <div className="h-16 bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-slate-800" />
      <div className="pt-24 pb-8 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <div className="mb-6 space-y-2">
          <div className="h-8 w-48 bg-gradient-to-r from-gray-200 to-gray-300 rounded-lg" />
          <div className="h-4 w-64 bg-gradient-to-r from-gray-200 to-gray-300 rounded" />
        </div>
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-slate-800/50 shadow-sm p-6">
          <div className="flex gap-4 h-96">
            <div className="w-72 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="h-14 bg-gradient-to-r from-gray-100 to-gray-200 rounded-xl"
                />
              ))}
            </div>
            <div className="flex-1 bg-gradient-to-br from-gray-100 to-gray-200 rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  );
}
