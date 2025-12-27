require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const path = require("path");

const app = express();

/* =======================
   MIDDLEWARE
======================= */
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

/* =======================
   ROUTES
======================= */
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

/* =======================
   DB CONNECTION
======================= */
console.log("MONGO_URI =", process.env.MONGO_URI);

mongoose
    .connect(process.env.MONGO_URI)
    .then(() => console.log("✅ MongoDB connected"))
    .catch(err => {
        console.error("❌ MongoDB error:", err);
        process.exit(1);
    });


/* =======================
   SCHEMA
======================= */
const PollSchema = new mongoose.Schema({
    question: String,
    options: [
        {
            text: String,
            votes: { type: Number, default: 0 }
        }
    ],
    // 🔒 STRONG LOCK
    votedBy: {
        type: [String],
        default: []
    }
});

const Poll = mongoose.model("Poll", PollSchema);

/* =======================
   CREATE POLL
======================= */
app.post("/api/polls", async (req, res) => {
    try {
        const { question, options } = req.body;

        if (!question || !Array.isArray(options) || options.length < 2) {
            return res.status(400).json({ error: "Invalid poll data" });
        }

        const poll = await Poll.create({
            question,
            options: options.map(text => ({ text }))
        });

        res.status(201).json(poll);
    } catch {
        res.status(500).json({ error: "Create poll failed" });
    }
});

/* =======================
   VOTE (BACKEND LOCKED)
======================= */
app.post("/api/polls/:id/vote", async (req, res) => {
    try {
        const { selectedIndexes, browserId } = req.body;

        if (!browserId) {
            return res.status(400).json({ error: "Missing browser ID" });
        }

        if (!Array.isArray(selectedIndexes) || selectedIndexes.length === 0) {
            return res.status(400).json({ error: "No options selected" });
        }

        const poll = await Poll.findById(req.params.id);
        if (!poll) {
            return res.status(404).json({ error: "Poll not found" });
        }

        // 🔒 STRONG CHECK
        if (poll.votedBy.includes(browserId)) {
            return res.status(403).json({ error: "Already voted" });
        }

        selectedIndexes.forEach(i => {
            if (poll.options[i]) {
                poll.options[i].votes += 1;
            }
        });

        poll.votedBy.push(browserId);
        await poll.save();

        res.json(poll);

    } catch {
        res.status(500).json({ error: "Vote failed" });
    }
});

/* =======================
   SERVER
======================= */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
    console.log(`🚀 Server running at http://localhost:${PORT}`)
);
