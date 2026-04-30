export default function Loading() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: '#FAFAF8' }}>
      <div className="h-14 bg-white border-b border-gray-200" />
      <div className="page-container animate-pulse">
        <div className="flex gap-6 items-start">
          <div className="flex-1 min-w-0">
            <div className="mb-6">
              <div className="h-4 w-48 bg-gray-200 rounded mb-3" />
              <div className="h-8 w-3/4 bg-gray-200 rounded mb-2" />
              <div className="flex gap-2">
                <div className="h-5 w-20 bg-gray-200 rounded-full" />
                <div className="h-5 w-16 bg-gray-200 rounded-full" />
                <div className="h-5 w-28 bg-gray-200 rounded-full" />
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-6 mb-6">
              <div className="grid grid-cols-2 gap-4 mb-5">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i}>
                    <div className="h-3 w-20 bg-gray-100 rounded mb-1" />
                    <div className="h-4 w-32 bg-gray-200 rounded" />
                  </div>
                ))}
              </div>
              <div className="h-px bg-gray-100 mb-4" />
              <div className="space-y-2">
                <div className="h-3 w-full bg-gray-100 rounded" />
                <div className="h-3 w-5/6 bg-gray-100 rounded" />
                <div className="h-3 w-4/6 bg-gray-100 rounded" />
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-6">
              <div className="h-5 w-32 bg-gray-200 rounded mb-4" />
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex gap-3 mb-4">
                  <div className="h-8 w-8 bg-gray-200 rounded-full shrink-0" />
                  <div className="flex-1">
                    <div className="h-3 w-24 bg-gray-200 rounded mb-2" />
                    <div className="h-12 bg-gray-100 rounded-lg" />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="w-64 shrink-0">
            <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i}>
                  <div className="h-3 w-20 bg-gray-100 rounded mb-2" />
                  <div className="h-8 bg-gray-200 rounded-lg" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
