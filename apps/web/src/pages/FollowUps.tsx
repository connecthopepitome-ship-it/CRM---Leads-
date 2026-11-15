/** SCR-008 Follow-ups Calendar Workspace (Grovia-inspired Minimalist SaaS Design System) */
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { get, patch } from '../lib/api';
import { dateTime } from '../lib/format';
import { useAction } from '../features/hooks';
import { Badge, Button, EmptyState, ErrorState, LinkButton, Skeleton, toast } from '../ui';
import { 
  ChevronLeft, ChevronRight, Plus, Check, Clock, Calendar, 
  CheckSquare, Phone, FileText, User 
} from 'lucide-react';

interface CalendarTask {
  id: string;
  title: string;
  customer: string;
  time: string;
  completed: boolean;
}

const SAMPLE_TASKS_BY_DATE: Record<number, CalendarTask[]> = {
  14: [
    {
      id: 'task-14-1',
      title: 'Follow-up with Rahul Gupta',
      customer: 'Gupta Steel Traders',
      time: '10:00 AM',
      completed: false,
    },
    {
      id: 'task-14-2',
      title: 'Quotation discussion - Nair Foods',
      customer: 'Nair Foods Pvt Ltd',
      time: '02:00 PM',
      completed: false,
    },
    {
      id: 'task-14-3',
      title: 'Call Sharma Textiles',
      customer: 'Sharma Textiles',
      time: '04:00 PM',
      completed: false,
    },
  ],
  15: [
    {
      id: 'task-15-1',
      title: 'Contract review with Deepa Reddy',
      customer: 'Reddy Tech Solutions',
      time: '11:00 AM',
      completed: false,
    },
    {
      id: 'task-15-2',
      title: 'Payment reminder for milestone 2',
      customer: 'Khan Enterprises',
      time: '03:30 PM',
      completed: false,
    },
  ],
  17: [
    {
      id: 'task-17-1',
      title: 'Finalize SLA terms with Mohan Das',
      customer: 'Das Precision Tools',
      time: '01:00 PM',
      completed: false,
    },
  ],
};

