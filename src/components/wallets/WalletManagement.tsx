// src/components/wallets/WalletManagement.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  Plus, Star, Edit, Trash2, ExternalLink, 
  Search, Loader2, Copy, Check, X,
  AlertTriangle, AlertCircle, Wallet as WalletIcon
} from 'lucide-react';

interface Wallet {
  id: string;
  address: string;
  chain: string;
  label: string | null;
  notes: string | null;
  isFavorite: boolean;
  isArchived: boolean;
  metrics?: any[];
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export function WalletManagement() {
  // ✅ State with proper defaults
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  });
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingWallet, setEditingWallet] = useState<Wallet | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  const [newWallet, setNewWallet] = useState({
    address: '',
    chain: 'ETHEREUM',
    label: '',
    notes: '',
  });

  // ✅ Fetch wallets with proper error handling
  const fetchWallets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      });
      if (search) {
        params.append('search', search);
      }

      const response = await fetch(`/api/wallets?${params}`);
      
      // ✅ Handle non-200 responses
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const result = await response.json();
      
      // ✅ Validate response structure
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch wallets');
      }

      // ✅ Safely set data with fallbacks
      setWallets(Array.isArray(result.data) ? result.data : []);
      setPagination({
        page: result.metadata?.page || 1,
        limit: result.metadata?.limit || 10,
        total: result.metadata?.total || 0,
        totalPages: result.metadata?.totalPages || 0,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load wallets';
      setError(errorMessage);
      console.error('Fetch wallets error:', err);
      // ✅ Set empty state on error
      setWallets([]);
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, search]);

  // ✅ Initial load with error boundary
  useEffect(() => {
    let isMounted = true;
    
    const loadWallets = async () => {
      if (!isMounted) return;
      await fetchWallets();
    };
    
    loadWallets();
    
    return () => {
      isMounted = false;
    };
  }, [fetchWallets]);

  // ✅ Create wallet with validation
  const handleCreateWallet = async () => {
    if (!newWallet.address) {
      setError('Wallet address is required');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch('/api/wallets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newWallet),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to create wallet');
      }

      setShowAddModal(false);
      setNewWallet({ address: '', chain: 'ETHEREUM', label: '', notes: '' });
      await fetchWallets();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create wallet');
    } finally {
      setSubmitting(false);
    }
  };

  // ✅ Update wallet
  const handleUpdateWallet = async () => {
    if (!editingWallet) return;
    
    setSubmitting(true);
    setError(null);
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

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to update wallet');
      }

      setEditingWallet(null);
      await fetchWallets();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update wallet');
    } finally {
      setSubmitting(false);
    }
  };

  // ✅ Toggle favorite
  const handleToggleFavorite = async (walletId: string) => {
    setError(null);
    try {
      const response = await fetch(`/api/wallets/${walletId}/favorite`, {
        method: 'POST',
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to toggle favorite');
      }

      await fetchWallets();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle favorite');
    }
  };

  // ✅ Delete wallet
  const handleDeleteWallet = async (walletId: string) => {
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/wallets/${walletId}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to delete wallet');
      }

      setShowDeleteConfirm(null);
      await fetchWallets();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete wallet');
    } finally {
      setSubmitting(false);
    }
  };

  const copyAddress = (address: string) => {
    navigator.clipboard.writeText(address);
    setCopiedAddress(address);
    setTimeout(() => setCopiedAddress(null), 2000);
  };

  const filteredWallets = wallets.filter(w => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      w.address.toLowerCase().includes(searchLower) ||
      (w.label && w.label.toLowerCase().includes(searchLower))
    );
  });

  // ✅ Loading State
  if (loading && wallets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">Loading wallets...</p>
      </div>
    );
  }

  // ✅ Error State with retry
  if (error && wallets.length === 0) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <p className="text-red-600 dark:text-red-400">{error}</p>
        <button
          onClick={fetchWallets}
          className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {wallets.length} wallets tracked
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
          placeholder="Search wallets..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Error Toast */}
      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center justify-between">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Wallets List */}
      {filteredWallets.length === 0 ? (
        <div className="text-center py-8">
          <WalletIcon className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400">
            {search ? 'No wallets match your search' : 'No wallets tracked yet'}
          </p>
          {!search && (
            <button
              onClick={() => setShowAddModal(true)}
              className="mt-2 text-blue-600 hover:text-blue-700 dark:text-blue-400 text-sm"
            >
              Add your first wallet
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredWallets.map((wallet) => (
            <div
              key={wallet.id}
              className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700/30 transition-colors"
            >
              {/* Wallet Info */}
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <button
                  onClick={() => handleToggleFavorite(wallet.id)}
                  className="flex-shrink-0"
                  disabled={submitting}
                >
                  <Star className={`w-4 h-4 transition-colors ${
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
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                    <span>{wallet.chain}</span>
                    <span className="text-gray-300 dark:text-gray-600">•</span>
                    <span className="font-mono">{wallet.address.slice(0, 6)}...{wallet.address.slice(-4)}</span>
                    <button
                      onClick={() => copyAddress(wallet.address)}
                      className="p-0.5 hover:text-gray-700 dark:hover:text-gray-300"
                    >
                      {copiedAddress === wallet.address ? (
                        <Check className="w-3 h-3 text-green-500" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </button>
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

      {/* Add Wallet Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowAddModal(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
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
    </div>
  );
}