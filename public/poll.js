let pollData = null;
let selectedIndexes = new Set();
let hasVoted = false;

let timerInterval = null;
let timerSpan = null;

const output = document.getElementById("output");

const match = location.pathname.match(/\/poll\/([a-f0-9]{24})/);
if (!match) {
    output.textContent = "Invalid poll link";
    throw new Error("Invalid poll");
}

const pollId = match[1];

let browserId = localStorage.getItem("poll_browser_id");
if (!browserId) {
    browserId = crypto.randomUUID();
    localStorage.setItem("poll_browser_id", browserId);
}

/* =======================
   LOAD POLL
======================= */
async function loadPoll() {
    const res = await fetch(
        `https://poll-choice.onrender.com/api/polls/${pollId}`
    );

    if (!res.ok) {
        output.textContent = "Failed to load poll";
        return;
    }

    pollData = await res.json();

    renderTimer();

    if (pollData.votedBy.includes(browserId) || isExpired()) {
        showResults();
    } else {
        renderVoting();
    }

    startTimer();
}

/* =======================
   TIMER
======================= */
function isExpired() {
    return Date.now() >= new Date(pollData.expiresAt).getTime();
}

function renderTimer() {
    timerSpan = document.createElement("div");
    timerSpan.className = "timer-box";
    output.before(timerSpan);
}

function startTimer() {
    clearInterval(timerInterval);

    timerInterval = setInterval(() => {
        const diffMs =
            new Date(pollData.expiresAt).getTime() - Date.now();

        if (diffMs <= 0) {
            timerSpan.textContent = "⛔ Poll expired";
            clearInterval(timerInterval);
            showResults();
            return;
        }

        const diff = Math.ceil(diffMs / 1000);
        const minutes = Math.floor(diff / 60);
        const seconds = diff % 60;
        timerSpan.textContent = `⏳ Time left: ${minutes}m ${seconds}s`;
    }, 1000);
}

/* =======================
   VOTING UI
======================= */
function renderVoting() {
    output.innerHTML = `<h3>${pollData.question}</h3>`;

    pollData.options.forEach((opt, i) => {
        const row = document.createElement("div");
        row.className = "result-row";
        row.textContent = opt.text;
        row.onclick = () => toggleSelect(i, row);
        output.appendChild(row);
    });

    const btn = document.createElement("button");
    btn.className = "start-btn";
    btn.textContent = "Submit Vote";
    btn.onclick = submitVote;
    output.appendChild(btn);
}

function toggleSelect(i, row) {
    if (selectedIndexes.has(i)) {
        selectedIndexes.delete(i);
        row.classList.remove("selected");
    } else {
        selectedIndexes.add(i);
        row.classList.add("selected");
    }
}

/* =======================
   SUBMIT VOTE (FIXED ROUTE)
======================= */
async function submitVote() {
    if (selectedIndexes.size === 0) {
        alert("Please select at least one option");
        return;
    }

    const res = await fetch(
        `https://poll-choice.onrender.com/api/polls/${pollId}/vote`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                selectedIndexes: [...selectedIndexes],
                browserId
            })
        }
    );

    if (!res.ok) {
        const errorData = await res.json();
        alert(errorData.error || "Vote failed");
        return;
    }

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

    const questionBox = document.createElement("div");
    questionBox.className = "question-box";
    questionBox.innerHTML = `
        <div class="question-label">Question:</div>
        <div class="question-text">${pollData.question}</div>
    `;
    container.appendChild(questionBox);

    const totalVotes = pollData.options.reduce(
        (sum, o) => sum + o.votes,
        0
    );

    pollData.options.forEach(option => {
        const percentage =
            totalVotes > 0
                ? Math.round((option.votes / totalVotes) * 100)
                : 0;

        const box = document.createElement("div");
        box.className = "result-box";

        box.innerHTML = `
            <div class="result-top">
                <span>${option.text}</span>
                <span>${percentage}% (${option.votes})</span>
            </div>
            <div class="result-bar">
                <div class="result-fill" style="width: ${percentage}%"></div>
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