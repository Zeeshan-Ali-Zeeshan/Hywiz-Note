import Task from '../models/Task.js';
import mongoose from 'mongoose';

// ─── RRule Parser Utility ────────────────────────────────────────────────────
// Parses a minimal iCal RRULE string into a structured object.
// Supports: FREQ, INTERVAL, BYDAY, BYMONTHDAY, BYMONTH, UNTIL, COUNT
function parseRRule(rule) {
    if (!rule) return null;
    const parts = {};
    rule.split(';').forEach(part => {
        const [key, val] = part.split('=');
        if (key && val !== undefined) parts[key.trim()] = val.trim();
    });
    return {
        freq: parts.FREQ || null,
        interval: parseInt(parts.INTERVAL || '1', 10),
        byDay: parts.BYDAY ? parts.BYDAY.split(',').map(d => d.trim()) : [],
        byMonthDay: parts.BYMONTHDAY ? parseInt(parts.BYMONTHDAY, 10) : null,
        until: parts.UNTIL ? parseUntilDate(parts.UNTIL) : null,
    };
}

// Parse UNTIL value (supports YYYYMMDD and YYYYMMDDTHHmmssZ)
function parseUntilDate(str) {
    if (!str) return null;
    if (str.length >= 8) {
        const y = str.substring(0, 4);
        const m = str.substring(4, 6);
        const d = str.substring(6, 8);
        return new Date(`${y}-${m}-${d}T23:59:59Z`);
    }
    return new Date(str);
}

// iCal weekday abbreviation → JS getDay() index (0=Sun)
const RRULE_DAY_TO_JS = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

/**
 * Compute the next occurrence after `currentDate` given a parsed RRule.
 * Returns null if recurrence has ended (UNTIL exceeded).
 */
function getNextOccurrence(currentDate, rrule) {
    if (!rrule || !rrule.freq) return null;

    const interval = rrule.interval || 1;
    let next = new Date(currentDate);

    switch (rrule.freq) {
        case 'DAILY': {
            if (rrule.byDay && rrule.byDay.length > 0) {
                // Weekday-filter daily (e.g. BYDAY=MO,TU,WE,TH,FR)
                const allowedDays = rrule.byDay.map(d => RRULE_DAY_TO_JS[d]).filter(d => d !== undefined);
                // Advance one day at a time (respecting interval as a skip-days concept for BYDAY)
                next.setDate(next.getDate() + 1);
                let tries = 0;
                while (!allowedDays.includes(next.getDay()) && tries < 14) {
                    next.setDate(next.getDate() + 1);
                    tries++;
                }
            } else {
                next.setDate(next.getDate() + interval);
            }
            break;
        }
        case 'WEEKLY': {
            if (rrule.byDay && rrule.byDay.length > 0) {
                const allowedDays = rrule.byDay
                    .map(d => RRULE_DAY_TO_JS[d])
                    .filter(d => d !== undefined)
                    .sort((a, b) => a - b);

                const currentDayOfWeek = currentDate.getDay();
                // Find next allowed day in this week or next week(s)
                const nextDayInWeek = allowedDays.find(d => d > currentDayOfWeek);

                if (nextDayInWeek !== undefined) {
                    // Still within the same week
                    next.setDate(next.getDate() + (nextDayInWeek - currentDayOfWeek));
                } else {
                    // Jump to the first allowed day in the next occurrence week
                    const daysUntilEndOfWeek = 7 - currentDayOfWeek;
                    const daysToNextWeekStart = daysUntilEndOfWeek + (interval - 1) * 7;
                    next.setDate(next.getDate() + daysToNextWeekStart + allowedDays[0]);
                }
            } else {
                next.setDate(next.getDate() + 7 * interval);
            }
            break;
        }
        case 'MONTHLY': {
            if (rrule.byMonthDay) {
                // Advance by `interval` months and set to byMonthDay
                next.setMonth(next.getMonth() + interval);
                const maxDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
                next.setDate(Math.min(rrule.byMonthDay, maxDay));
            } else {
                next.setMonth(next.getMonth() + interval);
            }
            break;
        }
        case 'YEARLY': {
            next.setFullYear(next.getFullYear() + interval);
            break;
        }
        default:
            console.warn(`[RRULE] Unknown FREQ: ${rrule.freq}`);
            return null;
    }

    // Check UNTIL end date
    if (rrule.until && next > rrule.until) {
        console.log(`[RRULE] Recurrence ended: next (${next.toISOString()}) > UNTIL (${rrule.until.toISOString()})`);
        return null;
    }

    return next;
}

