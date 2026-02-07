const MENU_ID = "isthisfishy-check-selection";

function getTransientStorage() {
  return chrome.storage.session || chrome.storage.local;
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: MENU_ID,
    title: "Check with IsThisFishy",
    contexts: ["selection"],
  });
});

chrome.contextMenus.onClicked.addListener(async (info) => {
  if (info.menuItemId !== MENU_ID) {
    return;
  }

  const selected = (info.selectionText || "").trim();
  if (!selected) {
    return;
  }

  const transient = getTransientStorage();
  await transient.set({
    last_selected_text: selected,
    auto_run: true,
    from_context_menu: true,
  });

  const resultsUrl = chrome.runtime.getURL("results.html");
  await chrome.tabs.create({ url: resultsUrl });
});
