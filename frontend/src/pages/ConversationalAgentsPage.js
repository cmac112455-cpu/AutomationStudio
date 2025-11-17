import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Bot, Plus, Play, Pause, Settings, Trash2, Copy, Phone, MessageSquare, Edit2, Save, X, Sparkles, Send, Mic, Square, RefreshCw, TrendingUp, Users, Clock, Activity, Filter, Calendar, ChevronDown, ChevronUp } from 'lucide-react';
import { useConversation } from '@elevenlabs/react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

const ConversationalAgentsPage = () => {
  const [agents, setAgents] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showTemplatesModal, setShowTemplatesModal] = useState(false);
  const [editingAgent, setEditingAgent] = useState(null);
  const [availableVoices, setAvailableVoices] = useState([]);
  const [activeTab, setActiveTab] = useState('agent'); // agent, knowledge, tools, analysis, settings
  const [knowledgeBase, setKnowledgeBase] = useState([]);
  const [tools, setTools] = useState([]);
  const [uploadingFile, setUploadingFile] = useState(false);
  
  // Test modal state
  const [showTestModal, setShowTestModal] = useState(false);
  const [testingAgent, setTestingAgent] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [conversation, setConversation] = useState([]);
  const [callActive, setCallActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  
  // Audio/Recording state
  const [audioLevel, setAudioLevel] = useState(0);
  const [micWorking, setMicWorking] = useState(false);
  const [currentCallLogId, setCurrentCallLogId] = useState(null);
  const [isSending, setIsSending] = useState(false);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [userInput, setUserInput] = useState('');
  
  // Refs for audio processing
  const audioContextRef = useRef(null);
  const audioChunksBuffer = useRef([]);
  
  // ElevenLabs Conversation Hook
  const elevenlabsConversation = useConversation();
  
  // Analytics state
  const [analyticsData, setAnalyticsData] = useState(null);
  const [conversationsData, setConversationsData] = useState([]);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [showConversationModal, setShowConversationModal] = useState(false);
  const [analyticsTimeRange, setAnalyticsTimeRange] = useState('week'); // day, week, month
  const [conversationFilters, setConversationFilters] = useState({
    minDuration: '',
    maxDuration: '',
    startDate: '',
    endDate: ''
  });
  const [analysisSection, setAnalysisSection] = useState('evaluation'); // evaluation, data-collection, analytics
  const [evaluationCriteria, setEvaluationCriteria] = useState([]);
  const [dataCollectionItems, setDataCollectionItems] = useState([]);
  const [showAddCriteriaModal, setShowAddCriteriaModal] = useState(false);
  const [showAddDataItemModal, setShowAddDataItemModal] = useState(false);
  const [editingCriteria, setEditingCriteria] = useState(null);
  const [editingDataItem, setEditingDataItem] = useState(null);
  const [criteriaForm, setCriteriaForm] = useState({ identifier: '', description: '' });
  const [dataItemForm, setDataItemForm] = useState({ 
    identifier: '', 
    data_type: 'string', 
    description: '' 
  });
  
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
    elevenlabs_agent_id: '',
    kb_text_name: '',
    kb_text_content: ''
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

  const syncElevenLabsAgents = async () => {
    setSyncing(true);
    try {
      console.log('🔄 Syncing agents from ElevenLabs...');
      const response = await axios.post(`${BACKEND_URL}/api/conversational-ai/sync-elevenlabs-agents`);
      
      console.log('✅ Sync complete:', response.data);
      toast.success(`Synced ${response.data.synced} new agents, updated ${response.data.updated} existing agents!`);
      
      // Reload agents
      await loadAgents();
    } catch (error) {
      console.error('❌ Error syncing agents:', error);
      const errorMsg = error.response?.data?.detail || error.message || 'Failed to sync agents';
      toast.error(errorMsg);
    } finally {
      setSyncing(false);
    }
  };

  // Analytics functions
  const loadAnalytics = async (agentId) => {
    if (!agentId) return;
    
    setLoadingAnalytics(true);
    try {
      // Fetch usage analytics
      const usageResponse = await axios.get(
        `${BACKEND_URL}/api/conversational-ai/agents/${agentId}/analytics/usage`,
        {
          params: {
            aggregation_interval: analyticsTimeRange
          }
        }
      );
      
      // Fetch conversations list
      const conversationsResponse = await axios.get(
        `${BACKEND_URL}/api/conversational-ai/agents/${agentId}/analytics/conversations`,
        {
          params: {
            page_size: 50,
            ...conversationFilters
          }
        }
      );
      
      setAnalyticsData(usageResponse.data);
      setConversationsData(conversationsResponse.data.conversations || []);
      
      console.log('📊 Analytics loaded:', usageResponse.data);
      console.log('💬 Conversations loaded:', conversationsResponse.data);
    } catch (error) {
      console.error('Error loading analytics:', error);
      const errorMsg = error.response?.data?.detail || 'Failed to load analytics';
      
      // Only show error if it's not a "not linked to ElevenLabs" error
      if (!errorMsg.includes('not linked')) {
        toast.error(errorMsg);
      }
      
      // Set empty data so UI shows properly
      setAnalyticsData(null);
      setConversationsData([]);
    } finally {
      setLoadingAnalytics(false);
    }
  };

  const loadConversationDetails = async (agentId, conversationId) => {
    try {
      const response = await axios.get(
        `${BACKEND_URL}/api/conversational-ai/agents/${agentId}/analytics/conversations/${conversationId}`
      );
      
      setSelectedConversation(response.data);
      setShowConversationModal(true);
      console.log('💬 Conversation details:', response.data);
    } catch (error) {
      console.error('Error loading conversation details:', error);
      toast.error('Failed to load conversation details');
    }
  };

  // Load agent analysis config (evaluation criteria & data collection)
  const loadAgentAnalysisConfig = async (agentId) => {
    if (!agentId) return;
    
    try {
      const response = await axios.get(`${BACKEND_URL}/api/conversational-ai/agents/${agentId}/analysis-config`);
      const config = response.data;
      
      console.log('📋 Analysis config loaded:', config);
      
      // Ensure arrays
      const criteria = Array.isArray(config.evaluation_criteria) ? config.evaluation_criteria : [];
      const dataItems = Array.isArray(config.data_collection) ? config.data_collection : [];
      
      setEvaluationCriteria(criteria);
      setDataCollectionItems(dataItems);
      
      console.log('📋 Set evaluation criteria:', criteria);
      console.log('📋 Set data collection items:', dataItems);
    } catch (error) {
      console.error('Error loading analysis config:', error);
      console.error('Error details:', error.response);
      // Set empty arrays if error
      setEvaluationCriteria([]);
      setDataCollectionItems([]);
    }
  };

  // Add evaluation criteria
  const addEvaluationCriteria = async () => {
    if (!editingAgent?.elevenlabs_agent_id) {
      toast.error('Agent must be synced with ElevenLabs first');
      return;
    }

    if (!criteriaForm.identifier || !criteriaForm.description) {
      toast.error('Please fill in all fields');
      return;
    }

    if (evaluationCriteria.length >= 30) {
      toast.error('Maximum 30 evaluation criteria allowed');
      return;
    }

    try {
      const updatedCriteria = editingCriteria
        ? evaluationCriteria.map(c => c.identifier === editingCriteria.identifier ? criteriaForm : c)
        : [...evaluationCriteria, criteriaForm];

      console.log('🔄 Saving evaluation criteria:', updatedCriteria);
      
      const response = await axios.patch(`${BACKEND_URL}/api/conversational-ai/agents/${editingAgent.id}/analysis-config`, {
        evaluation_criteria: updatedCriteria
      });

      console.log('✅ Evaluation criteria saved:', response.data);

      setEvaluationCriteria(updatedCriteria);
      setShowAddCriteriaModal(false);
      setCriteriaForm({ identifier: '', description: '' });
      setEditingCriteria(null);
      toast.success(editingCriteria ? 'Criteria updated in ElevenLabs!' : 'Criteria added to ElevenLabs!');
      
      // Reload config to verify
      await loadAgentAnalysisConfig(editingAgent.id);
    } catch (error) {
      console.error('❌ Error saving criteria:', error);
      console.error('Error response:', error.response);
      toast.error(error.response?.data?.detail || 'Failed to save criteria');
    }
  };

  // Delete evaluation criteria
  const deleteEvaluationCriteria = async (identifier) => {
    if (!editingAgent?.elevenlabs_agent_id) return;

    try {
      const updatedCriteria = evaluationCriteria.filter(c => c.identifier !== identifier);

      await axios.patch(`${BACKEND_URL}/api/conversational-ai/agents/${editingAgent.id}/analysis-config`, {
        evaluation_criteria: updatedCriteria
      });

      setEvaluationCriteria(updatedCriteria);
      toast.success('Criteria deleted successfully');
    } catch (error) {
      console.error('Error deleting criteria:', error);
      toast.error('Failed to delete criteria');
    }
  };

  // Add data collection item
  const addDataCollectionItem = async () => {
    if (!editingAgent?.elevenlabs_agent_id) {
      toast.error('Agent must be synced with ElevenLabs first');
      return;
    }

    if (!dataItemForm.identifier || !dataItemForm.description) {
      toast.error('Please fill in all fields');
      return;
    }

    const maxItems = 40; // Could be 25 depending on plan
    if (dataCollectionItems.length >= maxItems) {
      toast.error(`Maximum ${maxItems} data collection items allowed`);
      return;
    }

    try {
      const updatedItems = editingDataItem
        ? dataCollectionItems.map(item => item.identifier === editingDataItem.identifier ? dataItemForm : item)
        : [...dataCollectionItems, dataItemForm];

      console.log('🔄 Saving data collection items:', updatedItems);
      
      const response = await axios.patch(`${BACKEND_URL}/api/conversational-ai/agents/${editingAgent.id}/analysis-config`, {
        data_collection: updatedItems
      });

      console.log('✅ Data collection saved:', response.data);

      setDataCollectionItems(updatedItems);
      setShowAddDataItemModal(false);
      setDataItemForm({ identifier: '', data_type: 'string', description: '' });
      setEditingDataItem(null);
      toast.success(editingDataItem ? 'Data item updated in ElevenLabs!' : 'Data item added to ElevenLabs!');
      
      // Reload config to verify
      await loadAgentAnalysisConfig(editingAgent.id);
    } catch (error) {
      console.error('❌ Error saving data item:', error);
      console.error('Error response:', error.response);
      toast.error(error.response?.data?.detail || 'Failed to save data item');
    }
  };

  // Delete data collection item
  const deleteDataCollectionItem = async (identifier) => {
    if (!editingAgent?.elevenlabs_agent_id) return;

    try {
      const updatedItems = dataCollectionItems.filter(item => item.identifier !== identifier);

      await axios.patch(`${BACKEND_URL}/api/conversational-ai/agents/${editingAgent.id}/analysis-config`, {
        data_collection: updatedItems
      });

      setDataCollectionItems(updatedItems);
      toast.success('Data item deleted successfully');
    } catch (error) {
      console.error('Error deleting data item:', error);
      toast.error('Failed to delete data item');
    }
  };

  // Load analytics when Analysis tab is opened
  useEffect(() => {
    if (activeTab === 'analysis' && editingAgent?.id) {
      loadAgentAnalysisConfig(editingAgent.id);
      if (analysisSection === 'analytics') {
        loadAnalytics(editingAgent.id);
      }
    }
  }, [activeTab, editingAgent?.id, analyticsTimeRange, analysisSection]);

  const loadKnowledgeBase = async () => {
    try {
      const response = await axios.get(`${BACKEND_URL}/api/conversational-ai/knowledge-base/list`);
      setKnowledgeBase(response.data.knowledge_base || []);
    } catch (error) {
      console.error('Error loading knowledge base:', error);
      // Don't show error toast if API key not configured yet
      if (error.response?.status !== 400) {
        toast.error('Failed to load knowledge base');
      }
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
      enableFallback: true,
      elevenlabs_agent_id: '',
      kb_text_name: '',
      kb_text_content: ''
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

  // testMicrophone function removed - using ElevenLabs SDK

  const initiateCall = async () => {
    if (!testingAgent) return;
    
    if (!testingAgent.elevenlabs_agent_id) {
      toast.error('Please add an ElevenLabs Agent ID to this agent first');
      return;
    }
    
    setIsConnecting(true);
    console.log('📞 Starting ElevenLabs conversation...');
    console.log('Agent ID:', testingAgent.elevenlabs_agent_id);
    
    try {
      // Start ElevenLabs conversation
      const conversationId = await elevenlabsConversation.startSession({
        agentId: testingAgent.elevenlabs_agent_id,
      });
      
      console.log('✅ ElevenLabs session started:', conversationId);
      setCallActive(true);
      setIsConnecting(false);
      toast.success('🎤 Connected! Speak now!');
      
      // Log the call start
      try {
        await axios.post(`${BACKEND_URL}/api/conversational-ai/call-logs`, {
          agent_id: testingAgent.id,
          agent_name: testingAgent.name,
          status: 'started',
          backend_logs: {
            using_elevenlabs_sdk: true,
            session_id: conversationId
          }
        });
      } catch (logError) {
        console.error('Failed to log call:', logError);
      }
      
    } catch (error) {
      console.error('❌ Failed to start ElevenLabs session:', error);
      toast.error('Failed to start call: ' + error.message);
      setIsConnecting(false);
    }
  };

  const endCall = async () => {
    console.log('📞 Ending ElevenLabs call...');
    
    try {
      // End ElevenLabs conversation
      await elevenlabsConversation.endSession();
      console.log('✅ ElevenLabs session ended');
    } catch (error) {
      console.error('Error ending ElevenLabs session:', error);
    }
    
    // Log call completion
    try {
      await axios.post(`${BACKEND_URL}/api/conversational-ai/call-logs`, {
        agent_id: testingAgent?.id,
        agent_name: testingAgent?.name,
        status: 'completed',
        backend_logs: {
          using_elevenlabs_sdk: true,
          session_ended: true
        }
      });
    } catch (logError) {
      console.error('Failed to log call end:', logError);
    }
    
    setCallActive(false);
    setShowTestModal(false);
    setTestingAgent(null);
    setConversation([]);
    toast.success('Call ended');
  };

  const startRecording = async () => {
    if (!callActive) {
      console.log('❌ Cannot start recording: call not active');
      return;
    }
    
    if (isRecording) {
      console.log('❌ Cannot start recording: already recording');
      return;
    }
    
    if (isSending) {
      console.log('❌ Cannot start recording: still sending/processing');
      return;
    }
    
    console.log('🎙️ Using Web Audio API for recording (MediaRecorder compatibility issue)...');
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000
        } 
      });
      
      console.log('✅ Microphone access granted');
      
      // Use Web Audio API to capture audio
      const audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
      audioContextRef.current = audioContext;
      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      
      audioChunksBuffer.current = [];
      
      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        // Convert Float32Array to Int16Array for WAV
        const int16Data = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          int16Data[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        audioChunksBuffer.current.push(int16Data);
      };
      
      source.connect(processor);
      processor.connect(audioContext.destination);
      
      // Add visual feedback with analyser
      const analyser = audioContext.createAnalyser();
      source.connect(analyser);
      analyser.fftSize = 256;
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      
      // Monitor audio level for visual feedback
      const levelCheckInterval = setInterval(() => {
        analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
        setAudioLevel(Math.min(100, average));
        if (average > 5) setMicWorking(true);
      }, 100);
      
      setIsRecording(true);
      toast.success('🎤 Recording with Web Audio API!', { duration: 10000 });
      console.log('🔴 Recording active - SPEAK NOW!');
      
      // Store stream and processor for cleanup
      setMediaRecorder({ stream, processor, levelCheckInterval });
      
      // Auto-stop after 10 seconds
      setTimeout(() => {
        if (isRecording) {
          console.log('⏱️ Auto-stopping after 10s');
          stopRecording();
        }
      }, 10000);
      
    } catch (error) {
      console.error('❌ Recording error:', error);
      console.error('Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
      toast.error('Microphone error: ' + error.message, { duration: 5000 });
      setIsRecording(false);
      setMediaRecorder(null);
    }
  };

  const stopRecording = async () => {
    if (!mediaRecorder) return;
    
    console.log('🛑 Stopping Web Audio recording...');
    
    const { stream, processor, levelCheckInterval } = mediaRecorder;
    
    // Stop processor
    if (processor) {
      processor.disconnect();
    }
    
    // Stop stream
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    
    // Clear interval
    if (levelCheckInterval) {
      clearInterval(levelCheckInterval);
    }
    
    setIsRecording(false);
    setMediaRecorder(null);
    setAudioLevel(0);
    setMicWorking(false);
    
    // Process the captured audio
    const audioChunks = audioChunksBuffer.current;
    console.log('📊 Captured audio chunks:', audioChunks.length);
    
    if (audioChunks.length === 0) {
      console.error('❌ No audio data captured!');
      toast.error('No audio recorded');
      return;
    }
    
    // Calculate total length
    const totalLength = audioChunks.reduce((acc, chunk) => acc + chunk.length, 0);
    console.log('📊 Total audio samples:', totalLength);
    
    // Merge all chunks
    const mergedAudio = new Int16Array(totalLength);
    let offset = 0;
    for (const chunk of audioChunks) {
      mergedAudio.set(chunk, offset);
      offset += chunk.length;
    }
    
    // Create WAV file
    const wavBlob = createWavBlob(mergedAudio, 16000);
    console.log('🎵 WAV blob created:', wavBlob.size, 'bytes');
    
    if (wavBlob.size < 1000) {
      console.error('❌ Audio too small');
      toast.error('Audio too short. Please speak for at least 3 seconds.');
      setTimeout(() => {
        if (callActive) startRecording();
      }, 1000);
      return;
    }
    
    // Clean up audio context
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    
    await processVoiceInput(wavBlob);
  };
  
  const createWavBlob = (audioData, sampleRate) => {
    const buffer = new ArrayBuffer(44 + audioData.length * 2);
    const view = new DataView(buffer);
    
    // WAV header
    const writeString = (offset, string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };
    
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + audioData.length * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true); // fmt chunk size
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, 1, true); // Mono
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true); // byte rate
    view.setUint16(32, 2, true); // block align
    view.setUint16(34, 16, true); // bits per sample
    writeString(36, 'data');
    view.setUint32(40, audioData.length * 2, true);
    
    // Write audio data
    const dataOffset = 44;
    for (let i = 0; i < audioData.length; i++) {
      view.setInt16(dataOffset + i * 2, audioData[i], true);
    }
    
    return new Blob([buffer], { type: 'audio/wav' });
  };

  const processVoiceInput = async (audioBlob) => {
    setIsSending(true);
    console.log('🎤 Processing voice input, blob size:', audioBlob.size, 'bytes');

    if (!audioBlob || audioBlob.size === 0) {
      console.error('❌ Invalid audio blob - size is 0!');
      toast.error('No audio recorded');
      setIsSending(false);
      setTimeout(() => {
        if (callActive) {
          startRecording();
        }
      }, 1000);
      return;
    }
    
    // Check minimum size (should be at least a few KB for any real audio)
    if (audioBlob.size < 1000) {
      console.error('❌ Audio blob too small:', audioBlob.size, 'bytes (minimum 1000)');
      toast.error('Audio recording too short - please speak longer');
      setIsSending(false);
      setTimeout(() => {
        if (callActive) {
          startRecording();
        }
      }, 1000);
      return;
    }
    
    console.log('✅ Audio blob size OK:', audioBlob.size, 'bytes');

    try {
      // Convert audio to base64
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      
      reader.onloadend = async () => {
        try {
          const base64Audio = reader.result.split(',')[1];
          console.log('📤 Sending audio to backend, size:', base64Audio.length);

          // Send to backend for speech-to-text and processing
          const response = await axios.post(`${BACKEND_URL}/api/conversational-ai/agents/${testingAgent.id}/voice-chat`, {
            audio: base64Audio,
            conversation_history: conversation,
            call_log_id: currentCallLogId
          });
          
          console.log('✅ Backend response received:', response.data);

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

          // Set isSending to false BEFORE playing audio
          setIsSending(false);

          // Auto-play audio response
          if (response.data.audio_url) {
            console.log('Playing agent audio response...');
            const audio = new Audio(response.data.audio_url);
            audio.onplay = () => {
              console.log('Agent audio playing');
              setAudioPlaying(true);
            };
            audio.onended = () => {
              console.log('Agent audio ended, restarting recording...');
              setAudioPlaying(false);
              // Auto-restart listening after agent finishes (seamless conversation)
              setTimeout(() => {
                if (callActive) {
                  console.log('Attempting to restart recording...');
                  startRecording();
                }
              }, 800);
            };
            audio.onerror = (e) => {
              console.error('Audio playback error:', e);
              setAudioPlaying(false);
              // Restart recording even if audio fails
              setTimeout(() => {
                if (callActive) {
                  startRecording();
                }
              }, 500);
            };
            audio.play().catch(err => {
              console.error('Failed to play audio:', err);
              setAudioPlaying(false);
              // Restart recording if play fails
              setTimeout(() => {
                if (callActive) {
                  startRecording();
                }
              }, 500);
            });
          } else {
            console.warn('No audio URL received, restarting recording anyway');
            // No audio, restart listening immediately
            setTimeout(() => {
              if (callActive) {
                startRecording();
              }
            }, 500);
          }
        } catch (error) {
          console.error('❌ Error processing voice:', error);
          console.error('Error details:', error.response?.data || error.message);
          
          // Log the error to backend
          try {
            await axios.post(`${BACKEND_URL}/api/conversational-ai/call-logs`, {
              agent_id: testingAgent.id,
              agent_name: testingAgent.name,
              status: 'failed',
              error: error.response?.data?.detail || error.message || 'Unknown error',
              exchanges_count: Math.floor(conversation.length / 2)
            });
          } catch (logError) {
            console.error('Failed to log error:', logError);
          }
          
          toast.error('Failed to process voice input');
          setIsSending(false);
          // Still restart listening on error
          setTimeout(() => {
            if (callActive) {
              console.log('Restarting after error...');
              startRecording();
            }
          }, 1000);
        }
      };

    } catch (error) {
      console.error('❌ Error in processVoiceInput outer:', error);
      toast.error('Failed to process voice input');
      setIsSending(false);
      // Still restart listening on error
      setTimeout(() => {
        if (callActive) {
          startRecording();
        }
      }, 1000);
    }
  };

  const testBackendPipeline = async () => {
    console.log('🧪 TESTING BACKEND PIPELINE');
    setIsSending(true);
    
    try {
      // Create a test audio blob (empty webm)
      const testAudio = new Blob([new Uint8Array([])], { type: 'audio/webm' });
      const reader = new FileReader();
      
      reader.onloadend = async () => {
        try {
          // Even with empty audio, backend should respond with an error we can see
          const base64Audio = "dGVzdA=="; // "test" in base64
          
          console.log('📤 Sending test audio to backend...');
          const response = await axios.post(`${BACKEND_URL}/api/conversational-ai/agents/${testingAgent.id}/voice-chat`, {
            audio: base64Audio,
            conversation_history: [],
            call_log_id: currentCallLogId
          });
          
          console.log('✅ Backend responded:', response.data);
          toast.success('Backend pipeline is working!');
        } catch (error) {
          console.error('❌ Backend error:', error);
          console.error('Error response:', error.response?.data);
          toast.error('Backend error: ' + (error.response?.data?.detail || error.message));
        }
      };
      
      reader.readAsDataURL(testAudio);
    } catch (error) {
      console.error('❌ Test failed:', error);
      toast.error('Test failed');
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
                onClick={syncElevenLabsAgents}
                disabled={syncing}
                className="bg-purple-600 hover:bg-purple-700"
              >
                {syncing ? (
                  <>
                    <div className="w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Syncing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Sync from ElevenLabs
                  </>
                )}
              </Button>
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
            <div className="sticky top-0 bg-[#13141a] border-b border-gray-800 p-6 z-10">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-semibold">
                  {editingAgent ? 'Edit Agent' : 'Create New Agent'}
                </h2>
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setEditingAgent(null);
                    resetForm();
                    setActiveTab('agent');
                  }}
                  className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              {/* Tabs */}
              <div className="flex gap-1 bg-[#0a0b0d] p-1 rounded-lg">
                <button
                  onClick={() => setActiveTab('agent')}
                  className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                    activeTab === 'agent'
                      ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                  }`}
                >
                  🤖 Agent
                </button>
                <button
                  onClick={() => {
                    setActiveTab('knowledge');
                    loadKnowledgeBase();
                  }}
                  className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                    activeTab === 'knowledge'
                      ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                  }`}
                >
                  📚 Knowledge Base
                </button>
                <button
                  onClick={() => setActiveTab('tools')}
                  className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                    activeTab === 'tools'
                      ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                  }`}
                >
                  🔧 Tools
                </button>
                <button
                  onClick={() => setActiveTab('analysis')}
                  className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                    activeTab === 'analysis'
                      ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                  }`}
                >
                  📊 Analysis
                </button>
                <button
                  onClick={() => setActiveTab('settings')}
                  className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                    activeTab === 'settings'
                      ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                  }`}
                >
                  ⚙️ Settings
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Agent Tab Content */}
              {activeTab === 'agent' && (
                <div className="space-y-6">
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

              {/* ElevenLabs Agent ID */}
              <div>
                <Label className="text-white mb-2 block">ElevenLabs Agent ID</Label>
                <input
                  type="text"
                  value={formData.elevenlabs_agent_id}
                  onChange={(e) => setFormData({...formData, elevenlabs_agent_id: e.target.value})}
                  placeholder="Enter ElevenLabs Agent ID (optional)"
                  className="w-full px-4 py-2 bg-[#0a0b0d] border border-gray-700 rounded-lg text-white focus:border-cyan-500 focus:outline-none"
                />
                <p className="text-xs text-gray-500 mt-1">Link this agent to an ElevenLabs conversational AI agent</p>
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

                </div>
              )}

              {/* Knowledge Base Tab Content */}
              {activeTab === 'knowledge' && (
                <div className="space-y-6">
                  {/* Add Text Section */}
                  <div className="bg-[#13141a] border border-gray-800 rounded-lg p-6">
                    <h3 className="text-lg font-semibold mb-4">Add Text Directly</h3>
                    <p className="text-sm text-gray-400 mb-4">
                      Type or paste text information directly to add to your knowledge base
                    </p>
                    
                    <div className="space-y-4">
                      <div>
                        <Label className="text-white mb-2 block">Name/Title</Label>
                        <input
                          type="text"
                          placeholder="e.g., Company Overview, Product FAQs, etc."
                          className="w-full bg-[#0a0b0d] border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:border-cyan-500 focus:outline-none"
                          value={formData.kb_text_name || ''}
                          onChange={(e) => setFormData({ ...formData, kb_text_name: e.target.value })}
                        />
                      </div>
                      
                      <div>
                        <Label className="text-white mb-2 block">Content</Label>
                        <textarea
                          placeholder="Type or paste your text here..."
                          rows={6}
                          className="w-full bg-[#0a0b0d] border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:border-cyan-500 focus:outline-none resize-none"
                          value={formData.kb_text_content || ''}
                          onChange={(e) => setFormData({ ...formData, kb_text_content: e.target.value })}
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          {formData.kb_text_content?.length || 0} characters
                        </p>
                      </div>
                      
                      <Button
                        onClick={async () => {
                          if (!formData.kb_text_name || !formData.kb_text_content) {
                            toast.error('Please provide both name and content');
                            return;
                          }
                          
                          try {
                            await axios.post(`${BACKEND_URL}/api/conversational-ai/knowledge-base/add-text`, {
                              name: formData.kb_text_name,
                              text: formData.kb_text_content
                            });
                            toast.success('✅ Text added to knowledge base!');
                            setFormData({ ...formData, kb_text_name: '', kb_text_content: '' });
                            loadKnowledgeBase();
                          } catch (error) {
                            toast.error('Failed to add text: ' + (error.response?.data?.detail || error.message));
                          }
                        }}
                        className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Add Text to Knowledge Base
                      </Button>
                    </div>
                  </div>

                  {/* Upload Documents Section */}
                  <div className="bg-[#13141a] border border-gray-800 rounded-lg p-6">
                    <h3 className="text-lg font-semibold mb-4">Upload Documents</h3>
                    <p className="text-sm text-gray-400 mb-4">
                      Upload files to give your agent access to document-based knowledge. 
                      Supported formats: PDF, TXT, DOCX, HTML
                    </p>
                    
                    {/* File Upload */}
                    <div className="border-2 border-dashed border-gray-700 rounded-lg p-8 text-center hover:border-cyan-500/50 transition-colors">
                      <input
                        type="file"
                        id="kb-file-upload"
                        accept=".pdf,.txt,.docx,.html,.epub"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files[0];
                          if (!file) return;
                          
                          setUploadingFile(true);
                          const formData = new FormData();
                          formData.append('file', file);
                          
                          try {
                            const response = await axios.post(
                              `${BACKEND_URL}/api/conversational-ai/knowledge-base/upload`,
                              formData,
                              { headers: { 'Content-Type': 'multipart/form-data' } }
                            );
                            toast.success(`✅ ${file.name} uploaded successfully!`);
                            // Reload knowledge base list
                            loadKnowledgeBase();
                          } catch (error) {
                            toast.error('Failed to upload file: ' + (error.response?.data?.detail || error.message));
                          } finally {
                            setUploadingFile(false);
                            e.target.value = '';
                          }
                        }}
                      />
                      <label htmlFor="kb-file-upload" className="cursor-pointer">
                        <div className="w-16 h-16 mx-auto mb-4 bg-cyan-500/10 rounded-full flex items-center justify-center">
                          {uploadingFile ? (
                            <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
                          ) : (
                            <span className="text-3xl">📄</span>
                          )}
                        </div>
                        <p className="text-sm font-medium text-gray-300 mb-1">
                          {uploadingFile ? 'Uploading...' : 'Click to upload or drag and drop'}
                        </p>
                        <p className="text-xs text-gray-500">
                          PDF, TXT, DOCX, HTML, EPUB (max 10MB)
                        </p>
                      </label>
                    </div>
                  </div>

                  {/* Knowledge Base List */}
                  <div className="bg-[#13141a] border border-gray-800 rounded-lg p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold">Your Knowledge Base</h3>
                      <Button
                        onClick={loadKnowledgeBase}
                        className="bg-gray-700 hover:bg-gray-600"
                        size="sm"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </Button>
                    </div>
                    
                    {knowledgeBase.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <p className="text-sm">No documents uploaded yet</p>
                        <p className="text-xs mt-1">Upload your first document above</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {knowledgeBase.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center justify-between p-3 bg-[#0a0b0d] rounded-lg border border-gray-800 hover:border-cyan-500/30 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <span className="text-2xl">
                                {item.type === 'file' ? '📄' : item.type === 'url' ? '🔗' : '📝'}
                              </span>
                              <div>
                                <p className="text-sm font-medium text-gray-200">{item.name}</p>
                                <p className="text-xs text-gray-500">
                                  {item.type} • {new Date(item.created_at).toLocaleDateString()}
                                </p>
                              </div>
                            </div>
                            <Button
                              onClick={async () => {
                                if (confirm('Delete this knowledge base item?')) {
                                  try {
                                    await axios.delete(`${BACKEND_URL}/api/conversational-ai/knowledge-base/${item.id}`);
                                    toast.success('Knowledge base item deleted');
                                    loadKnowledgeBase();
                                  } catch (error) {
                                    toast.error('Failed to delete item');
                                  }
                                }
                              }}
                              className="bg-red-500/10 hover:bg-red-500/20 text-red-400"
                              size="sm"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Tools Tab Content */}
              {activeTab === 'tools' && (
                <div className="space-y-6">
                  <div className="text-center py-12">
                    <div className="w-20 h-20 mx-auto mb-4 bg-cyan-500/10 rounded-full flex items-center justify-center">
                      <span className="text-4xl">🔧</span>
                    </div>
                    <h3 className="text-xl font-semibold mb-2">Tools & Integrations</h3>
                    <p className="text-gray-400 mb-6">Connect your agent to external APIs and services for advanced functionality</p>
                    <p className="text-sm text-cyan-400">Coming Soon - API Integrations, Function Calling</p>
                  </div>
                </div>
              )}

              {/* Analysis Tab Content */}
              {activeTab === 'analysis' && (
                <div className="space-y-6">
                  {!editingAgent?.elevenlabs_agent_id ? (
                    <div className="text-center py-12">
                      <div className="w-20 h-20 mx-auto mb-4 bg-yellow-500/10 rounded-full flex items-center justify-center">
                        <span className="text-4xl">⚠️</span>
                      </div>
                      <h3 className="text-xl font-semibold mb-2">Analysis Not Available</h3>
                      <p className="text-gray-400 mb-6">
                        This agent is not synced with ElevenLabs. Analysis features are only available for agents synced from your ElevenLabs account.
                      </p>
                      <p className="text-sm text-cyan-400">Use the "Sync from ElevenLabs" button on the main page to import your agents.</p>
                    </div>
                  ) : (
                    <>
                      {/* Section Tabs */}
                      <div className="flex gap-2 border-b border-gray-700 pb-2">
                        <button
                          onClick={() => setAnalysisSection('evaluation')}
                          className={`px-4 py-2 rounded-lg transition-colors ${
                            analysisSection === 'evaluation'
                              ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                              : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
                          }`}
                        >
                          Success Evaluation
                        </button>
                        <button
                          onClick={() => setAnalysisSection('data-collection')}
                          className={`px-4 py-2 rounded-lg transition-colors ${
                            analysisSection === 'data-collection'
                              ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                              : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
                          }`}
                        >
                          Data Collection
                        </button>
                        <button
                          onClick={() => setAnalysisSection('analytics')}
                          className={`px-4 py-2 rounded-lg transition-colors ${
                            analysisSection === 'analytics'
                              ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                              : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
                          }`}
                        >
                          Analytics
                        </button>
                      </div>

                      {/* Success Evaluation Section */}
                      {analysisSection === 'evaluation' && (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <h3 className="text-lg font-semibold">Success Evaluation</h3>
                              <p className="text-sm text-gray-400 mt-1">
                                Define criteria to automatically evaluate conversation success ({evaluationCriteria.length}/30 criteria)
                              </p>
                            </div>
                            <Button
                              onClick={() => {
                                setCriteriaForm({ identifier: '', description: '' });
                                setEditingCriteria(null);
                                setShowAddCriteriaModal(true);
                              }}
                              disabled={evaluationCriteria.length >= 30}
                            >
                              <Plus className="w-4 h-4 mr-2" />
                              Add Criteria
                            </Button>
                          </div>

                          {!Array.isArray(evaluationCriteria) || evaluationCriteria.length === 0 ? (
                            <div className="text-center py-12 bg-black/20 border border-gray-700 rounded-xl">
                              <TrendingUp className="w-12 h-12 mx-auto mb-3 text-gray-600" />
                              <p className="text-gray-400">No evaluation criteria yet</p>
                              <p className="text-sm text-gray-500 mt-2">Add criteria to automatically evaluate conversation outcomes</p>
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {evaluationCriteria.map((criteria, idx) => (
                                <div
                                  key={idx}
                                  className="bg-black/20 border border-gray-700 rounded-xl p-4 hover:border-cyan-500/50 transition-colors"
                                >
                                  <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2 mb-2">
                                        <code className="text-sm px-2 py-1 bg-cyan-500/10 text-cyan-400 rounded">
                                          {criteria.identifier}
                                        </code>
                                      </div>
                                      <p className="text-sm text-gray-300">{criteria.description}</p>
                                    </div>
                                    <div className="flex gap-2">
                                      <button
                                        onClick={() => {
                                          setCriteriaForm(criteria);
                                          setEditingCriteria(criteria);
                                          setShowAddCriteriaModal(true);
                                        }}
                                        className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
                                      >
                                        <Edit2 className="w-4 h-4 text-gray-400" />
                                      </button>
                                      <button
                                        onClick={() => deleteEvaluationCriteria(criteria.identifier)}
                                        className="p-2 hover:bg-red-500/10 rounded-lg transition-colors"
                                      >
                                        <Trash2 className="w-4 h-4 text-red-400" />
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Data Collection Section */}
                      {analysisSection === 'data-collection' && (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <h3 className="text-lg font-semibold">Data Collection</h3>
                              <p className="text-sm text-gray-400 mt-1">
                                Extract structured data from conversations ({dataCollectionItems.length}/40 items)
                              </p>
                            </div>
                            <Button
                              onClick={() => {
                                setDataItemForm({ identifier: '', data_type: 'string', description: '' });
                                setEditingDataItem(null);
                                setShowAddDataItemModal(true);
                              }}
                              disabled={dataCollectionItems.length >= 40}
                            >
                              <Plus className="w-4 h-4 mr-2" />
                              Add Data Item
                            </Button>
                          </div>

                          {!Array.isArray(dataCollectionItems) || dataCollectionItems.length === 0 ? (
                            <div className="text-center py-12 bg-black/20 border border-gray-700 rounded-xl">
                              <Activity className="w-12 h-12 mx-auto mb-3 text-gray-600" />
                              <p className="text-gray-400">No data collection items yet</p>
                              <p className="text-sm text-gray-500 mt-2">Add items to extract structured data from conversations</p>
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {dataCollectionItems.map((item, idx) => (
                                <div
                                  key={idx}
                                  className="bg-black/20 border border-gray-700 rounded-xl p-4 hover:border-cyan-500/50 transition-colors"
                                >
                                  <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2 mb-2">
                                        <code className="text-sm px-2 py-1 bg-purple-500/10 text-purple-400 rounded">
                                          {item.identifier}
                                        </code>
                                        <span className="text-xs px-2 py-1 bg-gray-700 text-gray-300 rounded">
                                          {item.data_type}
                                        </span>
                                      </div>
                                      <p className="text-sm text-gray-300">{item.description}</p>
                                    </div>
                                    <div className="flex gap-2">
                                      <button
                                        onClick={() => {
                                          setDataItemForm(item);
                                          setEditingDataItem(item);
                                          setShowAddDataItemModal(true);
                                        }}
                                        className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
                                      >
                                        <Edit2 className="w-4 h-4 text-gray-400" />
                                      </button>
                                      <button
                                        onClick={() => deleteDataCollectionItem(item.identifier)}
                                        className="p-2 hover:bg-red-500/10 rounded-lg transition-colors"
                                      >
                                        <Trash2 className="w-4 h-4 text-red-400" />
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Analytics Section */}
                      {analysisSection === 'analytics' && (
                        loadingAnalytics ? (
                          <div className="text-center py-12">
                            <div className="w-16 h-16 mx-auto mb-4 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin"></div>
                            <p className="text-gray-400">Loading analytics...</p>
                          </div>
                        ) : (
                    <>
                      {/* Time Range Filter */}
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold flex items-center gap-2">
                          <Activity className="w-5 h-5 text-cyan-500" />
                          Performance Analytics
                        </h3>
                        <div className="flex gap-2">
                          <Button
                            variant={analyticsTimeRange === 'day' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setAnalyticsTimeRange('day')}
                          >
                            Day
                          </Button>
                          <Button
                            variant={analyticsTimeRange === 'week' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setAnalyticsTimeRange('week')}
                          >
                            Week
                          </Button>
                          <Button
                            variant={analyticsTimeRange === 'month' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setAnalyticsTimeRange('month')}
                          >
                            Month
                          </Button>
                        </div>
                      </div>

                      {/* Key Metrics Cards */}
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/20 rounded-xl p-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="w-10 h-10 bg-cyan-500/20 rounded-lg flex items-center justify-center">
                              <Users className="w-5 h-5 text-cyan-400" />
                            </div>
                          </div>
                          <div className="text-2xl font-bold mb-1">
                            {conversationsData?.length || 0}
                          </div>
                          <div className="text-sm text-gray-400">Total Conversations</div>
                        </div>

                        <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-xl p-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                              <Clock className="w-5 h-5 text-purple-400" />
                            </div>
                          </div>
                          <div className="text-2xl font-bold mb-1">
                            {analyticsData?.minutes_used ? `${Math.round(analyticsData.minutes_used)}m` : '0m'}
                          </div>
                          <div className="text-sm text-gray-400">Minutes Used</div>
                        </div>

                        <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/20 rounded-xl p-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                              <TrendingUp className="w-5 h-5 text-green-400" />
                            </div>
                          </div>
                          <div className="text-2xl font-bold mb-1">
                            {analyticsData?.request_count || 0}
                          </div>
                          <div className="text-sm text-gray-400">Total Requests</div>
                        </div>

                        <div className="bg-gradient-to-br from-orange-500/10 to-red-500/10 border border-orange-500/20 rounded-xl p-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="w-10 h-10 bg-orange-500/20 rounded-lg flex items-center justify-center">
                              <Activity className="w-5 h-5 text-orange-400" />
                            </div>
                          </div>
                          <div className="text-2xl font-bold mb-1">
                            {analyticsData?.ttfb_avg ? `${Math.round(analyticsData.ttfb_avg)}ms` : 'N/A'}
                          </div>
                          <div className="text-sm text-gray-400">Avg Response Time</div>
                        </div>
                      </div>

                      {/* Usage Chart */}
                      {analyticsData?.usage_by_date && analyticsData.usage_by_date.length > 0 && (
                        <div className="bg-black/20 border border-cyan-500/20 rounded-xl p-6">
                          <h4 className="text-lg font-semibold mb-4 flex items-center gap-2">
                            <TrendingUp className="w-5 h-5 text-cyan-500" />
                            Usage Trend
                          </h4>
                          <ResponsiveContainer width="100%" height={300}>
                            <LineChart data={analyticsData.usage_by_date}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                              <XAxis 
                                dataKey="date" 
                                stroke="#888"
                                style={{ fontSize: '12px' }}
                              />
                              <YAxis 
                                stroke="#888"
                                style={{ fontSize: '12px' }}
                              />
                              <Tooltip 
                                contentStyle={{ 
                                  backgroundColor: '#1a1a1a', 
                                  border: '1px solid #333',
                                  borderRadius: '8px'
                                }}
                              />
                              <Legend />
                              <Line 
                                type="monotone" 
                                dataKey="minutes_used" 
                                stroke="#06b6d4" 
                                strokeWidth={2}
                                name="Minutes Used"
                              />
                              <Line 
                                type="monotone" 
                                dataKey="request_count" 
                                stroke="#8b5cf6" 
                                strokeWidth={2}
                                name="Requests"
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      )}

                      {/* Conversations List */}
                      <div className="bg-black/20 border border-cyan-500/20 rounded-xl p-6">
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="text-lg font-semibold flex items-center gap-2">
                            <MessageSquare className="w-5 h-5 text-cyan-500" />
                            Recent Conversations
                          </h4>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => loadAnalytics(editingAgent.id)}
                          >
                            <RefreshCw className="w-4 h-4 mr-2" />
                            Refresh
                          </Button>
                        </div>

                        {conversationsData.length === 0 ? (
                          <div className="text-center py-8">
                            <MessageSquare className="w-12 h-12 mx-auto mb-3 text-gray-600" />
                            <p className="text-gray-400">No conversations yet</p>
                            <p className="text-sm text-gray-500 mt-2">Start a conversation with this agent to see analytics here</p>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {conversationsData.map((conv, idx) => (
                              <div
                                key={idx}
                                className="bg-black/40 border border-gray-700 rounded-lg p-4 hover:border-cyan-500/50 transition-colors cursor-pointer"
                                onClick={() => loadConversationDetails(editingAgent.id, conv.conversation_id)}
                              >
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-2">
                                      <span className="text-sm font-medium">
                                        {conv.conversation_id?.substring(0, 8)}...
                                      </span>
                                      <span className={`text-xs px-2 py-1 rounded-full ${
                                        conv.status === 'completed' 
                                          ? 'bg-green-500/20 text-green-400'
                                          : conv.status === 'failed'
                                          ? 'bg-red-500/20 text-red-400'
                                          : 'bg-yellow-500/20 text-yellow-400'
                                      }`}>
                                        {conv.status || 'unknown'}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-4 text-sm text-gray-400">
                                      <span className="flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        {conv.call_duration_secs ? `${Math.round(conv.call_duration_secs)}s` : 'N/A'}
                                      </span>
                                      <span className="flex items-center gap-1">
                                        <Calendar className="w-3 h-3" />
                                        {conv.start_time_unix ? new Date(conv.start_time_unix * 1000).toLocaleString() : 'N/A'}
                                      </span>
                                    </div>
                                  </div>
                                  <ChevronDown className="w-5 h-5 text-gray-400" />
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Performance Insights */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-black/20 border border-cyan-500/20 rounded-xl p-6">
                          <h4 className="text-lg font-semibold mb-4 flex items-center gap-2">
                            <Activity className="w-5 h-5 text-cyan-500" />
                            Response Time
                          </h4>
                          <div className="space-y-3">
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-gray-400">Average TTFB:</span>
                              <span className="font-semibold">
                                {analyticsData?.ttfb_avg ? `${Math.round(analyticsData.ttfb_avg)}ms` : 'N/A'}
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-gray-400">95th Percentile:</span>
                              <span className="font-semibold">
                                {analyticsData?.ttfb_p95 ? `${Math.round(analyticsData.ttfb_p95)}ms` : 'N/A'}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="bg-black/20 border border-cyan-500/20 rounded-xl p-6">
                          <h4 className="text-lg font-semibold mb-4 flex items-center gap-2">
                            <TrendingUp className="w-5 h-5 text-green-500" />
                            Success Rate
                          </h4>
                          <div className="space-y-3">
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-gray-400">Completed Calls:</span>
                              <span className="font-semibold text-green-400">
                                {conversationsData.filter(c => c.status === 'completed').length}
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-gray-400">Failed Calls:</span>
                              <span className="font-semibold text-red-400">
                                {conversationsData.filter(c => c.status === 'failed').length}
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-gray-400">Success Rate:</span>
                              <span className="font-semibold text-cyan-400">
                                {conversationsData.length > 0 
                                  ? `${Math.round((conversationsData.filter(c => c.status === 'completed').length / conversationsData.length) * 100)}%`
                                  : 'N/A'
                                }
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </>
                        )
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Settings Tab Content */}
              {activeTab === 'settings' && (
                <div className="space-y-6">
                  <div className="text-center py-12">
                    <div className="w-20 h-20 mx-auto mb-4 bg-cyan-500/10 rounded-full flex items-center justify-center">
                      <span className="text-4xl">⚙️</span>
                    </div>
                    <h3 className="text-xl font-semibold mb-2">Advanced Settings</h3>
                    <p className="text-gray-400 mb-6">Configure authentication, data retention, cost optimization, and advanced behaviors</p>
                    <p className="text-sm text-cyan-400">Coming Soon - Authentication, Personalization, Workspace Overrides</p>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t border-gray-800 mt-6">
                <Button
                  onClick={editingAgent ? updateAgent : createAgent}
                  className="flex-1 bg-gradient-to-r from-cyan-500 to-blue-500"
                  disabled={activeTab !== 'agent' && activeTab !== 'knowledge' && activeTab !== 'analysis'}
                >
                  <Save className="w-4 h-4 mr-2" />
                  {editingAgent ? 'Update Agent' : 'Create Agent'}
                </Button>
                <Button
                  onClick={() => {
                    setShowCreateModal(false);
                    setEditingAgent(null);
                    resetForm();
                    setActiveTab('agent');
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

                  {/* Microphone Level Indicator */}
                  {(isRecording || audioLevel > 0) && (
                    <div className="w-full mb-4 p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-gray-300 font-medium">Microphone Level</span>
                        {micWorking ? (
                          <span className="text-xs text-green-400 font-semibold">✓ Working</span>
                        ) : (
                          <span className="text-xs text-red-400 font-semibold">✗ Not Detecting Audio</span>
                        )}
                      </div>
                      <div className="w-full h-4 bg-gray-700 rounded-full overflow-hidden border border-gray-600">
                        <div
                          className={`h-full transition-all duration-75 ${
                            audioLevel > 30 ? 'bg-green-500' : audioLevel > 10 ? 'bg-yellow-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${audioLevel}%` }}
                        />
                      </div>
                      <p className="text-xs text-gray-400 mt-2 font-medium">
                        {audioLevel === 0 && '❌ No sound detected - Check your microphone!'}
                        {audioLevel > 0 && audioLevel < 10 && '🔇 Very quiet - Speak louder!'}
                        {audioLevel >= 10 && audioLevel < 30 && '🔉 Quiet - Speak louder!'}
                        {audioLevel >= 30 && '✅ Good level - Keep speaking!'}
                      </p>
                    </div>
                  )}

                  {/* Test Microphone Button removed - using ElevenLabs SDK */}

                  {/* Test Backend Button removed - using ElevenLabs SDK */}

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

      {/* Conversation Details Modal */}
      {showConversationModal && selectedConversation && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-xl flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-b from-gray-900 to-black rounded-2xl border border-cyan-500/30 w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="p-6 border-b border-gray-800 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                  Conversation Details
                </h2>
                <p className="text-sm text-gray-400 mt-1">
                  ID: {selectedConversation.conversation_id}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowConversationModal(false);
                  setSelectedConversation(null);
                }}
                className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Basic Info */}
              <div className="bg-black/40 border border-gray-700 rounded-xl p-4">
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-cyan-500" />
                  Overview
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-400">Status</p>
                    <p className={`font-medium ${
                      selectedConversation.status === 'completed' 
                        ? 'text-green-400' 
                        : 'text-red-400'
                    }`}>
                      {selectedConversation.status || 'Unknown'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Duration</p>
                    <p className="font-medium">
                      {selectedConversation.call_duration_secs 
                        ? `${Math.round(selectedConversation.call_duration_secs)}s` 
                        : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Started</p>
                    <p className="font-medium">
                      {selectedConversation.start_time_unix 
                        ? new Date(selectedConversation.start_time_unix * 1000).toLocaleString()
                        : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Agent ID</p>
                    <p className="font-medium text-xs">
                      {selectedConversation.agent_id?.substring(0, 16)}...
                    </p>
                  </div>
                </div>
              </div>

              {/* Transcript */}
              {selectedConversation.transcript && selectedConversation.transcript.length > 0 && (
                <div className="bg-black/40 border border-gray-700 rounded-xl p-4">
                  <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-cyan-500" />
                    Transcript
                  </h3>
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {selectedConversation.transcript.map((item, idx) => (
                      <div
                        key={idx}
                        className={`p-3 rounded-lg ${
                          item.role === 'user' 
                            ? 'bg-blue-500/10 border border-blue-500/20' 
                            : 'bg-purple-500/10 border border-purple-500/20'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs font-semibold uppercase ${
                            item.role === 'user' ? 'text-blue-400' : 'text-purple-400'
                          }`}>
                            {item.role === 'user' ? 'User' : 'Agent'}
                          </span>
                          {item.timestamp && (
                            <span className="text-xs text-gray-500">
                              {new Date(item.timestamp).toLocaleTimeString()}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-300">{item.message || item.text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Evaluation Results */}
              {selectedConversation.evaluation_results && (
                <div className="bg-black/40 border border-gray-700 rounded-xl p-4">
                  <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-green-500" />
                    Evaluation Results
                  </h3>
                  <pre className="text-xs text-gray-300 bg-black/40 p-3 rounded-lg overflow-x-auto">
                    {JSON.stringify(selectedConversation.evaluation_results, null, 2)}
                  </pre>
                </div>
              )}

              {/* Metadata */}
              {selectedConversation.metadata && (
                <div className="bg-black/40 border border-gray-700 rounded-xl p-4">
                  <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                    <Settings className="w-5 h-5 text-gray-400" />
                    Metadata
                  </h3>
                  <pre className="text-xs text-gray-300 bg-black/40 p-3 rounded-lg overflow-x-auto">
                    {JSON.stringify(selectedConversation.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-gray-800">
              <Button
                onClick={() => {
                  setShowConversationModal(false);
                  setSelectedConversation(null);
                }}
                className="w-full"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Evaluation Criteria Modal */}
      {showAddCriteriaModal && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-xl flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-b from-gray-900 to-black rounded-2xl border border-cyan-500/30 w-full max-w-2xl">
            {/* Modal Header */}
            <div className="p-6 border-b border-gray-800 flex items-center justify-between">
              <h2 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                {editingCriteria ? 'Edit Evaluation Criteria' : 'Add Evaluation Criteria'}
              </h2>
              <button
                onClick={() => {
                  setShowAddCriteriaModal(false);
                  setCriteriaForm({ identifier: '', description: '' });
                  setEditingCriteria(null);
                }}
                className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-4">
              <div>
                <Label>Identifier*</Label>
                <input
                  type="text"
                  value={criteriaForm.identifier}
                  onChange={(e) => setCriteriaForm({ ...criteriaForm, identifier: e.target.value })}
                  placeholder="e.g., customer_satisfaction"
                  disabled={!!editingCriteria}
                  className="w-full mt-2 px-4 py-2 bg-black/40 border border-gray-700 rounded-lg focus:border-cyan-500 focus:outline-none text-white disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <p className="text-xs text-gray-500 mt-1">Unique identifier (cannot be changed after creation)</p>
              </div>

              <div>
                <Label>Description / Prompt*</Label>
                <Textarea
                  value={criteriaForm.description}
                  onChange={(e) => setCriteriaForm({ ...criteriaForm, description: e.target.value })}
                  placeholder="Describe what indicates success. Example: Mark successful if the customer expresses satisfaction or their issue was resolved."
                  rows={6}
                  className="w-full mt-2 px-4 py-2 bg-black/40 border border-gray-700 rounded-lg focus:border-cyan-500 focus:outline-none text-white resize-none"
                />
                <p className="text-xs text-gray-500 mt-1">
                  This prompt will be used by an LLM to evaluate conversation success
                </p>
              </div>

              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                <p className="text-sm text-blue-300">
                  💡 <strong>Tip:</strong> Be specific about what constitutes success. The AI will analyze the conversation transcript based on your description.
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-gray-800 flex gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setShowAddCriteriaModal(false);
                  setCriteriaForm({ identifier: '', description: '' });
                  setEditingCriteria(null);
                }}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={addEvaluationCriteria}
                className="flex-1"
                disabled={!criteriaForm.identifier || !criteriaForm.description}
              >
                {editingCriteria ? 'Update' : 'Add'} Criteria
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Data Collection Item Modal */}
      {showAddDataItemModal && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-xl flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-b from-gray-900 to-black rounded-2xl border border-cyan-500/30 w-full max-w-2xl">
            {/* Modal Header */}
            <div className="p-6 border-b border-gray-800 flex items-center justify-between">
              <h2 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                {editingDataItem ? 'Edit Data Collection Item' : 'Add Data Collection Item'}
              </h2>
              <button
                onClick={() => {
                  setShowAddDataItemModal(false);
                  setDataItemForm({ identifier: '', data_type: 'string', description: '' });
                  setEditingDataItem(null);
                }}
                className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-4">
              <div>
                <Label>Identifier*</Label>
                <input
                  type="text"
                  value={dataItemForm.identifier}
                  onChange={(e) => setDataItemForm({ ...dataItemForm, identifier: e.target.value })}
                  placeholder="e.g., customer_rating"
                  disabled={!!editingDataItem}
                  className="w-full mt-2 px-4 py-2 bg-black/40 border border-gray-700 rounded-lg focus:border-cyan-500 focus:outline-none text-white disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <p className="text-xs text-gray-500 mt-1">Unique identifier (cannot be changed after creation)</p>
              </div>

              <div>
                <Label>Data Type*</Label>
                <Select
                  value={dataItemForm.data_type}
                  onValueChange={(value) => setDataItemForm({ ...dataItemForm, data_type: value })}
                >
                  <SelectTrigger className="w-full mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="string">String</SelectItem>
                    <SelectItem value="boolean">Boolean</SelectItem>
                    <SelectItem value="integer">Integer</SelectItem>
                    <SelectItem value="number">Number</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500 mt-1">Type of data to extract</p>
              </div>

              <div>
                <Label>Description / Extraction Prompt*</Label>
                <Textarea
                  value={dataItemForm.description}
                  onChange={(e) => setDataItemForm({ ...dataItemForm, description: e.target.value })}
                  placeholder="Describe what data to extract. Example: Extract the customer satisfaction rating from 1-5 mentioned during the call."
                  rows={6}
                  className="w-full mt-2 px-4 py-2 bg-black/40 border border-gray-700 rounded-lg focus:border-cyan-500 focus:outline-none text-white resize-none"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Instructions for extracting this data from the conversation
                </p>
              </div>

              <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-4">
                <p className="text-sm text-purple-300">
                  💡 <strong>Tip:</strong> Be clear about what data to extract and its format. The AI will analyze the transcript to find and extract this information.
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-gray-800 flex gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setShowAddDataItemModal(false);
                  setDataItemForm({ identifier: '', data_type: 'string', description: '' });
                  setEditingDataItem(null);
                }}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={addDataCollectionItem}
                className="flex-1"
                disabled={!dataItemForm.identifier || !dataItemForm.description}
              >
                {editingDataItem ? 'Update' : 'Add'} Data Item
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConversationalAgentsPage;
