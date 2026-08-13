'use client';

interface Props {
  allocation: { name: string; value: number; color: string }[];
  isLoading?: boolean;
}

export default function AssetAllocation({ allocation, isLoading = false }: Props) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="animate-pulse">
            <div className="flex justify-between mb-1">
              <div className="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded" />
              <div className="h-4 w-12 bg-gray-200 dark:bg-gray-700 rounded" />
            </div>
            <div className="h-2 w-full bg-gray-200 dark:bg-gray-700 rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (!allocation || allocation.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        No allocation data available
      </div>
    );
  }

  const total = allocation.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="space-y-3">
      {allocation.map((item, index) => {
        const percentage = total > 0 ? (item.value / total) * 100 : 0;
        return (
          <div key={index}>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-700 dark:text-gray-300">{item.name}</span>
              <span className="text-gray-600 dark:text-gray-400">{percentage.toFixed(1)}%</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className="h-2 rounded-full transition-all duration-700"
                style={{
                  width: `${percentage}%`,
                  backgroundColor: item.color || '#3b82f6'
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}