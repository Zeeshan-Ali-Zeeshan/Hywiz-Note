import mongoose from 'mongoose';

const taskSeriesSchema = new mongoose.Schema({
    ownerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    // The RRule string defining the recurrence pattern (RFC 5545)
    rule: {
        type: String,
        required: true
    },
    // Template data for creating new instances
    templateTask: {
        title: { type: String, required: true },
        description: String,
        priority: {
            type: String,
            enum: ['low', 'medium', 'high'],
            default: 'medium'
        },
        projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Note' }, // Context
        tags: [String],
        timeZone: { type: String, default: 'UTC' },
        isFloating: { type: Boolean, default: false },
        reminder: String
    },
    // Pointer to the currently active (pending) instance
    currentInstanceId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Task'
    },
    // Audit trail of completed task IDs in this series
    history: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Task'
    }],
    // Version for optimistic locking
    version: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

// Optimistic concurrency control
taskSeriesSchema.pre('save', function (next) {
    this.version += 1;
    next();
});

export default mongoose.model('TaskSeries', taskSeriesSchema);
