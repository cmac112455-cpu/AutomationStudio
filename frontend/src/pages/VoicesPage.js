import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Play, Download, Loader, Search, Plus, X, ChevronDown, ChevronRight, Volume2, Save, Trash2, Star } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

const VoicesPage = () => {
  const [text, setText] = useState('');
  const [allVoices, setAllVoices] = useState([]);
  const [personalVoices, setPersonalVoices] = useState([]);
  const [selectedVoice, setSelectedVoice] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [languageFilter, setLanguageFilter] = useState('all');
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [audioUrl, setAudioUrl] = useState(null);
  const [audioPlayer, setAudioPlayer] = useState(null);
  const [showAllVoices, setShowAllVoices] = useState(false);
  const [previewingVoice, setPreviewingVoice] = useState(null);
  const [savedPresets, setSavedPresets] = useState([]);
  const [presetName, setPresetName] = useState('');
  const [showSavePreset, setShowSavePreset] = useState(false);
  
  // Voice settings
  const [stability, setStability] = useState(0.5);
  const [similarityBoost, setSimilarityBoost] = useState(0.75);
  const [style, setStyle] = useState(0);
  const [speakerBoost, setSpeakerBoost] = useState(false);
  const [speed, setSpeed] = useState(1.0);
  const [modelId, setModelId] = useState('eleven_turbo_v2_5');

  useEffect(() => {
    fetchVoices();
    loadPersonalVoices();
    loadSavedPresets();
  }, []);

  const loadSavedPresets = () => {
    const stored = localStorage.getItem('voice_presets');
    if (stored) {
      setSavedPresets(JSON.parse(stored));
    }
  };

  const savePreset = () => {
    if (!presetName.trim()) {
      toast.error('Please enter a preset name');
      return;
    }
    if (!selectedVoice) {
      toast.error('Please select a voice first');
      return;
    }

    const preset = {
      id: Date.now().toString(),
      name: presetName,
      voice: selectedVoice,
      settings: {
        stability,
        similarityBoost,
        style,
        speakerBoost,
        speed,
        modelId
      },
      createdAt: new Date().toISOString()
    };

    const updated = [...savedPresets, preset];
    setSavedPresets(updated);
    localStorage.setItem('voice_presets', JSON.stringify(updated));
    setPresetName('');
    setShowSavePreset(false);
    toast.success(`Preset "${presetName}" saved`);
  };

  const loadPreset = (preset) => {
    setSelectedVoice(preset.voice);
    setStability(preset.settings.stability);
    setSimilarityBoost(preset.settings.similarityBoost);
    setStyle(preset.settings.style);
    setSpeakerBoost(preset.settings.speakerBoost);
    setSpeed(preset.settings.speed);
    setModelId(preset.settings.modelId);
    
    // Add voice to personal voices if not already there
    if (!personalVoices.some(v => v.voice_id === preset.voice.voice_id)) {
      addToPersonalVoices(preset.voice);
    }
    
    toast.success(`Loaded preset "${preset.name}"`);
  };

  const deletePreset = (presetId) => {
    const updated = savedPresets.filter(p => p.id !== presetId);
    setSavedPresets(updated);
    localStorage.setItem('voice_presets', JSON.stringify(updated));
    toast.success('Preset deleted');
  };

  const fetchVoices = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('apoe_token');
      const response = await axios.get(`${BACKEND_URL}/api/tts/voices`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setAllVoices(response.data.voices || []);
      toast.success(`Loaded ${response.data.voices?.length || 0} voices`);
    } catch (error) {
      console.error('Failed to fetch voices:', error);
      toast.error('Failed to load voices');
    } finally {
      setLoading(false);
    }
  };

  const loadPersonalVoices = () => {
    const stored = localStorage.getItem('personal_voices');
    if (stored) {
      const parsed = JSON.parse(stored);
      setPersonalVoices(parsed);
      if (parsed.length > 0 && !selectedVoice) {
        setSelectedVoice(parsed[0]);
      }
    } else {
      // Set defaults
      const defaults = [
        { voice_id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel', labels: { gender: 'female' } },
        { voice_id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam', labels: { gender: 'male' } },
        { voice_id: 'EXAVITQu4vr4xnSDxMaL', name: 'Bella', labels: { gender: 'female' } },
      ];
      setPersonalVoices(defaults);
      setSelectedVoice(defaults[0]);
      localStorage.setItem('personal_voices', JSON.stringify(defaults));
    }
  };

  const addToPersonalVoices = (voice) => {
    if (personalVoices.some(v => v.voice_id === voice.voice_id)) {
      toast.error('Voice already in your list');
      return;
    }
    const updated = [...personalVoices, voice];
    setPersonalVoices(updated);
    localStorage.setItem('personal_voices', JSON.stringify(updated));
    toast.success(`${voice.name} added to your voices`);
  };

  const removeFromPersonalVoices = (voiceId) => {
    const updated = personalVoices.filter(v => v.voice_id !== voiceId);
    setPersonalVoices(updated);
    localStorage.setItem('personal_voices', JSON.stringify(updated));
    if (selectedVoice?.voice_id === voiceId && updated.length > 0) {
      setSelectedVoice(updated[0]);
    }
    toast.success('Voice removed from your list');
  };

  const playVoicePreview = async (voice) => {
    if (!voice.preview_url) {
      toast.error('Preview not available for this voice');
      return;
    }
    
    try {
      setPreviewingVoice(voice.voice_id);
      const audio = new Audio(voice.preview_url);
      audio.onended = () => setPreviewingVoice(null);
      audio.onerror = () => {
        setPreviewingVoice(null);
        toast.error('Failed to play preview');
      };
      await audio.play();
    } catch (error) {
      console.error('Preview error:', error);
      setPreviewingVoice(null);
      toast.error('Failed to play preview');
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
          voice: selectedVoice.voice_id,
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

      const url = URL.createObjectURL(response.data);
      if (audioPlayer) {
        audioPlayer.pause();
        URL.revokeObjectURL(audioUrl);
      }
      
      setAudioUrl(url);
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
  };

  const filteredAllVoices = allVoices.filter(voice => {
    // Search query filter
    const matchesSearch = !searchQuery || 
      voice.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (voice.labels?.gender && voice.labels.gender.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (voice.labels?.accent && voice.labels.accent.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (voice.labels?.description && voice.labels.description.toLowerCase().includes(searchQuery.toLowerCase()));
    
    // Language filter
    const matchesLanguage = languageFilter === 'all' || 
      (voice.labels?.language && voice.labels.language.toLowerCase().includes(languageFilter.toLowerCase())) ||
      (voice.labels?.accent && languageFilter === 'english' && 
        (voice.labels.accent.toLowerCase().includes('american') || 
         voice.labels.accent.toLowerCase().includes('british') ||
         voice.labels.accent.toLowerCase().includes('australian') ||
         voice.labels.accent.toLowerCase().includes('english'))) ||
      // If no language info but has English accent markers, assume English
      (!voice.labels?.language && languageFilter === 'english' && 
        voice.labels?.use_case && !voice.labels.use_case.includes('multilingual'));
    
    return matchesSearch && matchesLanguage;
  });

  return (
    <div className="min-h-screen bg-[#0a0b0d] text-white">
      <div className="max-w-6xl mx-auto p-6 md:p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-semibold mb-2">Voice Studio</h1>
          <p className="text-sm text-gray-400">Generate natural-sounding speech with AI voices</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Panel */}
          <div className="lg:col-span-2 space-y-6">
            {/* Text Input */}
            <div>
              <Label className="text-sm font-medium mb-3 block">Enter text</Label>
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Type or paste your text here..."
                className="min-h-[160px] resize-none bg-[#13141a] border-gray-800 focus:border-gray-600 text-white"
              />
              <div className="text-xs text-gray-500 mt-2">{text.length} characters</div>
            </div>

            {/* Voice Selection */}
            <div>
              <Label className="text-sm font-medium mb-3 block">Select voice</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {personalVoices.map(voice => (
                  <button
                    key={voice.voice_id}
                    onClick={() => setSelectedVoice(voice)}
                    className={`relative p-4 rounded-lg border-2 transition-all text-left ${
                      selectedVoice?.voice_id === voice.voice_id
                        ? 'border-blue-500 bg-blue-500/10'
                        : 'border-gray-800 hover:border-gray-700'
                    }`}
                  >
                    <div className="font-medium text-sm">{voice.name}</div>
                    <div className="text-xs text-gray-400 mt-1">
                      {voice.labels?.gender || 'Voice'}
                    </div>
                    {personalVoices.length > 3 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFromPersonalVoices(voice.voice_id);
                        }}
                        className="absolute top-2 right-2 p-1 rounded-full hover:bg-gray-700"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Browse All Voices */}
            <div>
              <button
                onClick={() => setShowAllVoices(!showAllVoices)}
                className="flex items-center gap-2 text-sm font-medium text-gray-300 hover:text-white"
              >
                {showAllVoices ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                Browse all voices
              </button>

              {showAllVoices && (
                <div className="mt-4 border border-gray-800 rounded-lg p-4 bg-[#13141a]">
                  <div className="mb-4">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <Input
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search voices..."
                        className="pl-10 bg-[#0a0b0d] border-gray-700 text-white"
                      />
                    </div>
                  </div>

                  <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    {filteredAllVoices.map(voice => (
                      <div
                        key={voice.voice_id}
                        className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-800/50"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm">{voice.name}</div>
                          <div className="text-xs text-gray-400">
                            {voice.labels?.gender || 'Unknown'}
                            {voice.labels?.age && `, ${voice.labels.age}`}
                            {voice.labels?.accent && `, ${voice.labels.accent}`}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {voice.preview_url && (
                            <button
                              onClick={() => playVoicePreview(voice)}
                              disabled={previewingVoice === voice.voice_id}
                              className="p-2 rounded-full hover:bg-gray-700"
                            >
                              {previewingVoice === voice.voice_id ? (
                                <Loader className="w-4 h-4 animate-spin" />
                              ) : (
                                <Volume2 className="w-4 h-4" />
                              )}
                            </button>
                          )}
                          <button
                            onClick={() => addToPersonalVoices(voice)}
                            className="p-2 rounded-full hover:bg-blue-500/20 text-blue-400"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Generate Button */}
            <Button
              onClick={generateSpeech}
              disabled={generating || !selectedVoice || !text.trim()}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-6 text-base font-medium"
            >
              {generating ? (
                <>
                  <Loader className="w-5 h-5 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>Generate</>
              )}
            </Button>

            {audioUrl && (
              <div className="space-y-3">
                <div className="border border-gray-800 rounded-lg p-4">
                  <audio controls src={audioUrl} className="w-full" />
                </div>
                <Button
                  onClick={downloadAudio}
                  className="w-full bg-gray-800 hover:bg-gray-700 text-white"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download
                </Button>
              </div>
            )}
          </div>

          {/* Settings Panel */}
          <div className="space-y-6">
            <div>
              <Label className="text-sm font-medium mb-3 block">Settings</Label>
              
              {/* Quick Presets */}
              <div className="grid grid-cols-3 gap-2 mb-4">
                <button
                  onClick={() => applyPreset('natural')}
                  className="px-3 py-2 text-xs font-medium rounded-lg border border-gray-800 hover:bg-gray-800"
                >
                  Natural
                </button>
                <button
                  onClick={() => applyPreset('expressive')}
                  className="px-3 py-2 text-xs font-medium rounded-lg border border-gray-800 hover:bg-gray-800"
                >
                  Expressive
                </button>
                <button
                  onClick={() => applyPreset('professional')}
                  className="px-3 py-2 text-xs font-medium rounded-lg border border-gray-800 hover:bg-gray-800"
                >
                  Professional
                </button>
              </div>

              {/* Saved Presets */}
              {savedPresets.length > 0 && (
                <div className="mb-4 border border-gray-800 rounded-lg p-3 bg-[#13141a]">
                  <div className="flex items-center gap-2 mb-3">
                    <Star className="w-4 h-4 text-yellow-500" />
                    <Label className="text-xs font-medium">Your Presets</Label>
                  </div>
                  <div className="space-y-2 max-h-[200px] overflow-y-auto">
                    {savedPresets.map(preset => (
                      <div
                        key={preset.id}
                        className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-800/50 group"
                      >
                        <button
                          onClick={() => loadPreset(preset)}
                          className="flex-1 text-left text-sm"
                        >
                          <div className="font-medium">{preset.name}</div>
                          <div className="text-xs text-gray-400">{preset.voice.name}</div>
                        </button>
                        <button
                          onClick={() => deletePreset(preset.id)}
                          className="p-1 rounded hover:bg-red-500/20 text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Save Preset Button */}
              {!showSavePreset ? (
                <Button
                  onClick={() => setShowSavePreset(true)}
                  className="w-full mb-4 bg-purple-600 hover:bg-purple-700 text-white text-sm"
                >
                  <Save className="w-4 h-4 mr-2" />
                  Save as Preset
                </Button>
              ) : (
                <div className="mb-4 border border-gray-800 rounded-lg p-3 bg-[#13141a]">
                  <Input
                    value={presetName}
                    onChange={(e) => setPresetName(e.target.value)}
                    placeholder="Preset name..."
                    className="mb-2 bg-[#0a0b0d] border-gray-700 text-white"
                    onKeyPress={(e) => e.key === 'Enter' && savePreset()}
                  />
                  <div className="flex gap-2">
                    <Button
                      onClick={savePreset}
                      className="flex-1 bg-purple-600 hover:bg-purple-700 text-sm"
                    >
                      Save
                    </Button>
                    <Button
                      onClick={() => {
                        setShowSavePreset(false);
                        setPresetName('');
                      }}
                      className="flex-1 bg-gray-800 hover:bg-gray-700 text-sm"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                {/* Model */}
                <div>
                  <Label className="text-xs text-gray-400 mb-2 block">Model</Label>
                  <Select value={modelId} onValueChange={setModelId}>
                    <SelectTrigger className="bg-[#13141a] border-gray-800">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#1a1d2e] border-gray-700">
                      <SelectItem value="eleven_turbo_v2_5">Turbo v2.5</SelectItem>
                      <SelectItem value="eleven_turbo_v2">Turbo v2</SelectItem>
                      <SelectItem value="eleven_multilingual_v2">Multilingual v2</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Stability */}
                <div>
                  <Label className="text-xs text-gray-400 mb-2 flex justify-between">
                    <span>Stability</span>
                    <span>{stability}</span>
                  </Label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={stability}
                    onChange={(e) => setStability(parseFloat(e.target.value))}
                    className="w-full h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                </div>

                {/* Similarity */}
                <div>
                  <Label className="text-xs text-gray-400 mb-2 flex justify-between">
                    <span>Similarity</span>
                    <span>{similarityBoost}</span>
                  </Label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={similarityBoost}
                    onChange={(e) => setSimilarityBoost(parseFloat(e.target.value))}
                    className="w-full h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                </div>

                {/* Speed */}
                <div>
                  <Label className="text-xs text-gray-400 mb-2 flex justify-between">
                    <span>Speed</span>
                    <span>{speed}x</span>
                  </Label>
                  <input
                    type="range"
                    min="0.7"
                    max="1.2"
                    step="0.05"
                    value={speed}
                    onChange={(e) => setSpeed(parseFloat(e.target.value))}
                    className="w-full h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                </div>

                {/* Speaker Boost */}
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={speakerBoost}
                    onChange={(e) => setSpeakerBoost(e.target.checked)}
                    className="w-4 h-4 accent-blue-500"
                  />
                  <Label className="text-xs text-gray-400">Clarity boost</Label>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VoicesPage;
