# Phase 1 Code Validation Checklist - Function and Code Integrity

## When to Use

**MANDATORY for Phase 1 completion** - Verify all JavaScript functions exist and code is structurally sound.

## Critical Rule

⚠️ **All called functions must be defined and executable**

## Checklist Items

**Output and verify code validation checklist:**

```
📋 Phase 1 Code Validation Checklist - Function and Code Integrity:

[ ] Function definition validation (all called functions are defined and exist)
[ ] Async/await validation (all functions using await have async keyword)
[ ] Function scope validation (HTML onclick handlers are in global scope)
```

**Process and verify checklist item, then output verified checklist:**

```
📋 Phase 1 Code Validation Checklist - VERIFIED:

[✅/❌] Function definition validation (all called functions are defined and exist)
[✅/❌] Async/await validation (all functions using await have async keyword)
[✅/❌] Function scope validation (HTML onclick handlers are in global scope)
```

## Function Definition Validation

**MANDATORY verification for all JavaScript functions:**

**Function existence:**
- [ ] All called functions are defined in the same file or imported
- [ ] No undefined function calls (check browser console for "is not a function" errors)
- [ ] Function names are spelled correctly in both definition and calls
- [ ] Function definitions appear before their first call (unless hoisted)
- [ ] **MANDATORY:** Object method availability - verify methods exist on objects before calling (e.g., window.gameVariableState.timerElapsedTimes access, visibilityTracker.pause())
- [ ] **MANDATORY:** Component method validation - check that component methods are available after component initialization
- [ ] **MANDATORY:** Package method verification - ensure package methods exist after package loading completes

**Package function validation:**
- [ ] FeedbackManager functions (init, sound.play, etc.) exist after package loading
- [ ] TimerComponent methods are available after TimerComponent creation
- [ ] VisibilityTracker callbacks are properly defined
- [ ] Helpers package loaded (APIHelper, VisibilityTracker) via CDN

**Custom game functions:**
- [ ] setupGame() function is defined if called
- [ ] endGame() function exists if referenced
- [ ] Event handler functions are defined
- [ ] Callback functions passed to components exist

**Function accessibility from HTML (CRITICAL):**
- [ ] Functions called from HTML attributes (`onclick`, `onchange`, etc.) are defined in **global scope**
- [ ] Functions are NOT defined inside DOMContentLoaded or other closures if called from HTML
- [ ] Functions are defined BEFORE any code that might throw errors and stop execution
- [ ] No syntax errors that would prevent function definitions from being reached

**Verification process:**
- [ ] Search code for all function calls (grep for functionName\(\))
- [ ] Verify each called function has a corresponding function definition
- [ ] Check browser console for undefined function errors during gameplay
- [ ] Test all interactive elements to ensure their event handlers exist
- [ ] Verify package functions are called after packages are confirmed loaded
- [ ] Click all HTML buttons/elements to verify onclick handlers work

**Method availability validation:**
- [ ] **MANDATORY:** Check object property existence before accessing (e.g., `if (window.gameVariableState && window.gameVariableState.timerElapsedTimes)`)
- [ ] **MANDATORY:** Verify component methods exist after initialization (e.g., TimerComponent.pause, VisibilityTracker.onInactive)
- [ ] **MANDATORY:** Test package methods are callable after loading (e.g., FeedbackManager.sound.play, FeedbackManager.stream.pauseAll)
- [ ] **MANDATORY:** Validate object properties exist before method calls (e.g., check timer object is not null/undefined)
- [ ] **MANDATORY:** Confirm method signatures match expected parameters

## Code Structure Validation

**JavaScript syntax:**
- [ ] No syntax errors in browser console
- [ ] All brackets, parentheses, and braces are properly matched
- [ ] String literals are properly quoted
- [ ] Semicolons are correctly placed

**Async/await validation:**
- [ ] All functions using `await` have `async` keyword
- [ ] Event listener callbacks using `await` are declared as `async`
- [ ] DOMContentLoaded callback is `async` if it uses `await` (e.g., `await waitForPackages()`)
- [ ] No "await is only valid in async functions" errors

