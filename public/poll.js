console.log("poll.js loaded");

let pollData = null;
let selectedIndexes = new Set();
let hasVoted = false;

let timerInterval = null;
let timerSpan = null;

const output = document.getElementById("output");

/* =======================
   EXTRACT POLL ID
======================= */
const match = window.location.pathname.match(/^\/poll\/([a-f0-9]{24})$/);
if (!match) {
    output.innerHTML = "Invalid poll link";
    throw new Error("Invalid poll URL");
}

const pollId = match[1];
const voteLockKey = `voted_poll_${pollId}`;

/* =======================
   LOAD POLL (ALWAYS FRESH)
======================= */
async function loadPoll() {
    try {
        const res = await fetch(`/api/polls/${pollId}`);
        if (!res.ok) throw new Error();

        pollData = await res.json();

        if (localStorage.getItem(voteLockKey)) {
            hasVoted = true;
        }

        renderTimer();
        startExpiryTimer();

        if (isPollExpired() || hasVoted) {
            await refreshResults();   // ✅ FIX
        } else {
            renderVoting();
        }

    } catch {
        output.innerHTML = "Failed to load poll";
    }
}

/* =======================
   TIMER (DB BASED)
======================= */
function isPollExpired() {
    return Date.now() >= new Date(pollData.expiresAt).getTime();
}

function renderTimer() {
    if (timerSpan) return;

    timerSpan = document.createElement("div");
    timerSpan.className = "timer-box";
    output.before(timerSpan);
}

function startExpiryTimer() {
    clearInterval(timerInterval);

    timerInterval = setInterval(async () => {
        const diff = Math.ceil(
            (new Date(pollData.expiresAt).getTime() - Date.now()) / 1000
        );

        if (diff <= 0) {
            timerSpan.textContent = "⛔ Poll expired";
            clearInterval(timerInterval);
            await refreshResults();   // ✅ FIX
            return;
        }

        timerSpan.textContent = `⏳ Time left: ${Math.floor(diff / 60)}m ${diff % 60}s`;
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
        row.textContent = opt.text;
        row.onclick = () => toggleSelect(index, row);
        output.appendChild(row);
    });

    const btn = document.createElement("button");
    btn.className = "start-btn";
    btn.textContent = "Submit Vote";
    btn.onclick = submitVote;

    output.appendChild(btn);
}

function toggleSelect(index, row) {
    if (hasVoted || isPollExpired()) return;

    selectedIndexes.has(index)
        ? (selectedIndexes.delete(index), row.classList.remove("selected"))
        : (selectedIndexes.add(index), row.classList.add("selected"));
}

/* =======================
   SUBMIT VOTE
======================= */
async function submitVote() {
    if (hasVoted || selectedIndexes.size === 0) return;

    const res = await fetch(`/api/polls/${pollId}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            selectedIndexes: [...selectedIndexes],
            browserId: localStorage.getItem("poll_browser_id")
        })
    });

    if (!res.ok) {
        alert("Already voted or poll expired");
        return;
    }

    localStorage.setItem(voteLockKey, "true");
    hasVoted = true;

    await refreshResults();   // ✅ FIX
}

/* =======================
   REFRESH RESULTS (THE FIX)
======================= */
async function refreshResults() {
    const res = await fetch(`/api/polls/${pollId}`);
    if (!res.ok) return;

    pollData = await res.json();
    showResults();
}

/* =======================
   RESULTS
======================= */
function showResults() {
    output.innerHTML = "";

    const container = document.createElement("div");
    container.className = "results-container";

    const heading = document.createElement("h3");
    heading.textContent = "Results";
    container.appendChild(heading);

    const total = pollData.options.reduce((s, o) => s + o.votes, 0) || 1;

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

        container.appendChild(box);
    });

    output.appendChild(container);
}

/* =======================
   INIT
======================= */
document.addEventListener("DOMContentLoaded", loadPoll);
