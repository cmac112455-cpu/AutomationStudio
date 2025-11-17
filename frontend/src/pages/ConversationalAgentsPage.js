import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Bot, Plus, Play, Pause, Settings, Trash2, Copy, Phone, MessageSquare, Edit2, Save, X, Sparkles, Send, Mic, Square } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

const ConversationalAgentsPage = () => {
  const [agents, setAgents] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showTemplatesModal, setShowTemplatesModal] = useState(false);
  const [editingAgent, setEditingAgent] = useState(null);
  const [availableVoices, setAvailableVoices] = useState([]);
  
  // Test modal state
  const [showTestModal, setShowTestModal] = useState(false);
  const [testingAgent, setTestingAgent] = useState(null);
  const [conversation, setConversation] = useState([]);
  const [userInput, setUserInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [audioChunks, setAudioChunks] = useState([]);
  const [callActive, setCallActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    systemPrompt: '',
    voice: '',
    model: 'gpt-4o',
    firstMessage: '',
    language: 'en',
    maxDuration: 600,
    temperature: 0.7,
    responseDelay: 100,
    enableInterruption: true,
    enableFallback: true,
   });

  const templates = [
    {
      id: 'customer-support',
      name: 'Customer Support Agent',
      icon: '🎧',
      description: 'Handles customer inquiries, resolves issues instantly with empathy and accuracy',
      systemPrompt: 'You are a friendly and professional customer support agent. Your goal is to help customers with their questions and concerns promptly and effectively. Always be empathetic, patient, and clear in your communication.',
      firstMessage: 'Hello! Welcome to customer support. How can I assist you today?',
      model: 'gpt-4o',
      temperature: 0.7
    },
    {
      id: 'sales-assistant',
      name: 'Sales Assistant',
      icon: '💼',
      description: 'Engages leads, qualifies prospects, and schedules appointments',
      systemPrompt: 'You are an enthusiastic sales assistant. Your role is to engage potential customers, understand their needs, qualify leads, and schedule appointments with the sales team. Be persuasive yet respectful.',
      firstMessage: 'Hi! Thanks for your interest in our products. I\'d love to learn more about your needs. What brings you here today?',
      model: 'gpt-4o',
      temperature: 0.8
    },
    {
      id: 'receptionist',
      name: 'AI Receptionist',
      icon: '📞',
      description: 'Manages incoming calls, routes to departments, takes messages',
      systemPrompt: 'You are a professional receptionist for a business. Answer calls politely, help callers reach the right person or department, take messages when needed, and provide general information about the company.',
      firstMessage: 'Good morning! Thank you for calling. How may I direct your call today?',
      model: 'gpt-4o',
      temperature: 0.6
    },
    {
      id: 'medical-assistant',
      name: 'Medical Assistant',
      icon: '🏥',
      description: 'Schedules appointments, answers medical FAQs, provides treatment info',
      systemPrompt: 'You are a medical office assistant. Help patients schedule appointments, answer general questions about services, and provide information about treatments. Never provide medical diagnoses or advice - refer patients to speak with a doctor for medical concerns.',
      firstMessage: 'Hello, welcome to our medical practice. I can help you schedule an appointment or answer questions about our services. How can I assist you?',
      model: 'gpt-4o',
      temperature: 0.5
    },
    {
      id: 'restaurant-host',
      name: 'Restaurant Host',
      icon: '🍽️',
      description: 'Takes reservations, answers menu questions, manages waitlists',
      systemPrompt: 'You are a friendly restaurant host. Take reservations, answer questions about the menu and hours, manage waitlists, and provide information about the restaurant. Be warm and welcoming.',
      firstMessage: 'Hello! Thanks for calling. Would you like to make a reservation or do you have questions about our menu?',
      model: 'gpt-4o',
      temperature: 0.7
    },
    {
      id: 'appointment-scheduler',
      name: 'Appointment Scheduler',
      icon: '📅',
      description: 'Books appointments, sends reminders, handles cancellations',
      systemPrompt: 'You are an appointment scheduling assistant. Help clients book, reschedule, or cancel appointments efficiently. Confirm all details including date, time, and any special requirements.',
      firstMessage: 'Hi! I can help you schedule, change, or cancel an appointment. What would you like to do today?',
      model: 'gpt-4o',
      temperature: 0.6
    }
  ];

  useEffect(() => {
    loadAgents();
    loadVoices();
  }, []);

  const loadAgents = async () => {
    try {
      const response = await axios.get(`${BACKEND_URL}/api/conversational-ai/agents`);
      setAgents(response.data);
    } catch (error) {
      console.error('Error loading agents:', error);
      toast.error('Failed to load agents');
    }
  };

  const loadVoices = async () => {
    try {
      const response = await axios.get(`${BACKEND_URL}/api/tts/voices`);
      setAvailableVoices(response.data.voices || []);
    } catch (error) {
      console.error('Error loading voices:', error);
    }
  };

  const createAgent = async () => {
    if (!formData.name.trim()) {
      toast.error('Agent name is required');
      return;
    }

    try {
      await axios.post(`${BACKEND_URL}/api/conversational-ai/agents`, formData);
      toast.success('Agent created successfully!');
      loadAgents();
      setShowCreateModal(false);
      resetForm();
    } catch (error) {
      toast.error('Failed to create agent');
      console.error(error);
    }
  };

  const updateAgent = async () => {
    try {
      await axios.put(`${BACKEND_URL}/api/conversational-ai/agents/${editingAgent.id}`, formData);
      toast.success('Agent updated successfully!');
      loadAgents();
      setEditingAgent(null);
      resetForm();
    } catch (error) {
      toast.error('Failed to update agent');
      console.error(error);
    }
  };

  const deleteAgent = async (agentId) => {
    if (!window.confirm('Are you sure you want to delete this agent?')) return;

    try {
      await axios.delete(`${BACKEND_URL}/api/conversational-ai/agents/${agentId}`);
      toast.success('Agent deleted');
      loadAgents();
    } catch (error) {
      toast.error('Failed to delete agent');
      console.error(error);
    }
  };

  const duplicateAgent = async (agent) => {
    try {
      const duplicated = { ...agent, name: `${agent.name} (Copy)` };
      delete duplicated.id;
      await axios.post(`${BACKEND_URL}/api/conversational-ai/agents`, duplicated);
      toast.success('Agent duplicated successfully!');
      loadAgents();
    } catch (error) {
      toast.error('Failed to duplicate agent');
    }
  };

  const applyTemplate = (template) => {
    setFormData({
      ...formData,
      name: template.name,
      description: template.description,
      systemPrompt: template.systemPrompt,
      firstMessage: template.firstMessage,
      model: template.model,
      temperature: template.temperature
    });
    setShowTemplatesModal(false);
    setShowCreateModal(true);
    toast.success(`Template "${template.name}" applied!`);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      systemPrompt: '',
      voice: '',
      model: 'gpt-4o',
      firstMessage: '',
      language: 'en',
      maxDuration: 600,
      temperature: 0.7,
      responseDelay: 100,
      enableInterruption: true,
      enableFallback: true
    });
  };

  const openEditModal = (agent) => {
    setFormData(agent);
    setEditingAgent(agent);
  };

  const startTest = (agent) => {
    setTestingAgent(agent);
    setShowTestModal(true);
    setConversation([]);
    setCallActive(false);
    setIsConnecting(false);
  };

  const initiateCall = async () => {
    if (!testingAgent) return;
    
    setIsConnecting(true);
    
    try {
      // Start call session
      const response = await axios.post(`${BACKEND_URL}/api/conversational-ai/agents/${testingAgent.id}/start-call`);
      
      setCallActive(true);
      setIsConnecting(false);
      toast.success('Connected!');
      
      // Agent greets immediately if first message exists
      if (testingAgent.firstMessage) {
        setIsSending(true);
        
        // Generate audio for first message
        const greetingResponse = await axios.post(`${BACKEND_URL}/api/conversational-ai/agents/${testingAgent.id}/greeting`);
        
        const agentMessage = {
          role: 'agent',
          content: testingAgent.firstMessage,
          audio_url: greetingResponse.data.audio_url,
          timestamp: new Date().toISOString()
        };
        
        setConversation([agentMessage]);
        setIsSending(false);
        
        // Auto-play greeting
        if (greetingResponse.data.audio_url) {
          const audio = new Audio(greetingResponse.data.audio_url);
          audio.onplay = () => setAudioPlaying(true);
          audio.onended = () => {
            setAudioPlaying(false);
            // Auto-start listening after agent finishes speaking
            setTimeout(() => {
              if (callActive) {
                startRecording();
              }
            }, 500);
          };
          audio.play();
        } else {
          // No audio, just start listening
          setTimeout(() => startRecording(), 500);
        }
      } else {
        // No greeting, start listening immediately
        setTimeout(() => startRecording(), 500);
      }
      
    } catch (error) {
      console.error('Error starting call:', error);
      toast.error('Failed to connect');
      setIsConnecting(false);
    }
  };

  const endCall = () => {
    if (isRecording) stopRecording();
    if (mediaRecorder) {
      mediaRecorder.stream.getTracks().forEach(track => track.stop());
    }
    setCallActive(false);
    setShowTestModal(false);
    setTestingAgent(null);
    setConversation([]);
    toast.success('Call ended');
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(chunks, { type: 'audio/webm' });
        await processVoiceInput(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setMediaRecorder(recorder);
      setAudioChunks(chunks);
      setIsRecording(true);
      toast.success('Recording... Speak now');
    } catch (error) {
      console.error('Error starting recording:', error);
      toast.error('Could not access microphone');
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      setIsRecording(false);
      setMediaRecorder(null);
    }
  };

  const processVoiceInput = async (audioBlob) => {
    setIsSending(true);

    try {
      // Convert audio to base64
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      
      reader.onloadend = async () => {
        const base64Audio = reader.result.split(',')[1];

        // Send to backend for speech-to-text and processing
        const response = await axios.post(`${BACKEND_URL}/api/conversational-ai/agents/${testingAgent.id}/voice-chat`, {
          audio: base64Audio,
          conversation_history: conversation
        });

        // Add user message (transcribed)
        const userMessage = {
          role: 'user',
          content: response.data.transcription,
          timestamp: new Date().toISOString()
        };
        setConversation(prev => [...prev, userMessage]);

        // Add agent response
        const agentMessage = {
          role: 'agent',
          content: response.data.response,
          audio_url: response.data.audio_url,
          timestamp: new Date().toISOString()
        };
        setConversation(prev => [...prev, agentMessage]);

        // Auto-play audio response
        if (response.data.audio_url) {
          const audio = new Audio(response.data.audio_url);
          audio.onplay = () => setAudioPlaying(true);
          audio.onended = () => {
            setAudioPlaying(false);
            // Auto-restart listening after agent finishes (seamless conversation)
            setTimeout(() => {
              if (callActive && !isRecording) {
                startRecording();
              }
            }, 500);
          };
          audio.play();
        } else {
          // No audio, restart listening immediately
          setTimeout(() => {
            if (callActive && !isRecording) {
              startRecording();
            }
          }, 500);
        }
      };

    } catch (error) {
      console.error('Error processing voice:', error);
      toast.error('Failed to process voice input');
      // Still restart listening on error
      setTimeout(() => {
        if (callActive && !isRecording) {
          startRecording();
        }
      }, 1000);
    } finally {
      setIsSending(false);
    }
  };

  const sendMessage = async () => {
    if (!userInput.trim() || isSending) return;

    const userMessage = {
      role: 'user',
      content: userInput.trim(),
      timestamp: new Date().toISOString()
    };

    setConversation(prev => [...prev, userMessage]);
    setUserInput('');
    setIsSending(true);

    try {
      const response = await axios.post(`${BACKEND_URL}/api/conversational-ai/agents/${testingAgent.id}/chat`, {
        message: userMessage.content,
        conversation_history: conversation
      });

      const agentMessage = {
        role: 'agent',
        content: response.data.response,
        audio_url: response.data.audio_url,
        timestamp: new Date().toISOString()
      };

      setConversation(prev => [...prev, agentMessage]);

      // Auto-play audio response if available
      if (response.data.audio_url) {
        const audio = new Audio(response.data.audio_url);
        audio.onplay = () => setAudioPlaying(true);
        audio.onended = () => setAudioPlaying(false);
        audio.play();
      }

    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to get response from agent');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0b0d] text-white">
      {/* Header */}
      <div className="border-b border-gray-800 bg-[#13141a] sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center shadow-lg shadow-cyan-500/20">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-semibold">Conversational Agents</h1>
                <p className="text-sm text-gray-400">Create AI voice agents for calls and chats</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => setShowTemplatesModal(true)}
                className="bg-gray-700 hover:bg-gray-600"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Templates
              </Button>
              <Button
                onClick={() => {
                  resetForm();
                  setShowCreateModal(true);
                }}
                className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Agent
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {agents.length === 0 ? (
          // Empty State
          <div className="text-center py-20">
            <div className="w-20 h-20 rounded-full bg-cyan-500/10 flex items-center justify-center mx-auto mb-6">
              <Bot className="w-10 h-10 text-cyan-400" />
            </div>
            <h3 className="text-2xl font-semibold mb-2">No agents yet</h3>
            <p className="text-gray-400 mb-6">Create your first conversational AI agent to get started</p>
            <div className="flex gap-3 justify-center">
              <Button
                onClick={() => setShowTemplatesModal(true)}
                className="bg-gray-700 hover:bg-gray-600"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Browse Templates
              </Button>
              <Button
                onClick={() => setShowCreateModal(true)}
                className="bg-gradient-to-r from-cyan-500 to-blue-500"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create from Scratch
              </Button>
            </div>
          </div>
        ) : (
          // Agents Grid
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {agents.map((agent) => (
              <div
                key={agent.id}
                className="bg-[#13141a] rounded-xl border border-gray-800 p-6 hover:border-cyan-500/50 transition-all group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center">
                    <Bot className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => openEditModal(agent)}
                      className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
                    >
                      <Edit2 className="w-4 h-4 text-gray-400" />
                    </button>
                    <button
                      onClick={() => duplicateAgent(agent)}
                      className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
                    >
                      <Copy className="w-4 h-4 text-gray-400" />
                    </button>
                    <button
                      onClick={() => deleteAgent(agent.id)}
                      className="p-2 hover:bg-red-500/20 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </button>
                  </div>
                </div>

                <h3 className="text-lg font-semibold mb-2">{agent.name}</h3>
                <p className="text-sm text-gray-400 mb-4 line-clamp-2">{agent.description || 'No description'}</p>

                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>{agent.model || 'gpt-4o'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <Phone className="w-3.5 h-3.5" />
                    <span>{agent.language || 'en'} • {agent.voice || 'Default Voice'}</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={() => startTest(agent)}
                    className="flex-1 bg-cyan-600 hover:bg-cyan-700 text-sm"
                    size="sm"
                  >
                    <Play className="w-3.5 h-3.5 mr-2" />
                    Test
                  </Button>
                  <Button
                    onClick={() => openEditModal(agent)}
                    className="flex-1 bg-gray-700 hover:bg-gray-600 text-sm"
                    size="sm"
                  >
                    <Settings className="w-3.5 h-3.5 mr-2" />
                    Configure
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Templates Modal */}
      {showTemplatesModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#13141a] rounded-xl border border-gray-800 w-full max-w-4xl max-h-[80vh] overflow-y-auto">
            <div className="sticky top-0 bg-[#13141a] border-b border-gray-800 p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-semibold">Agent Templates</h2>
                <button
                  onClick={() => setShowTemplatesModal(false)}
                  className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              {templates.map((template) => (
                <div
                  key={template.id}
                  onClick={() => applyTemplate(template)}
                  className="bg-[#0a0b0d] rounded-lg border border-gray-800 p-6 hover:border-cyan-500/50 transition-all cursor-pointer group"
                >
                  <div className="flex items-start gap-4 mb-3">
                    <div className="text-3xl">{template.icon}</div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold mb-1">{template.name}</h3>
                      <p className="text-sm text-gray-400">{template.description}</p>
                    </div>
                  </div>
                  <div className="text-xs text-gray-500">
                    Model: {template.model} • Temperature: {template.temperature}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Agent Modal */}
      {(showCreateModal || editingAgent) && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#13141a] rounded-xl border border-gray-800 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-[#13141a] border-b border-gray-800 p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-semibold">
                  {editingAgent ? 'Edit Agent' : 'Create New Agent'}
                </h2>
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setEditingAgent(null);
                    resetForm();
                  }}
                  className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Basic Info */}
              <div>
                <Label className="text-white mb-2 block">Agent Name *</Label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  placeholder="e.g., Customer Support Agent"
                  className="w-full px-4 py-2 bg-[#0a0b0d] border border-gray-700 rounded-lg text-white focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div>
                <Label className="text-white mb-2 block">Description</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  placeholder="Brief description of what this agent does..."
                  className="bg-[#0a0b0d] border-gray-700 text-white min-h-[80px]"
                />
              </div>

              {/* System Prompt */}
              <div>
                <Label className="text-white mb-2 block">System Prompt *</Label>
                <Textarea
                  value={formData.systemPrompt}
                  onChange={(e) => setFormData({...formData, systemPrompt: e.target.value})}
                  placeholder="Define how your agent should behave and respond..."
                  className="bg-[#0a0b0d] border-gray-700 text-white min-h-[150px]"
                />
                <p className="text-xs text-gray-500 mt-1">This defines your agent's personality and behavior</p>
              </div>

              {/* First Message */}
              <div>
                <Label className="text-white mb-2 block">First Message</Label>
                <input
                  type="text"
                  value={formData.firstMessage}
                  onChange={(e) => setFormData({...formData, firstMessage: e.target.value})}
                  placeholder="e.g., Hello! How can I help you today?"
                  className="w-full px-4 py-2 bg-[#0a0b0d] border border-gray-700 rounded-lg text-white focus:border-cyan-500 focus:outline-none"
                />
                <p className="text-xs text-gray-500 mt-1">Leave empty to wait for user to speak first</p>
              </div>

              {/* Voice and Model */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-white mb-2 block">Voice</Label>
                  <Select value={formData.voice} onValueChange={(value) => setFormData({...formData, voice: value})}>
                    <SelectTrigger className="bg-[#0a0b0d] border-gray-700">
                      <SelectValue placeholder="Select voice" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#1a1d2e] border-gray-700">
                      {availableVoices.map((voice) => (
                        <SelectItem key={voice.voice_id} value={voice.voice_id}>
                          {voice.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-white mb-2 block">Language Model</Label>
                  <Select value={formData.model} onValueChange={(value) => setFormData({...formData, model: value})}>
                    <SelectTrigger className="bg-[#0a0b0d] border-gray-700">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#1a1d2e] border-gray-700">
                      <SelectItem value="gpt-4o">GPT-4o (Recommended)</SelectItem>
                      <SelectItem value="gpt-4o-mini">GPT-4o Mini (Faster)</SelectItem>
                      <SelectItem value="gpt-4-turbo">GPT-4 Turbo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Language */}
              <div>
                <Label className="text-white mb-2 block">Language</Label>
                <Select value={formData.language} onValueChange={(value) => setFormData({...formData, language: value})}>
                  <SelectTrigger className="bg-[#0a0b0d] border-gray-700">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1a1d2e] border-gray-700">
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="es">Spanish</SelectItem>
                    <SelectItem value="fr">French</SelectItem>
                    <SelectItem value="de">German</SelectItem>
                    <SelectItem value="it">Italian</SelectItem>
                    <SelectItem value="pt">Portuguese</SelectItem>
                    <SelectItem value="zh">Chinese</SelectItem>
                    <SelectItem value="ja">Japanese</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Advanced Settings */}
              <div>
                <Label className="text-white mb-2 block">Temperature: {formData.temperature}</Label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={formData.temperature}
                  onChange={(e) => setFormData({...formData, temperature: parseFloat(e.target.value)})}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                />
                <p className="text-xs text-gray-500 mt-1">Lower = more focused, Higher = more creative</p>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <Button
                  onClick={editingAgent ? updateAgent : createAgent}
                  className="flex-1 bg-gradient-to-r from-cyan-500 to-blue-500"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {editingAgent ? 'Update Agent' : 'Create Agent'}
                </Button>
                <Button
                  onClick={() => {
                    setShowCreateModal(false);
                    setEditingAgent(null);
                    resetForm();
                  }}
                  className="flex-1 bg-gray-700 hover:bg-gray-600"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Test Agent Modal - Phone Call Interface */}
      {showTestModal && testingAgent && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-xl flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-b from-gray-900 to-black rounded-3xl border border-gray-800 w-full max-w-md shadow-2xl shadow-cyan-500/20 flex flex-col"
            style={{ height: '600px' }}>
            
            {/* Phone Header */}
            <div className="p-8 text-center flex-shrink-0">
              <div className="mb-6">
                <div className="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center shadow-lg shadow-cyan-500/50 mb-4">
                  <Bot className="w-12 h-12 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-1">{testingAgent.name}</h2>
                <p className="text-sm text-gray-400">{testingAgent.description || 'AI Assistant'}</p>
              </div>

              {/* Call Status */}
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gray-800/50 border border-gray-700">
                {isRecording ? (
                  <>
                    <span className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></span>
                    <span className="text-sm text-red-400 font-medium">On Call</span>
                  </>
                ) : isSending ? (
                  <>
                    <span className="w-3 h-3 bg-yellow-500 rounded-full animate-pulse"></span>
                    <span className="text-sm text-yellow-400 font-medium">Processing...</span>
                  </>
                ) : (
                  <>
                    <span className="w-3 h-3 bg-green-500 rounded-full"></span>
                    <span className="text-sm text-green-400 font-medium">Ready</span>
                  </>
                )}
              </div>
            </div>

            {/* Empty space for clean phone look */}
            <div className="flex-1 flex items-center justify-center px-6">
              <div className="text-center">
                {callActive && (
                  <div className="space-y-4">
                    {/* Audio wave visualization */}
                    <div className="flex items-center justify-center gap-2 h-16">
                      {[...Array(5)].map((_, i) => (
                        <div
                          key={i}
                          className={`w-1 rounded-full transition-all duration-300 ${
                            isRecording
                              ? 'bg-red-500 animate-pulse'
                              : audioPlaying || isSending
                              ? 'bg-cyan-500 animate-pulse'
                              : 'bg-gray-700'
                          }`}
                          style={{
                            height: isRecording || audioPlaying || isSending
                              ? `${Math.random() * 40 + 20}px`
                              : '8px',
                            animationDelay: `${i * 0.1}s`
                          }}
                        />
                      ))}
                    </div>
                    <p className="text-sm text-gray-500">
                      {conversation.length > 0 && `${Math.floor(conversation.length / 2)} exchanges`}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Phone Controls */}
            <div className="p-8 flex-shrink-0">
              {!callActive ? (
                /* Start Call Screen */
                <div className="text-center">
                  <button
                    onClick={initiateCall}
                    disabled={isConnecting}
                    className={`w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center transition-all shadow-2xl ${
                      isConnecting
                        ? 'bg-yellow-600 animate-pulse'
                        : 'bg-gradient-to-br from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 hover:scale-110'
                    } shadow-green-500/50`}
                  >
                    <Phone className="w-8 h-8 text-white" />
                  </button>
                  <p className="text-center text-sm text-gray-400 mb-4">
                    {isConnecting ? (
                      <span className="text-yellow-400 font-medium">Connecting...</span>
                    ) : (
                      <span>Tap to call {testingAgent.name}</span>
                    )}
                  </p>
                  <button
                    onClick={() => {
                      setShowTestModal(false);
                      setTestingAgent(null);
                    }}
                    className="w-full py-3 rounded-full bg-gray-700 hover:bg-gray-600 text-white font-medium transition-all flex items-center justify-center gap-2"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                /* Active Call Screen */
                <>
                  <div className="flex items-center justify-center gap-6 mb-6">
                    {/* Microphone Indicator (Visual Only - Auto Recording) */}
                    <div
                      className={`w-20 h-20 rounded-full flex items-center justify-center transition-all shadow-2xl ${
                        isRecording
                          ? 'bg-red-600 animate-pulse shadow-red-500/50'
                          : isSending
                          ? 'bg-yellow-600 animate-pulse shadow-yellow-500/50'
                          : 'bg-gradient-to-br from-cyan-500 to-blue-500 shadow-cyan-500/50'
                      }`}
                    >
                      {isRecording ? (
                        <Mic className="w-8 h-8 text-white" />
                      ) : isSending ? (
                        <Bot className="w-8 h-8 text-white" />
                      ) : (
                        <Mic className="w-8 h-8 text-white" />
                      )}
                    </div>
                  </div>

                  <p className="text-center text-sm text-gray-400 mb-4">
                    {isRecording ? (
                      <span className="text-red-400 font-medium">Listening...</span>
                    ) : isSending ? (
                      <span className="text-yellow-400">{testingAgent.name} is speaking...</span>
                    ) : audioPlaying ? (
                      <span className="text-cyan-400">{testingAgent.name} is speaking...</span>
                    ) : (
                      <span className="text-green-400">In call with {testingAgent.name}</span>
                    )}
                  </p>

                  {/* End Call Button */}
                  <button
                    onClick={endCall}
                    className="w-full py-3 rounded-full bg-red-600 hover:bg-red-700 text-white font-medium transition-all flex items-center justify-center gap-2 shadow-lg shadow-red-500/30"
                  >
                    <Phone className="w-4 h-4 rotate-[135deg]" />
                    End Call
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConversationalAgentsPage;
