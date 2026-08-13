'use client';

import { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
}

export default function Card({ children, className = '' }: CardProps) {
  return (
    <div
      className={`
        w-full
        rounded-2xl
        border
        border-gray-200/80
        bg-white/80
        backdrop-blur-sm
        p-6
        shadow-sm
        transition-all
        duration-200
        hover:shadow-md
        dark:border-gray-700/50
        dark:bg-gray-800/80
        ${className}
      `}
    >
      {children}
    </div>
  );
}