import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Brain, User, Sparkles } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import ReactMarkdown from 'react-markdown';

export default function CoPilotPage() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [sessionId, setSessionId] = useState(localStorage.getItem('copilot_session_id') || null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    loadChatHistory();
  }, []);

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

  const showWelcomeMessage = () => {
    setMessages([{
      role: 'assistant',
      content: 'Hello! I\'m your AI Business Co-Pilot. I can help you with:\n\n• **Strategic business planning**\n• **Ad campaign optimization**\n• **Financial analysis**\n• **Growth strategies**\n• **Automation recommendations**\n\n💾 All conversations are automatically saved and analyzed to generate priority tasks for you.\n\nWhat would you like to discuss today?',
      model_used: 'system'
    }]);
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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
        session_id: sessionId
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
    <div className="h-[calc(100vh-4rem)] flex flex-col" data-testid="copilot-page">
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
            ))}

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
              const response = await axios.post('/tasks/generate-from-chat');
              toast.success(response.data.message || 'Tasks generated from conversation!');
            } catch (error) {
              toast.error('Failed to generate tasks from chat');
            }
          }}
          className="bg-gradient-to-r from-[#00ff88] to-[#00d4ff] hover:opacity-90 h-full"
          data-testid="generate-tasks-from-chat-button"
        >
          <Sparkles className="w-4 h-4 mr-2" />
          Generate Tasks from Chat
        </Button>
      </div>
    </div>
  );
}
