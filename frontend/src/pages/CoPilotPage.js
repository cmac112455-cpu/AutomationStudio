import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Brain, User, Sparkles, MessageSquare, Clock, Target, Plus, Trash2 } from 'lucide-react';
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
  const messagesEndRef = useRef(null);

  useEffect(() => {
    loadChatHistory();
    loadChatSessions();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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
        task_id: currentTaskId
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
      <div className={`glass-morph rounded-2xl p-4 transition-all duration-300 ${showHistory ? 'w-80' : 'w-16'}`}>
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

            <ScrollArea className="h-[calc(100vh-16rem)]">
              <div className="space-y-2">
                {sessions.map((session) => (
                  <div
                    key={session.id}
                    className={`relative group w-full text-left p-3 rounded-lg transition-colors ${
                      sessionId === session.id
                        ? 'bg-[#00d4ff]/20 border border-[#00d4ff]'
                        : 'hover:bg-gray-800'
                    }`}
                  >
                    <button
                      onClick={() => switchSession(session.id)}
                      className="w-full text-left"
                      data-testid={`session-${session.id}`}
                    >
                      <div className="flex items-start gap-2">
                        {session.session_type === 'task' ? (
                          <Target className="w-4 h-4 text-[#00d4ff] mt-1 flex-shrink-0" />
                        ) : (
                          <MessageSquare className="w-4 h-4 text-gray-400 mt-1 flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0 pr-8">
                          <p className="text-sm font-medium truncate">{session.title}</p>
                          <p className="text-xs text-gray-400 truncate">{session.last_message}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            <Clock className="w-3 h-3 inline mr-1" />
                            {new Date(session.last_updated).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </button>
                    <button
                      onClick={(e) => deleteSession(session.id, e)}
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-red-500/20 rounded"
                      data-testid={`delete-session-${session.id}`}
                      title="Delete chat"
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </button>
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
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="mb-6">
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
        <div className="flex-1 glass-morph rounded-2xl p-6 flex flex-col">
          {/* Messages */}
          <ScrollArea className="flex-1 pr-4 mb-4" data-testid="chat-messages">
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

          {/* Input Area */}
          <div className="border-t border-gray-800 pt-4">
            <div className="flex gap-3">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask me anything about your business strategy, ad optimization, or growth plans..."
                className="flex-1 bg-[#1a1d2e] border-gray-700 text-white resize-none min-h-[60px] max-h-[120px]"
                disabled={loading}
                data-testid="chat-input"
              />
              <Button
                onClick={sendMessage}
                disabled={loading || !input.trim()}
                className="bg-gradient-to-r from-[#00d4ff] to-[#4785ff] hover:opacity-90 px-8"
                data-testid="send-button"
              >
                <Send className="w-5 h-5" />
              </Button>
            </div>
            <div className="flex items-center justify-between mt-2">
              <p className="text-xs text-gray-500">
                Press Enter to send, Shift+Enter for new line
              </p>
              <p className="text-xs text-green-500 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                Chat auto-saved
              </p>
            </div>
          </div>
        </div>

        {/* Info Cards & Actions */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
          <div className="glass-morph p-4 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
              <p className="text-sm font-semibold">GPT-5</p>
            </div>
            <p className="text-xs text-gray-400">Strategic planning & roadmaps</p>
          </div>
          <div className="glass-morph p-4 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
              <p className="text-sm font-semibold">Claude 4 Sonnet</p>
            </div>
            <p className="text-xs text-gray-400">Data analysis & performance metrics</p>
          </div>
          <div className="glass-morph p-4 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse"></div>
              <p className="text-sm font-semibold">Gemini 2.5 Pro</p>
            </div>
            <p className="text-xs text-gray-400">General optimization & insights</p>
          </div>
          <Button
            onClick={async () => {
              try {
                const response = await axios.post('/tasks/update-from-insights');
                if (response.data.tasks_created > 0 || response.data.tasks_updated > 0) {
                  toast.success(`Updated ${response.data.tasks_updated} tasks, created ${response.data.tasks_created} new tasks. ${response.data.reasoning}`);
                } else {
                  toast.info(response.data.message);
                }
              } catch (error) {
                toast.error('Failed to update tasks');
              }
            }}
            className="bg-gradient-to-r from-[#00ff88] to-[#00d4ff] hover:opacity-90 h-full"
            data-testid="update-tasks-button"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            Update Tasks from Insights
          </Button>
        </div>
      </div>
    </div>
  );
}
