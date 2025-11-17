import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Phone, AlertCircle, CheckCircle, XCircle, Clock, Bot, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

const ConversationalAICompletionsPage = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedLog, setExpandedLog] = useState(null);

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${BACKEND_URL}/api/conversational-ai/call-logs`);
      setLogs(response.data);
    } catch (error) {
      console.error('Error loading call logs:', error);
      toast.error('Failed to load call logs');
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-400" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-400" />;
      case 'started':
        return <Clock className="w-5 h-5 text-yellow-400" />;
      default:
        return <AlertCircle className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500/10 text-green-400 border-green-500/20';
      case 'failed':
        return 'bg-red-500/10 text-red-400 border-red-500/20';
      case 'started':
        return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
      default:
        return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
    }
  };

  const formatDate = (isoString) => {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="min-h-screen bg-[#0a0b0d] text-white">
      {/* Header */}
      <div className="border-b border-gray-800 bg-[#13141a] sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center shadow-lg shadow-cyan-500/20">
                <Phone className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-semibold">Call History</h1>
                <p className="text-sm text-gray-400">View all test calls and debug logs</p>
              </div>
            </div>
            <Button
              onClick={loadLogs}
              disabled={loading}
              className="bg-gray-700 hover:bg-gray-600"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {loading && logs.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-12 h-12 rounded-full border-4 border-cyan-500/20 border-t-cyan-500 animate-spin mx-auto mb-4"></div>
            <p className="text-gray-400">Loading call history...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-20 h-20 rounded-full bg-cyan-500/10 flex items-center justify-center mx-auto mb-6">
              <Phone className="w-10 h-10 text-cyan-400" />
            </div>
            <h3 className="text-2xl font-semibold mb-2">No call history yet</h3>
            <p className="text-gray-400 mb-6">Test your agents to see call logs appear here</p>
          </div>
        ) : (
          <div className="space-y-4">
            {logs.map((log) => (
              <div
                key={log.id}
                className="bg-[#13141a] rounded-xl border border-gray-800 overflow-hidden hover:border-cyan-500/30 transition-all"
              >
                {/* Log Header */}
                <div
                  onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                  className="p-6 cursor-pointer"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center border border-cyan-500/30">
                        <Bot className="w-6 h-6 text-cyan-400" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold">{log.agent_name || 'Unknown Agent'}</h3>
                        <p className="text-sm text-gray-400">{formatDate(log.created_at)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${getStatusColor(log.status)}`}>
                        {getStatusIcon(log.status)}
                        <span className="text-sm font-medium capitalize">{log.status}</span>
                      </div>
                      {expandedLog === log.id ? (
                        <ChevronUp className="w-5 h-5 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                  </div>

                  {/* Quick Info */}
                  <div className="flex items-center gap-6 text-sm text-gray-400">
                    {log.exchanges_count > 0 && (
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 bg-cyan-500 rounded-full"></span>
                        <span>{log.exchanges_count} exchange{log.exchanges_count !== 1 ? 's' : ''}</span>
                      </div>
                    )}
                    {log.audio_generated !== undefined && (
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 ${log.audio_generated ? 'bg-green-500' : 'bg-red-500'} rounded-full`}></span>
                        <span>Audio {log.audio_generated ? 'generated' : 'failed'}</span>
                      </div>
                    )}
                    {log.duration && (
                      <div className="flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{log.duration}s</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Expanded Details */}
                {expandedLog === log.id && (
                  <div className="border-t border-gray-800 bg-[#0a0b0d] p-6 space-y-4">
                    {log.transcription && (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-1 h-4 bg-cyan-500 rounded-full"></div>
                          <h4 className="text-sm font-semibold text-gray-300">User Said</h4>
                        </div>
                        <div className="bg-[#13141a] border border-gray-800 rounded-lg p-4">
                          <p className="text-gray-200">{log.transcription}</p>
                        </div>
                      </div>
                    )}

                    {log.response && (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-1 h-4 bg-blue-500 rounded-full"></div>
                          <h4 className="text-sm font-semibold text-gray-300">Agent Responded</h4>
                        </div>
                        <div className="bg-[#13141a] border border-gray-800 rounded-lg p-4">
                          <p className="text-gray-200">{log.response}</p>
                        </div>
                      </div>
                    )}

                    {log.error && (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-1 h-4 bg-red-500 rounded-full"></div>
                          <h4 className="text-sm font-semibold text-red-400">Error Details</h4>
                        </div>
                        <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-4">
                          <p className="text-red-300 font-mono text-sm">{log.error}</p>
                        </div>
                      </div>
                    )}

                    {/* Technical Details */}
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-1 h-4 bg-gray-500 rounded-full"></div>
                        <h4 className="text-sm font-semibold text-gray-300">Technical Details</h4>
                      </div>
                      <div className="bg-[#13141a] border border-gray-800 rounded-lg p-4">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-gray-500">Agent ID:</span>
                            <p className="text-gray-300 font-mono text-xs mt-1">{log.agent_id}</p>
                          </div>
                          <div>
                            <span className="text-gray-500">Call ID:</span>
                            <p className="text-gray-300 font-mono text-xs mt-1">{log.id}</p>
                          </div>
                          <div>
                            <span className="text-gray-500">Timestamp:</span>
                            <p className="text-gray-300 text-xs mt-1">
                              {new Date(log.created_at).toLocaleString()}
                            </p>
                          </div>
                          <div>
                            <span className="text-gray-500">Status:</span>
                            <p className="text-gray-300 text-xs mt-1 capitalize">{log.status}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ConversationalAICompletionsPage;
