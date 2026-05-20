import React, { useEffect, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Check,
  MoreHorizontal,
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  UserRoundPen,
  Users,
  Eye,
  Star,
  ExternalLink,
  ChevronDown,
  Pencil,
  Bell,
  AlertTriangle,
  Flag,
  ClockPlus,
  RotateCcw,
  LayoutList,
  CircleCheckBig,
  CheckCircle2,
  Circle,
  EyeOff,
} from 'lucide-react';
import { useCalendarStore, CalendarEvent } from '../stores/useCalendarStore';
import { useNotesStore } from '../stores/useNotesStore';
import { useTasksStore } from '../stores/useTasksStore';
import { useUIStore } from '../stores/useUIStore';
import GoogleCalendarAuth from '../components/GoogleCalendarAuth';

export const Calendar: React.FC = () => {
  const {
    events,
    fetchEvents,
    setSelectedDate,
    setViewMode,
    viewMode,
    setSelectedEvent,
    selectedEvent,
    showCreateModal,
    setShowCreateModal,
    fetchDayEvents,
    fetchWeekEvents,
    fetchMonthEvents,
    deleteEvent,
    isGoogleCalendarConnected,
    initializeGoogleCalendarStatus,
    showWeekends,
    startWeekOn,
    setStartWeekOn,
    selectedDate,
    fetchGoogleCalendarEvents,
    googleCalendarEvents,
    googleAccount,
    preFormatNotes,
    remindTakeNotes,
    remindOpenNotes,
    setPreFormatNotes,
    setRemindTakeNotes,
    setRemindOpenNotes,
    disconnectGoogleCalendar
  } = useCalendarStore();

  const { tasks, fetchTasks, createTask, updateTask, deleteTask, toggleTask } = useTasksStore();
  const { notes } = useNotesStore();
  const { theme, darkMode } = useUIStore();
  const dividerColor = theme === 'black' ? '#4a4a4a' : (darkMode ? '#374151' : '#c4c4c4');

  const [showTaskPanel, setShowTaskPanel] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingTaskInitial, setEditingTaskInitial] = useState<{
    text: string;
    description?: string;
    startDate?: string | Date;
    dueDate?: string;
    priority: 'low' | 'medium' | 'high';
    reminder?: string;
    isRecurring?: boolean;
    recurringPattern?: 'daily' | 'weekly' | 'monthly' | 'yearly';
    completed?: boolean;
    noteId?: string;
  } | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [isTaskAccordionExpanded, setIsTaskAccordionExpanded] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showHywizEvents, setShowHywizEvents] = useState(true);
  const [showHywizTasks, setShowHywizTasks] = useState(true);
  const [showGoogleEvents, setShowGoogleEvents] = useState(true);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  // Close settings dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowSettings(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Helper function to ensure selectedDate is always a proper Date object
  const getSelectedDate = () => {
    if (selectedDate instanceof Date) {
      return selectedDate;
    }
    const date = new Date(selectedDate);
    if (isNaN(date.getTime())) {
      return new Date();
    }
    return date;
  };


  // Helper function to normalize date to local midnight (avoids timezone issues)
  const normalizeToLocalMidnight = (date: Date | string): Date => {
    const d = new Date(date);
    // Extract local date components and create a new date at local midnight
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
  };

  // Helper to get local date string (YYYY-MM-DD)
  const toLocalDateString = (date: Date | string): string => {
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  // Helper function to calculate next occurrence date
  const getNextOccurrenceDate = (currentDate: Date, pattern: string): Date | null => {
    const nextDate = new Date(currentDate);
    switch (pattern) {
      case 'daily':
        nextDate.setDate(nextDate.getDate() + 1);
        break;
      case 'weekly':
        nextDate.setDate(nextDate.getDate() + 7);
        break;
      case 'monthly':
        nextDate.setMonth(nextDate.getMonth() + 1);
        break;
      case 'yearly':
        nextDate.setFullYear(nextDate.getFullYear() + 1);
        break;
      default:
        return null;
    }
    return nextDate;
  };

  // Convert tasks to calendar events
  const convertTasksToEvents = (): CalendarEvent[] => {
    const events: CalendarEvent[] = [];
    const seenEventIds = new Set<string>();

    const viewStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1);
    const viewEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 2, 0);

    tasks.forEach(task => {
      const taskId = task.id || (task as any)._id;
      let startDateTime: Date;

      if (task.dueDateWall && !task.isFloating) {
        startDateTime = normalizeToLocalMidnight(task.dueDateWall);
      } else {
        startDateTime = new Date();
        startDateTime.setHours(0, 0, 0, 0);
      }

      // Derive recurringPattern from recurrenceRule rrule string if not set directly.
      // Tasks created via the editor store recurrenceRule (rrule), not recurringPattern (enum).
      let effectivePattern: string | null = task.recurringPattern || null;
      const rrule = (task as any).recurrenceRule as string | null;
      if (!effectivePattern && rrule) {
        if (rrule.includes('FREQ=DAILY')) effectivePattern = 'daily';
        else if (rrule.includes('FREQ=WEEKLY')) effectivePattern = 'weekly';
        else if (rrule.includes('FREQ=MONTHLY')) effectivePattern = 'monthly';
        else if (rrule.includes('FREQ=YEARLY')) effectivePattern = 'yearly';
      }

      const generateEvent = (date: Date, isOccurrence: boolean) => {
        const currentStart = new Date(date);
        if (currentStart < viewStart || currentStart > viewEnd) return;

        const endDateTime = new Date(currentStart);
        endDateTime.setHours(23, 59, 59, 999);

        let description = `Task: ${task.title}`;
        if (task.description) description += `\n\n${task.description}`;
        description += `\nPriority: ${task.priority}`;
        description += `\nStatus: ${task.status}`;

        const uniqueEventId = isOccurrence
          ? `task-${taskId}-${currentStart.toISOString().split('T')[0]}`
          : `task-${taskId}`;

        if (seenEventIds.has(uniqueEventId)) return;
        seenEventIds.add(uniqueEventId);

        const isCompleted = task.status === 'completed';
        const isFlagged = (task as any).isFlagged;
        const color = isCompleted ? '#10B981' : (
          isFlagged ? '#F59E0B' :
          task.priority === 'critical' ? '#EF4444' :
            task.priority === 'high' ? '#F59E0B' :
              task.priority === 'medium' ? '#3B82F6' : '#6B7280'
        );

        events.push({
          _id: uniqueEventId,
          title: `📋 ${task.title}`,
          description,
          startTime: currentStart.toISOString(),
          endTime: endDateTime.toISOString(),
          allDay: true,
          type: 'task',
          priority: (task.priority === 'critical' ? 'high' : task.priority) as 'low' | 'medium' | 'high',
          status: (task.status === 'canceled' ? 'cancelled' : task.status) as 'pending' | 'completed' | 'cancelled',
          color,
          userId: '',
          noteId: task.noteId ? { _id: task.noteId, title: 'Note' } : undefined,
          isSynced: false,
          createdAt: task.createdAt,
          updatedAt: task.updatedAt,
          recurring: task.isRecurring && effectivePattern ? {
            frequency: effectivePattern as 'daily' | 'weekly' | 'monthly' | 'yearly',
            interval: 1,
          } : undefined,
        });
      };

      // 1. Show main instance
      generateEvent(startDateTime, false);

      // 2. Future occurrences – use effectivePattern (supports both enum and rrule-derived)
      if (task.isRecurring && effectivePattern && task.status !== 'completed') {
        let nextDate = getNextOccurrenceDate(startDateTime, effectivePattern);
        let count = 0;
        while (nextDate && nextDate <= viewEnd && count < 60) {
          generateEvent(nextDate, true);
          nextDate = getNextOccurrenceDate(nextDate, effectivePattern);
          count++;
        }
      }
    });

    return events;
  };

  // ✅ REAL-TIME REFRESH: Calendar refreshes automatically when tasks change
  // Using tasks.length as dependency ensures calendar updates when tasks are added/removed/updated
  const tasksLength = tasks.length;

  useEffect(() => {
    try {
      const dateStr = getSelectedDate().toISOString().split('T')[0];
      fetchDayEvents(dateStr);
      fetchTasks(); // Fetch tasks to show in calendar
    } catch (error) {
      const fallbackDate = new Date().toISOString().split('T')[0];
      fetchDayEvents(fallbackDate);
      fetchTasks();
    }
  }, [selectedDate, fetchDayEvents, fetchTasks, tasksLength]);  // ✅ Added tasksLength for auto-refresh

  // Refresh tasks when calendar is opened or when tasks might have changed
  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  useEffect(() => {
    if (isGoogleCalendarConnected) {
      fetchGoogleCalendarEvents();
    }
  }, [isGoogleCalendarConnected, fetchGoogleCalendarEvents]);

  useEffect(() => {
    initializeGoogleCalendarStatus();
  }, [initializeGoogleCalendarStatus]);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const getHoursArray = () => {
    const hours = [];
    for (let i = 0; i < 24; i++) {
      hours.push(i);
    }
    return hours;
  };
  // Memoize converted task events to avoid recalculating on every hour
  const taskEventsCache = React.useMemo(() => {
    return convertTasksToEvents();
  }, [tasks, currentMonth, selectedDate]);

  const getEventsForHour = (hour: number, targetDate: Date = getSelectedDate()) => {
    const targetDateStr = toLocalDateString(targetDate);
    const localEvents = showHywizEvents ? events.filter((event: any) => {
      const d = new Date(event.startTime);
      const eventHour = d.getHours();
      const eventDateStr = toLocalDateString(d);
      return eventDateStr === targetDateStr && eventHour === hour && event.type !== 'task' && !event._id.startsWith('task-');
    }) : [];

    const googleEvents = showGoogleEvents ? googleCalendarEvents.filter((event: any) => {
      const start = event.start?.dateTime || event.start?.date;
      if (!start) return false;
      const d = new Date(start);
      return toLocalDateString(d) === targetDateStr && d.getHours() === hour;
    }).map((event: any) => ({
      _id: event.id || `google-${event.start?.dateTime || event.start?.date}`,
      title: event.summary || 'Untitled Event',
      description: event.description || '',
      startTime: event.start?.dateTime || event.start?.date,
      endTime: event.end?.dateTime || event.end?.date,
      allDay: !event.start?.dateTime,
      location: event.location || '',
      type: 'event' as 'event' | 'task',
      priority: 'medium' as 'low' | 'medium' | 'high',
      status: 'pending' as 'pending' | 'in-progress' | 'completed' | 'cancelled',
      color: '#4285f4',
      userId: 'google-calendar',
      isSynced: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      attendees: event.attendees?.map((attendee: any) => ({
        email: attendee.email,
        name: attendee.displayName || attendee.email,
        responseStatus: attendee.responseStatus || 'needsAction'
      })) || []
    })) : [];

    // POPULATE tasks ONLY for Week/Month views (hide from Day grid per user request)
    const filteredTaskEvents = (showHywizTasks && viewMode !== 'day') ? taskEventsCache.filter((taskEvent: any) => {
      const d = new Date(taskEvent.startTime);
      return toLocalDateString(d) === targetDateStr && d.getHours() === hour;
    }) : [];

    // Combine all events and deduplicate by _id (more strict)
    const allEvents = [...localEvents, ...googleEvents, ...filteredTaskEvents];
    const seenIds = new Set<string>();
    const combinedEvents = allEvents.filter((event: any) => {
      const eventId = String(event._id);
      if (seenIds.has(eventId)) {
        console.warn('[CALENDAR] Duplicate event detected:', eventId, event.title);
        return false; // Skip duplicate
      }
      seenIds.add(eventId);
      return true;
    }).sort((a: any, b: any) =>
      new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    );
    return combinedEvents;
  };

  const getMiniCalendarDays = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());
    const days = [];
    for (let i = 0; i < 42; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      days.push(date);
    }
    return days;
  };

  const getWeekDays = () => {
    const start = new Date(getSelectedDate());
    // Adjust start day based on setting
    const currentDay = start.getDay();
    const offset = startWeekOn === 'Monday'
      ? (currentDay === 0 ? 6 : currentDay - 1)
      : currentDay;

    start.setDate(start.getDate() - offset);
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      // If hiding weekends, only add Mon-Fri
      if (!showWeekends) {
        const dayOfWeek = d.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
          days.push(d);
        }
      } else {
        days.push(d);
      }
    }
    return days;
  };

  const getMonthDays = () => {
    const year = getSelectedDate().getFullYear();
    const month = getSelectedDate().getMonth();
    const firstDay = new Date(year, month, 1);
    const startDate = new Date(firstDay);

    // Adjust start day based on setting
    const firstDayIdx = firstDay.getDay();
    const offset = startWeekOn === 'Monday'
      ? (firstDayIdx === 0 ? 6 : firstDayIdx - 1)
      : firstDayIdx;

    startDate.setDate(startDate.getDate() - offset);
    const days = [];
    // Standard 6 weeks for monthly view
    for (let i = 0; i < 42; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      days.push(date);
    }

    // If hiding weekends, we should probably still show the full grid or filter?
    // Usually for month view, we just filter the rendered days or hide the columns.
    // To match the behavior of most calendars, if weekends are hidden, we filter here.
    if (!showWeekends) {
      return days.filter(d => d.getDay() !== 0 && d.getDay() !== 6);
    }

    return days;
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const isSelected = (date: Date) => {
    return date.toDateString() === getSelectedDate().toDateString();
  };

  const isCurrentMonth = (date: Date) => {
    return date.getMonth() === currentMonth.getMonth();
  };

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
  };

  const handlePrevMonth = () => {
    setCurrentMonth(prev => {
      const newMonth = new Date(prev);
      newMonth.setMonth(prev.getMonth() - 1);
      return newMonth;
    });
  };

  const handleNextMonth = () => {
    setCurrentMonth(prev => {
      const newMonth = new Date(prev);
      newMonth.setMonth(prev.getMonth() + 1);
      return newMonth;
    });
  };

  const handlePrevDay = () => {
    setSelectedDate(prev => {
      const newDate = new Date(prev);
      if (viewMode === 'month') newDate.setMonth(prev.getMonth() - 1);
      else if (viewMode === 'week') newDate.setDate(prev.getDate() - 7);
      else newDate.setDate(prev.getDate() - 1);
      return newDate;
    });
    if (viewMode === 'month') {
      setCurrentMonth(prev => {
        const newMonth = new Date(prev);
        newMonth.setMonth(prev.getMonth() - 1);
        return newMonth;
      });
    }
  };

  const handleNextDay = () => {
    setSelectedDate(prev => {
      const newDate = new Date(prev);
      if (viewMode === 'month') newDate.setMonth(prev.getMonth() + 1);
      else if (viewMode === 'week') newDate.setDate(prev.getDate() + 7);
      else newDate.setDate(prev.getDate() + 1);
      return newDate;
    });
    if (viewMode === 'month') {
      setCurrentMonth(prev => {
        const newMonth = new Date(prev);
        newMonth.setMonth(prev.getMonth() + 1);
        return newMonth;
      });
    }
  };

  const handleToday = () => {
    setSelectedDate(new Date());
    setCurrentMonth(new Date());
  };

  const getEventColor = (event: CalendarEvent) => {
    const palette: Record<string, string> = {
      high: '#E11D48',
      medium: '#F59E0B',
      low: '#3B82F6',
    };
    if (event.color) return event.color;
    if (event.priority && palette[event.priority]) return palette[event.priority];
    return '#6366F1'; // default indigo accent
  };

  const getEventsForDate = (date: Date) => {
    const dateStr = toLocalDateString(date);
    // Filter out task events from localEvents since we show tasks separately via convertTasksToEvents()
    const localEvents = showHywizEvents ? events.filter(event => {
      const eventDate = toLocalDateString(event.startTime);
      // Exclude task-type events (tasks are shown via convertTasksToEvents)
      return eventDate === dateStr && event.type !== 'task';
    }) : [];
    const googleEvents = showGoogleEvents ? googleCalendarEvents.filter(event => {
      const start = event.start?.dateTime || event.start?.date;
      return toLocalDateString(start) === dateStr;
    }) : [];
    const taskEvents = showHywizTasks ? convertTasksToEvents().filter(taskEvent => {
      const taskDate = toLocalDateString(taskEvent.startTime);
      return taskDate === dateStr;
    }) : [];
    // Deduplicate by _id
    const seenIds = new Set<string>();
    const allEvents = [...localEvents, ...googleEvents, ...taskEvents];
    const uniqueEvents = allEvents.filter(event => {
      if (seenIds.has(event._id)) return false;
      seenIds.add(event._id);
      return true;
    });
    return uniqueEvents.length;
  };

  const getEventsListForDate = (date: Date) => {
    const dateStr = toLocalDateString(date);
    const localEvents = showHywizEvents ? events.filter(event => {
      const eventDate = toLocalDateString(event.startTime);
      return eventDate === dateStr && event.type !== 'task' && !event._id.startsWith('task-');
    }) : [];
    const googleEvents = showGoogleEvents ? googleCalendarEvents.filter((event: any) => {
      const start = event.start?.dateTime || event.start?.date;
      if (!start) return false;
      return toLocalDateString(start) === dateStr;
    }).map((event: any) => ({
      _id: event.id || `google-${event.start?.dateTime || event.start?.date}`,
      title: event.summary || 'Untitled Event',
      description: event.description || '',
      startTime: event.start?.dateTime || event.start?.date,
      endTime: event.end?.dateTime || event.end?.date,
      allDay: !event.start?.dateTime,
      location: event.location || '',
      type: 'event' as 'event' | 'task',
      priority: 'medium' as 'low' | 'medium' | 'high',
      status: 'pending' as 'pending' | 'in-progress' | 'completed' | 'cancelled',
      color: '#4285f4',
      userId: 'google-calendar',
      isSynced: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      attendees: event.attendees?.map((attendee: any) => ({
        email: attendee.email,
        name: attendee.displayName || attendee.email,
        responseStatus: attendee.responseStatus || 'needsAction'
      })) || []
    })) : [];
    const taskEvents = showHywizTasks ? taskEventsCache.filter((taskEvent: any) => {
      const taskDate = new Date(taskEvent.startTime).toISOString().split('T')[0];
      return taskDate === dateStr;
    }) : [];

    const allEvents = [...localEvents, ...googleEvents, ...taskEvents];
    const seenIds = new Set<string>();
    return allEvents.filter(event => {
      const eventId = String(event._id);
      if (seenIds.has(eventId)) return false;
      seenIds.add(eventId);
      return true;
    }).sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  };

  return (
    <div className="h-full flex bg-gradient-to-br from-gray-50 to-blue-50 dark:from-gray-900 dark:to-gray-800 black:from-[#242424] black:to-[#242424] text-gray-900 dark:text-white black:text-white max-w-[1920px] mx-auto w-full">
      {/* Left Sidebar */}
      <div className="w-64 bg-white/80 dark:bg-gray-900/80 black:bg-[#181818]/90 backdrop-blur-sm border-r border-gray-200/60 dark:border-gray-700 black:border-[#3a3a3a] shadow-lg flex flex-col">
        {/* Mini Calendar */}
        <div className="p-4 border-b border-gray-100 dark:border-gray-800 black:border-[#2a2a2a] bg-white dark:bg-gray-900 black:bg-[#181818] calendar-sideblock">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 black:text-gray-400 uppercase tracking-tight">
              {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </h3>
            <div className="flex space-x-1">
              <button onClick={handlePrevMonth} className="
              p-1.5 
              rounded-lg 
              text-gray-600 dark:text-gray-300 black:text-gray-300 
              transition-all duration-300
              hover:text-gray-900 dark:hover:text-white black:hover:text-white
              hover:bg-black/5 dark:hover:bg-white/5 black:hover:bg-white/5
              hover:backdrop-blur-sm
              hover:shadow-lg hover:shadow-black/20
              ">
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button onClick={handleNextMonth} className="
              p-1.5 
              rounded-lg 
              text-gray-600 dark:text-gray-300 black:text-gray-300 
              transition-all duration-300
              hover:text-gray-900 dark:hover:text-white black:hover:text-white
              hover:bg-black/5 dark:hover:bg-white/5 black:hover:bg-white/5
              hover:backdrop-blur-sm
              hover:shadow-lg hover:shadow-black/20
              ">
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-1 mb-3">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="text-center text-xs font-medium text-gray-600 dark:text-gray-300 black:text-gray-300 p-1">{day}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {getMiniCalendarDays().map((date, index) => (
              <button
                key={index}
                onClick={() => handleDateClick(date)}
                className={`w-8 h-8 flex items-center justify-center text-xs rounded-full transition-colors duration-200 relative font-medium mx-auto
                  hover:bg-gray-100 dark:hover:bg-gray-800 black:hover:bg-white/10
                  ${isSelected(date)
                    ? 'bg-blue-600 text-white shadow-md font-semibold'
                    : isToday(date)
                      ? 'text-blue-600 dark:text-blue-400 black:text-blue-400 font-bold'
                      : !isCurrentMonth(date)
                        ? 'text-gray-300 dark:text-gray-600 black:text-gray-600'
                        : 'text-gray-700 dark:text-gray-200 black:text-gray-200'
                  }`}
              >
                <span>{date.getDate()}</span>
                {getEventsForDate(date) > 0 && (
                  null
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Calendars Section */}
        <div className="p-4 border-b border-gray-100 dark:border-gray-800 black:border-[#2a2a2a] space-y-4">
          <div>
            <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 black:text-gray-400 mb-2 uppercase tracking-tight px-2">Hywiz Calendar</h3>
            <div className="space-y-1">
              <div className="flex items-center space-x-3 p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-all duration-200 group">
                <ClockPlus className="w-4 h-4 rounded text-blue-500 shadow-sm transition-transform group-hover:scale-110" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-200 black:text-gray-200">Events</span>
                <button
                  onClick={() => setShowHywizEvents(!showHywizEvents)}
                  className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                >
                  {showHywizEvents ? <Eye className="w-3.5 h-3.5 text-gray-500" /> : <EyeOff className="w-3.5 h-3.5 text-gray-500" />}
                </button>
              </div>
              <div className="flex items-center space-x-3 p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-all duration-200 group">
                <CircleCheckBig className="w-4 h-4 rounded text-purple-500 shadow-sm transition-transform group-hover:scale-110" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-200 black:text-gray-200">Tasks</span>
                <button
                  onClick={() => setShowHywizTasks(!showHywizTasks)}
                  className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                >
                  {showHywizTasks ? <Eye className="w-3.5 h-3.5 text-gray-500" /> : <EyeOff className="w-3.5 h-3.5 text-gray-500" />}
                </button>
              </div>
            </div>
          </div>

          {isGoogleCalendarConnected && (
            <div>
              <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 black:text-gray-400 mb-2 truncate px-2">{googleAccount?.email ?? 'Google Account'}</h3>
              <div className="space-y-1">
                <div className="flex items-center space-x-3 p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-all duration-200 group">
                  <UserRoundPen className="w-4 h-4 rounded text-red-400 shadow-sm transition-transform group-hover:scale-110" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-200 black:text-gray-200 truncate flex-1">{googleAccount?.email ?? 'Google Account'}</span>
                  <button
                    onClick={() => setShowGoogleEvents(!showGoogleEvents)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                  >
                    {showGoogleEvents ? <Eye className="w-3.5 h-3.5 text-gray-500" /> : <EyeOff className="w-3.5 h-3.5 text-gray-500" />}
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="pt-2">
            <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 black:text-gray-400 mb-2 uppercase tracking-tight px-2">Connect calendar</h3>
            <GoogleCalendarAuth />
          </div>
        </div>

      </div>

      {/* Main Calendar View */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Modernized Header */}
        <div className="bg-gradient-to-br from-gray-50 to-blue-50/30 dark:from-gray-900 dark:to-gray-900 black:from-[#242424] black:to-[#242424] backdrop-blur-md border-b border-gray-100 dark:border-gray-800 black:border-[#2a2a2a] p-4 flex items-center justify-between shadow-sm z-30">
          <div className="flex items-center">
            <div>
              <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100 black:text-gray-100 flex items-center gap-2">
                <CalendarIcon className="w-5 h-5 text-blue-600" />
                Calendar
              </h1>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {/* Custom View Switcher (No Chevron) */}
            <div className="flex bg-gray-100 dark:bg-gray-800 black:bg-[#2a2a2a] p-1 rounded-lg">
              {(['day', 'week', 'month'] as const).map((view) => (
                <button
                  key={view}
                  onClick={() => setViewMode(view)}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all duration-200 ${viewMode === view
                    ? 'bg-white dark:bg-gray-700 black:bg-[#3a3a3a] text-blue-600 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 black:text-gray-400 black:hover:text-gray-200'
                    }`}
                >
                  {view.charAt(0).toUpperCase() + view.slice(1)}
                </button>
              ))}
            </div>

            <div className="h-8 w-px" style={{ backgroundColor: dividerColor }}></div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => setShowTaskPanel(true)}
                className="
                            p-2
                            text-blue-600 dark:text-blue-400
                            bg-gray-100 dark:bg-gray-800 black:bg-[#2a2a2a]
                            border border-transparent
                            hover:bg-blue-500/10
                            hover:border-blue-500/30
                            hover:text-blue-700 dark:hover:text-blue-300
                            hover:scale-[1.03]
                            active:scale-100
                            rounded-lg
                            transition-all duration-200 ease-out
                          "
                title="New Task"
              >
                <Check className="w-4 h-4" />
              </button>

              <div className="h-8 w-px" style={{ backgroundColor: dividerColor }}></div>

              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all duration-200 shadow-md hover:shadow-lg font-bold text-sm"
              >
                <Plus className="w-4 h-4" />
                <span>New Event</span>
              </button>

              <div className="h-8 w-px" style={{ backgroundColor: dividerColor }}></div>

              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setShowSettings(!showSettings)}
                  className={`p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-all ${showSettings ? 'bg-gray-100 dark:bg-gray-800 black:bg-[#2a2a2a]' : 'hover:bg-gray-100 dark:hover:bg-gray-800 black:hover:bg-[#2a2a2a]'}`}
                >
                  <MoreHorizontal className="w-4 h-4" />
                </button>

                {showSettings && (
                  <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-gray-800 black:bg-[#181818] rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 black:border-[#3a3a3a] py-2 z-50 overflow-hidden">
                    <div className="px-4 py-2 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Accounts</div>
                    <div className="px-2 space-y-1">
                      <div className="flex items-center justify-between px-3 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-colors cursor-pointer group">
                        <span className="flex items-center gap-2.5">
                          <div className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]"></div>
                          <span className="font-medium">Hywiz Calendar</span>
                        </span>
                        <Check className="w-4 h-4 text-blue-500" />
                      </div>
                      {isGoogleCalendarConnected && (
                        <div className="flex items-center justify-between px-3 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-colors cursor-pointer group">
                          <span className="flex items-center gap-2.5 truncate pr-2">
                            <div className="w-2.5 h-2.5 rounded-full bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.5)]"></div>
                            <span className="truncate font-medium text-blue-600 dark:text-blue-400">{googleAccount?.email || 'Connected'}</span>
                          </span>
                          <Check className="w-4 h-4 text-blue-500" />
                        </div>
                      )}
                    </div>
                    <div className="h-px bg-gray-100 dark:bg-gray-800 black:bg-[#2a2a2a] my-2 mx-2"></div>
                    <div className="px-2 space-y-0.5">
                      <div
                        className="flex items-center justify-between px-3 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
                        onClick={() => setShowWeekends(!showWeekends)}
                      >
                        <span className="font-medium text-gray-800 dark:text-gray-200">Show Weekends</span>
                        {showWeekends && <Check className="w-4 h-4 text-blue-500" />}
                      </div>
                      <div className="flex items-center px-3 py-2.5 text-sm font-medium text-gray-800 dark:text-gray-200 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-colors cursor-pointer">
                        Add calendar account
                      </div>
                      <div
                        className="flex items-center px-3 py-2.5 text-sm font-medium text-gray-800 dark:text-gray-200 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
                        onClick={() => {
                          setShowSettingsModal(true);
                          setShowSettings(false);
                        }}
                      >
                        Calendar settings
                      </div>
                      <div
                        className="flex items-center justify-between px-3 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
                        onClick={() => setStartWeekOn(startWeekOn === 'Monday' ? 'Sunday' : 'Monday')}
                      >
                        <span className="font-medium text-gray-800 dark:text-gray-200">Start week on</span>
                        <span className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 font-medium">
                          <span className="text-gray-600 dark:text-gray-400">{startWeekOn}</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>


        <div className="flex-1 flex flex-col overflow-hidden relative">
          {/* Top Accordion Task Header */}
          <div className={`overflow-hidden transition-all duration-500 transform-gpu ${viewMode === 'day'
            ? 'max-h-[600px] opacity-100 translate-y-0 border-b border-gray-200/60 dark:border-gray-700 black:border-[#3a3a3a]'
            : 'max-h-0 opacity-0 -translate-y-4 border-none'
            }`}
            style={{ transitionTimingFunction: viewMode === 'day' ? 'cubic-bezier(0.34, 1.56, 0.64, 1)' : 'ease-in-out' }}
          >
            <div className="bg-gradient-to-br from-gray-50 to-blue-50/30 dark:from-gray-900 dark:to-gray-900 black:from-[#242424] black:to-[#242424]">
              <div
                className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                onClick={() => setIsTaskAccordionExpanded(!isTaskAccordionExpanded)}
              >
                <div className="flex items-center gap-2">
                  <LayoutList className="w-4 h-4 text-[#2563eb]" />
                  <h3 className="font-bold text-sm text-gray-700 dark:text-gray-300 black:text-gray-300 uppercase tracking-wider">Tasks</h3>
                </div>
                <div className={`p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 black:hover:bg-[#333] transition-transform duration-300 ${isTaskAccordionExpanded ? 'rotate-180' : ''}`}>
                  <ChevronDown className="w-4 h-4 text-gray-500" />
                </div>
              </div>

              <div className={`overflow-hidden transition-all duration-500 ease-in-out ${isTaskAccordionExpanded ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}>
                <div className="px-4 pb-4">
                  <div className="h-px mb-4 w-full" style={{ backgroundColor: dividerColor }}></div>
                  <div className="flex flex-wrap gap-3 overflow-x-auto pb-2 scrollbar-hide">
                    {showHywizTasks && taskEventsCache
                      .filter(t => toLocalDateString(t.startTime) === toLocalDateString(getSelectedDate()))
                      .sort((a) => (a.status === 'completed' ? 1 : -1))
                      .map((taskEvent) => {
                        const rawTaskId = taskEvent._id.replace(/^task-/, '');
                        const isHistory = rawTaskId?.startsWith('history-');
                        const isProjected = !isHistory && rawTaskId && rawTaskId.length > 24 && rawTaskId.includes('-');

                        let originalTaskId = rawTaskId;
                        if (isHistory && rawTaskId) {
                          originalTaskId = rawTaskId.split('-')[1];
                        } else if (isProjected && rawTaskId) {
                          originalTaskId = rawTaskId.split('-')[0];
                        }

                        const task = tasks.find(t => String(t.id || (t as any)._id) === originalTaskId);
                        const isCompleted = taskEvent.status === 'completed' || (task?.status === 'completed' && !isProjected);

                        return (
                          <div
                            key={taskEvent._id}
                            onClick={() => {
                              if (task) {
                                const targetDate = isProjected ? rawTaskId.substring(25) : null;
                                setEditingTaskId(isProjected ? null : String(task.id || (task as any)._id));
                                setEditingTaskInitial({
                                  text: task.title,
                                  description: task.description,
                                  dueDate: targetDate ? new Date(targetDate).toISOString() : task.dueDateWall,
                                  startDate: (task as any).startDate,
                                  priority: task.priority as 'low' | 'medium' | 'high',
                                  reminder: task.reminder,
                                  isRecurring: task.isRecurring,
                                  recurringPattern: task.recurringPattern,
                                  completed: isProjected ? false : task.status === 'completed',
                                  noteId: task.noteId,
                                });
                                setShowTaskPanel(true);
                              }
                            }}
                            className={`min-w-[200px] max-w-[250px] p-3 rounded-xl border transition-all duration-200 cursor-pointer shadow-sm hover:shadow-md transform hover:-translate-y-0.5 flex-shrink-0
                          ${isCompleted
                                ? 'bg-gray-200/60 dark:bg-gray-800/50 black:bg-[#282828] border-gray-300 dark:border-gray-700 black:border-[#383838] opacity-60'
                                : 'bg-white dark:bg-gray-800 black:bg-[#2a2a2a] border-gray-300 dark:border-gray-700 black:border-[#383838]'
                              }`}
                          >
                            <div className="flex items-start gap-2">
                              <button
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  if (isHistory) return;
                                  if (task) await toggleTask(originalTaskId!);
                                }}
                                className={`mt-0.5 transition-colors ${isCompleted ? 'text-[#00a82d]' : 'text-gray-400 hover:text-[#00a82d]'}`}
                              >
                                {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
                              </button>

                              <div className="flex-1 min-w-0">
                                <div className={`text-xs font-medium truncate ${isCompleted ? 'line-through text-gray-500' : 'text-gray-900 dark:text-gray-100 black:text-gray-100'}`}>
                                  {taskEvent.title.replace(/^📋\s*/, '')}
                                </div>
                                <div className="flex items-center gap-1.5 mt-1">
                                  <span className={`text-[9px] font-bold px-1 py-0.5 rounded uppercase
                                ${taskEvent.priority === 'high' ? 'bg-red-100 text-red-600 dark:bg-red-900/40' :
                                      taskEvent.priority === 'medium' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/40' :
                                        'bg-gray-100 text-gray-600 dark:bg-gray-700'
                                    }`}>
                                    {taskEvent.priority}
                                  </span>
                                  {!taskEvent.allDay && (
                                    <span className="text-[9px] text-gray-400 flex items-center gap-1">
                                      <Clock className="w-2 h-2" />
                                      {formatTime(taskEvent.startTime)}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}

                    {(!showHywizTasks || taskEventsCache.filter(t => toLocalDateString(t.startTime) === toLocalDateString(getSelectedDate())).length === 0) && (
                      <div className="w-full flex items-center justify-center py-4 opacity-40 gap-3">
                        <LayoutList className="w-6 h-6" />
                        <p className="text-xs font-medium uppercase tracking-widest">{!showHywizTasks ? 'Tasks are hidden' : 'No tasks for today'}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
          {/* X and Y axis */}
          <div className='bg-gradient-to-br from-gray-50 to-blue-50/30 dark:from-gray-900 dark:to-gray-900 black:from-[#242424] black:to-[#242424] backdrop-blur-md border-b border-gray-100 dark:border-gray-800 black:border-[#2a2a2a] p-2 flex items-center justify-between shadow-sm'>
            <div className='flex'>
              <p className="text-xs font-medium text-gray-700 dark:text-gray-300 black:text-gray-300 uppercase tracking-widest mt-0.5">
                {viewMode === 'day' && formatDate(getSelectedDate())}
                {viewMode === 'week' && `${getWeekDays()[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${getWeekDays()[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`}
                {viewMode === 'month' && getSelectedDate().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </p>
            </div>
            <div className='flex'>
              <div className="flex items-center space-x-1 bg-gray-100 dark:bg-gray-800 black:bg-[#2a2a2a] p-1 rounded-lg">
                <button
                  onClick={handleToday}
                  className="
                      px-3 py-1.5 text-xs font-semibold
                      text-gray-700 dark:text-gray-200 black:text-gray-200
                      hover:text-gray-900 dark:hover:text-white black:hover:text-white
                      rounded-md
                      transition-colors duration-200
                    "
                >
                  Today
                </button>

                <div className="w-px h-3 bg-gray-300 dark:bg-gray-600 black:bg-[#444] mx-1"></div>

                <button
                  onClick={handlePrevDay}
                  className="
                  p-1.5
                  text-gray-600 dark:text-gray-300 black:text-gray-300
                  hover:text-gray-800 dark:hover:text-white black:hover:text-white
                  rounded-md
                  transition-colors duration-200
                "
                >
                  <ChevronLeft className="w-3.5 h-3.5 transition-transform duration-200 group-hover:scale-110" />
                </button>

                <button
                  onClick={handleNextDay}
                  className="
                  p-1.5
                  text-gray-600 dark:text-gray-300 black:text-gray-300
                  hover:text-gray-800 dark:hover:text-white black:hover:text-white
                  rounded-md
                  transition-colors duration-200
                "
                >
                  <ChevronRight className="w-3.5 h-3.5 transition-transform duration-200" />
                </button>

              </div>
            </div>
          </div>
          {/* Main Grid Area */}
          <div className="flex-1 overflow-auto bg-gradient-to-br from-gray-50 to-blue-50/30 dark:from-gray-900 dark:to-gray-900 black:from-[#242424] black:to-[#242424] relative">
            {viewMode === 'day' && (
              <>
                <div className="absolute left-20 right-0 h-0.5 bg-gradient-to-r from-blue-500 to-purple-500 z-10 shadow-lg" style={{ top: `${(new Date().getHours() * 60 + new Date().getMinutes()) * (60 / 60)}px` }}></div>
                {getHoursArray().map(hour => {
                  const hourEvents = getEventsForHour(hour);
                  const timeLabel = hour === 0 ? '12 AM' : hour === 12 ? '12 PM' : hour > 12 ? `${hour - 12} PM` : `${hour} AM`;
                  return (
                    <div key={hour} className="flex border-b border-gray-200/60 dark:border-gray-700 black:border-[#3a3a3a] min-h-[60px] hover:bg-white/50 dark:hover:bg-gray-800/50 black:hover:bg-[#2a2a2a]/50 transition-colors duration-200">
                      <div className="w-20 p-3 text-sm font-medium text-gray-700 dark:text-gray-300 black:text-gray-300 border-r border-gray-200/60 dark:border-gray-700 black:border-[#3a3a3a] flex-shrink-0 bg-white/50 dark:bg-gray-900/50 black:bg-[#242424]">
                        {timeLabel}
                      </div>
                      <div className="flex-1 relative p-3">
                        {hourEvents.map((event, index) => {
                          const isTask = event.type === 'task' && event._id.startsWith('task-');
                          let rawTaskId = isTask ? event._id.replace(/^task-/, '') : null;

                          // Identify event subtypes based on ID structure
                          // IDs: task-{id}, task-{id}-{date} (projected), task-history-{id}-{index} (history)
                          const isHistory = rawTaskId?.startsWith('history-');

                          // Check if it's a projected occurrence (has date suffix, but NOT history)
                          // ID format: {id}-{date}
                          const isProjected = !isHistory && rawTaskId && rawTaskId.length > 24 && rawTaskId.includes('-');

                          let originalTaskId = rawTaskId;
                          if (isHistory && rawTaskId) {
                            const parts = rawTaskId.split('-');
                            originalTaskId = parts[1]; // history-ID-index
                          } else if (isProjected && rawTaskId) {
                            originalTaskId = rawTaskId.split('-')[0];
                          }

                          const task = isTask ? tasks.find(t => String(t.id || (t as any)._id) === originalTaskId) : null;

                          // Determine visual completion state
                          // Trust the event's status first (for history items), then fall back to task state
                          const isVisuallyCompleted = event.status === 'completed' || (task?.status === 'completed' && !isProjected);

                          return (
                            <div
                              key={event._id}
                              className={`absolute left-3 right-3 p-2.5 rounded-lg text-[11px] cursor-pointer transition-all duration-150 shadow-sm hover:shadow ${isTask && isVisuallyCompleted ? 'opacity-75' : ''
                                } bg-white/95 dark:bg-slate-900/90 black:bg-[#0f0f0f] text-slate-900 dark:text-slate-100 black:text-slate-100 border border-slate-200 dark:border-slate-800 black:border-[#262626]`}
                              style={{
                                top: `${index * 26}px`,
                                zIndex: index + 1,
                                borderLeft: `3px solid ${getEventColor(event)}`
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (isTask && task) {
                                  // If history, maybe show details instead of edit panel?
                                  // For now, allow editing the parent task but be careful.
                                  const targetDate = isProjected && rawTaskId ? rawTaskId.substring(25) : null;

                                  setEditingTaskId(isProjected ? null : String(task.id || (task as any)._id));
                                  setEditingTaskInitial({
                                    text: task.title,
                                    description: task.description,
                                    dueDate: targetDate ? new Date(targetDate).toISOString() : task.dueDateWall,
                                    startDate: (task as any).startDate,
                                    priority: task.priority as 'low' | 'medium' | 'high',
                                    reminder: task.reminder,
                                    isRecurring: task.isRecurring,
                                    recurringPattern: task.recurringPattern,
                                    completed: isProjected ? false : task.status === 'completed',
                                    noteId: task.noteId,
                                  });
                                  setShowTaskPanel(true);
                                } else {
                                  setSelectedEvent(event);
                                }
                              }}
                            >
                              <div className="flex items-center gap-2 mb-1.5 flex-wrap md:flex-nowrap">
                                {isTask && (
                                  <input
                                    type="checkbox"
                                    checked={isVisuallyCompleted}
                                    disabled={!!isHistory} // Disable checking/unchecking history items directly
                                    onChange={async (e) => {
                                      e.stopPropagation();
                                      if (isHistory) return; // Should be disabled, but safety check

                                      if (task && rawTaskId) {
                                        try {
                                          if (isProjected && rawTaskId) {
                                            // Projected task toggle logic (same as before)
                                            await toggleTask(originalTaskId!);
                                          } else {
                                            // Normal task toggle
                                            await toggleTask(originalTaskId!);
                                          }
                                        } catch (error) {
                                          console.error('Failed to toggle task:', error);
                                        }
                                      }
                                    }}
                                    className={`w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer ${isHistory ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                )}
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wide bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 black:bg-white black:text-black">
                                  {isTask ? 'Task' : 'Event'}
                                </span>
                                <span className="font-semibold text-xs text-slate-800 dark:text-slate-100 black:text-slate-100">{formatTime(event.startTime)}</span>
                                {event.priority !== 'medium' && (
                                  <Star className="w-3.5 h-3.5 text-slate-500 dark:text-slate-300 black:text-slate-300" />
                                )}
                                {(event._id.startsWith('google-') || event.userId === 'google-calendar') && (
                                  <div className="ml-auto w-2.5 h-2.5 bg-amber-400 rounded-full shadow-sm" title="Google Calendar Event"></div>
                                )}
                              </div>
                              <div
                                className={`font-semibold text-sm truncate ${isTask && isVisuallyCompleted ? 'line-through opacity-75' : 'text-slate-900 dark:text-slate-100 black:text-slate-100'
                                  }`}
                              >
                                {event.title}
                              </div>
                              <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-600 dark:text-slate-300 black:text-slate-300">
                                {event.location && (
                                  <span className="inline-flex items-center gap-1">
                                    <MapPin className="w-3 h-3 text-slate-400" />
                                    <span className="truncate">{event.location}</span>
                                  </span>
                                )}
                                {event.attendees && event.attendees.length > 0 && (
                                  <span className="inline-flex items-center gap-1">
                                    <Users className="w-3 h-3 text-slate-400" />
                                    <span>{event.attendees.length} attendees</span>
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </>
            )}

            {viewMode === 'week' && (
              <div className="flex flex-col min-w-[800px] h-full bg-gray-50 dark:bg-gray-900 black:bg-[#242424]">
                <div className="flex border-b border-gray-200 dark:border-gray-700/60 black:border-[#333] sticky top-0 bg-white dark:bg-gray-900 black:bg-[#181818] z-20 shadow-[0_4px_20px_-10px_rgba(0,0,0,0.1)] backdrop-blur-xl transition-colors">
                  <div className="w-20 p-3 flex-shrink-0 border-r border-gray-200 dark:border-gray-700/60 black:border-[#333] flex items-end justify-center">
                    <span className="text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1">Time</span>
                  </div>
                  {getWeekDays().map((day, i) => (
                    <div key={i} className={`flex-1 p-3 flex flex-col items-center justify-center border-r border-gray-200 dark:border-gray-700/60 black:border-[#333] last:border-r-0 transition-all duration-300 relative overflow-hidden group ${isToday(day) ? 'bg-blue-50/80 dark:bg-blue-900/20 black:bg-blue-900/20' : 'hover:bg-gray-100/50 dark:hover:bg-gray-800/30 black:hover:bg-[#222]/50'}`}>
                      {isToday(day) && (
                        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-purple-500" />
                      )}
                      <div className={`text-xs font-bold uppercase tracking-widest mb-1 transition-colors ${isToday(day) ? 'text-blue-600 dark:text-blue-400 black:text-blue-400' : 'text-gray-500 dark:text-gray-400 black:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-300'}`}>{day.toLocaleDateString('en-US', { weekday: 'short' })}</div>
                      <div className={`w-8 h-8 flex items-center justify-center rounded-full text-lg font-bold transition-all duration-300 transform group-hover:scale-110 ${isToday(day) ? 'bg-blue-600 text-white shadow-shadow-md shadow-blue-500/30' : 'text-gray-800 dark:text-gray-100 black:text-gray-100'}`}>{day.getDate()}</div>
                    </div>
                  ))}
                </div>
                <div className="relative flex-1">
                  <div className="absolute left-20 right-0 h-[2px] bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 z-10 shadow-[0_0_8px_rgba(59,130,246,0.6)] rounded-full animate-pulse" style={{ top: `${(new Date().getHours() * 60 + new Date().getMinutes()) * (80 / 60)}px` }} />
                  {getHoursArray().map(hour => {
                    const timeLabel = hour === 0 ? '12 AM' : hour === 12 ? '12 PM' : hour > 12 ? `${hour - 12} PM` : `${hour} AM`;
                    return (
                      <div key={hour} className="flex border-b border-gray-200/50 dark:border-gray-800/50 black:border-[#2a2a2a]/50 h-[80px] hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors duration-200 group">
                        <div className="w-20 p-3 text-xs font-medium text-gray-500 dark:text-gray-400 black:text-gray-400 border-r border-gray-200/50 dark:border-gray-800/50 black:border-[#2a2a2a]/50 flex-shrink-0 bg-white dark:bg-gray-900 black:bg-[#242424] flex items-start justify-end pr-4">
                          <span className="relative top-[-8px] tracking-tight">{timeLabel}</span>
                        </div>
                        {getWeekDays().map((day, dayIndex) => {
                          const hourEvents = getEventsForHour(hour, day);
                          return (
                            <div key={dayIndex} className={`flex-1 relative p-1.5 border-r border-gray-200/50 dark:border-gray-800/50 black:border-[#2a2a2a]/50 last:border-r-0 transition-colors ${isToday(day) ? 'bg-blue-50/10 dark:bg-blue-900/10 black:bg-blue-900/10' : ''}`}>
                              {hourEvents.map((event, index) => {
                                const isTask = event.type === 'task' && event._id.startsWith('task-');
                                let originalTaskId = isTask ? event._id.replace(/^task-/, '') : null;
                                if (originalTaskId?.startsWith('history-')) {
                                  originalTaskId = originalTaskId.split('-')[1];
                                } else if (originalTaskId?.length && originalTaskId.length > 24 && originalTaskId.includes('-')) {
                                  originalTaskId = originalTaskId.split('-')[0];
                                }
                                const task = isTask ? tasks.find(t => String(t.id || (t as any)._id) === originalTaskId) : null;
                                const isVisuallyCompleted = event.status === 'completed' || (task?.status === 'completed');
                                return (
                                  <div
                                    key={event._id}
                                    className={`absolute left-1 right-1 p-2 rounded-lg text-xs cursor-pointer shadow-sm hover:shadow-md transition-all duration-200 transform hover:-translate-y-0.5 border flex flex-col gap-1 overflow-hidden group/event ${isTask && isVisuallyCompleted ? 'opacity-60 grayscale-[0.5]' : ''}`}
                                    style={{
                                      top: `${index * 32 + 2}px`,
                                      zIndex: index + 2,
                                      backgroundColor: `${getEventColor(event)}15`,
                                      borderColor: `${getEventColor(event)}30`,
                                      borderLeft: `4px solid ${getEventColor(event)}`,
                                      minHeight: '28px'
                                    }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (isTask && task) {
                                        setEditingTaskId(originalTaskId);
                                        setEditingTaskInitial({
                                          text: task.title,
                                          description: task.description,
                                          dueDate: task.dueDateWall,
                                          priority: task.priority as 'low' | 'medium' | 'high',
                                          completed: task.status === 'completed'
                                        });
                                        setShowTaskPanel(true);
                                      } else {
                                        setSelectedEvent(event);
                                      }
                                    }}
                                  >
                                    <div className="font-semibold truncate text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                                      {isTask && <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isVisuallyCompleted ? 'bg-green-500' : 'bg-blue-500'}`} />}
                                      {!isTask && <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: getEventColor(event) }} />}
                                      <span className={isTask && isVisuallyCompleted ? 'line-through' : ''}>{event.title}</span>
                                    </div>
                                    {!event.allDay && (
                                      <div className="text-[10px] font-medium opacity-80 flex items-center gap-1 mt-0.5 truncate" style={{ color: getEventColor(event) }}>
                                        <Clock className="w-3 h-3 group-hover/event:rotate-12 transition-transform" /> {formatTime(event.startTime)}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {viewMode === 'month' && (
              <div className="flex flex-col h-full bg-white dark:bg-gray-900 black:bg-[#181818]">
                <div className={`grid ${showWeekends ? 'grid-cols-7' : 'grid-cols-5'} border-b border-gray-200/60 dark:border-gray-700 black:border-[#3a3a3a]`}>
                  {(showWeekends
                    ? (startWeekOn === 'Monday' ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'])
                    : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
                  ).map(day => (
                    <div key={day} className="p-2 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 black:text-gray-400 uppercase tracking-wider border-r border-gray-200/60 dark:border-gray-700 black:border-[#3a3a3a] last:border-r-0">
                      {day}
                    </div>
                  ))}
                </div>
                <div className={`grid ${showWeekends ? 'grid-cols-7' : 'grid-cols-5'} flex-1 auto-rows-[minmax(100px,1fr)]`}>
                  {getMonthDays().map((date, index) => {
                    const isCurrentM = date.getMonth() === getSelectedDate().getMonth();
                    const dayEvents = getEventsListForDate(date);
                    return (
                      <div
                        key={index}
                        onClick={() => { setSelectedDate(date); setViewMode('day'); }}
                        className={`border-b border-r border-gray-200/60 dark:border-gray-700 black:border-[#3a3a3a] p-1.5 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 black:hover:bg-[#2a2a2a]/50 transition-colors group
                          ${!isCurrentM ? 'opacity-40 bg-gray-50/50 dark:bg-gray-900/50 black:bg-[#1a1a1a]/50' : ''}
                          ${isSelected(date) ? 'bg-blue-50/30 dark:bg-blue-900/10 black:bg-blue-900/10' : ''}
                        `}
                      >
                        <div className="flex justify-between items-center mb-1">
                          <span className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold
                            ${isToday(date) ? 'bg-blue-600 text-white' : 'text-gray-700 dark:text-gray-300 black:text-gray-300 group-hover:bg-gray-200 dark:group-hover:bg-gray-700 black:group-hover:bg-[#333]'}
                          `}>
                            {date.getDate()}
                          </span>
                        </div>
                        <div className="space-y-1 mt-1">
                          {dayEvents.slice(0, 4).map((event) => (
                            <div
                              key={event._id}
                              className="text-[10px] px-1.5 py-0.5 rounded truncate bg-opacity-20 border-l-2"
                              style={{
                                backgroundColor: `${getEventColor(event)}15`,
                                borderColor: getEventColor(event),
                                color: getEventColor(event)
                              }}
                            >
                              {event.title}
                            </div>
                          ))}
                          {dayEvents.length > 4 && (
                            <div className="text-[10px] text-gray-500 dark:text-gray-400 font-medium px-1">
                              +{dayEvents.length - 4} more
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {showCreateModal && (
        <CreateEventModal onClose={() => setShowCreateModal(false)} selectedDate={getSelectedDate()} notes={notes} />
      )}

      {/* Centered New Task panel opened by tick button */}
      {showTaskPanel && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
          onClick={() => setShowTaskPanel(false)}
        >
          <div
            className="bg-white dark:bg-gray-900 black:bg-[#242424] rounded-xl shadow-2xl w-full max-w-md border border-gray-200 dark:border-gray-700 black:border-[#3a3a3a] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-700 black:border-[#3a3a3a] bg-white dark:bg-gray-900 black:bg-[#242424]">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 black:text-gray-100 leading-tight">
                Things to do
              </h2>
              <button
                onClick={() => setShowTaskPanel(false)}
                className="text-gray-400 hover:text-gray-600 dark:text-gray-400 dark:hover:text-gray-200 black:text-gray-400 black:hover:text-gray-100 p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 black:hover:bg-[#2a2a2a] transition-colors"
              >
                ×
              </button>
            </div>

            <div className="p-3">
              <CreateTaskDropdown
                selectedDate={getSelectedDate()}
                mode={editingTaskId ? 'edit' : 'create'}
                initialData={editingTaskInitial ?? undefined}
                onClose={() => {
                  setShowTaskPanel(false);
                  setEditingTaskId(null);
                  setEditingTaskInitial(null);
                }}
                onSubmit={async (taskData) => {
                  const payload = {
                    title: taskData.text,
                    status: taskData.completed ? 'completed' as const : 'pending' as const,
                    isFloating: !taskData.dueDate,
                    dueDateWall: taskData.dueDate,
                    dueDate: taskData.dueDate, // Keep for backward compatibility if needed by store wrapper
                    startDate: taskData.startDate ? (taskData.startDate instanceof Date ? taskData.startDate.toISOString() : taskData.startDate) : undefined,
                    priority: (taskData.priority === 'critical' ? 'high' : taskData.priority) as 'low' | 'medium' | 'high',
                    isRecurring: !!taskData.isRecurring,
                    recurringPattern: taskData.isRecurring ? taskData.recurringPattern : undefined,
                    reminder: taskData.reminder,
                    noteId: taskData.noteId as string | undefined,
                    templateId: undefined as string | undefined,
                    description: taskData.description,
                  };

                  if (editingTaskId) {
                    await updateTask(editingTaskId, payload);
                  } else {
                    await createTask(payload);
                  }

                  await fetchTasks();
                  setShowTaskPanel(false);
                  setEditingTaskId(null);
                  setEditingTaskInitial(null);
                }}
                onDelete={editingTaskId ? async () => {
                  if (editingTaskId) {
                    await deleteTask(editingTaskId);
                    await fetchTasks();
                  }
                } : undefined}
                taskId={editingTaskId ?? undefined}
              />
            </div>
          </div>
        </div>
      )}

      {selectedEvent && (
        <EventDetailsModal event={selectedEvent} onClose={() => setSelectedEvent(null)} onEdit={() => {
          // If this is a task event, open the task panel instead of event editor
          if (selectedEvent.type === 'task' && selectedEvent._id.startsWith('task-')) {
            const rawId = selectedEvent._id.replace(/^task-/, '');

            // Handle projected task IDs
            const isProjected = rawId.length > 24 && rawId.includes('-');
            const originalTaskId = isProjected ? rawId.split('-')[0] : rawId;
            const targetDate = isProjected ? rawId.substring(25) : null;

            const task = tasks.find(t => String(t.id || (t as any)._id) === originalTaskId);

            const base = task ? {
              text: task.title,
              description: task.description,
              dueDate: targetDate ? new Date(targetDate).toISOString() : task.dueDateWall,
              startDate: (task as any).startDate,
              priority: (task.priority === 'critical' ? 'high' : task.priority) as 'low' | 'medium' | 'high',
              reminder: task.reminder,
              isRecurring: task.isRecurring,
              recurringPattern: task.recurringPattern,
              completed: isProjected ? false : task.status === 'completed',
              noteId: task.noteId,
            } : {
              text: selectedEvent.title.replace(/^📋\s*/, ''),
              dueDate: selectedEvent.startTime,
              priority: selectedEvent.priority as 'low' | 'medium' | 'high',
              reminder: undefined,
              isRecurring: false,
              recurringPattern: undefined,
              completed: false,
            };

            setEditingTaskId(isProjected ? null : String(task ? (task.id || (task as any)._id) : rawId));
            setEditingTaskInitial(base);
            setSelectedEvent(null);
            setShowTaskPanel(true);
          } else {
            setSelectedEvent(null);
            setShowCreateModal(true);
          }
        }} onDelete={async () => {
          try {
            if (selectedEvent._id.startsWith('google-') || selectedEvent.userId === 'google-calendar') {
              alert('This is a Google Calendar event. Please delete it from your Google Calendar directly. Local events can be deleted from this interface.');
              setSelectedEvent(null);
              return;
            }
            await deleteEvent(selectedEvent._id);
            setSelectedEvent(null);
          } catch (error: any) {
            console.error('Failed to delete event:', error);
            console.error('Error details:', error.response?.data);
          }
        }} />
      )}
      {showSettingsModal && (
        <CalendarSettingsModal
          onClose={() => setShowSettingsModal(false)}
        />
      )}
    </div>
  );
};

// Create Event Modal Component
const CreateEventModal: React.FC<{
  onClose: () => void;
  selectedDate: Date;
  notes: any[];
}> = ({ onClose, selectedDate, notes }) => {
  const { createEvent, isGoogleCalendarConnected, googleAccount } = useCalendarStore();
  const [showCalendarDropdown, setShowCalendarDropdown] = useState(false);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest('.calendar-dropdown')) {
        setShowCalendarDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  const [formData, setFormData] = useState({
    title: '',
    startDate: selectedDate.toISOString().split('T')[0],
    startTime: '17:00',
    endDate: selectedDate.toISOString().split('T')[0],
    endTime: '18:00',
    allDay: false,
    calendar: googleAccount?.email || 'primary',
    createInGoogle: true,
    createInApp: true
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {

      // Convert form data to the expected format
      const eventData = {
        title: formData.title,
        startTime: `${formData.startDate}T${formData.startTime}`,
        endTime: `${formData.endDate}T${formData.endTime}`,
        allDay: formData.allDay,
        type: 'event' as 'event' | 'task',
        priority: 'medium' as 'low' | 'medium' | 'high',
        color: '#4285f4',
        attendees: [] as Array<{ email: string; name: string; responseStatus: 'needsAction' | 'declined' | 'tentative' | 'accepted' }>,
        createInGoogle: formData.createInGoogle && isGoogleCalendarConnected,
        createInApp: formData.createInApp
      };

      await createEvent(eventData);
      onClose();
    } catch (error) {
      console.error('Failed to create event:', error);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setShowCalendarDropdown(false)}>
      <div className="bg-white dark:bg-gray-900 black:bg-[#242424] rounded-xl shadow-2xl w-full max-w-md border border-gray-200 dark:border-gray-700 black:border-[#3a3a3a]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-700 black:border-[#3a3a3a] bg-white dark:bg-gray-900 black:bg-[#242424]">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 black:text-gray-100 leading-tight">Create Event</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:text-gray-400 dark:hover:text-gray-200 black:text-gray-400 black:hover:text-gray-100 p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 black:hover:bg-[#2a2a2a] transition-colors">
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-3 space-y-3">
          {/* Event title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 black:text-gray-300 mb-2">Event Title</label>
            <input
              type="text"
              placeholder="Enter event title..."
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 black:bg-[#2a2a2a] border border-gray-200 dark:border-gray-600 black:border-[#404040] rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 black:focus:ring-blue-400 focus:border-transparent text-gray-900 dark:text-gray-100 black:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 black:placeholder-gray-400 transition-all duration-200 hover:border-gray-400 dark:hover:border-gray-500 black:hover:border-[#505050]"
              required
            />
          </div>

          {/* Start section */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 black:text-gray-300 mb-2">Start Time</label>
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2 flex-1">
                <Clock className="w-4 h-4 text-gray-500 dark:text-gray-400 black:text-gray-400" />
                <input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  className="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-700 black:bg-[#2a2a2a] border border-gray-200 dark:border-gray-600 black:border-[#404040] rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 black:focus:ring-blue-400 focus:border-transparent text-gray-900 dark:text-gray-100 black:text-gray-100 transition-all duration-200 hover:border-gray-400 dark:hover:border-gray-500 black:hover:border-[#505050]"
                />
              </div>
              <input
                type="time"
                value={formData.startTime}
                onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                className="px-3 py-2 bg-gray-50 dark:bg-gray-700 black:bg-[#2a2a2a] border border-gray-200 dark:border-gray-600 black:border-[#404040] rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 black:focus:ring-blue-400 focus:border-transparent text-gray-900 dark:text-gray-100 black:text-gray-100 transition-all duration-200 hover:border-gray-400 dark:hover:border-gray-500 black:hover:border-[#505050]"
              />
            </div>
          </div>

          {/* All day checkbox */}
          <div className="flex items-center p-2 bg-gray-50 dark:bg-gray-700 black:bg-[#2a2a2a] rounded-lg">
            <input
              type="checkbox"
              id="allDay"
              checked={formData.allDay}
              onChange={(e) => setFormData({ ...formData, allDay: e.target.checked })}
              className="w-4 h-4 text-blue-600 border-gray-300 dark:border-gray-600 black:border-[#404040] rounded focus:ring-blue-500 dark:focus:ring-blue-400 black:focus:ring-blue-400 bg-white dark:bg-gray-800 black:bg-[#242424]"
            />
            <label htmlFor="allDay" className="ml-3 text-sm font-medium text-gray-700 dark:text-gray-300 black:text-gray-300">
              All day event
            </label>
          </div>

          {/* End section */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 black:text-gray-300 mb-2">End Time</label>
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2 flex-1">
                <Clock className="w-4 h-4 text-gray-500 dark:text-gray-400 black:text-gray-400" />
                <input
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  className="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-700 black:bg-[#2a2a2a] border border-gray-200 dark:border-gray-600 black:border-[#404040] rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 black:focus:ring-blue-400 focus:border-transparent text-gray-900 dark:text-gray-100 black:text-gray-100 transition-all duration-200 hover:border-gray-400 dark:hover:border-gray-500 black:hover:border-[#505050]"
                />
              </div>
              <input
                type="time"
                value={formData.endTime}
                onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                className="px-3 py-2 bg-gray-50 dark:bg-gray-700 black:bg-[#2a2a2a] border border-gray-200 dark:border-gray-600 black:border-[#404040] rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 black:focus:ring-blue-400 focus:border-transparent text-gray-900 dark:text-gray-100 black:text-gray-100 transition-all duration-200 hover:border-gray-400 dark:hover:border-gray-500 black:hover:border-[#505050]"
              />
            </div>
          </div>

          {/* Calendar section */}
          <div className="relative calendar-dropdown">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 black:text-gray-300 mb-2">Calendar</label>
            <div className="flex items-center space-x-3">
              <CalendarIcon className="w-4 h-4 text-gray-500 dark:text-gray-400 black:text-gray-400" />
              <button
                type="button"
                onClick={() => setShowCalendarDropdown(!showCalendarDropdown)}
                className="flex items-center space-x-3 px-3 py-2 bg-gray-50 dark:bg-gray-700 black:bg-[#2a2a2a] border border-gray-200 dark:border-gray-600 black:border-[#404040] rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 black:hover:bg-[#3a3a3a] transition-all duration-200 hover:border-gray-400 dark:hover:border-gray-500 black:hover:border-[#505050] w-full"
              >
                <div className="w-4 h-4 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full"></div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300 black:text-gray-300">{formData.calendar}</span>
                <ChevronDown className="w-4 h-4 text-gray-500 dark:text-gray-400 black:text-gray-400 ml-auto" />
              </button>
            </div>

            {/* Calendar Dropdown */}
            {showCalendarDropdown && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 black:bg-[#242424] border border-gray-200 dark:border-gray-700 black:border-[#3a3a3a] rounded-md shadow-lg z-10">
                <div className="p-2">
                  <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 black:text-gray-400 mb-2">HYWIZ CALENDAR</div>
                  <div className="space-y-1">
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.createInApp}
                        onChange={(e) => setFormData({ ...formData, createInApp: e.target.checked })}
                        className="w-4 h-4 text-blue-600 border-gray-300 dark:border-gray-600 black:border-[#404040] rounded bg-white dark:bg-gray-800 black:bg-[#242424]"
                      />
                      <div className="w-3 h-3 bg-gray-400 dark:bg-gray-600 black:bg-[#404040] rounded"></div>
                      <span className="text-xs text-gray-700 dark:text-gray-300 black:text-gray-300">Events</span>
                    </label>
                  </div>

                  {isGoogleCalendarConnected && (
                    <>
                      <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 black:text-gray-400 mb-2 mt-3">GOOGLE - {googleAccount?.email?.toUpperCase() || 'ACCOUNT'}</div>
                      <div className="space-y-1">
                        <label className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formData.createInGoogle}
                            onChange={(e) => setFormData({ ...formData, createInGoogle: e.target.checked })}
                            className="w-4 h-4 text-blue-600 border-gray-300 dark:border-gray-600 black:border-[#404040] rounded bg-white dark:bg-gray-800 black:bg-[#242424]"
                          />
                          <div className="w-3 h-3 bg-blue-500 rounded"></div>
                          <span className="text-xs text-gray-700 dark:text-gray-300 black:text-gray-300">{googleAccount?.email}</span>
                          {formData.createInGoogle && (
                            <div className="w-2 h-2 bg-blue-500 rounded-full ml-auto"></div>
                          )}
                        </label>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700 black:border-[#3a3a3a]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium bg-gray-100 dark:bg-gray-700 black:bg-[#2a2a2a] text-gray-700 dark:text-gray-300 black:text-gray-300 border border-gray-200 dark:border-gray-600 black:border-[#404040] rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 black:hover:bg-[#3a3a3a] transition-all duration-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-lg transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105"
            >
              Create Event
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Event Details Modal Component
const EventDetailsModal: React.FC<{
  event: CalendarEvent;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}> = ({ event, onClose, onEdit, onDelete }) => {
  const { syncEventToGoogleCalendar, isGoogleCalendarConnected } = useCalendarStore();
  const { tasks } = useTasksStore();

  const isTask = event.type === 'task' && event._id.startsWith('task-');
  const rawTaskId = isTask ? event._id.replace(/^task-/, '') : null;
  const task = isTask ? tasks.find(t => String(t.id) === rawTaskId) : null;

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'text-red-500';
      case 'medium':
        return 'text-yellow-500';
      case 'low':
        return 'text-green-500';
      default:
        return 'text-gray-400';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white dark:bg-gray-900 black:bg-[#242424] rounded-xl shadow-2xl w-full max-w-md border border-gray-200 dark:border-gray-700 black:border-[#3a3a3a]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-700 black:border-[#3a3a3a] bg-white dark:bg-gray-900 black:bg-[#242424]">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 black:text-gray-100 leading-tight">{event.title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:text-gray-400 dark:hover:text-gray-200 black:text-gray-400 black:hover:text-gray-100 p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 black:hover:bg-[#2a2a2a] transition-colors">
            ×
          </button>
        </div>

        <div className="p-3 space-y-3">
          {event.description && (
            <div className="p-3 bg-gray-50 dark:bg-gray-700 black:bg-[#2a2a2a] rounded-lg border border-gray-200 dark:border-gray-600 black:border-[#404040]">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 black:text-gray-300 mb-2">Description</h3>
              <p className="text-gray-600 dark:text-gray-300 black:text-gray-300 text-sm">{event.description}</p>
            </div>
          )}

          <div className="p-3 bg-blue-50 dark:bg-blue-900/30 black:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 black:border-blue-800">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 black:text-gray-300 mb-2 flex items-center">
              <Clock className="w-4 h-4 mr-2 text-blue-500 dark:text-blue-400 black:text-blue-400" />
              Time
            </h3>
            <p className="text-gray-600 dark:text-gray-300 black:text-gray-300 text-sm">
              {formatDateTime(event.startTime)} - {formatTime(event.endTime)}
            </p>
          </div>

          {event.location && (
            <div className="p-3 bg-green-50 dark:bg-green-900/30 black:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800 black:border-green-800">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 black:text-gray-300 mb-2 flex items-center">
                <MapPin className="w-4 h-4 mr-2 text-green-500 dark:text-green-400 black:text-green-400" />
                Location
              </h3>
              <p className="text-gray-600 dark:text-gray-300 black:text-gray-300 text-sm">{event.location}</p>
            </div>
          )}

          <div className="flex items-center space-x-4">
            <span className={`px-3 py-2 rounded-lg text-sm font-medium ${getPriorityColor(event.priority)} bg-red-50 dark:bg-red-900/30 black:bg-red-900/20 border border-red-200 dark:border-red-800 black:border-red-800`}>
              {event.priority} priority
            </span>
            <span className="px-3 py-2 rounded-lg text-sm font-medium bg-gray-100 dark:bg-gray-700 black:bg-[#2a2a2a] text-gray-700 dark:text-gray-300 black:text-gray-300 border border-gray-200 dark:border-gray-600 black:border-[#404040]">
              {event.type}
            </span>
          </div>

          {event.attendees && event.attendees.length > 0 && (
            <div className="p-3 bg-purple-50 dark:bg-purple-900/30 black:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800 black:border-purple-800">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 black:text-gray-300 mb-2 flex items-center">
                <Users className="w-4 h-4 mr-2 text-purple-500 dark:text-purple-400 black:text-purple-400" />
                Attendees ({event.attendees.length})
              </h3>
              <div className="space-y-2">
                {event.attendees.map((attendee, index) => (
                  <div key={index} className="text-gray-600 dark:text-gray-300 black:text-gray-300 text-sm p-2 bg-white dark:bg-gray-800 black:bg-[#242424] rounded-md border border-gray-200 dark:border-gray-700 black:border-[#3a3a3a]">
                    {attendee.name} ({attendee.email})
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700 black:border-[#3a3a3a]">
            {isGoogleCalendarConnected && !event.isSynced && (
              <button
                onClick={() => syncEventToGoogleCalendar(event._id)}
                className="flex items-center space-x-2 px-4 py-2 text-sm bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 rounded-lg text-white font-medium shadow-md hover:shadow-lg transition-all duration-200 transform hover:scale-105"
              >
                <ExternalLink className="w-4 h-4" />
                <span>Sync to Google</span>
              </button>
            )}

            <button
              onClick={onEdit}
              className="px-4 py-2 text-sm bg-gray-100 dark:bg-gray-700 black:bg-[#2a2a2a] hover:bg-gray-200 dark:hover:bg-gray-600 black:hover:bg-[#3a3a3a] rounded-lg text-gray-700 dark:text-gray-300 black:text-gray-300 font-medium transition-all duration-200 hover:scale-105 border border-gray-200 dark:border-gray-600 black:border-[#404040]"
            >
              Edit
            </button>

            {/* Only show delete button for local events */}
            {!event._id.startsWith('google-') && event.userId !== 'google-calendar' && (
              <button
                onClick={onDelete}
                className="px-4 py-2 text-sm bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 rounded-lg text-white font-medium shadow-md hover:shadow-lg transition-all duration-200 transform hover:scale-105"
              >
                Delete
              </button>
            )}

            {/* Show message for Google Calendar events */}
            {(event._id.startsWith('google-') || event.userId === 'google-calendar') && (
              <div className="text-sm text-gray-500 dark:text-gray-400 black:text-gray-400 mt-3 p-3 bg-yellow-50 dark:bg-yellow-900/30 black:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800 black:border-yellow-800">
                This is a Google Calendar event. Delete it from your Google Calendar directly.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Create Task Dropdown Component
const CreateTaskDropdown: React.FC<{
  selectedDate: Date;
  mode?: 'create' | 'edit';
  initialData?: {
    text: string;
    description?: string;
    dueDate?: string;
    startDate?: string | Date;
    priority: 'low' | 'medium' | 'high';
    reminder?: string;
    isRecurring?: boolean;
    recurringPattern?: 'daily' | 'weekly' | 'monthly' | 'yearly';
    completed?: boolean;
    noteId?: string;
  };
  onClose: () => void;
  onSubmit: (taskData: { text: string; description?: string; dueDate?: string; startDate?: string | Date; priority: 'low' | 'medium' | 'high' | 'critical'; reminder?: string; isRecurring?: boolean; recurringPattern?: 'daily' | 'weekly' | 'monthly' | 'yearly'; completed?: boolean; noteId?: string }) => Promise<void>;
  onDelete?: () => Promise<void>;
  taskId?: string;
}> = ({ selectedDate, mode = 'create', initialData, onClose, onSubmit, onDelete, taskId }) => {
  const [taskName, setTaskName] = useState(initialData?.text ?? '');
  const [description, setDescription] = useState(initialData?.description ?? '');
  const [completed, setCompleted] = useState(initialData?.completed ?? false);
  const [dueDate, setDueDate] = useState<Date | null>(initialData?.dueDate ? new Date(initialData.dueDate) : null);
  const [startDate, setStartDate] = useState<Date | null>(initialData?.startDate ? new Date(initialData.startDate) : null);
  const [dueDateType, setDueDateType] = useState<'today' | 'tomorrow' | 'custom' | null>(null);
  const [customDueDate, setCustomDueDate] = useState(initialData?.dueDate ? initialData.dueDate.split('T')[0] : '');
  const [customStartDate, setCustomStartDate] = useState(initialData?.startDate ? initialData.startDate.split('T')[0] : '');
  const [reminder, setReminder] = useState<string | null>(initialData?.reminder ?? null);
  const [reminderType, setReminderType] = useState<'1hour' | '4hours' | 'custom' | null>(null);
  const [customReminder, setCustomReminder] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>(initialData?.priority ?? 'medium');
  const [isFlagged, setIsFlagged] = useState(false);
  const [isRecurring, setIsRecurring] = useState(initialData?.isRecurring ?? false);
  const [recurringPattern, setRecurringPattern] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>(initialData?.recurringPattern ?? 'daily');
  const [showCustomDatePicker, setShowCustomDatePicker] = useState(false);
  const [showCustomReminderPicker, setShowCustomReminderPicker] = useState(false);
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [selectedNoteId, setSelectedNoteId] = useState<string | undefined>(initialData?.noteId);
  const [assignedEmails, setAssignedEmails] = useState<string[]>([]);
  const [sharedEmails, setSharedEmails] = useState<Array<{ email: string; permission: 'read' | 'write' }>>([]);
  const [newAssignEmail, setNewAssignEmail] = useState('');
  const [newShareEmail, setNewShareEmail] = useState('');
  const [newSharePermission, setNewSharePermission] = useState<'read' | 'write'>('read');
  const { notes } = useNotesStore();

  const handleDueDateSelect = (type: 'today' | 'tomorrow' | 'custom') => {
    setDueDateType(type);
    if (type === 'today') {
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      setDueDate(today);
      setShowCustomDatePicker(false);
    } else if (type === 'tomorrow') {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(23, 59, 59, 999);
      setDueDate(tomorrow);
      setShowCustomDatePicker(false);
    } else {
      setShowCustomDatePicker(true);
    }
  };

  const handleReminderSelect = (type: '1hour' | '4hours' | 'custom') => {
    setReminderType(type);
    if (type === '1hour') {
      const reminderDate = new Date();
      reminderDate.setHours(reminderDate.getHours() + 1);
      setReminder(reminderDate.toISOString());
      setShowCustomReminderPicker(false);
    } else if (type === '4hours') {
      const reminderDate = new Date();
      reminderDate.setHours(reminderDate.getHours() + 4);
      setReminder(reminderDate.toISOString());
      setShowCustomReminderPicker(false);
    } else {
      setShowCustomReminderPicker(true);
    }
  };

  const handleCustomDateChange = (dateString: string) => {
    setCustomDueDate(dateString);
    if (dateString) {
      const date = new Date(dateString);
      date.setHours(23, 59, 59, 999);
      setDueDate(date);
    }
  };

  const handleCustomReminderChange = (dateTimeString: string) => {
    setCustomReminder(dateTimeString);
    if (dateTimeString) {
      const reminderDate = new Date(dateTimeString);
      setReminder(reminderDate.toISOString());
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskName.trim()) return;

    try {
      await onSubmit({
        text: taskName,
        description: description.trim() || undefined,
        dueDate: dueDate ? dueDate.toISOString() : undefined,
        startDate: startDate ? startDate.toISOString() : undefined,
        priority,
        reminder: reminder || undefined,
        isRecurring,
        recurringPattern: isRecurring ? recurringPattern : undefined,
        completed: mode === 'edit' ? completed : false,
        noteId: selectedNoteId,
      });
    } catch (error) {
      console.error('Failed to create/update task:', error);
    }
  };

  const formatDateForInput = (date: Date) => {
    return date.toISOString().split('T')[0];
  };

  const formatDateTimeForInput = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    const timeStr = date.toTimeString().split(' ')[0].slice(0, 5);
    return `${dateStr}T${timeStr}`;
  };

  return (
    <div
      className="w-full bg-white dark:bg-gray-800 black:bg-[#242424] rounded-lg shadow-none border-0"
    >
      <div className="p-2 space-y-2">
        {/* Header */}
        <div className="flex items-center space-x-1.5 mb-1">
          <ChevronDown className="w-3.5 h-3.5 text-gray-600 dark:text-gray-300 black:text-gray-300" />
          <h3 className="text-xs font-semibold text-gray-800 dark:text-gray-200 black:text-gray-200">Things to do</h3>
        </div>

        {/* Task Name with Status Toggle */}
        <div className="flex items-center space-x-1.5">
          <button
            type="button"
            onClick={() => setCompleted(!completed)}
            className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all ${completed
              ? 'bg-blue-600 border-blue-600 dark:bg-blue-500 black:bg-blue-500'
              : 'border-gray-300 dark:border-gray-600 black:border-[#404040] hover:border-blue-500 dark:hover:border-blue-400 black:hover:border-blue-400'
              }`}
          >
            {completed && <Check className="w-2.5 h-2.5 text-white" />}
          </button>
          <input
            type="text"
            placeholder="Enter task"
            value={taskName}
            onChange={(e) => setTaskName(e.target.value)}
            className={`flex-1 bg-transparent border-none outline-none text-xs placeholder-gray-500 dark:placeholder-gray-400 black:placeholder-gray-400 ${completed
              ? 'text-gray-500 dark:text-gray-500 black:text-gray-500 line-through'
              : 'text-gray-800 dark:text-gray-200 black:text-gray-200'
              }`}
            autoFocus
          />
        </div>

        {/* Description */}
        <div className="space-y-1">
          <div className="flex items-center space-x-1.5">
            <Pencil className="w-3.5 h-3.5 text-gray-600 dark:text-gray-300 black:text-gray-300" />
            <label className="text-xs font-medium text-gray-700 dark:text-gray-300 black:text-gray-300">Description</label>
          </div>
          <textarea
            placeholder="What is this task about?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-2 py-1 bg-gray-50 dark:bg-gray-700 black:bg-[#2a2a2a] border border-gray-200 dark:border-gray-600 black:border-[#404040] rounded-lg text-xs text-gray-800 dark:text-gray-200 black:text-gray-200 placeholder-gray-500 dark:placeholder-gray-400 black:placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 black:focus:ring-blue-400"
            rows={2}
          />
        </div>

        {/* Start Date */}
        <div className="space-y-1">
          <div className="flex items-center space-x-1.5">
            <Clock className="w-3.5 h-3.5 text-gray-600 dark:text-gray-300 black:text-gray-300" />
            <label className="text-xs font-medium text-gray-700 dark:text-gray-300 black:text-gray-300">Start date</label>
          </div>
          <div className="flex items-center space-x-1.5">
            <button
              type="button"
              onClick={() => setShowStartDatePicker(!showStartDatePicker)}
              className={`px-2 py-1 rounded text-xs font-medium transition-all flex items-center space-x-1 ${startDate
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 black:bg-[#2a2a2a] text-gray-700 dark:text-gray-300 black:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 black:hover:bg-[#3a3a3a]'
                }`}
            >
              <Pencil className="w-2.5 h-2.5" />
              <span>{startDate ? formatDateForInput(startDate) : 'Set start date'}</span>
            </button>
            {startDate && (
              <button
                type="button"
                onClick={() => {
                  setStartDate(null);
                  setCustomStartDate('');
                }}
                className="text-xs text-red-500 hover:text-red-600 dark:hover:text-red-400 black:hover:text-red-400"
              >
                Clear
              </button>
            )}
          </div>
          {showStartDatePicker && (
            <input
              type="date"
              value={customStartDate || formatDateForInput(selectedDate)}
              onChange={(e) => {
                setCustomStartDate(e.target.value);
                if (e.target.value) {
                  const date = new Date(e.target.value);
                  setStartDate(date);
                }
              }}
              className="mt-1 px-2 py-1 bg-gray-50 dark:bg-gray-700 black:bg-[#2a2a2a] border border-gray-200 dark:border-gray-600 black:border-[#404040] rounded-lg text-xs text-gray-800 dark:text-gray-200 black:text-gray-200"
            />
          )}
        </div>

        {/* Due Date */}
        <div className="space-y-1">
          <div className="flex items-center space-x-1.5">
            <CalendarIcon className="w-3.5 h-3.5 text-gray-600 dark:text-gray-300 black:text-gray-300" />
            <label className="text-xs font-medium text-gray-700 dark:text-gray-300 black:text-gray-300">Due date</label>
          </div>
          <div className="flex items-center space-x-1.5 flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => handleDueDateSelect('today')}
              className={`px-2 py-1 rounded text-xs font-medium transition-all ${dueDateType === 'today'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 black:bg-[#2a2a2a] text-gray-700 dark:text-gray-300 black:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 black:hover:bg-[#3a3a3a]'
                }`}
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => handleDueDateSelect('tomorrow')}
              className={`px-2 py-1 rounded text-xs font-medium transition-all ${dueDateType === 'tomorrow'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 black:bg-[#2a2a2a] text-gray-700 dark:text-gray-300 black:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 black:hover:bg-[#3a3a3a]'
                }`}
            >
              Tomorrow
            </button>
            <button
              type="button"
              onClick={() => handleDueDateSelect('custom')}
              className={`px-2 py-1 rounded text-xs font-medium transition-all flex items-center space-x-1 ${dueDateType === 'custom'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 black:bg-[#2a2a2a] text-gray-700 dark:text-gray-300 black:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 black:hover:bg-[#3a3a3a]'
                }`}
            >
              <Pencil className="w-2.5 h-2.5" />
              <span>Custom</span>
            </button>
            <button
              type="button"
              onClick={() => setIsRecurring(!isRecurring)}
              className={`px-2 py-1 rounded text-xs font-medium transition-all flex items-center space-x-1 ${isRecurring
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 black:bg-[#2a2a2a] text-gray-700 dark:text-gray-300 black:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 black:hover:bg-[#3a3a3a]'
                }`}
            >
              <RotateCcw className="w-2.5 h-2.5" />
              <span>Repeat</span>
            </button>
          </div>
          {showCustomDatePicker && (
            <input
              type="date"
              value={customDueDate || formatDateForInput(selectedDate)}
              onChange={(e) => handleCustomDateChange(e.target.value)}
              className="mt-1 px-2 py-1 bg-gray-50 dark:bg-gray-700 black:bg-[#2a2a2a] border border-gray-200 dark:border-gray-600 black:border-[#404040] rounded-lg text-xs text-gray-800 dark:text-gray-200 black:text-gray-200"
            />
          )}
          {isRecurring && (
            <select
              value={recurringPattern}
              onChange={(e) => setRecurringPattern(e.target.value as 'daily' | 'weekly' | 'monthly' | 'yearly')}
              className="mt-1 px-2 py-1 bg-gray-50 dark:bg-gray-700 black:bg-[#2a2a2a] border border-gray-200 dark:border-gray-600 black:border-[#404040] rounded-lg text-xs text-gray-800 dark:text-gray-200 black:text-gray-200"
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
          )}
        </div>

        {/* Reminder */}
        <div className="space-y-1">
          <div className="flex items-center space-x-1.5">
            <Bell className="w-3.5 h-3.5 text-gray-600 dark:text-gray-300 black:text-gray-300" />
            <label className="text-xs font-medium text-gray-700 dark:text-gray-300 black:text-gray-300">Reminder</label>
          </div>
          <div className="flex items-center space-x-1.5 flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => handleReminderSelect('1hour')}
              className={`px-2 py-1 rounded text-xs font-medium transition-all ${reminderType === '1hour'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 black:bg-[#2a2a2a] text-gray-700 dark:text-gray-300 black:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 black:hover:bg-[#3a3a3a]'
                }`}
            >
              In 1 hour
            </button>
            <button
              type="button"
              onClick={() => handleReminderSelect('4hours')}
              className={`px-2 py-1 rounded text-xs font-medium transition-all ${reminderType === '4hours'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 black:bg-[#2a2a2a] text-gray-700 dark:text-gray-300 black:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 black:hover:bg-[#3a3a3a]'
                }`}
            >
              In 4 hours
            </button>
            <button
              type="button"
              onClick={() => handleReminderSelect('custom')}
              className={`px-2 py-1 rounded text-xs font-medium transition-all flex items-center space-x-1 ${reminderType === 'custom'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 black:bg-[#2a2a2a] text-gray-700 dark:text-gray-300 black:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 black:hover:bg-[#3a3a3a]'
                }`}
            >
              <Pencil className="w-2.5 h-2.5" />
              <span>Custom</span>
            </button>
          </div>
          {showCustomReminderPicker && (
            <input
              type="datetime-local"
              value={customReminder || formatDateTimeForInput(new Date())}
              onChange={(e) => handleCustomReminderChange(e.target.value)}
              className="mt-1 px-2 py-1 bg-gray-50 dark:bg-gray-700 black:bg-[#2a2a2a] border border-gray-200 dark:border-gray-600 black:border-[#404040] rounded-lg text-xs text-gray-800 dark:text-gray-200 black:text-gray-200"
            />
          )}
        </div>

        {/* Link to Note */}
        <div className="space-y-1">
          <div className="flex items-center space-x-1.5">
            <Users className="w-3.5 h-3.5 text-gray-600 dark:text-gray-300 black:text-gray-300" />
            <label className="text-xs font-medium text-gray-700 dark:text-gray-300 black:text-gray-300">Link to Note (Optional)</label>
          </div>
          <select
            value={selectedNoteId || ''}
            onChange={(e) => setSelectedNoteId(e.target.value || undefined)}
            className="w-full px-2 py-1 bg-gray-50 dark:bg-gray-700 black:bg-[#2a2a2a] border border-gray-200 dark:border-gray-600 black:border-[#404040] rounded-lg text-xs text-gray-800 dark:text-gray-200 black:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 black:focus:ring-blue-400"
          >
            <option value="">No note linked (standalone task)</option>
            {notes.slice(0, 50).map((note: any) => (
              <option key={note._id || note.id} value={note._id || note.id}>
                {note.title || 'Untitled Note'}
              </option>
            ))}
          </select>
          {notes.length > 50 && (
            <p className="text-xs text-gray-500 dark:text-gray-400 black:text-gray-400">
              Showing first 50 notes. {notes.length - 50} more available.
            </p>
          )}
        </div>

        {/* Assign Task */}
        <div className="space-y-1">
          <div className="flex items-center space-x-1.5">
            <Users className="w-3.5 h-3.5 text-gray-600 dark:text-gray-300 black:text-gray-300" />
            <label className="text-xs font-medium text-gray-700 dark:text-gray-300 black:text-gray-300">Assign To (Optional)</label>
          </div>
          <div className="flex items-center space-x-1">
            <input
              type="email"
              placeholder="Enter email address"
              value={newAssignEmail}
              onChange={(e) => setNewAssignEmail(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && newAssignEmail.trim()) {
                  e.preventDefault();
                  if (!assignedEmails.includes(newAssignEmail.trim())) {
                    setAssignedEmails([...assignedEmails, newAssignEmail.trim()]);
                    setNewAssignEmail('');
                  }
                }
              }}
              className="flex-1 px-2 py-1 bg-gray-50 dark:bg-gray-700 black:bg-[#2a2a2a] border border-gray-200 dark:border-gray-600 black:border-[#404040] rounded-lg text-xs text-gray-800 dark:text-gray-200 black:text-gray-200"
            />
            <button
              type="button"
              onClick={() => {
                if (newAssignEmail.trim() && !assignedEmails.includes(newAssignEmail.trim())) {
                  setAssignedEmails([...assignedEmails, newAssignEmail.trim()]);
                  setNewAssignEmail('');
                }
              }}
              className="px-2 py-1 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700"
            >
              Add
            </button>
          </div>
          {assignedEmails.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {assignedEmails.map((email, idx) => (
                <span key={idx} className="inline-flex items-center px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 black:bg-blue-900/20 text-blue-800 dark:text-blue-200 black:text-blue-200 rounded text-xs">
                  {email}
                  <button
                    type="button"
                    onClick={() => setAssignedEmails(assignedEmails.filter((_, i) => i !== idx))}
                    className="ml-1 text-blue-600 dark:text-blue-400 black:text-blue-400 hover:text-blue-800"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Priority */}
        <div className="space-y-1">
          <div className="flex items-center space-x-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-gray-600 dark:text-gray-300 black:text-gray-300" />
            <label className="text-xs font-medium text-gray-700 dark:text-gray-300 black:text-gray-300">Priority</label>
          </div>
          <div className="flex items-center space-x-1.5">
            <button
              type="button"
              onClick={() => setPriority('low')}
              className={`px-2 py-1 rounded text-xs font-medium transition-all ${priority === 'low'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 black:bg-[#2a2a2a] text-gray-700 dark:text-gray-300 black:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 black:hover:bg-[#3a3a3a]'
                }`}
            >
              Low
            </button>
            <button
              type="button"
              onClick={() => setPriority('medium')}
              className={`px-2 py-1 rounded text-xs font-medium transition-all ${priority === 'medium'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 black:bg-[#2a2a2a] text-gray-700 dark:text-gray-300 black:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 black:hover:bg-[#3a3a3a]'
                }`}
            >
              Medium
            </button>
            <button
              type="button"
              onClick={() => setPriority('high')}
              className={`px-2 py-1 rounded text-xs font-medium transition-all ${priority === 'high'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 black:bg-[#2a2a2a] text-gray-700 dark:text-gray-300 black:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 black:hover:bg-[#3a3a3a]'
                }`}
            >
              High
            </button>
          </div>
        </div>

        {/* Flag */}
        <div className="space-y-1">
          <div className="flex items-center space-x-1.5">
            <Flag className="w-3.5 h-3.5 text-gray-600 dark:text-gray-300 black:text-gray-300" />
            <label className="text-xs font-medium text-gray-700 dark:text-gray-300 black:text-gray-300">Flag</label>
          </div>
          <div className="flex items-center">
            <button
              type="button"
              onClick={() => setIsFlagged(!isFlagged)}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${isFlagged
                ? 'bg-blue-600'
                : 'bg-gray-300 dark:bg-gray-600 black:bg-[#404040]'
                }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${isFlagged ? 'translate-x-5' : 'translate-x-0.5'
                  }`}
              />
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end space-x-2 pt-2 border-t border-gray-200 dark:border-gray-700 black:border-[#3a3a3a]">
          {mode === 'edit' && onDelete && (
            <button
              type="button"
              onClick={async () => {
                if (onDelete) {
                  await onDelete();
                  onClose();
                }
              }}
              className="px-3 py-1.5 rounded text-xs font-medium bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white transition-all shadow-md hover:shadow-lg"
            >
              Delete
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700 black:bg-[#2a2a2a] text-gray-700 dark:text-gray-300 black:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 black:hover:bg-[#3a3a3a] transition-all"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!taskName.trim()}
            className="px-3 py-1.5 rounded text-xs font-medium bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {mode === 'edit' ? 'Update task' : 'Create task'}
          </button>
        </div>
      </div>
    </div>
  );
};

interface CalendarSettingsModalProps {
  onClose: () => void;
}

const CalendarSettingsModal: React.FC<CalendarSettingsModalProps> = ({ onClose }) => {
  const {
    preFormatNotes,
    setPreFormatNotes,
    remindTakeNotes,
    setRemindTakeNotes,
    remindOpenNotes,
    setRemindOpenNotes,
    isGoogleCalendarConnected,
    disconnectGoogleCalendar,
    googleAccount
  } = useCalendarStore();

  const [localPreFormat, setLocalPreFormat] = useState(preFormatNotes);
  const [localTakeNotes, setLocalTakeNotes] = useState(remindTakeNotes);
  const [localOpenNotes, setLocalOpenNotes] = useState(remindOpenNotes);

  const handleDone = () => {
    setPreFormatNotes(localPreFormat);
    setRemindTakeNotes(localTakeNotes);
    setRemindOpenNotes(localOpenNotes);
    onClose();
  };

  const Toggle = ({ enabled, onChange }: { enabled: boolean; onChange: (val: boolean) => void }) => (
    <button
      onClick={() => onChange(!enabled)}
      type="button"
      className={`relative inline-flex h-[18px] w-8 items-center rounded-full transition-all duration-300 focus:outline-none ${enabled ? 'bg-blue-600 shadow-[0_0_10px_rgba(37,99,235,0.4)]' : 'bg-gray-300 dark:bg-gray-600 black:bg-[#404040]'
        }`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.3)] transition-transform duration-300 ${enabled ? 'translate-x-[14px]' : 'translate-x-0.5'
          }`}
      />
    </button>
  );

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white dark:bg-gray-900 black:bg-[#181818] w-full rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.4)] border border-gray-100 dark:border-gray-800 black:border-[#2a2a2a] overflow-hidden flex flex-col transition-all duration-300 transform scale-100" style={{ maxWidth: '420px' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-gray-100 dark:border-gray-800 black:border-[#2a2a2a]">
          <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 black:text-gray-100 tracking-tight">Calendar settings</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 black:hover:bg-[#2a2a2a] rounded-lg transition-all duration-200 group"
          >
            <Plus className="w-4.5 h-4.5 rotate-45 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-200 transition-colors" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-5 overflow-y-auto max-h-[70vh] scrollbar-hide">
          {/* Pre-format notes */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 group">
                <LayoutList className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                <span className="text-[12px] font-bold text-gray-700 dark:text-gray-400 black:text-gray-400 uppercase tracking-widest">Things to do</span>
              </div>
            </div>
            <div className="flex items-center justify-between pl-5.5">
              <div className="flex items-center gap-2">
                <span className="text-[12px] font-medium text-gray-600 dark:text-gray-300 black:text-gray-300">Pre-format notes I create from events</span>
                <div className="w-3 h-3 rounded-full border border-gray-300 dark:border-gray-600 flex items-center justify-center text-[8px] text-gray-400 font-bold cursor-help hover:border-gray-400">i</div>
              </div>
              <Toggle enabled={localPreFormat} onChange={setLocalPreFormat} />
            </div>
          </div>

          <div className="h-px bg-gray-100 dark:bg-gray-800 black:bg-[#2a2a2a] opacity-30" />

          {/* Remind me section */}
          <div className="space-y-4">
            {/* Take notes reminder */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                <span className="text-[11px] font-bold text-gray-700 dark:text-gray-400 black:text-gray-400 uppercase tracking-widest">Remind me to take notes</span>
              </div>
              <div className="pl-5.5 space-y-4">
                <div className="relative group">
                  <select
                    value={localTakeNotes.time}
                    onChange={(e) => setLocalTakeNotes({ ...localTakeNotes, time: e.target.value })}
                    className="w-full bg-gray-50 dark:bg-gray-800/40 black:bg-[#222] border border-gray-200 dark:border-gray-700 black:border-[#333] rounded-xl px-3.5 py-1 text-[13px] appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all font-medium text-gray-700 dark:text-gray-200 group-hover:border-gray-300 dark:group-hover:border-gray-600 cursor-pointer bg-none shadow-none"
                    style={{ WebkitAppearance: 'none', MozAppearance: 'none' }}
                  >
                    <option className="dark:bg-gray-900 black:bg-[#181818]">5 min before start</option>
                    <option className="dark:bg-gray-900 black:bg-[#181818]">10 min before start</option>
                    <option className="dark:bg-gray-900 black:bg-[#181818]">15 min before start</option>
                    <option className="dark:bg-gray-900 black:bg-[#181818]">At start time</option>
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none group-hover:text-gray-500" />
                </div>
                <div className="flex items-center gap-6 pl-1">
                  <label className="flex items-center gap-2.5 cursor-pointer group">
                    <Toggle enabled={localTakeNotes.desktop} onChange={(val) => setLocalTakeNotes({ ...localTakeNotes, desktop: val })} />
                    <span className="text-[12px] font-medium text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-200">Desktop</span>
                  </label>
                  <label className="flex items-center gap-2.5 cursor-pointer group">
                    <Toggle enabled={localTakeNotes.mobile} onChange={(val) => setLocalTakeNotes({ ...localTakeNotes, mobile: val })} />
                    <span className="text-[12px] font-medium text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-200">Mobile</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Open notes reminder */}
            <div className="space-y-2.5">
              <div className="flex items-center gap-2">
                <Pencil className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                <span className="text-[11px] font-bold text-gray-700 dark:text-gray-400 black:text-gray-400 uppercase tracking-widest">Remind me to open notes</span>
              </div>
              <div className="pl-5.5 space-y-2.5">
                <div className="relative group">
                  <select
                    value={localOpenNotes.time}
                    onChange={(e) => setLocalOpenNotes({ ...localOpenNotes, time: e.target.value })}
                    className="w-full bg-gray-50 dark:bg-gray-800/40 black:bg-[#222] border border-gray-200 dark:border-gray-700 black:border-[#333] rounded-xl px-3.5 py-1 text-[13px] appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all font-medium text-gray-700 dark:text-gray-200 group-hover:border-gray-300 dark:group-hover:border-gray-600 cursor-pointer bg-none shadow-none"
                    style={{ WebkitAppearance: 'none', MozAppearance: 'none' }}
                  >
                    <option className="dark:bg-gray-900 black:bg-[#181818]">5 min before start</option>
                    <option className="dark:bg-gray-900 black:bg-[#181818]">10 min before start</option>
                    <option className="dark:bg-gray-900 black:bg-[#181818]">15 min before start</option>
                    <option className="dark:bg-gray-900 black:bg-[#181818]">At start time</option>
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none group-hover:text-gray-500" />
                </div>
                <div className="flex items-center gap-6 pl-1">
                  <label className="flex items-center gap-2.5 cursor-pointer group">
                    <Toggle enabled={localOpenNotes.desktop} onChange={(val) => setLocalOpenNotes({ ...localOpenNotes, desktop: val })} />
                    <span className="text-[12px] font-medium text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-200">Desktop</span>
                  </label>
                  <label className="flex items-center gap-2.5 cursor-pointer group">
                    <Toggle enabled={localOpenNotes.mobile} onChange={(val) => setLocalOpenNotes({ ...localOpenNotes, mobile: val })} />
                    <span className="text-[12px] font-medium text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-200">Mobile</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div className="h-px bg-gray-100 dark:bg-gray-800 black:bg-[#2a2a2a] opacity-30" />

          {/* Connected calendars */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              <span className="text-[11px] font-bold text-gray-700 dark:text-gray-400 black:text-gray-400 uppercase tracking-widest">Connected calendars</span>
            </div>
            {isGoogleCalendarConnected ? (
              <div className="flex items-center justify-between pl-5.5 p-3 bg-gray-50/30 dark:bg-blue-900/10 black:bg-[#222] rounded-xl border border-gray-100 dark:border-blue-900/20 black:border-[#333] hover:border-blue-500/20 transition-all duration-300">
                <div>
                  <div className="text-[13px] font-bold text-gray-800 dark:text-gray-100 black:text-gray-100">{googleAccount?.email || 'Google Account'}</div>
                  <div className="text-[11px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">Google Account</div>
                </div>
                <button
                  onClick={() => disconnectGoogleCalendar()}
                  className="px-4 py-1.5 bg-[#EE5D50]/5 hover:bg-[#EE5D50] text-[#EE5D50] hover:text-white rounded-lg font-bold text-[12px] transition-all duration-200 border border-[#EE5D50]/20 hover:border-[#EE5D50] active:scale-95"
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <div className="pl-5.5 text-[13px] text-gray-500 italic">No external calendars connected.</div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 pt-1 flex justify-end gap-3 mt-auto">
          <button
            onClick={onClose}
            className="px-6 py-2 rounded-xl border border-gray-200 dark:border-gray-700 black:border-[#333] text-[13px] font-bold text-gray-600 dark:text-gray-300 black:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 black:hover:bg-[#242424] transition-all duration-200"
          >
            Cancel
          </button>
          <button
            onClick={handleDone}
            className="px-8 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white text-[13px] font-bold transition-all duration-300 shadow-lg shadow-purple-500/20 active:scale-95 hover:shadow-purple-500/30"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default Calendar; 
