import * as Y from 'yjs';
import { yDocToProsemirrorJSON } from 'y-prosemirror';


/**
 * Extract title from a Yjs document
 * @param yjsUpdate - Base64 encoded Yjs update or Buffer object
 * @returns Title text
 */
export function extractTitleFromYjs(yjsUpdate: string | { type: 'Buffer'; data: number[] } | Uint8Array): string {
  try {
    if (!yjsUpdate) {
      return 'Untitled';
    }

    const ydoc = new Y.Doc();
    let update: Uint8Array;

    // Handle Buffer object from backend
    if (typeof yjsUpdate === 'object' && 'type' in yjsUpdate && yjsUpdate.type === 'Buffer' && 'data' in yjsUpdate && Array.isArray(yjsUpdate.data)) {
      update = new Uint8Array(yjsUpdate.data);
    }
    // Handle base64 string
    else if (typeof yjsUpdate === 'string') {
      // Validate base64 string before decoding
      if (!/^[A-Za-z0-9+/]*={0,2}$/.test(yjsUpdate)) {
        console.warn('Invalid base64 string in yjsUpdate:', yjsUpdate);
        return 'Untitled';
      }

      try {
        update = Uint8Array.from(atob(yjsUpdate), c => c.charCodeAt(0));
      } catch (base64Error) {
        console.warn('Failed to decode base64 yjsUpdate:', base64Error);
        return 'Untitled';
      }
    }
    // Handle Uint8Array directly
    else if (yjsUpdate instanceof Uint8Array) {
      update = yjsUpdate;
    }
    else {
      console.warn('Unsupported yjsUpdate format:', typeof yjsUpdate, yjsUpdate);
      return 'Untitled';
    }

    Y.applyUpdate(ydoc, update);

    // Try to get title from 'title' text field first (used by notes)
    try {
      const yTitle = ydoc.getText('title');
      const titleText = yTitle.toString().trim();
      if (titleText) {
        return titleText;
      }
    } catch (error) {
      // title text field doesn't exist, continue to other methods
    }

    // Try to get title from 'title' XML fragment (used by templates)
    try {
      const yTitleXml = ydoc.getXmlFragment('title');
      const titleXmlContent = yTitleXml.toString();
      if (titleXmlContent && titleXmlContent.trim()) {
        const plainText = titleXmlContent
          .replace(/<[^>]*>/g, '')
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/\s+/g, ' ')
          .trim();

        if (plainText) {
          return plainText;
        }
      }
    } catch (error) {
      // title fragment doesn't exist, continue to fallback
    }

    // Try to get title from 'titleXml' XML fragment (legacy fallback)
    try {
      const yTitleXml = ydoc.getXmlFragment('titleXml');
      const titleXmlContent = yTitleXml.toString();
      if (titleXmlContent && titleXmlContent.trim()) {
        const plainText = titleXmlContent
          .replace(/<[^>]*>/g, '')
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/\s+/g, ' ')
          .trim();

        if (plainText) {
          return plainText;
        }
      }
    } catch (error) {
      // titleXml fragment doesn't exist, continue to fallback
    }

    return 'Untitled';
  } catch (error) {
    console.error('Error extracting title from Yjs:', error);
    return 'Untitled';
  }
}

/**
 * Extract plain text content from a Yjs document on the client side
 * @param yjsUpdate - Base64 encoded Yjs update or Buffer object
 * @returns Plain text content
 */
