import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Mic, Play, Download, Loader, Search } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

const VoicesPage = () => {
  const [text, setText] = useState('');
  const [voices, setVoices] = useState([]);
  const [selectedVoice, setSelectedVoice] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [audioUrl, setAudioUrl] = useState(null);
  const [audioPlayer, setAudioPlayer] = useState(null);
  
  // Voice settings
  const [stability, setStability] = useState(0.5);
  const [similarityBoost, setSimilarityBoost] = useState(0.75);
  const [style, setStyle] = useState(0);
  const [speakerBoost, setSpeakerBoost] = useState(false);
  const [speed, setSpeed] = useState(1.0);
  const [modelId, setModelId] = useState('eleven_turbo_v2_5');

  useEffect(() => {
    fetchVoices();
  }, []);

  const fetchVoices = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('apoe_token');
      const response = await axios.get(`${BACKEND_URL}/api/tts/voices`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setVoices(response.data.voices || []);
      if (response.data.voices && response.data.voices.length > 0) {
        setSelectedVoice(response.data.voices[0]);
      }
      toast.success(`Loaded ${response.data.voices?.length || 0} voices`);
    } catch (error) {
      console.error('Failed to fetch voices:', error);
      toast.error('Failed to load voices');
    } finally {
      setLoading(false);
    }
  };

  const generateSpeech = async () => {
    if (!text.trim()) {
      toast.error('Please enter some text');
      return;
    }
    if (!selectedVoice) {
      toast.error('Please select a voice');
      return;
    }

    try {
      setGenerating(true);
      const token = localStorage.getItem('apoe_token');
      
      const response = await axios.post(
        `${BACKEND_URL}/api/voice-studio/generate-speech`,
        {
          text,
          voice_id: selectedVoice.voice_id,
          voice_name: selectedVoice.name,
          model_id: modelId,
          stability,
          similarity_boost: similarityBoost,
          style,
          speaker_boost: speakerBoost,
          speed
        },
        {
          headers: { Authorization: `Bearer ${token}` },
          responseType: 'blob'
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
      
      // Create and play new audio
      const audio = new Audio(url);
      audio.onended = () => setGenerating(false);
      setAudioPlayer(audio);
      await audio.play();
      
      toast.success('Speech generated successfully!');
    } catch (error) {
      console.error('Generation failed:', error);
      toast.error('Failed to generate speech');
      setGenerating(false);
    }
  };

  const downloadAudio = () => {
    if (!audioUrl) return;
    
    const a = document.createElement('a');
    a.href = audioUrl;
    a.download = `voice_${selectedVoice?.name || 'audio'}_${Date.now()}.mp3`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success('Download started');
  };

  const applyPreset = (preset) => {
    switch(preset) {
      case 'natural':
        setStability(0.5);
        setSimilarityBoost(0.75);
        setStyle(0);
        setSpeakerBoost(false);
        setSpeed(1.0);
        break;
      case 'expressive':
        setStability(0.3);
        setSimilarityBoost(0.8);
        setStyle(0);
        setSpeakerBoost(false);
        setSpeed(1.0);
        break;
      case 'professional':
        setStability(0.7);
        setSimilarityBoost(0.75);
        setStyle(0);
        setSpeakerBoost(true);
        setSpeed(0.9);
        break;
    }
    toast.success('Preset applied');
  };

  const filteredVoices = voices.filter(voice => 
    !searchQuery || 
    voice.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (voice.labels?.gender && voice.labels.gender.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (voice.labels?.accent && voice.labels.accent.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-[#0a0b0d] text-white p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
            Voice Studio
          </h1>
          <p className="text-gray-400">Generate high-quality AI voices with ElevenLabs</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Voice Selection Panel */}
          <div className="lg:col-span-1 bg-[#13141a] rounded-xl border border-gray-800 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Voices</h2>
              <Button onClick={fetchVoices} size="sm" disabled={loading}>
                {loading ? <Loader className="w-4 h-4 animate-spin" /> : 'Refresh'}
              </Button>
            </div>

            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search voices..."
                  className="bg-[#0a0b0d] border-gray-700 text-white pl-10"
                />
              </div>
            </div>

            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {filteredVoices.map(voice => (
                <div
                  key={voice.voice_id}
                  onClick={() => setSelectedVoice(voice)}
                  className={`p-3 rounded-lg cursor-pointer transition-all ${
                    selectedVoice?.voice_id === voice.voice_id
                      ? 'bg-cyan-500/20 border-2 border-cyan-500'
                      : 'bg-[#0a0b0d] border border-gray-700 hover:border-gray-600'
                  }`}
                >
                  <div className="font-semibold">{voice.name}</div>
                  <div className="text-xs text-gray-400 mt-1">
                    {voice.labels?.gender || 'Unknown'}
                    {voice.labels?.age && `, ${voice.labels.age}`}
                    {voice.labels?.accent && `, ${voice.labels.accent}`}
                  </div>
                  {voice.labels?.source && (
                    <div className="text-xs text-cyan-400 mt-1">{voice.labels.source}</div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Main Generation Panel */}
          <div className="lg:col-span-2 space-y-6">
            {/* Text Input */}
            <div className="bg-[#13141a] rounded-xl border border-gray-800 p-6">
              <Label className="text-white text-lg mb-4 block">Text to Speech</Label>
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Enter the text you want to convert to speech..."
                className="bg-[#0a0b0d] border-gray-700 text-white min-h-[150px]"
              />
              <div className="text-xs text-gray-400 mt-2">
                {text.length} characters
              </div>
            </div>

            {/* Voice Settings */}
            <div className="bg-[#13141a] rounded-xl border border-gray-800 p-6">
              <h3 className="text-lg font-semibold mb-4">Voice Settings</h3>
              
              {/* Quick Presets */}
              <div className="grid grid-cols-3 gap-2 mb-6">
                <Button onClick={() => applyPreset('natural')} size="sm" className="bg-green-600 hover:bg-green-700">
                  Natural
                </Button>
                <Button onClick={() => applyPreset('expressive')} size="sm" className="bg-purple-600 hover:bg-purple-700">
                  Expressive
                </Button>
                <Button onClick={() => applyPreset('professional')} size="sm" className="bg-blue-600 hover:bg-blue-700">
                  Professional
                </Button>
              </div>

              <div className="space-y-4">
                {/* Model Selection */}
                <div>
                  <Label className="text-white">Model</Label>
                  <Select value={modelId} onValueChange={setModelId}>
                    <SelectTrigger className="bg-[#0a0b0d] border-gray-700 text-white mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#1a1d2e] border-gray-700">
                      <SelectItem value="eleven_turbo_v2_5">Turbo v2.5 (Fast, Free tier)</SelectItem>
                      <SelectItem value="eleven_turbo_v2">Turbo v2 (Fast)</SelectItem>
                      <SelectItem value="eleven_multilingual_v2">Multilingual v2</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Stability */}
                <div>
                  <Label className="text-white flex justify-between">
                    <span>Stability</span>
                    <span className="text-gray-400">{stability}</span>
                  </Label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={stability}
                    onChange={(e) => setStability(parseFloat(e.target.value))}
                    className="w-full mt-2 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                  />
                </div>

                {/* Similarity Boost */}
                <div>
                  <Label className="text-white flex justify-between">
                    <span>Similarity Boost</span>
                    <span className="text-gray-400">{similarityBoost}</span>
                  </Label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={similarityBoost}
                    onChange={(e) => setSimilarityBoost(parseFloat(e.target.value))}
                    className="w-full mt-2 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                  />
                </div>

                {/* Speed */}
                <div>
                  <Label className="text-white flex justify-between">
                    <span>Speaking Speed</span>
                    <span className="text-gray-400">{speed}x</span>
                  </Label>
                  <input
                    type="range"
                    min="0.7"
                    max="1.2"
                    step="0.05"
                    value={speed}
                    onChange={(e) => setSpeed(parseFloat(e.target.value))}
                    className="w-full mt-2 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                  />
                </div>

                {/* Speaker Boost */}
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={speakerBoost}
                    onChange={(e) => setSpeakerBoost(e.target.checked)}
                    className="w-4 h-4 accent-cyan-500"
                  />
                  <Label className="text-white">Speaker Boost</Label>
                </div>
              </div>
            </div>

            {/* Generate Button */}
            <div className="bg-[#13141a] rounded-xl border border-gray-800 p-6">
              <Button
                onClick={generateSpeech}
                disabled={generating || !selectedVoice || !text.trim()}
                className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-semibold py-6 text-lg"
              >
                {generating ? (
                  <>
                    <Loader className="w-5 h-5 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Mic className="w-5 h-5 mr-2" />
                    Generate Speech
                  </>
                )}
              </Button>

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
                    Download Audio
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VoicesPage;