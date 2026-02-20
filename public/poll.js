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
const browserId = localStorage.getItem("poll_browser_id");

/* =======================
   LOAD POLL
======================= */
async function loadPoll() {
    const res = await fetch(`/api/polls/${pollId}`);
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
        const diffMs = new Date(pollData.expiresAt).getTime() - Date.now();

        if (diffMs <= 0) {
            timerSpan.textContent = "⛔ Poll expired";
            timerSpan.style.background = "#ffe0e0";
            timerSpan.style.borderColor = "#dc3545";
            timerSpan.style.color = "#721c24";
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
    selectedIndexes.has(i)
        ? (selectedIndexes.delete(i), row.classList.remove("selected"))
        : (selectedIndexes.add(i), row.classList.add("selected"));
}

/* =======================
   SUBMIT VOTE
======================= */
async function submitVote() {
    if (selectedIndexes.size === 0) {
        alert("Please select at least one option");
        return;
    }

    const res = await fetch(`/api/polls/${pollId}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selectedIndexes: [...selectedIndexes], browserId })
    });

    if (!res.ok) {
        alert("Already voted or poll expired");
        return;
    }

    pollData = await res.json();
    showResults();
}

/* =======================
   RESULTS - WhatsApp Style (FIXED)
======================= */
function showResults() {
    output.innerHTML = "";

    // Results container
    const container = document.createElement("div");
    container.className = "results-container";

    // Question heading - CLEARLY STYLED
    const questionBox = document.createElement("div");
    questionBox.className = "question-box";
    questionBox.innerHTML = `
        <div class="question-label">Question:</div>
        <div class="question-text">${pollData.question}</div>
    `;
    container.appendChild(questionBox);

    // Vote count
    const totalVotes = pollData.options.reduce((sum, o) => sum + o.votes, 0);
    const voteCount = document.createElement("p");
    voteCount.className = "vote-count-text";
    voteCount.textContent = `${totalVotes} ${totalVotes === 1 ? 'person' : 'people'} voted`;
    container.appendChild(voteCount);

    // Results heading
    const resultsHeading = document.createElement("div");
    resultsHeading.className = "results-heading";
    resultsHeading.textContent = "Results:";
    container.appendChild(resultsHeading);

    // Find max votes for highlighting winner
    const maxVotes = Math.max(...pollData.options.map(o => o.votes));
    
    // Count how many options have max votes (to detect ties)
    const winnersCount = pollData.options.filter(o => o.votes === maxVotes).length;
    const isTie = winnersCount > 1 && maxVotes > 0;

    // Create result boxes
    pollData.options.forEach(option => {
        const percentage = totalVotes > 0 ? Math.round((option.votes / totalVotes) * 100) : 0;
        const isWinner = option.votes === maxVotes && maxVotes > 0 && !isTie;

        const box = document.createElement("div");
        box.className = "result-box" + (isWinner ? " winner" : "");

        box.innerHTML = `
            <div class="result-top">
                <span class="option-name">
                    ${option.text}
                    ${isWinner ? '<span class="winner-badge">🏆 Winner</span>' : ''}
                    ${isTie && option.votes === maxVotes && maxVotes > 0 ? '<span class="tie-badge">🤝 Tie</span>' : ''}
                </span>
                <span class="vote-stats">${percentage}% (${option.votes})</span>
            </div>
            <div class="result-bar">
                <div class="result-fill" style="width: ${percentage}%"></div>
            </div>
        `;

        container.appendChild(box);
    });

    output.appendChild(container);

    // Show "Create New Poll" button if poll creator and poll expired
    if (pollData.createdBy === browserId && isExpired()) {
        const newPollBtn = document.createElement("button");
        newPollBtn.className = "start-btn";
        newPollBtn.textContent = "🔄 Create New Poll";
        newPollBtn.style.marginTop = "16px";
        newPollBtn.style.width = "100%";
        newPollBtn.onclick = confirmNewPoll;
        output.appendChild(newPollBtn);
    }
}

/* =======================
   CREATE NEW POLL (AFTER EXPIRY)
======================= */
function confirmNewPoll() {
    const confirmed = confirm(
        "Do you want to create a new poll?\n\n" +
        "You will be redirected to the poll creation page."
    );
    
    if (confirmed) {
        window.location.href = "/";
    }
}

/* =======================
   INIT
======================= */
document.addEventListener("DOMContentLoaded", loadPoll);