export function extractPlainTextFromYjs(yjsUpdate: string | { type: 'Buffer'; data: number[] } | Uint8Array): string {
  try {
    if (!yjsUpdate) {
      return '';
    }

    // Create a new Yjs document
    const ydoc = new Y.Doc();

    // Handle Buffer object from backend
    if (typeof yjsUpdate === 'object' && 'type' in yjsUpdate && yjsUpdate.type === 'Buffer' && 'data' in yjsUpdate && Array.isArray(yjsUpdate.data)) {
      const update = new Uint8Array(yjsUpdate.data);
      Y.applyUpdate(ydoc, update);
    }
    // Handle base64 string
    else if (typeof yjsUpdate === 'string') {
      // Validate base64 string before decoding
      if (!/^[A-Za-z0-9+/]*={0,2}$/.test(yjsUpdate)) {
        console.warn('Invalid base64 string in yjsUpdate:', yjsUpdate);
        return '';
      }

      try {
        const update = Uint8Array.from(atob(yjsUpdate), c => c.charCodeAt(0));
        Y.applyUpdate(ydoc, update);
      } catch (base64Error) {
        console.warn('Failed to decode base64 yjsUpdate:', base64Error);
        return '';
      }
    }
    // Handle Uint8Array directly
    else if (yjsUpdate instanceof Uint8Array) {
      Y.applyUpdate(ydoc, yjsUpdate);
    }
    else {
      console.warn('Unsupported yjsUpdate format:', typeof yjsUpdate, yjsUpdate);
      return '';
    }

    // Try to get content from 'default' XML fragment (main content)
    try {
      const yXml = ydoc.getXmlFragment('default');
      const xmlContent = yXml.toString();

      // Convert XML to plain text by removing HTML tags
      if (xmlContent && xmlContent.trim()) {
        const plainText = xmlContent
          .replace(/<[^>]*>/g, '') // Remove HTML tags
          .replace(/&nbsp;/g, ' ') // Replace &nbsp; with space
          .replace(/&amp;/g, '&') // Replace &amp; with &
          .replace(/&lt;/g, '<') // Replace &lt; with <
          .replace(/&gt;/g, '>') // Replace &gt; with >
          .replace(/&quot;/g, '"') // Replace &quot; with "
          .replace(/\s+/g, ' ') // Replace multiple spaces with single space
          .trim();

        if (plainText) {
          return plainText;
        }
      }
    } catch (error) {
      // default fragment doesn't exist, continue to other methods
    }

    // Fallback: try to get any text content from the document
    const allSharedTypes = (ydoc.share as unknown as Map<string, any>).entries();
    let contentText = '';

    for (const [, sharedType] of allSharedTypes) {
      if (sharedType instanceof Y.Text) {
        const text = sharedType.toString().trim();
        if (text && text.length > contentText.length) {
          contentText = text;
        }
      } else if (sharedType instanceof Y.XmlFragment) {
        const xmlContent = sharedType.toString();
        const plainText = xmlContent
          .replace(/<[^>]*>/g, '')
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/\s+/g, ' ')
          .trim();

        if (plainText && plainText.length > contentText.length) {
          contentText = plainText;
        }
      }
    }

    return contentText;
  } catch (error) {
    console.error('Error extracting plain text from Yjs:', error);
    return '';
  }
}

/**
 * Get a preview of plain text content (first 200 characters)
 * @param yjsUpdate - Base64 encoded Yjs update or Buffer object
 * @returns Preview of plain text content
 */
export function getPlainTextPreview(yjsUpdate: string | { type: 'Buffer'; data: number[] } | Uint8Array): string {
  const fullText = extractPlainTextFromYjs(yjsUpdate);
  if (fullText.length <= 200) {
    return fullText;
  }
  return fullText.substring(0, 200) + '...';
}

/**
 * Detect whether a Yjs document contains task list/items
 * Looks for TipTap/ProseMirror task list markers in the XML content
 */
