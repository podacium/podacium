export default function ProjectsLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-slate-950 dark:to-slate-900 dark:text-slate-100 animate-pulse">
      <div className="h-16 bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-slate-800" />
      <section className="relative pt-28 pb-16 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 overflow-hidden">
        <div className="absolute inset-0 bg-grid-blue-100/50 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))]" />
        <div className="max-w-8xl mx-auto relative z-10 space-y-6">
          <div className="h-8 w-48 bg-gradient-to-r from-blue-100/80 to-indigo-100/80 rounded-2xl mx-auto" />
          <div className="h-5 w-64 bg-gradient-to-r from-blue-100/80 to-indigo-100/80 rounded-xl mx-auto" />
        </div>
      </section>
      <div className="pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-8xl mx-auto -mt-8 space-y-6">
          <div className="flex gap-3 flex-wrap">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-10 w-28 bg-gradient-to-r from-gray-200 to-gray-300 rounded-lg"
              />
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-slate-800/50 shadow-sm p-6 space-y-4"
              >
                <div className="flex items-start justify-between">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-xl" />
                  <div className="h-7 w-16 bg-gradient-to-r from-gray-200 to-gray-300 rounded-full" />
                </div>
                <div className="h-4 bg-gradient-to-r from-gray-200 to-gray-300 rounded w-3/4" />
                <div className="space-y-2">
                  <div className="h-3 bg-gradient-to-r from-gray-200 to-gray-300 rounded w-full" />
                  <div className="h-3 bg-gradient-to-r from-gray-200 to-gray-300 rounded w-1/2" />
                </div>
                <div className="flex gap-2 pt-2">
                  {Array.from({ length: 3 }).map((_, j) => (
                    <div
                      key={j}
                      className="h-6 w-14 bg-gradient-to-r from-gray-200 to-gray-300 rounded-full"
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
