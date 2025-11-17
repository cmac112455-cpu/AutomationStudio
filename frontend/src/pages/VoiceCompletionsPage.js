import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Play, Download, Save, RefreshCw, Loader, Mic } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

const VoiceCompletionsPage = () => {
  const [completions, setCompletions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [playingId, setPlayingId] = useState(null);

  useEffect(() => {
    fetchCompletions();
  }, []);

  const fetchCompletions = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('apoe_token');
      const response = await axios.get(`${BACKEND_URL}/api/voice-studio/completions`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setCompletions(response.data.completions || []);
    } catch (error) {
      console.error('Failed to fetch completions:', error);
      toast.error('Failed to load completions');
    } finally {
      setLoading(false);
    }
  };

  const playAudio = (audioBase64, completionId) => {
    try {
      // Stop any currently playing audio
      if (playingId) {
        setPlayingId(null);
      }

      // Convert base64 to blob
      const byteCharacters = atob(audioBase64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'audio/mpeg' });
      const url = URL.createObjectURL(blob);

      const audio = new Audio(url);
      audio.onended = () => {
        setPlayingId(null);
        URL.revokeObjectURL(url);
      };
      audio.onerror = () => {
        setPlayingId(null);
        URL.revokeObjectURL(url);
        toast.error('Failed to play audio');
      };

      setPlayingId(completionId);
      audio.play();
    } catch (error) {
      console.error('Play error:', error);
      toast.error('Failed to play audio');
      setPlayingId(null);
    }
  };

  const downloadAudio = (audioBase64, completion) => {
    try {
      const byteCharacters = atob(audioBase64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'audio/mpeg' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = `${completion.type}_${completion.id}.mp3`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success('Download started');
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Failed to download audio');
    }
  };

  const saveToLibrary = async (completionId) => {
    try {
      const token = localStorage.getItem('apoe_token');
      await axios.post(
        `${BACKEND_URL}/api/voice-studio/completions/${completionId}/save`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success('Saved to library');
      fetchCompletions(); // Refresh to update saved status
    } catch (error) {
      console.error('Save error:', error);
      toast.error('Failed to save to library');
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const getStatusColor = (status) => {
    switch(status) {
      case 'completed': return 'text-green-400';
      case 'processing': return 'text-yellow-400';
      case 'failed': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0b0d] text-white p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent">
              Voice Studio Completions
            </h1>
            <p className="text-gray-400">View and manage all your generated voices and music</p>
          </div>
          <Button onClick={fetchCompletions} disabled={loading}>
            {loading ? <Loader className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            Refresh
          </Button>
        </div>

        {loading && completions.length === 0 ? (
          <div className="text-center py-12">
            <Loader className="w-8 h-8 animate-spin mx-auto mb-4 text-cyan-500" />
            <p className="text-gray-400">Loading completions...</p>
          </div>
        ) : completions.length === 0 ? (
          <div className="text-center py-12 bg-[#13141a] rounded-xl border border-gray-800">
            <Mic className="w-16 h-16 mx-auto mb-4 text-gray-600" />
            <h3 className="text-xl font-semibold mb-2">No completions yet</h3>
            <p className="text-gray-400">Generate voices or music to see them here</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {completions.map((completion) => (
              <div
                key={completion.id}
                className="bg-[#13141a] rounded-xl border border-gray-800 p-6 hover:border-gray-700 transition-colors"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${
                        completion.type === 'voice' ? 'bg-cyan-500/20 text-cyan-400' : 'bg-purple-500/20 text-purple-400'
                      }`}>
                        {completion.type === 'voice' ? 'Voice' : 'Music'}
                      </span>
                      <span className={`text-xs ${getStatusColor(completion.status)}`}>
                        {completion.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-400">{formatDate(completion.created_at)}</p>
                  </div>
                  {completion.saved && (
                    <span className="text-green-400 text-xs">★ Saved</span>
                  )}
                </div>

                {completion.type === 'voice' && completion.voice_name && (
                  <div className="mb-3">
                    <p className="text-sm font-semibold text-white">{completion.voice_name}</p>
                  </div>
                )}

                <div className="mb-4">
                  <p className="text-sm text-gray-300 line-clamp-3">
                    {completion.prompt || completion.text || 'No description'}
                  </p>
                </div>

                {completion.error && (
                  <div className="mb-3 p-2 bg-red-500/10 border border-red-500/30 rounded text-xs text-red-400">
                    Error: {completion.error}
                  </div>
                )}

                {completion.log && completion.log.length > 0 && (
                  <div className="mb-3 p-2 bg-[#0a0b0d] rounded text-xs text-gray-400 max-h-20 overflow-y-auto">
                    {completion.log.map((entry, i) => (
                      <div key={i}>{entry}</div>
                    ))}
                  </div>
                )}

                {completion.status === 'completed' && completion.audio_base64 && (
                  <div className="flex gap-2">
                    <Button
                      onClick={() => playAudio(completion.audio_base64, completion.id)}
                      size="sm"
                      className="flex-1 bg-cyan-600 hover:bg-cyan-700"
                      disabled={playingId === completion.id}
                    >
                      {playingId === completion.id ? (
                        <Loader className="w-4 h-4 animate-spin" />
                      ) : (
                        <Play className="w-4 h-4" />
                      )}
                    </Button>
                    <Button
                      onClick={() => downloadAudio(completion.audio_base64, completion)}
                      size="sm"
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                    {!completion.saved && (
                      <Button
                        onClick={() => saveToLibrary(completion.id)}
                        size="sm"
                        className="bg-purple-600 hover:bg-purple-700"
                      >
                        <Save className="w-4 h-4" />
                      </Button>
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
};

export default VoiceCompletionsPage;