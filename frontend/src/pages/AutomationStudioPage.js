import React, { useState, useCallback, useEffect } from 'react';
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  MarkerType,
  Handle,
  Position,
} from 'reactflow';
import 'reactflow/dist/style.css';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Play, Save, Plus, Trash2, Workflow, Zap, Database, Globe, MessageSquare, Mic, Send, Video, Image, CheckSquare, Settings, X, Clock, Copy, Calendar, MoreVertical, Camera, Loader, Volume2, Edit2 } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

// Helper component for nodes with handles
const NodeWrapper = ({ children, color, hasInput = false, hasOutput = true, nodeType = 'default' }) => {
  const [showMenu, setShowMenu] = React.useState(false);
  
  return (
    <div className="relative group">
      {hasInput && (
        <Handle 
          type="target" 
          position={Position.Left} 
          style={{ background: color, width: '12px', height: '12px', border: '2px solid #0f1218' }}
        />
      )}
      {children}
      {hasOutput && (
        <Handle 
          type="source" 
          position={Position.Right} 
          style={{ background: color, width: '12px', height: '12px', border: '2px solid #0f1218' }}
        />
      )}
      
      {/* Three-dot menu - only show for non-start nodes */}
      {nodeType !== 'start' && (
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(!showMenu);
            }}
            onMouseDown={(e) => e.stopPropagation()}
            className="p-1 rounded bg-black/20 hover:bg-black/40 backdrop-blur-sm border border-gray-700/50 transition-colors"
            title="Node options"
          >
            <MoreVertical className="w-3.5 h-3.5 text-gray-300" />
          </button>
          
          {showMenu && (
            <>
              <div 
                className="fixed inset-0 z-40"
                onClick={() => setShowMenu(false)}
              />
              <div className="absolute right-0 top-8 bg-[#1a1d2e] border border-gray-700 rounded-lg shadow-xl z-50 min-w-[150px]">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMenu(false);
                    // Trigger delete via custom event
                    window.dispatchEvent(new CustomEvent('deleteNode', { detail: { nodeType } }));
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                  className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-red-500/10 flex items-center gap-2 transition-colors rounded-lg"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete Node
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

// Custom Node Components
const StartNode = ({ data }) => {
  return (
    <NodeWrapper color="#22c55e" hasInput={false}>
      <div className="px-4 py-3 rounded-lg border-2 border-green-500 bg-green-500/10 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-green-500" />
          <div className="font-semibold text-white">Start</div>
        </div>
        <div className="text-xs text-gray-400 mt-1">Drag from → to connect</div>
      </div>
    </NodeWrapper>
  );
};

const GeminiNode = ({ data, id }) => {
  return (
    <NodeWrapper 
      color="#a855f7" 
      hasInput={true}
      nodeType="gemini"
    >
      <div className="px-4 py-3 rounded-lg border-2 border-purple-500 bg-purple-500/10 backdrop-blur-sm min-w-[200px]">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-purple-500" />
          <div className="font-semibold text-white">AI Chat (Gemini)</div>
        </div>
        <div className="text-xs text-gray-400 mt-1">Prompt: {data.prompt || 'Click to configure'}</div>
      </div>
    </NodeWrapper>
  );
};

const HttpNode = ({ data }) => {
  return (
    <NodeWrapper color="#3b82f6" hasInput={true} nodeType="http">
      <div className="px-4 py-3 rounded-lg border-2 border-blue-500 bg-blue-500/10 backdrop-blur-sm min-w-[200px]">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-blue-500" />
          <div className="font-semibold text-white">HTTP Request</div>
        </div>
        <div className="text-xs text-gray-400 mt-1">
          {data.method || 'GET'} {data.url || 'Click to configure'}
        </div>
      </div>
    </NodeWrapper>
  );
};

const DatabaseNode = ({ data }) => {
  return (
    <NodeWrapper color="#06b6d4" hasInput={true} nodeType="database">
      <div className="px-4 py-3 rounded-lg border-2 border-cyan-500 bg-cyan-500/10 backdrop-blur-sm min-w-[200px]">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-cyan-500" />
          <div className="font-semibold text-white">Database Read</div>
        </div>
        <div className="text-xs text-gray-400 mt-1">
          Collection: {data.collection || 'Click to configure'}
        </div>
      </div>
    </NodeWrapper>
  );
};

const ElevenLabsNode = ({ data }) => {
  return (
    <NodeWrapper color="#f97316" hasInput={true} nodeType="elevenlabs">
      <div className="px-4 py-3 rounded-lg border-2 border-orange-500 bg-orange-500/10 backdrop-blur-sm min-w-[200px]">
        <div className="flex items-center gap-2">
          <Mic className="w-4 h-4 text-orange-500" />
          <div className="font-semibold text-white">ElevenLabs TTS</div>
        </div>
        <div className="text-xs text-gray-400 mt-1">
          Voice: {data.voice || 'Click to configure'}
        </div>
      </div>
    </NodeWrapper>
  );
};

const ElevenLabsConversationalNode = ({ data }) => {
  return (
    <NodeWrapper color="#f59e0b" hasInput={true} nodeType="elevenlabsconversational">
      <div className="px-4 py-3 rounded-lg border-2 border-amber-500 bg-amber-500/10 backdrop-blur-sm min-w-[200px]">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-amber-500" />
          <div className="font-semibold text-white">ElevenLabs AI Agent</div>
        </div>
        <div className="text-xs text-gray-400 mt-1">
          {data.agentName || 'Click to configure'}
        </div>
      </div>
    </NodeWrapper>
  );
};

const ManyChatNode = ({ data }) => {
  return (
    <NodeWrapper color="#ec4899" hasInput={true} nodeType="manychat">
      <div className="px-4 py-3 rounded-lg border-2 border-pink-500 bg-pink-500/10 backdrop-blur-sm min-w-[200px]">
        <div className="flex items-center gap-2">
          <Send className="w-4 h-4 text-pink-500" />
          <div className="font-semibold text-white">ManyChat</div>
        </div>
        <div className="text-xs text-gray-400 mt-1">
          Action: {data.action || 'Click to configure'}
        </div>
      </div>
    </NodeWrapper>
  );
};

const VideoGenNode = ({ data }) => {
  return (
    <NodeWrapper color="#a855f7" hasInput={true} nodeType="videogen">
      <div className="px-4 py-3 rounded-lg border-2 border-purple-500 bg-purple-500/10 backdrop-blur-sm min-w-[200px]">
        <div className="flex items-center gap-2">
          <Video className="w-4 h-4 text-purple-500" />
          <div className="font-semibold text-white">Video Generation</div>
        </div>
        <div className="text-xs text-gray-400 mt-1">
          {data.duration ? `${data.duration}s` : 'Click to configure'}
        </div>
      </div>
    </NodeWrapper>
  );
};

const ImageToVideoNode = ({ data }) => {
  return (
    <NodeWrapper color="#f97316" hasInput={true} nodeType="imagetovideo">
      <div className="px-4 py-3 rounded-lg border-2 border-orange-500 bg-orange-500/10 backdrop-blur-sm min-w-[200px]">
        <div className="flex items-center gap-2">
          <Video className="w-4 h-4 text-orange-500" />
          <div className="font-semibold text-white">Image → Video</div>
        </div>
        <div className="text-xs text-gray-400 mt-1">
          {data.duration ? `${data.duration}s from image` : 'Uses starting frame'}
        </div>
      </div>
    </NodeWrapper>
  );
};

const ImageGenNode = ({ data }) => {
  return (
    <NodeWrapper color="#eab308" hasInput={true} nodeType="imagegen">
      <div className="px-4 py-3 rounded-lg border-2 border-yellow-500 bg-yellow-500/10 backdrop-blur-sm min-w-[200px]">
        <div className="flex items-center gap-2">
          <Image className="w-4 h-4 text-yellow-500" />
          <div className="font-semibold text-white">Image Generation</div>
        </div>
        <div className="text-xs text-gray-400 mt-1">
          {data.prompt ? data.prompt.substring(0, 30) + '...' : 'Click to configure'}
        </div>
      </div>
    </NodeWrapper>
  );
};

const ScreenshotNode = ({ data }) => {
  return (
    <NodeWrapper color="#a855f7" hasInput={true} nodeType="screenshot">
      <div className="px-4 py-3 rounded-lg border-2 border-purple-500 bg-purple-500/10 backdrop-blur-sm min-w-[200px]">
        <div className="flex items-center gap-2">
          <Camera className="w-4 h-4 text-purple-500" />
          <div className="font-semibold text-white">Screenshot</div>
        </div>
        <div className="text-xs text-gray-400 mt-1">
          Extract last frame from video
        </div>
      </div>
    </NodeWrapper>
  );
};

const StitchNode = ({ data }) => {
  return (
    <NodeWrapper color="#ec4899" hasInput={true} nodeType="stitch">
      <div className="px-4 py-3 rounded-lg border-2 border-pink-500 bg-pink-500/10 backdrop-blur-sm min-w-[200px]">
        <div className="flex items-center gap-2">
          <Copy className="w-4 h-4 text-pink-500" />
          <div className="font-semibold text-white">Stitch Videos</div>
        </div>
        <div className="text-xs text-gray-400 mt-1">
          Combine multiple videos
        </div>
      </div>
    </NodeWrapper>
  );
};

const TextToSpeechNode = ({ data }) => {
  return (
    <NodeWrapper color="#06b6d4" hasInput={true} nodeType="texttospeech">
      <div className="px-4 py-3 rounded-lg border-2 border-cyan-500 bg-cyan-500/10 backdrop-blur-sm min-w-[200px]">
        <div className="flex items-center gap-2">
          <Mic className="w-4 h-4 text-cyan-500" />
          <div className="font-semibold text-white">Text-to-Speech</div>
        </div>
        <div className="text-xs text-gray-400 mt-1">
          {data.voice || 'ElevenLabs Voice'}
        </div>
      </div>
    </NodeWrapper>
  );
};

const AudioOverlayNode = ({ data }) => {
  return (
    <NodeWrapper color="#8b5cf6" hasInput={true} nodeType="audiooverlay">
      <div className="px-4 py-3 rounded-lg border-2 border-violet-500 bg-violet-500/10 backdrop-blur-sm min-w-[200px]">
        <div className="flex items-center gap-2">
          <Mic className="w-4 h-4 text-violet-500" />
          <div className="font-semibold text-white">Audio Overlay</div>
        </div>
        <div className="text-xs text-gray-400 mt-1">
          Add voiceover to video
        </div>
      </div>
    </NodeWrapper>
  );
};

const TextToMusicNode = ({ data }) => {
  return (
    <NodeWrapper color="#a855f7" hasInput={true} nodeType="texttomusic">
      <div className="px-4 py-3 rounded-lg border-2 border-purple-500 bg-purple-500/10 backdrop-blur-sm min-w-[200px]">
        <div className="flex items-center gap-2">
          <Mic className="w-4 h-4 text-purple-500" />
          <div className="font-semibold text-white">Text-to-Music</div>
        </div>
        <div className="text-xs text-gray-400 mt-1">
          {data.prompt ? `${data.prompt.substring(0, 30)}...` : 'Generate music from text'}
        </div>
      </div>
    </NodeWrapper>
  );
};


const AudioStitchNode = ({ data }) => {
  return (
    <NodeWrapper color="#f59e0b" hasInput={true} nodeType="audiostitch">
      <div className="px-4 py-3 rounded-lg border-2 border-amber-500 bg-amber-500/10 backdrop-blur-sm min-w-[200px]">
        <div className="flex items-center gap-2">
          <Volume2 className="w-4 h-4 text-amber-500" />
          <div className="font-semibold text-white">Audio Stitch</div>
        </div>
        <div className="text-xs text-gray-400 mt-1">
          Mix audio with video
        </div>
      </div>
    </NodeWrapper>
  );
};

const TaskPlannerNode = ({ data }) => {
  return (
    <NodeWrapper color="#10b981" hasInput={true} nodeType="taskplanner">
      <div className="px-4 py-3 rounded-lg border-2 border-emerald-500 bg-emerald-500/10 backdrop-blur-sm min-w-[200px]">
        <div className="flex items-center gap-2">
          <CheckSquare className="w-4 h-4 text-emerald-500" />
          <div className="font-semibold text-white">Task Planner</div>
        </div>
        <div className="text-xs text-gray-400 mt-1">
          Action: {data.action || 'Click to configure'}
        </div>
      </div>
    </NodeWrapper>
  );
};

const ConditionNode = ({ data }) => {
  return (
    <NodeWrapper color="#f59e0b" hasInput={true} nodeType="condition">
      <div className="px-4 py-3 rounded-lg border-2 border-amber-500 bg-amber-500/10 backdrop-blur-sm min-w-[200px]">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 text-amber-500 font-bold">?</div>
          <div className="font-semibold text-white">IF Condition</div>
        </div>
        <div className="text-xs text-gray-400 mt-1">
          {data.condition || 'Click to configure'}
        </div>
      </div>
    </NodeWrapper>
  );
};

const SwitchNode = ({ data }) => {
  return (
    <NodeWrapper color="#d946ef" hasInput={true} nodeType="switch">
      <div className="px-4 py-3 rounded-lg border-2 border-fuchsia-500 bg-fuchsia-500/10 backdrop-blur-sm min-w-[200px]">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 text-fuchsia-500 font-bold">≡</div>
          <div className="font-semibold text-white">Switch</div>
        </div>
        <div className="text-xs text-gray-400 mt-1">
          Cases: {data.cases?.length || 0}
        </div>
      </div>
    </NodeWrapper>
  );
};

const LoopNode = ({ data }) => {
  return (
    <NodeWrapper color="#8b5cf6" hasInput={true} nodeType="loop">
      <div className="px-4 py-3 rounded-lg border-2 border-violet-500 bg-violet-500/10 backdrop-blur-sm min-w-[200px]">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 text-violet-500 font-bold">↻</div>
          <div className="font-semibold text-white">Loop</div>
        </div>
        <div className="text-xs text-gray-400 mt-1">
          {data.loopType || 'Click to configure'}
        </div>
      </div>
    </NodeWrapper>
  );
};

const DelayNode = ({ data }) => {
  return (
    <NodeWrapper color="#64748b" hasInput={true} nodeType="delay">
      <div className="px-4 py-3 rounded-lg border-2 border-slate-500 bg-slate-500/10 backdrop-blur-sm min-w-[200px]">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 text-slate-500">⏱</div>
          <div className="font-semibold text-white">Delay</div>
        </div>
        <div className="text-xs text-gray-400 mt-1">
          Wait: {data.duration || '1'} {data.unit || 'seconds'}
        </div>
      </div>
    </NodeWrapper>
  );
};

const EndNode = ({ data }) => {
  return (
    <NodeWrapper color="#ef4444" hasInput={true} hasOutput={false} nodeType="end">
      <div className="px-4 py-3 rounded-lg border-2 border-red-500 bg-red-500/10 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-red-500" />
          <div className="font-semibold text-white">End</div>
        </div>
        <div className="text-xs text-gray-400 mt-1">Workflow completes</div>
      </div>
    </NodeWrapper>
  );
};

const nodeTypes = {
  start: StartNode,
  gemini: GeminiNode,
  http: HttpNode,
  database: DatabaseNode,
  elevenlabs: ElevenLabsNode,
  elevenlabsconversational: ElevenLabsConversationalNode,
  manychat: ManyChatNode,
  videogen: VideoGenNode,
  imagetovideo: ImageToVideoNode,
  imagegen: ImageGenNode,
  screenshot: ScreenshotNode,
  stitch: StitchNode,
  texttospeech: TextToSpeechNode,
  audiooverlay: AudioOverlayNode,
  texttomusic: TextToMusicNode,
  audiostitch: AudioStitchNode,
  taskplanner: TaskPlannerNode,
  condition: ConditionNode,
  switch: SwitchNode,
  loop: LoopNode,
  delay: DelayNode,
  end: EndNode,
};

const initialNodes = [
  {
    id: 'start-1',
    type: 'start',
    position: { x: 250, y: 50 },
    data: { label: 'Start' },
  },
];

const initialEdges = [];

export default function AutomationStudioPage() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [workflows, setWorkflows] = useState([]);
  const [currentWorkflow, setCurrentWorkflow] = useState(null);
  const [executing, setExecuting] = useState(false);
  const [selectedNode, setSelectedNode] = useState(null);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [nodeConfig, setNodeConfig] = useState({});
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewAudio, setPreviewAudio] = useState(null);
  const [availableVoices, setAvailableVoices] = useState([]);
  const [voicesLoading, setVoicesLoading] = useState(false);
  const [voiceSearchQuery, setVoiceSearchQuery] = useState('');

  const [showTriggerModal, setShowTriggerModal] = useState(false);
  const [triggerConfig, setTriggerConfig] = useState({});
  const [showTemplatesModal, setShowTemplatesModal] = useState(false);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [showNewWorkflowModal, setShowNewWorkflowModal] = useState(false);
  const [newWorkflowName, setNewWorkflowName] = useState('');
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [renameWorkflowId, setRenameWorkflowId] = useState(null);
  const [renameWorkflowName, setRenameWorkflowName] = useState('');

  const loadTemplate = (templateName) => {
    const templates = {
      'video-ad-creator': {
        name: 'Video Ad Creator',
        nodes: [
          {id: 'start-1', type: 'start', position: {x: 100, y: 100}, data: {}},
          {id: 'ai-1', type: 'gemini', position: {x: 300, y: 100}, data: {prompt: 'Create a detailed video scene description for the FIRST 4 seconds of a product advertisement.\n\n1. PRODUCT & SCENE: Be extremely specific - exact product, exact setting, exact lighting, exact camera movement.\n\n2. BACKGROUND AUDIO: Describe background music/ambient sounds (e.g. "Soft uplifting piano music")\n\n3. FORMAT:\n   SCENE: [Visual description]\n   BACKGROUND AUDIO: [Music/sounds description]', model: 'gemini-2.5-pro'}},
          {id: 'video-1', type: 'videogen', position: {x: 550, y: 100}, data: {duration: 4, size: '1280x720'}},
          {id: 'screenshot-1', type: 'screenshot', position: {x: 800, y: 100}, data: {}},
          {id: 'ai-2', type: 'gemini', position: {x: 1050, y: 100}, data: {prompt: 'Continue the advertisement. Create the SECOND 4 seconds.\n\n1. VISUAL CONTINUATION: Describe the next 4 seconds\n\n2. BACKGROUND AUDIO: Continue the SAME music from Part 1\n\n3. FORMAT:\n   SCENE: [Visual continuation]\n   BACKGROUND AUDIO: [Same music]', model: 'gemini-2.5-pro'}},
          {id: 'video-2', type: 'imagetovideo', position: {x: 1300, y: 100}, data: {duration: 4, size: '1280x720'}},
          {id: 'stitch-1', type: 'stitch', position: {x: 1550, y: 100}, data: {}},
          {id: 'end-1', type: 'end', position: {x: 1800, y: 100}, data: {}}
        ],
        edges: [
          {id: 'e1', source: 'start-1', target: 'ai-1'},
          {id: 'e2', source: 'ai-1', target: 'video-1'},
          {id: 'e3', source: 'video-1', target: 'screenshot-1'},
          {id: 'e4', source: 'screenshot-1', target: 'ai-2'},
          {id: 'e5', source: 'ai-2', target: 'video-2'},
          {id: 'e6', source: 'video-2', target: 'stitch-1'},
          {id: 'e7', source: 'stitch-1', target: 'end-1'}
        ]
      }
    };

    const template = templates[templateName];
    if (template) {
      setNodes(template.nodes);
      setEdges(template.edges);
      setCurrentWorkflow(null); // Set to null so it creates a new workflow on execute
      setShowTemplatesModal(false);
      toast.success(`Loaded template: ${template.name}. Click Execute to run it!`);
    }
  };
  const [selectedNodeForDeletion, setSelectedNodeForDeletion] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);

  const onConnect = useCallback(
    (params) =>
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            type: 'smoothstep',
            animated: true,
            markerEnd: { type: MarkerType.ArrowClosed },
          },
          eds
        )
      ),
    [setEdges]
  );

  const addNode = (type) => {
    const newNode = {
      id: `${type}-${Date.now()}`,
      type,
      position: { x: Math.random() * 400 + 100, y: Math.random() * 300 + 100 },
      data: { label: type },
    };
    setNodes((nds) => [...nds, newNode]);
  };

  const saveWorkflow = async () => {
    try {
      const workflow = {
        name: currentWorkflow?.name || `Workflow ${Date.now()}`,
        nodes,
        edges,
      };

      if (currentWorkflow?.id) {
        await axios.put(`/workflows/${currentWorkflow.id}`, workflow);
        toast.success('Workflow updated successfully');
      } else {
        const response = await axios.post('/workflows', workflow);
        setCurrentWorkflow(response.data);
        toast.success('Workflow saved successfully');
      }
      loadWorkflows();
    } catch (error) {
      toast.error('Failed to save workflow');
      console.error(error);
    }
  };

  const loadWorkflows = async () => {
    try {
      const response = await axios.get('/workflows');
      setWorkflows(response.data);
    } catch (error) {
      console.error('Failed to load workflows:', error);
    }
  };

  const loadWorkflow = (workflow) => {
    setCurrentWorkflow(workflow);
    setNodes(workflow.nodes || initialNodes);
    setEdges(workflow.edges || initialEdges);
  };

  const [executionId, setExecutionId] = useState(null);
  const [executionProgress, setExecutionProgress] = useState(0);

  const executeWorkflow = async () => {
    // Auto-save before executing
    let workflowToExecute = currentWorkflow;
    
    if (!workflowToExecute) {
      // Create new workflow if none exists
      const workflowName = `Workflow ${Date.now()}`;
      toast.info('Saving workflow before execution...');
      
      try {
        const saveResponse = await axios.post('/workflows', {
          name: workflowName,
          nodes,
          edges,
        });
        workflowToExecute = saveResponse.data;
        setCurrentWorkflow(workflowToExecute);
        await loadWorkflows();
      } catch (error) {
        toast.error('Failed to save workflow');
        return;
      }
    } else {
      // Update existing workflow
      try {
        await axios.put(`/workflows/${workflowToExecute.id}`, {
          name: workflowToExecute.name,
          nodes,
          edges,
        });
      } catch (error) {
        toast.error('Failed to update workflow');
        return;
      }
    }

    setExecuting(true);
    setExecutionProgress(0);
    
    try {
      const response = await axios.post(`/workflows/${workflowToExecute.id}/execute`);
      setExecutionId(response.data.execution_id);
      
      // Poll for progress
      const pollInterval = setInterval(async () => {
        try {
          const statusResponse = await axios.get(`/workflows/executions/${response.data.execution_id}`);
          const execution = statusResponse.data;
          
          setExecutionProgress(execution.progress || 0);
          
          if (execution.status === 'completed' || execution.status === 'failed') {
            clearInterval(pollInterval);
            setExecuting(false);
            
            if (execution.status === 'completed') {
              toast.success('Workflow executed successfully!');
            } else {
              toast.error('Workflow execution failed');
            }
          }
        } catch (err) {
          clearInterval(pollInterval);
          setExecuting(false);
        }
      }, 1000);
      
      // Timeout after 5 minutes
      setTimeout(() => {
        clearInterval(pollInterval);
        setExecuting(false);
      }, 300000);
      
    } catch (error) {
      toast.error('Workflow execution failed');
      console.error(error);
      setExecuting(false);
    }
  };

  const deleteWorkflow = async (workflowId) => {
    try {
      await axios.delete(`/workflows/${workflowId}`);
      toast.success('Workflow deleted');
      loadWorkflows();
      if (currentWorkflow?.id === workflowId) {
        setCurrentWorkflow(null);
        setNodes(initialNodes);
        setEdges(initialEdges);
      }
      setOpenMenuId(null);
    } catch (error) {
      toast.error('Failed to delete workflow');
    }
  };

  const renameWorkflow = async () => {
    if (!renameWorkflowName.trim()) {
      toast.error('Workflow name cannot be empty');
      return;
    }
    
    try {
      await axios.put(`/workflows/${renameWorkflowId}`, {
        ...workflows.find(w => w.id === renameWorkflowId),
        name: renameWorkflowName
      });
      toast.success('Workflow renamed');
      loadWorkflows();
      if (currentWorkflow?.id === renameWorkflowId) {
        setCurrentWorkflow({...currentWorkflow, name: renameWorkflowName});
      }
      setShowRenameModal(false);
      setRenameWorkflowId(null);
      setRenameWorkflowName('');
      setOpenMenuId(null);
    } catch (error) {
      toast.error('Failed to rename workflow');
    }
  };

  const createNewWorkflow = () => {
    if (!newWorkflowName.trim()) {
      toast.error('Workflow name cannot be empty');
      return;
    }
    
    setCurrentWorkflow({ name: newWorkflowName });
    setNodes(initialNodes);
    setEdges(initialEdges);
    setShowNewWorkflowModal(false);
    setNewWorkflowName('');
    toast.success(`Created workflow: ${newWorkflowName}`);
  };



  const fetchVoices = async () => {
    try {
      setVoicesLoading(true);
      const token = localStorage.getItem('apoe_token');
      
      const response = await axios.get(
        `${BACKEND_URL}/api/tts/voices`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      const voices = response.data.voices || [];
      setAvailableVoices(voices);
      console.log('Fetched voices:', voices.length);
      console.log('Sample voices:', voices.slice(0, 3).map(v => ({ name: v.name, id: v.voice_id })));
      
      if (voices.length > 0) {
        toast.success(`Loaded ${voices.length} voices from ElevenLabs`);
      }
    } catch (error) {
      console.error('Failed to fetch voices:', error);
      toast.error('Failed to load voices. Using defaults.');
      // Set default voices if API fails
      setAvailableVoices([
        { voice_id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel', labels: { gender: 'female', age: 'young' } },
        { voice_id: 'EXAVITQu4vr4xnSDxMaL', name: 'Bella', labels: { gender: 'female', age: 'young' } },
        { voice_id: 'ErXwobaYiN019PkySvjV', name: 'Antoni', labels: { gender: 'male', age: 'young' } },
      ]);
    } finally {
      setVoicesLoading(false);
    }
  };

  const previewVoice = async () => {
    try {
      setPreviewLoading(true);
      
      const token = localStorage.getItem('apoe_token');
      const previewText = nodeConfig.text || "Hello! This is a preview of the selected voice. You can customize the voice settings to achieve your desired sound.";
      
      // Use voice_id if available, otherwise fall back to voice name
      const voiceToUse = nodeConfig.voice_id || nodeConfig.voice || '21m00Tcm4TlvDq8ikWAM';
      
      console.log('Preview config:', { voiceToUse, nodeConfig });
      
      const response = await axios.post(
        `${BACKEND_URL}/api/tts/preview`,
        {
          text: previewText,
          voice: voiceToUse,
          model_id: nodeConfig.model_id || 'eleven_turbo_v2_5',
          stability: nodeConfig.stability || 0.5,
          similarity_boost: nodeConfig.similarity_boost || 0.75,
          style: nodeConfig.style || 0,
          speaker_boost: nodeConfig.speaker_boost || false,
          speed: nodeConfig.speed || 1.0
        },
        { 
          headers: { Authorization: `Bearer ${token}` },
          responseType: 'blob'
        }
      );

      // Create audio URL from blob
      const audioUrl = URL.createObjectURL(response.data);
      
      // Stop previous audio if playing
      if (previewAudio) {
        previewAudio.pause();
        URL.revokeObjectURL(previewAudio.src);
      }
      
      // Create and play new audio
      const audio = new Audio(audioUrl);
      audio.onended = () => {
        setPreviewLoading(false);
      };
      audio.onerror = () => {
        setPreviewLoading(false);
        alert('Failed to play audio preview');
      };
      
      setPreviewAudio(audio);
      await audio.play();
      
    } catch (error) {
      console.error('Preview failed:', error);
      setPreviewLoading(false);
      
      // Handle error response from blob
      let errorMessage = 'Failed to generate preview. Check your ElevenLabs integration.';
      if (error.response && error.response.data instanceof Blob) {
        try {
          const errorText = await error.response.data.text();
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.detail || errorMessage;
        } catch (e) {
          console.error('Failed to parse error response:', e);
        }
      } else if (error.response?.data?.detail) {
        errorMessage = error.response.data.detail;
      }
      
      alert(errorMessage);
    }
  };

  const onNodeClick = useCallback((event, node) => {
    setSelectedNodeForDeletion(node);
    setContextMenu(null); // Close context menu on click
    if (node.type !== 'start' && node.type !== 'end') {
      setSelectedNode(node);
      const config = node.data || {};
      
      // If it's an ElevenLabs Conversational AI node, fetch available agents
      if (node.type === 'elevenlabsconversational') {
        console.log('[ElevenLabs Node] Fetching agents...');
        const token = localStorage.getItem('apoe_token');
        console.log('[ElevenLabs Node] Token exists:', !!token);
        axios.get(`${BACKEND_URL}/api/conversational-ai/agents`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })
          .then(response => {
            console.log('[ElevenLabs Node] Raw response:', response);
            console.log('[ElevenLabs Node] Response data:', response.data);
            
            const agents = Array.isArray(response.data) ? response.data : [];
            console.log('[ElevenLabs Node] Parsed agents:', agents);
            
            const mappedAgents = agents.map(a => ({ 
              id: a.id, 
              name: a.name,
              elevenlabs_agent_id: a.elevenlabs_agent_id 
            }));
            
            console.log('[ElevenLabs Node] Mapped agents:', mappedAgents);
            
            setNodeConfig({ 
              ...config, 
              availableAgents: mappedAgents
            });
            
            toast.success(`Loaded ${mappedAgents.length} agent(s)`);
          })
          .catch(error => {
            console.error('[ElevenLabs Node] Error fetching agents:', error);
            console.error('[ElevenLabs Node] Error response:', error.response);
            toast.error(`Failed to load agents: ${error.response?.data?.detail || error.message}`);
            setNodeConfig({ ...config, availableAgents: [] });
          });
      } else {
        setNodeConfig(config);
      }
      
      setShowConfigModal(true);
    }
  }, []);

  const onNodeContextMenu = useCallback((event, node) => {
    event.preventDefault();
    setContextMenu({
      node,
      x: event.clientX,
      y: event.clientY,
    });
  }, []);

  const deleteNode = useCallback((nodeId) => {
    setNodes((nds) => nds.filter((node) => node.id !== nodeId));
    setEdges((eds) => eds.filter((edge) => edge.source !== nodeId && edge.target !== nodeId));
    setSelectedNodeForDeletion(null);
    toast.success('Node deleted');
  }, [setNodes, setEdges]);

  const deleteSelectedNode = useCallback(() => {
    if (selectedNodeForDeletion && selectedNodeForDeletion.type !== 'start') {
      deleteNode(selectedNodeForDeletion.id);
    }
  }, [selectedNodeForDeletion, deleteNode]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event) => {
      if ((event.key === 'Delete' || event.key === 'Backspace') && selectedNodeForDeletion) {
        if (selectedNodeForDeletion.type !== 'start') {
          event.preventDefault();
          deleteSelectedNode();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNodeForDeletion, deleteSelectedNode]);

  const saveNodeConfig = () => {
    if (!selectedNode) return;
    
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === selectedNode.id) {
          return { ...node, data: nodeConfig };
        }
        return node;
      })
    );
    
    setShowConfigModal(false);
    toast.success('Node configuration saved');
  };

  useEffect(() => {
    loadWorkflows();
    fetchVoices();
  }, []);

  // Close dropdown menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (openMenuId && !e.target.closest('.relative')) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [openMenuId]);

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-[#0f1218] to-[#1a1d2e] text-white">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
            <Workflow className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Automation Studio</h1>
            <p className="text-sm text-gray-400">Build AI-powered workflows visually</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={() => setShowTemplatesModal(true)}
            variant="outline"
            className="border-gray-700"
            size="sm"
          >
            <Copy className="w-4 h-4 mr-2" />
            Templates
          </Button>
          <Button
            onClick={() => window.location.href = '/automation/integrations'}
            variant="outline"
            className="border-gray-700"
            size="sm"
          >
            <Settings className="w-4 h-4 mr-2" />
            Integrations
          </Button>
          <Button
            onClick={() => setShowTriggerModal(true)}
            variant="outline"
            className="border-gray-700"
            size="sm"
            disabled={!currentWorkflow}
            title={!currentWorkflow ? 'Save workflow first to add triggers' : 'Configure triggers'}
          >
            <Calendar className="w-4 h-4 mr-2" />
            Triggers
          </Button>
          <Button
            onClick={saveWorkflow}
            className="bg-green-600 hover:bg-green-700"
            size="sm"
          >
            <Save className="w-4 h-4 mr-2" />
            Save
          </Button>
          <Button
            onClick={executeWorkflow}
            disabled={executing || nodes.length < 2}
            className="bg-gradient-to-r from-purple-500 to-pink-500 hover:opacity-90"
            size="sm"
            title={nodes.length < 2 ? 'Add nodes to execute' : 'Execute workflow'}
          >
            <Play className="w-4 h-4 mr-2" />
            {executing ? 'Executing...' : 'Execute'}
          </Button>
        </div>
      </div>

      {/* Execution Progress Bar */}
      {executing && (
        <div className="absolute top-[73px] left-0 right-0 bg-[#1a1d2e] border-b border-gray-700 px-4 py-3 z-10">
          <div className="flex items-center justify-between max-w-7xl mx-auto">
            <div className="flex items-center gap-3">
              <Clock className="w-4 h-4 text-blue-400 animate-spin" />
              <span className="text-sm text-white">Executing workflow...</span>
              <span className="text-xs text-gray-400">{executionProgress}% complete</span>
            </div>
          </div>
          <div className="max-w-7xl mx-auto mt-2">
            <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-500"
                style={{ width: `${executionProgress}%` }}
              />
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - Workflows List */}
        <div className="w-64 border-r border-gray-800 p-4 overflow-y-auto">
          <h3 className="text-lg font-semibold mb-4">Your Workflows</h3>
          <Button
            onClick={() => setShowNewWorkflowModal(true)}
            className="w-full mb-4 bg-gradient-to-r from-purple-500 to-pink-500"
            size="sm"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Workflow
          </Button>

          <div className="space-y-2">
            {workflows.map((workflow) => (
              <div
                key={workflow.id}
                className={`p-3 rounded-lg border cursor-pointer transition-colors relative ${
                  currentWorkflow?.id === workflow.id
                    ? 'border-purple-500 bg-purple-500/10'
                    : 'border-gray-700 hover:border-gray-600'
                }`}
                onClick={() => loadWorkflow(workflow)}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium flex-1 truncate">{workflow.name}</span>
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenMenuId(openMenuId === workflow.id ? null : workflow.id);
                      }}
                      className="text-gray-400 hover:text-white p-1"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>
                    
                    {/* Dropdown Menu */}
                    {openMenuId === workflow.id && (
                      <div className="absolute right-0 top-full mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-50 min-w-[150px]">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setRenameWorkflowId(workflow.id);
                            setRenameWorkflowName(workflow.name);
                            setShowRenameModal(true);
                            setOpenMenuId(null);
                          }}
                          className="w-full text-left px-4 py-2 text-sm hover:bg-gray-700 flex items-center gap-2 transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          Rename
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm(`Delete workflow "${workflow.name}"?`)) {
                              deleteWorkflow(workflow.id);
                            }
                          }}
                          className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-gray-700 flex items-center gap-2 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  {workflow.nodes?.length || 0} nodes
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Node Palette */}
        <div className="w-48 border-r border-gray-800 p-4 overflow-y-auto">
          <h3 className="text-sm font-semibold mb-3 text-gray-400">AI NODES</h3>
          <div className="space-y-2 mb-4">
            <button
              onClick={() => addNode('gemini')}
              className="w-full p-2 rounded bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/50 text-xs flex items-center gap-2"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              AI Chat
            </button>
            <button
              onClick={() => addNode('imagegen')}
              className="w-full p-2 rounded bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/50 text-xs flex items-center gap-2"
            >
              <Image className="w-3.5 h-3.5" />
              Image Gen
            </button>
            <button
              onClick={() => addNode('videogen')}
              className="w-full p-2 rounded bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/50 text-xs flex items-center gap-2"
            >
              <Video className="w-3.5 h-3.5" />
              Video Gen
            </button>
            <button
              onClick={() => addNode('imagetovideo')}
              className="w-full p-2 rounded bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/50 text-xs flex items-center gap-2"
            >
              <Video className="w-3.5 h-3.5" />
              Image → Video
            </button>
            <button
              onClick={() => addNode('screenshot')}
              className="w-full p-2 rounded bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/50 text-xs flex items-center gap-2"
            >
              <Camera className="w-3.5 h-3.5" />
              Screenshot
            </button>
            <button
              onClick={() => addNode('stitch')}
              className="w-full p-2 rounded bg-pink-500/20 hover:bg-pink-500/30 border border-pink-500/50 text-xs flex items-center gap-2"
            >
              <Copy className="w-3.5 h-3.5" />
              Stitch
            </button>
            <button
              onClick={() => addNode('texttospeech')}
              className="w-full p-2 rounded bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/50 text-xs flex items-center gap-2"
            >
              <Mic className="w-3.5 h-3.5" />
              Text-to-Speech
            </button>
            <button
              onClick={() => addNode('audiooverlay')}
              className="w-full p-2 rounded bg-violet-500/20 hover:bg-violet-500/30 border border-violet-500/50 text-xs flex items-center gap-2"
            >
              <Mic className="w-3.5 h-3.5" />
              Audio Overlay
            </button>
            <button
              onClick={() => addNode('texttomusic')}
              className="w-full p-2 rounded bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/50 text-xs flex items-center gap-2"
            >
              <Mic className="w-3.5 h-3.5" />
              Text-to-Music
            </button>
            <button
              onClick={() => addNode('audiostitch')}
              className="w-full p-2 rounded bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 text-xs flex items-center gap-2"
            >
              <Volume2 className="w-3.5 h-3.5" />
              Audio Stitch
            </button>
          </div>
          
          <h3 className="text-sm font-semibold mb-3 text-gray-400">INTEGRATIONS</h3>
          <div className="space-y-2 mb-4">
            <button
              onClick={() => addNode('http')}
              className="w-full p-2 rounded bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/50 text-xs flex items-center gap-2"
            >
              <Globe className="w-3.5 h-3.5" />
              HTTP Request
            </button>
            <button
              onClick={() => addNode('elevenlabsconversational')}
              className="w-full p-2 rounded bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 text-xs flex items-center gap-2"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              ElevenLabs AI
            </button>
            <button
              onClick={() => addNode('manychat')}
              className="w-full p-2 rounded bg-pink-500/20 hover:bg-pink-500/30 border border-pink-500/50 text-xs flex items-center gap-2"
            >
              <Send className="w-3.5 h-3.5" />
              ManyChat
            </button>
          </div>
          
          <h3 className="text-sm font-semibold mb-3 text-gray-400">INTERNAL</h3>
          <div className="space-y-2 mb-4">
            <button
              onClick={() => addNode('database')}
              className="w-full p-2 rounded bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/50 text-xs flex items-center gap-2"
            >
              <Database className="w-3.5 h-3.5" />
              Database
            </button>
            <button
              onClick={() => addNode('taskplanner')}
              className="w-full p-2 rounded bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/50 text-xs flex items-center gap-2"
            >
              <CheckSquare className="w-3.5 h-3.5" />
              Task Planner
            </button>
          </div>
          
          <h3 className="text-sm font-semibold mb-3 text-gray-400">LOGIC</h3>
          <div className="space-y-2 mb-4">
            <button
              onClick={() => addNode('condition')}
              className="w-full p-2 rounded bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 text-xs flex items-center gap-2"
            >
              <span className="font-bold">?</span>
              IF Condition
            </button>
            <button
              onClick={() => addNode('switch')}
              className="w-full p-2 rounded bg-fuchsia-500/20 hover:bg-fuchsia-500/30 border border-fuchsia-500/50 text-xs flex items-center gap-2"
            >
              <span className="font-bold">≡</span>
              Switch
            </button>
            <button
              onClick={() => addNode('loop')}
              className="w-full p-2 rounded bg-violet-500/20 hover:bg-violet-500/30 border border-violet-500/50 text-xs flex items-center gap-2"
            >
              <span className="font-bold">↻</span>
              Loop
            </button>
            <button
              onClick={() => addNode('delay')}
              className="w-full p-2 rounded bg-slate-500/20 hover:bg-slate-500/30 border border-slate-500/50 text-xs flex items-center gap-2"
            >
              <Clock className="w-3.5 h-3.5" />
              Delay
            </button>
          </div>
          
          <h3 className="text-sm font-semibold mb-3 text-gray-400">CONTROL</h3>
          <div className="space-y-2">
            <button
              onClick={() => addNode('end')}
              className="w-full p-2 rounded bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 text-xs flex items-center gap-2"
            >
              <Zap className="w-3.5 h-3.5" />
              End
            </button>
          </div>
        </div>

        {/* Canvas */}
        <div className="flex-1 relative" style={{ height: 'calc(100vh - 73px)' }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onNodeContextMenu={onNodeContextMenu}
            onPaneClick={() => {
              setSelectedNodeForDeletion(null);
              setContextMenu(null);
            }}
            nodeTypes={nodeTypes}
            fitView
            deleteKeyCode={null}
            className="bg-gradient-to-br from-[#0f1218] to-[#1a1d2e]"
          >
            <Controls />
            <MiniMap
              nodeColor={(node) => {
                switch (node.type) {
                  case 'start':
                    return '#22c55e';
                  case 'gemini':
                    return '#a855f7';
                  case 'http':
                    return '#3b82f6';
                  case 'database':
                    return '#06b6d4';
                  case 'end':
                    return '#ef4444';
                  default:
                    return '#6b7280';
                }
              }}
              className="bg-[#1a1d2e] border border-gray-700"
            />
            <Background variant="dots" gap={12} size={1} color="#374151" />
          </ReactFlow>

          {/* Right-Click Context Menu */}
          {contextMenu && contextMenu.node.type !== 'start' && (
            <>
              <div 
                className="fixed inset-0 z-40"
                onClick={() => setContextMenu(null)}
              />
              <div
                className="absolute bg-[#1a1d2e] border border-gray-700 rounded-lg shadow-2xl z-50 min-w-[180px]"
                style={{
                  left: `${contextMenu.x}px`,
                  top: `${contextMenu.y}px`,
                }}
              >
                <div className="px-3 py-2 border-b border-gray-700">
                  <p className="text-xs text-gray-400">
                    {contextMenu.node.type} node
                  </p>
                </div>
                {contextMenu.node.type !== 'end' && (
                  <button
                    onClick={() => {
                      setSelectedNode(contextMenu.node);
                      setNodeConfig(contextMenu.node.data || {});
                      setShowConfigModal(true);
                      setContextMenu(null);
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-white hover:bg-white/10 flex items-center gap-2 transition-colors"
                  >
                    <Settings className="w-4 h-4" />
                    Configure
                  </button>
                )}
                <button
                  onClick={() => {
                    deleteNode(contextMenu.node.id);
                    setContextMenu(null);
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-red-500/10 flex items-center gap-2 transition-colors rounded-b-lg"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete Node
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Node Configuration Modal */}
      {showConfigModal && selectedNode && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-[#1a1d2e] border border-gray-700 rounded-xl p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Configure {selectedNode.type} Node
              </h2>
              <button
                onClick={() => setShowConfigModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Gemini Node Config */}
              {selectedNode.type === 'gemini' && (
                <>
                  <div>
                    <Label className="text-white">AI Prompt</Label>
                    <Textarea
                      value={nodeConfig.prompt || ''}
                      onChange={(e) => setNodeConfig({ ...nodeConfig, prompt: e.target.value })}
                      placeholder="Enter your prompt for the AI..."
                      className="bg-[#0f1218] border-gray-700 text-white mt-2"
                      rows={4}
                    />
                  </div>
                  <div>
                    <Label className="text-white">Model</Label>
                    <Select
                      value={nodeConfig.model || 'gemini-2.5-pro'}
                      onValueChange={(value) => setNodeConfig({ ...nodeConfig, model: value })}
                    >
                      <SelectTrigger className="bg-[#0f1218] border-gray-700 text-white mt-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#1a1d2e] border-gray-700">
                        <SelectItem value="gemini-2.5-pro">Gemini 2.5 Pro</SelectItem>
                        <SelectItem value="gpt-5">GPT-5</SelectItem>
                        <SelectItem value="claude-4-sonnet">Claude 4 Sonnet</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}

              {/* HTTP Node Config */}
              {selectedNode.type === 'http' && (
                <>
                  <div>
                    <Label className="text-white">URL</Label>
                    <Input
                      value={nodeConfig.url || ''}
                      onChange={(e) => setNodeConfig({ ...nodeConfig, url: e.target.value })}
                      placeholder="https://api.example.com/endpoint"
                      className="bg-[#0f1218] border-gray-700 text-white mt-2"
                    />
                  </div>
                  <div>
                    <Label className="text-white">Method</Label>
                    <Select
                      value={nodeConfig.method || 'GET'}
                      onValueChange={(value) => setNodeConfig({ ...nodeConfig, method: value })}
                    >
                      <SelectTrigger className="bg-[#0f1218] border-gray-700 text-white mt-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#1a1d2e] border-gray-700">
                        <SelectItem value="GET">GET</SelectItem>
                        <SelectItem value="POST">POST</SelectItem>
                        <SelectItem value="PUT">PUT</SelectItem>
                        <SelectItem value="DELETE">DELETE</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-white">Body (JSON)</Label>
                    <Textarea
                      value={nodeConfig.body || ''}
                      onChange={(e) => setNodeConfig({ ...nodeConfig, body: e.target.value })}
                      placeholder='{"key": "value"}'
                      className="bg-[#0f1218] border-gray-700 text-white mt-2"
                      rows={4}
                    />
                  </div>
                  <div>
                    <Label className="text-white">Headers (JSON)</Label>
                    <Textarea
                      value={nodeConfig.headers || ''}
                      onChange={(e) => setNodeConfig({ ...nodeConfig, headers: e.target.value })}
                      placeholder='{"Authorization": "Bearer token"}'
                      className="bg-[#0f1218] border-gray-700 text-white mt-2"
                      rows={3}
                    />
                  </div>
                </>
              )}


              {/* Text-to-Speech Node Config */}
              {selectedNode.type === 'texttospeech' && (
                <>
                  <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-4 mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Mic className="w-4 h-4 text-cyan-400" />
                      <span className="text-sm font-semibold text-cyan-400">ElevenLabs Voice Settings</span>
                    </div>
                    <p className="text-xs text-gray-400">
                      Configure voice characteristics for natural-sounding speech
                    </p>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label className="text-white">Voice Selection</Label>
                      <Button
                        onClick={fetchVoices}
                        disabled={voicesLoading}
                        size="sm"
                        className="h-7 text-xs bg-cyan-600 hover:bg-cyan-700"
                      >
                        {voicesLoading ? 'Loading...' : 'Load Voices'}
                      </Button>
                    </div>
                    
                    {availableVoices.length > 0 && (
                      <div className="mb-2">
                        <Input
                          value={voiceSearchQuery}
                          onChange={(e) => setVoiceSearchQuery(e.target.value)}
                          placeholder="Search voices..."
                          className="bg-[#0f1218] border-gray-700 text-white"
                        />
                      </div>
                    )}
                    
                    <Select
                      value={nodeConfig.voice_id || nodeConfig.voice || '21m00Tcm4TlvDq8ikWAM'}
                      onValueChange={(value) => {
                        const selectedVoice = availableVoices.find(v => v.voice_id === value);
                        setNodeConfig({ 
                          ...nodeConfig, 
                          voice_id: value,
                          voice: selectedVoice?.name || value
                        });
                      }}
                    >
                      <SelectTrigger className="bg-[#0f1218] border-gray-700 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#1a1d2e] border-gray-700 max-h-[400px] overflow-y-auto">
                        {availableVoices.length === 0 ? (
                          <>
                            <SelectItem value="21m00Tcm4TlvDq8ikWAM">Rachel (Female, Calm)</SelectItem>
                            <SelectItem value="EXAVITQu4vr4xnSDxMaL">Bella (Female, Soft)</SelectItem>
                            <SelectItem value="ErXwobaYiN019PkySvjV">Antoni (Male, Well-rounded)</SelectItem>
                            <SelectItem value="TxGEqnHWrfWFTfGW9XjX">Josh (Male, Deep)</SelectItem>
                            <SelectItem value="VR6AewLTigWG4xSOukaG">Arnold (Male, Crisp)</SelectItem>
                            <SelectItem value="pNInz6obpgDQGcFmaJgB">Adam (Male, Deep)</SelectItem>
                            <SelectItem value="yoZ06aMxZJJ28mfd3POQ">Sam (Male, Raspy)</SelectItem>
                            <SelectItem value="AZnzlk1XvdvUeBnXmlld">Domi (Female, Strong)</SelectItem>
                            <SelectItem value="MF3mGyEYCl7XYWbV9V6O">Elli (Female, Emotional)</SelectItem>
                          </>
                        ) : (
                          (() => {
                            const filteredVoices = availableVoices.filter(voice => 
                              !voiceSearchQuery || 
                              voice.name.toLowerCase().includes(voiceSearchQuery.toLowerCase()) ||
                              (voice.labels?.accent && voice.labels.accent.toLowerCase().includes(voiceSearchQuery.toLowerCase())) ||
                              (voice.labels?.description && voice.labels.description.toLowerCase().includes(voiceSearchQuery.toLowerCase())) ||
                              (voice.labels?.gender && voice.labels.gender.toLowerCase().includes(voiceSearchQuery.toLowerCase())) ||
                              (voice.labels?.use_case && voice.labels.use_case.toLowerCase().includes(voiceSearchQuery.toLowerCase())) ||
                              (voice.category && voice.category.toLowerCase().includes(voiceSearchQuery.toLowerCase()))
                            );
                            
                            return filteredVoices.map(voice => {
                              const labels = voice.labels || {};
                              const source = labels.source ? `[${labels.source}] ` : '';
                              const gender = labels.gender || '';
                              const age = labels.age ? `, ${labels.age}` : '';
                              const accent = labels.accent ? `, ${labels.accent}` : '';
                              const useCase = labels.use_case ? ` - ${labels.use_case}` : '';
                              const description = `${source}${voice.name} (${gender}${age}${accent})${useCase}`;
                              
                              return (
                                <SelectItem key={voice.voice_id} value={voice.voice_id}>
                                  {description}
                                </SelectItem>
                              );
                            });
                          })()
                        )}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-gray-500 mt-1">
                      {availableVoices.length > 0 
                        ? `${availableVoices.filter(v => 
                            !voiceSearchQuery || 
                            v.name.toLowerCase().includes(voiceSearchQuery.toLowerCase()) ||
                            (v.labels?.accent && v.labels.accent.toLowerCase().includes(voiceSearchQuery.toLowerCase())) ||
                            (v.labels?.gender && v.labels.gender.toLowerCase().includes(voiceSearchQuery.toLowerCase()))
                          ).length} of ${availableVoices.length} voices shown`
                        : 'Click "Load Voices" to see all available voices (including Voice Library)'
                      }
                    </p>
                  </div>

                  <div>
                    <Label className="text-white">Model</Label>
                    <Select
                      value={nodeConfig.model_id || 'eleven_turbo_v2_5'}
                      onValueChange={(value) => setNodeConfig({ ...nodeConfig, model_id: value })}
                    >
                      <SelectTrigger className="bg-[#0f1218] border-gray-700 text-white mt-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#1a1d2e] border-gray-700">
                        <SelectItem value="eleven_turbo_v2_5">Eleven Turbo v2.5 (Free tier, fast)</SelectItem>
                        <SelectItem value="eleven_turbo_v2">Eleven Turbo v2 (Fast)</SelectItem>
                        <SelectItem value="eleven_multilingual_v2">Eleven Multilingual v2 (Multiple languages)</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-gray-500 mt-1">Choose quality vs speed</p>
                  </div>

                  <div>
                    <Label className="text-white flex items-center justify-between">
                      <span>Stability</span>
                      <span className="text-xs text-gray-400">{nodeConfig.stability || 0.5}</span>
                    </Label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={nodeConfig.stability || 0.5}
                      onChange={(e) => setNodeConfig({ ...nodeConfig, stability: parseFloat(e.target.value) })}
                      className="w-full mt-2 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      0.5 = balanced. Higher = predictable/consistent, Lower = varied/expressive
                    </p>
                  </div>

                  <div>
                    <Label className="text-white flex items-center justify-between">
                      <span>Similarity Boost</span>
                      <span className="text-xs text-gray-400">{nodeConfig.similarity_boost || 0.75}</span>
                    </Label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={nodeConfig.similarity_boost || 0.75}
                      onChange={(e) => setNodeConfig({ ...nodeConfig, similarity_boost: parseFloat(e.target.value) })}
                      className="w-full mt-2 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      0.75 = recommended. Higher = more authentic to original voice
                    </p>
                  </div>

                  <div>
                    <Label className="text-white flex items-center justify-between">
                      <span>Speaking Speed</span>
                      <span className="text-xs text-gray-400">{nodeConfig.speed || 1.0}x</span>
                    </Label>
                    <input
                      type="range"
                      min="0.7"
                      max="1.2"
                      step="0.05"
                      value={nodeConfig.speed || 1.0}
                      onChange={(e) => setNodeConfig({ ...nodeConfig, speed: parseFloat(e.target.value) })}
                      className="w-full mt-2 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Control speech rate: 0.7x (slower) to 1.2x (faster)
                    </p>
                  </div>

                  <div>
                    <Label className="text-white flex items-center justify-between">
                      <span>Style Exaggeration</span>
                      <span className="text-xs text-gray-400">{nodeConfig.style || 0}</span>
                    </Label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={nodeConfig.style || 0}
                      onChange={(e) => setNodeConfig({ ...nodeConfig, style: parseFloat(e.target.value) })}
                      className="w-full mt-2 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Amplify the style (keep at 0 for best quality & speed)
                    </p>
                  </div>

                  <div className="flex items-center gap-2 bg-[#0f1218] border border-gray-700 rounded-lg p-3">
                    <input
                      type="checkbox"
                      checked={nodeConfig.speaker_boost || false}
                      onChange={(e) => setNodeConfig({ ...nodeConfig, speaker_boost: e.target.checked })}
                      className="w-4 h-4 accent-cyan-500"
                    />
                    <div>
                      <Label className="text-white text-sm">Speaker Boost</Label>
                      <p className="text-xs text-gray-500">Enhance clarity (adds slight processing)</p>
                    </div>
                  </div>

                  {/* Quick Presets */}
                  <div className="border-t border-gray-700 pt-4">
                    <Label className="text-white mb-2 block">Quick Presets (Recommended)</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        type="button"
                        onClick={() => setNodeConfig({
                          ...nodeConfig,
                          stability: 0.5,
                          similarity_boost: 0.75,
                          style: 0,
                          speaker_boost: false,
                          speed: 1.0
                        })}
                        size="sm"
                        className="bg-green-600 hover:bg-green-700 text-xs"
                      >
                        Natural & Smooth
                      </Button>
                      <Button
                        type="button"
                        onClick={() => setNodeConfig({
                          ...nodeConfig,
                          stability: 0.3,
                          similarity_boost: 0.8,
                          style: 0,
                          speaker_boost: false,
                          speed: 1.0
                        })}
                        size="sm"
                        className="bg-purple-600 hover:bg-purple-700 text-xs"
                      >
                        Expressive
                      </Button>
                      <Button
                        type="button"
                        onClick={() => setNodeConfig({
                          ...nodeConfig,
                          stability: 0.7,
                          similarity_boost: 0.75,
                          style: 0,
                          speaker_boost: true,
                          speed: 0.9
                        })}
                        size="sm"
                        className="bg-blue-600 hover:bg-blue-700 text-xs"
                      >
                        Clear & Professional
                      </Button>
                      <Button
                        type="button"
                        onClick={() => setNodeConfig({
                          ...nodeConfig,
                          stability: 0.4,
                          similarity_boost: 0.7,
                          style: 0,
                          speaker_boost: false,
                          speed: 1.1
                        })}
                        size="sm"
                        className="bg-orange-600 hover:bg-orange-700 text-xs"
                      >
                        Dynamic & Fast
                      </Button>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      ✨ "Natural & Smooth" recommended for most realistic speech
                    </p>
                  </div>

                  <div>
                    <Label className="text-white">Custom Text (Optional)</Label>
                    <Textarea
                      value={nodeConfig.text || ''}
                      onChange={(e) => setNodeConfig({ ...nodeConfig, text: e.target.value })}
                      placeholder="Leave empty to auto-collect from AI nodes..."
                      className="bg-[#0f1218] border-gray-700 text-white mt-2"
                      rows={3}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      If empty, will automatically collect voiceover text from previous AI responses
                    </p>
                  </div>

                  <Button
                    onClick={previewVoice}
                    disabled={previewLoading}
                    className="w-full bg-cyan-600 hover:bg-cyan-700 text-white"
                  >
                    {previewLoading ? (
                      <>
                        <Loader className="w-4 h-4 mr-2 animate-spin" />
                        Generating Preview...
                      </>
                    ) : (
                      <>
                        <Mic className="w-4 h-4 mr-2" />
                        Preview Voice
                      </>
                    )}
                  </Button>

                  <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 text-xs text-gray-300">
                    <div className="flex items-start gap-2">
                      <span className="text-blue-400">ℹ️</span>
                      <div>
                        <strong className="text-white">Pro Tip:</strong> For best results, use stability 0.5-0.7 and similarity boost 0.7-0.8. 
                        The TTS node will automatically collect and combine voiceover text from all previous AI nodes.
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* ElevenLabs Conversational AI Node Config */}
              {selectedNode.type === 'elevenlabsconversational' && (
                <>
                  <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <MessageSquare className="w-4 h-4 text-amber-400" />
                      <span className="text-sm font-semibold text-amber-400">ElevenLabs Conversational AI</span>
                    </div>
                    <p className="text-xs text-gray-400">
                      Select which voice AI agent to use in your workflow
                    </p>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label className="text-white">Select AI Agent</Label>
                      <Button
                        onClick={() => {
                          console.log('[Refresh] Fetching agents...');
                          const token = localStorage.getItem('apoe_token');
                          console.log('[Refresh] Token exists:', !!token);
                          axios.get(`${BACKEND_URL}/api/conversational-ai/agents`, {
                            headers: {
                              'Authorization': `Bearer ${token}`
                            }
                          })
                            .then(response => {
                              console.log('[Refresh] Response:', response.data);
                              const agents = Array.isArray(response.data) ? response.data : [];
                              const mappedAgents = agents.map(a => ({ 
                                id: a.id, 
                                name: a.name,
                                elevenlabs_agent_id: a.elevenlabs_agent_id 
                              }));
                              setNodeConfig({ 
                                ...nodeConfig, 
                                availableAgents: mappedAgents
                              });
                              toast.success(`Loaded ${mappedAgents.length} agent(s)`);
                            })
                            .catch(error => {
                              console.error('[Refresh] Error:', error);
                              toast.error(`Failed: ${error.response?.data?.detail || error.message}`);
                            });
                        }}
                        size="sm"
                        className="h-7 text-xs bg-amber-600 hover:bg-amber-700"
                      >
                        Refresh Agents
                      </Button>
                    </div>
                    
                    {nodeConfig.availableAgents === undefined ? (
                      <div className="mt-2 p-3 bg-gray-800 border border-gray-700 rounded-lg flex items-center gap-2">
                        <Loader className="w-4 h-4 animate-spin text-amber-400" />
                        <span className="text-sm text-gray-300">Loading agents...</span>
                      </div>
                    ) : (
                      <>
                        <Select
                          value={nodeConfig.agentId || ''}
                          onValueChange={(value) => {
                            const selectedAgent = (nodeConfig.availableAgents || []).find(a => a.id === value);
                            console.log('[Select] Selected agent:', selectedAgent);
                            setNodeConfig({ 
                              ...nodeConfig, 
                              agentId: value,
                              agentName: selectedAgent?.name || 'Unknown Agent',
                              elevenlabs_agent_id: selectedAgent?.elevenlabs_agent_id || ''
                            });
                          }}
                        >
                          <SelectTrigger className="bg-[#0f1218] border-gray-700 text-white mt-2">
                            <SelectValue placeholder="Select an agent" />
                          </SelectTrigger>
                          <SelectContent className="bg-[#1a1d2e] border-gray-700">
                            {(nodeConfig.availableAgents || []).length > 0 ? (
                              nodeConfig.availableAgents.map(agent => (
                                <SelectItem key={agent.id} value={agent.id}>
                                  {agent.name}
                                </SelectItem>
                              ))
                            ) : (
                              <SelectItem value="none" disabled>No agents available</SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                        
                        {nodeConfig.availableAgents && nodeConfig.availableAgents.length === 0 && (
                          <p className="text-xs text-yellow-400 mt-2">
                            ⚠️ No agents found. Create an agent in the Conversational AI section first.
                          </p>
                        )}
                        
                        {nodeConfig.availableAgents && nodeConfig.availableAgents.length > 0 && (
                          <p className="text-xs text-gray-400 mt-2">
                            ✓ Found {nodeConfig.availableAgents.length} agent(s)
                          </p>
                        )}
                      </>
                    )}
                    
                    {nodeConfig.agentId && (
                      <div className="mt-3 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                        <div className="flex items-center gap-2">
                          <span className="text-green-400">✓</span>
                          <span className="text-sm text-white">Agent selected: <strong>{nodeConfig.agentName}</strong></span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 text-xs text-gray-300">
                    <div className="flex items-start gap-2">
                      <span className="text-blue-400">ℹ️</span>
                      <div>
                        <strong className="text-white">How it works:</strong> This node will initiate a voice conversation using the selected ElevenLabs agent.
                        The agent will use its configured tools and settings from the Conversational AI section.
                      </div>
                    </div>
                  </div>

                  <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-xs text-gray-300">
                    <div className="flex items-start gap-2">
                      <span className="text-amber-400">⚙️</span>
                      <div>
                        <strong className="text-white">Configure Tools:</strong> To add or modify tools (End Call, Detect Language, etc.), 
                        edit your agent in the <strong>Conversational AI Studio</strong> → <strong>Tools Tab</strong>.
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Text-to-Music Node Config */}
              {selectedNode.type === 'texttomusic' && (
                <>
                  <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4 mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Mic className="w-4 h-4 text-purple-400" />
                      <span className="text-sm font-semibold text-purple-400">ElevenLabs Music Generation</span>
                    </div>
                    <p className="text-xs text-gray-400">
                      Generate background music, songs, or sound effects from text prompts
                    </p>
                  </div>

                  <div>
                    <Label className="text-white">Music Prompt</Label>
                    <Textarea
                      value={nodeConfig.prompt || ''}
                      onChange={(e) => setNodeConfig({ ...nodeConfig, prompt: e.target.value })}
                      placeholder="e.g., 'Epic cinematic orchestral music with dramatic strings and horns' or leave empty to use AI node output..."
                      className="bg-[#0f1218] border-gray-700 text-white mt-2"
                      rows={4}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Describe the style, mood, instruments, tempo, or genre. Can auto-receive from AI nodes.
                    </p>
                  </div>

                  <div>
                    <Label className="text-white flex items-center justify-between">
                      <span>Duration (seconds)</span>
                      <span className="text-xs text-gray-400">{nodeConfig.duration_seconds || 120}s</span>
                    </Label>
                    <input
                      type="range"
                      min="30"
                      max="300"
                      step="10"
                      value={nodeConfig.duration_seconds || 120}
                      onChange={(e) => setNodeConfig({ ...nodeConfig, duration_seconds: parseInt(e.target.value) })}
                      className="w-full mt-2 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Length of generated music (30s to 5 minutes)
                    </p>
                  </div>

                  <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 text-xs text-gray-300">
                    <div className="flex items-start gap-2">
                      <span className="text-yellow-400">⚡</span>
                      <div>
                        <strong className="text-white">Note:</strong> Music generation can take 30 seconds to 5 minutes depending on duration. 
                        The node will automatically wait for completion. Generated music is commercially licensed for broad use.
                      </div>
                    </div>
                  </div>

                  <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-3 text-xs text-gray-300 mt-3">
                    <div className="flex items-start gap-2">
                      <span className="text-purple-400">💡</span>
                      <div>
                        <strong className="text-white">Example Prompts:</strong>
                        <ul className="list-disc list-inside mt-2 space-y-1">
                          <li>"Upbeat pop music with piano and drums, 90 BPM"</li>
                          <li>"Dark ambient electronic soundscape with synth pads"</li>
                          <li>"Acoustic guitar folk song with soft vocals in English"</li>
                          <li>"Cinematic trailer music with epic drums and brass"</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </>
              )}


              {/* Database Node Config */}
              {selectedNode.type === 'database' && (
                <>
                  <div>
                    <Label className="text-white">Collection</Label>
                    <Input
                      value={nodeConfig.collection || ''}
                      onChange={(e) => setNodeConfig({ ...nodeConfig, collection: e.target.value })}
                      placeholder="users"
                      className="bg-[#0f1218] border-gray-700 text-white mt-2"
                    />
                  </div>
                  <div>
                    <Label className="text-white">Query (JSON)</Label>
                    <Textarea
                      value={nodeConfig.query || ''}
                      onChange={(e) => setNodeConfig({ ...nodeConfig, query: e.target.value })}
                      placeholder='{"status": "active"}'
                      className="bg-[#0f1218] border-gray-700 text-white mt-2"
                      rows={4}
                    />
                  </div>
                </>
              )}

              {/* ElevenLabs Node Config */}
              {selectedNode.type === 'elevenlabs' && (
                <>
                  <div>
                    <Label className="text-white">Text to Convert</Label>
                    <Textarea
                      value={nodeConfig.text || ''}
                      onChange={(e) => setNodeConfig({ ...nodeConfig, text: e.target.value })}
                      placeholder="Enter text to convert to speech..."
                      className="bg-[#0f1218] border-gray-700 text-white mt-2"
                      rows={4}
                    />
                  </div>
                  <div>
                    <Label className="text-white">Voice ID</Label>
                    <Input
                      value={nodeConfig.voice || ''}
                      onChange={(e) => setNodeConfig({ ...nodeConfig, voice: e.target.value })}
                      placeholder="rachel or voice_id"
                      className="bg-[#0f1218] border-gray-700 text-white mt-2"
                    />
                  </div>
                  <div>
                    <Label className="text-white">API Key</Label>
                    <Input
                      type="password"
                      value={nodeConfig.apiKey || ''}
                      onChange={(e) => setNodeConfig({ ...nodeConfig, apiKey: e.target.value })}
                      placeholder="Your ElevenLabs API key"
                      className="bg-[#0f1218] border-gray-700 text-white mt-2"
                    />
                  </div>
                </>
              )}

              {/* ManyChat Node Config */}
              {selectedNode.type === 'manychat' && (
                <>
                  <div>
                    <Label className="text-white">Action</Label>
                    <Select
                      value={nodeConfig.action || 'send_message'}
                      onValueChange={(value) => setNodeConfig({ ...nodeConfig, action: value })}
                    >
                      <SelectTrigger className="bg-[#0f1218] border-gray-700 text-white mt-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#1a1d2e] border-gray-700">
                        <SelectItem value="send_message">Send Message</SelectItem>
                        <SelectItem value="add_tag">Add Tag</SelectItem>
                        <SelectItem value="remove_tag">Remove Tag</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-white">Message</Label>
                    <Textarea
                      value={nodeConfig.message || ''}
                      onChange={(e) => setNodeConfig({ ...nodeConfig, message: e.target.value })}
                      placeholder="Message to send..."
                      className="bg-[#0f1218] border-gray-700 text-white mt-2"
                      rows={4}
                    />
                  </div>
                  <div>
                    <Label className="text-white">API Key</Label>
                    <Input
                      type="password"
                      value={nodeConfig.apiKey || ''}
                      onChange={(e) => setNodeConfig({ ...nodeConfig, apiKey: e.target.value })}
                      placeholder="Your ManyChat API key"
                      className="bg-[#0f1218] border-gray-700 text-white mt-2"
                    />
                  </div>
                </>
              )}

              {/* Video Generation Node Config */}
              {selectedNode.type === 'videogen' && (
                <>
                  <div>
                    <Label className="text-white">Video Prompt</Label>
                    <Textarea
                      value={nodeConfig.prompt || ''}
                      onChange={(e) => setNodeConfig({ ...nodeConfig, prompt: e.target.value })}
                      placeholder="Describe the video you want to generate..."
                      className="bg-[#0f1218] border-gray-700 text-white mt-2"
                      rows={4}
                    />
                  </div>
                  <div>
                    <Label className="text-white">Video Size</Label>
                    <Select
                      value={nodeConfig.size || '1280x720'}
                      onValueChange={(value) => setNodeConfig({ ...nodeConfig, size: value })}
                    >
                      <SelectTrigger className="bg-[#0f1218] border-gray-700 text-white mt-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#1a1d2e] border-gray-700">
                        <SelectItem value="1280x720">1280x720 (HD Landscape)</SelectItem>
                        <SelectItem value="1792x1024">1792x1024 (Widescreen)</SelectItem>
                        <SelectItem value="1024x1792">1024x1792 (Portrait)</SelectItem>
                        <SelectItem value="1024x1024">1024x1024 (Square)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-white">Duration (seconds)</Label>
                    <Select
                      value={String(nodeConfig.duration || '4')}
                      onValueChange={(value) => setNodeConfig({ ...nodeConfig, duration: parseInt(value) })}
                    >
                      <SelectTrigger className="bg-[#0f1218] border-gray-700 text-white mt-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#1a1d2e] border-gray-700">
                        <SelectItem value="4">4 seconds</SelectItem>
                        <SelectItem value="8">8 seconds</SelectItem>
                        <SelectItem value="12">12 seconds</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}

              {/* Image to Video Node Config */}
              {selectedNode.type === 'imagetovideo' && (
                <>
                  <div>
                    <Label className="text-white">Starting Image (Optional)</Label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (event) => {
                            setNodeConfig({ ...nodeConfig, uploadedImage: event.target.result });
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                      className="w-full p-2 bg-[#0f1218] border border-gray-700 rounded text-white text-sm mt-2"
                    />
                    {nodeConfig.uploadedImage && (
                      <div className="mt-2">
                        <img src={nodeConfig.uploadedImage} alt="Uploaded" className="w-full h-32 object-cover rounded" />
                        <button
                          onClick={() => setNodeConfig({ ...nodeConfig, uploadedImage: null })}
                          className="text-xs text-red-400 hover:text-red-300 mt-1"
                        >
                          Remove image
                        </button>
                      </div>
                    )}
                    <p className="text-xs text-gray-500 mt-1">Leave empty to use image from previous node</p>
                  </div>
                  <div>
                    <Label className="text-white">Video Prompt</Label>
                    <Textarea
                      value={nodeConfig.prompt || ''}
                      onChange={(e) => setNodeConfig({ ...nodeConfig, prompt: e.target.value })}
                      placeholder="Describe the video motion/animation..."
                      className="bg-[#0f1218] border-gray-700 text-white mt-2"
                      rows={4}
                    />
                  </div>
                  <div>
                    <Label className="text-white">Duration (seconds)</Label>
                    <Select
                      value={String(nodeConfig.duration || '4')}
                      onValueChange={(value) => setNodeConfig({ ...nodeConfig, duration: parseInt(value) })}
                    >
                      <SelectTrigger className="bg-[#0f1218] border-gray-700 text-white mt-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#1a1d2e] border-gray-700">
                        <SelectItem value="4">4 seconds</SelectItem>
                        <SelectItem value="8">8 seconds</SelectItem>
                        <SelectItem value="12">12 seconds</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-white">Video Size</Label>
                    <Select
                      value={nodeConfig.size || '1280x720'}
                      onValueChange={(value) => setNodeConfig({ ...nodeConfig, size: value })}
                    >
                      <SelectTrigger className="bg-[#0f1218] border-gray-700 text-white mt-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#1a1d2e] border-gray-700">
                        <SelectItem value="1280x720">1280x720 (HD Landscape)</SelectItem>
                        <SelectItem value="1792x1024">1792x1024 (Widescreen)</SelectItem>
                        <SelectItem value="1024x1792">1024x1792 (Portrait)</SelectItem>
                        <SelectItem value="1024x1024">1024x1024 (Square)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}

              {/* Image Generation Node Config */}
              {selectedNode.type === 'imagegen' && (
                <>
                  <div>
                    <Label className="text-white">Image Prompt</Label>
                    <Textarea
                      value={nodeConfig.prompt || ''}
                      onChange={(e) => setNodeConfig({ ...nodeConfig, prompt: e.target.value })}
                      placeholder="Describe the image you want to generate..."
                      className="bg-[#0f1218] border-gray-700 text-white mt-2"
                      rows={4}
                    />
                  </div>
                  <div>
                    <Label className="text-white">Image Size</Label>
                    <Select
                      value={nodeConfig.size || '1024x1024'}
                      onValueChange={(value) => setNodeConfig({ ...nodeConfig, size: value })}
                    >
                      <SelectTrigger className="bg-[#0f1218] border-gray-700 text-white mt-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#1a1d2e] border-gray-700">
                        <SelectItem value="1024x1024">1024x1024 (Square)</SelectItem>
                        <SelectItem value="1024x1792">1024x1792 (Portrait)</SelectItem>
                        <SelectItem value="1792x1024">1792x1024 (Landscape)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}

              {/* Task Planner Node Config */}
              {selectedNode.type === 'taskplanner' && (
                <>
                  <div>
                    <Label className="text-white">Action</Label>
                    <Select
                      value={nodeConfig.action || 'create'}
                      onValueChange={(value) => setNodeConfig({ ...nodeConfig, action: value })}
                    >
                      <SelectTrigger className="bg-[#0f1218] border-gray-700 text-white mt-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#1a1d2e] border-gray-700">
                        <SelectItem value="create">Create Task</SelectItem>
                        <SelectItem value="update">Update Task</SelectItem>
                        <SelectItem value="complete">Complete Task</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-white">Task Title</Label>
                    <Input
                      value={nodeConfig.title || ''}
                      onChange={(e) => setNodeConfig({ ...nodeConfig, title: e.target.value })}
                      placeholder="Task title"
                      className="bg-[#0f1218] border-gray-700 text-white mt-2"
                    />
                  </div>
                  <div>
                    <Label className="text-white">Task Description</Label>
                    <Textarea
                      value={nodeConfig.description || ''}
                      onChange={(e) => setNodeConfig({ ...nodeConfig, description: e.target.value })}
                      placeholder="Task description..."
                      className="bg-[#0f1218] border-gray-700 text-white mt-2"
                      rows={3}
                    />
                  </div>
                  <div>
                    <Label className="text-white">Priority (1-10)</Label>
                    <Input
                      type="number"
                      min="1"
                      max="10"
                      value={nodeConfig.priority || '5'}
                      onChange={(e) => setNodeConfig({ ...nodeConfig, priority: parseInt(e.target.value) })}
                      className="bg-[#0f1218] border-gray-700 text-white mt-2"
                    />
                  </div>
                </>
              )}

              {/* Condition Node Config */}
              {selectedNode.type === 'condition' && (
                <>
                  <div>
                    <Label className="text-white">Condition</Label>
                    <Input
                      value={nodeConfig.condition || ''}
                      onChange={(e) => setNodeConfig({ ...nodeConfig, condition: e.target.value })}
                      placeholder="e.g., value > 100"
                      className="bg-[#0f1218] border-gray-700 text-white mt-2"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Use "value" to reference previous node output
                    </p>
                  </div>
                  <div>
                    <Label className="text-white">Operator</Label>
                    <Select
                      value={nodeConfig.operator || 'greater_than'}
                      onValueChange={(value) => setNodeConfig({ ...nodeConfig, operator: value })}
                    >
                      <SelectTrigger className="bg-[#0f1218] border-gray-700 text-white mt-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#1a1d2e] border-gray-700">
                        <SelectItem value="equals">Equals (==)</SelectItem>
                        <SelectItem value="not_equals">Not Equals (!=)</SelectItem>
                        <SelectItem value="greater_than">Greater Than (&gt;)</SelectItem>
                        <SelectItem value="less_than">Less Than (&lt;)</SelectItem>
                        <SelectItem value="contains">Contains</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-white">Compare Value</Label>
                    <Input
                      value={nodeConfig.compareValue || ''}
                      onChange={(e) => setNodeConfig({ ...nodeConfig, compareValue: e.target.value })}
                      placeholder="Value to compare against"
                      className="bg-[#0f1218] border-gray-700 text-white mt-2"
                    />
                  </div>
                </>
              )}

              {/* Switch Node Config */}
              {selectedNode.type === 'switch' && (
                <>
                  <div>
                    <Label className="text-white">Switch On Value</Label>
                    <Input
                      value={nodeConfig.switchValue || ''}
                      onChange={(e) => setNodeConfig({ ...nodeConfig, switchValue: e.target.value })}
                      placeholder="Field name to switch on"
                      className="bg-[#0f1218] border-gray-700 text-white mt-2"
                    />
                  </div>
                  <div>
                    <Label className="text-white">Cases (JSON array)</Label>
                    <Textarea
                      value={nodeConfig.cases || ''}
                      onChange={(e) => setNodeConfig({ ...nodeConfig, cases: e.target.value })}
                      placeholder='["case1", "case2", "case3"]'
                      className="bg-[#0f1218] border-gray-700 text-white mt-2"
                      rows={4}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Each case will create a connection point
                    </p>
                  </div>
                </>
              )}

              {/* Loop Node Config */}
              {selectedNode.type === 'loop' && (
                <>
                  <div>
                    <Label className="text-white">Loop Type</Label>
                    <Select
                      value={nodeConfig.loopType || 'forEach'}
                      onValueChange={(value) => setNodeConfig({ ...nodeConfig, loopType: value })}
                    >
                      <SelectTrigger className="bg-[#0f1218] border-gray-700 text-white mt-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#1a1d2e] border-gray-700">
                        <SelectItem value="forEach">For Each</SelectItem>
                        <SelectItem value="while">While</SelectItem>
                        <SelectItem value="count">Count (N times)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {nodeConfig.loopType === 'forEach' && (
                    <div>
                      <Label className="text-white">Array to Loop Over</Label>
                      <Input
                        value={nodeConfig.array || ''}
                        onChange={(e) => setNodeConfig({ ...nodeConfig, array: e.target.value })}
                        placeholder="Field name containing array"
                        className="bg-[#0f1218] border-gray-700 text-white mt-2"
                      />
                    </div>
                  )}
                  {nodeConfig.loopType === 'count' && (
                    <div>
                      <Label className="text-white">Number of Iterations</Label>
                      <Input
                        type="number"
                        value={nodeConfig.iterations || '1'}
                        onChange={(e) => setNodeConfig({ ...nodeConfig, iterations: e.target.value })}
                        placeholder="Number of times to loop"
                        className="bg-[#0f1218] border-gray-700 text-white mt-2"
                      />
                    </div>
                  )}
                  {nodeConfig.loopType === 'while' && (
                    <div>
                      <Label className="text-white">While Condition</Label>
                      <Input
                        value={nodeConfig.whileCondition || ''}
                        onChange={(e) => setNodeConfig({ ...nodeConfig, whileCondition: e.target.value })}
                        placeholder="e.g., count < 10"
                        className="bg-[#0f1218] border-gray-700 text-white mt-2"
                      />
                    </div>
                  )}
                </>
              )}

              {/* Delay Node Config */}
              {selectedNode.type === 'delay' && (
                <>
                  <div>
                    <Label className="text-white">Duration</Label>
                    <Input
                      type="number"
                      value={nodeConfig.duration || '1'}
                      onChange={(e) => setNodeConfig({ ...nodeConfig, duration: e.target.value })}
                      placeholder="1"
                      className="bg-[#0f1218] border-gray-700 text-white mt-2"
                    />
                  </div>
                  <div>
                    <Label className="text-white">Unit</Label>
                    <Select
                      value={nodeConfig.unit || 'seconds'}
                      onValueChange={(value) => setNodeConfig({ ...nodeConfig, unit: value })}
                    >
                      <SelectTrigger className="bg-[#0f1218] border-gray-700 text-white mt-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#1a1d2e] border-gray-700">
                        <SelectItem value="seconds">Seconds</SelectItem>
                        <SelectItem value="minutes">Minutes</SelectItem>
                        <SelectItem value="hours">Hours</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <Button
                onClick={() => setShowConfigModal(false)}
                variant="outline"
                className="border-gray-700"
              >
                Cancel
              </Button>
              <Button
                onClick={saveNodeConfig}
                className="bg-gradient-to-r from-purple-500 to-pink-500"
              >
                Save Configuration
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Trigger Configuration Modal */}
      {showTriggerModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-[#1a1d2e] border border-gray-700 rounded-xl p-6 w-full max-w-lg">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Workflow Triggers
              </h2>
              <button
                onClick={() => setShowTriggerModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <Label className="text-white">Trigger Type</Label>
                <Select
                  value={triggerConfig.type || 'manual'}
                  onValueChange={(value) => setTriggerConfig({ ...triggerConfig, type: value })}
                >
                  <SelectTrigger className="bg-[#0f1218] border-gray-700 text-white mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1a1d2e] border-gray-700">
                    <SelectItem value="manual">Manual (Execute button)</SelectItem>
                    <SelectItem value="schedule">Schedule (Cron)</SelectItem>
                    <SelectItem value="webhook">Webhook</SelectItem>
                    <SelectItem value="event">Database Event</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {triggerConfig.type === 'schedule' && (
                <>
                  <div>
                    <Label className="text-white">Schedule Pattern</Label>
                    <Select
                      value={triggerConfig.schedulePattern || 'hourly'}
                      onValueChange={(value) => setTriggerConfig({ ...triggerConfig, schedulePattern: value })}
                    >
                      <SelectTrigger className="bg-[#0f1218] border-gray-700 text-white mt-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#1a1d2e] border-gray-700">
                        <SelectItem value="hourly">Every Hour</SelectItem>
                        <SelectItem value="daily">Every Day</SelectItem>
                        <SelectItem value="weekly">Every Week</SelectItem>
                        <SelectItem value="custom">Custom (Cron)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {triggerConfig.schedulePattern === 'custom' && (
                    <div>
                      <Label className="text-white">Cron Expression</Label>
                      <Input
                        value={triggerConfig.cronExpression || ''}
                        onChange={(e) => setTriggerConfig({ ...triggerConfig, cronExpression: e.target.value })}
                        placeholder="0 */1 * * *"
                        className="bg-[#0f1218] border-gray-700 text-white mt-2"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        E.g., "0 */1 * * *" = every hour
                      </p>
                    </div>
                  )}
                </>
              )}

              {triggerConfig.type === 'webhook' && (
                <div>
                  <Label className="text-white">Webhook URL</Label>
                  <Input
                    value={`https://api.yourdomain.com/webhook/${currentWorkflow?.id || 'workflow-id'}`}
                    readOnly
                    className="bg-[#0f1218] border-gray-700 text-gray-400 mt-2"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    POST to this URL to trigger the workflow
                  </p>
                </div>
              )}

              {triggerConfig.type === 'event' && (
                <>
                  <div>
                    <Label className="text-white">Collection to Watch</Label>
                    <Input
                      value={triggerConfig.collection || ''}
                      onChange={(e) => setTriggerConfig({ ...triggerConfig, collection: e.target.value })}
                      placeholder="tasks"
                      className="bg-[#0f1218] border-gray-700 text-white mt-2"
                    />
                  </div>
                  <div>
                    <Label className="text-white">Event Type</Label>
                    <Select
                      value={triggerConfig.eventType || 'insert'}
                      onValueChange={(value) => setTriggerConfig({ ...triggerConfig, eventType: value })}
                    >
                      <SelectTrigger className="bg-[#0f1218] border-gray-700 text-white mt-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#1a1d2e] border-gray-700">
                        <SelectItem value="insert">Document Created</SelectItem>
                        <SelectItem value="update">Document Updated</SelectItem>
                        <SelectItem value="delete">Document Deleted</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <Button
                onClick={() => setShowTriggerModal(false)}
                variant="outline"
                className="border-gray-700"
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  toast.success('Trigger configuration saved');
                  setShowTriggerModal(false);
                }}
                className="bg-gradient-to-r from-purple-500 to-pink-500"
              >
                Save Trigger
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Templates Modal */}
      {showTemplatesModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-[#1a1d2e] border border-gray-700 rounded-xl p-6 w-full max-w-4xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Copy className="w-5 h-5" />
                Workflow Templates
              </h2>
              <button
                onClick={() => setShowTemplatesModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Template 1: Video Ad Creator */}
              <div 
                onClick={() => loadTemplate('video-ad-creator')}
                className="border border-gray-700 rounded-lg p-4 hover:border-purple-500 transition-colors cursor-pointer"
              >
                <h3 className="font-semibold text-white mb-2">🎬 Video Ad Creator</h3>
                <p className="text-sm text-gray-400 mb-3">
                  Creates seamless extended videos by generating continuation clips and stitching them together
                </p>
                <div className="text-xs text-gray-500">
                  Nodes: AI Chat → Video Gen → Screenshot → AI Chat → Video Gen → Stitch
                </div>
              </div>

              {/* Template 2: Ad Performance Monitor */}
              <div className="border border-gray-700 rounded-lg p-4 hover:border-purple-500/50 transition-colors cursor-not-allowed opacity-50">
                <h3 className="font-semibold text-white mb-2">📊 Ad Performance Monitor</h3>
                <p className="text-sm text-gray-400 mb-3">
                  Monitors ROAS, auto-generates new ad videos when performance drops
                </p>
                <div className="text-xs text-gray-500">
                  Nodes: Database → Condition → Video Gen → Task Planner
                </div>
              </div>

              {/* Template 2: Content Pipeline */}
              <div className="border border-gray-700 rounded-lg p-4 hover:border-purple-500 transition-colors cursor-pointer">
                <h3 className="font-semibold text-white mb-2">🎨 Content Pipeline</h3>
                <p className="text-sm text-gray-400 mb-3">
                  AI generates copy → Creates image → Converts to speech
                </p>
                <div className="text-xs text-gray-500">
                  Nodes: AI Chat → Image Gen → ElevenLabs
                </div>
              </div>

              {/* Template 3: Customer Response */}
              <div className="border border-gray-700 rounded-lg p-4 hover:border-purple-500 transition-colors cursor-pointer">
                <h3 className="font-semibold text-white mb-2">💬 Auto Customer Response</h3>
                <p className="text-sm text-gray-400 mb-3">
                  Listens for messages, AI generates response, sends via ManyChat
                </p>
                <div className="text-xs text-gray-500">
                  Nodes: Database → AI Chat → ManyChat
                </div>
              </div>

              {/* Template 4: Task Automation */}
              <div className="border border-gray-700 rounded-lg p-4 hover:border-purple-500 transition-colors cursor-pointer">
                <h3 className="font-semibold text-white mb-2">✅ Smart Task Creator</h3>
                <p className="text-sm text-gray-400 mb-3">
                  Analyzes business data, creates prioritized tasks automatically
                </p>
                <div className="text-xs text-gray-500">
                  Nodes: Database → AI Chat → Loop → Task Planner
                </div>
              </div>

              {/* Template 5: A/B Test Pipeline */}
              <div className="border border-gray-700 rounded-lg p-4 hover:border-purple-500 transition-colors cursor-pointer">
                <h3 className="font-semibold text-white mb-2">🧪 A/B Test Generator</h3>
                <p className="text-sm text-gray-400 mb-3">
                  Creates multiple ad variations with different copy and images
                </p>
                <div className="text-xs text-gray-500">
                  Nodes: Loop → AI Chat → Image Gen → HTTP
                </div>
              </div>

              {/* Template 6: Daily Report */}
              <div className="border border-gray-700 rounded-lg p-4 hover:border-purple-500 transition-colors cursor-pointer">
                <h3 className="font-semibold text-white mb-2">📈 Daily Business Report</h3>
                <p className="text-sm text-gray-400 mb-3">
                  Collects metrics, AI analyzes, sends summary via email
                </p>
                <div className="text-xs text-gray-500">
                  Nodes: Database → AI Chat → HTTP (Email API)
                </div>
              </div>
            </div>

            <div className="mt-6 text-center text-sm text-gray-500">
              Click Video Ad Creator template to load it instantly. More templates coming soon!
            </div>
          </div>
        </div>
      )}

      {/* New Workflow Modal */}
      {showNewWorkflowModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-[#13141a] rounded-xl border border-gray-800 p-6 w-full max-w-md">
            <h2 className="text-xl font-semibold mb-4">Create New Workflow</h2>
            <div className="space-y-4">
              <div>
                <Label className="text-sm text-gray-400 mb-2 block">Workflow Name</Label>
                <input
                  type="text"
                  value={newWorkflowName}
                  onChange={(e) => setNewWorkflowName(e.target.value)}
                  placeholder="Enter workflow name..."
                  className="w-full px-4 py-2 bg-[#0a0b0d] border border-gray-700 rounded-lg text-white focus:border-purple-500 focus:outline-none"
                  onKeyPress={(e) => e.key === 'Enter' && createNewWorkflow()}
                  autoFocus
                />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={createNewWorkflow}
                  className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500"
                >
                  Create
                </Button>
                <Button
                  onClick={() => {
                    setShowNewWorkflowModal(false);
                    setNewWorkflowName('');
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

      {/* Rename Workflow Modal */}
      {showRenameModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-[#13141a] rounded-xl border border-gray-800 p-6 w-full max-w-md">
            <h2 className="text-xl font-semibold mb-4">Rename Workflow</h2>
            <div className="space-y-4">
              <div>
                <Label className="text-sm text-gray-400 mb-2 block">New Name</Label>
                <input
                  type="text"
                  value={renameWorkflowName}
                  onChange={(e) => setRenameWorkflowName(e.target.value)}
                  placeholder="Enter new name..."
                  className="w-full px-4 py-2 bg-[#0a0b0d] border border-gray-700 rounded-lg text-white focus:border-purple-500 focus:outline-none"
                  onKeyPress={(e) => e.key === 'Enter' && renameWorkflow()}
                  autoFocus
                />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={renameWorkflow}
                  className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500"
                >
                  Rename
                </Button>
                <Button
                  onClick={() => {
                    setShowRenameModal(false);
                    setRenameWorkflowId(null);
                    setRenameWorkflowName('');
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
    </div>
  );
}
