export interface Note {
  id: string;
  title: string;
  preview: string;
  date: string;
  thumbnail?: string;
  tags: string[];
  isPinned: boolean;
  category: string;
}

export interface Shortcut {
  id: string;
  name: string;
  icon: string;
  count?: number;
}

export interface RecentItem {
  id: string;
  title: string;
  type: 'webclip' | 'image' | 'document' | 'audio' | 'email';
  thumbnail?: string;
  timestamp: string;
}

export interface NavigationItem {
  id: string;
  name: string;
  icon: string;
  badge?: number;
}

/**
 * Canonical Task Schema
 * This is the SINGLE SOURCE OF TRUTH for task structure across the entire app.
 * Used by: editor extraction, frontend store, API sync, backend model, calendar rendering
 * 
 * CRITICAL RULES:
 * - Use 'title' NOT 'text'
 * - Use 'status' enum NOT 'completed' boolean
 * - isFloating is calculated from dueDateWall existence
 * - All layers must use this exact structure
 */
export interface Task {
  id: string;              // Frontend uses 'id', backend uses '_id' (mapped)
  noteId?: string;         // Link to parent note
  templateId?: string;     // Link to template if created from template
  title: string;           // ✅ ONLY text field (NOT 'text')
  description?: string;    // Extended description
  status: 'pending' | 'completed' | 'canceled';  // ✅ Enum NOT boolean
  priority: 'low' | 'medium' | 'high' | 'critical';

  // Scheduling fields
  dueDateWall?: string;    // ISO string in local timezone: "2026-02-15T14:00:00"
  dueDateUTC?: string;     // ISO string in UTC for backend
  isFloating: boolean;     // true = no due date, false = has due date
  timeZone?: string;       // IANA timezone (e.g., "America/New_York")

  // Recurrence
  isRecurring: boolean;
  recurringPattern?: 'daily' | 'weekly' | 'monthly' | 'yearly';

  // Metadata
  reminder?: string;       // ISO string for reminder time
  createdAt: string;
  updatedAt: string;
  completedAt?: string;    // When task was completed
}

export interface TaskFilter {
  status: 'all' | 'pending' | 'completed' | 'overdue';
  priority?: 'low' | 'medium' | 'high';
  dueDate?: 'today' | 'tomorrow' | 'thisWeek' | 'thisMonth' | 'overdue';
  noteId?: string;
  templateId?: string;
}