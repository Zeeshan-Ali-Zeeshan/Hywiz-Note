/**
 * Migration Script: Normalize Task Schema
 * 
 * This script migrates existing tasks from the old schema to the canonical schema:
 * - Maps 'text' field to 'title'
 * - Converts 'completed' boolean to 'status' enum
 * - Fixes 'isFloating' logic based on dueDateWall existence
 * 
 * Run this script once before deploying the new code.
 * 
 * Usage:
 *   node server/migrations/normalize-task-schema.js
 */

import mongoose from 'mongoose';
import Task from '../models/Task.js';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/hywiz';

async function migrateTaskSchema() {
    try {
        console.log('🚀 Starting task schema migration...');
        console.log(`📊 Connecting to MongoDB: ${MONGODB_URI.replace(/\/\/(.+):(.+)@/, '//*****:*****@')}`);

        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // Step 1: Migrate 'text' field to 'title' (for tasks that have text but no title)
        console.log('\n📝 Step 1: Migrating text → title...');
        const textToTitleResult = await Task.updateMany(
            {
                $or: [
                    { title: { $exists: false } },
                    { title: null },
                    { title: '' }
                ]
            },
            [
                {
                    $set: {
                        title: {
                            $cond: {
                                if: { $ifNull: ['$text', false] },
                                then: '$text',
                                else: 'Untitled Task'
                            }
                        }
                    }
                }
            ]
        );
        console.log(`✅ Updated ${textToTitleResult.modifiedCount} tasks with title from text field`);

        // Step 2: Migrate 'completed' boolean to 'status' enum
        console.log('\n📝 Step 2: Migrating completed → status...');

        // Update tasks where completed = true
        const completedToStatusResult = await Task.updateMany(
            {
                completed: true,
                $or: [
                    { status: { $exists: false } },
                    { status: null }
                ]
            },
            { $set: { status: 'completed' } }
        );
        console.log(`✅ Updated ${completedToStatusResult.modifiedCount} completed tasks to status='completed'`);

        // Update tasks where completed = false or doesn't exist
        const pendingToStatusResult = await Task.updateMany(
            {
                $or: [
                    { completed: { $in: [false, null] } },
                    { completed: { $exists: false } }
                ],
                $or: [
                    { status: { $exists: false } },
                    { status: null },
                    { status: 'pending' }  // Already correct
                ]
            },
            { $set: { status: 'pending' } }
        );
        console.log(`✅ Updated ${pendingToStatusResult.modifiedCount} pending tasks to status='pending'`);

        // Step 3: Fix isFloating logic based on dueDateWall
        console.log('\n📝 Step 3: Fixing isFloating logic...');

        // Tasks WITH due dates should have isFloating = false
        const withDueDateResult = await Task.updateMany(
            {
                $and: [
                    {
                        $or: [
                            { dueDateWall: { $exists: true, $ne: null } },
                            { dueDateUTC: { $exists: true, $ne: null } }
                        ]
                    },
                    {
                        $or: [
                            { isFloating: { $ne: false } },
                            { isFloating: { $exists: false } }
                        ]
                    }
                ]
            },
            { $set: { isFloating: false } }
        );
        console.log(`✅ Set isFloating=false for ${withDueDateResult.modifiedCount} tasks with due dates`);

        // Tasks WITHOUT due dates should have isFloating = true
        const withoutDueDateResult = await Task.updateMany(
            {
                $and: [
                    { dueDateWall: { $in: [null, undefined] } },
                    { dueDateUTC: { $in: [null, undefined] } },
                    {
                        $or: [
                            { isFloating: { $ne: true } },
                            { isFloating: { $exists: false } }
                        ]
                    }
                ]
            },
            { $set: { isFloating: true } }
        );
        console.log(`✅ Set isFloating=true for ${withoutDueDateResult.modifiedCount} tasks without due dates`);

        // Step 4: Cleanup - can optionally remove old fields (commented out for safety)
        console.log('\n📝 Step 4: Cleanup (optional)...');
        console.log('⚠️  Skipping removal of legacy fields (text, completed) for backward compatibility');
        console.log('   You can manually remove these later with:');
        console.log('   db.tasks.updateMany({}, { $unset: { text: "", completed: "" } })');

        // Final verification
        console.log('\n📊 Verification:');
        const totalTasks = await Task.countDocuments();
        const tasksWithTitle = await Task.countDocuments({ title: { $exists: true, $ne: null, $ne: '' } });
        const tasksWithStatus = await Task.countDocuments({ status: { $in: ['pending', 'completed', 'canceled'] } });
        const floatingTasks = await Task.countDocuments({ isFloating: true });
        const scheduledTasks = await Task.countDocuments({ isFloating: false });

        console.log(`Total tasks: ${totalTasks}`);
        console.log(`Tasks with title: ${tasksWithTitle} (${Math.round(tasksWithTitle / totalTasks * 100)}%)`);
        console.log(`Tasks with status: ${tasksWithStatus} (${Math.round(tasksWithStatus / totalTasks * 100)}%)`);
        console.log(`Floating tasks: ${floatingTasks}`);
        console.log(`Scheduled tasks: ${scheduledTasks}`);

        if (tasksWithTitle !== totalTasks || tasksWithStatus !== totalTasks) {
            console.warn('\n⚠️  WARNING: Some tasks may not have been migrated correctly!');
            console.warn('   Please review the database manually.');
        } else {
            console.log('\n✅ Migration completed successfully!');
        }

        await mongoose.disconnect();
        console.log('👋 Disconnected from MongoDB');
        process.exit(0);

    } catch (error) {
        console.error('\n❌ Migration failed:', error);
        await mongoose.disconnect();
        process.exit(1);
    }
}

// Run migration
migrateTaskSchema();
