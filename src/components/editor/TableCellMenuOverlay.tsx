import { useEffect, useState, useRef } from 'react';
import { TableCellDropdown } from './TableCellDropdown';
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';

// Create a proper Tiptap extension for inline table buttons
export const InlineTableButton = Extension.create({
  name: 'inlineTableButton',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('inlineTableButton'),
        props: {
          decorations: (state) => {
      const { selection } = state;
            const decorations = [];
      
            // Check if we're in a table cell
      const $pos = selection.$from;
      for (let d = $pos.depth; d > 0; d--) {
        const node = $pos.node(d);
        if (node.type.name === 'tableCell' || node.type.name === 'tableHeader') {
                // console.log('[DEBUG] Creating inline button for table cell:', node.type.name);
                const end = $pos.end(d);
                
                // Add decoration that positions button in right-center of cell
                decorations.push(
                  Decoration.widget(end - 1, () => {
                    const button = document.createElement('span');
                    button.className = 'inline-table-button';
                    button.innerHTML = '▼'; // Simple down arrow text for testing
                    button.style.fontSize = '12px';
                    
                    // Position button in right-center of cell
                    Object.assign(button.style, {
                      position: 'absolute',
                      top: '50%',
                      right: '8px',
                      transform: 'translateY(-50%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '18px',
                      height: '18px',
                      borderRadius: '4px',
                      background: '#ef4444', // Bright red for testing
                      border: '1px solid #dc2626',
                      cursor: 'pointer',
                      color: '#ffffff', // White icon
                      transition: 'all 0.2s ease',
                      userSelect: 'none',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
                      zIndex: '10',
                    });
                    
                    // Make the parent cell position relative
                    const cell = button.closest('td, th') as HTMLElement;
                    if (cell) {
                      cell.style.position = 'relative';
                    }
                    
                    // Hover effects
                    button.addEventListener('mouseenter', () => {
                      button.style.background = '#dc2626'; // Darker red on hover
                      button.style.transform = 'translateY(-50%) scale(1.1)';
                      button.style.boxShadow = '0 2px 6px rgba(0,0,0,0.2)';
                    });
                    
                    button.addEventListener('mouseleave', () => {
                      button.style.background = '#ef4444'; // Original red
                      button.style.transform = 'translateY(-50%) scale(1)';
                      button.style.boxShadow = '0 1px 3px rgba(0,0,0,0.12)';
                    });
                    
                    // Click handler - trigger custom event on document
                    button.addEventListener('click', (e) => {
                      e.stopPropagation();
                      console.log('[DEBUG] Button clicked, dispatching event');
                      
                      // Get the actual cell DOM element
                      const cellElement = button.closest('td, th') as HTMLElement;
                      
                      const customEvent = new CustomEvent('tableButtonClick', {
                        detail: { 
                          cellNode: node, 
                          cellType: node.type.name,
                          buttonElement: button,
                          cellElement: cellElement,
                          cellPosition: $pos.pos // Store cursor position for proper selection
                        },
                        bubbles: true
                      });
                      document.dispatchEvent(customEvent);
                    });
                    
                    return button;
                  }, { side: 1 })
                );
              break;
              }
            }
            
            return DecorationSet.create(state.doc, decorations);
          }
        }
      })
    ];
  }
});

export function TableCellMenuOverlay({ editor }: { editor: any }) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const [activeCellType, setActiveCellType] = useState<'tableCell' | 'tableHeader'>('tableCell');
  const [activeCellPos, setActiveCellPos] = useState<number | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!editor) return;

    // Listen for table button clicks
    const handleTableButtonClick = (event: any) => {
      console.log('[DEBUG] Event received:', event.detail);
      const { cellType, buttonElement, cellElement, cellPosition } = event.detail;
      setActiveCellType(cellType === 'tableHeader' ? 'tableHeader' : 'tableCell');
      setActiveCellPos(cellPosition);
      
      // Store cell element in a way we can access it later
      if (cellElement) {
        cellElement.setAttribute('data-active-cell', 'true');
      }
      
      // Position dropdown relative to the clicked button
      const buttonRect = buttonElement.getBoundingClientRect();
      const DROPDOWN_WIDTH = 280;
      const DROPDOWN_HEIGHT = 320;
      
      let top = buttonRect.bottom + 4;
      let left = buttonRect.left;
      
      // Adjust if dropdown would go off screen
      if (left + DROPDOWN_WIDTH > window.innerWidth) {
        left = window.innerWidth - DROPDOWN_WIDTH - 8;
      }
      
      if (top + DROPDOWN_HEIGHT > window.innerHeight) {
        top = buttonRect.top - DROPDOWN_HEIGHT - 4;
      }
      
      setDropdownPosition({ top, left });
      setShowDropdown(true);
    };

    // Handle click outside to close dropdown
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      
      // Don't close if clicking on the dropdown itself or table button
      if (dropdownRef.current && dropdownRef.current.contains(target)) {
        return;
      }
      
      if (target.closest('.inline-table-button')) {
        return;
      }
      
      // Close dropdown when clicking outside
      setShowDropdown(false);
    };

    // Handle ESC key to close dropdown
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && showDropdown) {
        setShowDropdown(false);
      }
    };

    // Add event listeners
    document.addEventListener('tableButtonClick', handleTableButtonClick);
    document.addEventListener('click', handleClickOutside, true); // Use capture phase
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('tableButtonClick', handleTableButtonClick);
      document.removeEventListener('click', handleClickOutside, true);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [editor, showDropdown]);

  return (
    <>
      {/* Only render dropdown when needed */}
      {showDropdown && (
        <div
          ref={dropdownRef}
          style={{
            position: 'fixed',
            top: dropdownPosition.top,
            left: dropdownPosition.left,
            zIndex: 1002,
          }}
        >
          <TableCellDropdown 
            editor={editor} 
            nodeType={activeCellType}
            cellPosition={activeCellPos}
          />
        </div>
      )}
    </>
  );
} 