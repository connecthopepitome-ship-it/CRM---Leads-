import { useState, useEffect, type FormEvent } from 'react';
import { 
  X, Check, Plus, Clock, Phone, FileText, Calendar, 
  ChevronDown, ChevronUp, Trash2, AlertCircle, ChevronLeft, ChevronRight, CheckSquare 
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
    title: 'Follow up with Fatima Khan',
    dueCategory: 'today',
    dueTime: '10:00 AM',
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
    dueTime: '11:30 AM',
    iconType: 'document',
    completed: false,
    contact: 'Iyer Consultancy',
    company: 'Iyer & Associates',
    priority: 'medium',
    notes: 'Include 5% volume discount for annual advance payment term.',
  },
  {
    id: 'task-3',
    title: 'Call Iyer Consultancy',
    dueCategory: 'today',
    dueTime: '04:00 PM',
    iconType: 'phone',
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
    notes: 'Welcome kickoff meeting conducted successfully.',
    completedAt: '3:45 PM',
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
      const saved = localStorage.getItem('ss_tasks');
      return saved ? JSON.parse(saved) : DEFAULT_TASKS;
    } catch {
      return DEFAULT_TASKS;
    }
  });

  const [activeTab, setActiveTab] = useState<'today' | 'upcoming' | 'completed'>('today');
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);

  // Add Task form state
  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newTime, setNewTime] = useState('');
  const [newContact, setNewContact] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [newPriority, setNewPriority] = useState<'high' | 'medium' | 'normal'>('normal');
  const [newCategory, setNewCategory] = useState<'today' | 'upcoming'>('today');

  // Persist tasks in localStorage
  useEffect(() => {
    try {
      localStorage.setItem('ss_tasks', JSON.stringify(tasks));
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
          toast(next ? `Done: "${t.title}"` : `Reopened: "${t.title}"`);
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

  return (
    <aside
      className={`relative z-20 flex flex-col glass-dark-drawer text-white transition-all duration-300 ease-in-out shrink-0 select-none ${
        open ? 'w-80 xl:w-[320px]' : 'w-0 border-l-0 overflow-hidden'
      }`}
      aria-label="Tasks panel"
    >
      {/* Floating edge toggle handle when closed */}
      {!open && (
        <button
          onClick={onToggle}
          className="fixed right-0 top-1/2 -translate-y-1/2 z-30 flex flex-col items-center gap-1.5 px-2 py-3 bg-[#203923]/90 backdrop-blur-xl border-l border-y border-white/20 rounded-l-2xl shadow-2xl text-emerald-200 hover:text-white hover:bg-[#28492C] transition-all focus:outline-none group interactive-tile"
          title="Open My Tasks"
          aria-label="Open tasks drawer"
        >
          <ChevronLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#3D7952] text-[10px] text-white font-bold shadow-xs group-hover:scale-110 transition-transform">
            {todayCount}
          </span>
        </button>
      )}

      {/* Drawer Container (fixed width inside) */}
      <div className="w-80 xl:w-[320px] flex flex-col h-full overflow-hidden">
        {/* Header (Grovia dark forest green) */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-white tracking-tight hover-text-glow">My Tasks</h2>
            <span className="flex items-center justify-center px-2 py-0.5 text-xs font-semibold rounded-full bg-[#2E4E36] text-emerald-200 glass-badge">
              {todayCount}
            </span>
          </div>
          <button
            onClick={onClose}
            className="flex items-center justify-center w-7 h-7 rounded-lg text-emerald-300 hover:text-white hover:bg-[#28492C] transition-colors btn-spring"
            aria-label="Close task drawer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Tabs: Today (3) | Upcoming (5) | Done */}
        <div className="flex items-center border-b border-white/10 px-4 pt-1 gap-2 text-xs font-medium">
          <button
            onClick={() => setActiveTab('today')}
            className={`pb-2.5 px-2 border-b-2 transition-all relative flex items-center gap-1.5 btn-spring ${
              activeTab === 'today'
                ? 'border-emerald-400 text-white font-bold'
                : 'border-transparent text-emerald-300/70 hover:text-white hover:border-white/20'
            }`}
          >
            <span className="hover-text-lift">Today ({todayCount})</span>
          </button>

          <button
            onClick={() => setActiveTab('upcoming')}
            className={`pb-2.5 px-2 border-b-2 transition-all relative flex items-center gap-1.5 btn-spring ${
              activeTab === 'upcoming'
                ? 'border-emerald-400 text-white font-bold'
                : 'border-transparent text-emerald-300/70 hover:text-white hover:border-white/20'
            }`}
          >
            <span className="hover-text-lift">Upcoming ({upcomingCount})</span>
          </button>

          <button
            onClick={() => setActiveTab('completed')}
            className={`pb-2.5 px-2 border-b-2 transition-all relative flex items-center gap-1.5 btn-spring ${
              activeTab === 'completed'
                ? 'border-emerald-400 text-white font-bold'
                : 'border-transparent text-emerald-300/70 hover:text-white hover:border-white/20'
            }`}
          >
            <span className="hover-text-lift">Done ({completedCount})</span>
          </button>
        </div>

        {/* Tasks List Content */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 scrollbar-thin scrollbar-thumb-[#2E4E36]">
          {currentTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-center px-4">
              <CheckSquare size={32} className="text-emerald-500/40 mb-2" />
              <p className="text-xs font-semibold text-emerald-200">No {activeTab} tasks</p>
              <p className="text-[11px] text-emerald-300/60 mt-0.5">
                {activeTab === 'completed'
                  ? 'Completed tasks will be recorded here.'
                  : 'You have cleared all pending tasks in this list.'}
              </p>
            </div>
          ) : (
            currentTasks.map((task) => {
              const isExpanded = expandedTaskId === task.id;

              return (
                <div
                  key={task.id}
                  onClick={() => setExpandedTaskId(isExpanded ? null : task.id)}
                  className={`group rounded-xl p-3 transition-all cursor-pointer border interactive-tile ${
                    task.completed
                      ? 'bg-[#1C321F]/60 border-white/10 opacity-70'
                      : isExpanded
                      ? 'bg-[#28492C]/90 border-emerald-400/50 shadow-lg'
                      : 'bg-[#1C321F]/80 border-white/10 hover:bg-[#28492C]/90 hover:border-emerald-400/30'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* Completion Checkbox */}
                    <button
                      type="button"
                      onClick={(e) => toggleTask(task.id, e)}
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border mt-0.5 transition-all btn-spring ${
                        task.completed
                          ? 'border-emerald-400 bg-emerald-500 text-white'
                          : 'border-emerald-400/60 bg-transparent hover:border-emerald-300 hover:scale-110'
                      }`}
                      aria-label={task.completed ? 'Mark incomplete' : 'Mark completed'}
                    >
                      {task.completed && <Check size={11} strokeWidth={3} />}
                    </button>

                    {/* Task Content */}
                    <div className="min-w-0 flex-1">
                      <p
                        className={`text-xs font-medium leading-snug transition-transform group-hover:translate-x-1 ${
                          task.completed ? 'line-through text-emerald-300/60' : 'text-white group-hover:text-emerald-100'
                        }`}
                      >
                        {task.title}
                      </p>

                      <div className="mt-1 flex items-center gap-2 text-[11px] text-emerald-300/80">
                        <span className="flex items-center gap-1 font-mono text-[10px]">
                          <Clock size={11} className="text-emerald-400" />
                          {task.dueTime}
                        </span>
                        {task.contact && (
                          <span className="truncate max-w-[120px] rounded-xs bg-[#2E4E36]/80 px-1.5 py-0.2 text-[10px] text-emerald-200 glass-badge">
                            {task.contact}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Expanded Task Notes & Details */}
                  {isExpanded && (
                    <div className="mt-3 pt-2.5 border-t border-[#2E4E36] text-xs space-y-2 animate-in fade-in duration-150">
                      {task.notes && (
                        <p className="text-[11px] text-emerald-200/90 leading-relaxed bg-[#192E1C] p-2 rounded-lg border border-[#2E4E36]">
                          {task.notes}
                        </p>
                      )}

                      <div className="flex items-center justify-between text-[11px] text-emerald-300/70 pt-1">
                        <span>Company: {task.company || '—'}</span>
                        <button
                          type="button"
                          onClick={(e) => deleteTask(task.id, e)}
                          className="flex items-center gap-1 text-rose-300 hover:text-rose-200 text-[10px] transition-colors"
                        >
                          <Trash2 size={11} />
                          Delete
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}

          {/* Inline Add Task Form */}
          {isAdding && (
            <form onSubmit={handleAddTask} className="rounded-xl border border-emerald-500/60 bg-[#1C321F] p-3 text-xs space-y-2.5 shadow-md">
              <span className="block font-bold text-emerald-200 text-[11px]">New Task</span>
              <input
                type="text"
                required
                placeholder="What needs to be done?"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="w-full rounded-lg border border-[#2E4E36] bg-[#122314] px-2.5 py-1.5 text-xs text-white placeholder-emerald-400/50 focus:border-emerald-400 focus:outline-none"
                autoFocus
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="e.g. 5:30 PM"
                  value={newTime}
                  onChange={(e) => setNewTime(e.target.value)}
                  className="rounded-lg border border-[#2E4E36] bg-[#122314] px-2 py-1 text-xs text-white placeholder-emerald-400/50 focus:border-emerald-400 focus:outline-none"
                />
                <input
                  type="text"
                  placeholder="Customer name"
                  value={newContact}
                  onChange={(e) => setNewContact(e.target.value)}
                  className="rounded-lg border border-[#2E4E36] bg-[#122314] px-2 py-1 text-xs text-white placeholder-emerald-400/50 focus:border-emerald-400 focus:outline-none"
                />
              </div>
              <textarea
                placeholder="Notes or agenda..."
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                className="w-full rounded-lg border border-[#2E4E36] bg-[#122314] px-2.5 py-1 text-xs text-white placeholder-emerald-400/50 focus:border-emerald-400 focus:outline-none"
                rows={2}
              />
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="rounded-lg px-2.5 py-1 text-[11px] text-emerald-300 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-[#3D7952] px-3 py-1 text-[11px] font-bold text-white hover:bg-emerald-600 shadow-xs"
                >
                  Save Task
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer: + Add Task Button */}
        <div className="p-3 border-t border-[#2E4E36] bg-[#1A301D]">
          {!isAdding ? (
            <button
              onClick={() => setIsAdding(true)}
              className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-[#2E4E36] py-2 text-xs font-semibold text-emerald-200 hover:text-white hover:border-emerald-400 hover:bg-[#203923] transition-all"
            >
              <Plus size={14} />
              <span>Add Task</span>
            </button>
          ) : (
            <div className="text-[11px] text-center text-emerald-400 font-medium">
              Editing new task...
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