**Variable declarations:**
- [ ] All variables are declared before use (var, let, const)
- [ ] No undefined variable references
- [ ] Variable names are consistent and meaningful
- [ ] No variable name conflicts

**DOM manipulation:**
- [ ] All DOM queries (getElementById, querySelector) find existing elements
- [ ] Event listeners are attached to valid elements
- [ ] Element IDs/classes match HTML structure
- [ ] No null reference errors from DOM operations

**Component initialization sequence:**
- [ ] TimerComponent created AFTER #timer-container exists in DOM
- [ ] If using dynamic HTML (innerHTML), component creation happens AFTER DOM update
- [ ] Component initialization follows pattern: renderDOM() → new Component()
- [ ] No "Cannot find element" errors for component containers

**Package integration:**
- [ ] Package loading order is correct (FeedbackManager → Components → Helpers)
- [ ] waitForPackages() function properly checks all packages
- [ ] Package initialization happens in correct sequence
- [ ] No race conditions between package loading and usage

## Error Prevention

**Runtime error prevention:**
- [ ] Null/undefined checks before property access
- [ ] Array bounds checking before array access
- [ ] Type checking for function parameters
- [ ] Error handling for async operations

**Browser compatibility:**
- [ ] ES6+ features are transpiled if needed
- [ ] Browser API usage is supported in target browsers
- [ ] Fallbacks for optional features
- [ ] Progressive enhancement approach

## Anti-Patterns (DO NOT USE)

**Undefined function calls:**
```javascript
// ❌ WRONG - Function called before definition
setupGame();  // setupGame not defined yet

function setupGame() {
  // Function definition comes after call
}

// ❌ WRONG - Typo in function name
function calculateScore() {
  return 100;
}

// Later...
const score = calculateScor();  // Typo: "Scor" instead of "Score"
```

**Missing DOM elements:**
```javascript
// ❌ WRONG - Element doesn't exist
const button = document.getElementById('start-button');  // No element with this ID
button.addEventListener('click', startGame);  // TypeError: button is null
```

**Package loading issues:**
```javascript
// ❌ WRONG - Using packages before loading
window.addEventListener('DOMContentLoaded', () => {
  FeedbackManager.init();  // Packages might not be loaded yet
  const timer = new TimerComponent();  // Might fail
});
```

**Method availability errors (PREVENT THESE):**
```javascript
// ❌ WRONG - Method doesn't exist on object
const timer = new TimerComponent();
// Later in code...
const elapsed = window.gameVariableState.timerElapsedTimes;  // TypeError: Cannot read property 'timerElapsedTimes' of undefined

// ❌ WRONG - Object is null/undefined
let visibilityTracker = null;
// Later in code...
visibilityTracker.pause();  // TypeError: Cannot read properties of null

// ❌ WRONG - Component method not available
const feedback = FeedbackManager.sound;
feedback.play();  // TypeError: feedback.play is not a function

// ✅ CORRECT - Check property availability
if (window.gameVariableState && window.gameVariableState.timerElapsedTimes) {
  const elapsed = window.gameVariableState.timerElapsedTimes;
}

// ✅ CORRECT - Check object existence
if (visibilityTracker) {
  visibilityTracker.pause();
}

// ✅ CORRECT - Check package method availability
if (FeedbackManager.sound && typeof FeedbackManager.sound.play === 'function') {
  FeedbackManager.sound.play();
}
```

**Missing async keyword:**
```javascript
// ❌ WRONG - Using await without async
window.addEventListener('DOMContentLoaded', () => {
  await waitForPackages();  // ERROR: await is only valid in async functions
  await FeedbackManager.init();
});

// ✅ CORRECT - Add async keyword
window.addEventListener('DOMContentLoaded', async () => {  // Added async
  await waitForPackages();
  await FeedbackManager.init();
});

// ❌ WRONG - Function using await without async
function setupGame() {
  await FeedbackManager.init();  // ERROR: await needs async function
}

// ✅ CORRECT - Add async keyword
async function setupGame() {  // Added async
  await FeedbackManager.init();
}
```

