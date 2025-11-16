import React, { useState, useCallback, useEffect } from 'react';
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Play, Save, Plus, Trash2, Workflow, Zap, Database, Globe, MessageSquare, Mic, Send, Video, Image, CheckSquare, Settings, X } from 'lucide-react';

// Custom Node Components
const StartNode = ({ data }) => {
  return (
    <div className="px-4 py-3 rounded-lg border-2 border-green-500 bg-green-500/10 backdrop-blur-sm">
      <div className="flex items-center gap-2">
        <Zap className="w-4 h-4 text-green-500" />
        <div className="font-semibold text-white">Start</div>
      </div>
      <div className="text-xs text-gray-400 mt-1">Workflow begins here</div>
    </div>
  );
};

const GeminiNode = ({ data }) => {
  return (
    <div className="px-4 py-3 rounded-lg border-2 border-purple-500 bg-purple-500/10 backdrop-blur-sm min-w-[200px]">
      <div className="flex items-center gap-2">
        <MessageSquare className="w-4 h-4 text-purple-500" />
        <div className="font-semibold text-white">AI Chat (Gemini)</div>
      </div>
      <div className="text-xs text-gray-400 mt-1">Prompt: {data.prompt || 'Not configured'}</div>
    </div>
  );
};

const HttpNode = ({ data }) => {
  return (
    <div className="px-4 py-3 rounded-lg border-2 border-blue-500 bg-blue-500/10 backdrop-blur-sm min-w-[200px]">
      <div className="flex items-center gap-2">
        <Globe className="w-4 h-4 text-blue-500" />
        <div className="font-semibold text-white">HTTP Request</div>
      </div>
      <div className="text-xs text-gray-400 mt-1">
        {data.method || 'GET'} {data.url || 'Not configured'}
      </div>
    </div>
  );
};

const DatabaseNode = ({ data }) => {
  return (
    <div className="px-4 py-3 rounded-lg border-2 border-cyan-500 bg-cyan-500/10 backdrop-blur-sm min-w-[200px]">
      <div className="flex items-center gap-2">
        <Database className="w-4 h-4 text-cyan-500" />
        <div className="font-semibold text-white">Database Read</div>
      </div>
      <div className="text-xs text-gray-400 mt-1">
        Collection: {data.collection || 'Not configured'}
      </div>
    </div>
  );
};

const EndNode = ({ data }) => {
  return (
    <div className="px-4 py-3 rounded-lg border-2 border-red-500 bg-red-500/10 backdrop-blur-sm">
      <div className="flex items-center gap-2">
        <Zap className="w-4 h-4 text-red-500" />
        <div className="font-semibold text-white">End</div>
      </div>
      <div className="text-xs text-gray-400 mt-1">Workflow completes</div>
    </div>
  );
};

const nodeTypes = {
  start: StartNode,
  gemini: GeminiNode,
  http: HttpNode,
  database: DatabaseNode,
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

  const executeWorkflow = async () => {
    if (!currentWorkflow?.id) {
      toast.error('Please save the workflow first');
      return;
    }

    setExecuting(true);
    try {
      const response = await axios.post(`/workflows/${currentWorkflow.id}/execute`);
      toast.success('Workflow executed successfully');
      console.log('Workflow result:', response.data);
    } catch (error) {
      toast.error('Workflow execution failed');
      console.error(error);
    } finally {
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
            onClick={saveWorkflow}
            className="bg-green-600 hover:bg-green-700"
            size="sm"
          >
            <Save className="w-4 h-4 mr-2" />
            Save Workflow
          </Button>
          <Button
            onClick={executeWorkflow}
            disabled={executing || !currentWorkflow}
            className="bg-gradient-to-r from-purple-500 to-pink-500 hover:opacity-90"
            size="sm"
          >
            <Play className="w-4 h-4 mr-2" />
            {executing ? 'Executing...' : 'Execute'}
          </Button>
        </div>
      </div>

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
        <div className="w-48 border-r border-gray-800 p-4">
          <h3 className="text-sm font-semibold mb-3 text-gray-400">NODE PALETTE</h3>
          <div className="space-y-2">
            <button
              onClick={() => addNode('gemini')}
              className="w-full p-2 rounded bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/50 text-sm flex items-center gap-2"
            >
              <MessageSquare className="w-4 h-4" />
              AI Chat
            </button>
            <button
              onClick={() => addNode('http')}
              className="w-full p-2 rounded bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/50 text-sm flex items-center gap-2"
            >
              <Globe className="w-4 h-4" />
              HTTP Request
            </button>
            <button
              onClick={() => addNode('database')}
              className="w-full p-2 rounded bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/50 text-sm flex items-center gap-2"
            >
              <Database className="w-4 h-4" />
              Database
            </button>
            <button
              onClick={() => addNode('end')}
              className="w-full p-2 rounded bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 text-sm flex items-center gap-2"
            >
              <Zap className="w-4 h-4" />
              End
            </button>
          </div>
        </div>

        {/* Canvas */}
        <div className="flex-1" style={{ height: 'calc(100vh - 73px)' }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            fitView
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
        </div>
      </div>
    </div>
  );
}
