import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Plus, CheckCircle2, Trash2, Sparkles, AlertCircle, CalendarIcon, Upload, File as FileIcon, X, MessageSquare } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import ReactMarkdown from 'react-markdown';

export default function TasksPage() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [fileDialogOpen, setFileDialogOpen] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [analyzingFile, setAnalyzingFile] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [view, setView] = useState('priority'); // 'priority' or 'calendar'
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    priority: 'medium',
    status: 'todo'
  });

  useEffect(() => {
    fetchTasks();
    fetchFiles();
  }, []);

  const fetchTasks = async () => {
    try {
      const response = await axios.get('/tasks');
      // Sort by priority: high > medium > low, then by created date
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      const sorted = response.data.tasks.sort((a, b) => {
        const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
        if (priorityDiff !== 0) return priorityDiff;
        return new Date(b.created_at) - new Date(a.created_at);
      });
      setTasks(sorted);
    } catch (error) {
      toast.error('Failed to load tasks');
    } finally {
      setLoading(false);
    }
  };

  const fetchFiles = async () => {
    try {
      const response = await axios.get('/files');
      setFiles(response.data.files);
    } catch (error) {
      console.error('Failed to load files:', error);
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setUploadingFile(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      await axios.post('/files/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success('File uploaded successfully!');
      fetchFiles();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to upload file');
    } finally {
      setUploadingFile(false);
    }
  };

  const analyzeFile = async (fileId) => {
    setAnalyzingFile(fileId);
    try {
      const response = await axios.post(`/files/${fileId}/analyze`);
      toast.success('File analyzed successfully!');
      // Update file with analysis
      setFiles(prev => prev.map(f => 
        f.id === fileId ? { ...f, analysis: response.data.analysis } : f
      ));
    } catch (error) {
      toast.error('Failed to analyze file');
    } finally {
      setAnalyzingFile(null);
    }
  };

  const deleteFile = async (fileId) => {
    try {
      await axios.delete(`/files/${fileId}`);
      toast.success('File deleted');
      fetchFiles();
    } catch (error) {
      toast.error('Failed to delete file');
    }
  };

  const generateAITasks = async () => {
    try {
      const response = await axios.post('/tasks/generate');
      toast.success(`Generated ${response.data.tasks.length} AI-powered tasks!`);
      fetchTasks();
    } catch (error) {
      toast.error('Failed to generate AI tasks');
    }
  };

  const createTask = async () => {
    if (!newTask.title.trim()) {
      toast.error('Task title is required');
      return;
    }

    try {
      await axios.post('/tasks', newTask);
      setNewTask({ title: '', description: '', priority: 'medium', status: 'todo' });
      setDialogOpen(false);
      toast.success('Task created successfully!');
      fetchTasks();
    } catch (error) {
      toast.error('Failed to create task');
    }
  };

  const updateTaskStatus = async (taskId, newStatus) => {
    try {
      await axios.patch(`/tasks/${taskId}`, { status: newStatus });
      toast.success('Task updated!');
      fetchTasks();
    } catch (error) {
      toast.error('Failed to update task');
    }
  };

  const deleteTask = async (taskId) => {
    try {
      await axios.delete(`/tasks/${taskId}`);
      toast.success('Task deleted');
      fetchTasks();
    } catch (error) {
      toast.error('Failed to delete task');
    }
  };

  const chatWithAI = async (task) => {
    // Create or get task chat session
    try {
      const message = `Help me complete this task: ${task.title}. ${task.description}. I need to do this fast, efficiently, and cost-effectively.`;
      
      const response = await axios.post('/copilot/chat', {
        message: message,
        task_id: task.id,
        session_id: task.chat_session_id || null
      });

      // Update task with chat session ID
      if (!task.chat_session_id && response.data.session_id) {
        await axios.patch(`/tasks/${task.id}`, {
          chat_session_id: response.data.session_id
        });
      }

      // Navigate to Co-Pilot with session
      localStorage.setItem('copilot_session_id', response.data.session_id);
      navigate('/copilot');
      toast.success('Starting task-focused chat...');
    } catch (error) {
      toast.error('Failed to start chat');
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return 'bg-red-500/10 border-l-4 border-red-500';
      case 'medium': return 'bg-yellow-500/10 border-l-4 border-yellow-500';
      case 'low': return 'bg-green-500/10 border-l-4 border-green-500';
      default: return '';
    }
  };

  const getPriorityBadge = (priority) => {
    const colors = {
      high: 'bg-red-500 text-white',
      medium: 'bg-yellow-500 text-black',
      low: 'bg-green-500 text-white'
    };
    return colors[priority] || '';
  };

  // Show only top 10 tasks in priority view
  const displayedTasks = view === 'priority' ? tasks.filter(t => t.status !== 'completed').slice(0, 10) : tasks;
  const completedTasks = tasks.filter(t => t.status === 'completed');

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[#00d4ff] border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-400">Loading tasks...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="tasks-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold mb-2">Adaptive Task Planner</h1>
          <p className="text-gray-400">AI-powered task management and file analysis</p>
        </div>
        <div className="flex gap-3">
          <Button
            onClick={() => setView(view === 'priority' ? 'calendar' : 'priority')}
            variant="outline"
            className="border-gray-700"
            data-testid="toggle-view-button"
          >
            <CalendarIcon className="w-4 h-4 mr-2" />
            {view === 'priority' ? 'Calendar View' : 'Priority View'}
          </Button>
          <Button
            onClick={() => setFileDialogOpen(true)}
            variant="outline"
            className="border-[#00ff88] text-[#00ff88] hover:bg-[#00ff88]/10"
            data-testid="upload-file-button"
          >
            <Upload className="w-4 h-4 mr-2" />
            Upload Files
          </Button>
          <Button
            onClick={generateAITasks}
            variant="outline"
            className="border-[#00d4ff] text-[#00d4ff] hover:bg-[#00d4ff]/10"
            data-testid="generate-ai-tasks-button"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            Generate AI Tasks
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button 
                className="bg-gradient-to-r from-[#00d4ff] to-[#4785ff] hover:opacity-90"
                data-testid="create-task-button"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Task
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-[#141b3a] border-gray-800">
              <DialogHeader>
                <DialogTitle>Create New Task</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div>
                  <Label htmlFor="title">Task Title</Label>
                  <Input
                    id="title"
                    value={newTask.title}
                    onChange={(e) => setNewTask(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Enter task title"
                    className="bg-[#1a1d2e] border-gray-700 text-white"
                    data-testid="task-title-input"
                  />
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={newTask.description}
                    onChange={(e) => setNewTask(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Task description"
                    className="bg-[#1a1d2e] border-gray-700 text-white min-h-24"
                    data-testid="task-description-input"
                  />
                </div>
                <Button
                  onClick={createTask}
                  className="w-full bg-gradient-to-r from-[#00d4ff] to-[#4785ff] hover:opacity-90"
                  data-testid="submit-task-button"
                >
                  Create Task
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* File Upload Dialog */}
      <Dialog open={fileDialogOpen} onOpenChange={setFileDialogOpen}>
        <DialogContent className="bg-[#141b3a] border-gray-800 max-w-2xl">
          <DialogHeader>
            <DialogTitle>Upload & Analyze Files</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="border-2 border-dashed border-gray-700 rounded-lg p-8 text-center">
              <Upload className="w-12 h-12 mx-auto mb-4 text-gray-500" />
              <p className="text-gray-400 mb-4">Upload spreadsheets, docs, or payment transactions</p>
              <input
                type="file"
                onChange={handleFileUpload}
                className="hidden"
                id="file-upload"
                accept=".csv,.xlsx,.xls,.pdf,.doc,.docx,.txt,.json"
                disabled={uploadingFile}
              />
              <label htmlFor="file-upload">
                <Button
                  as="span"
                  className="bg-gradient-to-r from-[#00d4ff] to-[#4785ff] hover:opacity-90"
                  disabled={uploadingFile}
                >
                  {uploadingFile ? 'Uploading...' : 'Choose File'}
                </Button>
              </label>
            </div>

            {/* Uploaded Files List */}
            {files.length > 0 && (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                <h3 className="font-semibold text-sm text-gray-400">Uploaded Files</h3>
                {files.map((file) => (
                  <div key={file.id} className="glass-morph p-4 rounded-lg">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-3 flex-1">
                        <FileIcon className="w-5 h-5 text-[#00d4ff]" />
                        <div className="flex-1">
                          <p className="font-semibold">{file.filename}</p>
                          <p className="text-xs text-gray-400">
                            {(file.file_size / 1024).toFixed(2)} KB
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => analyzeFile(file.id)}
                          disabled={analyzingFile === file.id}
                          className="bg-[#00d4ff] hover:bg-[#00d4ff]/80"
                        >
                          {analyzingFile === file.id ? 'Analyzing...' : 'Analyze'}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => deleteFile(file.id)}
                          className="border-red-500 text-red-500 hover:bg-red-500/10"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    {file.analysis && (
                      <div className="mt-3 p-3 bg-[#1a1d2e] rounded-lg">
                        <p className="text-xs font-semibold text-[#00d4ff] mb-2">AI Analysis:</p>
                        <div className="text-sm text-gray-300 prose prose-invert prose-sm max-w-none">
                          <ReactMarkdown>{file.analysis}</ReactMarkdown>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* View Toggle & Calendar */}
      {view === 'calendar' && (
        <div className="glass-morph rounded-xl p-6">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={setSelectedDate}
            className="mx-auto"
          />
        </div>
      )}

      {/* Priority View */}
      {view === 'priority' && (
        <div className="space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="stat-card rounded-xl p-4" data-testid="active-tasks-count">
              <p className="text-gray-400 text-sm">Active Tasks</p>
              <p className="text-3xl font-bold">{displayedTasks.length}</p>
              <p className="text-xs text-gray-500 mt-1">Top 10 priority tasks</p>
            </div>
            <div className="stat-card rounded-xl p-4" data-testid="completed-count">
              <p className="text-gray-400 text-sm">Completed</p>
              <p className="text-3xl font-bold text-green-500">{completedTasks.length}</p>
            </div>
            <div className="stat-card rounded-xl p-4" data-testid="files-count">
              <p className="text-gray-400 text-sm">Uploaded Files</p>
              <p className="text-3xl font-bold text-[#00d4ff]">{files.length}</p>
            </div>
          </div>

          {/* Priority Task List */}
          <div className="glass-morph rounded-xl p-6">
            <h3 className="text-xl font-semibold mb-4">Priority Tasks (1-10)</h3>
            <div className="space-y-3">
              {displayedTasks.map((task, index) => (
                <div 
                  key={task.id} 
                  className={`glass-morph rounded-lg p-4 ${getPriorityColor(task.priority)}`}
                  data-testid={`priority-task-${index}`}
                >
                  <div className="flex items-start gap-4">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-[#00d4ff] to-[#4785ff] text-white font-bold text-sm">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-semibold">{task.title}</h4>
                            {task.ai_generated && (
                              <Sparkles className="w-4 h-4 text-[#00d4ff]" title="AI Generated" />
                            )}
                          </div>
                          <p className="text-sm text-gray-400 mb-2">{task.description}</p>
                          {task.deadline && (
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                              <CalendarIcon className="w-3 h-3" />
                              <span>Due: {format(new Date(task.deadline), 'MMM dd, yyyy')}</span>
                            </div>
                          )}
                        </div>
                        <span className={`text-xs px-3 py-1 rounded-full ${getPriorityBadge(task.priority)}`}>
                          {task.priority.toUpperCase()}
                        </span>
                      </div>
                      <div className="flex gap-2 mt-3">
                        <Button
                          size="sm"
                          onClick={() => chatWithAI(task)}
                          className="bg-[#00d4ff] hover:bg-[#00d4ff]/80 text-black flex-1"
                          data-testid={`chat-task-${index}`}
                        >
                          <MessageSquare className="w-4 h-4 mr-1" />
                          Chat with AI
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => updateTaskStatus(task.id, task.status === 'todo' ? 'in_progress' : 'completed')}
                          className="bg-green-500 hover:bg-green-600 text-white"
                          data-testid={`complete-task-${index}`}
                        >
                          <CheckCircle2 className="w-4 h-4 mr-1" />
                          {task.status === 'todo' ? 'Start' : 'Complete'}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => deleteTask(task.id)}
                          className="border-red-500 text-red-500 hover:bg-red-500/10"
                          data-testid={`delete-task-${index}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {displayedTasks.length === 0 && (
              <div className="text-center py-12">
                <AlertCircle className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">No active tasks</h3>
                <p className="text-gray-400 mb-6">Create your first task or let AI generate tasks for you</p>
                <Button
                  onClick={generateAITasks}
                  className="bg-gradient-to-r from-[#00d4ff] to-[#4785ff] hover:opacity-90"
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  Generate AI Tasks
                </Button>
              </div>
            )}
          </div>

          {/* Completed Tasks */}
          {completedTasks.length > 0 && (
            <div className="glass-morph rounded-xl p-6">
              <h3 className="text-xl font-semibold mb-4 text-green-500">Completed Tasks ({completedTasks.length})</h3>
              <div className="space-y-3">
                {completedTasks.slice(0, 5).map((task, index) => (
                  <div key={task.id} className="glass-morph rounded-lg p-4 opacity-60">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1">
                        <CheckCircle2 className="w-5 h-5 text-green-500" />
                        <span className="line-through">{task.title}</span>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => deleteTask(task.id)}
                        className="border-red-500 text-red-500 hover:bg-red-500/10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
