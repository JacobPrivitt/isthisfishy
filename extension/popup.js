const DEFAULT_API_BASE_URL = "http://127.0.0.1:8000";
const MAX_CONTENT_LENGTH = 20000;

const state = {
  mode: "private",
  signedInDev: false,
  apiBaseUrl: DEFAULT_API_BASE_URL,
  loading: false,
  lastPayload: null,
  lastResult: null,
};

const modeButtons = [...document.querySelectorAll(".mode-btn")];
const signedInToggle = document.getElementById("signedInToggle");
const contentText = document.getElementById("contentText");
const checkBtn = document.getElementById("checkBtn");
const clearBtn = document.getElementById("clearBtn");
const errorCard = document.getElementById("errorCard");
const resultCard = document.getElementById("resultCard");
const unlockCard = document.getElementById("unlockCard");
const unlockBtn = document.getElementById("unlockBtn");
const licenseCodeInput = document.getElementById("licenseCodeInput");
const unlockStatus = document.getElementById("unlockStatus");
const sharedCard = document.getElementById("sharedCard");
const createShareBtn = document.getElementById("createShareBtn");
const shareStatus = document.getElementById("shareStatus");
const familyCard = document.getElementById("familyCard");
const inviteEmailInput = document.getElementById("inviteEmailInput");
const inviteFamilyBtn = document.getElementById("inviteFamilyBtn");
const familyStatus = document.getElementById("familyStatus");
const familyMembersList = document.getElementById("familyMembersList");
const familyEventsList = document.getElementById("familyEventsList");
const verdictText = document.getElementById("verdictText");
const confidenceText = document.getElementById("confidenceText");
const scamTypeText = document.getElementById("scamTypeText");
const reasonsList = document.getElementById("reasonsList");
const nextActionText = document.getElementById("nextActionText");
const requestIdText = document.getElementById("requestIdText");
const copyRequestIdBtn = document.getElementById("copyRequestIdBtn");

function transientStorage() {
  return chrome.storage.session || chrome.storage.local;
}

function setLoading(isLoading) {
  state.loading = isLoading;
  checkBtn.disabled = isLoading;
  clearBtn.disabled = isLoading;
  unlockBtn.disabled = isLoading;
  createShareBtn.disabled = isLoading;
  inviteFamilyBtn.disabled = isLoading;
  checkBtn.textContent = isLoading ? "Checking..." : "Check";
}

function setMode(mode) {
  state.mode = mode;
  modeButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.mode === mode);
  });
  sharedCard.classList.toggle("hidden", mode !== "shared");
  familyCard.classList.toggle("hidden", mode !== "family");
  if (mode === "family") {
    refreshFamilyPanel();
  }
}

function clearError() {
  errorCard.textContent = "";
  errorCard.classList.add("hidden");
}

function showError(message) {
  errorCard.textContent = message;
  errorCard.classList.remove("hidden");
}

function clearResult() {
  resultCard.classList.add("hidden");
  verdictText.textContent = "";
  confidenceText.textContent = "";
  scamTypeText.textContent = "";
  reasonsList.innerHTML = "";
  nextActionText.textContent = "";
  requestIdText.textContent = "";
}

function clearUnlock() {
  unlockStatus.textContent = "";
  unlockCard.classList.add("hidden");
}

function clearShareStatus() {
  shareStatus.textContent = "";
}

function clearFamilyPanel() {
  familyStatus.textContent = "";
  familyMembersList.innerHTML = "";
  familyEventsList.innerHTML = "";
}

function normalizeApiBase(url) {
  return (url || DEFAULT_API_BASE_URL).trim().replace(/\/+$/, "");
}

function analyzeHeaders() {
  const headers = { "Content-Type": "application/json" };
  if (state.signedInDev) {
    headers.Authorization = "Bearer dev";
  }
  return headers;
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch (_e) {
    return null;
  }
}

async function parseErrorResponse(response) {
  const text = await response.text();
  const parsed = safeJsonParse(text);

  if (parsed && parsed.error && parsed.error.code) {
    return {
      status: response.status,
      code: parsed.error.code,
      message: parsed.error.message || "Request could not be completed.",
      requestId: parsed.request_id || "",
      raw: parsed,
    };
  }

  if (parsed && parsed.detail) {
    return {
      status: response.status,
      code: "",
      message: typeof parsed.detail === "string" ? parsed.detail : "Request could not be completed.",
      requestId: "",
      raw: parsed,
    };
  }

  return {
    status: response.status,
    code: "",
    message: "Request could not be completed.",
    requestId: "",
    raw: text,
  };
}

function friendlyErrorMessage(err) {
  if (err.status === 429 || err.code === "RATE_LIMIT") {
    return "You hit today's free limit. Try again tomorrow or unlock Family Protection.";
  }
  if (err.status === 401 || err.code === "UNAUTHORIZED") {
    return "Please sign in to use this feature. Turn on Signed in (dev).";
  }
  return "Something went wrong. Please try again.";
}

async function callAnalyze(payload) {
  const response = await fetch(`${state.apiBaseUrl}/api/v1/analyze`, {
    method: "POST",
    headers: analyzeHeaders(),
    body: JSON.stringify(payload),
  });
  return response;
}

