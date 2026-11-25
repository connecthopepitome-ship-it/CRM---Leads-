import { useState, useEffect, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  X, Check, Plus, Clock, ChevronLeft, CheckSquare, Trash2, ExternalLink, Search,
} from 'lucide-react';
import { get, post, patch, del } from '../lib/api';
import { dateTime } from '../lib/format';
import { Button, Dialog, toast } from '../ui';

function getISTDateKey(isoStr: string): string {
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return '';
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d);
  } catch {
    return '';
  }
}

export interface Task {
  id: string;
  recordType: 'lead' | 'customer';
  recordId: string;
  title: string;
  dueAt: string;
  dueCategory: 'today' | 'upcoming';
  dueTime: string;
  isOverdue: boolean;
  type: string;
  completed: boolean;
  contact?: string;
  notes?: string;
  completedAt?: string;
}

interface TaskDrawerProps {
  open: boolean;
  onClose: () => void;
  onToggle: () => void;
}

export function TaskDrawer({ open, onClose, onToggle }: TaskDrawerProps) {
  const qc = useQueryClient();

  useEffect(() => {
    try {
      localStorage.removeItem('ss_tasks');
    } catch {}
  }, []);

  const q = useQuery({
    queryKey: ['follow-ups'],
    queryFn: () => get<{ items: any[] }>('/follow-ups'),
    refetchInterval: 60_000,
  });

  const leadsQ = useQuery({
    queryKey: ['leads', 'picker'],
    queryFn: () => get<{ items: any[] }>('/leads?limit=100'),
    enabled: open,
  });

  const customersQ = useQuery({
    queryKey: ['customers', 'picker'],
    queryFn: () => get<{ items: any[] }>('/customers?limit=100'),
    enabled: open,
  });

  const now = new Date();
  const todayIST = getISTDateKey(now.toISOString());

  const tasks: Task[] = (q.data?.items ?? []).map((fu: any) => {
    const isCompleted = fu.status === 'completed' || fu.completed;
    const fuDateIST = fu.dueAt ? getISTDateKey(fu.dueAt) : todayIST;
    const isOverdue = !isCompleted && !!fu.dueAt && new Date(fu.dueAt).getTime() < now.getTime();
    const dueCategory: 'today' | 'upcoming' = fuDateIST <= todayIST ? 'today' : 'upcoming';

    return {
      id: fu.id,
      recordType: fu.recordType || 'lead',
      recordId: fu.recordId || '',
      title: fu.title || fu.note || `${String(fu.type || 'call').toUpperCase()} follow-up`,
      dueAt: fu.dueAt,
      dueCategory,
      dueTime: dateTime(fu.dueAt),
      isOverdue,
      type: fu.type || 'call',
      completed: isCompleted,
      contact: fu.partyName || fu.customer,
      notes: fu.note || undefined,
      completedAt: fu.completedAt ? dateTime(fu.completedAt) : undefined,
    };
  });

  const [activeTab, setActiveTab] = useState<'today' | 'upcoming' | 'completed'>('today');
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Task | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Add Task form state (matching Follow-ups page)
  const [isAdding, setIsAdding] = useState(false);
  const [recordType, setRecordType] = useState<'lead' | 'customer'>('lead');
  const [partySearch, setPartySearch] = useState('');
  const [recordId, setRecordId] = useState('');
  const [fuType, setFuType] = useState('call');
  const [fuDate, setFuDate] = useState(todayIST);
  const [fuTime, setFuTime] = useState('11:00');
  const [subject, setSubject] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && typeof window !== 'undefined' && window.innerWidth < 768) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [open]);

  const invalidateAll = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['follow-ups'], refetchType: 'all' }),
      qc.invalidateQueries({ queryKey: ['leads'], refetchType: 'all' }),
      qc.invalidateQueries({ queryKey: ['notifications'], refetchType: 'all' }),
    ]);
  };

  const todayCount = tasks.filter((t) => !t.completed && t.dueCategory === 'today').length;
  const overdueCount = tasks.filter((t) => !t.completed && t.isOverdue).length;
  const upcomingCount = tasks.filter((t) => !t.completed && t.dueCategory === 'upcoming').length;
  const completedCount = tasks.filter((t) => t.completed).length;

  const currentTasks = tasks.filter((t) => {
    if (activeTab === 'today') return !t.completed && t.dueCategory === 'today';
    if (activeTab === 'upcoming') return !t.completed && t.dueCategory === 'upcoming';
    return t.completed;
  });

  const rawParties = recordType === 'lead' ? (leadsQ.data?.items ?? []) : (customersQ.data?.items ?? []);
  const filteredParties = rawParties.filter((p: any) => {
    const label = `${p.displayName || p.name || ''} ${p.company || p.legalName || ''}`.toLowerCase();
    return !partySearch.trim() || label.includes(partySearch.trim().toLowerCase());
  });

  const toggleTask = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    const nextStatus = task.completed ? 'pending' : 'completed';
    try {
      await patch(`/follow-ups/${id}`, { status: nextStatus });
      await invalidateAll();
      toast(nextStatus === 'completed' ? `Done: "${task.title}"` : `Reopened: "${task.title}"`, 'success');
    } catch {
      toast('Failed to update task status', 'error');
    }
  };

  const handleAddTask = async (e: FormEvent) => {
    e.preventDefault();
    if (!recordId) {
      toast(`Please select a ${recordType}`, 'error');
      return;
    }
    if (!fuDate || !fuTime) {
      toast('Please select date and time', 'error');
      return;
    }
    setSaving(true);
    try {
      const dueIso = new Date(`${fuDate}T${fuTime}:00+05:30`).toISOString();
      const combinedNote = [subject.trim(), notes.trim()].filter(Boolean).join(' — ');
      await post('/follow-ups', {
        recordType,
        recordId,
        dueAt: dueIso,
        type: fuType,
        note: combinedNote || `${fuType.toUpperCase()} follow-up`,
      });
      await invalidateAll();
      setIsAdding(false);
      setRecordId('');
      setPartySearch('');
      setSubject('');
      setNotes('');
      setActiveTab(fuDate <= todayIST ? 'today' : 'upcoming');
      toast('Follow-up scheduled', 'success');
    } catch {
      toast('Failed to schedule follow-up', 'error');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await del(`/follow-ups/${deleteTarget.id}`);
      await invalidateAll();
      toast('Follow-up deleted', 'info');
      setDeleteTarget(null);
    } catch {
      toast('Failed to delete follow-up', 'error');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-[#202820]/50 backdrop-blur-xs md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 right-0 z-50 flex-col glass-dark-drawer text-white transition-all duration-300 ease-in-out shrink-0 select-none md:static md:z-20 ${
          open
            ? 'flex translate-x-0 w-[88vw] max-w-[340px] md:w-80 xl:md:w-[320px] shadow-2xl md:shadow-none'
            : 'hidden md:flex md:translate-x-0 md:w-0 border-l-0 overflow-hidden pointer-events-none'
        }`}
        aria-label="Tasks panel"
      >
        {!open && (
          <button
            onClick={onToggle}
            className="hidden md:flex fixed right-0 top-1/2 -translate-y-1/2 z-30 flex-col items-center gap-1.5 px-2 py-3 bg-[#203923]/90 backdrop-blur-xl border-l border-y border-white/20 rounded-l-2xl shadow-2xl text-emerald-200 hover:text-white hover:bg-[#28492C] transition-all focus:outline-none group interactive-tile"
            title="Open My Tasks"
            aria-label="Open tasks drawer"
          >
            <ChevronLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
            <span
              className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] text-white font-bold shadow-xs group-hover:scale-110 transition-transform ${
                overdueCount > 0 ? 'bg-red-600' : 'bg-[#3D7952]'
              }`}
            >
              {todayCount}
            </span>
          </button>
        )}

        <div className="w-full md:w-80 xl:md:w-[320px] flex flex-col h-full overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white tracking-tight hover-text-glow">My Tasks</h2>
              <span
                className={`flex items-center justify-center px-2 py-0.5 text-xs font-semibold rounded-full glass-badge ${
                  overdueCount > 0 ? 'bg-red-600/80 text-white' : 'bg-[#2E4E36] text-emerald-200'
                }`}
              >
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
                const partyLink = task.recordType === 'customer' ? `/customers/${task.recordId}` : `/leads/${task.recordId}`;

                return (
                  <div
                    key={task.id}
                    onClick={() => setExpandedTaskId(isExpanded ? null : task.id)}
                    className={`group rounded-xl p-3 transition-all cursor-pointer border interactive-tile ${
                      task.completed
                        ? 'bg-[#1C321F]/60 border-white/10 opacity-70'
                        : task.isOverdue
                        ? 'bg-[#3b1c1c]/90 border-red-500/70 hover:bg-[#482020]'
                        : isExpanded
                        ? 'bg-[#28492C]/90 border-emerald-400/50 shadow-lg'
                        : 'bg-[#1C321F]/80 border-white/10 hover:bg-[#28492C]/90 hover:border-emerald-400/30'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <button
                        type="button"
                        onClick={(e) => toggleTask(task.id, e)}
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border mt-0.5 transition-all btn-spring ${
                          task.completed
                            ? 'border-emerald-400 bg-emerald-500 text-white'
                            : task.isOverdue
                            ? 'border-red-400 bg-transparent hover:border-red-300'
                            : 'border-emerald-400/60 bg-transparent hover:border-emerald-300 hover:scale-110'
                        }`}
                        aria-label={task.completed ? 'Mark incomplete' : 'Mark completed'}
                      >
                        {task.completed && <Check size={11} strokeWidth={3} />}
                      </button>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-1.5">
                          <p
                            className={`text-xs font-medium leading-snug ${
                              task.completed ? 'line-through text-emerald-300/60' : 'text-white'
                            }`}
                          >
                            {task.title}
                          </p>
                          {task.isOverdue && !task.completed && (
                            <span className="shrink-0 rounded bg-red-600 px-1.5 py-0.5 text-[9px] font-bold text-white uppercase tracking-wider">
                              Overdue
                            </span>
                          )}
                        </div>

                        <div className="mt-1.5 flex items-center justify-between gap-2 text-[11px] text-emerald-300/80">
                          <span className="flex items-center gap-1 font-mono text-[10px]">
                            <Clock size={11} className="text-emerald-400 shrink-0" />
                            {task.dueTime}
                          </span>
                          {task.contact && task.recordId && (
                            <Link
                              to={partyLink}
                              onClick={(e) => e.stopPropagation()}
                              className="truncate max-w-[125px] rounded-xs bg-[#2E4E36]/80 px-1.5 py-0.5 text-[10px] text-emerald-200 hover:text-white flex items-center gap-1"
                              title={`Open ${task.contact}`}
                            >
                              <span className="truncate">{task.contact}</span>
                              <ExternalLink size={9} className="shrink-0" />
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="mt-3 pt-2.5 border-t border-[#2E4E36] text-xs space-y-2">
                        {task.notes && (
                          <p className="text-[11px] text-emerald-200/90 leading-relaxed bg-[#192E1C] p-2 rounded-lg border border-[#2E4E36]">
                            {task.notes}
                          </p>
                        )}
                        <div className="flex items-center justify-between text-[11px] text-emerald-300/70 pt-1">
                          <span className="uppercase text-[10px] font-semibold">{task.type}</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteTarget(task);
                            }}
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

            {isAdding && (
              <form onSubmit={handleAddTask} className="rounded-xl border border-emerald-500/60 bg-[#1C321F] p-3 text-xs space-y-2.5 shadow-md">
                <span className="block font-bold text-emerald-200 text-[11px]">Schedule Follow-up</span>

                <div className="grid grid-cols-2 gap-2">
                  <select
                    aria-label="Party type"
                    value={recordType}
                    onChange={(e) => {
                      setRecordType(e.target.value as 'lead' | 'customer');
                      setRecordId('');
                      setPartySearch('');
                    }}
                    className="rounded-lg border border-[#2E4E36] bg-[#122314] px-2 py-1.5 text-xs text-white focus:border-emerald-400 focus:outline-none"
                  >
                    <option value="lead">Lead</option>
                    <option value="customer">Customer</option>
                  </select>

                  <select
                    aria-label="Follow-up type"
                    value={fuType}
                    onChange={(e) => setFuType(e.target.value)}
                    className="rounded-lg border border-[#2E4E36] bg-[#122314] px-2 py-1.5 text-xs text-white focus:border-emerald-400 focus:outline-none"
                  >
                    <option value="call">Call</option>
                    <option value="whatsapp">WhatsApp</option>
                    <option value="email">Email</option>
                    <option value="meeting">Meeting</option>
                    <option value="visit">Visit</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <div className="relative">
                    <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-emerald-400/60" />
                    <input
                      type="text"
                      placeholder={`Search ${recordType}...`}
                      value={partySearch}
                      onChange={(e) => setPartySearch(e.target.value)}
                      className="w-full rounded-lg border border-[#2E4E36] bg-[#122314] pl-7 pr-2.5 py-1 text-xs text-white placeholder-emerald-400/50 focus:border-emerald-400 focus:outline-none"
                    />
                  </div>
                  <select
                    aria-label={recordType === 'lead' ? 'Select lead' : 'Select customer'}
                    required
                    value={recordId}
                    onChange={(e) => setRecordId(e.target.value)}
                    className="w-full rounded-lg border border-[#2E4E36] bg-[#122314] px-2 py-1.5 text-xs text-white focus:border-emerald-400 focus:outline-none"
                  >
                    <option value="">Select {recordType}...</option>
                    {filteredParties.map((p: any) => (
                      <option key={p.id} value={p.id}>
                        {p.displayName || p.name}
                        {p.company || p.legalName ? ` (${p.company || p.legalName})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <input
                    aria-label="Follow-up date"
                    type="date"
                    required
                    value={fuDate}
                    onChange={(e) => setFuDate(e.target.value)}
                    className="rounded-lg border border-[#2E4E36] bg-[#122314] px-2 py-1 text-xs text-white focus:border-emerald-400 focus:outline-none"
                  />
                  <input
                    aria-label="Follow-up time"
                    type="time"
                    required
                    value={fuTime}
                    onChange={(e) => setFuTime(e.target.value)}
                    className="rounded-lg border border-[#2E4E36] bg-[#122314] px-2 py-1 text-xs text-white focus:border-emerald-400 focus:outline-none"
                  />
                </div>

                <input
                  type="text"
                  placeholder="Subject / agenda..."
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full rounded-lg border border-[#2E4E36] bg-[#122314] px-2.5 py-1.5 text-xs text-white placeholder-emerald-400/50 focus:border-emerald-400 focus:outline-none"
                />

                <textarea
                  placeholder="Notes (optional)..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
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
                    disabled={saving || !recordId}
                    className="rounded-lg bg-[#3D7952] px-3 py-1 text-[11px] font-bold text-white hover:bg-emerald-600 shadow-xs disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : 'Save Task'}
                  </button>
                </div>
              </form>
            )}
          </div>

          <div className="p-3 border-t border-[#2E4E36] bg-[#1A301D]">
            {!isAdding ? (
              <button
                onClick={() => {
                  setFuDate(getISTDateKey(new Date().toISOString()));
                  setIsAdding(true);
                }}
                className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-[#2E4E36] py-2 text-xs font-semibold text-emerald-200 hover:text-white hover:border-emerald-400 hover:bg-[#203923] transition-all"
              >
                <Plus size={14} />
                <span>Add Task</span>
              </button>
            ) : (
              <div className="text-[11px] text-center text-emerald-400 font-medium">
                Adding follow-up (IST)...
              </div>
            )}
          </div>
        </div>
      </aside>

      {deleteTarget && (
        <Dialog
          open
          onClose={() => setDeleteTarget(null)}
          title="Delete Follow-up"
          footer={
            <>
              <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
                Cancel
              </Button>
              <Button variant="danger" busy={deleting} onClick={() => void confirmDelete()}>
                Delete
              </Button>
            </>
          }
        >
          <p className="text-sm text-[#202820]">
            Are you sure you want to delete this follow-up{deleteTarget.contact ? ` for ${deleteTarget.contact}` : ''}?
          </p>
        </Dialog>
      )}
    </>
  );
}
