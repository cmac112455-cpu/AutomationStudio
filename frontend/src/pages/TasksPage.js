import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, CheckCircle2, Circle, Clock, Trash2, Sparkles, AlertCircle } from 'lucide-react';

export default function TasksPage() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    priority: 'medium',
    status: 'todo'
  });

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    try {
      const response = await axios.get('/tasks');
      setTasks(response.data.tasks);
    } catch (error) {
      toast.error('Failed to load tasks');
    } finally {
      setLoading(false);
    }
  };

  const generateAITasks = async () => {
    try {
      const response = await axios.post('/tasks/generate');
      setTasks(prev => [...response.data.tasks, ...prev]);
      toast.success(`Generated ${response.data.tasks.length} AI-powered tasks!`);
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
      const response = await axios.post('/tasks', newTask);
      setTasks(prev => [response.data, ...prev]);
      setNewTask({ title: '', description: '', priority: 'medium', status: 'todo' });
      setDialogOpen(false);
      toast.success('Task created successfully!');
    } catch (error) {
      toast.error('Failed to create task');
    }
  };

  const updateTaskStatus = async (taskId, newStatus) => {
    try {
      const response = await axios.patch(`/tasks/${taskId}`, { status: newStatus });
      setTasks(prev => prev.map(task => task.id === taskId ? response.data : task));
      toast.success('Task updated!');
    } catch (error) {
      toast.error('Failed to update task');
    }
  };

  const deleteTask = async (taskId) => {
    try {
      await axios.delete(`/tasks/${taskId}`);
      setTasks(prev => prev.filter(task => task.id !== taskId));
      toast.success('Task deleted');
    } catch (error) {
      toast.error('Failed to delete task');
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return 'priority-high';
      case 'medium': return 'priority-medium';
      case 'low': return 'priority-low';
      default: return '';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed': return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case 'in_progress': return <Clock className="w-5 h-5 text-blue-500" />;
      default: return <Circle className="w-5 h-5 text-gray-500" />;
    }
  };

  const todoTasks = tasks.filter(t => t.status === 'todo');
  const inProgressTasks = tasks.filter(t => t.status === 'in_progress');
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
          <p className="text-gray-400">AI-powered task management and prioritization</p>
        </div>
        <div className="flex gap-3">
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
                <div>
                  <Label htmlFor="priority">Priority</Label>
                  <Select value={newTask.priority} onValueChange={(value) => setNewTask(prev => ({ ...prev, priority: value }))}>
                    <SelectTrigger className="bg-[#1a1d2e] border-gray-700 text-white" data-testid="priority-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#1a1d2e] border-gray-800">
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>
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

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="stat-card rounded-xl p-4" data-testid="todo-count">
          <p className="text-gray-400 text-sm">To Do</p>
          <p className="text-3xl font-bold">{todoTasks.length}</p>
        </div>
        <div className="stat-card rounded-xl p-4" data-testid="in-progress-count">
          <p className="text-gray-400 text-sm">In Progress</p>
          <p className="text-3xl font-bold text-[#4785ff]">{inProgressTasks.length}</p>
        </div>
        <div className="stat-card rounded-xl p-4" data-testid="completed-count">
          <p className="text-gray-400 text-sm">Completed</p>
          <p className="text-3xl font-bold text-green-500">{completedTasks.length}</p>
        </div>
      </div>

      {/* Tasks Board */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* To Do Column */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-4">
            <Circle className="w-5 h-5 text-gray-500" />
            <h3 className="text-xl font-semibold">To Do</h3>
            <span className="text-sm text-gray-500">({todoTasks.length})</span>
          </div>
          <div className="space-y-3">
            {todoTasks.map((task, index) => (
              <div key={task.id} className={`glass-morph rounded-lg p-4 ${getPriorityColor(task.priority)}`} data-testid={`task-todo-${index}`}>
                <div className="flex items-start justify-between mb-2">
                  <h4 className="font-semibold flex-1">{task.title}</h4>
                  {task.ai_generated && (
                    <Sparkles className="w-4 h-4 text-[#00d4ff] flex-shrink-0" title="AI Generated" />
                  )}
                </div>
                <p className="text-sm text-gray-400 mb-3">{task.description}</p>
                <div className="flex items-center justify-between">
                  <span className="text-xs px-2 py-1 rounded-full bg-gray-700 text-gray-300">{task.priority}</span>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-blue-500 text-blue-500 hover:bg-blue-500/10"
                      onClick={() => updateTaskStatus(task.id, 'in_progress')}
                      data-testid={`start-task-${index}`}
                    >
                      Start
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-red-500 text-red-500 hover:bg-red-500/10"
                      onClick={() => deleteTask(task.id)}
                      data-testid={`delete-task-${index}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* In Progress Column */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-5 h-5 text-blue-500" />
            <h3 className="text-xl font-semibold">In Progress</h3>
            <span className="text-sm text-gray-500">({inProgressTasks.length})</span>
          </div>
          <div className="space-y-3">
            {inProgressTasks.map((task, index) => (
              <div key={task.id} className={`glass-morph rounded-lg p-4 ${getPriorityColor(task.priority)}`} data-testid={`task-inprogress-${index}`}>
                <div className="flex items-start justify-between mb-2">
                  <h4 className="font-semibold flex-1">{task.title}</h4>
                  {task.ai_generated && (
                    <Sparkles className="w-4 h-4 text-[#00d4ff] flex-shrink-0" title="AI Generated" />
                  )}
                </div>
                <p className="text-sm text-gray-400 mb-3">{task.description}</p>
                <div className="flex items-center justify-between">
                  <span className="text-xs px-2 py-1 rounded-full bg-blue-700 text-blue-300">{task.priority}</span>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-green-500 text-green-500 hover:bg-green-500/10"
                      onClick={() => updateTaskStatus(task.id, 'completed')}
                      data-testid={`complete-task-${index}`}
                    >
                      Complete
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-red-500 text-red-500 hover:bg-red-500/10"
                      onClick={() => deleteTask(task.id)}
                      data-testid={`delete-inprogress-task-${index}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Completed Column */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle2 className="w-5 h-5 text-green-500" />
            <h3 className="text-xl font-semibold">Completed</h3>
            <span className="text-sm text-gray-500">({completedTasks.length})</span>
          </div>
          <div className="space-y-3">
            {completedTasks.map((task, index) => (
              <div key={task.id} className="glass-morph rounded-lg p-4 opacity-70" data-testid={`task-completed-${index}`}>
                <div className="flex items-start justify-between mb-2">
                  <h4 className="font-semibold flex-1 line-through">{task.title}</h4>
                  {task.ai_generated && (
                    <Sparkles className="w-4 h-4 text-[#00d4ff] flex-shrink-0" title="AI Generated" />
                  )}
                </div>
                <p className="text-sm text-gray-400 mb-3">{task.description}</p>
                <div className="flex items-center justify-between">
                  <span className="text-xs px-2 py-1 rounded-full bg-green-700 text-green-300">Done</span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-red-500 text-red-500 hover:bg-red-500/10"
                    onClick={() => deleteTask(task.id)}
                    data-testid={`delete-completed-task-${index}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {tasks.length === 0 && (
        <div className="glass-morph rounded-2xl p-12 text-center">
          <AlertCircle className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold mb-2">No tasks yet</h3>
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
  );
}
