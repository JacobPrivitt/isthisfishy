const DEV_AUTH = "Bearer dev";

const MODE_REMINDERS = {
  private: "Private mode: Just for you. Not saved or shared.",
  shared: "Shared mode: Create a short summary you can send to someone you trust.",
  family: "Family mode: Let your family help you decide. Requires Family Protection.",
};

const state = {
  mode: "private",
  lastRequestBody: null,
  lastAnalysis: null,
  loading: false,
};

const signedInToggle = document.getElementById("signedInToggle");
const contentText = document.getElementById("contentText");
const modeReminder = document.getElementById("modeReminder");
const checkBtn = document.getElementById("checkBtn");
const errorPanel = document.getElementById("errorPanel");
const resultPanel = document.getElementById("resultPanel");
const unlockPanel = document.getElementById("unlockPanel");
const licenseKeyInput = document.getElementById("licenseKeyInput");
const unlockBtn = document.getElementById("unlockBtn");
const unlockStatus = document.getElementById("unlockStatus");

const sharedPanel = document.getElementById("sharedPanel");
const shareBtn = document.getElementById("shareBtn");
const shareStatus = document.getElementById("shareStatus");

const familyPanel = document.getElementById("familyPanel");
const familyEmailInput = document.getElementById("familyEmailInput");
const inviteBtn = document.getElementById("inviteBtn");
const familyStatus = document.getElementById("familyStatus");
const familyMembersList = document.getElementById("familyMembersList");
const familyEventsList = document.getElementById("familyEventsList");

const verdictLabel = document.getElementById("verdictLabel");
const confidenceText = document.getElementById("confidenceText");
const categoryText = document.getElementById("categoryText");
const reasonsList = document.getElementById("reasonsList");
const nextStepText = document.getElementById("nextStepText");

function setLoading(isLoading) {
  state.loading = isLoading;
  checkBtn.disabled = isLoading;
  unlockBtn.disabled = isLoading;
  shareBtn.disabled = isLoading;
  inviteBtn.disabled = isLoading;
  checkBtn.textContent = isLoading ? "Checking..." : "Check Message";
}

function setMode(mode) {
  state.mode = mode;
  document.querySelectorAll(".mode-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.mode === mode);
  });
  modeReminder.textContent = MODE_REMINDERS[mode];

  sharedPanel.classList.toggle("hidden", mode !== "shared");
  familyPanel.classList.toggle("hidden", mode !== "family");
  clearStatusLines();

  if (mode === "family") {
    loadFamilyPanel();
  }
}

function clearStatusLines() {
  shareStatus.textContent = "";
  familyStatus.textContent = "";
  unlockStatus.textContent = "";
}

function showError(message) {
  errorPanel.textContent = message;
  errorPanel.classList.remove("hidden");
}

function clearError() {
  errorPanel.textContent = "";
  errorPanel.classList.add("hidden");
}

function getAuthHeader() {
  return { Authorization: DEV_AUTH };
}

function shouldUseAuthForAnalyze() {
  if (state.mode === "shared" || state.mode === "family") {
    return true;
  }
  return signedInToggle.checked;
}

