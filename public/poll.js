console.log("poll.js loaded");

let pollData = null;
let selectedIndexes = new Set();
let hasVoted = false;

// timer refs
let timerInterval = null;
let timerSpan = null;

const output = document.getElementById("output");

// extract poll id
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
    let attempts = 0;

    while (attempts < 5) {
        try {
            const res = await fetch(`/api/polls/${pollId}`);
            if (!res.ok) throw new Error("Poll not ready");

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

            return;
        } catch (err) {
            attempts++;
            await new Promise(r => setTimeout(r, 400));
        }
    }

    output.innerHTML = "Failed to load poll";
}

/* =======================
   TIMER
======================= */
function renderTimer() {
    if (timerSpan) return;

    timerSpan = document.createElement("span");
    timerSpan.id = "timerContainer";
    timerSpan.textContent = `⏳ Time left: ${getRemainingTime()}`;

    output.before(timerSpan);
}

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

    if (hasVoted || isPollExpired()) {
        btn.disabled = true;
    }

    submitBox.appendChild(btn);
    submitBox.appendChild(timerSpan);
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
            body: JSON.stringify({ selectedIndexes: [...selectedIndexes] })
        });

        if (!res.ok) {
            alert("Vote failed");
            return;
        }

        pollData = await res.json();
        hasVoted = true;
        localStorage.setItem(voteLockKey, "true");

        showResults();
    } catch (err) {
        alert("Server error");
    }
}

/* =======================
   RESULTS
======================= */
function showResults() {
    const total = pollData.options.reduce((s, o) => s + o.votes, 0) || 1;

    const resultsWrap = document.createElement("div");
    resultsWrap.className = "results-container";
    resultsWrap.innerHTML = `<h3>Results</h3>`;

    pollData.options.forEach(opt => {
        const percent = Math.round((opt.votes / total) * 100);

        const box = document.createElement("div");
        box.className = "result-box";
        box.innerHTML = `
            <div class="result-top">
                <span>${opt.text}</span>
                <span>${percent}% (${opt.votes})</span>
            </div>
            <div class="result-bar">
                <div class="result-fill" style="width:${percent}%"></div>
            </div>
        `;

        resultsWrap.appendChild(box);
    });

    output.appendChild(resultsWrap);
}

document.addEventListener("DOMContentLoaded", loadPoll);
