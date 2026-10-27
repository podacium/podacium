export default function BiLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-slate-950 dark:to-slate-900 dark:text-slate-100 animate-pulse">
      <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm h-20 border-b border-gray-100 dark:border-slate-800" />
      <div className="absolute top-40 left-20 w-72 h-72 bg-blue-200/30 dark:bg-blue-800/80 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-40 right-20 w-72 h-72 bg-indigo-200/30 dark:bg-indigo-800/80 rounded-full blur-3xl pointer-events-none" />
      <div className="relative z-10 pt-32 pb-20 px-4 sm:px-6 lg:px-8 space-y-16">
        <div className="max-w-4xl mx-auto text-center space-y-6">
          <div className="h-16 w-3/4 bg-gradient-to-r from-gray-200 to-gray-300 rounded-2xl mx-auto" />
          <div className="h-8 w-1/2 bg-gradient-to-r from-gray-200 to-gray-300 rounded-xl mx-auto" />
          <div className="flex justify-center gap-4">
            <div className="h-14 w-40 bg-gradient-to-r from-blue-200 to-indigo-200 rounded-xl" />
            <div className="h-14 w-40 bg-gradient-to-r from-gray-200 to-gray-300 rounded-xl" />
          </div>
        </div>
        <div className="max-w-6xl mx-auto space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-slate-800/50 shadow-sm p-6 space-y-4"
              >
                <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-xl" />
                <div className="space-y-2">
                  <div className="h-5 bg-gradient-to-r from-gray-200 to-gray-300 rounded w-3/4" />
                  <div className="h-4 bg-gradient-to-r from-gray-200 to-gray-300 rounded w-full" />
                  <div className="h-4 bg-gradient-to-r from-gray-200 to-gray-300 rounded w-2/3" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
