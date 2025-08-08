import express from 'express';
import sqlite3 from 'sqlite3';
import cors from 'cors';
import cron from 'node-cron';
import { OAuth2Client } from 'google-auth-library';

const app = express();
app.use(cors({
  origin: 'https://sheethole.net'
}));

app.use(express.json());

const db = new sqlite3.Database('./claims.db');

const CLIENT_ID = '475019880749-qdbpinnod6egm4oqltv3qahgtuotlv69.apps.googleusercontent.com';
const oauthClient = new OAuth2Client(CLIENT_ID);

// Initialize claims table
db.run(`CREATE TABLE claims (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  google_user_id TEXT,
  google_user_name TEXT,
  google_user_email TEXT,
  ship_number INTEGER,
  rarity TEXT,
  color TEXT,
  image_url TEXT,
  claimed_at TEXT
)`);

db.run(`
  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    google_user_id TEXT,
    session_id TEXT,
    score INTEGER,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP
  )
`);

// ✅ Existing route to save ship claims
app.post('/api/claim-ship', (req, res) => {
  const { googleUserId, googleUserName, googleUserEmail, shipNumber, rarity, color, image, claimedAt } = req.body;

  db.run(
    `INSERT INTO claims 
     (google_user_id, google_user_name, google_user_email, ship_number, rarity, color, image_url, claimed_at) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [googleUserId || null, googleUserName || null, googleUserEmail || null, shipNumber, rarity, color, image, claimedAt],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, id: this.lastID });
    }
  );
});

app.get('/api/user-claims/:googleUserId', (req, res) => {
  const googleUserId = req.params.googleUserId;

  db.all(
    `SELECT * FROM claims WHERE google_user_id = ? ORDER BY claimed_at DESC LIMIT 3`,
    [googleUserId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, claims: rows });
    }
  );
});

// ✅ NEW route: Google login verification
app.post('/api/google-login', async (req, res) => {
  const { id_token } = req.body;

  try {
    const ticket = await oauthClient.verifyIdToken({
      idToken: id_token,
      audience: CLIENT_ID,
    });

    const payload = ticket.getPayload();
    console.log('✅ Google User:', payload);  // Helpful for debugging

    res.json({
      success: true,
      user: {
        id: payload.sub,           // Google's user ID (useful for linking with claims later)
        email: payload.email,
        name: payload.name,
        picture: payload.picture,
      },
    });
  } catch (error) {
    console.error('Google login verification error:', error);
    res.status(401).json({ success: false, message: 'Invalid token' });
  }
});

app.post('/api/session/start', (req, res) => {
  const { googleUserId, sessionId } = req.body;
  db.run(
    `INSERT INTO sessions (google_user_id, session_id) VALUES (?, ?)`,
    [googleUserId, sessionId],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, id: this.lastID });
      console.log(`🟢 Session started: ${googleUserId} - ${sessionId}`);
    }
  );
});

app.post('/api/session/end', (req, res) => {
  const { sessionId, score } = req.body;
  db.run(
    `UPDATE sessions SET score = ?, ended_at = datetime('now') WHERE session_id = ?`,
    [score, sessionId],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    }
  );
});

// CREATE leaderboard table if it doesn't exist
db.run(`
  CREATE TABLE IF NOT EXISTS leaderboard (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_name TEXT NOT NULL,
    points INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`);

// POST to add entry
app.post('/api/leaderboard', (req, res) => {
  const { player_name, points } = req.body;
  db.run(
    `INSERT INTO leaderboard (player_name, points, created_at)
     VALUES (?, ?, datetime('now'))`,
    [player_name, points],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, id: this.lastID });
      console.log(`📊 Leaderboard entry received: ${player_name} - ${points} pts`);
    }
  );
});

// GET today's leaderboard
app.get('/api/leaderboard', (req, res) => {
  db.all(
    `SELECT player_name, points FROM leaderboard
     WHERE DATE(created_at) = DATE('now')
     ORDER BY points DESC LIMIT 50`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ leaderboard: rows });
    }
  );
});

// Daily auto-reset at noon
cron.schedule('0 12 * * *', () => {
  db.run("DELETE FROM leaderboard WHERE DATE(created_at) < DATE('now')", err => {
    if (!err) console.log('🧹 Leaderboard cleared at 12:00 PM');
  });
});

app.listen(3000, () => console.log('API running at http://localhost:3000'));


