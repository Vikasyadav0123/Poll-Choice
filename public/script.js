/* =======================
   GLOBAL STATE
======================= */
let isCreatingPoll = false;
let pollData = null;
let selectedIndexes = new Set();
let hasVoted = false;

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
   CREATOR SECRETS STORAGE
======================= */
const CREATOR_SECRETS_KEY = "creator_poll_secrets";

/*
Stored as:
[
  { pollId, secret }
]
*/
function getCreatorSecrets() {
    return JSON.parse(localStorage.getItem(CREATOR_SECRETS_KEY) || "[]");
}

function saveCreatorSecret(pollId, secret) {
    const list = getCreatorSecrets();
    list.push({ pollId, secret });
    localStorage.setItem(CREATOR_SECRETS_KEY, JSON.stringify(list));
}

/* =======================
   OPTION INPUT CREATION
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
   OPTIONS NORMALIZATION
======================= */
function normalizeOptions() {
    let rows = [...optionsContainer.children];

    // always keep at least 2
    while (rows.length < 2) {
        optionsContainer.appendChild(createOption());
        rows = [...optionsContainer.children];
    }

    for (let i = 0; i < rows.length - 1; i++) {
        const input = rows[i].querySelector("input");
        if (!input.value.trim()) rows[i].remove();
    }

    rows = [...optionsContainer.children];
    const last = rows[rows.length - 1];

    rows.forEach(row => {
        const input = row.querySelector("input");
        const btn = row.querySelector(".delete-btn");

        if (input.value.trim() && row !== last) {
            btn.style.opacity = "1";
            btn.style.pointerEvents = "auto";
        } else {
            btn.style.opacity = "0";
            btn.style.pointerEvents = "none";
        }
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
    const options = [...document.querySelectorAll("#optionsContainer input")]
        .map(i => i.value.trim())
        .filter(Boolean);

    if (!question || options.length < 2) {
        alert("Enter question and at least 2 options");
        isCreatingPoll = false;
        return;
    }

    const expiryMinutes =
        Number(prompt("Poll expiry in minutes?", "10")) || 10;

    try {
        const res = await fetch("/api/polls", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                question,
                options,
                expiryMinutes
            })
        });

        const data = await res.json();
        if (!res.ok) throw new Error();

        // store creator secret
        saveCreatorSecret(data.pollId, data.creatorSecret);

        const adminLink = `${location.origin}/poll/${data.pollId}?admin=${data.creatorSecret}`;

        alert(
            "Poll created!\n\nAdmin link (save this):\n" +
            adminLink
        );

        loadPollHistory();

    } catch {
        alert("Failed to create poll");
    }

    isCreatingPoll = false;
}

/* =======================
   POLL HISTORY (CREATOR)
======================= */
async function loadPollHistory() {
    const list = getCreatorSecrets();
    if (list.length === 0) return;

    const secrets = list.map(i => i.secret).join(",");

    try {
        const res = await fetch(`/api/creator/polls?secrets=${secrets}`);
        const polls = await res.json();

        renderPollHistory(polls, list);
    } catch {
        console.error("Failed to load history");
    }
}

function renderPollHistory(polls, secretList) {
    let history = document.getElementById("pollHistory");

    if (!history) {
        history = document.createElement("div");
        history.id = "pollHistory";
        history.style.marginTop = "24px";
        document.querySelector(".card").appendChild(history);
    }

    history.innerHTML = `
        <h3>Your Poll History</h3>
    `;

    if (polls.length === 0) {
        history.innerHTML += `<p style="opacity:.6">No polls yet</p>`;
        return;
    }

    polls.forEach(poll => {
        const secret = secretList.find(s => s.pollId === poll._id)?.secret;

        const row = document.createElement("div");
        row.className = "result-box";

        row.innerHTML = `
            <strong>${poll.question}</strong>
            <p style="opacity:.6">
                Votes: ${poll.totalVotes}<br>
                Created: ${new Date(poll.createdAt).toLocaleString()}
            </p>
        `;

        const openBtn = document.createElement("button");
        openBtn.className = "start-btn";
        openBtn.textContent = "Open";
        openBtn.onclick = () => {
            window.open(
                `/poll/${poll._id}?admin=${secret}`,
                "_blank"
            );
        };

        const delBtn = document.createElement("button");
        delBtn.className = "reset-btn";
        delBtn.textContent = "Delete";
        delBtn.style.marginLeft = "8px";

        delBtn.onclick = async () => {
            if (!confirm("Delete this poll permanently?")) return;

            await fetch(
                `/api/polls/${poll._id}?admin=${secret}`,
                { method: "DELETE" }
            );

            // remove from local storage
            const updated = getCreatorSecrets().filter(
                p => p.pollId !== poll._id
            );
            localStorage.setItem(
                CREATOR_SECRETS_KEY,
                JSON.stringify(updated)
            );

            loadPollHistory();
        };

        row.appendChild(openBtn);
        row.appendChild(delBtn);
        history.appendChild(row);
    });
}

/* =======================
   RESET UI
======================= */
function resetPoll() {
    document.getElementById("questionInput").value = "";
    output.innerHTML = "";
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
    loadPollHistory();
});
