# PART-021: Screen Layout

> ⛔ **DO NOT USE — superseded by PART-025.** The manual HTML layout (`.page-center > .game-wrapper > .game-stack`) previously defined in this part is no longer valid. All games MUST use **PART-025 ScreenLayout Component** with the `sections` API. The ScreenLayout component auto-generates the layout with header, questionText, progressBar, playArea, and transitionScreen sections.

Use ScreenLayout instead:

```javascript
ScreenLayout.inject('app', {
  sections: {
    header: true,            // only if timer/HUD
    questionText: true,      // ALWAYS
    progressBar: true,       // ALWAYS
    playArea: true,          // ALWAYS
    transitionScreen: true   // ALWAYS
  }
});
```

Paired CSS (the ScreenLayout component injects its own internal CSS — games add only the reset + playarea overrides):

```css
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html, body { width: 100%; height: 100dvh; overflow: hidden; }
body {
  font-family: var(--mathai-font-family);
  background: var(--mathai-white);
  color: var(--mathai-black);
}

/* Play area centering (use !important — ScreenLayout CSS loads dynamically) */
.mathai-layout-playarea {
  display: flex !important;
  flex-direction: column !important;
  align-items: center !important;
  padding: 0 20px 32px !important;
}

/* Transition screen fills remaining space */
.mathai-ts-screen.active {
  flex: 1;
  justify-content: center;
}
```

See PART-025 for full ScreenLayout documentation.
