let isCreatingPoll = false;

const output = document.getElementById("output");
const optionsContainer = document.getElementById("optionsContainer");

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
        btn.style.display = input.value && row !== last ? "block" : "none";
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

    let minutes = prompt("Poll expiry (minutes)?", "10");
    minutes = Number(minutes);

    if (!minutes || minutes <= 0) {
        minutes = 10;
    }

    try {
        const res = await fetch("/api/polls", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                question,
                options,
                durationMinutes: minutes
            })
        });

        if (!res.ok) {
            alert("Failed to create poll");
            isCreatingPoll = false;
            return;
        }

        const poll = await res.json();

        // Redirect to poll page
        window.location.href = `/poll/${poll._id}`;
    } catch (err) {
        alert("Server error");
    }

    isCreatingPoll = false;
}

/* =======================
   RESET
======================= */
function resetPoll() {
    if (!confirm("Reset poll?")) return;

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
