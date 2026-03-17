# Examples Directory

Complete, production-ready code examples and anti-patterns for MathAI game development.

## 📚 Files

### 1. correct-patterns.md (40 KB)
**Complete, working examples following all MANDATORY workflow rules**

Contains 5 production-ready patterns:
- **Pattern 1:** Complete Feedback Integration (FeedbackManager)
- **Pattern 2:** Timer with VisibilityTracker (Complete)
- **Pattern 3:** Dynamic Audio Generation (Complete)
- **Pattern 4:** Results Submission (Complete)
- **Pattern 5:** Full Game Template (350+ lines, ready to use)

✅ All examples include:
- FeedbackManager.init() calls
- VisibilityTracker integration
- Error handling with try/catch
- Cleanup methods (destroy())
- Debug functions (testAudio, debugGame, etc.)
- Proper logging with JSON.stringify

**Usage:** Copy the pattern that matches your needs. All code is production-ready.

### 2. anti-patterns.md (24 KB)
**Common mistakes and how to fix them**

Documents 9 anti-patterns with:
- ❌ Bad code examples (what NOT to do)
- 📋 Why it fails (bullet points)
- ✅ Correct approach (complete fix)

**Anti-patterns covered:**
1. Manual Timer Creation (setInterval)
2. Direct Audio Creation (new Audio())
3. Separate Component Loading
4. Missing VisibilityTracker
5. Skipping FeedbackManager Initialization
6. Missing Error Handling
7. Missing Cleanup Methods
8. Poor Logging Practices
9. Missing Debug Functions

**Usage:** Reference during code review to catch common mistakes.

### 3. AUDIT-SUMMARY.md (12 KB)
**Audit report of SKILL.md code examples**

Documents:
- 66+ code examples audited
- 23+ incomplete examples identified
- Specific gaps fixed
- Verification checklist
- Usage guide
- Statistics

**Usage:** Understand what was fixed and why.

## 🚀 Quick Start

### For New Games
1. Open `correct-patterns.md`
2. Find **Pattern 5: Full Game Template**
3. Copy the entire HTML file
4. Customize for your game

### For Specific Features
- Need feedback only? → Pattern 1
- Need timer? → Pattern 2
- Need dynamic audio? → Pattern 3
- Need results submission? → Pattern 4
- Need everything? → Pattern 5

### For Code Review
1. Open `anti-patterns.md`
2. Check if code matches any anti-pattern
3. Apply the correct approach shown

## ✅ Verification Checklist

Use this for code review:

```
Mandatory Components:
[ ] FeedbackManager package loaded
[ ] FeedbackManager.init() called first
[ ] Components package loaded (if timer used)
[ ] Helpers package loaded (for VisibilityTracker)

Feedback:
[ ] Audio preloaded with error handling
[ ] Subtitles passed as props
[ ] No new Audio() calls

Timer:
[ ] TimerComponent used (not setInterval)
[ ] destroy() called on cleanup

VisibilityTracker:
[ ] Instance created with callbacks
[ ] Pauses timer + audio
[ ] Resumes timer + audio
[ ] destroy() called on cleanup

Error Handling:
[ ] try/catch around async operations
[ ] Detailed error logging

Debug Functions:
[ ] testAudio() included
[ ] testAudioUrls() included
[ ] debugAudio() included
[ ] debugGame() included
```

## 📖 Pattern Selection Guide

| Need | Use Pattern | File Size |
|------|-------------|-----------|
| Just feedback | Pattern 1 | ~100 lines |
| Timer + pause/resume | Pattern 2 | ~150 lines |
| Dynamic audio | Pattern 3 | ~100 lines |
| Results tracking | Pattern 4 | ~150 lines |
| Complete game | Pattern 5 | ~350 lines |

## 🎯 Key Rules

All patterns follow these MANDATORY rules:

1. ✅ **FeedbackManager.init()** - Call before ANY FeedbackManager usage
2. ✅ **TimerComponent** - Use for ALL timers (NEVER setInterval)
3. ✅ **VisibilityTracker** - MANDATORY for games with timers/audio
4. ✅ **Subtitles as Props** - Pass with audio (NEVER SubtitleComponent.show())
5. ✅ **Error Handling** - Wrap all async operations in try/catch
6. ✅ **Cleanup** - Call destroy() on all components
7. ✅ **Debug Functions** - Include testAudio(), debugGame(), etc.
8. ✅ **JSON Logging** - Use JSON.stringify(data, null, 2)

## 🚫 What NOT to Do

Never do these (see anti-patterns.md for details):

1. ❌ `setInterval()` for timers
2. ❌ `new Audio()` for audio
3. ❌ Load SubtitleComponent separately
4. ❌ Use `SubtitleComponent.show()` directly
5. ❌ Skip VisibilityTracker
6. ❌ Skip FeedbackManager.init()
7. ❌ Skip error handling
8. ❌ Skip cleanup methods
9. ❌ Log objects without JSON.stringify
10. ❌ Skip debug functions

## 📊 Statistics

- **Complete patterns:** 5
- **Anti-patterns documented:** 9
- **Total example code:** 1,400+ lines
- **All examples:** Production-ready ✅

## 🔗 Related Files

- `../SKILL.md` - Main skill documentation
- `../types/` - TypeScript definitions
- `../assets/` - Game templates

## 💡 Tips

### Development Workflow
1. Start with Pattern 5 (full template)
2. Remove features you don't need
3. Run debug functions to test
4. Review against anti-patterns checklist

### Debugging Issues
1. Open browser console
2. Run `testAudioUrls()` - check audio URLs
3. Run `debugAudio()` - check FeedbackManager state
4. Run `debugGame()` - check game state

### Testing Features
```javascript
// In browser console:
testAudio('tap')           // Test individual audio
testAudioUrls()            // Test all audio URLs
debugAudio()               // Check audio system state
debugGame()                // Check game state
testPause()                // Test pause functionality
testResume()               // Test resume functionality
testDynamicAudio('test')   // Test dynamic audio generation
```

## 📝 Contributing

When adding new patterns:
1. Follow the structure in correct-patterns.md
2. Include ALL mandatory requirements
3. Add comprehensive error handling
4. Include debug functions
5. Add to verification checklist
6. Update this README

## ⚠️ Important Notes

- All examples use **latest package versions**
- All examples are **tested and working**
- All examples include **complete error handling**
- All examples follow **SKILL.md workflow rules**

**These are production-ready examples - copy and use directly!**