export default function FollowUps() {
  const [params, setParams] = useSearchParams();
  const [calendarView, setCalendarView] = useState<'month' | 'week' | 'day'>('month');
  const [selectedDay, setSelectedDay] = useState<number>(14); // 14 Nov matching Grovia Screen 5

  const [dateTasks, setDateTasks] = useState(SAMPLE_TASKS_BY_DATE);
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskTime, setNewTaskTime] = useState('11:00 AM');
  const [newTaskCustomer, setNewTaskCustomer] = useState('');

  const currentTasks = dateTasks[selectedDay] || [];

  const toggleTask = (id: string) => {
    setDateTasks((prev) => ({
      ...prev,
      [selectedDay]: (prev[selectedDay] || []).map((t) =>
        t.id === id ? { ...t, completed: !t.completed } : t
      ),
    }));
    toast('Task status updated');
  };

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    const newTask: CalendarTask = {
      id: `task-${Date.now()}`,
      title: newTaskTitle.trim(),
      customer: newTaskCustomer.trim() || 'General Client',
      time: newTaskTime || '10:00 AM',
      completed: false,
    };

    setDateTasks((prev) => ({
      ...prev,
      [selectedDay]: [...(prev[selectedDay] || []), newTask],
    }));

    setIsAddingTask(false);
    setNewTaskTitle('');
    setNewTaskCustomer('');
    toast('Follow-up scheduled');
  };

  // Calendar dates matrix for November 2026 (Nov 1 is Sunday)
  // Matching Mon-Sun alignment:
  // Mon: 26, 2, 9, 16, 23, 30
  const calendarDays = [
    { day: 26, isCurrentMonth: false },
    { day: 27, isCurrentMonth: false },
    { day: 28, isCurrentMonth: false },
    { day: 29, isCurrentMonth: false },
    { day: 30, isCurrentMonth: false },
    { day: 31, isCurrentMonth: false },
    { day: 1, isCurrentMonth: true },

    { day: 2, isCurrentMonth: true },
    { day: 3, isCurrentMonth: true },
    { day: 4, isCurrentMonth: true },
    { day: 5, isCurrentMonth: true },
    { day: 6, isCurrentMonth: true },
    { day: 7, isCurrentMonth: true },
    { day: 8, isCurrentMonth: true },

    { day: 9, isCurrentMonth: true },
    { day: 10, isCurrentMonth: true },
    { day: 11, isCurrentMonth: true },
    { day: 12, isCurrentMonth: true },
    { day: 13, isCurrentMonth: true },
    { day: 14, isCurrentMonth: true },
    { day: 15, isCurrentMonth: true },

    { day: 16, isCurrentMonth: true },
    { day: 17, isCurrentMonth: true },
    { day: 18, isCurrentMonth: true },
    { day: 19, isCurrentMonth: true },
    { day: 20, isCurrentMonth: true },
    { day: 21, isCurrentMonth: true },
    { day: 22, isCurrentMonth: true },

    { day: 23, isCurrentMonth: true },
    { day: 24, isCurrentMonth: true },
    { day: 25, isCurrentMonth: true },
    { day: 26, isCurrentMonth: true },
    { day: 27, isCurrentMonth: true },
    { day: 28, isCurrentMonth: true },
    { day: 29, isCurrentMonth: true },

    { day: 30, isCurrentMonth: true },
  ];

  return (
    <div className="space-y-5 pb-8">
      {/* ============================================================== */}
      {/* 1. TOP HEADER & VIEW TOGGLES */}
      {/* ============================================================== */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#202820]">
            Follow-ups
          </h1>
          <p className="text-xs sm:text-sm text-[#778477] mt-0.5">
            Plan and manage your scheduled customer follow-ups.
          </p>
        </div>

        {/* View Switcher Pills: Month | Week | Day */}
        <div className="inline-flex rounded-full bg-[#E3EFDF]/70 p-1 border border-[#DCE7D9]">
          {(['month', 'week', 'day'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setCalendarView(v)}
              className={`rounded-full px-3.5 py-1 text-xs font-semibold capitalize transition-all ${
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

      {/* ============================================================== */}
      {/* 2. GROVIA SCREEN 5: CALENDAR WORKSPACE + RIGHT DAY TASK PANEL */}
      {/* ============================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* LEFT / CENTER: Calendar Grid Card (8 cols) */}
        <div className="rounded-2xl border border-[#DCE7D9] bg-white p-5 shadow-2xs space-y-4 lg:col-span-8">
          {/* Calendar Controls */}
          <div className="flex items-center justify-between border-b border-[#DCE7D9]/60 pb-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedDay(14)}
                className="rounded-full border border-[#DCE7D9] bg-[#F5F9F2] px-3 py-1 text-xs font-semibold text-[#202820] hover:bg-[#E3EFDF]"
              >
                Today
              </button>
              <div className="flex items-center gap-1">
                <button className="rounded-lg p-1 text-[#778477] hover:text-[#202820] hover:bg-[#F5F9F2]">
                  <ChevronLeft size={16} />
                </button>
                <span className="text-xs font-bold text-[#202820] px-1">Nov 2026</span>
                <button className="rounded-lg p-1 text-[#778477] hover:text-[#202820] hover:bg-[#F5F9F2]">
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>

            <div className="flex items-center gap-3 text-xs text-[#778477]">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[#3D7952]" />
                Scheduled
              </span>
            </div>
          </div>

          {/* Days of Week Header (Mon - Sun) */}
          <div className="grid grid-cols-7 text-center text-xs font-semibold text-[#778477] border-b border-[#DCE7D9]/40 pb-2">
            <span>Mon</span>
            <span>Tue</span>
            <span>Wed</span>
            <span>Thu</span>
            <span>Fri</span>
            <span>Sat</span>
            <span>Sun</span>
          </div>

          {/* 7-column Date Grid */}
          <div className="grid grid-cols-7 gap-1.5 text-center text-xs font-medium">
            {calendarDays.map((item, idx) => {
              const isSelected = item.isCurrentMonth && item.day === selectedDay;
              const hasTasks = item.isCurrentMonth && (dateTasks[item.day]?.length ?? 0) > 0;

              return (
                <button
                  key={idx}
                  type="button"
                  disabled={!item.isCurrentMonth}
                  onClick={() => setSelectedDay(item.day)}
                  className={`relative flex flex-col items-center justify-center h-12 rounded-xl transition-all ${
                    !item.isCurrentMonth
                      ? 'text-[#778477]/30 cursor-default'
                      : isSelected
                      ? 'bg-[#233D2D] text-white font-bold shadow-xs'
                      : 'hover:bg-[#E3EFDF]/70 text-[#202820]'
                  }`}
                >
                  <span>{item.day}</span>
                  {hasTasks && (
                    <span
                      className={`h-1.5 w-1.5 rounded-full mt-0.5 ${
                        isSelected ? 'bg-emerald-300' : 'bg-[#3D7952]'
                      }`}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* RIGHT: Tasks on Selected Date Panel (Dark Forest Green, 4 cols) */}
        <div className="rounded-2xl border border-[#2E4E36] bg-[#203923] text-white p-5 shadow-lg space-y-4 lg:col-span-4">
          <div className="flex items-center justify-between border-b border-[#2E4E36] pb-3">
            <div>
              <h2 className="text-sm font-bold text-white tracking-tight">
                Tasks on {selectedDay} Nov
              </h2>
              <p className="text-[11px] text-emerald-300/70">
                {currentTasks.length} scheduled follow-ups
              </p>
            </div>
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#2E4E36] text-[11px] text-emerald-200 font-bold">
              {currentTasks.length}
            </span>
          </div>

          {/* Tasks List */}
          <div className="space-y-2.5 min-h-[220px]">
            {currentTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-44 text-center">
                <CheckSquare size={28} className="text-emerald-500/40 mb-1.5" />
                <p className="text-xs font-semibold text-emerald-200">No tasks on this day</p>
                <p className="text-[11px] text-emerald-300/60 mt-0.5">
                  Click below to schedule a follow-up.
                </p>
              </div>
            ) : (
              currentTasks.map((t) => (
                <div
                  key={t.id}
                  className={`rounded-xl p-3 border transition-colors ${
                    t.completed
                      ? 'bg-[#1C321F]/60 border-[#2E4E36]/40 opacity-70'
                      : 'bg-[#1C321F] border-[#2E4E36] hover:bg-[#28492C]'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <button
                      type="button"
                      onClick={() => toggleTask(t.id)}
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border mt-0.5 transition-colors ${
                        t.completed
                          ? 'border-emerald-400 bg-emerald-500 text-white'
                          : 'border-emerald-400/60 bg-transparent hover:border-emerald-300'
                      }`}
                    >
                      {t.completed && <Check size={11} strokeWidth={3} />}
                    </button>
                    <div className="min-w-0 flex-1">
                      <p
                        className={`text-xs font-semibold ${
                          t.completed ? 'line-through text-emerald-300/60' : 'text-white'
                        }`}
                      >
                        {t.title}
                      </p>
                      <div className="mt-1 flex items-center justify-between text-[10px] text-emerald-300/80">
                        <span className="flex items-center gap-1 font-mono">
                          <Clock size={10} className="text-emerald-400" />
                          {t.time}
                        </span>
                        <span className="truncate max-w-[120px] rounded-xs bg-[#2E4E36] px-1.5 py-0.2 text-[10px] text-emerald-200">
                          {t.customer}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Add Task Form */}
          {isAddingTask ? (
            <form onSubmit={handleAddTask} className="rounded-xl border border-emerald-500/50 bg-[#1C321F] p-3 text-xs space-y-2">
              <input
                type="text"
                required
                placeholder="Follow-up subject..."
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                className="w-full rounded-lg border border-[#2E4E36] bg-[#122314] px-2.5 py-1.5 text-xs text-white placeholder-emerald-400/50 focus:border-emerald-400 focus:outline-none"
                autoFocus
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="e.g. 11:30 AM"
                  value={newTaskTime}
                  onChange={(e) => setNewTaskTime(e.target.value)}
                  className="rounded-lg border border-[#2E4E36] bg-[#122314] px-2 py-1 text-xs text-white placeholder-emerald-400/50 focus:border-emerald-400 focus:outline-none"
                />
                <input
                  type="text"
                  placeholder="Customer name"
                  value={newTaskCustomer}
                  onChange={(e) => setNewTaskCustomer(e.target.value)}
                  className="rounded-lg border border-[#2E4E36] bg-[#122314] px-2 py-1 text-xs text-white placeholder-emerald-400/50 focus:border-emerald-400 focus:outline-none"
                />
              </div>
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
                  className="rounded-lg bg-[#3D7952] px-3 py-1 text-[11px] font-bold text-white hover:bg-emerald-600 shadow-xs"
                >
                  Save Follow-up
                </button>
              </div>
            </form>
          ) : (
            <button
              onClick={() => setIsAddingTask(true)}
              className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-[#2E4E36] py-2 text-xs font-semibold text-emerald-200 hover:text-white hover:border-emerald-400 hover:bg-[#28492C] transition-all"
            >
              <Plus size={14} />
              <span>Add Task</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
