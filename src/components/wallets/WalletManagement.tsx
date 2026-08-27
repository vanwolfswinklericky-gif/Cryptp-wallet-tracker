// src/components/wallets/WalletManagement.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  Plus, Star, Edit, Trash2, ExternalLink, 
  Search, Filter, Loader2, ChevronDown,
  MoreVertical, Copy, Check, Archive,
  X, Save, AlertTriangle
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useDebounce } from '@/hooks/use-debounce';

interface Wallet {
  id: string;
  address: string;
  chain: string;
  label: string | null;
  notes: string | null;
  isFavorite: boolean;
  isArchived: boolean;
  metrics?: any;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export function WalletManagement() {
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  });
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingWallet, setEditingWallet] = useState<Wallet | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [newWallet, setNewWallet] = useState({
    address: '',
    chain: 'ETHEREUM',
    label: '',
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();
  const debouncedSearch = useDebounce(search, 300);

  // ✅ Fetch wallets with pagination and search
  const fetchWallets = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      });
      if (debouncedSearch) {
        params.append('search', debouncedSearch);
      }

      const response = await fetch(`/api/wallets?${params}`);
      const result = await response.json();

      if (result.success) {
        setWallets(result.data);
        setPagination(result.metadata);
      }
    } catch (error) {
      console.error('Failed to fetch wallets:', error);
      toast({
        title: 'Error',
        description: 'Failed to load wallets',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, debouncedSearch, toast]);

  useEffect(() => {
    fetchWallets();
  }, [fetchWallets]);

  // ✅ Create wallet
  const handleCreateWallet = async () => {
    setSubmitting(true);
    try {
      const response = await fetch('/api/wallets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newWallet),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Success',
          description: 'Wallet added successfully',
        });
        setShowAddModal(false);
        setNewWallet({ address: '', chain: 'ETHEREUM', label: '', notes: '' });
        fetchWallets();
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to add wallet',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  // ✅ Update wallet
  const handleUpdateWallet = async () => {
    if (!editingWallet) return;
    
    setSubmitting(true);
    try {
      const response = await fetch(`/api/wallets/${editingWallet.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: editingWallet.label,
          notes: editingWallet.notes,
          isFavorite: editingWallet.isFavorite,
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Success',
          description: 'Wallet updated successfully',
        });
        setEditingWallet(null);
        fetchWallets();
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update wallet',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  // ✅ Toggle favorite
  const handleToggleFavorite = async (walletId: string) => {
    try {
      const response = await fetch(`/api/wallets/${walletId}/favorite`, {
        method: 'POST',
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Success',
          description: result.data.isFavorite ? 'Added to favorites' : 'Removed from favorites',
        });
        fetchWallets();
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update favorite status',
        variant: 'destructive',
      });
    }
  };

  // ✅ Delete wallet
  const handleDeleteWallet = async (walletId: string) => {
    setSubmitting(true);
    try {
      const response = await fetch(`/api/wallets/${walletId}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Success',
          description: 'Wallet deleted successfully',
        });
        setShowDeleteConfirm(null);
        fetchWallets();
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete wallet',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const copyAddress = (address: string) => {
    navigator.clipboard.writeText(address);
    toast({
      title: 'Copied!',
      description: 'Address copied to clipboard',
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Wallet Management
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Manage your tracked wallets
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Wallet
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search wallets by address or label..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Wallets List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      ) : wallets.length === 0 ? (
        <div className="text-center py-12">
          <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-full w-fit mx-auto mb-4">
            <Wallet className="w-8 h-8 text-gray-400" />
          </div>
          <p className="text-gray-500 dark:text-gray-400">
            {search ? 'No wallets match your search' : 'No wallets tracked yet'}
          </p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
            {search ? 'Try adjusting your search terms' : 'Click "Add Wallet" to start tracking'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {wallets.map((wallet) => (
            <div
              key={wallet.id}
              className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700/30 transition-colors"
            >
              {/* Wallet Info */}
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <button
                  onClick={() => handleToggleFavorite(wallet.id)}
                  className="flex-shrink-0"
                >
                  <Star className={`w-5 h-5 transition-colors ${
                    wallet.isFavorite 
                      ? 'fill-yellow-400 text-yellow-400' 
                      : 'text-gray-400 hover:text-yellow-400'
                  }`} />
                </button>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-gray-900 dark:text-white truncate">
                      {wallet.label || wallet.address.slice(0, 6) + '...' + wallet.address.slice(-4)}
                    </p>
                    {wallet.isArchived && (
                      <span className="text-xs px-2 py-0.5 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-full">
                        Archived
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                    <span>{wallet.chain}</span>
                    <span className="text-gray-300 dark:text-gray-600">•</span>
                    <span className="font-mono">{wallet.address.slice(0, 6)}...{wallet.address.slice(-4)}</span>
                    <button
                      onClick={() => copyAddress(wallet.address)}
                      className="p-0.5 hover:text-gray-700 dark:hover:text-gray-300"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                    <a
                      href={`https://etherscan.io/address/${wallet.address}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-0.5 hover:text-blue-600 dark:hover:text-blue-400"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  {wallet.notes && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-1">
                      {wallet.notes}
                    </p>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => setEditingWallet(wallet)}
                  className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                  title="Edit"
                >
                  <Edit className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(wallet.id)}
                  className="p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4 text-red-500" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Showing {(pagination.page - 1) * pagination.limit + 1} - {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
          </p>
          <div className="flex gap-1">
            <button
              onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
              disabled={pagination.page === 1}
              className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              Previous
            </button>
            <button
              onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
              disabled={pagination.page === pagination.totalPages}
              className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Add Wallet Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full p-6 shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Add Wallet</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Wallet Address *
                </label>
                <input
                  type="text"
                  value={newWallet.address}
                  onChange={(e) => setNewWallet(prev => ({ ...prev, address: e.target.value }))}
                  placeholder="0x..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Chain
                </label>
                <select
                  value={newWallet.chain}
                  onChange={(e) => setNewWallet(prev => ({ ...prev, chain: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="ETHEREUM">Ethereum</option>
                  <option value="POLYGON">Polygon</option>
                  <option value="BSC">BSC</option>
                  <option value="ARBITRUM">Arbitrum</option>
                  <option value="OPTIMISM">Optimism</option>
                  <option value="AVALANCHE">Avalanche</option>
                  <option value="BASE">Base</option>
                  <option value="SOLANA">Solana</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Label (optional)
                </label>
                <input
                  type="text"
                  value={newWallet.label}
                  onChange={(e) => setNewWallet(prev => ({ ...prev, label: e.target.value }))}
                  placeholder="My Main Wallet"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Notes (optional)
                </label>
                <textarea
                  value={newWallet.notes}
                  onChange={(e) => setNewWallet(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Additional notes..."
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateWallet}
                disabled={submitting || !newWallet.address}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Add Wallet'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingWallet && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full p-6 shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Edit Wallet</h3>
              <button
                onClick={() => setEditingWallet(null)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Label
                </label>
                <input
                  type="text"
                  value={editingWallet.label || ''}
                  onChange={(e) => setEditingWallet(prev => ({ ...prev!, label: e.target.value || '' }))}
                  placeholder="My Main Wallet"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Notes
                </label>
                <textarea
                  value={editingWallet.notes || ''}
                  onChange={(e) => setEditingWallet(prev => ({ ...prev!, notes: e.target.value || '' }))}
                  placeholder="Additional notes..."
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={editingWallet.isFavorite}
                  onChange={(e) => setEditingWallet(prev => ({ ...prev!, isFavorite: e.target.checked }))}
                  className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                />
                <label className="text-sm text-gray-700 dark:text-gray-300">
                  Favorite
                </label>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setEditingWallet(null)}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateWallet}
                disabled={submitting}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-sm w-full p-6 shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="w-6 h-6 text-red-500" />
              <h3 className="text-lg font-semibold">Delete Wallet</h3>
            </div>

            <p className="text-sm text-gray-600 dark:text-gray-400">
              Are you sure you want to delete this wallet? This action cannot be undone.
            </p>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteWallet(showDeleteConfirm)}
                disabled={submitting}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}