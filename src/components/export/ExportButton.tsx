// src/components/export/ExportButton.tsx
'use client';

import { useState } from 'react';
import { Download, Loader2, FileSpreadsheet } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ExportButtonProps {
  type?: 'holdings' | 'transactions' | 'complete';
  walletId?: string;
  label?: string;
  variant?: 'primary' | 'secondary' | 'outline';
  className?: string;
}

export function ExportButton({
  type = 'holdings',
  walletId,
  label = 'Export CSV',
  variant = 'primary',
  className = '',
}: ExportButtonProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleExport = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        type,
      });
      if (walletId) {
        params.append('walletId', walletId);
      }

      const response = await fetch(`/api/export/csv?${params}`);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Export failed');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = response.headers.get('Content-Disposition')?.split('filename=')[1] || `export_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: 'Success',
        description: 'File exported successfully',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Export failed',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const getVariantClasses = () => {
    switch (variant) {
      case 'primary':
        return 'bg-green-600 hover:bg-green-700 text-white';
      case 'secondary':
        return 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white';
      case 'outline':
        return 'border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300';
      default:
        return 'bg-green-600 hover:bg-green-700 text-white';
    }
  };

  return (
    <button
      onClick={handleExport}
      disabled={loading}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${getVariantClasses()} ${className}`}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <FileSpreadsheet className="w-4 h-4" />
      )}
      {loading ? 'Exporting...' : label}
    </button>
  );
}