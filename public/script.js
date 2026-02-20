let isCreatingPoll = false;
let pollData = null;
let selectedIndexes = new Set();
let hasVoted = false;

let timerInterval = null;
let timerSpan = null;
let pollExpired = false;

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
   OPTION INPUT
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

        btn.style.opacity =
            input.value && row !== last ? "1" : "0";

        btn.style.pointerEvents =
            input.value && row !== last ? "auto" : "none";
    });

    if (last && last.querySelector("input").value.trim()) {
        optionsContainer.appendChild(createOption());
    }
}

/* =======================
   CONFIRMATION MODAL
======================= */
function confirmAndStartPoll() {
    const question = document.getElementById("questionInput").value.trim();
    const expiryMinutes = Number(document.getElementById("expiryInput").value);
    
    const optionInputs = document.querySelectorAll("#optionsContainer input");
    const options = Array.from(optionInputs)
        .map(input => input.value.trim())
        .filter(value => value !== "");

    if (!question) {
        alert("Please enter a question");
        return;
    }

    if (options.length < 2) {
        alert("Please add at least 2 options");
        return;
    }

    if (!expiryMinutes || expiryMinutes <= 0) {
        alert("Please enter a valid expiry time (greater than 0 minutes)");
        return;
    }

    const confirmDetails = document.getElementById("confirmDetails");
    confirmDetails.innerHTML = `
        <p><strong>Question:</strong> ${question}</p>
        <p><strong>Options:</strong></p>
        <ul>
            ${options.map(opt => `<li>${opt}</li>`).join('')}
        </ul>
        <p><strong>Duration:</strong> ${expiryMinutes} minutes</p>
        <p style="margin-top: 16px; color: #666;">Are you sure you want to create this poll?</p>
    `;

    document.getElementById("confirmModal").style.display = "flex";
}

function closeModal() {
    document.getElementById("confirmModal").style.display = "none";
}

/* =======================
   START POLL (AFTER CONFIRMATION)
======================= */
async function proceedWithPoll() {
    closeModal();

    const question = document.getElementById("questionInput").value.trim();
    const expiryMinutes = Number(document.getElementById("expiryInput").value);
    
    const optionInputs = document.querySelectorAll("#optionsContainer input");
    const options = Array.from(optionInputs)
        .map(input => input.value.trim())
        .filter(value => value !== "");

    try {
        const res = await fetch("https://poll-choice.onrender.com/api/polls", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                question,
                options,
                durationMinutes: expiryMinutes,
                browserId
            })
        });

        if (!res.ok) {
            const errorData = await res.json();
            alert(errorData.error || "Failed to create poll");
            return;
        }

        const data = await res.json();
        
        console.log("Poll created successfully:", data);
        console.log("Poll ID:", data._id);
        
        const pollId = data._id;
        const pollUrl = `${window.location.protocol}//${window.location.host}/poll/${pollId}`;
        
        console.log("Generated URL:", pollUrl);
        
        output.innerHTML = `
            <div class="success-box">
                <h3 style="color: #25d366; margin-top: 0;">✅ Poll Created Successfully!</h3>
                
                <p><strong>Share this poll:</strong></p>
                
                <div class="share-input-row">
                    <input 
                        id="pollLinkInput" 
                        value="${pollUrl}" 
                        readonly
                        onclick="this.select()"
                    />
                    <button class="copy-btn" onclick="copyPollLink()">📋 Copy</button>
                </div>

                <div class="share-actions">
                    <a 
                        href="https://wa.me/?text=${encodeURIComponent('Vote in my poll: ' + pollUrl)}" 
                        target="_blank" 
                        class="share-btn whatsapp"
                    >
                        📱 WhatsApp
                    </a>
                    <a 
                        href="https://t.me/share/url?url=${encodeURIComponent(pollUrl)}&text=${encodeURIComponent('Vote in my poll!')}" 
                        target="_blank" 
                        class="share-btn telegram"
                    >
                        ✈️ Telegram
                    </a>
                </div>

                <button class="start-btn" onclick="viewPoll('${pollId}')" style="margin-top: 14px; width: 100%;">
                    View Poll
                </button>
            </div>
        `;

    } catch (err) {
        console.error("Create poll error:", err);
        alert("Server error while creating poll. Check console for details.");
    }
}

/* =======================
   HELPER FUNCTIONS
======================= */
function copyPollLink() {
    const input = document.getElementById("pollLinkInput");
    input.select();
    input.setSelectionRange(0, 99999);

    try {
        document.execCommand("copy");
        alert("✅ Poll link copied to clipboard!");
    } catch (err) {
        navigator.clipboard.writeText(input.value).then(() => {
            alert("✅ Poll link copied to clipboard!");
        }).catch(() => {
            alert("❌ Failed to copy. Please copy manually.");
        });
    }
}

function viewPoll(pollId) {
    console.log("Navigating to poll:", pollId);
    window.location.href = `/poll/${pollId}`;
}

/* =======================
   RESET POLL
======================= */
function resetPoll() {
    document.getElementById("questionInput").value = "";
    document.getElementById("expiryInput").value = "10";
    optionsContainer.innerHTML = "";
    optionsContainer.appendChild(createOption());
    optionsContainer.appendChild(createOption());
    output.innerHTML = "";
}

/* =======================
   INIT
======================= */
document.addEventListener("DOMContentLoaded", () => {
    optionsContainer.appendChild(createOption());
    optionsContainer.appendChild(createOption());
});