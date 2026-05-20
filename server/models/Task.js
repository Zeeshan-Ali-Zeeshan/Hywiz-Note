import mongoose from 'mongoose';
import crypto from 'crypto';

const taskSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // Unique identifier for task (used for editor sync)
  taskId: {
    type: String,
    sparse: true,  // Allow multiple null values, but ensure unique non-null values
    index: true
  },

  // Core Content
  title: {
    type: String, // Renamed from 'text' for clarity, but mapped if needed
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'canceled'],
    default: 'pending',
    index: true
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },

  // Context
  noteId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Note',
    index: true
  },
  templateId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Template'
  },
  parentTaskId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task',
    default: null
  },

  // Recurrence Linkage
  seriesId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TaskSeries',
    index: true,
    default: null
  },
  previousTaskId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task',
    default: null
  },

  // Hardened Scheduling (Floating vs Absolute)
  dueDateUTC: {
    type: Date,
    index: true
  },
  dueDateWall: {
    type: String, // ISO 8601 string without offset: "YYYY-MM-DDTHH:mm:ss"
    default: null
  },
  // FIX M-5: was 'timeZone' (capital Z) — now lowercase to match controller
  timezone: {
    type: String,
    default: 'UTC' // Store the IANA timezone of the user creating the task
  },
  isFloating: {
    type: Boolean,
    default: false
  },
  duration: {
    type: Number, // in minutes
    default: 0
  },

  // Recurrence Configuration
  isRecurring: {
    type: Boolean,
    default: false,
    index: true
  },
  recurringPattern: {
    type: String,
    enum: ['daily', 'weekly', 'monthly', 'yearly', null],
    default: null
  },
  recurrenceRule: {
    type: String, // iCal RRULE format
    default: null
  },

  // Reminder
  reminder: {
    type: String, // ISO date string
    default: null
  },

  // Assignee & Flag
  assignee: {
    type: String,
    trim: true,
    default: null
  },
  isFlagged: {
    type: Boolean,
    default: false
  },

  // Completion History (for recurring tasks)
  completionHistory: [{
    completedAt: Date,
    dueDateWall: String
  }],

  // Reminders
  reminders: [{
    type: { type: String, enum: ['notification', 'email'], default: 'notification' },
    triggerAt: Date, // Absolute calculation
    offset: Number, // Minutes before due date
    sent: { type: Boolean, default: false }
  }],

  // Metadata & Sorting
  position: {
    type: Number,
    default: 0
  },
  tags: [String],

  // Tombstone & Architecture Fields
  isDeleted: {
    type: Boolean,
    default: false,
    index: true
  },
  deletedAt: Date,
  deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  deletionReason: String,

  isArchived: {
    type: Boolean,
    default: false,
    index: true
  },

  completedAt: Date,

  // Concurrency & Sync
  version: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for common queries
taskSchema.index({ userId: 1, status: 1, dueDateUTC: 1 });
taskSchema.index({ userId: 1, isDeleted: 1 });
taskSchema.index({ seriesId: 1, createdAt: -1 });

// Virtual for ETag (Hash of version + updatedAt)
taskSchema.virtual('etag').get(function () {
  const content = `${this.version}-${this.updatedAt ? this.updatedAt.getTime() : 0}`;
  return crypto.createHash('md5').update(content).digest('hex');
});

// FIX H-4: version is incremented ONLY here in the pre-save hook.
// Removed the duplicate task.version += 1 from the controller to prevent double-increment.
taskSchema.pre('save', function (next) {
  this.version += 1;
  next();
});

// Middleware to map 'text' to 'title' if legacy code sends 'text'
taskSchema.pre('validate', function (next) {
  if (this.text && !this.title) {
    this.title = this.text;
  }
  next();
});

export default mongoose.model('Task', taskSchema);
