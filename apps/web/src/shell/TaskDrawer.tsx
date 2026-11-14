import { useState, useEffect, type FormEvent } from 'react';
import { 
  X, Check, Plus, Clock, Phone, FileText, Calendar, 
  ChevronDown, ChevronUp, Trash2, AlertCircle, ChevronLeft, ChevronRight 
} from 'lucide-react';
import { toast } from '../ui';

export interface Task {
  id: string;
  title: string;
  dueCategory: 'today' | 'upcoming';
  dueTime: string;
  iconType: 'phone' | 'document' | 'clock' | 'calendar';
  completed: boolean;
  contact?: string;
  company?: string;
  priority: 'high' | 'medium' | 'normal';
  notes?: string;
  completedAt?: string;
}

const DEFAULT_TASKS: Task[] = [
  {
    id: 'task-1',
    title: 'Call Fatima Khan',
    dueCategory: 'today',
    dueTime: '5:30 PM',
    iconType: 'phone',
    completed: false,
    contact: 'Fatima Khan',
    company: 'Khan Enterprises',
    priority: 'high',
    notes: 'Discuss quotation QT/26-27/0004 for 10 units enterprise license and finalize delivery timeline.',
  },
  {
    id: 'task-2',
    title: 'Send revised quotation',
    dueCategory: 'today',
    dueTime: '6:00 PM',
    iconType: 'document',
    completed: false,
    contact: 'Iyer Consultancy',
    company: 'Iyer & Associates',
    priority: 'medium',
    notes: 'Include 5% volume discount for annual advance payment term.',
  },
  {
    id: 'task-3',
    title: 'Follow up with Iyer Consultancy',
    dueCategory: 'today',
    dueTime: '7:00 PM',
    iconType: 'clock',
    completed: false,
    contact: 'Mr. Subramanian Iyer',
    company: 'Iyer Consultancy',
    priority: 'normal',
    notes: 'Check if purchase committee approval was received.',
  },
  {
    id: 'task-4',
    title: 'Product demo with Apex Global',
    dueCategory: 'upcoming',
    dueTime: 'Tomorrow, 11:00 AM',
    iconType: 'calendar',
    completed: false,
    contact: 'Rajesh Verma',
    company: 'Apex Global Logistics',
    priority: 'high',
    notes: 'Walk through customized sales pipeline and quotation approval hierarchy.',
  },
  {
    id: 'task-5',
    title: 'Review monthly billing pipeline',
    dueCategory: 'upcoming',
    dueTime: 'Thu, 2:00 PM',
    iconType: 'document',
    completed: false,
    contact: 'Accounts Team',
    priority: 'medium',
    notes: 'Reconcile collected amounts against month target.',
  },
  {
    id: 'task-6',
    title: 'Contract sign-off with Nair Foods',
    dueCategory: 'upcoming',
    dueTime: 'Fri, 4:30 PM',
    iconType: 'document',
    completed: false,
    contact: 'Anand Nair',
    company: 'Nair Foods Pvt Ltd',
    priority: 'high',
    notes: 'Execute service level agreement for annual maintenance.',
  },
  {
    id: 'task-7',
    title: 'Client onboarding call with Deepa Reddy',
    dueCategory: 'today',
    dueTime: 'Yesterday, 3:00 PM',
    iconType: 'phone',
    completed: true,
    contact: 'Deepa Reddy',
    company: 'Reddy Tech',
    priority: 'normal',
    notes: 'Completed initial workspace walkthrough and assigned customer success manager.',
    completedAt: 'Yesterday',
  },
];

interface TaskDrawerProps {
  open: boolean;
  onClose: () => void;
  onToggle: () => void;
}

