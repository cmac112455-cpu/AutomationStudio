import { useCallback, useEffect, useRef, useState } from 'react';
import { useVoiceStream } from 'voice-stream';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

export const useElevenLabsConversation = ({ agentId, callLogId, onTranscript, onAgentResponse, onError }) => {
  const websocketRef = useRef(null);
  const audioContextRef = useRef(null);
  const audioQueueRef = useRef([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  const { startStreaming, stopStreaming } = useVoiceStream({
    onAudioChunked: (audioData) => {
      if (!websocketRef.current || websocketRef.current.readyState !== WebSocket.OPEN) {
        return;
      }
      
      websocketRef.current.send(JSON.stringify({
        user_audio_chunk: audioData,
      }));
    },
  });

  const playAudioChunk = useCallback(async (base64Audio) => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }

      const audioContext = audioContextRef.current;
      
      // Decode base64 to array buffer
      const binaryString = atob(base64Audio);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Decode audio data
      const audioBuffer = await audioContext.decodeAudioData(bytes.buffer);
      
      // Create source and play
      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext.destination);
      
      return new Promise((resolve) => {
        source.onended = () => {
          setIsPlaying(false);
          resolve();
        };
        setIsPlaying(true);
        source.start(0);
      });
    } catch (error) {
      console.error('Error playing audio chunk:', error);
      setIsPlaying(false);
    }
  }, []);

  const processAudioQueue = useCallback(async () => {
    if (audioQueueRef.current.length === 0 || isPlaying) {
      return;
    }

    const audioChunk = audioQueueRef.current.shift();
    await playAudioChunk(audioChunk);
    
    // Process next chunk
    if (audioQueueRef.current.length > 0) {
      processAudioQueue();
    }
  }, [isPlaying, playAudioChunk]);

  const startConversation = useCallback(async () => {
    if (isConnected) return;

    try {
      console.log('🔗 Getting signed URL from backend...');
      
      // Get signed URL from our backend
      const response = await fetch(`${BACKEND_URL}/api/conversational-ai/agents/${agentId}/signed-url`);
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to get signed URL');
      }
      
      const data = await response.json();
      const signedUrl = data.signed_url;
      
      console.log('✅ Signed URL received');
      console.log('🔌 Connecting to ElevenLabs WebSocket...');

      const websocket = new WebSocket(signedUrl);

      websocket.onopen = async () => {
        console.log('✅ WebSocket connected');
        setIsConnected(true);
        
        // Send conversation initiation
        websocket.send(JSON.stringify({
          type: "conversation_initiation_client_data",
        }));
        
        console.log('🎤 Starting audio streaming...');
        await startStreaming();
      };

      websocket.onmessage = async (event) => {
        const data = JSON.parse(event.data);
        console.log('📨 WebSocket message:', data.type);

        // Handle ping events to keep connection alive
        if (data.type === "ping") {
          setTimeout(() => {
            if (websocket.readyState === WebSocket.OPEN) {
              websocket.send(JSON.stringify({
                type: "pong",
                event_id: data.ping_event.event_id,
              }));
              console.log('🏓 Pong sent');
            }
          }, data.ping_event.ping_ms || 0);
        }

        // User transcript
        if (data.type === "user_transcript") {
          const transcript = data.user_transcription_event.user_transcript;
          console.log('👤 User said:', transcript);
          if (onTranscript) {
            onTranscript(transcript);
          }
        }

        // Agent response text
        if (data.type === "agent_response") {
          const response = data.agent_response_event.agent_response;
          console.log('🤖 Agent says:', response);
          if (onAgentResponse) {
            onAgentResponse(response);
          }
        }

        // Agent response correction
        if (data.type === "agent_response_correction") {
          const corrected = data.agent_response_correction_event.corrected_agent_response;
          console.log('🔄 Agent corrected:', corrected);
          if (onAgentResponse) {
            onAgentResponse(corrected);
          }
        }

        // Audio response
        if (data.type === "audio") {
          const audioBase64 = data.audio_event.audio_base_64;
          console.log('🎵 Audio chunk received');
          audioQueueRef.current.push(audioBase64);
          processAudioQueue();
        }

        // Interruption
        if (data.type === "interruption") {
          console.log('⚠️ Conversation interrupted');
          // Clear audio queue on interruption
          audioQueueRef.current = [];
          setIsPlaying(false);
        }
      };

      websocket.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        if (onError) {
          onError(error);
        }
      };

      websocket.onclose = async () => {
        console.log('🔌 WebSocket disconnected');
        websocketRef.current = null;
        setIsConnected(false);
        stopStreaming();
        
        // Clean up audio
        audioQueueRef.current = [];
        setIsPlaying(false);
      };

      websocketRef.current = websocket;

    } catch (error) {
      console.error('❌ Failed to start conversation:', error);
      if (onError) {
        onError(error);
      }
    }
  }, [agentId, isConnected, startStreaming, onTranscript, onAgentResponse, onError, processAudioQueue]);

  const stopConversation = useCallback(async () => {
    if (!websocketRef.current) return;
    
    console.log('🛑 Stopping conversation...');
    websocketRef.current.close();
    
    // Clean up audio context
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      if (websocketRef.current) {
        websocketRef.current.close();
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  return {
    startConversation,
    stopConversation,
    isConnected,
    isPlaying
  };
};
