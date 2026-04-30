export default function Loading() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: '#FAFAF8' }}>
      <div className="h-14 bg-white border-b border-gray-200" />
      <div className="page-container animate-pulse">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="h-7 w-40 bg-gray-200 rounded mb-2" />
            <div className="h-4 w-56 bg-gray-100 rounded" />
          </div>
          <div className="h-9 w-36 bg-gray-200 rounded-lg" />
        </div>
        <div className="flex gap-2 mb-4">
          <div className="h-8 w-44 bg-gray-200 rounded-lg" />
          <div className="h-8 w-24 bg-gray-200 rounded-lg" />
          <div className="h-8 w-24 bg-gray-200 rounded-lg" />
        </div>
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-14 bg-white rounded-lg border border-gray-100" />
          ))}
        </div>
      </div>
    </div>
  )
}
