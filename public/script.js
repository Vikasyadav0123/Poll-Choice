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
   CREATE OPTION
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
   OPTIONS LOGIC
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

    if (last.querySelector("input").value.trim()) {
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
    const options = [...document.querySelectorAll("#optionsContainer input")]
        .map(i => i.value.trim())
        .filter(Boolean);

    if (!question || options.length < 2) {
        alert("Enter question & at least 2 options");
        isCreatingPoll = false;
        return;
    }

    let minutes = Number(prompt("Poll expiry (minutes)?", "10")) || 10;
    localStorage.setItem("pollExpiry", Date.now() + minutes * 60000);

    const res = await fetch("/api/polls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, options, browserId })
    });

    const data = await res.json();
    pollData = data.poll;

    const shareLink = `${window.location.origin}${data.shareUrl}`;
    renderShareBox(shareLink);

    renderVoteUI();
    startExpiryTimer();

    isCreatingPoll = false;
}

/* =======================
   SHARE UI
======================= */
function renderShareBox(link) {
    const box = document.createElement("div");
    box.className = "results-container share-box";

    box.innerHTML = `
        <h3>🔗 Share this poll</h3>

        <div class="share-input-row">
            <input id="shareLinkInput" value="${link}" readonly />
            <button class="copy-btn" id="copyBtn">📋</button>
        </div>

        <div class="share-actions">
            <a class="share-btn whatsapp"
               href="https://wa.me/?text=${encodeURIComponent(link)}"
               target="_blank">WhatsApp</a>

            <a class="share-btn telegram"
               href="https://t.me/share/url?url=${encodeURIComponent(link)}"
               target="_blank">Telegram</a>

            <button class="share-btn native" id="nativeShareBtn">
                Share
            </button>
        </div>
    `;

    output.appendChild(box);

    // copy
    document.getElementById("copyBtn").onclick = () => {
        navigator.clipboard.writeText(link);
        document.getElementById("copyBtn").textContent = "✔";
        setTimeout(() => {
            document.getElementById("copyBtn").textContent = "📋";
        }, 1200);
    };

    // native share
    const nativeBtn = document.getElementById("nativeShareBtn");
    if (navigator.share) {
        nativeBtn.onclick = () => {
            navigator.share({
                title: "Vote in this poll",
                url: link
            });
        };
    } else {
        nativeBtn.style.display = "none";
    }
}


/* =======================
   TIMER
======================= */
function startExpiryTimer() {
    if (!timerSpan) {
        timerSpan = document.createElement("span");
        timerSpan.style.fontWeight = "600";
        timerSpan.style.display = "inline-block";
        timerSpan.style.marginBottom = "10px";
        output.appendChild(timerSpan);
    }

    clearInterval(timerInterval);

    timerInterval = setInterval(() => {
        const diff = Math.ceil(
            (Number(localStorage.getItem("pollExpiry")) - Date.now()) / 1000
        );

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
   VOTE UI
======================= */
function renderVoteUI() {
    output.innerHTML += `<h3>${pollData.question}</h3>`;

    pollData.options.forEach((opt, i) => {
        const div = document.createElement("div");
        div.className = "result-row";
        div.textContent = opt.text;
        div.onclick = () => toggleSelect(i, div);
        output.appendChild(div);
    });

    const btn = document.createElement("button");
    btn.textContent = "Submit Vote";
    btn.onclick = submitVote;
    output.appendChild(btn);
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
    if (hasVoted) return;

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

/* =======================
   INIT
======================= */
document.addEventListener("DOMContentLoaded", () => {
    optionsContainer.appendChild(createOption());
    optionsContainer.appendChild(createOption());
});
