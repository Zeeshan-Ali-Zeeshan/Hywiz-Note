import React, { useEffect, useMemo, useState, useRef } from 'react';
import ReactDOM from 'react-dom';
import { NodeViewWrapper, NodeViewContent } from '@tiptap/react';
import { Node as ProseMirrorNode } from '@tiptap/pm/model';
import {
  Check,
  Calendar,
  RotateCw,
  RefreshCw,
  AlertTriangle,
  Clock,
  CircleUser,
  Ellipsis,
  X,
  Flag,
  Globe,
  Search,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileText,
  Trash2,
  User,
  BellRing,
  AlarmClock,
  Link,
  BellOff,
  CalendarCog,
} from 'lucide-react';
import axios from 'axios';
import { useAuthStore } from '../../../stores/useAuthStore';
import { useNotesStore } from '../../../stores/useNotesStore';
import { useTasksStore } from '../../../stores/useTasksStore';
import {
  format,
  addDays,
  nextMonday,
  isToday as isDateToday,
  getDay,
  getDate
} from 'date-fns';

interface TaskItemComponentProps {
  node: ProseMirrorNode;
  updateAttributes: (attrs: Record<string, any>) => void;
  selected: boolean;
  editor?: any;
  getPos: () => number;
}

type PanelType = 'priority' | 'date' | 'recurring' | 'assignee' | 'more' | 'time' | 'timezone';


// ─── Floating Panel Modal (via Portal) ────────────────────────────────────────
interface FloatingPanelProps {
  title: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  hideHeader?: boolean;
}

const FloatingPanel: React.FC<FloatingPanelProps> = ({ title, onClose, children, className, hideHeader }) => {
  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return ReactDOM.createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-[2px]"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className={`relative w-full mx-4 flex flex-col animate-in fade-in zoom-in-95 duration-150 ${className || 'max-w-lg rounded-xl shadow-2xl theme-glass-panel'}`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        {!hideHeader && (
          <div
            className="flex items-center justify-between px-5 pt-4 pb-1 rounded-t-2xl"
          >
            <span className="text-[15px] font-semibold text-slate-900 dark:text-slate-100 black:text-slate-50 tracking-tight">
              {title}
            </span>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 black:hover:text-slate-100 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 black:hover:bg-[#2a2a2a] transition-all"
            >
              <X className="w-[18px] h-[18px]" />
            </button>
          </div>
        )}

        {/* Body */}
        <div className={hideHeader ? "" : "px-5 py-4"}>
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
};

// ─── Helper: Derive recurringPattern enum from an RRule string ─────────────────
// Keeps the simple enum (used by backend completeTask) in sync with the full rule.
function deriveRecurringPattern(rule: string | null): string | null {
  if (!rule) return null;
  if (rule.includes('FREQ=DAILY')) return 'daily';
  if (rule.includes('FREQ=WEEKLY')) return 'weekly';
  if (rule.includes('FREQ=MONTHLY')) return 'monthly';
  if (rule.includes('FREQ=YEARLY')) return 'yearly';
  return null;
}