**Function scope issues (HTML event handlers):**
```html
<!-- HTML button calling startGame() -->
<button onclick="startGame()">Start Game</button>

<script>
// ❌ WRONG - Function defined inside DOMContentLoaded (not accessible from HTML)
window.addEventListener('DOMContentLoaded', () => {
  function startGame() {  // NOT in global scope
    console.log('Game started');
  }
});
// ERROR: startGame is not defined (when button is clicked)

// ✅ CORRECT - Function defined in global scope
function startGame() {  // Global scope - accessible from HTML
  console.log('Game started');
}

window.addEventListener('DOMContentLoaded', () => {
  // Initialization code here
});
</script>
```

**Function definitions blocked by errors:**
```javascript
// ❌ WRONG - Error stops execution before function is defined
window.addEventListener('DOMContentLoaded', () => {
  await waitForPackages();  // ERROR: missing async keyword
  // Script execution stops here - functions below are never defined
});

function startGame() {  // Never reached - not defined
  console.log('Game started');
}

// ✅ CORRECT - Fix error so functions get defined
window.addEventListener('DOMContentLoaded', async () => {  // Added async
  await waitForPackages();  // No error
});

function startGame() {  // Successfully defined
  console.log('Game started');
}
```

## Verification Process

**Static code analysis:**
- [ ] Review all function definitions and calls
- [ ] Check variable declarations and usage
- [ ] Verify DOM element references
- [ ] Confirm package loading sequence
- [ ] **MANDATORY:** Analyze object property access (e.g., window.gameVariableState.timerElapsedTimes, visibilityTracker.pause())
- [ ] **MANDATORY:** Verify component method availability after initialization
- [ ] **MANDATORY:** Check package method existence patterns

**Runtime testing:**
- [ ] Open browser DevTools Console
- [ ] Play through complete game
- [ ] Check for JavaScript errors
- [ ] Verify all functions execute without errors
- [ ] Test all user interactions
- [ ] **MANDATORY:** Monitor for "is not a function" errors (e.g., timer.getElapsedTimes is not a function)
- [ ] **MANDATORY:** Check for null/undefined object method calls
- [ ] **MANDATORY:** Verify component methods are callable during gameplay

**Function testing:**
- [ ] Click all buttons and interactive elements
- [ ] Trigger all event handlers
- [ ] Test game flow from start to end
- [ ] Verify package functions work correctly

## Final Verification

**Function Testing:**
- [ ] Play through entire game manually
- [ ] Check browser console for "is not a function" errors
- [ ] Test all interactive elements (buttons, inputs, etc.)
- [ ] Verify package functions work after loading
- [ ] Confirm custom game functions execute without errors
- [ ] **MANDATORY:** Verify all object property access works (e.g., window.gameVariableState.timerElapsedTimes, visibilityTracker.pause())
- [ ] **MANDATORY:** Test component method availability during gameplay

**Code Structure Testing:**
- [ ] No JavaScript syntax errors in console
- [ ] All variables are properly declared
- [ ] DOM elements exist when referenced
- [ ] Package loading sequence is correct

**Checklist Completion:**
- [ ] Function definition validation completed (all functions exist and are callable)
- [ ] No undefined function errors in console
- [ ] Code structure is sound and error-free
- [ ] All interactive elements work correctly
- [ ] **MANDATORY:** Method availability validation passed (all object methods exist and are callable)
- [ ] **MANDATORY:** No "TypeError: X is not a function" errors during gameplay

## Reference

- Phase 1 workflow: [phase-1-core-gameplay.md](../phase-1-core-gameplay.md)
- Package loading: [package-loading.md](package-loading.md)
- Component usage: [reference/component-props.md](../../reference/component-props.md)
- Error messages: [reference/error-messages.md](../../reference/error-messages.md)
