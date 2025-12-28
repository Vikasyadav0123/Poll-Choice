console.log("poll.js loaded");

let pollData = null;
let selectedIndexes = new Set();
let hasVoted = false;

let timerInterval = null;
let timerSpan = null;

const output = document.getElementById("output");

/* =======================
   BROWSER ID
======================= */
const BROWSER_ID_KEY = "poll_browser_id";
let browserId = localStorage.getItem(BROWSER_ID_KEY);

if (!browserId) {
    browserId = crypto.randomUUID();
    localStorage.setItem(BROWSER_ID_KEY, browserId);
}

/* =======================
   GET POLL ID
======================= */
const match = window.location.pathname.match(/^\/poll\/([a-f0-9]{24})$/);
if (!match) {
    output.innerHTML = "Invalid poll link";
    throw new Error("Invalid poll URL");
}
const pollId = match[1];

/* =======================
   LOAD POLL
======================= */
async function loadPoll() {
    try {
        const res = await fetch(`/api/polls/${pollId}`);
        if (!res.ok) throw new Error("Failed");

        pollData = await res.json();

        renderTimer();
        startExpiryTimer();
        renderVoting();

        if (isPollExpired()) {
            showResults();
        }
    } catch {
        output.innerHTML = "Failed to load poll";
    }
}

/* =======================
   TIMER
======================= */
function renderTimer() {
    if (timerSpan) return;
    timerSpan = document.createElement("div");
    timerSpan.style.marginBottom = "10px";
    timerSpan.style.fontWeight = "600";
    output.before(timerSpan);
}

function isPollExpired() {
    return new Date(pollData.expiresAt) <= Date.now();
}

function getRemainingTime() {
    const diff = new Date(pollData.expiresAt) - Date.now();
    if (diff <= 0) return "Expired";

    const m = Math.floor(diff / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    return `${m}m ${s}s`;
}

function startExpiryTimer() {
    clearInterval(timerInterval);

    timerInterval = setInterval(() => {
        if (isPollExpired()) {
            timerSpan.textContent = "⛔ Poll expired";
            clearInterval(timerInterval);
            showResults();
            return;
        }
        timerSpan.textContent = `⏳ Time left: ${getRemainingTime()}`;
    }, 1000);
}

/* =======================
   VOTING UI
======================= */
function renderVoting() {
    output.innerHTML = `
        <h3>${pollData.question}</h3>
        <p style="opacity:.6">Tap option(s) to vote</p>
    `;

    pollData.options.forEach((opt, index) => {
        const row = document.createElement("div");
        row.className = "result-row";
        row.innerHTML = `<span>${opt.text}</span>`;
        row.onclick = () => toggleSelect(index, row);
        output.appendChild(row);
    });

    const btn = document.createElement("button");
    btn.className = "start-btn";
    btn.textContent = "Submit Vote";
    btn.onclick = submitVote;

    if (isPollExpired()) btn.disabled = true;
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
    if (selectedIndexes.size === 0) return alert("Select at least one option");

    try {
        const res = await fetch(`/api/polls/${pollId}/vote`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                selectedIndexes: [...selectedIndexes],
                browserId
            })
        });

        if (!res.ok) {
            alert("Already voted or poll expired");
            return;
        }

        pollData = await res.json();
        hasVoted = true;
        showResults();
    } catch {
        alert("Server error");
    }
}

/* =======================
   RESULTS
======================= */
function showResults() {
    output.innerHTML = "<h3>Results</h3>";

    const total = pollData.options.reduce((s, o) => s + o.votes, 0) || 1;

    pollData.options.forEach(opt => {
        const percent = Math.round((opt.votes / total) * 100);
        output.innerHTML += `<p>${opt.text}: ${percent}% (${opt.votes})</p>`;
    });
}

/* =======================
   INIT
======================= */
document.addEventListener("DOMContentLoaded", loadPoll);
