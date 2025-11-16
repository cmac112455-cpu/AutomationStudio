import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Send, Brain, User, Sparkles, MessageSquare, Clock, Target, Plus, MoreVertical, Trash2, Zap, Info, Paperclip } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import ReactMarkdown from 'react-markdown';

export default function CoPilotPage() {
  const [messages, setMessages] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [sessionId, setSessionId] = useState(localStorage.getItem('copilot_session_id') || null);
  const [currentTaskId, setCurrentTaskId] = useState(localStorage.getItem('copilot_task_id') || null);
  const [showHistory, setShowHistory] = useState(false);
  const [multiAiMode, setMultiAiMode] = useState(() => {
    const saved = localStorage.getItem('multi_ai_mode');
    return saved === 'true' ? true : false; // Default to false for cost protection
  });
  const [selectedModel, setSelectedModel] = useState(() => {
    return localStorage.getItem('selected_model') || 'intelligent'; // Default to intelligent routing
  });
  const messagesEndRef = useRef(null);

  useEffect(() => {
    loadChatHistory();
    loadChatSessions();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    localStorage.setItem('multi_ai_mode', multiAiMode);
  }, [multiAiMode]);

  useEffect(() => {
    localStorage.setItem('selected_model', selectedModel);
  }, [selectedModel]);

  const loadChatHistory = async () => {
    try {
      if (sessionId) {
        const response = await axios.get(`/copilot/history/${sessionId}`);
        if (response.data.messages && response.data.messages.length > 0) {
          setMessages(response.data.messages);
        } else {
          showWelcomeMessage();
        }
      } else {
        showWelcomeMessage();
      }
    } catch (error) {
      console.error('Failed to load chat history:', error);
      showWelcomeMessage();
    } finally {
      setLoadingHistory(false);
    }
  };

  const loadChatSessions = async () => {
    try {
      const response = await axios.get('/copilot/sessions');
      setSessions(response.data.sessions);
    } catch (error) {
      console.error('Failed to load chat sessions:', error);
    }
  };

  const showWelcomeMessage = () => {
    setMessages([{
      role: 'assistant',
      content: 'Hello! I\'m your AI Business Co-Pilot. I can help you with:\n\n• **Strategic business planning**\n• **Ad campaign optimization**\n• **Financial analysis**\n• **Growth strategies**\n• **Automation recommendations**\n\n💾 All conversations are automatically saved and analyzed to generate priority tasks for you.\n\nWhat would you like to discuss today?',
      model_used: 'system'
    }]);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const switchSession = async (newSessionId) => {
    setSessionId(newSessionId);
    localStorage.setItem('copilot_session_id', newSessionId);
    setLoadingHistory(true);
    
    try {
      const response = await axios.get(`/copilot/history/${newSessionId}`);
      setMessages(response.data.messages || []);
    } catch (error) {
      console.error('Failed to load session:', error);
      setMessages([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  const startNewChat = () => {
    const newSessionId = null;
    setSessionId(newSessionId);
    setCurrentTaskId(null);
    localStorage.removeItem('copilot_session_id');
    localStorage.removeItem('copilot_task_id');
    showWelcomeMessage();
  };

  const deleteSession = async (sessionIdToDelete, event) => {
    event.stopPropagation(); // Prevent switching to the session being deleted
    
    try {
      await axios.delete(`/copilot/sessions/${sessionIdToDelete}`);
      
      // Remove from sessions list
      setSessions(prev => prev.filter(s => s.id !== sessionIdToDelete));
      
      // If the deleted session was the current one, start a new chat
      if (sessionId === sessionIdToDelete) {
        startNewChat();
      }
      
      toast.success('Chat session deleted');
    } catch (error) {
      toast.error('Failed to delete chat session');
      console.error('Delete session error:', error);
    }
  };

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMessage = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);

    try {
      const response = await axios.post('/copilot/chat', {
        message: userMessage,
        session_id: sessionId,
        task_id: currentTaskId,
        use_multi_ai: multiAiMode,
        preferred_model: selectedModel
      });

      if (!sessionId) {
        const newSessionId = response.data.session_id;
        setSessionId(newSessionId);
        localStorage.setItem('copilot_session_id', newSessionId);
      }

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: response.data.response,
        model_used: response.data.model_used
      }]);

      // Reload sessions to update history
      loadChatSessions();
    } catch (error) {
      toast.error('Failed to get response from AI Co-Pilot');
      console.error('Co-Pilot error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="h-[calc(100vh-4rem)] flex gap-4" data-testid="copilot-page">
      {/* Chat History Sidebar */}
      <div className={`glass-morph rounded-2xl p-4 transition-all duration-300 ${showHistory ? 'w-96' : 'w-16'}`}>
        <div className="flex items-center justify-between mb-4">
          {showHistory ? (
            <>
              <h3 className="font-semibold text-sm">Chat History</h3>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowHistory(false)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowHistory(true)}
              className="w-full"
              data-testid="show-history-button"
            >
              <MessageSquare className="w-5 h-5" />
            </Button>
          )}
        </div>

        {showHistory && (
          <div className="space-y-2">
            <Button
              onClick={startNewChat}
              className="w-full bg-gradient-to-r from-[#00d4ff] to-[#4785ff] hover:opacity-90 mb-4"
              size="sm"
              data-testid="new-chat-button"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Chat
            </Button>

            <ScrollArea className="h-[calc(100vh-16rem)] pr-2">
              <div className="space-y-2">
                {sessions.map((session) => (
                  <div
                    key={session.id}
                    className={`group rounded-lg transition-colors flex items-start gap-2 p-2.5 max-w-full overflow-hidden ${
                      sessionId === session.id
                        ? 'bg-[#00d4ff]/20 border border-[#00d4ff]'
                        : 'hover:bg-gray-800'
                    }`}
                  >
                    {/* CHAT INFO - Takes available space */}
                    <button
                      onClick={() => switchSession(session.id)}
                      className="flex-1 text-left flex items-start gap-2 min-w-0 max-w-[310px]"
                      data-testid={`session-${session.id}`}
                    >
                      {session.session_type === 'task' ? (
                        <Target className="w-4 h-4 text-[#00d4ff] mt-0.5 flex-shrink-0" />
                      ) : (
                        <MessageSquare className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0 max-w-[270px]">
                        <p className="text-sm font-medium truncate leading-tight w-full block">{session.title}</p>
                        <p className="text-xs text-gray-400 truncate leading-tight mt-0.5 w-full block">{session.last_message}</p>
                        <p className="text-xs text-gray-500 mt-1 leading-tight truncate w-full block">
                          {new Date(session.last_updated).toLocaleDateString()}
                        </p>
                      </div>
                    </button>
                    
                    {/* 3-DOT MENU - Only visible on hover */}
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          className="flex-shrink-0 p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-gray-700 rounded"
                          data-testid={`menu-session-${session.id}`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreVertical className="w-4 h-4 text-gray-400" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-40 p-1 bg-[#1a1d2e] border-gray-700" align="end">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteSession(session.id, e);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-500/20 rounded transition-colors"
                          data-testid={`delete-session-${session.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                          <span>Delete Chat</span>
                        </button>
                      </PopoverContent>
                    </Popover>
                  </div>
                ))}

                {sessions.length === 0 && (
                  <p className="text-sm text-gray-500 text-center py-4">No chat history yet</p>
                )}
              </div>
            </ScrollArea>
          </div>
        )}
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Header */}
        <div className="mb-6 flex-shrink-0">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#00d4ff] to-[#4785ff] flex items-center justify-center glow-effect">
              <Brain className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold">AI Business Co-Pilot</h1>
              <p className="text-gray-400">Multi-model AI strategist at your service</p>
            </div>
          </div>
        </div>

        {/* Chat Container */}
        <div className="flex-1 glass-morph rounded-2xl p-6 flex flex-col min-h-0">
          {/* Messages */}
          <ScrollArea className="flex-1 pr-4 mb-4 overflow-y-auto" data-testid="chat-messages">
            <div className="space-y-4">
              {loadingHistory ? (
                <div className="flex items-center justify-center py-8">
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 border-2 border-[#00d4ff] border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-gray-400">Loading chat history...</p>
                  </div>
                </div>
              ) : (
                messages.map((message, index) => (
                <div
                  key={index}
                  className={`message-bubble flex gap-3 ${
                    message.role === 'user' ? 'flex-row-reverse' : 'flex-row'
                  }`}
                  data-testid={`message-${index}`}
                >
                  {/* Avatar */}
                  <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                    message.role === 'user' 
                      ? 'bg-gradient-to-br from-purple-500 to-pink-500' 
                      : 'bg-gradient-to-br from-[#00d4ff] to-[#4785ff]'
                  }`}>
                    {message.role === 'user' ? (
                      <User className="w-5 h-5 text-white" />
                    ) : (
                      <Brain className="w-5 h-5 text-white" />
                    )}
                  </div>

                  {/* Message Content */}
                  <div className={`flex-1 max-w-3xl ${
                    message.role === 'user' ? 'text-right' : 'text-left'
                  }`}>
                    <div className={`inline-block rounded-2xl px-4 py-3 ${
                      message.role === 'user'
                        ? 'bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30'
                        : 'bg-gradient-to-br from-[#00d4ff]/10 to-[#4785ff]/10 border border-[#00d4ff]/30'
                    }`}>
                      <div className="text-sm leading-relaxed prose prose-invert prose-sm max-w-none">
                        <ReactMarkdown>{message.content}</ReactMarkdown>
                      </div>
                      {message.model_used && message.model_used !== 'system' && (
                        <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                          <Sparkles className="w-3 h-3" />
                          Powered by {message.model_used}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
                ))
              )}

              {/* Typing Indicator */}
              {loading && (
                <div className="flex gap-3 message-bubble">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#00d4ff] to-[#4785ff] flex items-center justify-center">
                    <Brain className="w-5 h-5 text-white" />
                  </div>
                  <div className="bg-gradient-to-br from-[#00d4ff]/10 to-[#4785ff]/10 border border-[#00d4ff]/30 rounded-2xl px-4 py-3">
                    <div className="typing-indicator">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {/* Input Area - Unified Container */}
          <div className="border-t border-gray-800 pt-4">
            {/* Unified Input Box with Controls Inside */}
            <div className="bg-[#1a1d2e] border border-gray-700 rounded-xl p-3 hover:border-gray-600 transition-colors">
              {/* Textarea and Send Button Row */}
              <div className="flex gap-3 mb-3">
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Ask me anything about your business strategy, ad optimization, or growth plans..."
                  className="flex-1 bg-transparent border-0 text-white resize-none min-h-[60px] max-h-[120px] focus:outline-none focus:ring-0 p-0"
                  disabled={loading}
                  data-testid="chat-input"
                />
                <Button
                  onClick={sendMessage}
                  disabled={loading || !input.trim()}
                  className="bg-gradient-to-r from-[#00d4ff] to-[#4785ff] hover:opacity-90 px-6 self-end"
                  data-testid="send-button"
                >
                  <Send className="w-5 h-5" />
                </Button>
              </div>

              {/* Divider */}
              <div className="border-t border-gray-700/50 mb-3"></div>

              {/* Controls Row - Inside the Textbox */}
              <div className="flex items-center gap-2 flex-wrap">
              {/* File Upload Button */}
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-gray-400 hover:text-white hover:bg-gray-800/50"
                title="Upload files"
              >
                <Paperclip className="w-4 h-4" />
              </Button>

              {/* Divider */}
              <div className="h-6 w-px bg-gray-700/50"></div>

              {/* Model Selection - Compact */}
              <div className="flex-1 min-w-[200px]">
                <Select value={selectedModel} onValueChange={setSelectedModel}>
                  <SelectTrigger className="h-8 bg-[#2a2d3a]/30 border-gray-700/30 hover:border-gray-600/50 transition-colors text-white text-sm rounded-md">
                    <SelectValue placeholder="Select Model" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1a1d2e] border-gray-700 rounded-lg">
                    <SelectItem value="intelligent" className="text-white hover:bg-gray-800/50 cursor-pointer text-sm">
                      <div className="flex items-center gap-2">
                        <Brain className="w-3.5 h-3.5 text-[#00d4ff]" />
                        <span>Intelligent Routing</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="gpt5" className="text-white hover:bg-gray-800/50 cursor-pointer text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500"></div>
                        <span>GPT-5</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="claude" className="text-white hover:bg-gray-800/50 cursor-pointer text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                        <span>Claude 4 Sonnet</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="gemini" className="text-white hover:bg-gray-800/50 cursor-pointer text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                        <span>Gemini 2.5 Pro</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Multi-AI Toggle - Compact */}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-[#2a2d3a]/20 border border-gray-700/20 hover:border-gray-600/30 transition-colors">
                <Zap className={`w-3.5 h-3.5 transition-colors ${multiAiMode ? 'text-purple-400' : 'text-gray-500'}`} />
                <label htmlFor="multi-ai-toggle" className="text-xs text-gray-300 cursor-pointer whitespace-nowrap">
                  Multi-AI
                </label>
                <Popover>
                  <PopoverTrigger asChild>
                    <button className="text-gray-500 hover:text-gray-300 transition-colors">
                      <Info className="w-3 h-3" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-56 p-3 bg-[#1a1d2e] border-gray-700 rounded-lg" align="end">
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-white">Multi-AI Collaboration</p>
                      <p className="text-xs text-gray-400">Uses 3 models + synthesis</p>
                      <div className="px-2 py-1 bg-yellow-500/10 border border-yellow-500/30 rounded text-center">
                        <p className="text-xs text-yellow-400">⚠️ 4x credits</p>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
                <Switch
                  id="multi-ai-toggle"
                  checked={multiAiMode}
                  onCheckedChange={(checked) => {
                    setMultiAiMode(checked);
                    toast.info(checked ? 'Multi-AI: ON (4x)' : 'Multi-AI: OFF');
                  }}
                  className="data-[state=checked]:bg-purple-500"
                  data-testid="multi-ai-toggle"
                />
              </div>

              {/* Divider */}
              <div className="h-6 w-px bg-gray-700/50"></div>

              {/* Action Buttons - Compact */}
              <div className="flex items-center gap-1">
                <Button
                  onClick={async () => {
                    try {
                      toast.info('Researching...');
                      const response = await axios.post('/ai/research');
                      if (response.data.research_completed) {
                        toast.success(`Learned ${response.data.insights_found} strategies!`);
                      } else {
                        toast.error('Research failed');
                      }
                    } catch (error) {
                      toast.error('Failed to research');
                    }
                  }}
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-xs text-gray-400 hover:text-white hover:bg-gray-800/50 transition-colors"
                  data-testid="ai-research-button"
                >
                  <Brain className="w-3.5 h-3.5 mr-1" />
                  Research
                </Button>
                <Button
                  onClick={async () => {
                    try {
                      const response = await axios.post('/tasks/update-from-insights');
                      if (response.data.tasks_created > 0 || response.data.tasks_updated > 0) {
                        toast.success(`Updated ${response.data.tasks_updated}, created ${response.data.tasks_created} tasks`);
                      } else {
                        toast.info(response.data.message);
                      }
                    } catch (error) {
                      toast.error('Failed to update tasks');
                    }
                  }}
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-xs text-gray-400 hover:text-white hover:bg-gray-800/50 transition-colors"
                  data-testid="update-tasks-button"
                >
                  <Sparkles className="w-3.5 h-3.5 mr-1" />
                  Update Tasks
                </Button>
              </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
