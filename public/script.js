/* =======================
   GLOBAL STATE
======================= */
let isCreatingPoll = false;
let pollData = null;
let selectedIndexes = new Set();
let hasVoted = false;

let timerInterval = null;
let timerSpan = null;

const output = document.getElementById("output");
const optionsContainer = document.getElementById("optionsContainer");

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
   OPTION INPUT HANDLING
======================= */
function createOption(value = "") {
    const row = document.createElement("div");
    row.className = "option-row";

    const input = document.createElement("input");
    input.placeholder = "Option";
    input.value = value;

    const del = document.createElement("span");
    del.textContent = "✖";
    del.className = "delete-btn";

    del.onclick = () => {
        row.remove();
        normalizeOptions();
    };

    input.addEventListener("input", normalizeOptions);

    row.appendChild(input);
    row.appendChild(del);
    return row;
}

function normalizeOptions() {
    const rows = [...optionsContainer.children];

    // remove empty middle rows
    rows.slice(0, -1).forEach(r => {
        const val = r.querySelector("input").value.trim();
        if (!val) r.remove();
    });

    const updated = [...optionsContainer.children];
    const last = updated[updated.length - 1];

    updated.forEach(row => {
        const input = row.querySelector("input");
        const btn = row.querySelector(".delete-btn");
        const show = input.value.trim() && row !== last;
        btn.style.opacity = show ? "1" : "0";
        btn.style.pointerEvents = show ? "auto" : "none";
    });

    if (last.querySelector("input").value.trim()) {
        optionsContainer.appendChild(createOption());
    }
}

/* =======================
   CREATE POLL
======================= */
async function startPoll() {
    if (isCreatingPoll) return;
    isCreatingPoll = true;

    const question = document.getElementById("questionInput").value.trim();
    const options = [...optionsContainer.querySelectorAll("input")]
        .map(i => i.value.trim())
        .filter(Boolean);

    if (!question || options.length < 2) {
        alert("Enter a question and at least 2 options");
        isCreatingPoll = false;
        return;
    }

    const minutes = Number(prompt("Poll expiry (minutes)?", "10")) || 10;
    const expiryTime = Date.now() + minutes * 60000;
    localStorage.setItem("pollExpiry", expiryTime);

    const res = await fetch("/api/polls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, options })
    });

    pollData = await res.json();
    renderVotingUI();
    startExpiryTimer();

    isCreatingPoll = false;
}

