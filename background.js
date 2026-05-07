// Create context menu item on install
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "highlight-selection",
    title: "Highlight",
    contexts: ["selection"]
  });
});

// Handle context menu click
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "highlight-selection" && tab?.id) {
    chrome.tabs.sendMessage(tab.id, { action: "highlight" });
  }
});
