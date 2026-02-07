const DEV_AUTH = "Bearer dev";

const state = {
  mode: "private",
  lastRequestBody: null,
  loading: false,
};

const signedInToggle = document.getElementById("signedInToggle");
const contentText = document.getElementById("contentText");
const privacyLine = document.getElementById("privacyLine");
const checkBtn = document.getElementById("checkBtn");
const errorPanel = document.getElementById("errorPanel");
const resultPanel = document.getElementById("resultPanel");
const unlockPanel = document.getElementById("unlockPanel");
const licenseKeyInput = document.getElementById("licenseKeyInput");
const unlockBtn = document.getElementById("unlockBtn");
const unlockStatus = document.getElementById("unlockStatus");

const verdictLabel = document.getElementById("verdictLabel");
const confidenceText = document.getElementById("confidenceText");
const categoryText = document.getElementById("categoryText");
const reasonsList = document.getElementById("reasonsList");
const nextStepText = document.getElementById("nextStepText");

function setLoading(isLoading) {
  state.loading = isLoading;
  checkBtn.disabled = isLoading;
  unlockBtn.disabled = isLoading;
  checkBtn.textContent = isLoading ? "Checking..." : "Check Message";
}

function setMode(mode) {
  state.mode = mode;
  document.querySelectorAll(".mode-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.mode === mode);
  });

  if (mode === "private") {
    privacyLine.textContent = "Private mode: not saved, not shared.";
  } else if (mode === "shared") {
    privacyLine.textContent = "Shared mode: useful for discussing concerns with trusted people.";
  } else {
    privacyLine.textContent = "Family mode: broader support features for family protection.";
  }
}

function showError(message) {
  errorPanel.textContent = message;
  errorPanel.classList.remove("hidden");
}

function clearError() {
  errorPanel.textContent = "";
  errorPanel.classList.add("hidden");
}

function clearUnlockStatus() {
  unlockStatus.textContent = "";
}

function shouldUseAuthForAnalyze() {
  if (state.mode === "shared" || state.mode === "family") {
    return true;
  }
  return signedInToggle.checked;
}

async function analyze(payload) {
  const headers = { "Content-Type": "application/json" };
  if (shouldUseAuthForAnalyze()) {
    headers.Authorization = DEV_AUTH;
  }

  const res = await fetch("/analyze", {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  return res;
}

async function redeemLicense(key) {
  const res = await fetch("/redeem", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: DEV_AUTH,
    },
    body: JSON.stringify({ license_key: key }),
  });
  return res;
}

function renderResult(data) {
  verdictLabel.textContent = (data.verdict || "").replaceAll("_", " ").toUpperCase();
  confidenceText.textContent = data.confidence || "unknown";
  categoryText.textContent = (data.category || "unknown").replaceAll("_", " ");

  reasonsList.innerHTML = "";
  const reasons = Array.isArray(data.reasons) ? data.reasons.slice(0, 4) : [];
  reasons.forEach((reason) => {
    const li = document.createElement("li");
    li.textContent = reason;
    reasonsList.appendChild(li);
  });

  nextStepText.textContent = data.recommended_next_step?.supporting_text || "Pause and verify through a trusted source.";
  resultPanel.classList.remove("hidden");
}

async function onCheckMessage() {
  const text = contentText.value.trim();
  if (!text) {
    showError("Please paste a message first.");
    return;
  }

  clearError();
  unlockPanel.classList.add("hidden");
  clearUnlockStatus();
  resultPanel.classList.add("hidden");

  const payload = {
    mode: state.mode,
    input_type: "text",
    content_text: text,
  };
  state.lastRequestBody = payload;

  setLoading(true);
  try {
    const res = await analyze(payload);
    if (res.ok) {
      const data = await res.json();
      renderResult(data);
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
  clearUnlockStatus();
  setLoading(true);
  try {
    const res = await redeemLicense(code);
    if (!res.ok) {
      unlockStatus.textContent = "That code could not be redeemed.";
      console.error("Redeem failed", res.status, await res.text());
      return;
    }

    unlockStatus.textContent = "Unlocked. Retrying your check...";
    if (state.lastRequestBody) {
      const retry = await analyze(state.lastRequestBody);
      if (retry.ok) {
        const data = await retry.json();
        clearError();
        renderResult(data);
        unlockPanel.classList.add("hidden");
        unlockStatus.textContent = "Unlocked.";
      } else if (retry.status === 429) {
        showError("You've hit today's free limit. Try again tomorrow or unlock Family Protection.");
      } else if (retry.status === 401) {
        showError("Please sign in to use this feature. For now, turn on Signed in (dev).");
      } else if (retry.status === 402) {
        showError("Family mode still needs an active family unlock.");
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

document.querySelectorAll(".mode-btn").forEach((btn) => {
  btn.addEventListener("click", () => setMode(btn.dataset.mode));
});

checkBtn.addEventListener("click", onCheckMessage);
unlockBtn.addEventListener("click", onUnlock);

setMode("private");