/* =======================
   TIMER
======================= */
function startExpiryTimer() {
    clearInterval(timerInterval);

    if (!timerSpan) {
        timerSpan = document.createElement("span");
        timerSpan.style.fontWeight = "600";
        timerSpan.style.display = "block";
        timerSpan.style.marginBottom = "10px";
        output.prepend(timerSpan);
    }

    timerInterval = setInterval(() => {
        const diff = Number(localStorage.getItem("pollExpiry")) - Date.now();

        if (diff <= 0) {
            timerSpan.textContent = "⛔ Poll expired";
            clearInterval(timerInterval);
            showResults();
            return;
        }

        const m = Math.floor(diff / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        timerSpan.textContent = `⏳ ${m}m ${s}s`;
    }, 1000);
}

/* =======================
   VOTING UI
======================= */
function renderVotingUI() {
    output.innerHTML = `<h3>${pollData.question}</h3>`;

    pollData.options.forEach((opt, i) => {
        const row = document.createElement("div");
        row.className = "result-row";
        row.innerHTML = `
            <span>${opt.text}</span>
            <span class="check">✓</span>
        `;
        row.onclick = () => toggleSelect(i, row);
        output.appendChild(row);
    });

    const submitBox = document.createElement("div");
    submitBox.className = "submit-box";

    const btn = document.createElement("button");
    btn.className = "start-btn";
    btn.textContent = "Submit Vote";
    btn.onclick = submitVote;

    submitBox.appendChild(btn);
    submitBox.appendChild(timerSpan);
    output.appendChild(submitBox);

    renderShareBox();
}

function toggleSelect(i, el) {
    if (hasVoted || isExpired()) return;

    if (selectedIndexes.has(i)) {
        selectedIndexes.delete(i);
        el.classList.remove("selected");
    } else {
        selectedIndexes.add(i);
        el.classList.add("selected");
    }
}

/* =======================
   SUBMIT VOTE
======================= */
async function submitVote() {
    if (hasVoted || isExpired()) return;

    if (selectedIndexes.size === 0) {
        alert("Select at least one option");
        return;
    }

    const res = await fetch(`/api/polls/${pollData._id}/vote`, {
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
    localStorage.setItem(`voted_${pollData._id}`, "1");

    showResults();
}

/* =======================
   RESULTS (HIDDEN TILL EXPIRY)
======================= */
function showResults() {
    if (!isExpired()) return;

    output.innerHTML = `<h3>Results</h3>`;

    const totalVotes = pollData.options.reduce((s, o) => s + o.votes, 0);
    const maxVotes = Math.max(...pollData.options.map(o => o.votes));

    pollData.options.forEach(o => {
        const percent = totalVotes
            ? Math.round((o.votes / totalVotes) * 100)
            : 0;

        const box = document.createElement("div");
        box.className = "result-box";

        if (o.votes === maxVotes && maxVotes > 0) {
            box.style.border = "2px solid #25d366";
        }

        box.innerHTML = `
            <div class="result-top">
                <span>${o.text}</span>
                <span>${percent}% (${o.votes})</span>
            </div>
            <div class="result-bar">
                <div class="result-fill" style="width:${percent}%"></div>
            </div>
        `;

        output.appendChild(box);
    });

    const voters = document.createElement("p");
    voters.style.fontWeight = "600";
    voters.textContent = `👥 Total voters: ${totalVotes}`;
    output.appendChild(voters);
}

/* =======================
   SHARE BOX
======================= */
function renderShareBox() {
    const share = document.createElement("div");
    share.className = "share-box";

    const pollUrl = `${location.origin}/poll/${pollData._id}`;
    const adminUrl = `${pollUrl}?admin=1`;

    share.innerHTML = `
        <h4>Share this poll</h4>

        <div class="share-input-row">
            <input id="pollLink" value="${pollUrl}" readonly>
            <button class="copy-btn" onclick="copyLink('pollLink')">📋</button>
        </div>

        <div class="share-input-row">
            <input id="adminLink" value="${adminUrl}" readonly>
            <button class="copy-btn" onclick="copyLink('adminLink')">🔒</button>
        </div>

        <div class="share-actions">
            <a class="share-btn whatsapp" target="_blank"
               href="https://wa.me/?text=${encodeURIComponent(pollUrl)}">WhatsApp</a>
            <a class="share-btn telegram" target="_blank"
               href="https://t.me/share/url?url=${encodeURIComponent(pollUrl)}">Telegram</a>
        </div>
    `;

    output.appendChild(share);
}

function copyLink(id) {
    const input = document.getElementById(id);
    input.select();
    input.setSelectionRange(0, 99999);
    navigator.clipboard.writeText(input.value);
    alert("Link copied");
}

/* =======================
   HELPERS
======================= */
function isExpired() {
    return Date.now() > Number(localStorage.getItem("pollExpiry"));
}

/* =======================
   RESET
======================= */
function resetPoll() {
    if (!confirm("Reset poll?")) return;

    clearInterval(timerInterval);
    timerInterval = null;
    timerSpan?.remove();
    timerSpan = null;

    pollData = null;
    hasVoted = false;
    selectedIndexes.clear();
    localStorage.removeItem("pollExpiry");

    output.innerHTML = "";
    document.getElementById("questionInput").value = "";

    optionsContainer.innerHTML = "";
    optionsContainer.appendChild(createOption());
    optionsContainer.appendChild(createOption());
}

/* =======================
   INIT
======================= */
document.addEventListener("DOMContentLoaded", () => {
    optionsContainer.appendChild(createOption());
    optionsContainer.appendChild(createOption());
});
