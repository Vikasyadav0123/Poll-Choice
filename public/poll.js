console.log("poll.js loaded");

/* =======================
   GLOBAL STATE
======================= */
let pollData = null;
let selectedIndexes = new Set();
let hasVoted = false;

let timerInterval = null;
let refreshInterval = null;
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
   POLL ID + ADMIN CHECK
======================= */
const match = window.location.pathname.match(/^\/poll\/([a-f0-9]{24})$/);
if (!match) {
    output.innerHTML = "Invalid poll link";
    throw new Error("Invalid poll URL");
}

const pollId = match[1];
const urlParams = new URLSearchParams(window.location.search);
const adminSecret = urlParams.get("admin");
const isAdmin = Boolean(adminSecret);

const VOTE_LOCK_KEY = `voted_poll_${pollId}`;

/* =======================
   LOAD POLL
======================= */
async function loadPoll(initial = false) {
    try {
        const res = await fetch(`/api/polls/${pollId}`);
        if (!res.ok) throw new Error("Poll not found");

        pollData = await res.json();

        renderTimer();
        startExpiryTimer();

        // frontend anti-refresh lock
        if (localStorage.getItem(VOTE_LOCK_KEY)) {
            hasVoted = true;
        }

        if (shouldShowResults()) {
            showResults();
        } else {
            renderVoting();
        }

        if (initial && isAdmin) {
            startLiveRefresh();
        }

    } catch {
        output.innerHTML = "Poll not found or deleted";
    }
}

/* =======================
   RESULT VISIBILITY RULE
======================= */
function shouldShowResults() {
    if (isAdmin) return true;
    if (isPollExpired()) return true;
    if (hasVoted) return true;
    return false;
}

/* =======================
   LIVE REFRESH (ADMIN)
======================= */
function startLiveRefresh() {
    clearInterval(refreshInterval);

    refreshInterval = setInterval(async () => {
        try {
            const res = await fetch(`/api/polls/${pollId}`);
            if (!res.ok) return;

            pollData = await res.json();
            showResults();
        } catch { }
    }, 3000);
}

/* =======================
   TIMER
======================= */
function isPollExpired() {
    return Date.now() > new Date(pollData.expiresAt).getTime();
}

function getRemainingTime() {
    const diff = new Date(pollData.expiresAt).getTime() - Date.now();
    if (diff <= 0) return "Expired";

    const m = Math.floor(diff / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    return `${m}m ${s}s`;
}

function renderTimer() {
    if (timerSpan) return;

    timerSpan = document.createElement("div");
    timerSpan.style.fontWeight = "600";
    timerSpan.style.marginBottom = "10px";
    output.before(timerSpan);
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
        row.innerHTML = `
            <span>${opt.text}</span>
            <span class="check">✓</span>
        `;
        row.onclick = () => toggleSelect(index, row);
        output.appendChild(row);
    });

    const submitBox = document.createElement("div");
    submitBox.className = "submit-box";

    const btn = document.createElement("button");
    btn.className = "start-btn";
    btn.textContent = "Submit Vote";
    btn.onclick = submitVote;

    submitBox.appendChild(btn);
    output.appendChild(submitBox);
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
            alert("You already voted");
            hasVoted = true;
            localStorage.setItem(VOTE_LOCK_KEY, "true");
            showResults();
            return;
        }

        pollData = await res.json();
        hasVoted = true;
        localStorage.setItem(VOTE_LOCK_KEY, "true");
        showResults();

    } catch {
        alert("Server error");
    }
}

/* =======================
   RESULTS (ADMIN + USER)
======================= */
function showResults() {
    output.innerHTML = `<h3>${pollData.question}</h3>`;

    const totalVotes = pollData.options.reduce((s, o) => s + o.votes, 0);
    const maxVotes = Math.max(...pollData.options.map(o => o.votes));

    const totalBox = document.createElement("div");
    totalBox.className = "results-container";
    totalBox.innerHTML = `<strong>Total voters: ${totalVotes}</strong>`;
    output.appendChild(totalBox);

    pollData.options.forEach(opt => {
        const percent = totalVotes
            ? Math.round((opt.votes / totalVotes) * 100)
            : 0;

        const isWinner = opt.votes === maxVotes && maxVotes > 0;

        const box = document.createElement("div");
        box.className = `result-box ${isWinner ? "winner" : ""}`;

        box.innerHTML = `
            <div class="result-top">
                <span>${isWinner ? "🏆 " : ""}${opt.text}</span>
                <span>${percent}% (${opt.votes})</span>
            </div>
            <div class="result-bar">
                <div class="result-fill" style="width:${percent}%"></div>
            </div>
        `;

        output.appendChild(box);
    });

    if (isAdmin) {
        const adminNote = document.createElement("p");
        adminNote.style.opacity = ".6";
        adminNote.style.marginTop = "10px";
        adminNote.textContent = "Admin view: live results enabled";
        output.appendChild(adminNote);
    }
}

/* =======================
   INIT
======================= */
document.addEventListener("DOMContentLoaded", () => {
    loadPoll(true);
});
