// This script runs in the MAIN world (page context) to intercept
// history.pushState and history.replaceState, dispatching a custom
// event that the content script (ISOLATED world) can listen for.

(function () {
  const origPush = history.pushState;
  const origReplace = history.replaceState;

  history.pushState = function () {
    origPush.apply(this, arguments);
    window.dispatchEvent(new Event("hltr-urlchange"));
  };

  history.replaceState = function () {
    origReplace.apply(this, arguments);
    window.dispatchEvent(new Event("hltr-urlchange"));
  };
})();
