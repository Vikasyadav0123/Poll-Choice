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

app.get("/poll/:id", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "poll.html"));
});

/* =======================
   DB CONNECTION
======================= */
mongoose
    .connect(process.env.MONGO_URI)
    .then(() => console.log("✅ MongoDB connected"))
    .catch(err => {
        console.error("❌ MongoDB error:", err.message);
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
    votedBy: {
        type: [String],
        default: []
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    expiresAt: {
        type: Date,
        required: true
    }
});

const Poll = mongoose.model("Poll", PollSchema);

/* =======================
   CREATE POLL
======================= */
app.post("/api/polls", async (req, res) => {
    try {
        console.log("📩 CREATE POLL BODY:", req.body);

        const { question, options, durationMinutes } = req.body;

        // ✅ STRONG VALIDATION (FIXES FAILED CREATE)
        if (
            !question ||
            !Array.isArray(options) ||
            options.length < 2 ||
            options.some(o => typeof o !== "string" || !o.trim())
        ) {
            return res.status(400).json({ error: "Invalid poll data" });
        }

        const minutes = Number(durationMinutes);
        const safeMinutes = Number.isFinite(minutes) && minutes > 0 ? minutes : 10;

        const poll = await Poll.create({
            question,
            options: options.map(text => ({ text })),
            expiresAt: new Date(Date.now() + safeMinutes * 60000)
        });

        res.status(201).json(poll);
    } catch (err) {
        console.error("❌ CREATE POLL ERROR:", err.message);
        res.status(500).json({ error: "Create poll failed" });
    }
});

/* =======================
   GET POLL
======================= */
app.get("/api/polls/:id", async (req, res) => {
    try {
        const poll = await Poll.findById(req.params.id);
        if (!poll) {
            return res.status(404).json({ error: "Poll not found" });
        }
        res.json(poll);
    } catch (err) {
        console.error("❌ FETCH POLL ERROR:", err.message);
        res.status(500).json({ error: "Fetch poll failed" });
    }
});

/* =======================
   VOTE
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

        if (Date.now() > new Date(poll.expiresAt).getTime()) {
            return res.status(403).json({ error: "Poll expired" });
        }

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
    } catch (err) {
        console.error("❌ VOTE ERROR:", err.message);
        res.status(500).json({ error: "Vote failed" });
    }
});

/* =======================
   SERVER
======================= */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
    console.log(`🚀 Server running on port ${PORT}`)
);
