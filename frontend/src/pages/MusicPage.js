import React, { useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Mic, Download, Loader } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

const MusicPage = () => {
  const [prompt, setPrompt] = useState('');
  const [duration, setDuration] = useState(120);
  const [generating, setGenerating] = useState(false);
  const [audioUrl, setAudioUrl] = useState(null);
  const [audioPlayer, setAudioPlayer] = useState(null);
  const [progress, setProgress] = useState('');

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
      setAudioPlayer(audio);
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

  const examplePrompts = [
    "Epic cinematic orchestral music with dramatic strings and horns",
    "Upbeat pop music with piano and drums, 90 BPM",
    "Dark ambient electronic soundscape with synth pads",
    "Acoustic guitar folk song with soft vocals in English",
    "Cinematic trailer music with epic drums and brass",
    "Chill lo-fi hip hop beats with vinyl crackle"
  ];

  return (
    <div className="min-h-screen bg-[#0a0b0d] text-white p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent">
            Music Generator
          </h1>
          <p className="text-gray-400">Create studio-quality music from text prompts with ElevenLabs</p>
        </div>

        <div className="space-y-6">
          {/* Prompt Input */}
          <div className="bg-[#13141a] rounded-xl border border-gray-800 p-6">
            <Label className="text-white text-lg mb-4 block">Music Prompt</Label>
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe the music you want to create... (e.g., 'Epic orchestral music with strings and horns')" 
              className="bg-[#0a0b0d] border-gray-700 text-white min-h-[120px]"
            />
            <div className="text-xs text-gray-400 mt-2">
              {prompt.length} / 2000 characters
            </div>
          </div>

          {/* Duration Slider */}
          <div className="bg-[#13141a] rounded-xl border border-gray-800 p-6">
            <Label className="text-white flex justify-between mb-4">
              <span>Duration</span>
              <span className="text-gray-400">{duration} seconds ({Math.floor(duration / 60)}:{(duration % 60).toString().padStart(2, '0')})</span>
            </Label>
            <input
              type="range"
              min="10"
              max="300"
              step="10"
              value={duration}
              onChange={(e) => setDuration(parseInt(e.target.value))}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-2">
              <span>10s</span>
              <span>5 minutes</span>
            </div>
          </div>

          {/* Example Prompts */}
          <div className="bg-[#13141a] rounded-xl border border-gray-800 p-6">
            <Label className="text-white mb-3 block">Example Prompts</Label>
            <div className="space-y-2">
              {examplePrompts.map((example, index) => (
                <button
                  key={index}
                  onClick={() => setPrompt(example)}
                  className="w-full text-left p-3 rounded-lg bg-[#0a0b0d] border border-gray-700 hover:border-purple-500 transition-colors text-sm text-gray-300 hover:text-white"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>

          {/* Generate Button */}
          <div className="bg-[#13141a] rounded-xl border border-gray-800 p-6">
            <Button
              onClick={generateMusic}
              disabled={generating || !prompt.trim()}
              className="w-full bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white font-semibold py-6 text-lg"
            >
              {generating ? (
                <>
                  <Loader className="w-5 h-5 mr-2 animate-spin" />
                  Generating Music...
                </>
              ) : (
                <>
                  <Mic className="w-5 h-5 mr-2" />
                  Generate Music
                </>
              )}
            </Button>

            {progress && (
              <div className="mt-4 text-center text-sm text-gray-400">
                {progress}
              </div>
            )}

            {generating && (
              <div className="mt-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 text-sm text-gray-300">
                <div className="flex items-start gap-2">
                  <span className="text-yellow-400">⏱️</span>
                  <div>
                    Music generation typically takes 30 seconds to 5 minutes depending on duration. Please wait...
                  </div>
                </div>
              </div>
            )}

            {audioUrl && (
              <div className="mt-4 space-y-3">
                <div className="bg-[#0a0b0d] rounded-lg p-4 border border-gray-700">
                  <audio controls src={audioUrl} className="w-full" />
                </div>
                <Button
                  onClick={downloadAudio}
                  className="w-full bg-green-600 hover:bg-green-700"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download Music
                </Button>
              </div>
            )}
          </div>

          {/* Info Box */}
          <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4 text-sm text-gray-300">
            <div className="flex items-start gap-2">
              <span className="text-purple-400">💡</span>
              <div>
                <strong className="text-white">Tips for better results:</strong>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Be specific about genre, mood, and instruments</li>
                  <li>Mention tempo (BPM) for better rhythm control</li>
                  <li>Specify if you want vocals or instrumental only</li>
                  <li>Include language preference for vocal tracks</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MusicPage;