async function callRedeem(code) {
  const response = await fetch(`${state.apiBaseUrl}/api/v1/redeem`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer dev",
    },
    body: JSON.stringify({ license_key: code }),
  });
  return response;
}

async function callShare(analysisResult) {
  return fetch(`${state.apiBaseUrl}/api/v1/share`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer dev",
    },
    body: JSON.stringify({ analysis_result: analysisResult, share_ttl_hours: 72 }),
  });
}

async function callFamilyCreate() {
  return fetch(`${state.apiBaseUrl}/api/v1/family/create`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer dev",
    },
    body: JSON.stringify({}),
  });
}

async function callFamilyMembers() {
  return fetch(`${state.apiBaseUrl}/api/v1/family/members`, {
    method: "GET",
    headers: { Authorization: "Bearer dev" },
  });
}

async function callFamilyEvents() {
  return fetch(`${state.apiBaseUrl}/api/v1/family/events`, {
    method: "GET",
    headers: { Authorization: "Bearer dev" },
  });
}

async function callFamilyInvite(email) {
  return fetch(`${state.apiBaseUrl}/api/v1/family/invite`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer dev",
    },
    body: JSON.stringify({ email }),
  });
}

function renderResult(data) {
  verdictText.textContent = (data.verdict || "").replaceAll("_", " ").toUpperCase();
  confidenceText.textContent = data.confidence || "unknown";
  scamTypeText.textContent = (data.scam_type || "unknown").replaceAll("_", " ");
  nextActionText.textContent = data.next_action || "Pause and verify with someone you trust.";
  requestIdText.textContent = data.request_id || "";

  reasonsList.innerHTML = "";
  (data.reasons || []).slice(0, 4).forEach((reason) => {
    const li = document.createElement("li");
    li.textContent = reason;
    reasonsList.appendChild(li);
  });

  resultCard.classList.remove("hidden");
}

async function runAnalyze(auto = false) {
  const text = (contentText.value || "").trim();
  clearError();
  clearUnlock();
  clearShareStatus();
  clearResult();
  if (state.mode === "family") {
    clearFamilyPanel();
  }

  if (!text) {
    if (!auto) {
      showError("Please paste some text to check.");
    }
    return;
  }

  if (text.length > MAX_CONTENT_LENGTH) {
    showError("That message is too long. Please keep it under 20,000 characters.");
    return;
  }

  const payload = { mode: state.mode, input_type: "text", content_text: text };
  state.lastPayload = payload;

  setLoading(true);
  try {
    const response = await callAnalyze(payload);
    if (response.ok) {
      const data = await response.json();
      state.lastResult = data;
      renderResult(data);
      if (state.mode === "family") {
        await refreshFamilyPanel();
      }
      return;
    }

    const err = await parseErrorResponse(response);
    if (err.status === 402 || err.code === "PAYWALL") {
      unlockCard.classList.remove("hidden");
      showError("Family mode requires Family Protection.");
      return;
    }

    showError(friendlyErrorMessage(err));
    console.error("Analyze request failed", { status: err.status, code: err.code, requestId: err.requestId });
  } catch (error) {
    showError("Could not connect to IsThisFishy API. Please try again.");
    console.error("Analyze network error", error);
  } finally {
    setLoading(false);
  }
}

async function redeemAndRetry() {
  clearError();
  unlockStatus.textContent = "";
  const code = (licenseCodeInput.value || "").trim();
  if (!code) {
    unlockStatus.textContent = "Enter a license code.";
    return;
  }
  if (!state.signedInDev) {
    unlockStatus.textContent = "Turn on Signed in (dev) before unlocking.";
    return;
  }

  setLoading(true);
  try {
    const response = await callRedeem(code);
    if (!response.ok) {
      const err = await parseErrorResponse(response);
      unlockStatus.textContent = "That code could not be redeemed.";
      console.error("Redeem failed", { status: err.status, code: err.code, requestId: err.requestId });
      return;
    }

    unlockStatus.textContent = "Unlocked. Retrying...";
    if (state.lastPayload) {
      await runAnalyze(true);
    }
  } catch (error) {
    unlockStatus.textContent = "Could not unlock right now.";
    console.error("Redeem network error", error);
  } finally {
    setLoading(false);
  }
}

async function createShareLink() {
  clearError();
  clearShareStatus();
  if (state.mode !== "shared") {
    shareStatus.textContent = "Switch to Shared mode first.";
    return;
  }
  if (!state.lastResult) {
    shareStatus.textContent = "Run a Shared mode check first.";
    return;
  }
  if (!state.signedInDev) {
    shareStatus.textContent = "Turn on Signed in (dev) to create a link.";
    return;
  }

  setLoading(true);
  try {
    const response = await callShare(state.lastResult);
    if (!response.ok) {
      const err = await parseErrorResponse(response);
      shareStatus.textContent = "Could not create share link.";
      console.error("Share request failed", { status: err.status, code: err.code, requestId: err.requestId });
      return;
    }

    const data = await response.json();
    const fullUrl = `${state.apiBaseUrl}${data.url || data.share_url || ""}`;
    const link = document.createElement("a");
    link.href = fullUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = fullUrl;
    shareStatus.textContent = "Share link: ";
    shareStatus.appendChild(link);
  } catch (error) {
    shareStatus.textContent = "Could not create share link.";
    console.error("Share network error", error);
  } finally {
    setLoading(false);
  }
}

