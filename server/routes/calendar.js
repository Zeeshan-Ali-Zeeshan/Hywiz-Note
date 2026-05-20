import express from 'express';
import mongoose from 'mongoose';
import CalendarEvent from '../models/Calendar.js';
import auth from '../middleware/auth.js';

const router = express.Router();

// Get calendar events for a date range
router.get('/', auth, async (req, res) => {
  try {
    const { 
      startDate, 
      endDate, 
      type, 
      view = 'day' // day, week, month
    } = req.query;

    let query = { userId: req.userId };

    // Add date range filter
    if (startDate && endDate) {
      query.startTime = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    // Add type filter
    if (type && type !== 'all') {
      query.type = type;
    }

    const events = await CalendarEvent.find(query)
      .populate('noteId', 'title')
      .sort({ startTime: 1 });

    res.json(events);
  } catch (error) {
    console.error('Error fetching calendar events:', error);
    res.status(500).json({ message: 'Failed to fetch calendar events' });
  }
});

// Get events for a specific day
router.get('/day/:date', auth, async (req, res) => {
  try {
    const { date } = req.params;
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const events = await CalendarEvent.find({
      userId: req.userId,
      startTime: { $gte: startOfDay, $lte: endOfDay }
    })
    .populate('noteId', 'title')
    .sort({ startTime: 1 });

    res.json(events);
  } catch (error) {
    console.error('Error fetching day events:', error);
    res.status(500).json({ message: 'Failed to fetch day events' });
  }
});

// Get events for a specific week
router.get('/week/:startDate', auth, async (req, res) => {
  try {
    const { startDate } = req.params;
    const startOfWeek = new Date(startDate);
    startOfWeek.setHours(0, 0, 0, 0);
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(endOfWeek.getDate() + 7);
    endOfWeek.setHours(23, 59, 59, 999);

    const events = await CalendarEvent.find({
      userId: req.userId,
      startTime: { $gte: startOfWeek, $lt: endOfWeek }
    })
    .populate('noteId', 'title')
    .sort({ startTime: 1 });

    res.json(events);
  } catch (error) {
    console.error('Error fetching week events:', error);
    res.status(500).json({ message: 'Failed to fetch week events' });
  }
});

// Get events for a specific month
router.get('/month/:year/:month', auth, async (req, res) => {
  try {
    const { year, month } = req.params;
    const startOfMonth = new Date(parseInt(year), parseInt(month) - 1, 1);
    const endOfMonth = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59, 999);

    const events = await CalendarEvent.find({
      userId: req.userId,
      startTime: { $gte: startOfMonth, $lte: endOfMonth }
    })
    .populate('noteId', 'title')
    .sort({ startTime: 1 });

    res.json(events);
  } catch (error) {
    console.error('Error fetching month events:', error);
    res.status(500).json({ message: 'Failed to fetch month events' });
  }
});

// Create a new calendar event
router.post('/', auth, async (req, res) => {
  try {
    console.log('Creating calendar event with data:', req.body);
    console.log('User ID from auth:', req.userId);
    
    const {
      title,
      description,
      startTime,
      endTime,
      allDay,
      location,
      type,
      priority,
      color,
      noteId,
      recurring,
      attendees
    } = req.body;

    // Validate required fields
    if (!title) {
      return res.status(400).json({ message: 'Title is required' });
    }
    if (!startTime) {
      return res.status(400).json({ message: 'Start time is required' });
    }
    if (!endTime) {
      return res.status(400).json({ message: 'End time is required' });
    }

    const event = new CalendarEvent({
      title,
      description,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      allDay: allDay || false,
      location,
      type: type || 'event',
      priority: priority || 'medium',
      color: color || '#4285f4',
      userId: req.userId,
      noteId,
      recurring,
      attendees
    });

    console.log('Calendar event object before save:', event);

    const savedEvent = await event.save();
    await savedEvent.populate('noteId', 'title');

    console.log('Calendar event saved successfully:', savedEvent);

    res.status(201).json(savedEvent);
  } catch (error) {
    console.error('Error creating calendar event:', error);
    console.error('Error details:', error.message);
    console.error('Error stack:', error.stack);
    res.status(500).json({ message: 'Failed to create calendar event', error: error.message });
  }
});

// Update a calendar event
router.put('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };
    
    // Convert date strings to Date objects
    if (updateData.startTime) {
      updateData.startTime = new Date(updateData.startTime);
    }
    if (updateData.endTime) {
      updateData.endTime = new Date(updateData.endTime);
    }

    const event = await CalendarEvent.findOneAndUpdate(
      { _id: id, userId: req.userId },
      updateData,
      { new: true, runValidators: true }
    )
    .populate('noteId', 'title')


    if (!event) {
      return res.status(404).json({ message: 'Calendar event not found' });
    }

    res.json(event);
  } catch (error) {
    console.error('Error updating calendar event:', error);
    res.status(500).json({ message: 'Failed to update calendar event' });
  }
});

// Delete a calendar event
router.delete('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log('Attempting to delete calendar event with ID:', id);
    console.log('User ID from auth:', req.userId);
    
    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      console.log('Invalid ObjectId format:', id);
      return res.status(400).json({ message: 'Invalid event ID format' });
    }
    
    const event = await CalendarEvent.findOneAndDelete({
      _id: id,
      userId: req.userId
    });

    if (!event) {
      console.log('Event not found or user not authorized');
      return res.status(404).json({ message: 'Calendar event not found' });
    }

    console.log('Calendar event deleted successfully:', event._id);
    res.json({ message: 'Calendar event deleted successfully' });
  } catch (error) {
    console.error('Error deleting calendar event:', error);
    console.error('Error details:', error.message);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      message: 'Failed to delete calendar event', 
      error: error.message,
      details: error.stack 
    });
  }
});

// Get calendar statistics
router.get('/stats', auth, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    let dateFilter = {};
    if (startDate && endDate) {
      dateFilter = {
        startTime: {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        }
      };
    }

    const stats = await CalendarEvent.aggregate([
      { $match: { userId: req.userId, ...dateFilter } },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
          completed: {
            $sum: {
              $cond: [{ $eq: ['$status', 'completed'] }, 1, 0]
            }
          }
        }
      }
    ]);

    const totalEvents = stats.reduce((sum, stat) => sum + stat.count, 0);
    const totalCompleted = stats.reduce((sum, stat) => sum + stat.completed, 0);

    res.json({
      total: totalEvents,
      completed: totalCompleted,
      pending: totalEvents - totalCompleted,
      byType: stats
    });
  } catch (error) {
    console.error('Error fetching calendar stats:', error);
    res.status(500).json({ message: 'Failed to fetch calendar statistics' });
  }
});

// Sync with Google Calendar
router.post('/:id/sync', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { googleCalendarEventId } = req.body;

    const event = await CalendarEvent.findOneAndUpdate(
      { _id: id, userId: req.userId },
      { 
        googleCalendarEventId,
        isSynced: true
      },
      { new: true }
    )
    .populate('noteId', 'title')
    .populate('reminderId', 'title');

    if (!event) {
      return res.status(404).json({ message: 'Calendar event not found' });
    }

    res.json(event);
  } catch (error) {
    console.error('Error syncing calendar event:', error);
    res.status(500).json({ message: 'Failed to sync calendar event' });
  }
});

export default router; 