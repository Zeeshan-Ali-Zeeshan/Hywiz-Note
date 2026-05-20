/**
 * Utility function to combine class names
 * @param inputs - Class names to combine
 * @returns string - Combined class names
 */
export const cn = (...inputs: (string | undefined | null | boolean)[]): string => {
  return inputs
    .filter(Boolean)
    .join(' ')
    .trim();
};

/**
 * Copy text to clipboard
 * @param text - The text to copy
 * @returns Promise<boolean> - True if successful, false otherwise
 */
export const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    return false;
  }
};

/**
 * Generate a share link for a note
 * @param noteId - The note ID
 * @returns string - The share link
 */
export const generateShareLink = (noteId: string): string => {
  return `${window.location.origin}/note/${noteId}`;
};

/**
 * Show a toast notification
 * @param message - The message to show
 * @param type - The type of notification
 */
export const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
  // This would integrate with a toast library like react-hot-toast
  console.log(`[${type.toUpperCase()}] ${message}`);
}; 