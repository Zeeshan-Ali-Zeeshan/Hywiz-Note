import * as Y from 'yjs';

/**
 * Extract plain text content from a Yjs document
 * @param {string} yjsUpdate - Base64 encoded Yjs update
 * @returns {string} - Plain text content
 */
export function extractPlainTextFromYjs(yjsUpdate) {
  try {
    if (!yjsUpdate) {
      return '';
    }

    // Create a new Yjs document
    const ydoc = new Y.Doc();
    
    // Apply the update to the document
    const update = Uint8Array.from(atob(yjsUpdate), c => c.charCodeAt(0));
    Y.applyUpdate(ydoc, update);

    // Get the text content from the 'content' shared type
    const content = ydoc.getText('content');
    const title = ydoc.getText('title');

    // Combine title and content
    const titleText = title.toString().trim();
    const contentText = content.toString().trim();
    
    // Return combined text, prioritizing content over title
    if (contentText) {
      return titleText ? `${titleText}\n\n${contentText}` : contentText;
    } else {
      return titleText || '';
    }
  } catch (error) {
    console.error('Error extracting plain text from Yjs:', error);
    return '';
  }
}

/**
 * Extract plain text content from a Yjs document for templates
 * @param {string} yjsUpdate - Base64 encoded Yjs update
 * @returns {string} - Plain text content
 */
export function extractPlainTextFromTemplateYjs(yjsUpdate) {
  try {
    if (!yjsUpdate) {
      return '';
    }

    // Create a new Yjs document
    const ydoc = new Y.Doc();
    
    // Apply the update to the document
    const update = Uint8Array.from(atob(yjsUpdate), c => c.charCodeAt(0));
    Y.applyUpdate(ydoc, update);

    // Get the text content from the 'content' shared type
    const content = ydoc.getText('content');
    const title = ydoc.getText('title');

    // Combine title and content
    const titleText = title.toString().trim();
    const contentText = content.toString().trim();
    
    // Return combined text, prioritizing content over title
    if (contentText) {
      return titleText ? `${titleText}\n\n${contentText}` : contentText;
    } else {
      return titleText || '';
    }
  } catch (error) {
    console.error('Error extracting plain text from template Yjs:', error);
    return '';
  }
} 