import { create } from 'zustand';
import api from '../lib/api';
import { googleCalendarService, getGoogleCalendarConfig } from '../lib/googleCalendar';

export interface CalendarEvent {
  _id: string;
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  allDay: boolean;
  location?: string;
  type: 'event' | 'task';
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'in-progress' | 'completed' | 'cancelled';
  color: string;
  userId: string;
  noteId?: {
    _id: string;
    title: string;
  };

  recurring?: {
    frequency: 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';
    interval: number;
    endDate?: string;
    daysOfWeek?: number[];
  };
  attendees?: Array<{
    email: string;
    name: string;
    responseStatus: 'needsAction' | 'declined' | 'tentative' | 'accepted';
  }>;
  googleCalendarEventId?: string;
  isSynced: boolean;
  createdAt: string;
  updatedAt: string;
}

interface CalendarState {
  events: CalendarEvent[];
  loading: boolean;
  error: string | null;
  selectedDate: Date;
  viewMode: 'day' | 'week' | 'month';
  selectedEvent: CalendarEvent | null;
  showEventModal: boolean;
  showCreateModal: boolean;
  isGoogleCalendarConnected: boolean;
  googleAccount: { email: string; name: string; picture: string } | null;
  googleCalendarEvents: any[];

  // Actions
  fetchEvents: (startDate?: string, endDate?: string, type?: string) => Promise<void>;
  fetchDayEvents: (date: string) => Promise<void>;
  fetchWeekEvents: (startDate: string) => Promise<void>;
  fetchMonthEvents: (year: number, month: number) => Promise<void>;
  createEvent: (eventData: Partial<CalendarEvent>) => Promise<CalendarEvent>;
  updateEvent: (id: string, eventData: Partial<CalendarEvent>) => Promise<CalendarEvent>;
  deleteEvent: (id: string) => Promise<void>;
  setSelectedDate: (date: Date | ((prev: Date) => Date)) => void;
  setViewMode: (mode: 'day' | 'week' | 'month') => void;
  setSelectedEvent: (event: CalendarEvent | null) => void;
  setShowEventModal: (show: boolean) => void;
  setShowCreateModal: (show: boolean) => void;
  connectGoogleCalendar: () => Promise<void>;
  disconnectGoogleCalendar: () => void;
  syncEventToGoogleCalendar: (eventId: string) => Promise<void>;
  syncEventToGoogleCalendarWithData: (event: CalendarEvent) => Promise<void>;
  fetchGoogleCalendarEvents: () => Promise<void>;
  getEventStats: (startDate?: string, endDate?: string) => Promise<any>;
  initializeGoogleCalendarStatus: () => Promise<void>;
  reconnectGoogleCalendar: () => Promise<void>;
  showWeekends: boolean;
  startWeekOn: 'Sunday' | 'Monday';
  setShowWeekends: (show: boolean) => void;
  setStartWeekOn: (day: 'Sunday' | 'Monday') => void;

  // New Detailed Settings
  preFormatNotes: boolean;
  remindTakeNotes: { time: string; desktop: boolean; mobile: boolean };
  remindOpenNotes: { time: string; desktop: boolean; mobile: boolean };
  setPreFormatNotes: (val: boolean) => void;
  setRemindTakeNotes: (val: { time: string; desktop: boolean; mobile: boolean }) => void;
  setRemindOpenNotes: (val: { time: string; desktop: boolean; mobile: boolean }) => void;
}

