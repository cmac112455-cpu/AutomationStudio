import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { Key, Check, X, ExternalLink, Loader } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

// Configure axios defaults
axios.defaults.baseURL = BACKEND_URL;

const IntegrationsPage = () => {
  const [integrations, setIntegrations] = useState({
    elevenlabs: { apiKey: '', connected: false, loading: false, errorMessage: '' }
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

      const response = await axios.post(
        `${BACKEND_URL}/api/integrations/${service}`,
        { apiKey: integrations[service].apiKey },
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
      const token = localStorage.getItem('token');
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

  const handleInputChange = (service, value) => {
    setIntegrations(prev => ({
      ...prev,
      [service]: { ...prev[service], apiKey: value }
    }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f1218] to-[#1a1d2e]">
      {/* Header */}
      <div className="border-b border-gray-800 bg-[#0f1218]/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link
                to="/automation/studio"
                className="text-gray-400 hover:text-white transition-colors"
              >
                ← Back to Studio
              </Link>
              <div className="h-6 w-px bg-gray-700"></div>
              <h1 className="text-2xl font-bold text-white">Integrations</h1>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-8">
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
                    onChange={(e) => handleInputChange('elevenlabs', e.target.value)}
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

        {/* More integrations coming soon */}
        <div className="text-center py-8">
          <p className="text-gray-500 text-sm">More integrations coming soon...</p>
        </div>
      </div>
    </div>
  );
};

export default IntegrationsPage;
