import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Mic, Download, Loader, Volume2, VolumeX, Play, Pause, Sparkles } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

const MusicPage = () => {
  const [prompt, setPrompt] = useState('');
  const [duration, setDuration] = useState(120);
  const [generating, setGenerating] = useState(false);
  const [audioUrl, setAudioUrl] = useState(null);
  const [audioPlayer, setAudioPlayer] = useState(null);
  const [progress, setProgress] = useState('');
  const [volume, setVolume] = useState(0.5);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  const generateMusic = async () => {
    if (!prompt.trim()) {
      toast.error('Please enter a music prompt');
      return;
    }

    try {
      setGenerating(true);
      setProgress('Submitting generation request...');
      const token = localStorage.getItem('apoe_token');
      
      const response = await axios.post(
        `${BACKEND_URL}/api/voice-studio/generate-music`,
        {
          prompt,
          duration_seconds: duration
        },
        {
          headers: { Authorization: `Bearer ${token}` },
          responseType: 'blob',
          onDownloadProgress: (progressEvent) => {
            if (progressEvent.lengthComputable) {
              const percentComplete = (progressEvent.loaded / progressEvent.total) * 100;
              setProgress(`Downloading: ${Math.round(percentComplete)}%`);
            } else {
              setProgress('Processing music generation...');
            }
          }
        }
      );

      // Create audio URL from blob
      const url = URL.createObjectURL(response.data);
      
      // Stop previous audio if playing
      if (audioPlayer) {
        audioPlayer.pause();
        URL.revokeObjectURL(audioUrl);
      }
      
      setAudioUrl(url);
      setProgress('');
      
      // Create new audio player
      const audio = new Audio(url);
      audio.volume = volume;
      setAudioPlayer(audio);
      
      // Set up event listeners
      audio.addEventListener('ended', () => setIsPlaying(false));
      audio.addEventListener('play', () => setIsPlaying(true));
      audio.addEventListener('pause', () => setIsPlaying(false));
      
      await audio.play();
      
      toast.success('Music generated successfully!');
    } catch (error) {
      console.error('Generation failed:', error);
      
      // Try to parse error from blob
      if (error.response && error.response.data instanceof Blob) {
        try {
          const errorText = await error.response.data.text();
          const errorData = JSON.parse(errorText);
          toast.error(errorData.detail || 'Failed to generate music');
        } catch (e) {
          toast.error('Failed to generate music');
        }
      } else {
        toast.error('Failed to generate music');
      }
      
      setProgress('');
    } finally {
      setGenerating(false);
    }
  };

  // Update volume when slider changes
  useEffect(() => {
    if (audioPlayer) {
      audioPlayer.volume = isMuted ? 0 : volume;
    }
  }, [volume, audioPlayer, isMuted]);

  const downloadAudio = () => {
    if (!audioUrl) return;
    
    const a = document.createElement('a');
    a.href = audioUrl;
    a.download = `music_${Date.now()}.mp3`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success('Download started');
  };

  const togglePlayPause = () => {
    if (!audioPlayer) return;
    if (isPlaying) {
      audioPlayer.pause();
    } else {
      audioPlayer.play();
    }
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  const examplePrompts = [
    "Epic cinematic orchestral music with dramatic strings and horns",
    "Upbeat pop music with piano and drums, 90 BPM",
    "Dark ambient electronic soundscape with synth pads",
    "Acoustic guitar folk song with soft vocals in English",
    "Cinematic trailer music with epic drums and brass",
    "Chill lo-fi hip hop beats with vinyl crackle"
  ];

  return (
    <div className="min-h-screen bg-[#0a0b0d] text-white">
      {/* Header */}
      <div className="border-b border-gray-800 bg-[#13141a] sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/20">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">Music Generator</h1>
              <p className="text-sm text-gray-400">Create studio-quality music with AI</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content - Left Side */}
          <div className="lg:col-span-2 space-y-6">
            {/* Prompt Input */}
            <div className="bg-[#13141a] rounded-xl border border-gray-800 p-6">
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe the music you want to create... Try: 'Epic cinematic orchestral music with dramatic strings'"
                className="bg-[#0a0b0d] border-gray-700 text-white text-base min-h-[200px] resize-none focus:border-gray-600"
              />
              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs text-gray-500">{prompt.length} / 2000</span>
                <Button
                  onClick={generateMusic}
                  disabled={generating || !prompt.trim()}
                  className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-medium px-6 py-2 rounded-xl shadow-lg shadow-purple-500/20 transition-all duration-300 hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
                >
                  {generating ? (
                    <>
                      <Loader className="w-4 h-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Generate
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Progress Indicator */}
            {generating && (
              <div className="bg-[#13141a] rounded-xl border border-purple-500/30 p-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center animate-spin">
                    <Loader className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="text-white font-medium">Creating your music...</p>
                    <p className="text-sm text-gray-400">{progress || 'This may take 30 seconds to 5 minutes'}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Audio Player */}
            {audioUrl && (
              <div className="bg-gray-900 rounded-2xl border border-gray-800/50 shadow-2xl overflow-hidden">
                <div className="p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-white">Generated Music</h3>
                    <Button
                      onClick={downloadAudio}
                      variant="ghost"
                      size="sm"
                      className="text-gray-400 hover:text-white"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download
                    </Button>
                  </div>

                  {/* Custom Audio Controls */}
                  <div className="bg-gray-800/50 rounded-xl p-4 space-y-4">
                    <div className="flex items-center gap-4">
                      <button
                        onClick={togglePlayPause}
                        className="w-12 h-12 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center hover:scale-105 transition-transform shadow-lg shadow-purple-500/20"
                      >
                        {isPlaying ? (
                          <Pause className="w-5 h-5 text-white" />
                        ) : (
                          <Play className="w-5 h-5 text-white ml-0.5" />
                        )}
                      </button>

                      {/* Volume Control */}
                      <div className="flex-1 flex items-center gap-3">
                        <button
                          onClick={toggleMute}
                          className="text-gray-400 hover:text-white transition-colors"
                        >
                          {isMuted || volume === 0 ? (
                            <VolumeX className="w-5 h-5" />
                          ) : (
                            <Volume2 className="w-5 h-5" />
                          )}
                        </button>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.01"
                          value={volume}
                          onChange={(e) => setVolume(parseFloat(e.target.value))}
                          className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-gradient-to-r [&::-webkit-slider-thumb]:from-purple-500 [&::-webkit-slider-thumb]:to-pink-500 [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:shadow-purple-500/50"
                        />
                        <span className="text-sm text-gray-400 w-10 text-right">
                          {Math.round(volume * 100)}%
                        </span>
                      </div>
                    </div>
                    
                    {/* Hidden native audio for compatibility */}
                    <audio src={audioUrl} className="hidden" />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar - Right Side */}
          <div className="space-y-6">
            {/* Duration Control */}
            <div className="bg-gray-900 rounded-2xl border border-gray-800/50 p-6 shadow-xl">
              <div className="flex justify-between items-center mb-4">
                <Label className="text-white font-medium">Duration</Label>
                <span className="text-purple-400 font-mono text-sm">
                  {Math.floor(duration / 60)}:{(duration % 60).toString().padStart(2, '0')}
                </span>
              </div>
              <input
                type="range"
                min="10"
                max="300"
                step="10"
                value={duration}
                onChange={(e) => setDuration(parseInt(e.target.value))}
                className="w-full h-2 bg-gray-800 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-gradient-to-r [&::-webkit-slider-thumb]:from-purple-500 [&::-webkit-slider-thumb]:to-pink-500 [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:shadow-purple-500/50"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-2">
                <span>10s</span>
                <span>5 min</span>
              </div>
            </div>

            {/* Example Prompts */}
            <div className="bg-gray-900 rounded-2xl border border-gray-800/50 p-6 shadow-xl">
              <Label className="text-white font-medium mb-4 block">Examples</Label>
              <div className="space-y-2">
                {examplePrompts.map((example, index) => (
                  <button
                    key={index}
                    onClick={() => setPrompt(example)}
                    className="w-full text-left p-3 rounded-xl bg-gray-800/50 hover:bg-gray-800 border border-gray-700/50 hover:border-purple-500/50 transition-all duration-200 text-sm text-gray-300 hover:text-white group"
                  >
                    <span className="text-purple-400 opacity-0 group-hover:opacity-100 transition-opacity mr-2">→</span>
                    {example}
                  </button>
                ))}
              </div>
            </div>

            {/* Tips */}
            <div className="bg-gradient-to-br from-purple-900/20 to-pink-900/20 rounded-2xl border border-purple-500/20 p-6">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-4 h-4 text-purple-400" />
                </div>
                <div className="text-sm text-gray-300 space-y-2">
                  <p className="font-medium text-white">Pro Tips</p>
                  <ul className="space-y-1.5 text-xs">
                    <li>• Be specific about genre & mood</li>
                    <li>• Mention instruments clearly</li>
                    <li>• Include tempo (BPM) if needed</li>
                    <li>• Specify vocal/instrumental</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MusicPage;