export function hasTasksInYjs(yjsUpdate: string | { type: 'Buffer'; data: number[] } | Uint8Array): boolean {
  try {
    if (!yjsUpdate) return false;

    const ydoc = new Y.Doc();
    let update: Uint8Array | null = null;

    if (typeof yjsUpdate === 'object' && 'type' in yjsUpdate && yjsUpdate.type === 'Buffer' && 'data' in yjsUpdate && Array.isArray(yjsUpdate.data)) {
      update = new Uint8Array(yjsUpdate.data);
    } else if (typeof yjsUpdate === 'string') {
      if (!/^[A-Za-z0-9+/]*={0,2}$/.test(yjsUpdate)) return false;
      try {
        update = Uint8Array.from(atob(yjsUpdate), c => c.charCodeAt(0));
      } catch {
        return false;
      }
    } else if (yjsUpdate instanceof Uint8Array) {
      update = yjsUpdate;
    }

    if (!update) return false;
    Y.applyUpdate(ydoc, update);

    // Search for task list patterns in all XML fragments
    const taskPatterns = [
      'data-type="taskList"',
      'data-type="taskItem"',
      /\bdata-checked=\"(true|false)\"/,
      /<ul[^>]*data-type=\"taskList\"/i,
      /<li[^>]*data-type=\"taskItem\"/i,
      /<li[^>]*data-checked=/i
    ];

    // Check default XML fragment first
    try {
      const yXml = ydoc.getXmlFragment('default');
      const xmlContent = yXml.toString();
      if (xmlContent && xmlContent.trim()) {
        for (const pattern of taskPatterns) {
          if (typeof pattern === 'string') {
            if (xmlContent.includes(pattern)) return true;
          } else {
            if (pattern.test(xmlContent)) return true;
          }
        }
      }
    } catch { }

    // Check all other XML fragments
    for (const [, sharedType] of (ydoc.share as unknown as Map<string, any>).entries()) {
      if (sharedType instanceof Y.XmlFragment) {
        const xml = sharedType.toString();
        for (const pattern of taskPatterns) {
          if (typeof pattern === 'string') {
            if (xml.includes(pattern)) return true;
          } else {
            if (pattern.test(xml)) return true;
          }
        }
      }
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Extract tasks from a Yjs document and convert them to Task format
 * @param yjsUpdate - Base64 encoded Yjs update or Buffer object
 * @param noteId - The note ID these tasks belong to
 * @returns Array of task objects ready for Task collection (CANONICAL SCHEMA)
 */
export function extractTasksFromYjs(
  yjsUpdate: string | { type: 'Buffer'; data: number[] } | Uint8Array,
  noteId: string
): Array<{
  taskId?: string;
  title: string;  // ✅ CANONICAL
  status: 'pending' | 'completed' | 'canceled';  // ✅ CANONICAL
  dueDateWall?: string;
  dueDateUTC?: string;
  isFloating: boolean;  // ✅ CANONICAL
  priority: 'low' | 'medium' | 'high' | 'critical';
  description?: string;
  isRecurring: boolean;
  recurrenceRule?: string;
  recurringPattern?: 'daily' | 'weekly' | 'monthly' | 'yearly';
  reminder?: string;
  noteId: string;
  completionHistory?: Array<{ completedAt: string; dueDate: string }>;
  position: number;
  timeZone?: string;
}> {
  try {
    if (!yjsUpdate || !noteId) return [];

    const ydoc = new Y.Doc();
    let update: Uint8Array | null = null;

    if (typeof yjsUpdate === 'object' && 'type' in yjsUpdate && yjsUpdate.type === 'Buffer' && 'data' in yjsUpdate && Array.isArray(yjsUpdate.data)) {
      update = new Uint8Array(yjsUpdate.data);
    } else if (typeof yjsUpdate === 'string') {
      if (!/^[A-Za-z0-9+/]*={0,2}$/.test(yjsUpdate)) return [];
      try {
        update = Uint8Array.from(atob(yjsUpdate), c => c.charCodeAt(0));
      } catch {
        return [];
      }
    } else if (yjsUpdate instanceof Uint8Array) {
      update = yjsUpdate;
    }

    if (!update) return [];
    Y.applyUpdate(ydoc, update);

    // ✅ CANONICAL: Use the shared extraction logic which returns canonical schema
    return extractTasksFromYjsDoc(ydoc, noteId);
  } catch (error) {
    console.error('Error extracting tasks from Yjs update:', error);
    return [];
  }
}

/**
 * Extract tasks directly from a Yjs document object (shared implementation)
 */
/**
 * Extract tasks directly from ProseMirror JSON (from editor.getJSON())
 * This is the most reliable method as it uses the editor's current state
 */
// Update the return type interface (implicit in the function signature, but let's make it explicit in the implementation)

export function extractTasksFromProseMirrorJSON(
  prosemirrorJSON: any,
  noteId: string
): Array<{
  taskId?: string;
  title: string;  // ✅ CANONICAL: Use 'title' not 'text'
  status: 'pending' | 'completed' | 'canceled';  // ✅ CANONICAL: Use status enum
  dueDateWall?: string;
  dueDateUTC?: string;
  isFloating: boolean;  // ✅ CANONICAL: Calculated from dueDateWall
  priority: 'low' | 'medium' | 'high' | 'critical';
  description?: string;
  isRecurring: boolean;
  recurrenceRule?: string;
  recurringPattern?: 'daily' | 'weekly' | 'monthly' | 'yearly';
  reminder?: string;
  noteId: string;
  completionHistory?: Array<{ completedAt: string; dueDate: string }>;
  position: number;
  timeZone?: string;
}> {
  console.log('[TASK EXTRACT JSON] Starting extraction from ProseMirror JSON for noteId:', noteId);
  if (!prosemirrorJSON || !noteId) {
    console.log('[TASK EXTRACT JSON] Missing prosemirrorJSON or noteId');
    return [];
  }

  const tasks: Array<any> = [];
  let globalPosition = 0;

  // Recursively extract tasks from ProseMirror JSON
  const extractTasksFromNode = (node: any): void => {
    if (!node || typeof node !== 'object') return;

    // Check if this is a taskList node
    if (node.type === 'taskList' && Array.isArray(node.content)) {
      // console.log(`[TASK EXTRACT JSON] Found taskList with ${node.content.length} items`);
      node.content.forEach((taskItem: any) => {
        if (taskItem.type === 'taskItem') {
          // Extract text from task item
          let text = '';
          if (Array.isArray(taskItem.content)) {
            taskItem.content.forEach((para: any) => {
              if (para.type === 'paragraph' && Array.isArray(para.content)) {
                para.content.forEach((textNode: any) => {
                  if (textNode.type === 'text' && textNode.text) {
                    text += textNode.text;
                  }
                });
              }
            });
          }

          text = text.trim();

          if (text) {
            // Extract attributes from taskItem
            const attrs = taskItem.attrs || {};
            const dueDate = attrs.dueDateWall || attrs.dueDate || undefined;

            // ✅ CANONICAL: Determine status from checked attribute
            const isChecked = attrs.checked === true || attrs.checked === 'true';
            const status: 'pending' | 'completed' | 'canceled' =
              attrs.snapshotStatus === 'completed' || isChecked ? 'completed' : 'pending';

            // ✅ CANONICAL: Calculate isFloating from due date existence
            const isFloating = !dueDate;

            tasks.push({
              taskId: attrs.taskId || attrs.id || undefined,
              title: text,  // ✅ CANONICAL: Use 'title' not 'text'
              status,  // ✅ CANONICAL: Use status enum
              dueDateWall: dueDate,
              isFloating,  // ✅ CANONICAL: Calculated properly
              priority: (attrs.priority || 'medium') as 'low' | 'medium' | 'high' | 'critical',
              description: attrs.description,

              // Recurrence
              isRecurring: attrs.isRecurring === true || attrs.isRecurring === 'true' || (!!attrs.recurrenceRule && attrs.recurrenceRule !== 'null'),
              recurrenceRule: (attrs.recurrenceRule && attrs.recurrenceRule !== 'null') ? attrs.recurrenceRule : undefined,
              recurringPattern: (attrs.recurringPattern && attrs.recurringPattern !== 'null') ? attrs.recurringPattern : (attrs.recurrenceRule && attrs.recurrenceRule !== 'null' ? (attrs.recurrenceRule.includes('DAILY') ? 'daily' : attrs.recurrenceRule.includes('WEEKLY') ? 'weekly' : attrs.recurrenceRule.includes('MONTHLY') ? 'monthly' : attrs.recurrenceRule.includes('YEARLY') ? 'yearly' : undefined) : undefined),

              reminder: attrs.reminder || undefined,
              noteId,
              completionHistory: attrs.completionHistory || [],
              position: globalPosition++,

              // Extra metadata
              timeZone: attrs.timeZone || undefined
            });
            console.log(`[TASK EXTRACT JSON] Extracted task: "${text}", status: ${status}, isFloating: ${isFloating}, dueDate: ${dueDate}`);
          }
        }
      });
    }

    // Recursively check content array
    if (Array.isArray(node.content)) {
      node.content.forEach((child: any) => {
        extractTasksFromNode(child);
      });
    }
  };

  // Process the ProseMirror JSON document
  if (Array.isArray(prosemirrorJSON)) {
    prosemirrorJSON.forEach((node: any) => {
      extractTasksFromNode(node);
    });
  } else if (prosemirrorJSON && typeof prosemirrorJSON === 'object') {
    extractTasksFromNode(prosemirrorJSON);
  }

  console.log('[TASK EXTRACT JSON] Total tasks extracted:', tasks.length, 'for noteId:', noteId);
  return tasks;
}

export function extractTasksFromYjsDoc(
  ydoc: Y.Doc,
  noteId: string
): Array<{
  taskId?: string;
  title: string;  // ✅ CANONICAL
  status: 'pending' | 'completed' | 'canceled';  // ✅ CANONICAL
  dueDateWall?: string;
  isFloating: boolean;  // ✅ CANONICAL
  priority: 'low' | 'medium' | 'high' | 'critical';
  description?: string;
  isRecurring: boolean;
  recurrenceRule?: string;
  recurringPattern?: 'daily' | 'weekly' | 'monthly' | 'yearly';
  reminder?: string;
  noteId: string;
  completionHistory?: Array<{ completedAt: string; dueDate: string }>;
  position: number;
  timeZone?: string;
}> {
  try {
    if (!ydoc || !noteId) {
      return [];
    }

    // Use y-prosemirror's yDocToProsemirrorJSON to properly convert Yjs to ProseMirror JSON
    // ✅ CANONICAL: This delegates to extractTasksFromProseMirrorJSON which returns canonical schema
    try {
      const prosemirrorJSON = yDocToProsemirrorJSON(ydoc, 'prosemirror');
      return extractTasksFromProseMirrorJSON(prosemirrorJSON, noteId);
    } catch (error) {
      console.error('[TASK EXTRACT] Error converting Yjs to ProseMirror JSON:', error);
      return [];
    }
  } catch (error) {
    console.error('[TASK EXTRACT] Error extracting tasks from Yjs document:', error);
    return [];
  }
}
