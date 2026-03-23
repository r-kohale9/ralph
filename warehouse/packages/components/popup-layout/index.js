!(function (e) {
  "use strict";
  // Skip if already loaded
  if (typeof e.PopupComponent !== "undefined") {
    console.log("[PopupLayout] Already loaded, skipping duplicate execution");
    return;
  }
  const t = {
      activePopup: null,
      showLottie: !1,
      lottieTimeout: null,
      show: function (o) {
        const {
          icon: i,
          title: n,
          description: s,
          primaryText: a,
          secondaryText: r = "",
          hasSecondary: l = !1,
          primaryClick: c = () => {},
          secondaryClick: d = () => {},
          onShow: p = () => {},
          zIndex: zIndex = 9999,
        } = o;
        this.hide(), (this.showLottie = !1);
        const u = document.createElement("div");
        (u.id = "popup-backdrop"),
          (u.style.cssText =
            "position: fixed;top: 0;left: 0;width: 100%;height: 100%;background-color: rgba(0, 0, 0, 0.5);z-index: 9999;display: flex;align-items: flex-end;justify-content: center;animation: fadeIn 0.3s ease-in-out;");
        const h = document.createElement("div");
        (h.id = "popup-layout"),
          (h.style.cssText = `width: 100%;max-width: 480px;position: relative;z-index: ${zIndex};animation: slideUp 0.3s ease-out;`);
        const m = document.createElement("div");
        (m.className = "bottomSheetDocument"),
          (m.style.cssText =
            "background: white;border-radius: 0px;padding: 32px;box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.15);display: flex;flex-direction: column;align-items: center;width: 100%;box-sizing: border-box;");
        const y = document.createElement("div");
        if (
          ((y.style.cssText = "height: 72px;width: 72px;margin-bottom: 0px;"),
          i)
        ) {
          const e = document.createElement("lottie-player");
          (e.id = "popup-lottie"),
            e.setAttribute("src", i),
            e.setAttribute("background", "transparent"),
            e.setAttribute("speed", "1"),
            e.setAttribute("loop", ""),
            e.setAttribute("autoplay", ""),
            (e.style.cssText = "height: 72px;width: 72px;display: none;"),
            y.appendChild(e),
            (this.lottieTimeout = setTimeout(() => {
              (this.showLottie = !0), (e.style.display = "block");
            }, 4e3));
        }
        const g = document.createElement("div");
        (g.style.cssText =
          "margin-bottom: 0px;background: white;text-align: center;font-size: 20px;font-weight: bold;line-height: 120%;color: #000;"),
          (g.textContent = n);
        const f = document.createElement("div");
        (f.style.cssText =
          "background: white;font-size: 14px;line-height: 150%;text-align: center;color: #666;"),
          (f.textContent = s);
        const b = document.createElement("div");
        if (
          ((b.style.cssText = `display: flex;width: 100%;${
            l ? "justify-content: space-between;" : "justify-content: center;"
          }margin-top: 32px;gap: 12px;`),
          l)
        ) {
          const e = document.createElement("button");
          (e.style.cssText = `height: 56px;width: ${
            l ? "calc(50% - 6px)" : "50%"
          };text-align: center;font-weight: bold;color: #3030ED;background: transparent;border: none;cursor: pointer;font-size: 16px;border-radius: 8px;transition: background-color 0.2s;`),
            (e.textContent = r),
            e.addEventListener("mouseenter", () => {
              e.style.backgroundColor = "#f0f0f0";
            }),
            e.addEventListener("mouseleave", () => {
              e.style.backgroundColor = "transparent";
            }),
            e.addEventListener("click", (e) => {
              e.preventDefault(), d(e);
            }),
            b.appendChild(e);
        }
        const x = document.createElement("button");
        (x.style.cssText = `height: 56px;width: ${
          l ? "calc(50% - 6px)" : "50%"
        };border-radius: 8px;background-color: #FFDE49;text-align: center;font-weight: bold;color: #270F36;border: none;cursor: pointer;font-size: 16px;transition: transform 0.1s, box-shadow 0.2s;`),
          (x.textContent = a),
          x.addEventListener("mouseenter", () => {
            (x.style.transform = "translateY(-2px)"),
              (x.style.boxShadow = "0 4px 12px rgba(255, 222, 73, 0.4)");
          }),
          x.addEventListener("mouseleave", () => {
            (x.style.transform = "translateY(0)"), (x.style.boxShadow = "none");
          }),
          x.addEventListener("click", (e) => {
            e.preventDefault(), c(e);
          }),
          b.appendChild(x),
          m.appendChild(y),
          m.appendChild(g),
          m.appendChild(f),
          m.appendChild(b),
          h.appendChild(m),
          u.appendChild(h),
          document.body.appendChild(u),
          (this.activePopup = u),
          p(),
          "function" == typeof window.dumpLogs &&
            window.dumpLogs({ action: `${n}_popup_visible` });
      },
      hide: function () {
        this.activePopup &&
          (this.lottieTimeout &&
            (clearTimeout(this.lottieTimeout), (this.lottieTimeout = null)),
          (this.activePopup.style.animation = "fadeOut 0.2s ease-in-out"),
          setTimeout(() => {
            this.activePopup &&
              this.activePopup.parentNode &&
              this.activePopup.parentNode.removeChild(this.activePopup),
              (this.activePopup = null);
          }, 200));
      },
      isVisible: function () {
        return null !== this.activePopup;
      },
    },
    o = document.createElement("style");
  (o.textContent =
    "\n        @keyframes fadeIn {\n            from {\n                opacity: 0;\n            }\n            to {\n                opacity: 1;\n            }\n        }\n\n        @keyframes fadeOut {\n            from {\n                opacity: 1;\n            }\n            to {\n                opacity: 0;\n            }\n        }\n\n        @keyframes slideUp {\n            from {\n                transform: translateY(100%);\n                opacity: 0;\n            }\n            to {\n                transform: translateY(0);\n                opacity: 1;\n            }\n        }\n\n        button:active {\n            transform: scale(0.98) !important;\n        }\n\n        @media (max-width: 640px) {\n            #popup-layout {\n                margin: 0 0px 0px 0px !important;\n            }\n        }\n    "),
    document.head.appendChild(o),
    (e.PopupComponent = t);
})(window);