async function refreshFamilyPanel() {
  clearFamilyPanel();
  if (!state.signedInDev) {
    familyStatus.textContent = "Turn on Signed in (dev) to use Family features.";
    return;
  }

  try {
    await callFamilyCreate();

    const membersResponse = await callFamilyMembers();
    if (membersResponse.ok) {
      const data = await membersResponse.json();
      const members = data.members || [];
      if (!members.length) {
        const li = document.createElement("li");
        li.textContent = "No family members yet.";
        familyMembersList.appendChild(li);
      } else {
        members.forEach((m) => {
          const li = document.createElement("li");
          li.textContent = `${m.email} (${m.role}, ${m.status})`;
          familyMembersList.appendChild(li);
        });
      }
    }

    const eventsResponse = await callFamilyEvents();
    if (eventsResponse.ok) {
      const data = await eventsResponse.json();
      const events = data.events || [];
      if (!events.length) {
        const li = document.createElement("li");
        li.textContent = "No family events yet.";
        familyEventsList.appendChild(li);
      } else {
        events.slice(0, 8).forEach((e) => {
          const li = document.createElement("li");
          li.textContent = `${e.verdict} (${e.confidence}) - ${e.scam_type}`;
          familyEventsList.appendChild(li);
        });
      }
    }
  } catch (error) {
    familyStatus.textContent = "Could not load family data.";
    console.error("Family load error", error);
  }
}

async function inviteFamilyMember() {
  clearError();
  familyStatus.textContent = "";
  const email = (inviteEmailInput.value || "").trim().toLowerCase();
  if (!email) {
    familyStatus.textContent = "Enter an email to invite.";
    return;
  }
  if (!state.signedInDev) {
    familyStatus.textContent = "Turn on Signed in (dev) to invite family.";
    return;
  }

  setLoading(true);
  try {
    await callFamilyCreate();
    const response = await callFamilyInvite(email);
    if (!response.ok) {
      const err = await parseErrorResponse(response);
      familyStatus.textContent = "Could not save invite.";
      console.error("Family invite failed", { status: err.status, code: err.code, requestId: err.requestId });
      return;
    }

    familyStatus.textContent = "Invite saved.";
    inviteEmailInput.value = "";
    await refreshFamilyPanel();
  } catch (error) {
    familyStatus.textContent = "Could not save invite.";
    console.error("Family invite error", error);
  } finally {
    setLoading(false);
  }
}

async function saveSettings() {
  await chrome.storage.sync.set({
    api_base_url: state.apiBaseUrl,
    signed_in_dev: state.signedInDev,
    last_mode: state.mode,
  });
}

async function loadSettings() {
  const result = await chrome.storage.sync.get(["api_base_url", "signed_in_dev", "last_mode"]);
  state.apiBaseUrl = normalizeApiBase(result.api_base_url || DEFAULT_API_BASE_URL);
  state.signedInDev = Boolean(result.signed_in_dev);
  state.mode = result.last_mode || "private";
}

async function loadSelectionAndAutoRun() {
  const store = transientStorage();
  const data = await store.get(["last_selected_text", "auto_run"]);
  if (data.last_selected_text) {
    contentText.value = data.last_selected_text;
  }

  if (data.auto_run) {
    await store.set({ auto_run: false, from_context_menu: false });
    await runAnalyze(true);
  }
}

async function clearAll() {
  contentText.value = "";
  clearError();
  clearResult();
  clearUnlock();
  clearShareStatus();
  clearFamilyPanel();
  await transientStorage().remove(["last_selected_text", "auto_run", "from_context_menu"]);
}

async function bootstrap() {
  await loadSettings();
  signedInToggle.checked = state.signedInDev;
  setMode(state.mode);
  await loadSelectionAndAutoRun();
}

modeButtons.forEach((button) => {
  button.addEventListener("click", async () => {
    setMode(button.dataset.mode);
    await saveSettings();
  });
});

signedInToggle.addEventListener("change", async () => {
  state.signedInDev = signedInToggle.checked;
  await saveSettings();
  if (state.mode === "family") {
    await refreshFamilyPanel();
  }
});

checkBtn.addEventListener("click", async () => {
  await runAnalyze(false);
});

clearBtn.addEventListener("click", async () => {
  await clearAll();
});

unlockBtn.addEventListener("click", async () => {
  await redeemAndRetry();
});

createShareBtn.addEventListener("click", async () => {
  await createShareLink();
});

inviteFamilyBtn.addEventListener("click", async () => {
  await inviteFamilyMember();
});

copyRequestIdBtn.addEventListener("click", async () => {
  const value = requestIdText.textContent || "";
  if (!value) {
    return;
  }
  await navigator.clipboard.writeText(value);
});

bootstrap();
