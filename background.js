const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

browserAPI.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && tab.url.includes('linkedin.com/in/')) {
    const execResult = browserAPI.tabs.executeScript(tabId, { file: 'content.js' });
    if (execResult && typeof execResult.catch === 'function') {
      execResult.catch(() => {});
    }
  }
});
