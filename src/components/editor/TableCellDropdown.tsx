import { Editor } from '@tiptap/react';
import { Trash2, Plus, Minus, Grid3X3 } from 'lucide-react';

const COLORS = [
  '#DD5E5E', // warm red
  '#5EDD8E', // mint green
  '#5E8EDD', // soft blue
  '#DDC85E', // warm ochre
  '#8E5EDD', // purple
  '#DD5EDD', // pink-magenta
  '#5EDDDD', // aqua
  '#C3DD5E', // chartreuse
  '#DD8E5E', // terra orange
  '#5EDD5E', // bright green
  '#FFA500', // orange
  '#00AACC', // teal
  '#CC5500', // magenta
  '#008877', // lime
  '#8844CC', // cyan
  '#DD9900', // red
  '#0000FF', // blue
  '#000000', // black
];

interface TableCellDropdownProps {
  editor: Editor;
  nodeType: 'tableCell' | 'tableHeader';
  cellPosition?: number | null;
}

export const TableCellDropdown: React.FC<TableCellDropdownProps> = ({ editor, nodeType, cellPosition }) => {
  const selectCurrentCell = () => {
    const { view } = editor;
    
    // If we have a specific cell position, select that cell
    if (cellPosition !== null && cellPosition !== undefined) {
      console.log('[DEBUG] Selecting cell at position:', cellPosition);
      try {
        // Set selection to the specific cell
        const tr = view.state.tr.setSelection(
          view.state.selection.constructor.near(view.state.doc.resolve(cellPosition))
        );
        view.dispatch(tr);
        view.focus();
        return;
      } catch (error) {
        console.log('[DEBUG] Error selecting specific cell:', error);
      }
    }
    
    // Fallback to generic focus
    if (!view.hasFocus()) {
      view.focus();
    }
  };

  const addRowAbove = () => {
    selectCurrentCell();
    // Get current table structure to determine if this should be a header
    const { state } = editor;
    const { selection } = state;
    const $pos = selection.$from;
    
    // Find the table node
    for (let d = $pos.depth; d > 0; d--) {
      const node = $pos.node(d);
      if (node.type.name === 'table') {
        // Check if this is the first row (index 0)
        const rowIndex = $pos.index(d);
        if (rowIndex === 0) {
          // Adding above the first row - make it a header row
          editor.chain().focus().addRowBefore().run();
          // Convert the new row to header cells
          setTimeout(() => {
            const newState = editor.state;
            const newSelection = newState.selection;
            const newPos = newSelection.$from;
            
            // Find the table again in the new state
            for (let d2 = newPos.depth; d2 > 0; d2--) {
              const tableNode = newPos.node(d2);
              if (tableNode.type.name === 'table') {
                // Get the first row (which should be the newly added row)
                const firstRow = tableNode.firstChild;
                if (firstRow) {
                  // Convert each cell in the first row to header
                  let cellPos = newPos.before(d2) + 1; // Start of first row
                  firstRow.forEach((cell, index) => {
                    if (cell.type.name === 'tableCell') {
                      // Select the cell and convert to header
                      editor.chain().focus().setNodeSelection(cellPos).run();
                      editor.chain().focus().setNode('tableHeader').run();
                    }
                    cellPos += cell.nodeSize;
                  });
                }
                break;
              }
            }
          }, 50);
        } else {
          // Adding above a non-first row - make it a body row
          editor.chain().focus().addRowBefore().run();
        }
        break;
      }
    }
  };

  const addRowBelow = () => {
    selectCurrentCell();
    // Get current table structure to determine if this should be a header
    const { state } = editor;
    const { selection } = state;
    const $pos = selection.$from;
    
    // Find the table node
    for (let d = $pos.depth; d > 0; d--) {
      const node = $pos.node(d);
      if (node.type.name === 'table') {
        // Check if this is the first row (index 0)
        const rowIndex = $pos.index(d);
        if (rowIndex === 0) {
          // Adding below the first row - make it a body row
          editor.chain().focus().addRowAfter().run();
        } else {
          // Adding below a non-first row - make it a body row
          editor.chain().focus().addRowAfter().run();
        }
        break;
      }
    }
  };

  const deleteRow = () => {
    selectCurrentCell();
    editor.chain().focus().deleteRow().run();
  };

  const addColumnBefore = () => {
    selectCurrentCell();
    // Get current table structure to determine if this should be a header
    const { state } = editor;
    const { selection } = state;
    const $pos = selection.$from;
    
    // Find the table node
    for (let d = $pos.depth; d > 0; d--) {
      const node = $pos.node(d);
      if (node.type.name === 'table') {
        // Check if this is the first column
        const table = $pos.node(d);
        const firstRow = table.firstChild;
        if (firstRow) {
          const cellIndex = $pos.index(d + 1); // Index within the row
          if (cellIndex === 0) {
            // Adding before the first column - make it a header column
            editor.chain().focus().addColumnBefore().run();
            // Convert the new column to header cells
            setTimeout(() => {
              const newState = editor.state;
              const newSelection = newState.selection;
              const newPos = newSelection.$from;
              
              // Find the table again in the new state
              for (let d2 = newPos.depth; d2 > 0; d2--) {
                const tableNode = newPos.node(d2);
                if (tableNode.type.name === 'table') {
                  // Convert first cell of each row to header
                  let rowPos = newPos.before(d2) + 1; // Start of first row
                  tableNode.forEach((row, rowIndex) => {
                    const firstCell = row.firstChild;
                    if (firstCell && firstCell.type.name === 'tableCell') {
                      // Select the first cell of this row and convert to header
                      editor.chain().focus().setNodeSelection(rowPos).run();
                      editor.chain().focus().setNode('tableHeader').run();
                    }
                    rowPos += row.nodeSize;
                  });
                }
                break;
              }
            }, 50);
          } else {
            // Adding before a non-first column - make it a body column
            editor.chain().focus().addColumnBefore().run();
          }
        }
        break;
      }
    }
  };

  const addColumnAfter = () => {
    selectCurrentCell();
    // Get current table structure to determine if this should be a header
    const { state } = editor;
    const { selection } = state;
    const $pos = selection.$from;
    
    // Find the table node
    for (let d = $pos.depth; d > 0; d--) {
      const node = $pos.node(d);
      if (node.type.name === 'table') {
        // Check if this is the first column
        const table = $pos.node(d);
        const firstRow = table.firstChild;
        if (firstRow) {
          const cellIndex = $pos.index(d + 1); // Index within the row
          if (cellIndex === 0) {
            // Adding after the first column - make it a body column
            editor.chain().focus().addColumnAfter().run();
          } else {
            // Adding after a non-first column - make it a body column
            editor.chain().focus().addColumnAfter().run();
          }
        }
        break;
      }
    }
  };

  const deleteColumn = () => {
    selectCurrentCell();
    editor.chain().focus().deleteColumn().run();
  };

  const deleteTable = () => {
    selectCurrentCell();
    editor.chain().focus().deleteTable().run();
  };

  return (
    <div
      className="bg-white text-gray-900 border border-gray-200 rounded-lg shadow-xl min-w-[200px] p-2"
      style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}
    >
      {/* Table Operations Section */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div className="text-gray-900 text-[13px] font-semibold mb-1 flex items-center gap-1.5">
          <Grid3X3 size={14} />
          Table Operations
        </div>
        
        {/* Row Operations */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <div className="text-gray-500 text-[11px] font-medium">Rows</div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              onClick={addRowAbove}
              className="bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded px-2 py-1 text-[11px] flex items-center gap-1 transition-colors"
            >
              <Plus size={12} />
              Add Above
            </button>
            <button
              onClick={addRowBelow}
              className="bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded px-2 py-1 text-[11px] flex items-center gap-1 transition-colors"
            >
              <Plus size={12} />
              Add Below
            </button>
            <button
              onClick={deleteRow}
              className="bg-white hover:bg-gray-100 border border-red-300 text-red-600 rounded px-2 py-1 text-[11px] flex items-center gap-1 transition-colors"
            >
              <Minus size={12} />
              Delete
            </button>
          </div>
        </div>

        {/* Column Operations */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <div className="text-gray-500 text-[11px] font-medium">Columns</div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              onClick={addColumnBefore}
              className="bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded px-2 py-1 text-[11px] flex items-center gap-1 transition-colors"
            >
              <Plus size={12} />
              Add Left
            </button>
            <button
              onClick={addColumnAfter}
              className="bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded px-2 py-1 text-[11px] flex items-center gap-1 transition-colors"
            >
              <Plus size={12} />
              Add Right
            </button>
            <button
              onClick={deleteColumn}
              className="bg-white hover:bg-gray-100 border border-red-300 text-red-600 rounded px-2 py-1 text-[11px] flex items-center gap-1 transition-colors"
            >
              <Minus size={12} />
              Delete
            </button>
          </div>
        </div>

        {/* Delete Table */}
        <div className="border-t border-gray-200 pt-2 mt-1.5">
          <button
            onClick={deleteTable}
            className="bg-white hover:bg-gray-100 border border-red-300 text-red-600 rounded px-2 py-1 text-[11px] flex items-center gap-1 transition-colors w-full justify-center"
          >
            <Trash2 size={14} />
            Delete Table
          </button>
        </div>
      </div>

      {/* Color Palette Section */}
      <div className="border-t border-gray-200 pt-3 flex flex-col gap-2.5">
        <div className="text-gray-900 text-[13px] font-semibold mb-1">
          Cell Background
        </div>
        <div className="mb-1.5">
          <button
            className="flex items-center gap-1 w-full px-1.5 py-1 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white text-xs hover:bg-gray-50"
            title="Auto (theme)"
            onClick={e => {
              e.stopPropagation();
              e.preventDefault();
              console.log('[DEBUG] Removing background color for nodeType:', nodeType);
              selectCurrentCell();
              
              // Add a small delay to ensure cell is selected
              setTimeout(() => {
                console.log('[DEBUG] Removing background color, current selection:', editor.state.selection);
                
                // The collaborative extensions still use the same node type names
                const result = editor.chain().focus().updateAttributes(nodeType, { backgroundColor: null }).run();
                console.log('[DEBUG] Remove color result:', result);
                
                // Force a state update to ensure collaboration sync
                if (result) {
                  console.log('[DEBUG] Forcing editor update for collaboration');
                  editor.commands.focus();
                }
              }, 50);
            }}
          >
            <span className="w-4 h-4 rounded-full border border-[#888] flex items-center justify-center bg-gradient-to-br from-[#fff] to-[#eee] relative">
              <span style={{ position: 'absolute', width: '100%', height: 2, background: '#888', transform: 'rotate(-45deg)', top: '50%', left: 0, marginTop: -1 }} />
            </span>
            <span>Auto</span>
          </button>
        </div>
        <div className="grid grid-cols-9 gap-1.5 py-1.5">
        {COLORS.map(color => (
            <div
            key={color}
              className="w-[22px] h-[22px] rounded-full border-2 border-gray-400 cursor-pointer transition-transform grid place-items-center"
              style={{ backgroundColor: color }}
              onClick={e => {
              e.stopPropagation();
              e.preventDefault();
              console.log('[DEBUG] Applying color:', color, 'to nodeType:', nodeType);
              selectCurrentCell();
              
              // Add a small delay to ensure cell is selected
              setTimeout(() => {
                console.log('[DEBUG] Current editor state selection:', editor.state.selection);
                console.log('[DEBUG] Applying to nodeType:', nodeType);
                
                // The collaborative extensions still use the same node type names
                const result = editor.chain().focus().updateAttributes(nodeType, { backgroundColor: color }).run();
                console.log('[DEBUG] Color application result:', result);
                
                // Check if the attribute was actually set
                setTimeout(() => {
                  const { selection } = editor.state;
                  const $pos = selection.$from;
                  for (let d = $pos.depth; d > 0; d--) {
                    const node = $pos.node(d);
                    if (node.type.name === nodeType) {
                      console.log('[DEBUG] Node attributes after update:', node.attrs);
                      break;
                    }
                  }
                }, 100);
                
                // Force a state update to ensure collaboration sync
                if (result) {
                  console.log('[DEBUG] Forcing editor update for collaboration');
                  editor.commands.focus();
                }
              }, 50);
            }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.transform = 'scale(1.15)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.transform = 'scale(1)'; }}
          />
        ))}
        </div>
      </div>
    </div>
  );
}; 