let isCreatingPoll = false;
let pollData = null;
let selectedIndexes = new Set();
let hasVoted = false;

let timerInterval = null;
let timerSpan = null;

const output = document.getElementById("output");
const optionsContainer = document.getElementById("optionsContainer");

/* =======================
   BROWSER ID (ANTI REFRESH)
======================= */
const BROWSER_ID_KEY = "poll_browser_id";
let browserId = localStorage.getItem(BROWSER_ID_KEY);
if (!browserId) {
    browserId = crypto.randomUUID();
    localStorage.setItem(BROWSER_ID_KEY, browserId);
}

/* =======================
   CREATE OPTION INPUT
======================= */
function createOption(value = "") {
    const wrapper = document.createElement("div");
    wrapper.className = "option-row";

    const input = document.createElement("input");
    input.placeholder = "Option";
    input.value = value;

    const delBtn = document.createElement("span");
    delBtn.textContent = "✖";
    delBtn.className = "delete-btn";
    delBtn.style.opacity = "0";
    delBtn.style.pointerEvents = "none";

    delBtn.onclick = () => {
        wrapper.remove();
        normalizeOptions();
    };

    input.addEventListener("input", normalizeOptions);

    wrapper.appendChild(input);
    wrapper.appendChild(delBtn);
    return wrapper;
}

/* =======================
   OPTIONS NORMALIZER
======================= */
function normalizeOptions() {
    let rows = [...optionsContainer.children];

    for (let i = 0; i < rows.length - 1; i++) {
        const input = rows[i].querySelector("input");
        if (!input.value.trim()) rows[i].remove();
    }

    rows = [...optionsContainer.children];
    const last = rows[rows.length - 1];

    rows.forEach(row => {
        const input = row.querySelector("input");
        const btn = row.querySelector(".delete-btn");
        btn.style.opacity = input.value && row !== last ? "1" : "0";
        btn.style.pointerEvents = input.value && row !== last ? "auto" : "none";
    });

    if (last && last.querySelector("input").value.trim()) {
        optionsContainer.appendChild(createOption());
    }
}

/* =======================
   START POLL
======================= */
async function startPoll() {
    if (isCreatingPoll) return;
    isCreatingPoll = true;

    const question = document.getElementById("questionInput").value.trim();
    const options = [...optionsContainer.querySelectorAll("input")]
        .map(i => i.value.trim())
        .filter(Boolean);

    if (!question || options.length < 2) {
        alert("Enter question and at least 2 options");
        isCreatingPoll = false;
        return;
    }

    const minutes = Number(prompt("Poll expiry (minutes)?", "10")) || 10;

    // 🔽 ADDED: still keep localStorage (your logic)
    localStorage.setItem("pollExpiry", Date.now() + minutes * 60000);

    try {
        const res = await fetch("/api/polls", {
            method: "POST",
            headers: { "Content-Type": "application/json" },

            // 🔽 ADDED: send duration to server
            body: JSON.stringify({
                question,
                options,
                durationMinutes: minutes
            })
        });

        if (!res.ok) throw new Error();

        pollData = await res.json();
        renderVoteUI();
        renderShareBox();
        startExpiryTimer();
    } catch {
        alert("Failed to create poll");
    }

    isCreatingPoll = false;
}

/* =======================
   TIMER (DB + FALLBACK)
======================= */
function startExpiryTimer() {
    if (!timerSpan) {
        timerSpan = document.createElement("div");
        timerSpan.style.fontWeight = "600";
        timerSpan.style.marginTop = "10px";
    }

    clearInterval(timerInterval);

    timerInterval = setInterval(() => {

        // 🔽 ADDED: prefer DB expiry
        let expiry = pollData?.expiresAt
            ? new Date(pollData.expiresAt).getTime()
            : Number(localStorage.getItem("pollExpiry"));

        const diff = Math.ceil((expiry - Date.now()) / 1000);

        if (diff <= 0) {
            timerSpan.textContent = "⛔ Poll expired";
            clearInterval(timerInterval);
            showResults();
            return;
        }

        timerSpan.textContent = `⏳ ${Math.floor(diff / 60)}m ${diff % 60}s`;
    }, 1000);
}

/* =======================
   VOTING UI
======================= */
function renderVoteUI() {
    output.innerHTML = "";

    const title = document.createElement("h3");
    title.textContent = pollData.question;
    output.appendChild(title);

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

    if (timerSpan) output.appendChild(timerSpan);
}

function toggleSelect(i, el) {
    if (hasVoted) return;

    selectedIndexes.has(i)
        ? (selectedIndexes.delete(i), el.classList.remove("selected"))
        : (selectedIndexes.add(i), el.classList.add("selected"));
}

/* =======================
   SUBMIT VOTE
======================= */
async function submitVote() {
    if (hasVoted || selectedIndexes.size === 0) return;

    try {
        const res = await fetch(`/api/polls/${pollData._id}/vote`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                selectedIndexes: [...selectedIndexes],
                browserId
            })
        });

        if (!res.ok) throw new Error();

        pollData = await res.json();
        hasVoted = true;
        showResults();
    } catch {
        alert("Vote failed");
    }
}

/* =======================
   SHARE BOX
======================= */
function renderShareBox() {
    const pollUrl = `${window.location.origin}/poll/${pollData._id}`;

    const box = document.createElement("div");
    box.className = "share-box";

    box.innerHTML = `
        <div class="share-input-row">
            <input type="text" value="${pollUrl}" readonly />
            <button class="copy-btn">📋</button>
        </div>
        <div class="share-actions">
            <a class="share-btn whatsapp" target="_blank"
               href="https://wa.me/?text=${encodeURIComponent(pollUrl)}">
               WhatsApp
            </a>
            <a class="share-btn telegram" target="_blank"
               href="https://t.me/share/url?url=${encodeURIComponent(pollUrl)}">
               Telegram
            </a>
        </div>
    `;

    const copyBtn = box.querySelector(".copy-btn");

    copyBtn.onclick = async () => {
        await navigator.clipboard.writeText(pollUrl);
        copyBtn.textContent = "✔";
        setTimeout(() => (copyBtn.textContent = "📋"), 1000);
    };

    output.appendChild(box);
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

    pollData.options.forEach(o => {
        const percent = Math.round((o.votes / total) * 100);

        const box = document.createElement("div");
        box.className = "result-box";

        box.innerHTML = `
            <div class="result-top">
                <span>${o.text}</span>
                <span>${percent}% (${o.votes})</span>
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
   RESET
======================= */
function resetPoll() {
    if (!confirm("Reset poll?")) return;

    clearInterval(timerInterval);
    timerInterval = null;
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