async function postJson(url, body, useAuth) {
  const headers = { "Content-Type": "application/json" };
  if (useAuth) {
    Object.assign(headers, getAuthHeader());
  }

  return fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

async function getJson(url, useAuth) {
  const headers = {};
  if (useAuth) {
    Object.assign(headers, getAuthHeader());
  }

  return fetch(url, { method: "GET", headers });
}

function renderResult(data) {
  verdictLabel.textContent = (data.verdict_label || data.verdict || "").toUpperCase();
  confidenceText.textContent = data.confidence || "unknown";
  categoryText.textContent = (data.scam_type || data.category || "unknown").replaceAll("_", " ");

  reasonsList.innerHTML = "";
  const reasons = Array.isArray(data.reasons) ? data.reasons.slice(0, 4) : [];
  reasons.forEach((reason) => {
    const li = document.createElement("li");
    li.textContent = reason;
    reasonsList.appendChild(li);
  });

  nextStepText.textContent = data.next_action || data.recommended_next_step?.supporting_text || "Pause and verify through a trusted source.";
  resultPanel.classList.remove("hidden");
}

async function onCheckMessage() {
  const text = contentText.value.trim();
  if (!text) {
    showError("Please paste a message first.");
    return;
  }

  clearError();
  clearStatusLines();
  unlockPanel.classList.add("hidden");
  resultPanel.classList.add("hidden");

  const payload = {
    mode: state.mode,
    input_type: "text",
    content_text: text,
  };
  state.lastRequestBody = payload;

  setLoading(true);
  try {
    const res = await postJson("/analyze", payload, shouldUseAuthForAnalyze());
    if (res.ok) {
      const data = await res.json();
      state.lastAnalysis = data;
      renderResult(data);
      if (state.mode === "family") {
        loadFamilyPanel();
      }
      return;
    }

    if (res.status === 402) {
      unlockPanel.classList.remove("hidden");
      showError("Family mode needs an unlock code. Enter your code below.");
      return;
    }
    if (res.status === 429) {
      showError("You've hit today's free limit. Try again tomorrow or unlock Family Protection.");
      return;
    }
    if (res.status === 401) {
      showError("Please sign in to use this feature. For now, turn on Signed in (dev).");
      return;
    }

    showError("Something went wrong. Please try again.");
    console.error("Analyze failed", res.status, await res.text());
  } catch (err) {
    showError("Something went wrong. Please try again.");
    console.error("Analyze request error", err);
  } finally {
    setLoading(false);
  }
}

async function onUnlock() {
  const code = licenseKeyInput.value.trim();
  if (!code) {
    unlockStatus.textContent = "Please enter a license code.";
    return;
  }

  clearError();
  unlockStatus.textContent = "";
  setLoading(true);
  try {
    const res = await postJson("/redeem", { license_key: code }, true);
    if (!res.ok) {
      unlockStatus.textContent = "That code could not be redeemed.";
      console.error("Redeem failed", res.status, await res.text());
      return;
    }

    unlockStatus.textContent = "Unlocked. Retrying your check...";
    if (state.lastRequestBody) {
      const retry = await postJson("/analyze", state.lastRequestBody, shouldUseAuthForAnalyze());
      if (retry.ok) {
        const data = await retry.json();
        state.lastAnalysis = data;
        clearError();
        renderResult(data);
        unlockPanel.classList.add("hidden");
        unlockStatus.textContent = "Unlocked.";
        if (state.mode === "family") {
          loadFamilyPanel();
        }
      } else {
        showError("Something went wrong. Please try again.");
        console.error("Retry analyze failed", retry.status, await retry.text());
      }
    }
  } catch (err) {
    unlockStatus.textContent = "Something went wrong while unlocking.";
    console.error("Redeem request error", err);
  } finally {
    setLoading(false);
  }
}

async function onCreateShareLink() {
  if (!state.lastAnalysis || state.mode !== "shared") {
    shareStatus.textContent = "Run Shared mode check first.";
    return;
  }

  setLoading(true);
  clearError();
  shareStatus.textContent = "";
  try {
    const res = await postJson("/share", { analysis_result: state.lastAnalysis, share_ttl_hours: 72 }, true);
    if (!res.ok) {
      if (res.status === 401) {
        shareStatus.textContent = "Please sign in to create a share link.";
      } else {
        shareStatus.textContent = "Could not create share link.";
      }
      console.error("Share failed", res.status, await res.text());
      return;
    }

    const data = await res.json();
    const fullUrl = `${window.location.origin}${data.share_url}`;
    shareStatus.innerHTML = `Share link created: <a href="${fullUrl}" target="_blank" rel="noopener">${fullUrl}</a>`;
  } catch (err) {
    shareStatus.textContent = "Could not create share link.";
    console.error("Share error", err);
  } finally {
    setLoading(false);
  }
}

async function loadFamilyPanel() {
  familyMembersList.innerHTML = "";
  familyEventsList.innerHTML = "";

  if (!signedInToggle.checked) {
    familyStatus.textContent = "Turn on Signed in (dev) to use family tools.";
    return;
  }

  familyStatus.textContent = "";
  try {
    await postJson("/family/create", {}, true);
    await postJson("/family/accept", {}, true);

    const membersRes = await getJson("/family/members", true);
    if (membersRes.ok) {
      const data = await membersRes.json();
      const members = data.members || [];
      if (members.length === 0) {
        const li = document.createElement("li");
        li.textContent = "No members yet.";
        familyMembersList.appendChild(li);
      } else {
        members.forEach((m) => {
          const li = document.createElement("li");
          li.textContent = `${m.email} (${m.role}, ${m.status})`;
          familyMembersList.appendChild(li);
        });
      }
    }

    const eventsRes = await getJson("/family/events", true);
    if (eventsRes.ok) {
      const data = await eventsRes.json();
      const events = data.events || [];
      if (events.length === 0) {
        const li = document.createElement("li");
        li.textContent = "No family events yet.";
        familyEventsList.appendChild(li);
      } else {
        events.slice(0, 8).forEach((evt) => {
          const li = document.createElement("li");
          li.textContent = `${evt.verdict} (${evt.confidence}) - ${evt.scam_type}`;
          familyEventsList.appendChild(li);
        });
      }
    }
  } catch (err) {
    familyStatus.textContent = "Could not load family data.";
    console.error("Family panel error", err);
  }
}

async function onInviteFamilyMember() {
  const email = familyEmailInput.value.trim().toLowerCase();
  if (!email) {
    familyStatus.textContent = "Enter an email to invite.";
    return;
  }

  if (!signedInToggle.checked) {
    familyStatus.textContent = "Turn on Signed in (dev) to invite family.";
    return;
  }

  setLoading(true);
  familyStatus.textContent = "";
  clearError();
  try {
    await postJson("/family/create", {}, true);
    const res = await postJson("/family/invite", { email }, true);
    if (!res.ok) {
      familyStatus.textContent = "Could not send invite.";
      console.error("Family invite failed", res.status, await res.text());
      return;
    }

    familyStatus.textContent = "Invite saved.";
    familyEmailInput.value = "";
    loadFamilyPanel();
  } catch (err) {
    familyStatus.textContent = "Could not send invite.";
    console.error("Family invite error", err);
  } finally {
    setLoading(false);
  }
}

document.querySelectorAll(".mode-btn").forEach((btn) => {
  btn.addEventListener("click", () => setMode(btn.dataset.mode));
});

checkBtn.addEventListener("click", onCheckMessage);
unlockBtn.addEventListener("click", onUnlock);
shareBtn.addEventListener("click", onCreateShareLink);
inviteBtn.addEventListener("click", onInviteFamilyMember);
signedInToggle.addEventListener("change", () => {
  if (state.mode === "family") {
    loadFamilyPanel();
  }
});

setMode("private");
