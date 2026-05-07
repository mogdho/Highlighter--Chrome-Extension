# HIGHLIGHTER ![Highlighter Logo](highlighter.png)

A dead-simple, distraction-free text highlighter for Chrome and Brave. No clutter, no intrusive selection tooltips—just one classic yellow highlight that stays exactly where you put it.



## ✨ Key Features

- **Pure Focus:** No annoying "highlight me" buttons popping up over your text. Highlight only when you want to.
- **Classic Yellow:** Optimized for both light and dark mode visibility (forced dark text for high contrast).
- **Persistent Memory:** Highlights are saved locally using **Text-Quote Anchoring**. They survive page reloads and layout shifts.
- **Blazing Fast (New):** Utilizes aggressive Text Index Caching and robust garbage collection to ensure zero UI freezing or memory leaks, even on massive text-heavy pages.
- **SPA Ready:** Works seamlessly on Single Page Applications (YouTube, Twitter, Reddit) via custom URL change detection.
- **Custom Shortcut:** Use the default `Alt + S` or record your own key combination in the settings.
- **Context Menu:** Right-click any selected text to highlight instantly.
- **Data Management:** A dedicated "Saved Data" view grouped by main domain, allowing you to manage or delete stored highlights site-wide.
- **Click-to-Remove:** Simply click on any existing highlight to remove it from both the page and storage.

## 🛠️ Installation (Developer Mode)

1. Go to the **Releases** section on the right side of this repository.
2. Download the latest `Highlighter-vX.X.zip` file.
3. Extract the downloaded ZIP file into a new folder on your computer.
4. Open your browser and navigate to `chrome://extensions` (or `brave://extensions`).
5. Enable **Developer mode** using the toggle in the top-right corner.
6. Click **Load unpacked** and select the extracted folder.


## 🚀 How to Use

1. **Highlight:** Select text and press `Alt + S` (default) or right-click and choose **Highlight**.
2. **Remove:** Click on any highlighted text to remove it instantly.
3. **Customize:** Click the extension icon in your toolbar to open the **HIGHLIGHTER** settings.
   - Adjust **Brightness** and **Opacity** with a live split-mode preview.
   - Record a **Custom Shortcut**.
   - Manage **Saved Data** to delete site-wide highlights.

## 🎨 Design & Tech

- **Premium UI:** Dark-themed settings menu with elegant Playfair Display typography and HSL-based color control.
- **Resilient Anchoring:** Uses prefix/suffix context matching instead of fragile XPaths, ensuring highlights stay accurate even if the page content changes slightly.
- **Main World Injection:** Intercepts browser history changes to support seamless navigation on modern web apps.

## 🎨 Under the Hood

- **Zero Dependencies:** Pure Vanilla JS with no external tracking or bloatware.
- **Storage Optimization:** Event separation (Input vs. Change) limits API calls, effortlessly bypassing Chrome's storage write quotas.
- **Safe DOM Manipulation:** Utilizes `TreeWalker` to wrap text nodes individually, ensuring host website layouts and native event listeners never break.


---

**Made by Mogdho Paul**
