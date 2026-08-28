// src/components/copy-trading/CopyTradeAlerts.tsx
'use client';

import { useState, useEffect } from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  ExternalLink,
  Loader2,
  Bell,
  BellOff,
  Eye,
  EyeOff,
  Copy,
  Check,
  X,
  AlertCircle,
  Zap,
} from 'lucide-react';

interface CopyTradeAlert {
  id: string;
  walletId: string;
  wallet: {
    address: string;
    chain: string;
    label: string | null;
  };
  webhookUrl: string;
  monitorBuy: boolean;
  monitorSell: boolean;
  monitorSwap: boolean;
  minValueUsd: number | null;
  tokenWhitelist: string[];
  tokenBlacklist: string[];
  maxAlertsPerDay: number;
  alertCooldown: number;
  isActive: boolean;
  totalAlerts: number;
  createdAt: string;
}

export function CopyTradeAlerts() {
  const [alerts, setAlerts] = useState<CopyTradeAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingAlert, setEditingAlert] = useState<CopyTradeAlert | null>(null);
  const [showLogs, setShowLogs] = useState<string | null>(null);
  const [logs, setLogs] = useState<any[]>([]);

  // ✅ Fetch alerts
  const fetchAlerts = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/copy-trading/alerts');
      const result = await response.json();
      if (result.success) {
        setAlerts(result.data);
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError('Failed to fetch alerts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, []);

  // ✅ Toggle alert active status
  const toggleAlert = async (alertId: string, isActive: boolean) => {
    try {
      const response = await fetch(`/api/copy-trading/alerts/${alertId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive }),
      });
      const result = await response.json();
      if (result.success) {
        fetchAlerts();
      }
    } catch (err) {
      console.error('Failed to toggle alert:', err);
    }
  };

  // ✅ Delete alert
  const deleteAlert = async (alertId: string) => {
    if (!confirm('Are you sure you want to delete this alert?')) return;
    try {
      const response = await fetch(`/api/copy-trading/alerts/${alertId}`, {
        method: 'DELETE',
      });
      const result = await response.json();
      if (result.success) {
        fetchAlerts();
      }
    } catch (err) {
      console.error('Failed to delete alert:', err);
    }
  };

  // ✅ Fetch logs
  const fetchLogs = async (alertId: string) => {
    try {
      const response = await fetch(`/api/copy-trading/alerts/${alertId}/logs`);
      const result = await response.json();
      if (result.success) {
        setLogs(result.data);
        setShowLogs(alertId);
      }
    } catch (err) {
      console.error('Failed to fetch logs:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Zap className="w-5 h-5 text-yellow-500" />
            Copy-Trade Alerts
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Monitor wallets and receive webhook alerts for trades
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Alert
        </button>
      </div>

      {/* Alerts List */}
      {alerts.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700">
          <Bell className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400">No copy-trade alerts configured</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
            Monitor wallets and get notified when they trade
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700/30 transition-colors"
            >
              <div className="flex items-center justify-between">
                {/* Alert Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => toggleAlert(alert.id, !alert.isActive)}
                      className="flex-shrink-0"
                    >
                      {alert.isActive ? (
                        <Bell className="w-5 h-5 text-green-500" />
                      ) : (
                        <BellOff className="w-5 h-5 text-gray-400" />
                      )}
                    </button>
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 dark:text-white truncate">
                        {alert.wallet.label || alert.wallet.address.slice(0, 6) + '...' + alert.wallet.address.slice(-4)}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                        <span>{alert.wallet.chain}</span>
                        <span>•</span>
                        <span className="font-mono text-xs">
                          {alert.wallet.address.slice(0, 6)}...{alert.wallet.address.slice(-4)}
                        </span>
                        {alert.minValueUsd && (
                          <>
                            <span>•</span>
                            <span>Min: ${alert.minValueUsd.toLocaleString()}</span>
                          </>
                        )}
                        <span>•</span>
                        <span>{alert.totalAlerts} alerts</span>
                      </div>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {alert.monitorBuy && (
                          <span className="text-[10px] px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full">BUY</span>
                        )}
                        {alert.monitorSell && (
                          <span className="text-[10px] px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-full">SELL</span>
                        )}
                        {alert.monitorSwap && (
                          <span className="text-[10px] px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full">SWAP</span>
                        )}
                        {alert.tokenWhitelist.length > 0 && (
                          <span className="text-[10px] px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full">
                            {alert.tokenWhitelist.length} tokens
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => fetchLogs(alert.id)}
                    className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                    title="View logs"
                  >
                    <Eye className="w-4 h-4 text-gray-500" />
                  </button>
                  <button
                    onClick={() => setEditingAlert(alert)}
                    className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                    title="Edit"
                  >
                    <Pencil className="w-4 h-4 text-gray-500" />
                  </button>
                  <button
                    onClick={() => deleteAlert(alert.id)}
                    className="p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </button>
                </div>
              </div>

              {/* Webhook URL */}
              <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 truncate">
                Webhook: {alert.webhookUrl}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Logs Modal */}
      {showLogs && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-3xl w-full max-h-[80vh] overflow-hidden p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Alert Logs</h3>
              <button onClick={() => setShowLogs(null)} className="p-1 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-y-auto max-h-[60vh]">
              {logs.length === 0 ? (
                <p className="text-center text-gray-500 py-8">No logs yet</p>
              ) : (
                <div className="space-y-2">
                  {logs.map((log) => (
                    <div key={log.id} className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg text-sm">
                      <div className="flex justify-between">
                        <span className="font-medium">{log.eventType}</span>
                        <span className="text-gray-500">{new Date(log.createdAt).toLocaleString()}</span>
                      </div>
                      <div className="text-gray-600 dark:text-gray-400">
                        {log.amount} {log.tokenSymbol} → ${log.valueUsd.toLocaleString()}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          log.webhookStatus === 'SUCCESS' 
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                            : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                        }`}>
                          {log.webhookStatus}
                        </span>
                        {log.txHash && (
                          <a
                            href={`https://etherscan.io/tx/${log.txHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 dark:text-blue-400"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}