// ─── Main Component ────────────────────────────────────────────────────────────
export const TaskItemComponent: React.FC<TaskItemComponentProps> = ({
  node,
  updateAttributes,
  selected,
  editor
}) => {
  const { token } = useAuthStore();
  const { fetchTasks } = useTasksStore();
  const [activePanel, setActivePanel] = useState<PanelType | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  const {
    taskId,
    snapshotStatus,
    snapshotEtag,
    dueDateWall,
    priority,
    isRecurring,
    recurrenceRule,
    description,
    reminder,
    tags = []
  } = node.attrs;

  const [tempDueDate, setTempDueDate] = useState<string | null>(dueDateWall);
  const [tempRecurrence, setTempRecurrence] = useState<string | null>(recurrenceRule);
  const [isTimeVisible, setIsTimeVisible] = useState(!!dueDateWall && dueDateWall.includes('T') && !dueDateWall.includes('T00:00:00'));
  const [showRecurrenceDropdown, setShowRecurrenceDropdown] = useState(false);
  const [previousPanel, setPreviousPanel] = useState<PanelType | null>(null);
  const [recurringOrigin, setRecurringOrigin] = useState<PanelType | null>(null);

  const [hours, setHours] = useState('12');
  const [minutes, setMinutes] = useState('00');
  const [ampm, setAmpm] = useState<'AM' | 'PM'>('PM');
  const defaultTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Karachi';
  const [timezone, setTimezone] = useState(node.attrs.timezone || defaultTimezone);
  const [timezoneSearch, setTimezoneSearch] = useState('');

  const isCompleted = snapshotStatus === 'completed';
  const isOverdue = dueDateWall && new Date(dueDateWall) < new Date() && !isCompleted;

  // Local state for inputs to avoid laggy typing
  const [localDesc, setLocalDesc] = useState<string>(description || '');
  const [assigneeSearch, setAssigneeSearch] = useState('');
  const [localIsFlagged, setLocalIsFlagged] = useState<boolean>(node.attrs.isFlagged || false);


  useEffect(() => {
    setLocalDesc(description || '');
  }, [description]);

  useEffect(() => {
    setLocalIsFlagged(node.attrs.isFlagged || false);
  }, [node.attrs.isFlagged]);

  useEffect(() => {
    const resolvedTimezone = node.attrs.timezone || defaultTimezone;
    setTimezone(resolvedTimezone);
  }, [node.attrs.timezone]);

  // Update temp state when attributes change
  useEffect(() => {
    if (activePanel === 'date' || activePanel === 'recurring') {
      setTempDueDate(dueDateWall);
      setTempRecurrence(recurrenceRule);
      // Determine if time is visible based on whether dueDateWall has a time part other than T00:00:00
      if (dueDateWall && dueDateWall.includes('T')) {
        const timePart = dueDateWall.split('T')[1];
        if (timePart !== '00:00:00') {
          setIsTimeVisible(true);
          const [h, m] = timePart.split(':');
          let hr = parseInt(h);
          const period = hr >= 12 ? 'PM' : 'AM';
          hr = hr % 12 || 12;
          setHours(String(hr).padStart(2, '0'));
          setMinutes(m.padStart(2, '0'));
          setAmpm(period);
        } else {
          setIsTimeVisible(false);
        }
      } else {
        setIsTimeVisible(false);
      }
    }
  }, [activePanel, dueDateWall, recurrenceRule]);

  // DRIFT PROTECTION: Fetch latest state on mount
  useEffect(() => {
    if (taskId && token) {
      fetchTaskState();
    }
  }, [taskId, token]);

  const fetchTaskState = async () => {
    if (!taskId || !token) return;

    try {
      const response = await axios.get(`http://localhost:3001/api/tasks?taskId=${taskId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data && response.data.length > 0) {
        const remoteTask = response.data[0];

        const updates: any = {
          snapshotStatus: remoteTask.status,
          checked: remoteTask.status === 'completed',
          snapshotEtag: remoteTask.etag,
          priority: remoteTask.priority,
          dueDateWall: remoteTask.dueDateWall,
          description: remoteTask.description,
          reminder: remoteTask.reminder,
          tags: remoteTask.tags || []
        };

        if (remoteTask.isRecurring || remoteTask.recurrenceRule) {
          updates.isRecurring = true;
          updates.recurrenceRule = remoteTask.recurrenceRule;
          updates.recurringPattern = remoteTask.recurringPattern;
        } else if (remoteTask.seriesId && remoteTask.seriesId.rule) {
          updates.isRecurring = true;
          updates.recurrenceRule = remoteTask.seriesId.rule;
        } else {
          updates.isRecurring = false;
          updates.recurrenceRule = null;
        }

        updateAttributes(updates);
      }

    } catch (error) {
      console.error('[TASK SYNC] Failed to fetch latest state:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleToggle = async () => {
    if (isSyncing) return;

    const newStatus = isCompleted ? 'pending' : 'completed';

    updateAttributes({
      snapshotStatus: newStatus,
      checked: newStatus === 'completed',
      dirty: true
    });

    if (!taskId) {
      await createTaskAndToggle(newStatus);
    } else {
      if (newStatus === 'completed') {
        await completeTaskBackend();
      } else {
        await updateTaskBackend({ status: 'pending' });
      }
    }
  };

  const createTaskAndToggle = async (status: string) => {
    setIsSyncing(true);
    setSyncError(null);
    try {
      const shouldCompleteRecurringAfterCreate = status === 'completed' && !!isRecurring && !!recurrenceRule;
      const response = await axios.post('http://localhost:3001/api/tasks', {
        title: node.textContent || 'New Task',
        status: shouldCompleteRecurringAfterCreate ? 'pending' : status,
        priority: priority || 'medium',
        dueDateWall,          // ← use dueDateWall (matches backend)
        recurrenceRule: isRecurring ? recurrenceRule : null,
        isRecurring: isRecurring || false,
        recurringPattern: node.attrs.recurringPattern || null,
        description,
        tags,
        reminder
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const newTask = response.data;
      if (shouldCompleteRecurringAfterCreate) {
        const completeResponse = await axios.post(`http://localhost:3001/api/tasks/${newTask._id}/complete`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const { task } = completeResponse.data;
        updateAttributes({
          taskId: task._id,
          snapshotStatus: task.status,
          checked: task.status === 'completed',
          snapshotEtag: task.etag,
          dueDateWall: task.dueDateWall,
          isRecurring: task.isRecurring,
          recurrenceRule: task.recurrenceRule,
          recurringPattern: task.recurringPattern,
          priority: task.priority,
          reminder: task.reminder,
          description: task.description,
          tags: task.tags || [],
          dirty: false,
        });
      } else {
        updateAttributes({
          taskId: newTask._id,
          snapshotStatus: newTask.status,
          checked: newTask.status === 'completed',
          snapshotEtag: newTask.etag,
          dirty: false,
        });
      }
      // Refresh calendar store so the new task appears in Calendar
      fetchTasks();
    } catch (err) {
      console.error('Failed to create task:', err);
      setSyncError('Offline');
    } finally {
      setIsSyncing(false);
    }
  };

  const completeTaskBackend = async () => {
    setIsSyncing(true);
    try {
      const response = await axios.post(`http://localhost:3001/api/tasks/${taskId}/complete`, {}, {
        headers: {
          Authorization: `Bearer ${token}`,
          'If-Match': snapshotEtag
        }
      });

      const { task } = response.data;

      updateAttributes({
        snapshotStatus: task.status,
        checked: task.status === 'completed',
        snapshotEtag: task.etag,
        dueDateWall: task.dueDateWall,
        dirty: false,
        isRecurring: task.isRecurring,
        recurrenceRule: task.recurrenceRule,
        recurringPattern: task.recurringPattern,
        priority: task.priority,
        reminder: task.reminder,
        description: task.description,
        tags: task.tags || []
      });
      // Refresh Calendar so the advanced recurring task date is shown
      fetchTasks();

    } catch (err: any) {
      if (err.response?.status === 409) {
        setSyncError('Conflict: Task changed elsewhere');
        fetchTaskState();
      } else {
        console.error('Failed to complete task:', err);
        setSyncError('Sync Failed');
      }
    } finally {
      setIsSyncing(false);
    }
  };

  const updateTaskBackend = async (updates: any) => {
    setIsSyncing(true);
    try {
      const response = await axios.patch(`http://localhost:3001/api/tasks/${taskId}`, updates, {
        headers: {
          Authorization: `Bearer ${token}`,
          'If-Match': snapshotEtag
        }
      });

      updateAttributes({
        ...updates,
        ...(updates.status ? { checked: updates.status === 'completed' } : {}),
        snapshotEtag: response.data.etag,
        dirty: false
      });
      // Try optimistic store update instead of full fetchTasks to prevent UI lag
      const { tasks } = useTasksStore.getState();
      const existingTask = tasks.find(t => t.id === taskId || (t as any)._id === taskId);
      if (existingTask) {
        useTasksStore.setState({
          tasks: tasks.map(t => (t.id === taskId || (t as any)._id === taskId) ? { ...t, ...updates } : t)
        });
      } else {
        fetchTasks();
      }
    } catch (err: any) {
      console.error('Update failed:', err);
      if (err.response?.status === 409) setSyncError('Conflict');
    } finally {
      setIsSyncing(false);
    }
  };

  const handlePriorityChange = (newPriority: string) => {
    updateAttributes({ priority: newPriority });
    if (taskId) updateTaskBackend({ priority: newPriority });
  };


  const handleDescriptionUpdate = () => {
    updateAttributes({ description: localDesc });
    if (taskId) updateTaskBackend({ description: localDesc });
  };

  const persistSchedule = (nextDueDate: string | null, nextRecurrence: string | null) => {
    const dueDateToSave = nextRecurrence && !nextDueDate
      ? `${format(new Date(), 'yyyy-MM-dd')}T00:00:00`
      : nextDueDate;
    const derivedPattern = deriveRecurringPattern(nextRecurrence);
    const updates = {
      dueDateWall: dueDateToSave,
      recurrenceRule: nextRecurrence,
      isRecurring: !!nextRecurrence,
      recurringPattern: derivedPattern
    };

    setTempDueDate(dueDateToSave);
    setTempRecurrence(nextRecurrence);
    updateAttributes(updates);
    if (taskId) updateTaskBackend(updates);
  };


  const CustomRecurrencePanelContent = () => {
    // Freq: Daily, Weekly, Monthly, Yearly
    const [freq, setFreq] = useState<'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY'>('WEEKLY');
    const [interval, setInterval] = useState(1);
    const [byDay, setByDay] = useState<string[]>([]);
    const [endsOn, setEndsOn] = useState<'never' | 'on'>('never');
    const [untilDate, setUntilDate] = useState<string>(format(addDays(new Date(), 30), 'yyyy-MM-dd'));

    // Parse existing RRule
    useEffect(() => {
      if (tempRecurrence) {
        if (tempRecurrence.includes('FREQ=DAILY')) setFreq('DAILY');
        if (tempRecurrence.includes('FREQ=WEEKLY')) setFreq('WEEKLY');
        if (tempRecurrence.includes('FREQ=MONTHLY')) setFreq('MONTHLY');
        if (tempRecurrence.includes('FREQ=YEARLY')) setFreq('YEARLY');

        const intervalMatch = tempRecurrence.match(/INTERVAL=(\d+)/);
        if (intervalMatch) setInterval(parseInt(intervalMatch[1]));

        const byDayMatch = tempRecurrence.match(/BYDAY=([^;]+)/);
        if (byDayMatch) setByDay(byDayMatch[1].split(','));

        const untilMatch = tempRecurrence.match(/UNTIL=([^;]+)/);
        if (untilMatch) {
          setEndsOn('on');
          // Parse YYYYMMDD string or full ISO
          const dStr = untilMatch[1];
          if (dStr.length >= 8) {
            const y = dStr.substring(0, 4);
            const m = dStr.substring(4, 6);
            const d = dStr.substring(6, 8);
            setUntilDate(`${y}-${m}-${d}`);
          }
        }
      } else {
        // Default to current day for Weekly
        const dayNames = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
        setByDay([dayNames[new Date().getDay()]]);
      }
    }, []);

    const generateRule = () => {
      let rule = `FREQ=${freq};INTERVAL=${interval}`;
      if (freq === 'WEEKLY' && byDay.length > 0) {
        rule += `;BYDAY=${byDay.join(',')}`;
      }
      if (endsOn === 'on' && untilDate) {
        rule += `;UNTIL=${untilDate.replace(/-/g, '')}T235959Z`;
      }
      return rule;
    };

    const handleDone = () => {
      const rule = generateRule();
      setTempRecurrence(rule);
      // FIX H-1: Capture and immediately reset recurringOrigin BEFORE navigating
      // so that subsequent direct opens of the recurring panel don't mis-navigate back.
      const origin = recurringOrigin;
      setRecurringOrigin(null);
      if (origin === 'date') {
        setActivePanel('date');
      } else {
        persistSchedule(tempDueDate, rule);
        closePanel();
      }
    };

    const toggleDay = (day: string) => {
      setByDay(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
    };

    // FIX L-1: Use unique 2-letter labels so Tu/Th and Sa/Su are distinguishable
    const dayOptions = [
      { label: 'Su', value: 'SU' },
      { label: 'Mo', value: 'MO' },
      { label: 'Tu', value: 'TU' },
      { label: 'We', value: 'WE' },
      { label: 'Th', value: 'TH' },
      { label: 'Fr', value: 'FR' },
      { label: 'Sa', value: 'SA' }
    ];

    const intervalUnit: Record<string, string> = {
      DAILY: 'day',
      WEEKLY: 'week',
      MONTHLY: 'month',
      YEARLY: 'year'
    };

    function freqLabel(value: string) {
      switch (value) {
        case 'DAILY': return 'Daily';
        case 'WEEKLY': return 'Weekly';
        case 'MONTHLY': return 'Monthly';
        case 'YEARLY': return 'Annually';
        default: return value;
      }
    }
    const [dropdownOpen, setDropdownOpen] = useState(false);
    return (
      <div className="flex flex-col gap-8 py-2">
        {/* Repeats */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Repeats</span>
          <div className="relative">
            {/* Trigger */}
            <div
              className="flex items-center justify-between gap-1.5 theme-glass-card border border-slate-200 dark:border-slate-700/50 black:border-transparent rounded-md px-3 py-2 text-sm text-slate-700 dark:text-slate-200 black:text-slate-100 cursor-pointer transition-colors focus:ring-1 focus:ring-[#7C87FB]/50"
              onClick={() => setDropdownOpen((prev) => !prev)}
            >
              <span>{freqLabel(freq)}</span>
              <ChevronDown className="w-4 h-4 text-slate-700 dark:text-slate-500 black:text-slate-400" />
            </div>

            {/* Dropdown Menu */}
            {dropdownOpen && (
              <div className="absolute mt-1 bg-white dark:bg-slate-900 black:bg-[#12121a] border border-slate-200 dark:border-slate-700 black:border-[#262626] rounded-md shadow-lg z-50">
                {['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'].map((item) => (
                  <div
                    key={item}
                    className="px-3 py-2 text-sm text-slate-700 dark:text-slate-200 black:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 black:hover:bg-[#1a1a1a] cursor-pointer transition-colors"
                    onClick={() => {
                      setFreq(item as any);
                      setDropdownOpen(false);
                    }}
                  >
                    {freqLabel(item)}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Interval */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Interval</span>
          <div className="flex items-center gap-3">
            {/* FIX C-1: Removed readOnly — user can now type directly; chevrons always visible */}
            <div className="flex items-center gap-1">
              <input
                type="number"
                value={interval}
                min={1}
                max={999}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  if (!isNaN(val) && val >= 1) setInterval(val);
                }}
                className="w-16 theme-glass-card rounded-md px-3 py-2 text-center text-sm text-slate-700 dark:text-slate-200 black:text-slate-100 outline-none focus:ring-1 focus:ring-[#7C87FB]/50"
              />
              <div className="flex flex-col">
                <button onClick={() => setInterval(i => i + 1)} className="p-0.5 hover:text-indigo-400"><ChevronUp className="w-3 h-3" /></button>
                <button onClick={() => setInterval(i => Math.max(1, i - 1))} className="p-0.5 hover:text-indigo-400"><ChevronDown className="w-3 h-3" /></button>
              </div>
            </div>
            <span className="text-sm text-slate-400">{intervalUnit[freq]}{interval > 1 ? 's' : ''}</span>
          </div>
        </div>

        {/* On Days (Weekly only) */}
        {freq === 'WEEKLY' && (
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500 dark:text-slate-400">On days</span>
            <div className="flex gap-1.5">
              {dayOptions.map(day => (
                <button
                  key={day.value}
                  onClick={() => toggleDay(day.value)}
                  className={`w-8 h-8 flex items-center justify-center text-xs font-bold rounded-lg transition-all
                    ${byDay.includes(day.value)
                      ? 'bg-[#7C87FB] text-white shadow-sm scale-105'
                      : 'text-slate-500 black:text-slate-500 hover:text-slate-700 black:hover:text-slate-300'
                    }`}
                >
                  {day.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Starts */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Starts</span>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 theme-glass-card rounded-md px-3 py-2 text-sm text-slate-700 dark:text-slate-200 black:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 black:hover:bg-[#2a2a2a] cursor-pointer transition-colors">
              {tempDueDate ? format(new Date(tempDueDate), 'MMM d, yyyy') : 'No date'}
              <ChevronDown className="w-4 h-4 opacity-40" />
            </div>
            {!isTimeVisible ? (
              <button
                onClick={() => {
                  setTempRecurrence(generateRule());
                  setPreviousPanel('recurring');
                  setActivePanel('time');
                }}
                className="flex items-center gap-2 text-sm font-medium text-[#7C87FB] hover:text-indigo-300 transition-colors"
              >
                <Clock className="w-4 h-4" />
                Add a time
              </button>
            ) : (
              <div className="flex items-center gap-1.5 animate-in fade-in zoom-in-95 duration-150">
                <button
                  onClick={() => {
                    setTempRecurrence(generateRule());
                    setPreviousPanel('recurring');
                    setActivePanel('time');
                  }}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-medium backdrop-blur-[6px] bg-white/10 dark:bg-white/[0.06] black:bg-white/[0.04] border border-white/20 dark:border-white/[0.08] black:border-white/[0.06] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] text-slate-700 dark:text-slate-200 black:text-slate-100 hover:bg-white/20 dark:hover:bg-white/10 transition-all duration-200"
                >
                  <Clock className="w-3.5 h-3.5 text-sky-500 dark:text-sky-400 flex-shrink-0" />
                  <span>{hours}:{minutes} {ampm}</span>
                </button>
                <button
                  onClick={() => {
                    setIsTimeVisible(false);
                    if (tempDueDate) setTempDueDate(tempDueDate.split('T')[0] + 'T00:00:00');
                  }}
                  className="w-5 h-5 flex items-center justify-center text-slate-400 hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20 black:hover:bg-rose-950/20 rounded-full transition-all"
                  title="Remove time"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Ends */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Ends</span>
            <div className="flex items-center gap-6">
              {endsOn === 'on' && (
                <div className="flex justify-end">
                  <input
                    type="date"
                    value={untilDate}
                    onChange={(e) => setUntilDate(e.target.value)}
                    className="theme-glass-card rounded-md px-3 py-2 text-sm text-slate-700 dark:text-slate-200 black:text-slate-100 outline-none hover:bg-slate-100 dark:hover:bg-slate-800 black:hover:bg-[#2a2a2a] transition-colors focus:ring-2 focus:ring-[#7C87FB]/50"
                  />
                </div>
              )}
              <label className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="radio"
                  checked={endsOn === 'never'}
                  onChange={() => setEndsOn('never')}
                  className="hidden"
                />
                <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all ${endsOn === 'never' ? 'border-[#7C87FB] bg-[#7C87FB]/10' : 'border-slate-300 dark:border-slate-600 black:border-[#444]'}`}>
                  {endsOn === 'never' && <div className="w-2 h-2 rounded-full bg-[#7C87FB]" />}
                </div>
                <span className={`text-sm transition-colors ${endsOn === 'never' ? 'text-slate-900 dark:text-slate-100 black:text-slate-50 font-medium' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}>Never</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="radio"
                  checked={endsOn === 'on'}
                  onChange={() => setEndsOn('on')}
                  className="hidden"
                />
                <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all ${endsOn === 'on' ? 'border-[#7C87FB] bg-[#7C87FB]/10' : 'border-slate-300 dark:border-slate-600 black:border-[#444]'}`}>
                  {endsOn === 'on' && <div className="w-2 h-2 rounded-full bg-[#7C87FB]" />}
                </div>
                <span className={`text-sm transition-colors ${endsOn === 'on' ? 'text-slate-900 dark:text-slate-100 black:text-slate-50 font-medium' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}>On</span>
              </label>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 mt-2 border-t border-slate-100 dark:border-slate-800 black:border-[#262626]">
          <span className="text-[13px] font-medium text-slate-500 dark:text-slate-400 italic">
            {getRecurrenceLabel(tempDueDate ? new Date(tempDueDate) : new Date(), generateRule())}.
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => {
                if (recurringOrigin === 'date') {
                  setActivePanel('date');
                } else {
                  closePanel();
                }
              }}
              className="px-4 py-2 text-[12px] font-semibold text-slate-600 dark:text-[#888] black:text-[#888] bg-slate-100 dark:bg-white/5 black:bg-white/5 border border-slate-200 dark:border-white/10 black:border-white/10 rounded-lg transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleDone}
              className="px-6 py-2 rounded-lg font-semibold text-[12px] text-white bg-indigo-950 bg-[linear-gradient(90deg,#ff2df7_0%,#a855f7_45%,#3b82f6_100%),radial-gradient(circle_at_70%_30%,#93c5fd_0%,transparent_65%)] bg-blend-overlay border-2 border-purple-400/50 shadow-[0_0_5px_1px_rgba(168,85,247,0.5)] transition-all duration-300 hover:brightness-[1.1] hover:shadow-[0_0_6px_2px_rgba(168,85,247,0.7)] active:scale-95">
              Done
            </button>
          </div>
        </div>
      </div>
    );
  };

  const currentPattern = () => {
    if (!recurrenceRule) return 'daily';
    if (recurrenceRule.includes('WEEKLY')) return 'weekly';
    if (recurrenceRule.includes('MONTHLY')) return 'monthly';
    if (recurrenceRule.includes('YEARLY')) return 'yearly';
    return 'daily';
  };

  const openPanel = (panel: PanelType) => {
    setActivePanel(activePanel === panel ? null : panel);
  };

  const closePanel = () => setActivePanel(null);

  // ─── Panel Content ─────────────────────────────────────────────────────────

  const PriorityPanelContent = () => {
    const levels = [
      { id: 'critical', label: 'Critical', color: '#e11d48', desc: 'Must be done immediately' },
      { id: 'high', label: 'High', color: '#f97316', desc: 'Important, do soon' },
      { id: 'medium', label: 'Medium', color: '#eab308', desc: 'Normal priority' },
      { id: 'low', label: 'Low', color: '#22c55e', desc: 'No rush' },
    ] as const;

    return (
      <div className="flex flex-col gap-1">
        {levels.map(({ id, label, color, desc }) => {
          const isSelected = priority === id;
          return (
            <button
              key={id}
              onClick={() => { handlePriorityChange(id); closePanel(); }}
              className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-all duration-150 text-left
                ${isSelected
                  ? 'bg-gray-50 dark:bg-white/5 black:bg-white/5'
                  : 'hover:bg-gray-50 dark:hover:bg-white/5 black:hover:bg-white/5'
                }`}
              style={{ borderLeft: `3px solid ${isSelected ? color : 'transparent'}` }}
            >
              {/* Dot */}
              <span className="flex-shrink-0 w-2 h-2 rounded-full" style={{ background: color }} />

              {/* Text */}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-gray-800 dark:text-gray-100 black:text-gray-100 leading-tight">
                  {label}
                </div>
                <div className="text-xs text-gray-400 dark:text-gray-500 black:text-gray-500 mt-0.5">
                  {desc}
                </div>
              </div>

              {/* Checkmark if selected */}
              {isSelected && (
                <Check className="w-4 h-4 flex-shrink-0" style={{ color }} />
              )}
            </button>
          );
        })}

        {/* Clear priority */}
        {priority && (
          <button
            onClick={() => { handlePriorityChange(''); closePanel(); }}
            className="mt-1 w-full text-center text-xs text-gray-400 dark:text-gray-500 hover:text-rose-500 dark:hover:text-rose-400 py-2 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-all"
          >
            Clear priority
          </button>
        )}
      </div>
    );
  };


  const getRecurrenceLabel = (date: Date, rule: string | null) => {
    if (!rule) return 'Does not repeat';

    // FIX M-3: Parse INTERVAL so label says "Every 2 weeks" etc.
    const intervalMatch = rule.match(/INTERVAL=(\d+)/);
    const interval = intervalMatch ? parseInt(intervalMatch[1]) : 1;

    if (rule.includes('FREQ=DAILY')) {
      if (rule.includes('BYDAY=MO,TU,WE,TH,FR')) return 'Every weekday (Mon to Fri)';
      return interval > 1 ? `Every ${interval} days` : 'Daily';
    }
    if (rule.includes('FREQ=WEEKLY')) {
      // FIX M-2: Show ALL selected BYDAY days, not just the date's day
      const byDayMap: Record<string, string> = {
        MO: 'Mon', TU: 'Tue', WE: 'Wed', TH: 'Thu', FR: 'Fri', SA: 'Sat', SU: 'Sun'
      };
      const byDayMatch = rule.match(/BYDAY=([^;]+)/);
      const dayList = byDayMatch
        ? byDayMatch[1].split(',').map(d => byDayMap[d.trim()] || d).join(', ')
        : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][getDay(date)];
      return interval > 1 ? `Every ${interval} weeks on ${dayList}` : `Weekly on ${dayList}`;
    }
    if (rule.includes('FREQ=MONTHLY')) {
      const byMonthDayMatch = rule.match(/BYMONTHDAY=(\d+)/);
      const day = byMonthDayMatch ? byMonthDayMatch[1] : getDate(date);
      return interval > 1 ? `Every ${interval} months on day ${day}` : `Monthly on day ${day}`;
    }
    if (rule.includes('FREQ=YEARLY')) {
      return interval > 1
        ? `Every ${interval} years on ${format(date, 'MMMM')} ${getDate(date)}`
        : `Annually on ${format(date, 'MMMM')} ${getDate(date)}`;
    }
    return 'Custom...';
  };

  const DatePanelContent = () => {
    const displayDate = tempDueDate ? new Date(tempDueDate) : new Date();
    const [viewMonth, setViewMonth] = useState(displayDate);
    // FIX H-2: ref for recurrence dropdown click-outside detection
    const recDropdownRef = useRef<HTMLDivElement>(null);

    // FIX M-6: Reset dropdown state on mount so stale open state doesn't persist
    useEffect(() => { setShowRecurrenceDropdown(false); }, []);

    // FIX H-2: Close recurrence dropdown when clicking outside it
    useEffect(() => {
      if (!showRecurrenceDropdown) return;
      const handler = (e: MouseEvent) => {
        if (recDropdownRef.current && !recDropdownRef.current.contains(e.target as Node)) {
          setShowRecurrenceDropdown(false);
        }
      };
      document.addEventListener('mousedown', handler);
      return () => document.removeEventListener('mousedown', handler);
    }, [showRecurrenceDropdown]);

    const handleSelectDate = (date: Date) => {
      // Preserve existing time if any
      let newDateStr = format(date, "yyyy-MM-dd");
      if (isTimeVisible) {
        let h = parseInt(hours);
        if (ampm === 'PM' && h < 12) h += 12;
        if (ampm === 'AM' && h === 12) h = 0;
        newDateStr += `T${String(h).padStart(2, '0')}:${minutes.padStart(2, '0')}:00`;
      } else {
        newDateStr += 'T00:00:00';
      }
      setTempDueDate(newDateStr);
    };

    const handleShortCut = (type: 'today' | 'tomorrow' | 'monday' | 'week') => {
      let date = new Date();
      if (type === 'tomorrow') date = addDays(date, 1);
      if (type === 'monday') date = nextMonday(date);
      if (type === 'week') date = addDays(date, 7);
      handleSelectDate(date);
    };

    const handleSave = () => {
      persistSchedule(tempDueDate, tempRecurrence);
      closePanel();
    };

    const handleRemoveTime = () => {
      setIsTimeVisible(false);
      if (tempDueDate) {
        setTempDueDate(tempDueDate.split('T')[0] + 'T00:00:00');
      }
    };

    // Calendar logic
    const monthStart = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1);
    const startDay = monthStart.getDay();
    const daysInMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0).getDate();
    const calendarDays = [];
    for (let i = 0; i < startDay; i++) calendarDays.push(null);
    for (let i = 1; i <= daysInMonth; i++) calendarDays.push(new Date(viewMonth.getFullYear(), viewMonth.getMonth(), i));

    const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSave();
      }
    };

    return (
      <div className="flex flex-col gap-0 -mx-5 -mb-4 focus:outline-none" onKeyDown={handleKeyDown} tabIndex={0}>
        <div className="flex border-b border-slate-100 dark:border-slate-800 black:border-[#262626]">
          {/* Shortcuts */}
          <div className="w-1/3 p-4 flex flex-col gap-1 border-r border-slate-100 dark:border-slate-800 black:border-[#262626]">
            {['Today', 'Tomorrow', 'Next Monday', 'In a week'].map((label, idx) => {
              const types = ['today', 'tomorrow', 'monday', 'week'] as const;
              return (
                <button
                  key={label}
                  onClick={() => handleShortCut(types[idx])}
                  className="px-3 py-2 text-left text-sm font-medium text-slate-700 dark:text-slate-200 black:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 black:hover:bg-[#1a1a1a] rounded-lg transition-colors"
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* Mini Calendar */}
          <div className="w-2/3 p-4">
            <div className="flex items-center justify-between mb-4 px-2">
              <span className="text-sm font-bold text-slate-800 dark:text-slate-100 black:text-slate-50 uppercase tracking-tight">
                {format(viewMonth, 'MMMM yyyy')}
              </span>
              <div className="flex gap-1">
                <button
                  onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1))}
                  className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 black:hover:bg-[#1a1a1a] rounded-lg text-slate-400"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1))}
                  className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 black:hover:bg-[#1a1a1a] rounded-lg text-slate-400"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-0.5 text-center mb-1">
              {weekDays.map(d => (
                <span key={d} className="text-[10px] font-bold text-slate-400 uppercase">{d}</span>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((d, i) => {
                if (!d) return <div key={`empty-${i}`} className="w-8 h-8" />;
                const isSelected = tempDueDate && tempDueDate.startsWith(format(d, "yyyy-MM-dd"));
                const isToday = isDateToday(d);
                return (
                  <button
                    key={d.toISOString()}
                    onClick={() => handleSelectDate(d)}
                    className={`w-8 h-8 flex items-center justify-center text-xs rounded-full transition-all font-medium
                      ${isSelected
                        ? 'bg-[#7C87FB] text-white shadow-lg scale-110'
                        : isToday
                          ? 'text-[#7C87FB] font-bold underline'
                          : 'text-slate-600 dark:text-slate-300 black:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 black:hover:bg-[#1a1a1a]'
                      }`}
                  >
                    {d.getDate()}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Recurrence & Time Section */}
        <div className="p-4 flex flex-col gap-4">
          <div className="flex items-center gap-3">
            {/* Recurrence Dropdown — FIX H-2: wrapped in ref for click-outside */}
            <div className="relative" ref={recDropdownRef}>
              <button
                onClick={() => setShowRecurrenceDropdown(!showRecurrenceDropdown)}
                className="flex items-center gap-2 px-3 py-2 text-sm font-bold text-slate-600 dark:text-slate-400 black:text-slate-300 theme-glass-card rounded-md"
              >
                <RotateCw className="w-4 h-4" />
                {getRecurrenceLabel(displayDate, tempRecurrence)}
              </button>

              {showRecurrenceDropdown && (() => {
                // FIX C-2: Reliable BYDAY abbreviation via day-index lookup (not substring)
                const iCalDays = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
                const weeklyBYDAY = iCalDays[displayDate.getDay()];
                const weeklyRule = `FREQ=WEEKLY;BYDAY=${weeklyBYDAY}`;

                // FIX L-2: Detect if current tempRecurrence is a custom rule
                // (doesn't match any preset) so "Custom..." can be highlighted
                const presetRules = [
                  null,
                  'FREQ=DAILY',
                  'FREQ=DAILY;BYDAY=MO,TU,WE,TH,FR',
                  weeklyRule,
                  `FREQ=MONTHLY;BYMONTHDAY=${getDate(displayDate)}`,
                  'FREQ=YEARLY',
                ];
                const isCustomActive = !!tempRecurrence && !presetRules.includes(tempRecurrence);

                const presets = [
                  { label: 'Does not repeat', rule: null },
                  { label: 'Daily', rule: 'FREQ=DAILY' },
                  { label: 'Every weekday (Monday to Friday)', rule: 'FREQ=DAILY;BYDAY=MO,TU,WE,TH,FR' },
                  { label: `Weekly on ${format(displayDate, 'EEEE')}`, rule: weeklyRule },
                  { label: `Monthly on day ${getDate(displayDate)}`, rule: `FREQ=MONTHLY;BYMONTHDAY=${getDate(displayDate)}` },
                  { label: `Annually on ${format(displayDate, 'MMMM')} ${getDate(displayDate)}`, rule: 'FREQ=YEARLY' },
                  { label: 'Custom...', rule: 'CUSTOM' },
                ];
                return (
                  <div className=" absolute bottom-full left-0 mb-2 w-72 bg-white dark:bg-slate-900 black:bg-[#12121a] black:bg-gradient-to-b black:from-white/[0.04] black:via-white/[0.02] black:to-black/20 border border-slate-200 dark:border-slate-700 black:border-[#262626] rounded-lg shadow-2xl z-50 p-2 animate-in fade-in slide-in-from-bottom-2 duration-200">
                    <div className="flex flex-col gap-0.5">
                      {presets.map((item) => {
                        const isActive = item.rule === 'CUSTOM'
                          ? isCustomActive
                          : tempRecurrence === item.rule;
                        return (
                          <button
                            key={item.label}
                            onClick={() => {
                              if (item.rule === 'CUSTOM') {
                                setRecurringOrigin('date');
                                setActivePanel('recurring');
                              } else {
                                setTempRecurrence(item.rule);
                              }
                              setShowRecurrenceDropdown(false);
                            }}
                            className={`flex items-center justify-between px-3 py-2 text-sm rounded-lg transition-colors
                              ${isActive
                                ? 'bg-[#7C87FB]/10 text-[#7C87FB] font-bold'
                                : 'text-slate-600 dark:text-slate-300 black:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 black:hover:bg-[#262626]'
                              }`}
                          >
                            {item.label}
                            {isActive && <Check className="w-4 h-4" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Time Toggle */}
            {!isTimeVisible ? (
              <button
                onClick={() => { setPreviousPanel('date'); setActivePanel('time'); }}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-[#7C87FB] hover:bg-[#7C87FB]/10 rounded-md transition-all"
              >
                Add a time <Clock className="w-4 h-4" />
              </button>
            ) : (
              <div className="flex items-center gap-1.5 animate-in fade-in zoom-in-95 duration-150">
                <button
                  onClick={() => { setPreviousPanel('date'); setActivePanel('time'); }}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-medium backdrop-blur-[6px] bg-white/10 dark:bg-white/[0.06] black:bg-white/[0.04] border border-white/20 dark:border-white/[0.08] black:border-white/[0.06] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] text-slate-700 dark:text-slate-200 black:text-slate-100 hover:bg-white/20 dark:hover:bg-white/10 transition-all duration-200"
                >
                  <Clock className="w-3.5 h-3.5 text-sky-500 dark:text-sky-400 flex-shrink-0" />
                  <span>{hours}:{minutes} {ampm}</span>
                </button>
                <button
                  onClick={handleRemoveTime}
                  className="w-5 h-5 flex items-center justify-center text-slate-400 hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20 black:hover:bg-rose-950/20 rounded-full transition-all"
                  title="Remove time"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 pt-2 border-t border-slate-100 dark:border-slate-800 black:border-[#262626] flex items-center justify-between">
          <button
            onClick={() => {
              // FIX L-3: Confirm before silently deleting recurrence configuration
              if (!window.confirm('Remove the due date and recurrence settings for this task?')) return;
              updateAttributes({ dueDateWall: null, recurrenceRule: null, isRecurring: false, recurringPattern: null });
              if (taskId) updateTaskBackend({ dueDateWall: null, recurrenceRule: null, isRecurring: false, recurringPattern: null });
              closePanel();
            }}
            className="text-sm font-bold text-rose-500 hover:text-rose-600 transition-colors"
          >
            Delete due date
          </button>

          <div className="flex gap-2">
            <button
              onClick={closePanel}
              className="px-4 py-2 text-sm font-bold text-slate-600 dark:text-slate-400 black:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 black:hover:bg-[#1a1a1a] rounded-lg border border-slate-400 dark:border-slate-700 black:border-[#333] hover:border-slate-600 dark:hover:border-slate-700 black:hover:border-[#333] hover:text-slate-800 black:hover:text-[#333] transition-all" >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-6 py-2 rounded-lg font-semibold text-[12px] text-white bg-indigo-950 bg-[linear-gradient(90deg,#ff2df7_0%,#a855f7_45%,#3b82f6_100%),radial-gradient(circle_at_70%_30%,#93c5fd_0%,transparent_65%)] bg-blend-overlay border-2 border-purple-400/50 shadow-[0_0_5px_1px_rgba(168,85,247,0.5)] transition-all duration-300 hover:brightness-[1.1] hover:shadow-[0_0_6px_2px_rgba(168,85,247,0.7)] active:scale-95" >
              Done
            </button>
          </div>
        </div>
      </div >
    );
  };


  const AssigneePanelContent = () => {
    const handleAssign = (user?: any) => {
      const targetAssignee = user ? user.name : assigneeSearch;
      setAssigneeSearch(targetAssignee);
      updateAttributes({ assignee: targetAssignee });
      if (taskId) updateTaskBackend({ assignee: targetAssignee });
      closePanel();
    };

    return (
      <div className="flex flex-col gap-5">
        <hr className="border-slate-400 dark:border-slate-800 black:border-slate-500" />
        <p className="text-sm text-slate-600 dark:text-slate-300 black:text-slate-300 leading-relaxed px-1">
          Choose a contact or enter an email address. You can also assign a task to yourself.
        </p>

        <div className="relative">
          <input
            type="text"
            value={assigneeSearch}
            onChange={(e) => { setAssigneeSearch(e.target.value); }}
            placeholder="Add name or email"
            autoFocus
            className="w-full px-4 py-3 text-sm border border-slate-200 dark:border-slate-800 black:border-[#262626] rounded-lg bg-[#fff] dark:bg-slate-900/50 black:bg-[#0f0f0f] text-slate-700 dark:text-slate-200 focus:ring-[1px] focus:ring-[#7C87FB] focus:border-transparent outline-none transition-all placeholder:text-slate-500 shadow-sm"
          />
        </div>

        <div className="flex justify-end gap-3 mt-4 pt-4">
          <button
            onClick={closePanel}
            className="px-6 py-2.5 text-sm font-bold text-slate-600 dark:text-slate-400 black:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 black:hover:bg-[#1a1a1a] rounded-lg border border-slate-200 dark:border-slate-700 black:border-[#333] transition-all"
          >
            Cancel
          </button>
          <button
            onClick={() => handleAssign()}
            disabled={!assigneeSearch.trim()}
            className={`px-8 py-2.5 rounded-lg font-semibold text-[12px]
                text-white bg-indigo-950
                bg-[linear-gradient(90deg,#ff2df7_0%,#a855f7_45%,#3b82f6_100%),radial-gradient(circle_at_70%_30%,#93c5fd_0%,transparent_65%)]
                bg-blend-overlay
                border-2 border-purple-400/50
                shadow-[0_0_5px_1px_rgba(168,85,247,0.5)]
                transition-all duration-300
                hover:brightness-[1.1]
                hover:shadow-[0_0_6px_2px_rgba(168,85,247,0.7)]
                active:scale-95
              ${assigneeSearch.trim()
                ? 'bg-[#7C87FB] text-white hover:shadow-[#7C87FB]/20 hover:scale-[1.02]'
                : 'bg-slate-100 dark:bg-slate-800 black:bg-[#1a1a1a] text-slate-400 cursor-not-allowed shadow-none border border-slate-200 dark:border-slate-700 black:border-[#333]'
              }`}
          >
            Assign
          </button>
        </div>
      </div>
    );
  };

  const MorePanelContent = () => {
    const { user } = useAuthStore();
    const { notes, currentNote } = useNotesStore();
    const [showNotesDropdown, setShowNotesDropdown] = useState(false);
    const [showReminderDropdown, setShowReminderDropdown] = useState(false);
    // Reminder: derive initial state from the `reminder` node attribute
    const [enabled, setEnabled] = useState<boolean>(!!reminder);

    const handleFlagToggle = () => {
      const newVal = !localIsFlagged;
      setLocalIsFlagged(newVal);
      updateAttributes({ isFlagged: newVal });
      if (taskId) updateTaskBackend({ isFlagged: newVal });
    };

    const applyReminder = (minutesBefore: number) => {
      setEnabled(true);
      const base = dueDateWall ? new Date(dueDateWall) : new Date();
      base.setMinutes(base.getMinutes() - minutesBefore);
      const reminderStr = base.toISOString();
      updateAttributes({ reminder: reminderStr });
      if (taskId) updateTaskBackend({ reminder: reminderStr });
      setShowReminderDropdown(false);
    };

    const handleReminderToggle = () => {
      const newEnabled = !enabled;
      if (newEnabled) {
        setShowReminderDropdown(true);
      } else {
        setEnabled(false);
        setShowReminderDropdown(false);
        updateAttributes({ reminder: null });
        if (taskId) updateTaskBackend({ reminder: null });
      }
    };

    const handleDeleteTaskLocal = () => {
      if (window.confirm('Are you sure you want to delete this task?')) {
        // Soft-delete from backend first, then remove from editor
        if (taskId) {
          updateTaskBackend({ isDeleted: true }).then(() => {
            fetchTasks(); // refresh calendar after delete
          }).catch(() => { });
        }
        editor?.commands.deleteNode('taskItem');
        closePanel();
      }
    };

    const handleSave = () => {
      handleDescriptionUpdate();
      closePanel();
    };

    const cardClass = `rounded-[10px] p-3.5 flex flex-col relative theme-glass-card gap-5`;

    return (

      <div className='relative rounded-xl overflow-hidden'>
        <div className="flex flex-col p-5 gap-3 text-slate-800 dark:text-white black:text-white w-full font-sans max-h-[90vh] overflow-y-auto rounded-xl theme-glass-panel">

          {/* Header Section */}
          <div className="flex items-start justify-between">
            <div className="flex flex-col gap-0.5">
              <h2 className="text-[18px] font-bold tracking-tight text-slate-900 dark:text-white black:text-white">More Options</h2>
              <div className="text-[12px] text-slate-500 dark:text-[#7a7a7e] black:text-[#7a7a7e]">
                Created by <span className="text-slate-700 dark:text-[#bcbcc0] black:text-[#bcbcc0] font-medium">{user?.name || 'You'}</span>
              </div>
            </div>
            <button onClick={closePanel} className="text-slate-400 dark:text-[#555] black:text-[#555] hover:text-slate-800 dark:hover:text-white black:hover:text-white transition-colors p-1.5 hover:bg-slate-100 dark:hover:bg-white/10 black:hover:bg-white/10 rounded-lg mt-0.5">
              <X className="w-4.5 h-4.5" style={{ width: '18px', height: '18px' }} />
            </button>
          </div >

          {/* Top Bento Card: Title & Description */}
          < div className={`${cardClass} z-20`}>
            <div className="flex items-center justify-between gap-2.5 mb-2.5">
              <div className="flex items-center gap-2.5">
                <button
                  onClick={handleToggle}
                  className={`w-5 h-5 rounded-full flex flex-shrink-0 items-center justify-center border-2 transition-all ${isCompleted ? 'bg-[#7C87FB] border-[#7C87FB] shadow-[0_0_8px_rgba(124,135,251,0.5)]' : 'border-[#7C87FB] bg-transparent hover:bg-[#7C87FB]/10'}`}
                >
                  {isCompleted && <Check className="w-2.5 h-2.5 text-white" style={{ strokeWidth: 3 }} />}
                </button>
                <div className={`text-[15px] font-semibold text-slate-800 dark:text-white black:text-white ${isCompleted ? 'line-through opacity-50' : ''}`}>
                  {node.textContent || 'Task'}
                </div>
              </div>
              <div className="flex items-center gap-2.5">
                <div className="relative">
                  <button
                    onClick={() => setShowNotesDropdown(!showNotesDropdown)}
                    className="flex items-center gap-1.5 py-1 px-2 rounded-md text-[12px] font-medium text-slate-500 dark:text-[#888] black:text-[#888] hover:text-slate-800 dark:hover:text-white black:hover:text-white border border-slate-200 hover:border-slate-300 dark:border-white/10 dark:hover:border-white/50 black:border-white/10 black:hover:border-white/50 transition-colors"
                  >
                    <FileText className="w-3 h-3" />
                    {currentNote?.title || 'My Note'}
                    <ChevronDown className={`w-3 h-3 opacity-70 transition-transform duration-200 ${showNotesDropdown ? 'rotate-180' : ''}`} />
                  </button>

                  {showNotesDropdown && (
                    <div
                      className="absolute top-full right-0 mt-1.5 w-52 rounded-xl shadow-2xl z-50 py-1 overflow-hidden theme-glass-card"
                    >
                      <div className="text-[10px] font-bold text-slate-500 dark:text-[#555] black:text-[#555] uppercase tracking-widest px-3 py-2 border-b border-slate-100 dark:border-white/5 black:border-white/5">
                        Move to note
                      </div>
                      {notes.slice(0, 6).map((note) => (
                        <button
                          key={note._id}
                          onClick={() => {
                            // Actually move the task to the selected note
                            updateAttributes({ noteId: note._id });
                            if (taskId) updateTaskBackend({ noteId: note._id });
                            setShowNotesDropdown(false);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-1.5 text-[12px] text-slate-600 dark:text-[#bbb] black:text-[#bbb] text-left hover:bg-slate-50 dark:hover:bg-white/5 black:hover:bg-white/5 transition-colors"
                        >
                          <FileText className="w-3 h-3 text-slate-400 dark:text-[#555] black:text-[#555]" />
                          <span className="truncate">{note.title}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <textarea
              value={localDesc}
              onChange={(e) => setLocalDesc(e.target.value)}
              onInput={(e) => {
                e.currentTarget.style.height = 'auto';
                e.currentTarget.style.height = e.currentTarget.scrollHeight + 'px';
              }}
              placeholder="Add a descriptive note..."
              className="w-full rounded-lg p-2.5 theme-glass-description text-[12px] leading-relaxed min-h-[80px] max-h-[250px] overflow-y-auto outline-none transition-all text-slate-600 dark:text-[#aaa] black:text-[#aaa] placeholder:text-slate-400 dark:placeholder:text-[#444] black:placeholder:text-[#444]"
              style={{ colorScheme: 'auto', resize: 'none' }}
            />
          </div>

          {/* Middle 3 Cards */}
          <div className="grid grid-cols-3 gap-2.5">
            {/* Timeline Card */}
            < div className={cardClass}>
              <div className="flex items-center gap-1.5 text-[12px] text-slate-500 dark:text-[#7a7a8a] black:text-[#7a7a8a] mb-auto">
                <Calendar className="w-3.5 h-3.5 text-[#7C87FB] flex-shrink-0" />
                <h3 className="text-[13px] font-semibold text-slate-800 dark:text-white black:text-white">Due Date</h3>
              </div>
              <button
                onClick={() => openPanel('date')}
                className="w-full py-1.5 rounded-lg text-[12px] font-semibold text-slate-500 hover:text-slate-700 dark:text-[#bbb] dark:hover:text-white black:text-[#bbb] black:hover:text-white bg-slate-200/10 hover:bg-slate-200/80 dark:bg-black/30 dark:hover:bg-black/50 black:bg-white/5 black:hover:bg-black/50 border border-slate-200 hover:border-slate-300 dark:border-white/10 dark:hover:border-white/20 black:border-white/10 black:hover:border-white/20 transition-all text-center"
              >
                <div className="flex items-center justify-center gap-2">
                  <span>
                    {dueDateWall ? format(new Date(dueDateWall), 'MMM d, yyyy') : 'Set Date'}
                  </span>
                  <CalendarCog className="w-3 h-3" />
                </div>
              </button>
            </div >

            {/* Alerts Card */}
            < div className={cardClass}>
              <div className="flex items-center gap-1.5 text-[12px] text-slate-500 dark:text-[#7a7a8a] black:text-[#7a7a8a] mb-auto">
                <AlarmClock className="w-3.5 h-3.5 text-[#7C87FB] flex-shrink-0" />
                <h3 className="text-[13px] font-semibold text-slate-800 dark:text-white black:text-white">Reminder</h3>
              </div>
              <div className="relative w-full">
                <button
                  onClick={handleReminderToggle}
                  className={`relative w-full py-1.5 rounded-lg flex items-center justify-between px-4 transition-all duration-300 border overflow-hidden group active:scale-[0.97] 
                    ${enabled
                      ? "bg-gradient-to-br from-violet-600/90 to-blue-500/90 border-white/10 text-white shadow-[0_8px_30px_rgba(139,92,246,0.35)]"
                      : "bg-slate-100/80 hover:bg-slate-200/80 dark:bg-black/30 dark:hover:bg-black/50 black:bg-white/5 black:hover:bg-white/10 border-slate-200 hover:border-slate-300 dark:border-white/10 dark:hover:border-white/20 black:border-white/10 black:hover:border-white/20"
                    }`}
                >

                  {/* Soft Inner Glow */}
                  {enabled && (
                    <div className="absolute inset-0 rounded-xl bg-white/10 backdrop-blur-[2px]" />
                  )}

                  {/* TEXT */}
                  <div className="relative flex flex-col">
                    <span
                      className={`text-[12px] font-semibold transition-all duration-300
                      ${enabled ? "text-white" : "text-slate-500 group-hover:text-slate-700 dark:text-[#bbb] dark:group-hover:text-white black:text-[#bbb] black:group-hover:text-white"}`}
                    >
                      {enabled ? "On" : "Off"}
                    </span>
                  </div>

                  {/* ICON */}
                  <div className="relative flex items-center justify-center">
                    <div
                      className={`absolute inset-0 rounded-full blur-md transition-all duration-300
                      ${enabled ? "bg-violet-400/40 scale-0" : "scale-0"}`}
                    />

                    {enabled ? (
                      <BellRing className="w-[13px] h-[13px] text-white" />
                    ) : (
                      <BellOff className="w-[13px] h-[13px] text-slate-500 group-hover:text-slate-700 dark:text-[#bbb] dark:group-hover:text-white black:text-[#bbb] black:group-hover:text-white" />
                    )}
                  </div>

                  {/* LIGHT SWEEP */}
                  <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:animate-[shimmer_2.5s_linear]" />
                  </div>
                </button>

                {/* Custom Reminder Dropdown */}
                {showReminderDropdown && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-900 black:bg-[#12121a] border border-slate-200 dark:border-slate-700 black:border-[#262626] rounded-lg shadow-xl z-50 py-1 overflow-hidden">
                    <div className="px-3 py-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-100 dark:border-white/5 black:border-white/5">
                      Remind me
                    </div>
                    {[
                      { label: '5 minutes before', value: 5 },
                      { label: '15 minutes before', value: 15 },
                      { label: '30 minutes before', value: 30 },
                      { label: '1 hour before', value: 60 },
                      { label: '1 day before', value: 1440 },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => applyReminder(opt.value)}
                        className="w-full text-left px-4 py-2 text-xs text-slate-700 dark:text-slate-200 black:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 black:hover:bg-[#1a1a1a] transition-colors"
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div >

            {/* Collaborator Card */}
            < div className={cardClass}>
              <div className="flex items-center gap-2 mb-auto">
                <User className="w-3.5 h-3.5 text-[#7C87FB] flex-shrink-0" />
                <h3 className="text-[13px] font-semibold text-slate-800 dark:text-white black:text-white">Collaborator</h3>
              </div>
              <button
                onClick={() => openPanel('assignee')}
                className="w-full py-1.5 rounded-lg text-[12px] font-semibold text-slate-500 hover:text-slate-700 dark:text-[#bbb] dark:hover:text-white black:text-[#bbb] black:hover:text-white bg-slate-200/10 hover:bg-slate-200/80 dark:bg-black/30 dark:hover:bg-black/50 black:bg-white/5 black:hover:bg-black/50 border border-slate-200 hover:border-slate-300 dark:border-white/10 dark:hover:border-white/20 black:border-white/10 black:hover:border-white/20 transition-all text-center"
              >
                <div className="flex items-center justify-center gap-2">
                  <span>
                    {node.attrs.assignee ? 'Change...' : 'Assign Task'}
                  </span>
                  {!node.attrs.assignee && (
                    <Link className="w-3 h-3" />
                  )}
                </div>
              </button>
            </div >
          </div >

          {/* Bottom Card: Priority & Status */}
          < div className={`gap-4 ${cardClass}`}>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h3 className="text-[13px] font-semibold text-slate-800 dark:text-white black:text-white">Priority</h3>
              <div className="flex items-center gap-1.5">
                {['Low', 'Medium', 'High'].map(p => {
                  const pVal = p.toLowerCase();
                  const isSelected = priority === pVal;
                  const getSelectedStyle = () => {
                    if (p === 'Low') return { border: '1.5px solid #10b981', color: '#10b981', background: 'transparent', boxShadow: '0 0 10px rgba(16,185,129,0.35)' };
                    if (p === 'Medium') return { border: '1.5px solid #f59e0b', color: '#f59e0b', background: 'transparent', boxShadow: '0 0 8px rgba(245,158,11,0.3)' };
                    return { border: '1.5px solid #ef4444', color: '#ef4444', background: 'transparent', boxShadow: '0 0 8px rgba(239,68,68,0.3)' };
                  };
                  const getUnselectedClass = "border-[1.5px] border-slate-200 dark:border-white/10 black:border-white/10 text-slate-500 dark:text-[#666] black:text-[#666] bg-transparent";
                  return (
                    <button
                      key={p}
                      onClick={() => {
                        updateAttributes({ priority: pVal });
                        if (taskId) updateTaskBackend({ priority: pVal });
                      }}
                      className={`px-3 py-0.5 text-[11px] font-semibold rounded-full transition-all duration-200 ${isSelected ? '' : getUnselectedClass}`}
                      style={isSelected ? getSelectedStyle() : undefined}
                    >
                      {p}
                    </button>
                  );
                })}
              </div>
            </div>
            <hr className="border-t border-slate-200 dark:border-white/20 black:border-white/20" />
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h3 className="text-[13px] font-semibold text-slate-800 dark:text-white black:text-white">Status</h3>
              <div className="flex items-center gap-1.5 ml-auto">
                <button
                  onClick={handleFlagToggle}
                  className={`w-9 h-5 rounded-full p-[3px] transition-all duration-300 ease-out ${localIsFlagged ? 'bg-[#7C87FB] shadow-[0_0_8px_rgba(124,135,251,0.4)]' : 'bg-slate-300 dark:bg-[#3c3c46] black:bg-[#3c3c46]'}`}
                >
                  <div className={`w-[12px] h-[12px] bg-white rounded-full transition-transform duration-300 ease-out shadow-sm ${localIsFlagged ? 'translate-x-[14px]' : 'translate-x-0'}`} />
                </button>
              </div>
            </div>
          </div >

          {/* Footer Actions */}
          < div className="flex items-center justify-between gap-3" >
            <button onClick={handleDeleteTaskLocal} className="flex items-center gap-1.5 text-[12px] font-medium text-rose-500 hover:text-rose-600 transition-colors">
              <Trash2 style={{ width: '13px', height: '13px' }} /> Delete task
            </button>
            <div className="flex items-center gap-2">
              <button onClick={closePanel} className="px-4 py-1.5 text-[12px] font-semibold text-slate-600 dark:text-[#888] black:text-[#888] bg-slate-100 dark:bg-white/5 black:bg-white/5 border border-slate-200 dark:border-white/10 black:border-white/10 rounded-lg transition-all">
                Cancel
              </button>
              <button onClick={handleSave}
                className="
                px-5 py-1.5 rounded-lg font-semibold text-[12px]
                text-white bg-indigo-950
                bg-[linear-gradient(90deg,#ff2df7_0%,#a855f7_45%,#3b82f6_100%),radial-gradient(circle_at_70%_30%,#93c5fd_0%,transparent_65%)]
                bg-blend-overlay
                border-2 border-purple-400/50
                shadow-[0_0_5px_1px_rgba(168,85,247,0.5)]
                transition-all duration-300
                hover:brightness-[1.1]
                hover:shadow-[0_0_6px_2px_rgba(168,85,247,0.7)]
                active:scale-95
                ">
                Save
              </button>
            </div>
          </div >
        </div>
        <div className="absolute inset-0 rounded-xl pointer-events-none border border-black/5 dark:border-white/10 black:border-white/10" />
      </div >
    );
  };

  const PANEL_CONFIG: Record<PanelType, { title: React.ReactNode; content: React.ReactNode; className?: string; hideHeader?: boolean }> = {
    priority: {
      title: "Priority Level",
      content: <PriorityPanelContent />
    },
    date: {
      title: "Due date and recurrence",
      content: <DatePanelContent />
    },
    recurring: {
      title: "Custom recurrence",
      content: <CustomRecurrencePanelContent />
    },
    assignee: {
      title: "Assign to",
      content: <AssigneePanelContent />
    },
    more: {
      title: "More Options",
      content: <MorePanelContent />,
      className: "max-w-[530px] rounded-[13px] shadow-[0_40px_100px_-15px_rgba(0,0,0,0.8)] backdrop-blur-2xl border border-white/10 overflow-hidden",
      hideHeader: true
    },
    time: {
      title: "Add a time",
      content: <TimePanelContent returnToPanel={previousPanel} />
    },
    timezone: {
      title: "Select a time zone",
      content: <TimezonePanelContent />
    },
  };

  function TimePanelContent({ isIntegrated, onValueChange, returnToPanel }: { isIntegrated?: boolean, onValueChange?: (h: string, m: string, p: 'AM' | 'PM') => void, returnToPanel?: PanelType | null }) {
    const timezoneLabel = useMemo(() => {
      const formattedName = timezone.replace('_', ' ').replace('/', ' / ');
      const now = new Date();
      const local = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
      const utc = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }));
      const offsetMinutes = Math.round((local.getTime() - utc.getTime()) / 60000);
      const sign = offsetMinutes >= 0 ? '+' : '-';
      const abs = Math.abs(offsetMinutes);
      const hh = String(Math.floor(abs / 60)).padStart(2, '0');
      const mm = String(abs % 60).padStart(2, '0');
      return `${formattedName} (GMT${sign}${hh}:${mm})`;
    }, [timezone]);

    const handleHChange = (val: string) => {
      setHours(val);
      if (onValueChange) onValueChange(val, minutes, ampm);
    };
    const handleMChange = (val: string) => {
      setMinutes(val);
      if (onValueChange) onValueChange(hours, val, ampm);
    };
    const handlePChange = (val: 'AM' | 'PM') => {
      setAmpm(val);
      if (onValueChange) onValueChange(hours, minutes, val);
    };



    return (
      <div className={`flex flex-col gap-6 ${isIntegrated ? 'px-1' : ''}`}>
        <div className="flex items-center justify-center gap-5 py-4">
          <div className="flex gap-4">
            {/* Hour Selector */}
            <div className="flex flex-col items-center gap-3">
              <button
                onClick={() => handleHChange(String((parseInt(hours) % 12) + 1).padStart(2, '0'))}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                title="Increase hour"
              >
                <ChevronUp className="w-5 h-5 opacity-60 hover:opacity-100" />
              </button>
              <input
                value={hours}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '').slice(0, 2);
                  setHours(val);
                  if (onValueChange) onValueChange(val, minutes, ampm);
                }}
                onBlur={() => {
                  let h = parseInt(hours);
                  if (isNaN(h)) h = 12;
                  if (h > 12) h = 12;
                  if (h < 1) h = 1;
                  handleHChange(String(h).padStart(2, '0'));
                }}
                className="w-[46px] h-[46px] text-center bg-transparent outline-none flex items-center justify-center theme-glass-card rounded-lg text-xl font-semibold text-slate-900 dark:text-slate-100 black:text-white transition-all shadow-inner border border-transparent focus-within:ring-2 focus-within:ring-[#7C87FB]/50"
              />
              <button
                onClick={() => handleHChange(String((parseInt(hours) - 2 + 12) % 12 + 1).padStart(2, '0'))}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                title="Decrease hour"
              >
                <ChevronDown className="w-5 h-5 opacity-60 hover:opacity-100" />
              </button>
            </div>

            {/* Minute Selector */}
            <div className="flex flex-col items-center gap-3">
              <button
                onClick={() => handleMChange(String((parseInt(minutes) + 1) % 60).padStart(2, '0'))}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                title="Increase minute"
              >
                <ChevronUp className="w-5 h-5 opacity-60 hover:opacity-100" />
              </button>
              <input
                value={minutes}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '').slice(0, 2);
                  setMinutes(val);
                  if (onValueChange) onValueChange(hours, val, ampm);
                }}
                onBlur={() => {
                  let m = parseInt(minutes);
                  if (isNaN(m)) m = 0;
                  if (m > 59) m = 59;
                  if (m < 0) m = 0;
                  handleMChange(String(m).padStart(2, '0'));
                }}
                className="w-[46px] h-[46px] text-center bg-transparent outline-none flex items-center justify-center theme-glass-card rounded-lg text-xl font-semibold text-slate-900 dark:text-slate-100 black:text-white transition-all shadow-inner border border-transparent focus-within:ring-2 focus-within:ring-[#7C87FB]/50"
              />
              <button
                onClick={() => handleMChange(String((parseInt(minutes) - 1 + 60) % 60).padStart(2, '0'))}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                title="Decrease minute"
              >
                <ChevronDown className="w-5 h-5 opacity-60 hover:opacity-100" />
              </button>
            </div>
          </div>

          {/* AM/PM Toggle */}
          <div className="flex items-center gap-1 font-semibold theme-glass-card p-1.5 rounded-lg ml-2">
            <button
              onClick={() => handlePChange('AM')}
              className={`px-4 py-2 rounded-sm transition-all text-[15px] ${ampm === 'AM' ? 'bg-[#7C87FB] text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 black:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
            >
              AM
            </button>
            <button
              onClick={() => handlePChange('PM')}
              className={`px-4 py-2 rounded-sm transition-all text-[15px] ${ampm === 'PM' ? 'bg-[#7C87FB] text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 black:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
            >
              PM
            </button>
          </div>

          {!isIntegrated && (
            <div className="flex items-center group">
              <button
                onClick={() => setActivePanel('timezone')}
                className="ml-auto flex items-center gap-2 text-slate-600 black:text-slate-300 group-hover:text-slate-800 black:group-hover:text-slate-100 transition-colors pl-2"
              >
                <span className="text-sm font-medium">{timezoneLabel}</span>
                <Globe className="w-[18px] h-[18px] opacity-70 text-slate-600 black:text-slate-300 group-hover:text-slate-800 black:group-hover:text-slate-100 transition-colors" />
              </button>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        {!isIntegrated && (
          <div className="flex justify-end gap-3 pt-6 pb-2 mr-2">
            <button
              onClick={() => { if (returnToPanel) { setActivePanel(returnToPanel); } else { closePanel(); } setPreviousPanel(null); }}
              className="px-6 py-2.5 text-sm font-bold text-slate-600 dark:text-slate-400 black:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 black:hover:bg-[#1a1a1a] rounded-lg border border-slate-200 dark:border-slate-700 black:border-[#333] transition-all"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                let h = parseInt(hours);
                if (ampm === 'PM' && h < 12) h += 12;
                if (ampm === 'AM' && h === 12) h = 0;
                if (returnToPanel) {
                  // Opened from date panel: update tempDueDate and go back
                  const newD = tempDueDate ? tempDueDate.split('T')[0] : format(new Date(), 'yyyy-MM-dd');
                  const final = `${newD}T${String(h).padStart(2, '0')}:${minutes}:00`;
                  setTempDueDate(final);
                  setIsTimeVisible(true);
                  setActivePanel(returnToPanel);
                } else {
                  // Opened independently: save time + timezone directly
                  const newD = tempDueDate ? tempDueDate.split('T')[0] : format(new Date(), 'yyyy-MM-dd');
                  const final = `${newD}T${String(h).padStart(2, '00')}:${minutes}:00`;
                  updateAttributes({ dueDateWall: final, timezone });
                  if (taskId) updateTaskBackend({ dueDateWall: final, timezone });
                  closePanel();
                }
                setPreviousPanel(null);
              }}
              className="px-8 py-2.5 rounded-lg font-semibold text-[12px] text-white bg-indigo-950 bg-[linear-gradient(90deg,#ff2df7_0%,#a855f7_45%,#3b82f6_100%),radial-gradient(circle_at_70%_30%,#93c5fd_0%,transparent_65%)] bg-blend-overlay border-2 border-purple-400/50 shadow-[0_0_5px_1px_rgba(168,85,247,0.5)] transition-all duration-300 hover:brightness-[1.1] hover:shadow-[0_0_6px_2px_rgba(168,85,247,0.7)] active:scale-95"
            >
              Add
            </button>
          </div>
        )}
      </div>
    );
  }

  function TimezonePanelContent() {
    // FIX L-4: Track a local "draft" timezone so Cancel can discard the pick.
    // Clicking a row updates the draft only; Select confirms it; Cancel reverts it.
    const [draftTimezone, setDraftTimezone] = useState(timezone);

    const timezones = [
      // UTC+14
      { name: 'Pacific/Kiritimati', sub: 'Line Islands Time' },

      // UTC+13
      { name: 'Pacific/Apia', sub: 'Samoa Time' },
      { name: 'Pacific/Tongatapu', sub: 'Tonga Time' },

      // UTC+12
      { name: 'Pacific/Auckland', sub: 'New Zealand Standard Time' },
      { name: 'Pacific/Fiji', sub: 'Fiji Time' },
      { name: 'Pacific/Majuro', sub: 'Marshall Islands Time' },

      // UTC+11
      { name: 'Pacific/Guadalcanal', sub: 'Solomon Islands Time' },
      { name: 'Pacific/Noumea', sub: 'New Caledonia Time' },
      { name: 'Asia/Magadan', sub: 'Magadan Standard Time' },

      // UTC+10
      { name: 'Australia/Sydney', sub: 'Australian Eastern Time' },
      { name: 'Australia/Brisbane', sub: 'Australian Eastern Standard Time' },
      { name: 'Pacific/Guam', sub: 'Chamorro Standard Time' },

      // UTC+9
      { name: 'Asia/Tokyo', sub: 'Japan Standard Time' },
      { name: 'Asia/Seoul', sub: 'Korea Standard Time' },
      { name: 'Asia/Yakutsk', sub: 'Yakutsk Time' },

      // UTC+8
      { name: 'Asia/Shanghai', sub: 'China Standard Time' },
      { name: 'Asia/Hong_Kong', sub: 'Hong Kong Time' },
      { name: 'Asia/Singapore', sub: 'Singapore Standard Time' },
      { name: 'Asia/Ulaanbaatar', sub: 'Ulaanbaatar Standard Time' },

      // UTC+7
      { name: 'Asia/Bangkok', sub: 'Indochina Time' },
      { name: 'Asia/Jakarta', sub: 'Western Indonesia Time' },
      { name: 'Asia/Krasnoyarsk', sub: 'Krasnoyarsk Time' },

      // UTC+6
      { name: 'Asia/Almaty', sub: 'Alma-Ata Time' },
      { name: 'Asia/Dhaka', sub: 'Bangladesh Standard Time' },
      { name: 'Asia/Novosibirsk', sub: 'Novosibirsk Time' },

      // UTC+5
      { name: 'Asia/Karachi', sub: 'Pakistan Standard Time' },
      { name: 'Asia/Oral', sub: 'Kazakhstan Time' },
      { name: 'Asia/Qyzylorda', sub: 'Kazakhstan Time' },
      { name: 'Asia/Samarkand', sub: 'Uzbekistan Standard Time' },
      { name: 'Asia/Tashkent', sub: 'Uzbekistan Standard Time' },

      // UTC+4
      { name: 'Asia/Dubai', sub: 'Gulf Standard Time' },
      { name: 'Asia/Baku', sub: 'Azerbaijan Standard Time' },
      { name: 'Europe/Samara', sub: 'Samara Time' },

      // UTC+3
      { name: 'Europe/Moscow', sub: 'Moscow Standard Time' },
      { name: 'Africa/Nairobi', sub: 'East Africa Time' },
      { name: 'Asia/Riyadh', sub: 'Arabia Standard Time' },

      // UTC+2
      { name: 'Europe/Athens', sub: 'Eastern European Time' },
      { name: 'Europe/Helsinki', sub: 'Eastern European Time' },
      { name: 'Africa/Cairo', sub: 'Eastern European Time' },

      // UTC+1
      { name: 'Europe/Paris', sub: 'Central European Time' },
      { name: 'Europe/Berlin', sub: 'Central European Time' },
      { name: 'Europe/Rome', sub: 'Central European Time' },

      // UTC+0
      { name: 'Europe/London', sub: 'Greenwich Mean Time' },
      { name: 'Africa/Lagos', sub: 'West Africa Time' },
      { name: 'Atlantic/Reykjavik', sub: 'Greenwich Mean Time' },

      // UTC-1
      { name: 'Atlantic/Cape_Verde', sub: 'Cape Verde Time' },

      // UTC-2
      { name: 'America/Noronha', sub: 'Fernando de Noronha Time' },

      // UTC-3
      { name: 'America/Argentina/Buenos_Aires', sub: 'Argentina Time' },
      { name: 'America/Sao_Paulo', sub: 'Brasilia Time' },
      { name: 'America/Nuuk', sub: 'West Greenland Time' },

      // UTC-4
      { name: 'America/Caracas', sub: 'Venezuelan Time' },
      { name: 'America/Halifax', sub: 'Atlantic Standard Time' },
      { name: 'America/La_Paz', sub: 'Bolivia Time' },

      // UTC-5
      { name: 'America/New_York', sub: 'Eastern Standard Time' },
      { name: 'America/Toronto', sub: 'Eastern Standard Time' },
      { name: 'America/Bogota', sub: 'Colombia Time' },

      // UTC-6
      { name: 'America/Chicago', sub: 'Central Standard Time' },
      { name: 'America/Mexico_City', sub: 'Central Standard Time' },
      { name: 'America/Regina', sub: 'Central Standard Time' },

      // UTC-7
      { name: 'America/Denver', sub: 'Mountain Standard Time' },
      { name: 'America/Edmonton', sub: 'Mountain Standard Time' },

      // UTC-8
      { name: 'America/Los_Angeles', sub: 'Pacific Standard Time' },
      { name: 'America/Vancouver', sub: 'Pacific Standard Time' },

      // UTC-9
      { name: 'America/Anchorage', sub: 'Alaska Standard Time' },

      // UTC-10
      { name: 'Pacific/Honolulu', sub: 'Hawaii-Aleutian Standard Time' },

      // UTC-11
      { name: 'Pacific/Midway', sub: 'Samoa Standard Time' },
    ];

    const getOffsetLabel = (tz: string) => {
      const now = new Date();
      const local = new Date(now.toLocaleString('en-US', { timeZone: tz }));
      const utc = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }));
      const offsetMinutes = Math.round((local.getTime() - utc.getTime()) / 60000);
      const sign = offsetMinutes >= 0 ? '+' : '-';
      const abs = Math.abs(offsetMinutes);
      const hh = String(Math.floor(abs / 60)).padStart(2, '0');
      const mm = String(abs % 60).padStart(2, '0');
      return `GMT${sign}${hh}:${mm}`;
    };

    const normalizedSearch = timezoneSearch.trim().toLowerCase();
    const filteredTimezones = timezones.filter((tz) => {
      if (!normalizedSearch) return true;
      const displayName = tz.name.replace('/', ' ').replace('_', ' ').toLowerCase();
      return (
        tz.name.toLowerCase().includes(normalizedSearch) ||
        tz.sub.toLowerCase().includes(normalizedSearch) ||
        displayName.includes(normalizedSearch)
      );
    });

    return (
      <div className="flex flex-col gap-4 pb-2">
        <div className="flex items-center gap-2 mt-2 border border-slate-300 dark:border-slate-700 black:border-[#333] rounded-lg text-[15px] outline-none focus-within:border-[#7C87FB] text-slate-900 dark:text-slate-100 placeholder:text-slate-500 transition-colors ">
          <input
            type="text"
            placeholder="Search country or time zone"
            value={timezoneSearch}
            onChange={(e) => setTimezoneSearch(e.target.value)}
            className="w-full px-4 py-2.5 bg-transparent border-none outline-none hover:bg-transparent transition-none focus:ring-0 focus:outline-none placeholder:text-slate-500"
          />
          <Search className="w-[18px] h-[18px] text-slate-400 mr-3" />
        </div>

        {draftTimezone !== defaultTimezone && (
          <button
            onClick={() => setDraftTimezone(defaultTimezone)}
            className="flex items-center gap-2 text-sm font-semibold text-[#7C87FB] hover:bg-[#7C87FB]/10 p-2 rounded-lg transition-colors mt-2"
          >
            <RotateCw className="w-4 h-4" /> Reset to Local Timezone
          </button>
        )}

        <div className="flex flex-col gap-1 max-h-[320px] overflow-y-auto pr-2 custom-scrollbar -mx-2 px-2 mt-2">
          {filteredTimezones.map((tz, i) => {
            const isSelected = tz.name === draftTimezone;
            const nameLabel = tz.name.replace('_', ' ');
            return (
              <button
                key={i}
                onClick={() => setDraftTimezone(tz.name)}
                className="flex items-start gap-4 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 black:hover:bg-[#1a1a1a] transition-all text-left"
              >
                <div className="mt-0.5 flex-shrink-0 w-4 flex justify-center">
                  {isSelected ? (
                    <Check className="w-[18px] h-[18px] text-[#7C87FB]" />
                  ) : null}
                </div>
                <Globe className={`mt-[3px] w-[18px] h-[18px] flex-shrink-0 ${isSelected ? 'text-slate-700 dark:text-slate-300 black:text-white' : 'text-slate-400'}`} />
                <div className="flex-1 -mt-0.5">
                  <div className={`text-[15px] font-medium ${isSelected ? 'text-[#7C87FB]' : 'text-slate-700 dark:text-slate-200 black:text-slate-100'}`}>
                    {nameLabel}
                  </div>
                  <div className="text-[13px] text-slate-500/80 dark:text-slate-400/80 black:text-slate-400 font-medium tracking-tight mt-0.5">
                    {tz.sub} ({getOffsetLabel(tz.name)})
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="flex justify-end gap-3 pt-6 mr-2">
          {/* FIX L-4: Cancel restores previous timezone; Select persists the draft */}
          <button
            onClick={() => {
              setDraftTimezone(timezone); // discard draft
              setActivePanel('time');
            }}
            className="px-6 py-2.5 text-sm font-bold text-slate-600 dark:text-slate-400 black:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 black:hover:bg-[#1a1a1a] rounded-lg border border-slate-200 dark:border-slate-700 black:border-[#333] transition-all"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              setTimezone(draftTimezone); // commit draft
              setActivePanel('time');
            }}
            className="px-8 py-2.5 rounded-lg font-semibold text-[12px] text-white bg-indigo-950 bg-[linear-gradient(90deg,#ff2df7_0%,#a855f7_45%,#3b82f6_100%),radial-gradient(circle_at_70%_30%,#93c5fd_0%,transparent_65%)] bg-blend-overlay border-2 border-purple-400/50 shadow-[0_0_5px_1px_rgba(168,85,247,0.5)] transition-all duration-300 hover:brightness-[1.1] hover:shadow-[0_0_6px_2px_rgba(168,85,247,0.7)] active:scale-95"
          >
            Select
          </button>
        </div>
      </div>
    );
  }

  return (
    <NodeViewWrapper
      className={`task-card-modern ${selected ? 'selected' : ''} ${isCompleted ? 'completed' : ''
        } ${isOverdue ? 'overdue' : ''}`}
    >
      <div
        className="flex items-start gap-3 p-2 rounded-lg border shadow-sm hover:shadow-md transition-all duration-150 bg-white dark:bg-slate-900 black:bg-[#0f0f0f] border-slate-200 dark:border-slate-800 black:border-[#262626]"
        style={{
          borderLeft: `3.5px solid ${priority === 'critical'
            ? '#E11D48'
            : priority === 'high'
              ? '#FB7185'
              : priority === 'low'
                ? '#10B981'
                : '#3B82F6'
            }`
        }}
      >
        {/* Checkbox */}
        <button
          onClick={handleToggle}
          disabled={isSyncing}
          className={`mt-0.5 flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-200
            ${isCompleted
              ? 'border-slate-500 black:border-slate-500 text-white shadow-md scale-105 bg-slate-100 dark:bg-slate-800'
              : 'border-slate-300 dark:border-slate-100 black:border-slate-100 bg-white dark:bg-slate-800 black:bg-[#1a1a1a] hover:border-blue-500 hover:scale-105'
            }
            ${isSyncing ? 'opacity-50 cursor-wait' : ''}`}
          aria-label="Toggle task"
        >
          {isSyncing ? (
            <RefreshCw className="w-4 h-4 animate-spin text-slate-400" />
          ) : isCompleted ? (
            <Check className="w-4 h-4 stroke-[3.5] text-slate-500" />
          ) : null}
        </button>

        {/* Task Content */}
        <div className="flex-1 min-w-0 items-center">
          <div className="flex items-center gap-2 flex-wrap md:flex-nowrap md:overflow-x-hidden">
            {/* Task text */}
            <div
              className={`flex-1 min-w-0 task-content-modern text-sm font-medium leading-5 ${isCompleted ? 'line-through opacity-60' : 'text-slate-800 dark:text-slate-100'
                } transition-all duration-150 [&_p]:!mb-0`}
            >
              <NodeViewContent />
            </div>

            {/* Action Icons */}
            <div className="ml-auto flex items-center gap-1.5">
              {syncError && (
                <div className="text-red-500 text-xs flex items-center gap-1 mr-2" title={syncError}>
                  <AlertTriangle className="w-3.5 h-3.5" />
                </div>
              )}

              {/* Time + Date — shown as inline text values */}
              {(() => {
                const hasTime = dueDateWall && dueDateWall.includes('T') && !dueDateWall.endsWith('T00:00:00');
                const hasDate = !!dueDateWall;

                return (
                  <>
                    {/* Time (only when value set) */}
                    {hasTime && (
                      <button
                        onClick={() => openPanel('time')}
                        className={`flex items-center gap-1 text-[11px] font-semibold tracking-wide transition-colors duration-150 animate-in fade-in duration-150
                          text-sky-500 dark:text-sky-400 black:text-sky-400
                          hover:text-sky-600 dark:hover:text-sky-300
                          ${activePanel === 'time' ? 'underline underline-offset-2' : ''}`}
                        title="Edit time"
                      >
                        <Clock className="w-3 h-3 flex-shrink-0" />
                        <span>{hours}:{minutes} {ampm}</span>
                      </button>
                    )}

                    {/* Separator dot when both time and date are visible */}
                    {hasTime && hasDate && (
                      <span className="text-slate-300 dark:text-slate-600 black:text-slate-600 select-none text-[11px]">·</span>
                    )}

                    {/* Date (only when value set) */}
                    {hasDate ? (
                      <button
                        onClick={() => openPanel('date')}
                        className={`flex items-center gap-1 text-[11px] font-semibold tracking-wide transition-colors duration-150 animate-in fade-in duration-150
                          ${isOverdue
                            ? 'text-rose-500 dark:text-rose-400 black:text-rose-400 hover:text-rose-600 dark:hover:text-rose-300'
                            : 'text-slate-600 dark:text-slate-300 black:text-slate-300 hover:text-slate-800 dark:hover:text-slate-100'
                          }
                          ${activePanel === 'date' ? 'underline underline-offset-2' : ''}`}
                        title={`Due: ${new Date(dueDateWall!).toLocaleDateString()}`}
                      >
                        <Calendar className="w-3 h-3 flex-shrink-0" />
                        <span>{format(new Date(dueDateWall!), 'EEE, MMM d')}</span>
                      </button>
                    ) : (
                      /* No date — show icon-only placeholder */
                      <button
                        onClick={() => openPanel('date')}
                        className={`theme-glass-buttons p-1.5 rounded-md transition-all duration-150 ${activePanel === 'date' ? 'brightness-125 scale-110 shadow-[0_0_15px_rgba(124,135,251,0.3)]' : 'hover:brightness-110'}`}
                        title="Set Due Date"
                      >
                        <Calendar className={`w-3.5 h-3.5 transition-all duration-150 text-slate-400 dark:text-slate-500 ${activePanel === 'date' ? '!text-blue-500 scale-105' : ''}`} />
                      </button>
                    )}

                    {/* No time — show icon-only placeholder */}
                    {!hasTime && (
                      <button
                        onClick={() => openPanel('time')}
                        className={`theme-glass-buttons p-1.5 rounded-md transition-all duration-150 ${activePanel === 'time' ? 'brightness-125 scale-110 shadow-[0_0_15px_rgba(124,135,251,0.3)]' : 'hover:brightness-110'}`}
                        title="Add a time"
                      >
                        <Clock className={`w-3.5 h-3.5 transition-all duration-150 ${activePanel === 'time' ? 'text-sky-500 scale-105' : 'text-slate-400 dark:text-slate-500'}`} />
                      </button>
                    )}
                  </>
                );
              })()}


              {/* Priority */}
              <button
                onClick={() => openPanel('priority')}
                className={`theme-glass-buttons p-1.5 rounded-md transition-all duration-150 ${activePanel === 'priority'
                  ? 'brightness-125 scale-110 shadow-[0_0_15px_rgba(124,135,251,0.3)]'
                  : 'hover:brightness-110'
                  }`}
                title={priority ? `Priority: ${priority}` : 'Set Priority'}
              >
                <Flag
                  className={`w-3.5 h-3.5 transition-all duration-150 ${priority === 'critical'
                    ? 'text-rose-600'
                    : priority === 'high'
                      ? 'text-orange-500'
                      : priority === 'medium'
                        ? 'text-amber-500'
                        : priority === 'low'
                          ? 'text-emerald-500'
                          : 'text-slate-400 dark:text-slate-500'
                    } ${activePanel === 'priority' ? '!text-rose-500 scale-105' : ''}`}
                />
              </button>

              {/* Recurring */}
              <button
                onClick={() => openPanel('recurring')}
                className={`theme-glass-buttons p-1.5 rounded-md transition-all duration-150 ${activePanel === 'recurring'
                  ? 'brightness-125 scale-110 shadow-[0_0_15px_rgba(124,135,251,0.3)]'
                  : 'hover:brightness-110'
                  }`}
                title={isRecurring ? `Recurring: ${currentPattern()}` : 'Set Recurring'}
              >
                <RotateCw
                  className={`w-3.5 h-3.5 transition-all duration-150 ${isRecurring
                    ? 'text-indigo-500'
                    : 'text-slate-400 dark:text-slate-500'
                    } ${activePanel === 'recurring' ? '!text-indigo-500 scale-105' : ''}`}
                />
              </button>

              {/* Assignee */}
              <button
                onClick={() => openPanel('assignee')}
                className={`theme-glass-buttons p-1.5 rounded-md transition-all duration-150 ${activePanel === 'assignee'
                  ? 'brightness-125 scale-110 shadow-[0_0_15px_rgba(124,135,251,0.3)]'
                  : 'hover:brightness-110'
                  }`}
                title="Assign to"
              >
                <CircleUser
                  className={`w-3.5 h-3.5 transition-all duration-150 ${activePanel === 'assignee'
                    ? 'text-violet-500 scale-105'
                    : 'text-slate-400 dark:text-slate-500'
                    }`}
                />
              </button>

              {/* More */}
              <button
                onClick={() => openPanel('more')}
                className={`theme-glass-buttons p-1.5 rounded-md transition-all duration-150 ${activePanel === 'more'
                  ? 'brightness-125 scale-110 shadow-[0_0_15px_rgba(124,135,251,0.3)]'
                  : 'hover:brightness-110'
                  }`}
                title="More options"
              >
                <Ellipsis
                  className={`w-3.5 h-3.5 transition-all duration-150 ${activePanel === 'more'
                    ? 'text-slate-700 dark:text-slate-200 black:text-slate-100 scale-105'
                    : 'text-slate-400 dark:text-slate-500'
                    }`}
                />
              </button>
            </div>
          </div>

          {/* Tag Badges in task body */}
          {tags && tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {tags.map((tag: string) => (
                <span key={tag} className="px-1.5 py-0.5 bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 rounded text-[9px] font-bold uppercase tracking-wider border border-slate-100 dark:border-slate-800 overflow-hidden">
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Floating Panel Modal (portal to document.body) */}
      {activePanel && (
        <FloatingPanel
          title={PANEL_CONFIG[activePanel]?.title}
          onClose={() => {
            if (activePanel === 'time' && previousPanel) {
              setActivePanel(previousPanel);
              setPreviousPanel(null);
            } else {
              closePanel();
            }
          }}
          className={PANEL_CONFIG[activePanel]?.className}
          hideHeader={PANEL_CONFIG[activePanel]?.hideHeader}
        >
          {PANEL_CONFIG[activePanel]?.content}
        </FloatingPanel>
      )}
    </NodeViewWrapper>
  );
};
