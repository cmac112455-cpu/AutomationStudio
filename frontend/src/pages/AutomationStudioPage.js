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
import { Play, Save, Plus, Trash2, Workflow, Zap, Database, Globe, MessageSquare, Mic, Send, Video, Image, CheckSquare, Settings, X, Clock, Copy, Calendar, MoreVertical, Camera } from 'lucide-react';

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
  manychat: ManyChatNode,
  videogen: VideoGenNode,
  imagetovideo: ImageToVideoNode,
  imagegen: ImageGenNode,
  screenshot: ScreenshotNode,
  stitch: StitchNode,
  texttospeech: TextToSpeechNode,
  audiooverlay: AudioOverlayNode,
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
  const [showTriggerModal, setShowTriggerModal] = useState(false);
  const [triggerConfig, setTriggerConfig] = useState({});
  const [showTemplatesModal, setShowTemplatesModal] = useState(false);

  const loadTemplate = (templateName) => {
    const templates = {
      'video-ad-creator': {
        name: 'Video Ad Creator - Extended Videos',
        nodes: [
          {id: 'start-1', type: 'start', position: {x: 100, y: 50}, data: {}},
          {id: 'ai-1', type: 'gemini', position: {x: 300, y: 50}, data: {prompt: 'Create a detailed 4-second video scene description for the FIRST PART of a product advertisement with a voiceover script that will be split across 2 videos. This is CRITICAL: The next AI will need to match your audio specifications EXACTLY.\n\n1. PRODUCT & SCENE: Be extremely specific - describe exact product (e.g. "silver laptop", "blue water bottle"), exact setting (e.g. "white marble desk", "wooden kitchen table"), exact lighting (e.g. "morning sunlight from left"), and exact camera movement (e.g. "camera slowly pans right").\n\n2. VOICE & AUDIO CHARACTERISTICS (for continuity across both videos):\n   - Voice Gender: [male/female]\n   - Voice Age: [young adult/mature/elderly]\n   - Voice Tone: [warm/energetic/calm/professional/friendly]\n   - Speaking Pace: [slow/moderate/fast]\n   - Accent: [American/British/neutral/specific]\n   - Background Audio: [soft music/ambient sounds/silence] with exact description\n   - Audio Volume: [voice prominent/balanced with music]\n   \n3. VOICEOVER SCRIPT PART 1:\n   - Create compelling script that ENDS MID-SENTENCE or MID-PHRASE\n   - Example: "What fuels your-" or "Discover the secret to-"\n   - The sentence will be completed in video 2\n   \n4. FORMAT YOUR RESPONSE EXACTLY AS:\n   SCENE: [Detailed visual description]\n   VOICE: [Gender, age, tone - e.g. "Female, young adult, warm and energetic tone"]\n   SPEAKING: [Pace and style - e.g. "Moderate pace, friendly conversational style"]\n   BACKGROUND AUDIO: [Exact description - e.g. "Soft uplifting piano music at 30% volume"]\n   VOICEOVER PART 1: "[Your incomplete sentence]"\n   \nUse concrete, professional language. The audio specs MUST be detailed for perfect matching in video 2.', model: 'gemini-2.5-pro'}},
          {id: 'video-1', type: 'videogen', position: {x: 500, y: 50}, data: {duration: 4, size: '1280x720'}},
          {id: 'screenshot-1', type: 'screenshot', position: {x: 700, y: 50}, data: {}},
          {id: 'ai-2', type: 'gemini', position: {x: 700, y: 200}, data: {prompt: 'Continue the advertisement from the previous AI response. Create the SECOND PART that seamlessly continues BOTH the visual scene AND audio. CRITICAL: You MUST use the EXACT SAME voice and audio characteristics from Part 1 for perfect continuity.\n\n1. READ THE PREVIOUS AI RESPONSE: Extract the voice characteristics, background audio, and incomplete voiceover.\n\n2. MATCH AUDIO SPECIFICATIONS EXACTLY:\n   - Use the SAME voice gender, age, tone from Part 1\n   - Use the SAME speaking pace and style from Part 1\n   - Use the SAME background audio/music from Part 1\n   - Maintain the SAME audio volume levels from Part 1\n   - This ensures the voice sounds IDENTICAL between videos\n\n3. VISUAL CONTINUATION:\n   - Describe the next 4 seconds continuing from Part 1\n   - Exact actions (e.g. "screen lights up", "lid opens")\n   - Exact visual changes (e.g. "blue interface appears")\n   - Exact camera movement (e.g. "camera zooms in 30%")\n\n4. COMPLETE THE VOICEOVER:\n   - Finish the incomplete sentence from Part 1 naturally\n   - If Part 1 was: "What fuels your-"\n   - Part 2 should be: "day for maximum health and energy"\n   - The completion should flow as ONE continuous sentence\n\n5. FORMAT YOUR RESPONSE EXACTLY AS:\n   SCENE: [Visual description continuing from Part 1]\n   VOICE: [COPY EXACT specs from Part 1 - e.g. "Female, young adult, warm and energetic tone"]\n   SPEAKING: [COPY EXACT specs from Part 1 - e.g. "Moderate pace, friendly conversational style"]\n   BACKGROUND AUDIO: [COPY EXACT specs from Part 1 - e.g. "Soft uplifting piano music at 30% volume"]\n   VOICEOVER PART 2: "[Complete the sentence from Part 1]"\n   \nIMPORTANT: The audio specifications MUST be IDENTICAL to Part 1 for seamless voice continuity. Copy them exactly.', model: 'gemini-2.5-pro'}},
          {id: 'video-2', type: 'imagetovideo', position: {x: 900, y: 125}, data: {duration: 4, size: '1280x720'}},
          {id: 'screenshot-2', type: 'screenshot', position: {x: 1100, y: 125}, data: {}},
          {id: 'stitch-1', type: 'stitch', position: {x: 1300, y: 87}, data: {}},
          {id: 'end-1', type: 'end', position: {x: 1500, y: 87}, data: {}}
        ],
        edges: [
          {id: 'e1', source: 'start-1', target: 'ai-1'},
          {id: 'e2', source: 'ai-1', target: 'video-1'},
          {id: 'e3', source: 'video-1', target: 'screenshot-1'},
          {id: 'e4', source: 'screenshot-1', target: 'ai-2'},
          {id: 'e5', source: 'ai-2', target: 'video-2'},
          {id: 'e6', source: 'video-2', target: 'screenshot-2'},
          {id: 'e7', source: 'screenshot-2', target: 'stitch-1'},
          {id: 'e8', source: 'stitch-1', target: 'end-1'}
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
    } catch (error) {
      toast.error('Failed to delete workflow');
    }
  };

  const onNodeClick = useCallback((event, node) => {
    setSelectedNodeForDeletion(node);
    setContextMenu(null); // Close context menu on click
    if (node.type !== 'start' && node.type !== 'end') {
      setSelectedNode(node);
      setNodeConfig(node.data || {});
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
  }, []);

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
            onClick={() => {
              setCurrentWorkflow(null);
              setNodes(initialNodes);
              setEdges(initialEdges);
            }}
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
                className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                  currentWorkflow?.id === workflow.id
                    ? 'border-purple-500 bg-purple-500/10'
                    : 'border-gray-700 hover:border-gray-600'
                }`}
                onClick={() => loadWorkflow(workflow)}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{workflow.name}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteWorkflow(workflow.id);
                    }}
                    className="text-red-400 hover:text-red-300"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
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
              onClick={() => addNode('elevenlabs')}
              className="w-full p-2 rounded bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/50 text-xs flex items-center gap-2"
            >
              <Mic className="w-3.5 h-3.5" />
              ElevenLabs
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
    </div>
  );
}