export function TaskDrawer({ open, onClose, onToggle }: TaskDrawerProps) {
  const [tasks, setTasks] = useState<Task[]>(() => {
    try {
      const saved = localStorage.getItem('salesphere_tasks');
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return DEFAULT_TASKS;
  });

  const [activeTab, setActiveTab] = useState<'today' | 'upcoming' | 'completed'>('today');
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  // New task form state
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState<'today' | 'upcoming'>('today');
  const [newTime, setNewTime] = useState('');
  const [newContact, setNewContact] = useState('');
  const [newPriority, setNewPriority] = useState<'high' | 'medium' | 'normal'>('normal');
  const [newNotes, setNewNotes] = useState('');

  useEffect(() => {
    try {
      localStorage.setItem('salesphere_tasks', JSON.stringify(tasks));
    } catch {
      // ignore
    }
  }, [tasks]);

  const todayCount = tasks.filter((t) => !t.completed && t.dueCategory === 'today').length;
  const upcomingCount = tasks.filter((t) => !t.completed && t.dueCategory === 'upcoming').length;
  const completedCount = tasks.filter((t) => t.completed).length;

  const currentTasks = tasks.filter((t) => {
    if (activeTab === 'today') return !t.completed && t.dueCategory === 'today';
    if (activeTab === 'upcoming') return !t.completed && t.dueCategory === 'upcoming';
    return t.completed;
  });

  const toggleTask = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === id) {
          const next = !t.completed;
          toast(next ? `Completed: "${t.title}"` : `Reopened: "${t.title}"`);
          return {
            ...t,
            completed: next,
            completedAt: next ? new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : undefined,
          };
        }
        return t;
      })
    );
  };

  const handleAddTask = (e: FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const newTask: Task = {
      id: `task-${Date.now()}`,
      title: newTitle.trim(),
      dueCategory: newCategory,
      dueTime: newTime.trim() || (newCategory === 'today' ? '5:00 PM' : 'Tomorrow, 10:00 AM'),
      iconType: 'clock',
      completed: false,
      contact: newContact.trim() || undefined,
      priority: newPriority,
      notes: newNotes.trim() || undefined,
    };

    setTasks((prev) => [newTask, ...prev]);
    setIsAdding(false);
    setNewTitle('');
    setNewTime('');
    setNewContact('');
    setNewNotes('');
    setNewPriority('normal');
    setActiveTab(newCategory);
    toast(`Task created: "${newTask.title}"`);
  };

  const deleteTask = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setTasks((prev) => prev.filter((t) => t.id !== id));
    toast('Task removed');
  };

  const getTaskIcon = (iconType: string) => {
    switch (iconType) {
      case 'phone':
        return <Phone size={13} className="text-slate-400" aria-hidden />;
      case 'document':
        return <FileText size={13} className="text-slate-400" aria-hidden />;
      case 'calendar':
        return <Calendar size={13} className="text-slate-400" aria-hidden />;
      default:
        return <Clock size={13} className="text-slate-400" aria-hidden />;
    }
  };

  return (
    <aside
      className={`relative z-20 flex flex-col bg-white border-l border-slate-200 transition-all duration-300 ease-in-out shrink-0 select-none ${
        open ? 'w-80 xl:w-[340px]' : 'w-0 border-l-0 overflow-hidden'
      }`}
      aria-label="Tasks panel"
    >
      {/* Floating edge toggle handle on divider */}
      {!open && (
        <button
          onClick={onToggle}
          className="fixed right-0 top-1/2 -translate-y-1/2 z-30 flex flex-col items-center gap-1.5 px-1.5 py-3 bg-white border-l border-y border-slate-200/90 rounded-l-2xl shadow-md text-slate-500 hover:text-indigo-600 hover:bg-indigo-50/50 transition-all focus:outline-none group"
          title="Open My Tasks"
          aria-label="Open tasks drawer"
        >
          <ChevronLeft size={15} className="group-hover:-translate-x-0.5 transition-transform" />
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-[10px] text-white font-bold shadow-xs">
            {todayCount}
          </span>
        </button>
      )}

      {/* Drawer Container (fixed width inside to prevent layout distortion during animation) */}
      <div className="w-80 xl:w-[340px] flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-900 tracking-tight">My Tasks</h2>
            <span className="flex items-center justify-center px-2 py-0.5 text-xs font-semibold rounded-full bg-blue-50 text-blue-700">
              {todayCount} today
            </span>
          </div>
          <button
            onClick={onClose}
            className="flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            aria-label="Close task drawer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center border-b border-slate-100 px-4 pt-1 gap-2 text-xs font-medium">
          <button
            onClick={() => setActiveTab('today')}
            className={`pb-2.5 px-2 border-b-2 transition-colors relative flex items-center gap-1.5 ${
              activeTab === 'today'
                ? 'border-indigo-600 text-indigo-600 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Today
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                activeTab === 'today' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {todayCount}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('upcoming')}
            className={`pb-2.5 px-2 border-b-2 transition-colors relative flex items-center gap-1.5 ${
              activeTab === 'upcoming'
                ? 'border-indigo-600 text-indigo-600 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Upcoming
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                activeTab === 'upcoming' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {upcomingCount}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('completed')}
            className={`pb-2.5 px-2 border-b-2 transition-colors relative flex items-center gap-1.5 ${
              activeTab === 'completed'
                ? 'border-indigo-600 text-indigo-600 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Completed
            {completedCount > 0 && (
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                  activeTab === 'completed' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {completedCount}
              </span>
            )}
          </button>
        </div>

        {/* Task List */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5">
          {currentTasks.length === 0 ? (
            <div className="py-12 px-4 text-center">
              <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center mb-2">
                <Check size={18} />
              </div>
              <p className="text-sm font-medium text-slate-700">No {activeTab} tasks</p>
              <p className="text-xs text-slate-400 mt-1">
                {activeTab === 'completed'
                  ? 'Tasks you complete will show up here.'
                  : 'You are all caught up! Add a new task below.'}
              </p>
            </div>
          ) : (
            currentTasks.map((t) => {
              const isExpanded = expandedTaskId === t.id;
              return (
                <div
                  key={t.id}
                  onClick={() => setExpandedTaskId(isExpanded ? null : t.id)}
                  className={`group rounded-xl border transition-all duration-150 cursor-pointer ${
                    t.completed
                      ? 'bg-slate-50/70 border-slate-200/60 opacity-80'
                      : isExpanded
                      ? 'bg-white border-indigo-200 shadow-sm ring-1 ring-indigo-500/10'
                      : 'bg-white border-slate-200/80 hover:border-slate-300 hover:shadow-sm'
                  }`}
                >
                  <div className="p-3 flex items-start gap-3">
                    {/* Completion Checkbox */}
                    <button
                      type="button"
                      onClick={(e) => toggleTask(t.id, e)}
                      className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                        t.completed
                          ? 'border-indigo-600 bg-indigo-600 text-white'
                          : 'border-slate-300 bg-white hover:border-indigo-500'
                      }`}
                      aria-label={t.completed ? 'Mark incomplete' : 'Mark complete'}
                    >
                      {t.completed && <Check size={12} strokeWidth={3} />}
                    </button>

                    {/* Task Content */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <p
                          className={`text-xs font-semibold leading-snug truncate ${
                            t.completed ? 'text-slate-400 line-through' : 'text-slate-800'
                          }`}
                        >
                          {t.title}
                        </p>
                        <span className="text-slate-300 hover:text-slate-500">
                          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </span>
                      </div>

                      {/* Sub-row: Time & Meta */}
                      <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-500">
                        <span className="flex items-center gap-1 text-slate-500">
                          {getTaskIcon(t.iconType)}
                          <span>{t.dueTime}</span>
                        </span>

                        {t.priority === 'high' && !t.completed && (
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-rose-50 text-rose-600">
                            High
                          </span>
                        )}
                        {t.priority === 'medium' && !t.completed && (
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-amber-50 text-amber-600">
                            Medium
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Expandable Details */}
                  {isExpanded && (
                    <div
                      className="px-3 pb-3 pt-1 border-t border-slate-100 text-xs text-slate-600 space-y-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {t.contact && (
                        <div className="flex items-center gap-1.5 text-slate-600">
                          <span className="text-slate-400 font-medium">Contact:</span>
                          <span className="font-semibold text-slate-800">{t.contact}</span>
                          {t.company && <span className="text-slate-400">({t.company})</span>}
                        </div>
                      )}

                      {t.notes && (
                        <div className="p-2 rounded bg-slate-50 border border-slate-100 text-slate-600 text-[11px] leading-relaxed">
                          {t.notes}
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-1">
                        <button
                          type="button"
                          onClick={(e) => toggleTask(t.id, e)}
                          className={`text-xs font-medium px-2 py-1 rounded transition-colors ${
                            t.completed
                              ? 'text-slate-600 hover:bg-slate-100'
                              : 'text-indigo-600 hover:bg-indigo-50'
                          }`}
                        >
                          {t.completed ? 'Reopen task' : 'Mark as done'}
                        </button>
                        <button
                          type="button"
                          onClick={(e) => deleteTask(t.id, e)}
                          className="text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2 py-1 rounded flex items-center gap-1"
                        >
                          <Trash2 size={12} />
                          Delete
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}

          {/* Add Task Form (inline when active) */}
          {isAdding && (
            <form
              onSubmit={handleAddTask}
              className="mt-3 p-3.5 rounded-xl border border-indigo-200 bg-indigo-50/30 space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900">New Task</span>
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X size={14} />
                </button>
              </div>

              <div>
                <input
                  type="text"
                  autoFocus
                  placeholder="Task title (e.g. Call client)"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Bucket</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as 'today' | 'upcoming')}
                    className="w-full px-2 py-1.5 text-xs rounded-lg border border-slate-300 bg-white focus:outline-none"
                  >
                    <option value="today">Today</option>
                    <option value="upcoming">Upcoming</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Time / Due</label>
                  <input
                    type="text"
                    placeholder="e.g. 5:30 PM"
                    value={newTime}
                    onChange={(e) => setNewTime(e.target.value)}
                    className="w-full px-2 py-1.5 text-xs rounded-lg border border-slate-300 bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Contact</label>
                  <input
                    type="text"
                    placeholder="e.g. Fatima Khan"
                    value={newContact}
                    onChange={(e) => setNewContact(e.target.value)}
                    className="w-full px-2 py-1.5 text-xs rounded-lg border border-slate-300 bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Priority</label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value as 'high' | 'medium' | 'normal')}
                    className="w-full px-2 py-1.5 text-xs rounded-lg border border-slate-300 bg-white focus:outline-none"
                  >
                    <option value="normal">Normal</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>

              <div>
                <textarea
                  placeholder="Notes or agenda details (optional)"
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white focus:outline-none"
                  rows={2}
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 text-xs font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 shadow-sm transition-colors"
                >
                  Save Task
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer Add Task Button */}
        <div className="p-3 border-t border-slate-100">
          <button
            onClick={() => {
              setIsAdding(true);
              setNewCategory(activeTab === 'completed' ? 'today' : activeTab);
            }}
            className="w-full py-2 px-3 flex items-center justify-center gap-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50/60 hover:bg-indigo-100/70 rounded-xl transition-colors"
          >
            <Plus size={15} />
            <span>Add Task</span>
          </button>
        </div>
      </div>
    </aside>
  );
}

