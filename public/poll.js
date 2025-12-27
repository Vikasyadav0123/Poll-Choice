console.log("poll.js loaded");

let pollData = null;
let selectedIndexes = new Set();
let hasVoted = false;

let timerInterval = null;
let timerSpan = null;

const output = document.getElementById("output");

/* =======================
   STRONG BROWSER ID
======================= */
const BROWSER_ID_KEY = "poll_browser_id";
let browserId = localStorage.getItem(BROWSER_ID_KEY);
if (!browserId) {
    browserId = crypto.randomUUID();
    localStorage.setItem(BROWSER_ID_KEY, browserId);
}

/* =======================
   POLL ID
======================= */
const match = window.location.pathname.match(/^\/poll\/([a-f0-9]{24})$/);
if (!match) {
    output.innerHTML = "Invalid poll link";
    throw new Error("Invalid poll URL");
}

const pollId = match[1];
const voteLockKey = `voted_poll_${pollId}`;
const EXPIRY_KEY = "pollExpiry";

/* =======================
   LOAD POLL
======================= */
async function loadPoll() {
    try {
        const res = await fetch(`/api/polls/${pollId}`);
        if (!res.ok) throw new Error("Poll not found");

        pollData = await res.json();

        ensureExpiryExists();
        renderTimer();
        startExpiryTimer();

        if (localStorage.getItem(voteLockKey)) {
            hasVoted = true;
        }

        renderVoting();

        if (hasVoted || isPollExpired()) {
            showResults();
        }
    } catch {
        output.innerHTML = "Failed to load poll";
    }
}

/* =======================
   TIMER
======================= */
function ensureExpiryExists() {
    if (!localStorage.getItem(EXPIRY_KEY)) {
        localStorage.setItem(EXPIRY_KEY, Date.now() + 10 * 60 * 1000);
    }
}

function isPollExpired() {
    return Date.now() > Number(localStorage.getItem(EXPIRY_KEY));
}

function getRemainingTime() {
    const diff = Number(localStorage.getItem(EXPIRY_KEY)) - Date.now();
    if (diff <= 0) return "Expired";
    const m = Math.floor(diff / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    return `${m}m ${s}s`;
}

function renderTimer() {
    if (timerSpan) return;
    timerSpan = document.createElement("span");
    timerSpan.textContent = `⏳ Time left: ${getRemainingTime()}`;
    output.before(timerSpan);
}

function startExpiryTimer() {
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        if (isPollExpired()) {
            timerSpan.textContent = "⛔ Poll expired";
            clearInterval(timerInterval);
            return;
        }
        timerSpan.textContent = `⏳ Time left: ${getRemainingTime()}`;
    }, 1000);
}

/* =======================
   VOTING UI
======================= */
function renderVoting() {
    output.innerHTML = `<h3>${pollData.question}</h3>`;

    pollData.options.forEach((opt, index) => {
        const row = document.createElement("div");
        row.className = "result-row";
        row.textContent = opt.text;
        row.onclick = () => toggleSelect(index, row);
        output.appendChild(row);
    });

    const btn = document.createElement("button");
    btn.textContent = "Submit Vote";
    btn.onclick = submitVote;
    btn.disabled = hasVoted || isPollExpired();

    output.appendChild(btn);
}

function toggleSelect(index, row) {
    if (hasVoted || isPollExpired()) return;

    if (selectedIndexes.has(index)) {
        selectedIndexes.delete(index);
        row.classList.remove("selected");
    } else {
        selectedIndexes.add(index);
        row.classList.add("selected");
    }
}

/* =======================
   SUBMIT VOTE
======================= */
async function submitVote() {
    if (hasVoted || isPollExpired()) return;

    if (selectedIndexes.size === 0) {
        alert("Select at least one option");
        return;
    }

    const res = await fetch(`/api/polls/${pollId}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            selectedIndexes: [...selectedIndexes],
            browserId
        })
    });

    if (!res.ok) {
        alert("Already voted");
        return;
    }

    pollData = await res.json();
    hasVoted = true;
    localStorage.setItem(voteLockKey, "true");
    showResults();
}

/* =======================
   RESULTS
======================= */
function showResults() {
    output.innerHTML = "<h3>Results</h3>";

    const total = pollData.options.reduce((s, o) => s + o.votes, 0) || 1;

    pollData.options.forEach(o => {
        const p = Math.round((o.votes / total) * 100);
        output.innerHTML += `<p>${o.text}: ${p}% (${o.votes})</p>`;
    });
}

document.addEventListener("DOMContentLoaded", loadPoll);