/**
 * Derive a simple recurringPattern enum from a parsed RRule.
 * Used for backward-compatible storage.
 */
function derivePattern(rrule) {
    if (!rrule) return null;
    switch (rrule.freq) {
        case 'DAILY': return 'daily';
        case 'WEEKLY': return 'weekly';
        case 'MONTHLY': return 'monthly';
        case 'YEARLY': return 'yearly';
        default: return null;
    }
}

// ─── Controller ──────────────────────────────────────────────────────────────
function ruleFromPattern(pattern, wallDate) {
    if (!pattern) return null;

    const baseDate = wallDate ? new Date(wallDate) : new Date();
    const days = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

    switch (pattern) {
        case 'daily': return 'FREQ=DAILY';
        case 'weekly': return `FREQ=WEEKLY;BYDAY=${days[baseDate.getDay()]}`;
        case 'monthly': return `FREQ=MONTHLY;BYMONTHDAY=${baseDate.getDate()}`;
        case 'yearly': return 'FREQ=YEARLY';
        default: return null;
    }
}

export const taskController = {
    // GET LIST
    getTasks: async (req, res) => {
        // Must filter isDeleted by default
        const { status, noteId, taskId } = req.query; // Added taskId support
        const query = { userId: req.user.userId, isDeleted: false, isArchived: false };

        if (taskId) query._id = new mongoose.Types.ObjectId(taskId); // Support fetching specific task
        if (status && status !== 'all') query.status = status;
        if (noteId) query.noteId = noteId;

        try {
            const tasks = await Task.find(query)
                .sort({ dueDateUTC: 1, priority: -1 })
                .populate('seriesId'); // Populate series to get rules

            res.json(tasks);
        } catch (error) {
            console.error('[GET TASKS ERROR]', error);
            res.status(500).json({ message: 'Failed to fetch tasks' });
        }
    },

    // CREATE (New Single or Series)
    createTask: async (req, res) => {
        const {
            title, text, description,
            dueDate, dueDateWall,   // accept both; UI sends dueDateWall
            priority, status, noteId, seriesId,
            isRecurring, recurringPattern, recurrenceRule,
            reminder, position, tags, timezone, isFlagged, assignee
        } = req.body;

        try {
            const wallDate = dueDateWall || dueDate || null;
            // Keep recurrence fields consistent even if a client sends only part of the tuple.
            const normalizedRecurrenceRule = recurrenceRule || (isRecurring ? ruleFromPattern(recurringPattern, wallDate) : null);
            let derivedPattern = recurringPattern || null;
            if (!derivedPattern && normalizedRecurrenceRule) {
                derivedPattern = derivePattern(parseRRule(normalizedRecurrenceRule));
            }
            const hasRecurrence = Boolean(isRecurring || normalizedRecurrenceRule);

            const updates = {
                userId: req.user.userId,
                title: title || text || 'Untitled Task',
                description: description || null,
                priority: priority || 'medium',
                status: status || 'pending',
                noteId,
                seriesId,
                isRecurring: hasRecurrence,
                recurringPattern: derivedPattern,
                recurrenceRule: normalizedRecurrenceRule,
                reminder: reminder || null,
                position: position || 0,
                tags: Array.isArray(tags) ? tags : [],
                timezone: timezone || 'UTC',
                isFlagged: isFlagged || false,
                assignee: assignee || null,
                version: 1
            };

            // Handle due date – prefer dueDateWall (UI field) over legacy dueDate
            if (wallDate) {
                updates.dueDateWall = wallDate;
                updates.dueDateUTC = new Date(wallDate);
                updates.isFloating = false;
            } else {
                updates.dueDateWall = null;
                updates.dueDateUTC = null;
                updates.isFloating = true; // If no due date, it's floating
            }

            const task = new Task(updates);
            await task.save();
            res.status(201).json(task);
        } catch (error) {
            console.error('[CREATE TASK ERROR]', error);
            res.status(500).json({ message: 'Failed to create task' });
        }
    },

    // UPDATE (With Drift Protection)
    updateTask: async (req, res) => {
        const { id } = req.params;
        const updates = req.body;

        try {
            const task = await Task.findOne({ _id: id, userId: req.user.userId });
            if (!task) return res.status(404).json({ message: 'Task not found' });

            // FIX L-5: Validate If-Match ETag for optimistic concurrency
            const ifMatch = req.headers['if-match'];
            if (ifMatch && ifMatch !== task.etag) {
                return res.status(409).json({
                    message: 'Conflict: Task was modified by another request. Please refresh.',
                    currentEtag: task.etag
                });
            }

            // Define fields that can be directly updated
            const allowedFields = [
                'title', 'description', 'priority', 'status', 'noteId', 'seriesId',
                'isRecurring', 'recurringPattern', 'recurrenceRule', 'reminder', 'position',
                'tags', 'assignee', 'isFlagged', 'timezone', 'isArchived'
            ];

            // Apply direct updates
            for (const field of allowedFields) {
                if (updates.hasOwnProperty(field)) {
                    task[field] = updates[field];
                }
            }

            // FIX New Issue: When recurrenceRule is updated, auto-derive recurringPattern
            // so the backend completeTask can always find an effectivePattern.
            if (updates.hasOwnProperty('recurrenceRule')) {
                const parsed = parseRRule(updates.recurrenceRule);
                const derived = derivePattern(parsed);
                task.isRecurring = Boolean(updates.recurrenceRule);
                if (derived && !updates.hasOwnProperty('recurringPattern')) {
                    task.recurringPattern = derived;
                } else if (!updates.recurrenceRule && !updates.hasOwnProperty('recurringPattern')) {
                    task.recurringPattern = null;
                }
            }

            // Handle due date updates – prefer dueDateWall (UI field) over legacy dueDate
            if (
                !updates.hasOwnProperty('recurrenceRule') &&
                updates.isRecurring === true &&
                updates.recurringPattern
            ) {
                task.recurrenceRule = ruleFromPattern(updates.recurringPattern, updates.dueDateWall || task.dueDateWall);
                task.recurringPattern = updates.recurringPattern;
                task.isRecurring = Boolean(task.recurrenceRule);
            }

            const wallUpdate = updates.hasOwnProperty('dueDateWall') ? updates.dueDateWall
                             : updates.hasOwnProperty('dueDate') ? updates.dueDate
                             : undefined;

            if (wallUpdate !== undefined) {
                if (wallUpdate === null || wallUpdate === '') {
                    task.dueDateWall = null;
                    task.dueDateUTC = null;
                    task.isFloating = true;
                } else {
                    task.dueDateWall = wallUpdate;
                    task.dueDateUTC = new Date(wallUpdate);
                    task.isFloating = false;
                }
            }

            // Handle 'completed' boolean explicitly (can override 'status')
            if (updates.hasOwnProperty('completed')) {
                if (updates.completed) {
                    task.status = 'completed';
                    if (!task.completedAt) task.completedAt = new Date();
                } else {
                    task.status = 'pending';
                    task.completedAt = undefined;
                }
            } else if (updates.hasOwnProperty('status')) { // If 'status' is updated directly
                if (updates.status === 'completed' && !task.completedAt) {
                    task.completedAt = new Date();
                } else if (updates.status === 'pending') {
                    task.completedAt = undefined;
                }
            }

            // Handle Soft Delete
            if (updates.hasOwnProperty('isDeleted')) {
                task.isDeleted = updates.isDeleted;
                if (updates.isDeleted) {
                    task.deletedAt = new Date();
                } else {
                    task.deletedAt = undefined;
                }
            }

            // FIX H-4: DO NOT increment task.version here.
            // The pre('save') hook in Task.js handles version increments exclusively.
            await task.save();
            res.json(task);
        } catch (error) {
            console.error('[UPDATE TASK ERROR]', error);
            res.status(500).json({ message: 'Failed to update task' });
        }
    },

    // COMPLETE (Transactional) — FIX C-3: Full RRule support
    completeTask: async (req, res) => {
        const { id } = req.params;
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const task = await Task.findOne({ _id: id, userId: req.user.userId }).session(session);
            if (!task) {
                await session.abortTransaction();
                return res.status(404).json({ message: 'Task not found' });
            }

            const now = new Date();

            const recurrenceRule = task.recurrenceRule || ruleFromPattern(task.recurringPattern, task.dueDateWall);
            if (!task.recurrenceRule && recurrenceRule) {
                task.recurrenceRule = recurrenceRule;
                task.isRecurring = true;
            }

            // Parse the full RRule for accurate next-occurrence calculation
            const rrule = parseRRule(recurrenceRule);

            // Derive effectivePattern for backward compat (recurringPattern enum)
            let effectivePattern = task.recurringPattern;
            if (!effectivePattern && rrule) {
                effectivePattern = derivePattern(rrule);
                // Persist the derived pattern so future lookups are faster
                task.recurringPattern = effectivePattern;
            }

            // ✅ RECURRING TASK LOGIC — now uses full RRule
            if ((task.isRecurring || task.recurringPattern) && rrule && rrule.freq && task.dueDateWall) {
                console.log(`[COMPLETE] Recurring task: "${task.title}", rule: ${task.recurrenceRule}`);

                // Record completion history
                if (!task.completionHistory) task.completionHistory = [];
                task.completionHistory.push({
                    completedAt: now,
                    dueDateWall: task.dueDateWall
                });

                // Preserve time portion from original dueDateWall
                const origTimePart = task.dueDateWall.includes('T')
                    ? task.dueDateWall.split('T')[1]
                    : null;

                const currentDate = new Date(task.dueDateWall);
                const nextDate = getNextOccurrence(currentDate, rrule);

                if (nextDate) {
                    // Build next dueDateWall preserving original time
                    const nextDateStr = nextDate.toISOString().split('T')[0];
                    task.dueDateWall = origTimePart
                        ? `${nextDateStr}T${origTimePart}`
                        : `${nextDateStr}T00:00:00`;
                    task.dueDateUTC = nextDate;
                    task.isFloating = false;
                    task.status = 'pending';
                    task.completedAt = undefined;

                    console.log(`[COMPLETE] Advanced to next occurrence: ${task.dueDateWall}`);
                } else {
                    // Recurrence ended (UNTIL passed) — mark as completed
                    console.log(`[COMPLETE] Recurrence ended for task "${task.title}" — marking completed`);
                    task.status = 'completed';
                    task.completedAt = now;
                    task.isRecurring = false; // No more future occurrences
                }

            } else {
                // Non-recurring task — mark as completed
                task.status = 'completed';
                task.completedAt = now;
            }

            await task.save({ session });
            await session.commitTransaction();
            res.json({ task });
        } catch (error) {
            await session.abortTransaction();
            console.error('[COMPLETE TASK ERROR]', error);
            res.status(500).json({ message: 'Transaction failed' });
        } finally {
            session.endSession();
        }
    },

    // RESTORE
    restoreTask: async (req, res) => {
        const { id } = req.params;
        try {
            const task = await Task.findOne({ _id: id, userId: req.user.userId });
            if (!task) return res.status(404).json({ message: 'Task not found' });

            task.isDeleted = false;
            task.deletedAt = undefined;
            await task.save();
            res.json(task);
        } catch (error) {
            console.error('[RESTORE TASK ERROR]', error);
            res.status(500).json({ message: 'Failed to restore task' });
        }
    },

    // SYNC FROM NOTE
    // ✅ CANONICAL SCHEMA: Uses title, status, isFloating calculated from dueDateWall
    syncFromNote: async (req, res) => {
        const { noteId, tasks } = req.body;
        const userId = req.user.userId;

        if (!tasks || !Array.isArray(tasks)) {
            return res.json({ message: 'No tasks to sync', synced: 0 });
        }

        let syncedCount = 0;
        const results = [];

        try {
            console.log(`[SYNC] Starting sync for note ${noteId} with ${tasks.length} tasks`);

            for (const taskData of tasks) {
                console.log(`[SYNC] Processing task: "${taskData.title}", id: ${taskData.id || taskData.taskId || 'none'}, position: ${taskData.position}`);

                // Determine Identity: by taskId (anchor) or content hash/dedupe logic
                let task;

                if (taskData.id || taskData.taskId) {
                    const id = taskData.id || taskData.taskId;
                    task = await Task.findOne({ _id: id, userId });
                    if (task) {
                        console.log(`[SYNC] Found task by ID: ${task._id}`);
                    } else {
                        console.log(`[SYNC] No task found with ID: ${id}`);
                    }
                }

                // Fallback 1: Deduplication by Note + Title (ANY status, not just pending)
                if (!task && taskData.title) {
                    task = await Task.findOne({
                        userId,
                        noteId,
                        title: taskData.title,
                        isDeleted: false
                    }).sort({ updatedAt: -1 }).limit(1);

                    if (task) {
                        console.log(`[SYNC] Found task by title deduplication: ${task._id}, title: "${task.title}"`);
                    } else {
                        console.log(`[SYNC] No task found by title: "${taskData.title}"`);
                    }
                }

                // Fallback 2: Deduplication by Note + Position
                if (!task && typeof taskData.position === 'number') {
                    task = await Task.findOne({
                        userId,
                        noteId,
                        position: taskData.position,
                        isDeleted: false
                    }).sort({ createdAt: -1 }).limit(1);

                    if (task) {
                        console.log(`[SYNC] Found task by position deduplication: ${task._id}, position: ${task.position}`);
                    } else {
                        console.log(`[SYNC] No task found by position: ${taskData.position}`);
                    }
                }

                // FIX New Issue: Derive recurringPattern from recurrenceRule when syncing
                const syncWallDate = taskData.dueDateWall || taskData.dueDate;
                const normalizedRecurrenceRule = taskData.recurrenceRule || (taskData.isRecurring ? ruleFromPattern(taskData.recurringPattern, syncWallDate) : null);
                let derivedPattern = taskData.recurringPattern || null;
                if (!derivedPattern && normalizedRecurrenceRule) {
                    derivedPattern = derivePattern(parseRRule(normalizedRecurrenceRule));
                }
                const hasRecurrence = Boolean(taskData.isRecurring || normalizedRecurrenceRule);

                // ✅ CANONICAL SCHEMA: Build updates object with proper fields
                const updates = {
                    userId,
                    noteId,
                    title: taskData.title,
                    status: taskData.status || 'pending',
                    priority: taskData.priority || 'medium',
                    dueDateWall: syncWallDate,
                    isFloating: !taskData.dueDateWall && !taskData.dueDate,
                    description: taskData.description,
                    reminder: taskData.reminder,
                    isRecurring: hasRecurrence,
                    recurringPattern: derivedPattern,
                    recurrenceRule: normalizedRecurrenceRule,
                    position: taskData.position
                };

                if (updates.dueDateWall) {
                    updates.dueDateUTC = new Date(updates.dueDateWall);
                    updates.isFloating = false;
                } else {
                    delete updates.dueDateUTC;
                    updates.isFloating = true;
                }

                // Handle completion timestamp based on status
                if (updates.status === 'completed' && (!task || !task.completedAt)) {
                    updates.completedAt = new Date();
                }

                if (task) {
                    // UPDATE existing task
                    console.log(`[SYNC] Updating existing task: ${task._id}`);

                    // RECURRENCE RACE CONDITION FIX:
                    if (task.isRecurring && task.status === 'pending' && updates.status === 'completed') {
                        const dbDate = new Date(task.dueDateWall);
                        const syncDate = new Date(updates.dueDateWall);

                        if (dbDate > syncDate) {
                            console.log(`[SYNC] 🛡️ IGNORING STALE SYNC for recurring task ${task._id}. Task already advanced to ${task.dueDateWall}.`);
                            delete updates.status;
                            delete updates.dueDateWall;
                            delete updates.dueDateUTC;
                            delete updates.isFloating;
                            delete updates.completedAt;
                        }
                    }

                    Object.assign(task, updates);

                    if (updates.status === 'pending') {
                        task.completedAt = undefined;
                    }

                    await task.save();
                    results.push(task);
                } else {
                    // CREATE new task ONLY if truly not found
                    console.log(`[SYNC] Creating NEW task: "${taskData.title}"`);
                    const taskId = taskData.taskId || taskData.id || new mongoose.Types.ObjectId().toString();

                    task = new Task({
                        ...updates,
                        taskId,
                        version: 1
                    });
                    await task.save();
                    console.log(`[SYNC] Created task with _id: ${task._id}, taskId: ${taskId}`);
                    results.push(task);
                }
                syncedCount++;
            }

            console.log(`[SYNC] Sync complete: ${syncedCount} tasks processed`);
            res.json({ message: 'Sync processed', synced: syncedCount, tasks: results });

        } catch (error) {
            console.error('[SYNC ERROR]', error);
            res.status(500).json({ message: 'Sync failed', error: error.message });
        }
    }
};
