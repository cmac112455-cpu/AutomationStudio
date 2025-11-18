import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { Key, Check, X, ExternalLink, Loader, Search } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

// Configure axios defaults
axios.defaults.baseURL = BACKEND_URL;

const IntegrationsPage = () => {
  const [integrations, setIntegrations] = useState({
    elevenlabs: { apiKey: '', connected: false, loading: false, errorMessage: '' },
    twilio: { accountSid: '', authToken: '', connected: false, loading: false, errorMessage: '' },
    manychat: { apiKey: '', connected: false, loading: false, errorMessage: '' }
  });
  const [saveStatus, setSaveStatus] = useState({});

  useEffect(() => {
    loadIntegrations();
  }, []);

  const loadIntegrations = async () => {
    try {
      const token = localStorage.getItem('apoe_token');
      const response = await axios.get(`${BACKEND_URL}/api/integrations`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data) {
        setIntegrations(prev => ({
          elevenlabs: {
            ...prev.elevenlabs,
            apiKey: response.data.elevenlabs?.apiKey || '',
            connected: !!response.data.elevenlabs?.apiKey
          },
          twilio: {
            ...prev.twilio,
            accountSid: response.data.twilio?.accountSid || '',
            authToken: response.data.twilio?.authToken || '',
            connected: !!(response.data.twilio?.accountSid && response.data.twilio?.authToken)
          },
          manychat: {
            ...prev.manychat,
            apiKey: response.data.manychat?.apiKey || '',
            connected: !!response.data.manychat?.apiKey
          }
        }));
      }
    } catch (error) {
      console.error('Failed to load integrations:', error);
    }
  };

  const saveIntegration = async (service) => {
    setIntegrations(prev => ({
      ...prev,
      [service]: { ...prev[service], loading: true, errorMessage: '' }
    }));

    try {
      const token = localStorage.getItem('apoe_token');
      
      if (!token) {
        throw new Error('Not authenticated. Please log in again.');
      }

      console.log('Saving integration:', service);
      console.log('API Key length:', integrations[service].apiKey.length);
      console.log('Backend URL:', BACKEND_URL);

      const payload = service === 'twilio' 
        ? { 
            accountSid: integrations[service].accountSid,
            authToken: integrations[service].authToken
          }
        : { apiKey: integrations[service].apiKey };

      const response = await axios.post(
        `${BACKEND_URL}/api/integrations/${service}`,
        payload,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      console.log('Integration saved successfully:', response.data);

      setIntegrations(prev => ({
        ...prev,
        [service]: { ...prev[service], connected: true, loading: false, errorMessage: '' }
      }));

      setSaveStatus(prev => ({ ...prev, [service]: 'success' }));
      setTimeout(() => setSaveStatus(prev => ({ ...prev, [service]: null })), 3000);
    } catch (error) {
      console.error('Failed to save integration:', error);
      console.error('Error response:', error.response);
      
      let errorMessage = 'Failed to connect. Please check your API key.';
      
      if (error.response?.status === 401) {
        errorMessage = 'Session expired. Please refresh the page and log in again.';
      } else if (error.response?.data?.detail) {
        errorMessage = error.response.data.detail;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setIntegrations(prev => ({
        ...prev,
        [service]: { ...prev[service], loading: false, errorMessage }
      }));
      setSaveStatus(prev => ({ ...prev, [service]: 'error' }));
      setTimeout(() => setSaveStatus(prev => ({ ...prev, [service]: null })), 3000);
    }
  };

  const disconnectIntegration = async (service) => {
    try {
      const token = localStorage.getItem('apoe_token');
      await axios.delete(`${BACKEND_URL}/api/integrations/${service}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setIntegrations(prev => ({
        ...prev,
        [service]: { apiKey: '', connected: false, loading: false }
      }));
    } catch (error) {
      console.error('Failed to disconnect integration:', error);
    }
  };

  const handleInputChange = (service, field, value) => {
    setIntegrations(prev => ({
      ...prev,
      [service]: { ...prev[service], [field]: value }
    }));
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIntegration, setSelectedIntegration] = useState(null);

  const integrationsList = [
    {
      id: 'elevenlabs',
      name: 'ElevenLabs',
      description: 'AI voice generation and text-to-speech',
      category: 'AI & Voice',
      logo: (
        <svg className="w-full h-full" viewBox="0 0 200 200" fill="none">
          <rect width="200" height="200" rx="40" fill="url(#elevenlabs-gradient)"/>
          <path d="M50 100L80 70V130L50 100Z" fill="white"/>
          <path d="M90 100L120 70V130L90 100Z" fill="white" opacity="0.7"/>
          <path d="M130 100L160 70V130L130 100Z" fill="white" opacity="0.4"/>
          <defs>
            <linearGradient id="elevenlabs-gradient" x1="0" y1="0" x2="200" y2="200">
              <stop offset="0%" stopColor="#8B5CF6"/>
              <stop offset="100%" stopColor="#EC4899"/>
            </linearGradient>
          </defs>
        </svg>
      ),
      connected: integrations.elevenlabs.connected,
      data: integrations.elevenlabs
    },
    {
      id: 'twilio',
      name: 'Twilio',
      description: 'Phone numbers and SMS for voice AI calling',
      category: 'Communication',
      logo: (
        <svg className="w-full h-full" viewBox="0 0 200 200" fill="none">
          <rect width="200" height="200" rx="40" fill="#F22F46"/>
          <circle cx="100" cy="100" r="60" fill="none" stroke="white" strokeWidth="8"/>
          <circle cx="80" cy="80" r="12" fill="white"/>
          <circle cx="120" cy="80" r="12" fill="white"/>
          <circle cx="80" cy="120" r="12" fill="white"/>
          <circle cx="120" cy="120" r="12" fill="white"/>
        </svg>
      ),
      connected: integrations.twilio.connected,
      data: integrations.twilio
    }
  ];

  const filteredIntegrations = integrationsList.filter(integration =>
    integration.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    integration.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    integration.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0e1a] via-[#1a1d2e] to-[#0a0e1a] text-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">
            Integrations
          </h1>
          <p className="text-gray-400 text-lg">Connect your favorite services and tools</p>
        </div>

        {/* Search Bar */}
        <div className="mb-8">
          <div className="relative max-w-2xl">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search integrations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-[#1a1d2e]/60 backdrop-blur-xl border border-gray-800/50 rounded-2xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-transparent transition-all"
            />
          </div>
        </div>

        {/* Integrations Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {filteredIntegrations.map((integration) => (
            <div key={integration.id} className="group relative">
              <div className="bg-[#1a1d2e]/60 backdrop-blur-xl border border-gray-800/50 rounded-2xl p-6 hover:border-purple-500/30 transition-all duration-300 hover:shadow-lg hover:shadow-purple-500/10">
                {/* Logo */}
                <div className="w-16 h-16 mb-4 rounded-xl overflow-hidden">
                  {integration.logo}
                </div>
                
                {/* Content */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xl font-semibold text-white">{integration.name}</h3>
                    {integration.connected && (
                      <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs font-medium rounded-full flex items-center">
                        <Check className="w-3 h-3 mr-1" />
                        Connected
                      </span>
                    )}
                  </div>
                  <p className="text-gray-400 text-sm mb-2">{integration.description}</p>
                  <span className="inline-block px-2 py-1 bg-purple-500/20 text-purple-300 text-xs rounded-full">
                    {integration.category}
                  </span>
                </div>

                {/* Action Button */}
                <button
                  onClick={() => {
                    setSelectedIntegration(integration.id);
                  }}
                  className="w-full py-3 px-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-medium rounded-xl transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98]"
                >
                  {integration.connected ? 'Manage' : 'Connect'}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* No Results */}
        {filteredIntegrations.length === 0 && (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-800/50 flex items-center justify-center">
              <Search className="w-8 h-8 text-gray-500" />
            </div>
            <h3 className="text-xl font-semibold text-gray-300 mb-2">No integrations found</h3>
            <p className="text-gray-500">Try adjusting your search terms</p>
          </div>
        )}

        {/* Legacy Integration Cards (Hidden but kept for functionality) */}
        <div className="hidden">
        {/* ElevenLabs Integration */}
        <div className="bg-[#1a1d2e] rounded-xl border border-gray-800 p-6 mb-6">
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-start space-x-4">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/>
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold text-white mb-2 flex items-center">
                  ElevenLabs
                  {integrations.elevenlabs.connected && (
                    <span className="ml-3 px-2 py-1 bg-green-500/20 text-green-400 text-xs font-medium rounded-full flex items-center">
                      <Check className="w-3 h-3 mr-1" />
                      Connected
                    </span>
                  )}
                </h2>
                <p className="text-gray-400 text-sm mb-2">
                  Generate realistic AI voiceovers with natural-sounding voices
                </p>
                <a
                  href="https://elevenlabs.io/app/settings/api-keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-purple-400 hover:text-purple-300 text-sm flex items-center"
                >
                  Get your API key from ElevenLabs
                  <ExternalLink className="w-3 h-3 ml-1" />
                </a>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                API Key
              </label>
              <div className="flex space-x-3">
                <div className="flex-1 relative">
                  <Key className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type="password"
                    value={integrations.elevenlabs.apiKey}
                    onChange={(e) => handleInputChange('elevenlabs', 'apiKey', e.target.value)}
                    placeholder="sk_..."
                    className="w-full pl-10 pr-4 py-2.5 bg-[#0f1218] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                
                {integrations.elevenlabs.connected ? (
                  <button
                    onClick={() => disconnectIntegration('elevenlabs')}
                    className="px-6 py-2.5 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors font-medium"
                  >
                    Disconnect
                  </button>
                ) : (
                  <button
                    onClick={() => saveIntegration('elevenlabs')}
                    disabled={!integrations.elevenlabs.apiKey || integrations.elevenlabs.loading}
                    className="px-6 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                  >
                    {integrations.elevenlabs.loading ? (
                      <>
                        <Loader className="w-4 h-4 mr-2 animate-spin" />
                        Connecting...
                      </>
                    ) : (
                      'Connect'
                    )}
                  </button>
                )}
              </div>
              
              {saveStatus.elevenlabs === 'success' && (
                <div className="mt-2 flex items-center text-green-400 text-sm">
                  <Check className="w-4 h-4 mr-1" />
                  Successfully connected to ElevenLabs
                </div>
              )}
              
              {saveStatus.elevenlabs === 'error' && (
                <div className="mt-2 flex items-start text-red-400 text-sm">
                  <X className="w-4 h-4 mr-1 mt-0.5 flex-shrink-0" />
                  <span>{integrations.elevenlabs.errorMessage || 'Failed to connect. Please check your API key.'}</span>
                </div>
              )}
            </div>

            {/* Usage Info */}
            <div className="bg-[#0f1218] rounded-lg p-4 border border-gray-800">
              <h3 className="text-sm font-medium text-white mb-2">How to use:</h3>
              <ul className="text-sm text-gray-400 space-y-1">
                <li>• Add "Text-to-Speech" node in your workflow</li>
                <li>• It will automatically use your ElevenLabs API key</li>
                <li>• Use "Audio Overlay" node to add voiceover to videos</li>
                <li>• Choose from various realistic AI voices</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Twilio Integration */}
        <div className="bg-[#1a1d2e] rounded-xl border border-gray-800 p-6 mb-6">
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-start space-x-4">
              <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-red-600 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold text-white mb-2 flex items-center">
                  Twilio
                  {integrations.twilio.connected && (
                    <span className="ml-3 px-2 py-1 bg-green-500/20 text-green-400 text-xs font-medium rounded-full flex items-center">
                      <Check className="w-3 h-3 mr-1" />
                      Connected
                    </span>
                  )}
                </h2>
                <p className="text-gray-400 text-sm mb-2">
                  Connect phone numbers for voice AI calling with ElevenLabs agents
                </p>
                <a
                  href="https://console.twilio.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-red-400 hover:text-red-300 text-sm flex items-center"
                >
                  Get your credentials from Twilio Console
                  <ExternalLink className="w-3 h-3 ml-1" />
                </a>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Account SID
              </label>
              <div className="relative">
                <Key className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  value={integrations.twilio.accountSid}
                  onChange={(e) => handleInputChange('twilio', 'accountSid', e.target.value)}
                  placeholder="AC..."
                  className="w-full pl-10 pr-4 py-2.5 bg-[#0f1218] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Auth Token
              </label>
              <div className="relative">
                <Key className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="password"
                  value={integrations.twilio.authToken}
                  onChange={(e) => handleInputChange('twilio', 'authToken', e.target.value)}
                  placeholder="Enter your auth token"
                  className="w-full pl-10 pr-4 py-2.5 bg-[#0f1218] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
            </div>

            <div className="flex justify-end">
              {integrations.twilio.connected ? (
                <button
                  onClick={() => disconnectIntegration('twilio')}
                  className="px-6 py-2.5 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors font-medium"
                >
                  Disconnect
                </button>
              ) : (
                <button
                  onClick={() => saveIntegration('twilio')}
                  disabled={!integrations.twilio.accountSid || !integrations.twilio.authToken || integrations.twilio.loading}
                  className="px-6 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                >
                  {integrations.twilio.loading ? (
                    <>
                      <Loader className="w-4 h-4 mr-2 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    'Connect'
                  )}
                </button>
              )}
            </div>
            
            {saveStatus.twilio === 'success' && (
              <div className="flex items-center text-green-400 text-sm">
                <Check className="w-4 h-4 mr-1" />
                Successfully connected to Twilio
              </div>
            )}
            
            {saveStatus.twilio === 'error' && (
              <div className="flex items-start text-red-400 text-sm">
                <X className="w-4 h-4 mr-1 mt-0.5 flex-shrink-0" />
                <span>{integrations.twilio.errorMessage || 'Failed to connect. Please check your credentials.'}</span>
              </div>
            )}

            {/* Usage Info */}
            <div className="bg-[#0f1218] rounded-lg p-4 border border-gray-800">
              <h3 className="text-sm font-medium text-white mb-2">How to use:</h3>
              <ul className="text-sm text-gray-400 space-y-1">
                <li>• Connect Twilio to enable phone calling for your ElevenLabs AI agents</li>
                <li>• Your agents can make and receive real phone calls</li>
                <li>• Find your Account SID and Auth Token in the <a href="https://console.twilio.com/" target="_blank" rel="noopener noreferrer" className="text-red-400 hover:underline">Twilio Console</a></li>
                <li>• Configure phone numbers in your Twilio dashboard</li>
                <li>• Use the ElevenLabs AI node in workflows to trigger voice calls</li>
              </ul>
            </div>
          </div>
        </div>

        </div>

        {/* More integrations coming soon */}
        <div className="text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-r from-purple-500/20 to-pink-500/20 flex items-center justify-center">
            <ExternalLink className="w-8 h-8 text-purple-400" />
          </div>
          <h3 className="text-xl font-semibold text-gray-300 mb-2">More integrations coming soon</h3>
          <p className="text-gray-500">We're constantly adding new integrations to help you build better workflows</p>
        </div>

        {/* Integration Detail Modal */}
        {selectedIntegration && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6" onClick={() => setSelectedIntegration(null)}>
            <div className="bg-[#1a1d2e] rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-gray-800/50 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              {/* ElevenLabs Detail */}
              {selectedIntegration === 'elevenlabs' && (
                <div className="p-8">
                  <div className="flex items-start justify-between mb-6">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-xl overflow-hidden">
                        {integrationsList.find(i => i.id === 'elevenlabs').logo}
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold text-white mb-1">ElevenLabs</h2>
                        <p className="text-gray-400">AI voice generation</p>
                      </div>
                    </div>
                    <button onClick={() => setSelectedIntegration(null)} className="text-gray-400 hover:text-white">
                      <X className="w-6 h-6" />
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">API Key</label>
                      <div className="relative">
                        <Key className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
                        <input
                          type="password"
                          value={integrations.elevenlabs.apiKey}
                          onChange={(e) => handleInputChange('elevenlabs', 'apiKey', e.target.value)}
                          placeholder="sk_..."
                          className="w-full pl-10 pr-4 py-3 bg-[#0f1218] border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end gap-3">
                      {integrations.elevenlabs.connected ? (
                        <button
                          onClick={() => disconnectIntegration('elevenlabs')}
                          className="px-6 py-3 bg-red-500/20 text-red-400 rounded-xl hover:bg-red-500/30 transition-colors font-medium"
                        >
                          Disconnect
                        </button>
                      ) : (
                        <button
                          onClick={() => saveIntegration('elevenlabs')}
                          disabled={!integrations.elevenlabs.apiKey || integrations.elevenlabs.loading}
                          className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl hover:from-purple-700 hover:to-pink-700 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                        >
                          {integrations.elevenlabs.loading ? (
                            <>
                              <Loader className="w-4 h-4 mr-2 animate-spin" />
                              Connecting...
                            </>
                          ) : (
                            'Connect'
                          )}
                        </button>
                      )}
                    </div>

                    {saveStatus.elevenlabs === 'success' && (
                      <div className="flex items-center text-green-400 text-sm">
                        <Check className="w-4 h-4 mr-1" />
                        Successfully connected to ElevenLabs
                      </div>
                    )}
                    
                    {saveStatus.elevenlabs === 'error' && (
                      <div className="flex items-start text-red-400 text-sm">
                        <X className="w-4 h-4 mr-1 mt-0.5 flex-shrink-0" />
                        <span>{integrations.elevenlabs.errorMessage || 'Failed to connect. Please check your API key.'}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Twilio Detail */}
              {selectedIntegration === 'twilio' && (
                <div className="p-8">
                  <div className="flex items-start justify-between mb-6">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-xl overflow-hidden">
                        {integrationsList.find(i => i.id === 'twilio').logo}
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold text-white mb-1">Twilio</h2>
                        <p className="text-gray-400">Phone calling integration</p>
                      </div>
                    </div>
                    <button onClick={() => setSelectedIntegration(null)} className="text-gray-400 hover:text-white">
                      <X className="w-6 h-6" />
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Account SID</label>
                      <div className="relative">
                        <Key className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
                        <input
                          type="text"
                          value={integrations.twilio.accountSid}
                          onChange={(e) => handleInputChange('twilio', 'accountSid', e.target.value)}
                          placeholder="AC..."
                          className="w-full pl-10 pr-4 py-3 bg-[#0f1218] border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Auth Token</label>
                      <div className="relative">
                        <Key className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
                        <input
                          type="password"
                          value={integrations.twilio.authToken}
                          onChange={(e) => handleInputChange('twilio', 'authToken', e.target.value)}
                          placeholder="Enter your auth token"
                          className="w-full pl-10 pr-4 py-3 bg-[#0f1218] border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end gap-3">
                      {integrations.twilio.connected ? (
                        <button
                          onClick={() => disconnectIntegration('twilio')}
                          className="px-6 py-3 bg-red-500/20 text-red-400 rounded-xl hover:bg-red-500/30 transition-colors font-medium"
                        >
                          Disconnect
                        </button>
                      ) : (
                        <button
                          onClick={() => saveIntegration('twilio')}
                          disabled={!integrations.twilio.accountSid || !integrations.twilio.authToken || integrations.twilio.loading}
                          className="px-6 py-3 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-xl hover:from-red-700 hover:to-red-800 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                        >
                          {integrations.twilio.loading ? (
                            <>
                              <Loader className="w-4 h-4 mr-2 animate-spin" />
                              Connecting...
                            </>
                          ) : (
                            'Connect'
                          )}
                        </button>
                      )}
                    </div>

                    {saveStatus.twilio === 'success' && (
                      <div className="flex items-center text-green-400 text-sm">
                        <Check className="w-4 h-4 mr-1" />
                        Successfully connected to Twilio
                      </div>
                    )}
                    
                    {saveStatus.twilio === 'error' && (
                      <div className="flex items-start text-red-400 text-sm">
                        <X className="w-4 h-4 mr-1 mt-0.5 flex-shrink-0" />
                        <span>{integrations.twilio.errorMessage || 'Failed to connect. Please check your credentials.'}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default IntegrationsPage;