export const useCalendarStore = create<CalendarState>((set, get) => {
  // Add debouncing mechanism
  let fetchTimeout: NodeJS.Timeout | null = null;

  return {
    events: [],
    loading: false,
    error: null,
    selectedDate: new Date(),
    viewMode: 'day',
    selectedEvent: null,
    showEventModal: false,
    showCreateModal: false,
    isGoogleCalendarConnected: false,
    googleAccount: null,
    googleCalendarEvents: [],
    showWeekends: true,
    startWeekOn: 'Monday',
    preFormatNotes: true,
    remindTakeNotes: { time: '5 min before start', desktop: true, mobile: true },
    remindOpenNotes: { time: '5 min before start', desktop: true, mobile: true },



    fetchEvents: async (startDate, endDate, type) => {
      try {
        set({ loading: true, error: null });
        const params = new URLSearchParams();
        if (startDate) params.append('startDate', startDate);
        if (endDate) params.append('endDate', endDate);
        if (type) params.append('type', type);

        const response = await api.get(`/calendar?${params.toString()}`);
        set({ events: response.data, loading: false });
      } catch (error: any) {
        set({
          error: error.response?.data?.message || 'Failed to fetch events',
          loading: false
        });
      }
    },

    fetchDayEvents: async (date) => {
      try {
        set({ loading: true, error: null });
        const response = await api.get(`/calendar/day/${date}`);

        // Only update local events, preserve Google Calendar events
        set({
          events: response.data,
          loading: false
        });

        // Also refresh Google Calendar events if connected
        if (get().isGoogleCalendarConnected) {
          get().fetchGoogleCalendarEvents();
        }
      } catch (error: any) {
        set({
          error: error.response?.data?.message || 'Failed to fetch day events',
          loading: false
        });
      }
    },

    fetchWeekEvents: async (startDate) => {
      try {
        set({ loading: true, error: null });
        const response = await api.get(`/calendar/week/${startDate}`);
        set({ events: response.data, loading: false });
      } catch (error: any) {
        set({
          error: error.response?.data?.message || 'Failed to fetch week events',
          loading: false
        });
      }
    },

    fetchMonthEvents: async (year, month) => {
      try {
        set({ loading: true, error: null });
        const response = await api.get(`/calendar/month/${year}/${month}`);
        set({ events: response.data, loading: false });
      } catch (error: any) {
        set({
          error: error.response?.data?.message || 'Failed to fetch month events',
          loading: false
        });
      }
    },

    createEvent: async (eventData: any) => {
      try {
        set({ loading: true, error: null });

        let newEvent: CalendarEvent | null = null;

        // If Google Calendar is connected and user wants to create there
        if ((eventData as any).createInGoogle && get().isGoogleCalendarConnected) {
          try {
            // Check if Google Calendar is still properly initialized
            if (!googleCalendarService.isSignedIn()) {
              console.warn('Google Calendar not properly signed in, falling back to local creation');
              set({ isGoogleCalendarConnected: false });
              // Fall through to local creation
            } else {
              // Create event in Google Calendar only
              const googleEvent = {
                summary: eventData.title,
                start: {
                  dateTime: new Date(eventData.startTime).toISOString(),
                  timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
                },
                end: {
                  dateTime: new Date(eventData.endTime).toISOString(),
                  timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
                },
                ...(eventData.attendees && eventData.attendees.length > 0 ? {
                  attendees: eventData.attendees.map((a: any) => ({ email: a.email }))
                } : {})
              };

              const response = await googleCalendarService.createEvent(googleEvent);

              // Add a small delay to allow Google Calendar to update
              await new Promise(resolve => setTimeout(resolve, 1000));

              // Refresh Google Calendar events to show the new event
              console.log('Refreshing Google Calendar events after successful creation');
              await get().fetchGoogleCalendarEvents();

              // Don't create a local event - let it come from Google Calendar sync
              set({ loading: false, showCreateModal: false });

              // Return a placeholder event for Google Calendar events
              const placeholderEvent: CalendarEvent = {
                _id: `google-${response.id}`,
                title: eventData.title,
                description: eventData.description || '',
                startTime: eventData.startTime,
                endTime: eventData.endTime,
                allDay: eventData.allDay || false,
                location: eventData.location || '',
                type: 'event',
                priority: 'medium',
                status: 'pending',
                color: '#4285f4',
                userId: 'google-calendar',
                googleCalendarEventId: response.id,
                isSynced: true,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                attendees: eventData.attendees || []
              };

              return placeholderEvent;
            }
          } catch (googleError: any) {
            console.error('Failed to create event in Google Calendar:', googleError);

            // If it's an authentication error, update the connection status
            if (googleError.message?.includes('Authentication failed') ||
              googleError.message?.includes('not initialized') ||
              googleError.message?.includes('re-authenticate')) {
              console.warn('Google Calendar authentication failed, updating connection status');
              set({
                isGoogleCalendarConnected: false,
                error: 'Google Calendar authentication expired. Please reconnect.'
              });
            }

            // If Google Calendar fails, fall back to local creation
          }
        }

        // Create event locally (either as fallback or if Google Calendar not selected)
        const response = await api.post('/calendar', eventData);
        newEvent = response.data;

        if (newEvent) {
          set(state => ({
            events: [...state.events, newEvent!],
            loading: false,
            showCreateModal: false
          }));
        } else {
          set({ loading: false, showCreateModal: false });
        }

        return newEvent!;
      } catch (error: any) {
        set({
          error: error.response?.data?.message || 'Failed to create event',
          loading: false
        });
        throw error;
      }
    },

    updateEvent: async (id, eventData) => {
      try {
        set({ loading: true, error: null });
        const response = await api.put(`/calendar/${id}`, eventData);
        const updatedEvent = response.data;

        set(state => ({
          events: state.events.map(event =>
            event._id === id ? updatedEvent : event
          ),
          loading: false,
          selectedEvent: null,
          showEventModal: false
        }));

        return updatedEvent;
      } catch (error: any) {
        set({
          error: error.response?.data?.message || 'Failed to update event',
          loading: false
        });
        throw error;
      }
    },

    deleteEvent: async (id) => {
      try {
        set({ loading: true, error: null });

        // Check if this is a Google Calendar event ID
        if (id.startsWith('google-') || id.includes('@')) {
          throw new Error('Cannot delete Google Calendar events from local interface. Please delete them from Google Calendar directly.');
        }

        // Find the event to check if it has a Google Calendar ID
        const event = get().events.find(e => e._id === id);

        if (!event) {
          throw new Error('Event not found');
        }

        // Delete from local calendar
        await api.delete(`/calendar/${id}`);

        // Delete from Google Calendar if it exists there
        if (event?.googleCalendarEventId && get().isGoogleCalendarConnected) {
          try {
            await googleCalendarService.deleteEvent(event.googleCalendarEventId);
          } catch (googleError: any) {
            console.error('Failed to delete event from Google Calendar:', googleError);
            // Continue with local deletion even if Google fails
          }
        }

        set(state => ({
          events: state.events.filter(event => event._id !== id),
          loading: false,
          selectedEvent: null,
          showEventModal: false
        }));

        // Refresh Google Calendar events
        if (get().isGoogleCalendarConnected) {
          console.log('Refreshing Google Calendar events after event deletion');
          get().fetchGoogleCalendarEvents();
        }
      } catch (error: any) {
        set({
          error: error.response?.data?.message || error.message || 'Failed to delete event',
          loading: false
        });
        throw error;
      }
    },

    setSelectedDate: (date) => {
      // Handle both Date objects and functions
      let dateObj: Date;

      if (typeof date === 'function') {
        // If it's a function, call it with the current selectedDate
        const currentDate = get().selectedDate;
        const result = date(currentDate);
        dateObj = result instanceof Date ? result : new Date(result);
      } else if (date instanceof Date) {
        dateObj = date;
      } else {
        dateObj = new Date(date);
      }

      // Check if the date is valid
      if (isNaN(dateObj.getTime())) {
        console.warn('Invalid date provided to setSelectedDate, using current date:', date);
        dateObj = new Date();
      }

      set({ selectedDate: dateObj });
    },

    setViewMode: (mode) => {
      set({ viewMode: mode });
    },

    setSelectedEvent: (event) => {
      set({ selectedEvent: event });
    },

    setShowEventModal: (show) => {
      set({ showEventModal: show });
    },

    setShowCreateModal: (show) => {
      set({ showCreateModal: show });
    },

    connectGoogleCalendar: async () => {
      try {
        // Check if Google Calendar is configured first
        if (!googleCalendarService.isConfigured()) {
          throw new Error('Google Calendar credentials not configured. Please set VITE_GOOGLE_CLIENT_ID in your .env file. See GOOGLE_CALENDAR_SETUP.md for setup instructions.');
        }

        const config = getGoogleCalendarConfig();
        await googleCalendarService.initialize(config);
        await googleCalendarService.signIn();

        const userInfo = await googleCalendarService.getUserInfo();

        set({ isGoogleCalendarConnected: true, googleAccount: userInfo, error: null });
        get().fetchGoogleCalendarEvents();
      } catch (error: any) {
        console.error('Failed to connect to Google Calendar:', error);
        set({
          error: error.message || 'Failed to connect to Google Calendar',
          isGoogleCalendarConnected: false
        });
        throw error;
      }
    },

    reconnectGoogleCalendar: async () => {
      try {
        console.log('Attempting to reconnect to Google Calendar...');

        // Clear any existing error state
        set({ error: null });

        // Clear any existing tokens but keep the connection intent flag
        localStorage.removeItem('google_access_token');
        localStorage.removeItem('google_token_expiry');

        await googleCalendarService.signOut();

        // Try to connect again which will trigger the login flow
        await get().connectGoogleCalendar();

        console.log('Successfully reconnected to Google Calendar');
      } catch (error: any) {
        console.error('Failed to reconnect to Google Calendar:', error);
        set({
          error: 'Failed to reconnect to Google Calendar. Please try connecting again.',
          isGoogleCalendarConnected: false
        });
        throw error;
      }
    },

    disconnectGoogleCalendar: async () => {
      try {
        await googleCalendarService.signOut();
      } catch (error) {
        console.error('Failed to sign out from Google Calendar:', error);
      }
      set({
        isGoogleCalendarConnected: false,
        googleAccount: null,
        googleCalendarEvents: []
      });
    },

    syncEventToGoogleCalendar: async (eventId) => {
      if (!get().isGoogleCalendarConnected) {
        console.warn('Tried to sync event to Google Calendar, but not connected.');
        return;
      }
      if (!googleCalendarService.isSignedIn()) {
        console.warn('Tried to sync event to Google Calendar, but Google Calendar is not initialized.');
        return;
      }
      try {
        const event = get().events.find(e => e._id === eventId);
        if (!event) throw new Error('Event not found');

        // Map local event to Google Calendar API format
        const toGoogleDateTime = (date: any) => {
          if (date instanceof Date) return date.toISOString();
          return new Date(date).toISOString();
        };

        const googleEvent = {
          summary: event.title,
          start: {
            dateTime: toGoogleDateTime(event.startTime),
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
          },
          end: {
            dateTime: toGoogleDateTime(event.endTime),
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
          },
          ...(event.attendees && event.attendees.length > 0 ? {
            attendees: event.attendees.map(a => ({ email: a.email }))
          } : {})
        };

        const response = await googleCalendarService.createEvent(googleEvent);

        // Update the event with Google Calendar ID
        await get().updateEvent(eventId, {
          googleCalendarEventId: response.id,
          isSynced: true
        });

      } catch (error: any) {
        set({
          error: error.message || 'Failed to sync event to Google Calendar'
        });
        throw error;
      }
    },

    // New function that accepts the full event object
    syncEventToGoogleCalendarWithData: async (event: CalendarEvent) => {
      if (!get().isGoogleCalendarConnected) {
        console.warn('Tried to sync event to Google Calendar, but not connected.');
        return;
      }
      if (!googleCalendarService.isSignedIn()) {
        console.warn('Tried to sync event to Google Calendar, but Google Calendar is not initialized.');
        return;
      }
      try {
        // Map local event to Google Calendar API format
        const toGoogleDateTime = (date: any) => {
          if (date instanceof Date) return date.toISOString();
          return new Date(date).toISOString();
        };

        const googleEvent = {
          summary: event.title,
          start: {
            dateTime: toGoogleDateTime(event.startTime),
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
          },
          end: {
            dateTime: toGoogleDateTime(event.endTime),
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
          },
          ...(event.attendees && event.attendees.length > 0 ? {
            attendees: event.attendees.map(a => ({ email: a.email }))
          } : {})
        };

        const response = await googleCalendarService.createEvent(googleEvent);

        // Update the event with Google Calendar ID
        await get().updateEvent(event._id, {
          googleCalendarEventId: response.id,
          isSynced: true
        });

      } catch (error: any) {
        set({
          error: error.message || 'Failed to sync event to Google Calendar'
        });
        throw error;
      }
    },

    fetchGoogleCalendarEvents: async () => {
      // Clear any pending fetch
      if (fetchTimeout) {
        clearTimeout(fetchTimeout);
      }

      fetchTimeout = setTimeout(async () => {
        if (!get().isGoogleCalendarConnected) {
          console.warn('Tried to fetch Google Calendar events, but not connected.');
          return;
        }

        try {
          console.log('fetchGoogleCalendarEvents called');
          console.log('isGoogleCalendarConnected:', get().isGoogleCalendarConnected);

          if (!googleCalendarService.isSignedIn()) {
            console.warn('Tried to fetch Google Calendar events, but Google Calendar is not initialized.');
            // Update connection status if not properly signed in
            set({ isGoogleCalendarConnected: false });
            return;
          }

          const startDate = new Date();
          startDate.setDate(startDate.getDate() - 7);
          const endDate = new Date();
          endDate.setDate(endDate.getDate() + 30);

          console.log('Fetching Google Calendar events from:', startDate.toISOString(), 'to:', endDate.toISOString());

          const events = await googleCalendarService.listEvents(
            startDate.toISOString(),
            endDate.toISOString()
          );

          console.log('Google Calendar events fetched:', events);
          set({ googleCalendarEvents: events });
        } catch (error: any) {
          console.error('Failed to fetch Google Calendar events:', error);
          console.error('Error details:', error.message);

          // If it's an authentication error, update the connection status
          if (error.message?.includes('Authentication failed') ||
            error.message?.includes('not initialized') ||
            error.message?.includes('re-authenticate')) {
            console.warn('Google Calendar authentication failed during fetch, updating connection status');
            set({
              isGoogleCalendarConnected: false,
              googleCalendarEvents: [],
              error: 'Google Calendar authentication expired. Please reconnect.'
            });
          }
        }
      }, 100); // 100ms delay
    },

    getEventStats: async (startDate, endDate) => {
      try {
        const params = new URLSearchParams();
        if (startDate) params.append('startDate', startDate);
        if (endDate) params.append('endDate', endDate);

        const response = await api.get(`/calendar/stats?${params.toString()}`);
        return response.data;
      } catch (error: any) {
        set({
          error: error.response?.data?.message || 'Failed to fetch event stats'
        });
        throw error;
      }
    },

    // Initialize Google Calendar connection status
    initializeGoogleCalendarStatus: async () => {
      try {
        console.log('Initializing Google Calendar connection status...');

        // Check if Google Calendar is configured first
        if (!googleCalendarService.isConfigured()) {
          console.warn('Google Calendar not configured');
          set({ isGoogleCalendarConnected: false });
          return;
        }

        const config = getGoogleCalendarConfig();
        await googleCalendarService.initialize(config);

        // Check if user is signed in (token is valid and not expired)
        const isSignedIn = googleCalendarService.isSignedIn();

        // Check if the user HAD a persistent connection
        const wasConnected = googleCalendarService.isPersistentConnectionSet();

        console.log('Google Calendar status:', { isSignedIn, wasConnected });

        if (isSignedIn) {
          const userInfo = await googleCalendarService.getUserInfo();
          set({ isGoogleCalendarConnected: true, googleAccount: userInfo, error: null });
          get().fetchGoogleCalendarEvents();
        } else if (wasConnected) {
          // User was connected but token is missing or expired
          set({
            isGoogleCalendarConnected: false,
            error: 'Google Calendar session expired. Please reconnect.'
          });
        } else {
          // First time or manually disconnected
          set({ isGoogleCalendarConnected: false });
        }
      } catch (error: any) {
        console.error('Failed to initialize Google Calendar status:', error);
        set({
          isGoogleCalendarConnected: false,
          error: error.message || 'Failed to initialize Google Calendar'
        });
      }
    },
    setShowWeekends: (show) => set({ showWeekends: show }),
    setStartWeekOn: (day) => set({ startWeekOn: day }),
    setPreFormatNotes: (val) => set({ preFormatNotes: val }),
    setRemindTakeNotes: (val) => set({ remindTakeNotes: val }),
    setRemindOpenNotes: (val) => set({ remindOpenNotes: val }),
  };
}); 