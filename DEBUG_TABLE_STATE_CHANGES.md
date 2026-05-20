# 🔍 Debugging Table State Changes

## **How to Identify What's Causing the State Changes**

### 1. **Open Browser DevTools**
```
Press F12 or right-click → "Inspect"
```

### 2. **Go to Console Tab**
Look for these debug messages:

#### **Render Debugging**
- `[RENDER DEBUG] RichTextEditor re-rendered #X` - Shows when component re-renders
- `[STATE DEBUG] Dependencies changed, updating editorKey` - Shows when editor key changes

#### **Scroll Debugging**
- `[SCROLL DEBUG] Preserving scroll positions for X table(s)` - When scroll positions are saved
- `[SCROLL DEBUG] Restoring scroll positions for X table(s)` - When scroll positions are restored
- `[MUTATION DEBUG] Table wrapper DOM changes detected` - When DOM changes affect tables

#### **Yjs Debugging**
- `[YJS DEBUG] Yjs update detected` - When collaborative editing updates occur
- `[SAVE DEBUG] Debounced save triggered` - When auto-save is triggered

### 3. **Monitor DOM Changes in Elements Tab**
1. Go to **Elements** tab in DevTools
2. Find a table wrapper div (class="tableWrapper")
3. Right-click → "Break on" → "Subtree modifications"
4. This will pause execution when the DOM changes

### 4. **Use React DevTools**
1. Install React DevTools extension
2. Go to **Components** tab
3. Look for frequent re-renders of `RichTextEditor`
4. Check what props are changing

## **Common Causes of State Changes**

### **High-Frequency Re-renders**
```
[RENDER DEBUG] RichTextEditor re-rendered #50
timeSinceLastRender: "100ms"  ← Too frequent!
```

**Solutions:**
- Check if parent component is re-rendering unnecessarily
- Look for missing dependencies in useEffect
- Check for object/array recreation in props

### **Yjs Collaboration Updates**
```
[YJS DEBUG] Yjs update detected, checking for table wrappers
[YJS DEBUG] Yjs update event fired
```

**Solutions:**
- Reduce collaboration update frequency
- Debounce Yjs updates
- Batch multiple updates together

### **Editor Key Changes**
```
[STATE DEBUG] Dependencies changed, updating editorKey
noteId: "123"
ydoc: true
provider: true
```

**Solutions:**
- Stabilize ydoc and provider references
- Use useRef for stable references
- Check if noteId is changing unnecessarily

### **DOM Mutations**
```
[MUTATION DEBUG] Table wrapper style changed
[MUTATION DEBUG] Table wrapper added/modified
```

**Solutions:**
- Check for CSS animations or transitions
- Look for JavaScript modifying table styles
- Check for TipTap/ProseMirror internal updates

## **Quick Debugging Steps**

### **Step 1: Check Console for Patterns**
```javascript
// Look for patterns like:
// - Re-renders every X milliseconds
// - Yjs updates every X seconds
// - DOM mutations during specific actions
```

### **Step 2: Monitor Specific Actions**
1. **Scroll the table** → Look for scroll debug messages
2. **Type in table cells** → Look for Yjs update messages
3. **Switch between notes** → Look for state change messages
4. **Collaborate with others** → Look for frequent Yjs updates

### **Step 3: Check Performance**
1. Go to **Performance** tab in DevTools
2. Start recording
3. Perform the problematic action
4. Stop recording and analyze the timeline

### **Step 4: Check Network Tab**
1. Go to **Network** tab
2. Look for frequent API calls
3. Check if backend is triggering updates

## **Immediate Fixes to Try**

### **1. Stabilize References**
```typescript
// Use useRef to prevent object recreation
const stableYdoc = useRef(ydoc);
const stableProvider = useRef(provider);
```

### **2. Debounce Updates**
```typescript
// Increase debounce time for Yjs saves
const debouncedSave = useRef(debounce(handler, 10000)); // 10 seconds
```

### **3. Batch Updates**
```typescript
// Batch multiple Yjs updates together
const batchUpdate = () => {
  // Collect all changes
  // Apply them at once
};
```

### **4. Reduce Re-render Frequency**
```typescript
// Use React.memo to prevent unnecessary re-renders
const RichTextEditor = React.memo(({ ... }) => {
  // Component logic
});
```

## **What to Look For**

### **Red Flags:**
- ✅ Re-renders every < 100ms
- ✅ Yjs updates every < 1 second
- ✅ DOM mutations during idle time
- ✅ Frequent API calls
- ✅ Memory leaks (increasing render count)

### **Normal Behavior:**
- ✅ Re-renders only when props change
- ✅ Yjs updates only when editing
- ✅ DOM changes only when needed
- ✅ Stable scroll positions

## **Next Steps**

1. **Run the app** with the enhanced debugging
2. **Check console** for the debug messages
3. **Identify the pattern** of state changes
4. **Share the console output** so I can help fix the specific issue

The enhanced debugging will show you exactly what's happening and when! 🕵️‍♂️
