export default function Loading() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: '#FAFAF8' }}>
      <div className="h-14 bg-white border-b border-gray-200" />
      <div className="page-container animate-pulse">
        <div className="flex items-center justify-between mb-6">
          <div className="h-7 w-32 bg-gray-200 rounded" />
          <div className="flex gap-2">
            {[96, 120, 120, 80].map((w, i) => (
              <div key={i} className="h-8 bg-gray-200 rounded-lg" style={{ width: w }} />
            ))}
          </div>
        </div>
        {/* Revenue strip */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-100 p-4">
              <div className="h-3 w-24 bg-gray-100 rounded mb-2" />
              <div className="h-7 w-32 bg-gray-200 rounded" />
            </div>
          ))}
        </div>
        {/* Stats cards */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-100 p-4">
              <div className="h-3 w-20 bg-gray-100 rounded mb-2" />
              <div className="h-8 w-12 bg-gray-200 rounded" />
            </div>
          ))}
        </div>
        {/* Two column charts */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border border-gray-100 p-4 h-64" />
          <div className="bg-white rounded-xl border border-gray-100 p-4 h-64" />
        </div>
      </div>
    </div>
  )
}
