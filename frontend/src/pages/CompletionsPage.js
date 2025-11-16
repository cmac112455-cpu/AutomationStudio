import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { ListChecks, Play, CheckCircle, XCircle, Clock, Eye, ChevronDown, ChevronUp, Image as ImageIcon, Video as VideoIcon, Maximize2, Download, X } from 'lucide-react';

export default function CompletionsPage() {
  const [executions, setExecutions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedExecution, setExpandedExecution] = useState(null);
  const [lightboxMedia, setLightboxMedia] = useState(null);

  // Helper to check if result contains media
  const hasMedia = (result) => {
    return result?.image_base64 || result?.video_base64;
  };

  // Helper to extract all media from execution results
  const extractMedia = (results) => {
    const media = [];
    if (results) {
      Object.entries(results).forEach(([nodeId, result]) => {
        if (result?.image_base64) {
          media.push({
            type: 'image',
            nodeId,
            data: result.image_base64,
            prompt: result.prompt || 'Generated Image',
            size: result.size
          });
        }
        if (result?.video_base64) {
          media.push({
            type: 'video',
            nodeId,
            data: result.video_base64,
            prompt: result.prompt || 'Generated Video',
            duration: result.duration,
            size: result.size
          });
        }
      });
    }
    return media;
  };

  // Download media function
  const downloadMedia = (media) => {
    const link = document.createElement('a');
    const dataUrl = media.type === 'image' 
      ? `data:image/png;base64,${media.data}`
      : `data:video/mp4;base64,${media.data}`;
    link.href = dataUrl;
    link.download = `${media.prompt.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${Date.now()}.${media.type === 'image' ? 'png' : 'mp4'}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  useEffect(() => {
    loadExecutions();
  }, []);

  const loadExecutions = async () => {
    try {
      const response = await axios.get('/workflows/executions');
      setExecutions(response.data);
    } catch (error) {
      console.error('Failed to load executions:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'running':
        return <Clock className="w-5 h-5 text-blue-500 animate-spin" />;
      default:
        return <Clock className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      completed: 'bg-green-500/20 text-green-400 border-green-500/30',
      failed: 'bg-red-500/20 text-red-400 border-red-500/30',
      running: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    };
    return badges[status] || 'bg-gray-500/20 text-gray-400 border-gray-500/30';
  };

  const formatDuration = (ms) => {
    if (!ms) return 'N/A';
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f1218] to-[#1a1d2e] text-white p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
              <ListChecks className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold">Workflow Completions</h1>
              <p className="text-gray-400">View execution history and results</p>
            </div>
          </div>
          <Button onClick={loadExecutions} variant="outline" className="border-gray-700">
            Refresh
          </Button>
        </div>

        {/* Executions List */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Clock className="w-8 h-8 text-gray-400 animate-spin" />
          </div>
        ) : executions.length === 0 ? (
          <div className="glass-morph rounded-2xl p-12 text-center">
            <ListChecks className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 text-lg">No workflow executions yet</p>
            <p className="text-gray-500 text-sm mt-2">Execute a workflow to see results here</p>
          </div>
        ) : (
          <div className="space-y-4">
            {executions.map((execution) => (
              <div
                key={execution.id}
                className="glass-morph rounded-xl border border-gray-700 overflow-hidden transition-all hover:border-gray-600"
              >
                {/* Execution Summary */}
                <div className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 flex-1">
                      {getStatusIcon(execution.status)}
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg text-white">
                          {execution.workflow_name || 'Unnamed Workflow'}
                        </h3>
                        <p className="text-sm text-gray-400">
                          {new Date(execution.started_at).toLocaleString()}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className={`px-3 py-1 rounded-full border text-xs font-semibold ${getStatusBadge(execution.status)}`}>
                        {execution.status.toUpperCase()}
                      </div>
                      
                      {execution.duration && (
                        <div className="text-sm text-gray-400">
                          <Clock className="w-4 h-4 inline mr-1" />
                          {formatDuration(execution.duration)}
                        </div>
                      )}

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setExpandedExecution(expandedExecution === execution.id ? null : execution.id)}
                      >
                        {expandedExecution === execution.id ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Progress Bar for Running Workflows */}
                  {execution.status === 'running' && (
                    <div className="mt-4">
                      <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
                        <span>Progress: {execution.progress || 0}%</span>
                        <span>{execution.current_node || 'Initializing...'}</span>
                      </div>
                      <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-500"
                          style={{ width: `${execution.progress || 0}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Expanded Details */}
                {expandedExecution === execution.id && (
                  <div className="border-t border-gray-700 bg-black/20 p-6">
                    <h4 className="font-semibold text-white mb-4">Execution Details</h4>
                    
                    {/* Generated Media Gallery */}
                    {(() => {
                      const mediaItems = extractMedia(execution.results);
                      return mediaItems.length > 0 && (
                        <div className="mb-6">
                          <h5 className="text-sm font-semibold text-gray-400 mb-3 flex items-center gap-2">
                            <ImageIcon className="w-4 h-4" />
                            Generated Content
                          </h5>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {mediaItems.map((media, idx) => (
                              <div key={idx} className="bg-[#0f1218] rounded-lg overflow-hidden border border-gray-700">
                                {media.type === 'image' ? (
                                  <div>
                                    <img 
                                      src={`data:image/png;base64,${media.data}`}
                                      alt={media.prompt}
                                      className="w-full h-auto object-contain bg-gray-900"
                                    />
                                    <div className="p-3">
                                      <p className="text-xs text-gray-400 mb-1">
                                        <ImageIcon className="w-3 h-3 inline mr-1" />
                                        {media.size || 'Image'}
                                      </p>
                                      {media.prompt && (
                                        <p className="text-xs text-gray-500 italic">"{media.prompt}"</p>
                                      )}
                                    </div>
                                  </div>
                                ) : (
                                  <div>
                                    <video 
                                      src={`data:video/mp4;base64,${media.data}`}
                                      controls
                                      className="w-full h-auto bg-gray-900"
                                    />
                                    <div className="p-3">
                                      <p className="text-xs text-gray-400 mb-1">
                                        <VideoIcon className="w-3 h-3 inline mr-1" />
                                        {media.size || 'Video'} • {media.duration}s
                                      </p>
                                      {media.prompt && (
                                        <p className="text-xs text-gray-500 italic">"{media.prompt}"</p>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}
                    
                    {/* Execution Log */}
                    {execution.execution_log && execution.execution_log.length > 0 && (
                      <div className="mb-4">
                        <h5 className="text-sm font-semibold text-gray-400 mb-2">Execution Log:</h5>
                        <div className="bg-[#0f1218] rounded-lg p-4 font-mono text-xs space-y-1 max-h-60 overflow-y-auto">
                          {execution.execution_log.map((log, idx) => (
                            <div key={idx} className="text-gray-300">
                              <span className="text-gray-600">[{idx + 1}]</span> {log}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Results */}
                    {execution.results && Object.keys(execution.results).length > 0 && (
                      <div>
                        <h5 className="text-sm font-semibold text-gray-400 mb-2">Node Results:</h5>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {Object.entries(execution.results).map(([nodeId, result]) => (
                            <div key={nodeId} className="bg-[#0f1218] rounded-lg p-3">
                              <p className="text-xs font-semibold text-gray-400 mb-1">{nodeId}</p>
                              {hasMedia(result) ? (
                                <div className="text-xs text-gray-500">
                                  {result.image_base64 && <div className="flex items-center gap-1"><ImageIcon className="w-3 h-3" /> Image Generated</div>}
                                  {result.video_base64 && <div className="flex items-center gap-1"><VideoIcon className="w-3 h-3" /> Video Generated</div>}
                                  <p className="mt-1 text-gray-600">See "Generated Content" above</p>
                                </div>
                              ) : (
                                <pre className="text-xs text-gray-300 overflow-x-auto">
                                  {JSON.stringify(result, null, 2).substring(0, 200)}
                                  {JSON.stringify(result).length > 200 && '...'}
                                </pre>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Error Display */}
                    {execution.error && (
                      <div className="mt-4 bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                        <p className="text-red-400 font-semibold mb-2">Error:</p>
                        <p className="text-red-300 text-sm">{execution.error}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
