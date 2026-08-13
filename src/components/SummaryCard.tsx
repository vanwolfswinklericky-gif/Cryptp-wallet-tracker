'use client';

import { ReactNode } from 'react';

interface SummaryCardProps {
  icon: ReactNode;
  label: string;
  value: string;
  iconClass?: string;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
}

export default function SummaryCard({
  icon,
  label,
  value,
  iconClass = 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
  change,
  changeType = 'neutral',
}: SummaryCardProps) {
  const changeColors = {
    positive: 'text-green-600 dark:text-green-400',
    negative: 'text-red-600 dark:text-red-400',
    neutral: 'text-gray-500 dark:text-gray-400',
  };

  const changeIcons = {
    positive: '↑',
    negative: '↓',
    neutral: '•',
  };

  return (
    <div
      className="
        group
        rounded-2xl
        border
        border-gray-200/80
        bg-white/80
        backdrop-blur-sm
        px-5
        py-6
        shadow-sm
        transition-all
        duration-300
        ease-out
        hover:shadow-md
        hover:border-gray-300
        dark:border-gray-700/50
        dark:bg-gray-800/80
        dark:hover:border-gray-600
        dark:hover:shadow-gray-900/50
      "
    >
      <div className="flex flex-col items-center text-center">
        <div
          className={`
            mb-3
            flex
            h-11
            w-11
            items-center
            justify-center
            rounded-xl
            transition-all
            duration-300
            group-hover:scale-105
            ${iconClass}
          `}
        >
          {icon}
        </div>

        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
          {label}
        </p>

        <p className="mt-1.5 text-sm font-semibold text-gray-900 dark:text-white">
          {value}
        </p>

        {change && (
          <p className={`mt-1 text-xs font-medium ${changeColors[changeType]}`}>
            <span className="mr-0.5">{changeIcons[changeType]}</span>
            {change}
          </p>
        )}
      </div>
    </div>
  );
}