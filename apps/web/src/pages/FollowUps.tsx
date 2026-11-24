/** SCR-008 Follow-ups Calendar Workspace (Grovia-inspired Minimalist SaaS Design System) */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { del, get, patch, post } from '../lib/api';
import { dateTime } from '../lib/format';
import { Badge, Button, Dialog, EmptyState, Skeleton, toast } from '../ui';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Check,
  Clock,
  Calendar,
  CheckSquare,
  Phone,
  MessageCircle,
  Mail,
  MapPin,
  Trash2,
  CalendarClock,
  ExternalLink,
  Tag,
  User,
} from 'lucide-react';

interface FollowUpItem {
  id: string;
  recordType: 'lead' | 'customer';
  recordId: string;
  partyName: string;
  customer?: string;
  type: string;
  dueAt: string;
  note: string;
  title: string;
  assignee: string;
  status: 'pending' | 'completed';
  completed: boolean;
  isOverdue?: boolean;
  istDate: string; // YYYY-MM-DD
  istTime: string; // 2:30 PM
}

function getISTDateKey(iso: string): string {
  try {
    let s = String(iso).trim();
    if (!s.endsWith('Z') && !s.includes('+')) {
      s = s.includes('T') ? s + 'Z' : s.replace(' ', 'T') + 'Z';
    }
    const d = new Date(s);
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d);
  } catch {
    return String(iso).slice(0, 10);
  }
}

function getISTTimeStr(iso: string): string {
  try {
    let s = String(iso).trim();
    if (!s.endsWith('Z') && !s.includes('+')) {
      s = s.includes('T') ? s + 'Z' : s.replace(' ', 'T') + 'Z';
    }
    const d = new Date(s);
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(d);
  } catch {
    return '';
  }
}

