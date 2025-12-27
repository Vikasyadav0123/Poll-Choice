require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const path = require("path");
const crypto = require("crypto");

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
    votedBy: { type: [String], default: [] },

    // 🔐 CREATOR
    creatorSecret: { type: String, index: true },

    createdAt: { type: Date, default: Date.now },
    expiresAt: Date
});

const Poll = mongoose.model("Poll", PollSchema);

/* =======================
   CREATE POLL
======================= */
app.post("/api/polls", async (req, res) => {
    try {
        const { question, options, expiryMinutes } = req.body;

        if (!question || !Array.isArray(options) || options.length < 2) {
            return res.status(400).json({ error: "Invalid poll data" });
        }

        const creatorSecret = crypto.randomBytes(24).toString("hex");

        const poll = await Poll.create({
            question,
            options: options.map(text => ({ text })),
            creatorSecret,
            expiresAt: Date.now() + (expiryMinutes || 10) * 60000
        });

        res.status(201).json({
            pollId: poll._id,
            creatorSecret
        });
    } catch {
        res.status(500).json({ error: "Create poll failed" });
    }
});

/* =======================
   GET POLL (PUBLIC)
======================= */
app.get("/api/polls/:id", async (req, res) => {
    try {
        const poll = await Poll.findById(req.params.id);
        if (!poll) return res.status(404).json({ error: "Poll not found" });

        res.json({
            _id: poll._id,
            question: poll.question,
            options: poll.options,
            expiresAt: poll.expiresAt
        });
    } catch {
        res.status(500).json({ error: "Failed to load poll" });
    }
});

/* =======================
   VOTE (ANTI-REFRESH SAFE)
======================= */
app.post("/api/polls/:id/vote", async (req, res) => {
    try {
        const { selectedIndexes, browserId } = req.body;
        if (!browserId) return res.status(400).json({ error: "Missing browser ID" });

        const poll = await Poll.findById(req.params.id);
        if (!poll) return res.status(404).json({ error: "Poll not found" });

        if (poll.votedBy.includes(browserId)) {
            return res.status(403).json({ error: "Already voted" });
        }

        selectedIndexes.forEach(i => {
            if (poll.options[i]) poll.options[i].votes += 1;
        });

        poll.votedBy.push(browserId);
        await poll.save();

        res.json(poll);
    } catch {
        res.status(500).json({ error: "Vote failed" });
    }
});

/* =======================
   CREATOR: POLL HISTORY
======================= */
app.get("/api/creator/polls", async (req, res) => {
    try {
        const { secrets } = req.query;
        if (!secrets) return res.json([]);

        const secretList = secrets.split(",");

        const polls = await Poll.find({ creatorSecret: { $in: secretList } })
            .sort({ createdAt: -1 });

        res.json(
            polls.map(p => ({
                _id: p._id,
                question: p.question,
                createdAt: p.createdAt,
                expiresAt: p.expiresAt,
                totalVotes: p.votedBy.length
            }))
        );
    } catch {
        res.status(500).json({ error: "Failed to load history" });
    }
});

/* =======================
   CREATOR: DELETE POLL
======================= */
app.delete("/api/polls/:id", async (req, res) => {
    try {
        const { admin } = req.query;
        if (!admin) return res.status(403).json({ error: "Forbidden" });

        const poll = await Poll.findOne({
            _id: req.params.id,
            creatorSecret: admin
        });

        if (!poll) return res.status(403).json({ error: "Forbidden" });

        await poll.deleteOne();
        res.json({ success: true });
    } catch {
        res.status(500).json({ error: "Delete failed" });
    }
});

/* =======================
   SERVER
======================= */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
    console.log(`🚀 Server running on port ${PORT}`)
);