function formatISTHeaderDate(dateKey: string): string {
  try {
    const [y, m, d] = dateKey.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    return new Intl.DateTimeFormat('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(dateObj);
  } catch {
    return dateKey;
  }
}

const TYPE_ICONS: Record<string, React.ElementType> = {
  call: Phone,
  whatsapp: MessageCircle,
  email: Mail,
  visit: MapPin,
  other: Tag,
};

export default function FollowUps() {
  const qc = useQueryClient();
  const [calendarView, setCalendarView] = useState<'month' | 'week' | 'day'>('month');

  // Currently focused view date (default today)
  const todayISTStr = getISTDateKey(new Date().toISOString());
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [selectedDateKey, setSelectedDateKey] = useState<string>(todayISTStr);

  // Queries
  const fuQ = useQuery({
    queryKey: ['follow-ups'],
    queryFn: () => get<{ items: any[] }>('/follow-ups'),
  });

  const leadsQ = useQuery({
    queryKey: ['leads'],
    queryFn: () => get<{ items: any[] }>('/leads'),
  });

  const custsQ = useQuery({
    queryKey: ['customers'],
    queryFn: () => get<{ items: any[] }>('/customers'),
  });

  // Reschedule state
  const [reschedulingItem, setReschedulingItem] = useState<FollowUpItem | null>(null);
  const [newDueAt, setNewDueAt] = useState('');
  const [rescheduleBusy, setRescheduleBusy] = useState(false);

  // Add Task form state
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [newTaskRecordType, setNewTaskRecordType] = useState<'lead' | 'customer'>('lead');
  const [newTaskRecordId, setNewTaskRecordId] = useState('');
  const [newTaskType, setNewTaskType] = useState('call');
  const [newTaskTime, setNewTaskTime] = useState('11:00');
  const [newTaskNote, setNewTaskNote] = useState('');
  const [addingBusy, setAddingBusy] = useState(false);

  // Parse and group all follow-ups from API
  const allFollowUps: FollowUpItem[] = (fuQ.data?.items ?? []).map((fu) => {
    const isCompleted = fu.completed || fu.status === 'completed';
    const d = new Date(fu.dueAt);
    const isOverdue = !isCompleted && d < new Date();
    const istDate = getISTDateKey(fu.dueAt);
    const istTime = getISTTimeStr(fu.dueAt);

    return {
      id: fu.id,
      recordType: fu.recordType || 'lead',
      recordId: fu.recordId,
      partyName: fu.partyName || fu.customer || 'Client',
      type: fu.type || 'call',
      dueAt: fu.dueAt,
      note: fu.note || '',
      title: fu.title || fu.note || `${(fu.type || 'call').toUpperCase()} follow-up`,
      assignee: fu.assignee || 'Owner Admin',
      status: isCompleted ? 'completed' : 'pending',
      completed: isCompleted,
      isOverdue,
      istDate,
      istTime,
    };
  });

  // Group by IST Date (YYYY-MM-DD)
  const tasksByDate: Record<string, FollowUpItem[]> = {};
  allFollowUps.forEach((item) => {
    if (!tasksByDate[item.istDate]) tasksByDate[item.istDate] = [];
    tasksByDate[item.istDate].push(item);
  });

  // Sort items within each day by dueAt ascending
  Object.keys(tasksByDate).forEach((k) => {
    tasksByDate[k].sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());
  });

  // Selected Day tasks
  const selectedDayTasks = tasksByDate[selectedDateKey] || [];

  // Actions
  const toggleTask = async (id: string, currentCompleted: boolean) => {
    try {
      await patch(`/follow-ups/${id}`, { status: currentCompleted ? 'pending' : 'completed' });
      await qc.invalidateQueries({ queryKey: ['follow-ups'] });
      await qc.invalidateQueries({ queryKey: ['leads'] });
      toast(currentCompleted ? 'Follow-up marked as pending' : 'Follow-up marked as completed', 'success');
    } catch {
      toast('Failed to update follow-up', 'error');
    }
  };

  const handleReschedule = async () => {
    if (!reschedulingItem || !newDueAt) return;
    setRescheduleBusy(true);
    try {
      const isoDue = new Date(newDueAt).toISOString();
      await patch(`/follow-ups/${reschedulingItem.id}`, { dueAt: isoDue, status: 'pending' });
      await qc.invalidateQueries({ queryKey: ['follow-ups'] });
      await qc.invalidateQueries({ queryKey: ['leads'] });
      toast('Follow-up rescheduled', 'success');
      setReschedulingItem(null);
    } catch {
      toast('Failed to reschedule follow-up', 'error');
    } finally {
      setRescheduleBusy(false);
    }
  };

  const handleDeleteTask = async (id: string) => {
    if (!confirm('Are you sure you want to delete this follow-up?')) return;
    try {
      await del(`/follow-ups/${id}`);
      await qc.invalidateQueries({ queryKey: ['follow-ups'] });
      await qc.invalidateQueries({ queryKey: ['leads'] });
      toast('Follow-up deleted', 'success');
    } catch {
      toast('Failed to delete follow-up', 'error');
    }
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskNote.trim()) return;

    setAddingBusy(true);
    try {
      // Build ISO dueAt from selectedDateKey + newTaskTime
      const [year, month, day] = selectedDateKey.split('-').map(Number);
      const [hour, minute] = (newTaskTime || '11:00').split(':').map(Number);
      // Construct date string and create ISO
      const localDate = new Date(year, month - 1, day, hour, minute, 0);
      const isoDue = localDate.toISOString();

      let targetId = newTaskRecordId;
      if (!targetId) {
        if (newTaskRecordType === 'lead') {
          targetId = leadsQ.data?.items?.[0]?.id || 'lead-1';
        } else {
          targetId = custsQ.data?.items?.[0]?.id || 'cust-1';
        }
      }

      await post('/follow-ups', {
        recordType: newTaskRecordType,
        recordId: targetId,
        dueAt: isoDue,
        type: newTaskType,
        note: newTaskNote.trim(),
      });

      await qc.invalidateQueries({ queryKey: ['follow-ups'] });
      await qc.invalidateQueries({ queryKey: ['leads'] });
      setIsAddingTask(false);
      setNewTaskNote('');
      toast('Follow-up scheduled successfully', 'success');
    } catch {
      toast('Failed to schedule follow-up', 'error');
    } finally {
      setAddingBusy(false);
    }
  };

  // Calendar Navigation
  const navPrev = () => {
    const d = new Date(currentDate);
    if (calendarView === 'month') {
      d.setMonth(d.getMonth() - 1);
    } else if (calendarView === 'week') {
      d.setDate(d.getDate() - 7);
    } else {
      d.setDate(d.getDate() - 1);
    }
    setCurrentDate(d);
    if (calendarView === 'day') {
      setSelectedDateKey(getISTDateKey(d.toISOString()));
    }
  };

  const navNext = () => {
    const d = new Date(currentDate);
    if (calendarView === 'month') {
      d.setMonth(d.getMonth() + 1);
    } else if (calendarView === 'week') {
      d.setDate(d.getDate() + 7);
    } else {
      d.setDate(d.getDate() + 1);
    }
    setCurrentDate(d);
    if (calendarView === 'day') {
      setSelectedDateKey(getISTDateKey(d.toISOString()));
    }
  };

  const navToday = () => {
    const now = new Date();
    setCurrentDate(now);
    setSelectedDateKey(todayISTStr);
  };

  // Dynamic Month Matrix: 7 columns (Mon-Sun)
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth(); // 0-based
  const monthName = new Intl.DateTimeFormat('en-IN', { month: 'short', year: 'numeric' }).format(currentDate);

  const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
  const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0);
  const daysInMonth = lastDayOfMonth.getDate();

  // Monday = 0, Sunday = 6
  const startDayOfWeek = (firstDayOfMonth.getDay() + 6) % 7;

  // Previous month padding days
  const prevMonthLastDay = new Date(currentYear, currentMonth, 0).getDate();
  const calendarCells: { dayNum: number; dateKey: string; isCurrentMonth: boolean }[] = [];

  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    const day = prevMonthLastDay - i;
    const prevDate = new Date(currentYear, currentMonth - 1, day);
    calendarCells.push({
      dayNum: day,
      dateKey: getISTDateKey(prevDate.toISOString()),
      isCurrentMonth: false,
    });
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(currentYear, currentMonth, day);
    calendarCells.push({
      dayNum: day,
      dateKey: getISTDateKey(d.toISOString()),
      isCurrentMonth: true,
    });
  }

  // Next month padding to fill out complete rows
  const remainingCells = (7 - (calendarCells.length % 7)) % 7;
  for (let day = 1; day <= remainingCells; day++) {
    const nextDate = new Date(currentYear, currentMonth + 1, day);
    calendarCells.push({
      dayNum: day,
      dateKey: getISTDateKey(nextDate.toISOString()),
      isCurrentMonth: false,
    });
  }

  // Week View Days (Monday to Sunday around currentDate)
  const weekStart = new Date(currentDate);
  const currentDayOfWeek = (weekStart.getDay() + 6) % 7; // Monday = 0
  weekStart.setDate(weekStart.getDate() - currentDayOfWeek);

  const weekDays: { name: string; dateNum: number; dateKey: string }[] = [];
  const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  for (let i = 0; i < 7; i++) {
    const wDay = new Date(weekStart);
    wDay.setDate(wDay.getDate() + i);
    weekDays.push({
      name: DAY_NAMES[i],
      dateNum: wDay.getDate(),
      dateKey: getISTDateKey(wDay.toISOString()),
    });
  }

  return (
    <div className="space-y-5 pb-8">
      {/* 1. TOP HEADER & VIEW TOGGLES */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#202820]">
            Follow-ups
          </h1>
          <p className="text-xs sm:text-sm text-[#778477] mt-0.5">
            Plan, reschedule and manage scheduled customer touchpoints in Indian Standard Time (IST).
          </p>
        </div>

        {/* View Switcher Pills: Month | Week | Day */}
        <div className="inline-flex rounded-full bg-[#E3EFDF]/70 p-1 border border-[#DCE7D9]">
          {(['month', 'week', 'day'] as const).map((v) => (
            <button
              key={v}
              onClick={() => {
                setCalendarView(v);
                if (v === 'day') {
                  setSelectedDateKey(getISTDateKey(currentDate.toISOString()));
                }
              }}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold capitalize transition-all ${
                calendarView === v
                  ? 'bg-[#233D2D] text-white shadow-xs'
                  : 'text-[#778477] hover:text-[#202820]'
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* 2. CALENDAR WORKSPACE */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* MAIN CALENDAR CARD (8 cols in Month/Week view, 12 in Day view) */}
        <div
          className={`rounded-2xl border border-[#DCE7D9] bg-white p-5 shadow-2xs space-y-4 ${
            calendarView === 'day' ? 'lg:col-span-12' : 'lg:col-span-8'
          }`}
        >
          {/* Calendar Controls */}
          <div className="flex items-center justify-between border-b border-[#DCE7D9]/60 pb-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={navToday}
                className="rounded-full border border-[#DCE7D9] bg-[#F5F9F2] px-3 py-1 text-xs font-semibold text-[#202820] hover:bg-[#E3EFDF] transition-colors"
              >
                Today
              </button>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={navPrev}
                  className="rounded-lg p-1 text-[#778477] hover:text-[#202820] hover:bg-[#F5F9F2] transition-colors"
                  title="Previous"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="text-xs font-bold text-[#202820] px-2 min-w-[80px] text-center">
                  {calendarView === 'month'
                    ? monthName
                    : calendarView === 'week'
                    ? `${weekDays[0]?.name} ${weekDays[0]?.dateNum} – ${weekDays[6]?.name} ${weekDays[6]?.dateNum}`
                    : formatISTHeaderDate(selectedDateKey)}
                </span>
                <button
                  type="button"
                  onClick={navNext}
                  className="rounded-lg p-1 text-[#778477] hover:text-[#202820] hover:bg-[#F5F9F2] transition-colors"
                  title="Next"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>

            <div className="flex items-center gap-3 text-xs text-[#778477]">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[#3D7952]" />
                Scheduled
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-red-500" />
                Overdue
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-gray-400" />
                Completed
              </span>
            </div>
          </div>

          {/* VIEW: MONTH */}
          {calendarView === 'month' && (
            <div className="space-y-2">
              {/* Mon - Sun Header */}
              <div className="grid grid-cols-7 text-center text-xs font-semibold text-[#778477] border-b border-[#DCE7D9]/40 pb-2">
                {DAY_NAMES.map((d) => (
                  <span key={d}>{d}</span>
                ))}
              </div>

              {/* 7-column Month Grid */}
              <div className="grid grid-cols-7 gap-1.5 text-xs font-medium">
                {calendarCells.map((cell, idx) => {
                  const isSelected = cell.dateKey === selectedDateKey;
                  const isToday = cell.dateKey === todayISTStr;
                  const dayTasks = tasksByDate[cell.dateKey] || [];
                  const hasTasks = dayTasks.length > 0;
                  const hasOverdue = dayTasks.some((t) => t.isOverdue);

                  return (
                    <div
                      key={idx}
                      onClick={() => {
                        if (cell.isCurrentMonth) setSelectedDateKey(cell.dateKey);
                      }}
                      className={`relative min-h-[72px] sm:min-h-[84px] p-1.5 rounded-xl border flex flex-col justify-between transition-all cursor-pointer ${
                        !cell.isCurrentMonth
                          ? 'border-transparent text-[#778477]/30 bg-[#F5F9F2]/30 cursor-default'
                          : isSelected
                          ? 'border-[#233D2D] bg-[#EAF2E8] shadow-xs'
                          : 'border-[#DCE7D9]/50 hover:bg-[#F5F9F2] bg-white text-[#202820]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={`text-xs font-bold flex items-center justify-center h-5 w-5 rounded-full ${
                            isToday
                              ? 'bg-[#233D2D] text-white'
                              : isSelected
                              ? 'text-[#233D2D]'
                              : 'text-[#202820]'
                          }`}
                        >
                          {cell.dayNum}
                        </span>
                        {hasTasks && (
                          <span
                            className={`h-2 w-2 rounded-full ${
                              hasOverdue ? 'bg-red-500 ring-2 ring-red-200' : 'bg-[#3D7952]'
                            }`}
                          />
                        )}
                      </div>

                      {/* Follow-up previews on the date */}
                      <div className="space-y-1 mt-1 overflow-hidden">
                        {dayTasks.slice(0, 2).map((t) => {
                          const IconComp = TYPE_ICONS[t.type] || Tag;
                          return (
                            <div
                              key={t.id}
                              className={`truncate px-1.5 py-0.5 rounded text-[10px] font-medium flex items-center gap-1 ${
                                t.completed
                                  ? 'bg-gray-100 text-gray-500 line-through'
                                  : t.isOverdue
                                  ? 'bg-red-50 text-red-700 border border-red-200'
                                  : 'bg-[#E3EFDF] text-[#233D2D]'
                              }`}
                              title={`${t.partyName}: ${t.title} at ${t.istTime}`}
                            >
                              <IconComp size={10} className="shrink-0" />
                              <span className="truncate">{t.partyName}</span>
                            </div>
                          );
                        })}
                        {dayTasks.length > 2 && (
                          <div className="text-[9px] font-semibold text-[#3D7952] px-1">
                            +{dayTasks.length - 2} more
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* VIEW: WEEK */}
          {calendarView === 'week' && (
            <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
              {weekDays.map((wd) => {
                const dayTasks = tasksByDate[wd.dateKey] || [];
                const isSelected = wd.dateKey === selectedDateKey;
                const isToday = wd.dateKey === todayISTStr;

                return (
                  <div
                    key={wd.dateKey}
                    className={`rounded-xl border p-2.5 flex flex-col min-h-[350px] transition-all ${
                      isSelected
                        ? 'border-[#233D2D] bg-[#F5F9F2]'
                        : 'border-[#DCE7D9] bg-white'
                    }`}
                  >
                    <div
                      onClick={() => setSelectedDateKey(wd.dateKey)}
                      className="cursor-pointer border-b border-[#DCE7D9]/60 pb-2 text-center"
                    >
                      <p className="text-[11px] font-semibold text-[#778477] uppercase">{wd.name}</p>
                      <p
                        className={`text-sm font-bold inline-block px-2 py-0.5 rounded-full ${
                          isToday ? 'bg-[#233D2D] text-white' : 'text-[#202820]'
                        }`}
                      >
                        {wd.dateNum}
                      </p>
                    </div>

                    <div className="space-y-2 mt-2 flex-1 overflow-y-auto max-h-[420px]">
                      {dayTasks.length === 0 ? (
                        <div className="text-center py-6 text-[11px] text-[#778477]/60">No tasks</div>
                      ) : (
                        dayTasks.map((t) => (
                          <FollowUpCard
                            key={t.id}
                            item={t}
                            compact
                            onToggle={() => void toggleTask(t.id, t.completed)}
                            onReschedule={() => {
                              setReschedulingItem(t);
                              setNewDueAt(t.dueAt.slice(0, 16));
                            }}
                            onDelete={() => void handleDeleteTask(t.id)}
                          />
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* VIEW: DAY */}
          {calendarView === 'day' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-[#F5F9F2] p-3 rounded-xl border border-[#DCE7D9]">
                <div>
                  <h3 className="text-base font-bold text-[#202820]">
                    {formatISTHeaderDate(selectedDateKey)}
                  </h3>
                  <p className="text-xs text-[#778477]">
                    {selectedDayTasks.length} follow-up touchpoint{selectedDayTasks.length === 1 ? '' : 's'}
                  </p>
                </div>
                <Button size="sm" onClick={() => setIsAddingTask(true)}>
                  <Plus size={14} className="mr-1" />
                  Add Follow-up
                </Button>
              </div>

              {selectedDayTasks.length === 0 ? (
                <EmptyState
                  title="No follow-ups for this day"
                  description="Use the button above to schedule a touchpoint for this date."
                />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {selectedDayTasks.map((t) => (
                    <FollowUpCard
                      key={t.id}
                      item={t}
                      onToggle={() => void toggleTask(t.id, t.completed)}
                      onReschedule={() => {
                        setReschedulingItem(t);
                        setNewDueAt(t.dueAt.slice(0, 16));
                      }}
                      onDelete={() => void handleDeleteTask(t.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* RIGHT: Tasks on Selected Date Panel (Dark Forest Green, 4 cols) */}
        {calendarView !== 'day' && (
          <div className="rounded-2xl border border-[#2E4E36] bg-[#203923] text-white p-5 shadow-lg space-y-4 lg:col-span-4">
            <div className="flex items-center justify-between border-b border-[#2E4E36] pb-3">
              <div>
                <h2 className="text-sm font-bold text-white tracking-tight">
                  Tasks on {formatISTHeaderDate(selectedDateKey)}
                </h2>
                <p className="text-[11px] text-emerald-300/70">
                  {selectedDayTasks.length} scheduled follow-ups
                </p>
              </div>
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#2E4E36] text-[11px] text-emerald-200 font-bold">
                {selectedDayTasks.length}
              </span>
            </div>

            {/* Tasks List */}
            <div className="space-y-2.5 min-h-[220px] max-h-[440px] overflow-y-auto">
              {selectedDayTasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-44 text-center">
                  <CheckSquare size={28} className="text-emerald-500/40 mb-1.5" />
                  <p className="text-xs font-semibold text-emerald-200">No tasks on this day</p>
                  <p className="text-[11px] text-emerald-300/60 mt-0.5">
                    Click below to schedule a follow-up.
                  </p>
                </div>
              ) : (
                selectedDayTasks.map((t) => {
                  const IconComp = TYPE_ICONS[t.type] || Tag;
                  const partyLink = t.recordType === 'customer' ? `/customers/${t.recordId}` : `/leads/${t.recordId}`;

                  return (
                    <div
                      key={t.id}
                      className={`rounded-xl p-3 border transition-colors ${
                        t.completed
                          ? 'bg-[#1C321F]/60 border-[#2E4E36]/40 opacity-70'
                          : t.isOverdue
                          ? 'bg-[#3b1c1c] border-red-500/80 hover:bg-[#482020]'
                          : 'bg-[#1C321F] border-[#2E4E36] hover:bg-[#28492C]'
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <button
                          type="button"
                          onClick={() => void toggleTask(t.id, t.completed)}
                          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border mt-0.5 transition-colors ${
                            t.completed
                              ? 'border-emerald-400 bg-emerald-500 text-white'
                              : t.isOverdue
                              ? 'border-red-400 bg-transparent hover:border-red-300'
                              : 'border-emerald-400/60 bg-transparent hover:border-emerald-300'
                          }`}
                          title={t.completed ? 'Mark pending' : 'Mark completed'}
                        >
                          {t.completed && <Check size={11} strokeWidth={3} />}
                        </button>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 justify-between">
                            <p
                              className={`text-xs font-semibold ${
                                t.completed ? 'line-through text-emerald-300/60' : 'text-white'
                              }`}
                            >
                              {t.title}
                            </p>
                            {t.isOverdue && !t.completed && (
                              <span className="rounded bg-red-600/80 px-1 py-0.2 text-[9px] font-bold text-white uppercase tracking-wider">
                                Overdue
                              </span>
                            )}
                          </div>

                          <div className="mt-1 flex items-center justify-between text-[10px] text-emerald-300/80">
                            <span className="flex items-center gap-1 font-mono">
                              <IconComp size={11} className="text-emerald-400" />
                              {t.istTime}
                            </span>
                            <Link
                              to={partyLink}
                              className="truncate max-w-[130px] rounded-xs bg-[#2E4E36] px-1.5 py-0.5 text-[10px] text-emerald-200 hover:text-white hover:bg-[#3D7952] transition-colors flex items-center gap-1"
                              title={`Open ${t.partyName}`}
                            >
                              <span>{t.partyName}</span>
                              <ExternalLink size={9} />
                            </Link>
                          </div>

                          {/* Action Toolbar on card */}
                          <div className="mt-2 flex items-center justify-end gap-2 border-t border-[#2E4E36]/60 pt-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setReschedulingItem(t);
                                setNewDueAt(t.dueAt.slice(0, 16));
                              }}
                              className="text-[10px] text-emerald-300 hover:text-white flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-[#2E4E36]"
                              title="Reschedule follow-up"
                            >
                              <CalendarClock size={11} />
                              <span>Reschedule</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDeleteTask(t.id)}
                              className="text-[10px] text-red-300 hover:text-red-100 flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-red-900/40"
                              title="Delete follow-up"
                            >
                              <Trash2 size={11} />
                              <span>Delete</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Add Task Form */}
            {isAddingTask ? (
              <form onSubmit={handleAddTask} className="rounded-xl border border-emerald-500/50 bg-[#1C321F] p-3 text-xs space-y-2.5">
                <div className="flex items-center gap-2">
                  <select
                    value={newTaskRecordType}
                    onChange={(e) => {
                      setNewTaskRecordType(e.target.value as any);
                      setNewTaskRecordId('');
                    }}
                    className="rounded-lg border border-[#2E4E36] bg-[#122314] px-2 py-1 text-xs text-white focus:outline-none"
                  >
                    <option value="lead">Lead</option>
                    <option value="customer">Customer</option>
                  </select>

                  <select
                    value={newTaskRecordId}
                    onChange={(e) => setNewTaskRecordId(e.target.value)}
                    className="flex-1 rounded-lg border border-[#2E4E36] bg-[#122314] px-2 py-1 text-xs text-white focus:outline-none"
                  >
                    {newTaskRecordType === 'lead'
                      ? (leadsQ.data?.items ?? []).map((l: any) => (
                          <option key={l.id} value={l.id}>
                            {l.name} ({l.company || 'Lead'})
                          </option>
                        ))
                      : (custsQ.data?.items ?? []).map((c: any) => (
                          <option key={c.id} value={c.id}>
                            {c.displayName || c.legalName}
                          </option>
                        ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={newTaskType}
                    onChange={(e) => setNewTaskType(e.target.value)}
                    className="rounded-lg border border-[#2E4E36] bg-[#122314] px-2 py-1 text-xs text-white focus:outline-none"
                  >
                    <option value="call">Call</option>
                    <option value="whatsapp">WhatsApp</option>
                    <option value="email">Email</option>
                    <option value="visit">Visit</option>
                    <option value="other">Other</option>
                  </select>

                  <input
                    type="time"
                    value={newTaskTime}
                    onChange={(e) => setNewTaskTime(e.target.value)}
                    className="rounded-lg border border-[#2E4E36] bg-[#122314] px-2 py-1 text-xs text-white focus:outline-none"
                  />
                </div>

                <input
                  type="text"
                  required
                  placeholder="Follow-up subject / agenda..."
                  value={newTaskNote}
                  onChange={(e) => setNewTaskNote(e.target.value)}
                  className="w-full rounded-lg border border-[#2E4E36] bg-[#122314] px-2.5 py-1.5 text-xs text-white placeholder-emerald-400/50 focus:border-emerald-400 focus:outline-none"
                  autoFocus
                />

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsAddingTask(false)}
                    className="rounded-lg px-2.5 py-1 text-[11px] text-emerald-300 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={addingBusy}
                    className="rounded-lg bg-[#3D7952] px-3 py-1 text-[11px] font-bold text-white hover:bg-emerald-600 shadow-xs"
                  >
                    {addingBusy ? 'Saving...' : 'Save Follow-up'}
                  </button>
                </div>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setIsAddingTask(true)}
                className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-[#2E4E36] py-2 text-xs font-semibold text-emerald-200 hover:text-white hover:border-emerald-400 hover:bg-[#28492C] transition-all"
              >
                <Plus size={14} />
                <span>Add Task</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* RESCHEDULE MODAL DIALOG */}
      {reschedulingItem && (
        <Dialog
          open
          onClose={() => setReschedulingItem(null)}
          title="Reschedule Follow-up"
          footer={
            <>
              <Button variant="secondary" onClick={() => setReschedulingItem(null)}>
                Cancel
              </Button>
              <Button busy={rescheduleBusy} onClick={() => void handleReschedule()}>
                Confirm Reschedule
              </Button>
            </>
          }
        >
          <div className="space-y-3">
            <p className="text-xs text-[#778477]">
              Rescheduling follow-up with <b>{reschedulingItem.partyName}</b>:
            </p>
            <div className="rounded-lg bg-[#F5F9F2] p-2.5 text-xs text-[#202820] border border-[#DCE7D9]">
              <span className="font-semibold">{reschedulingItem.title}</span>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#202820] mb-1">
                New Date & Time (IST)
              </label>
              <input
                type="datetime-local"
                required
                value={newDueAt}
                onChange={(e) => setNewDueAt(e.target.value)}
                className="w-full rounded-xl border border-[#DCE7D9] bg-white px-3 py-2 text-sm text-[#202820] focus:border-[#3D7952] focus:outline-none"
              />
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}

function FollowUpCard({
  item,
  compact,
  onToggle,
  onReschedule,
  onDelete,
}: {
  item: FollowUpItem;
  compact?: boolean;
  onToggle(): void;
  onReschedule(): void;
  onDelete(): void;
}) {
  const IconComp = TYPE_ICONS[item.type] || Tag;
  const partyLink = item.recordType === 'customer' ? `/customers/${item.recordId}` : `/leads/${item.recordId}`;

  return (
    <div
      className={`rounded-xl border p-3 flex flex-col justify-between transition-all ${
        item.completed
          ? 'bg-gray-50 border-gray-200 opacity-70'
          : item.isOverdue
          ? 'bg-red-50/70 border-red-300'
          : 'bg-white border-[#DCE7D9] hover:border-[#3D7952]/40 shadow-2xs'
      }`}
    >
      <div>
        <div className="flex items-start gap-2">
          <button
            type="button"
            onClick={onToggle}
            className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border mt-0.5 transition-colors ${
              item.completed
                ? 'border-emerald-500 bg-emerald-500 text-white'
                : item.isOverdue
                ? 'border-red-400 bg-transparent hover:border-red-500'
                : 'border-[#778477] bg-transparent hover:border-[#202820]'
            }`}
          >
            {item.completed && <Check size={11} strokeWidth={3} />}
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[10px] font-semibold text-[#778477] uppercase flex items-center gap-1">
                <IconComp size={10} />
                {item.type}
              </span>
              <span className="text-[10px] font-mono text-[#778477]">{item.istTime}</span>
            </div>
            <p
              className={`text-xs font-semibold mt-0.5 line-clamp-2 ${
                item.completed ? 'line-through text-[#778477]' : 'text-[#202820]'
              }`}
            >
              {item.title}
            </p>
          </div>
        </div>

        <div className="mt-2 flex items-center justify-between text-xs">
          <Link
            to={partyLink}
            className="text-xs font-semibold text-[#3D7952] hover:underline flex items-center gap-1 truncate max-w-[150px]"
          >
            <span className="truncate">{item.partyName}</span>
            <ExternalLink size={10} className="shrink-0" />
          </Link>
          {item.isOverdue && !item.completed && (
            <span className="rounded bg-red-100 text-red-700 px-1.5 py-0.2 text-[9px] font-bold uppercase">
              Overdue
            </span>
          )}
        </div>
      </div>

      <div className="mt-2.5 pt-1.5 border-t border-[#DCE7D9]/60 flex items-center justify-end gap-1.5">
        <button
          type="button"
          onClick={onReschedule}
          className="text-[11px] font-medium text-[#778477] hover:text-[#202820] px-1.5 py-0.5 rounded hover:bg-[#F5F9F2] transition-colors"
          title="Reschedule"
        >
          Reschedule
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="text-[11px] font-medium text-red-600 hover:text-red-700 px-1.5 py-0.5 rounded hover:bg-red-50 transition-colors"
          title="Delete"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
