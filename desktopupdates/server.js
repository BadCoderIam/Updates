import express from 'express';
import pkg from 'pg';
import cors from 'cors';
import { OAuth2Client } from 'google-auth-library';
import { ethers } from 'ethers';

const { Pool } = pkg;
const app = express();

app.use(cors({
  origin: (origin, callback) => {
    const allowedOrigins = ['https://sheethole.net', 'https://www.sheethole.net'];
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
}));

app.use(express.json());

// ✅ PostgreSQL connection setup
const pool = new Pool({
  user: 'sheetadm',     // change this
  host: 'localhost',        // or your PostgreSQL host
  database: 'sheetydb',   // change this
  password: 'sheetn', // change this
  port: 5432,               // default PostgreSQL port
});

// ✅ Initialize claims table (run ONCE; could move to a separate migration script)
async function initializeDB() {
  // Existing claims table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS claims (
  id SERIAL PRIMARY KEY,
  google_user_id TEXT REFERENCES users(google_user_id),
  ship_number INTEGER,
  rarity TEXT,
  color TEXT,
  image_url TEXT,
  claimed_at TIMESTAMP DEFAULT NOW()
    );
  `);

  // New deposits table for $SHEET deposits tracking
  await pool.query(`
    CREATE TABLE IF NOT EXISTS deposits (
      id SERIAL PRIMARY KEY,
      wallet_address TEXT NOT NULL,
      deposited_amount NUMERIC NOT NULL,
      used_amount NUMERIC DEFAULT 0,
      refunded_amount NUMERIC DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  google_user_id TEXT UNIQUE NOT NULL,
  google_user_name TEXT,
  google_user_email TEXT,
  wallet_address TEXT UNIQUE,
  created_at TIMESTAMP DEFAULT NOW()
     );
  `);
}
initializeDB().catch(console.error);

// ✅ Google OAuth2 setup
const CLIENT_ID = '475019880749-qdbpinnod6egm4oqltv3qahgtuotlv69.apps.googleusercontent.com';
const oauthClient = new OAuth2Client(CLIENT_ID);

// ✅ Route to save ship claims
app.post('/api/claim-ship', async (req, res) => {
  const { googleUserId, googleUserName, googleUserEmail, shipNumber, rarity, color, image, claimedAt, walletAddress, depositedAmount, refundedAmount } = req.body;

  try {
    const result = await pool.query(`
      INSERT INTO claims 
        (google_user_id, google_user_name, google_user_email, ship_number, rarity, color, image_url, claimed_at, wallet_address, deposited_amount, refunded_amount)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id
    `, [
      googleUserId || null,
      googleUserName || null,
      googleUserEmail || null,
      shipNumber,
      rarity,
      color,
      image,
      claimedAt,
      walletAddress || null,
      depositedAmount || 0,
      refundedAmount || 0
    ]);

    res.json({ success: true, id: result.rows[0].id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ✅ Route to get last 3 claims for a user
app.get('/api/user-claims/:googleUserId', async (req, res) => {
  const googleUserId = req.params.googleUserId;

  try {
    const result = await pool.query(`
      SELECT * FROM claims
      WHERE google_user_id = $1
      ORDER BY claimed_at DESC
      LIMIT 3
    `, [googleUserId]);

    res.json({ success: true, claims: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ✅ Google login verification
app.post('/api/google-login', async (req, res) => {
  const { id_token } = req.body;

  try {
    const ticket = await oauthClient.verifyIdToken({
      idToken: id_token,
      audience: CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const googleUserId = payload.sub;

    // Check if user already has wallet address in DB
    const userResult = await pool.query(
      'SELECT wallet_address FROM claims WHERE google_user_id = $1 LIMIT 1',
      [googleUserId]
    );

    let walletAddress;

    if (userResult.rows.length === 0 || !userResult.rows[0].wallet_address) {
      // Create wallet if none exists
      const wallet = ethers.Wallet.createRandom();
      walletAddress = wallet.address;

      console.log('Wallet address:', wallet.address);
      console.log('Private key (keep secret!):', wallet.privateKey);

      // Store wallet address for this user
      await pool.query(
        `INSERT INTO claims (google_user_id, google_user_name, google_user_email, wallet_address)
         VALUES ($1, $2, $3, $4)`,
        [googleUserId, payload.name, payload.email, walletAddress]
      );
    } else {
      walletAddress = userResult.rows[0].wallet_address;
    }


    res.json({
      success: true,
      user: {
        id: payload.sub,
        email: payload.email,
        name: payload.name,
        picture: payload.picture,
        walletAddress,
      },
    });
  } catch (error) {
    console.error("Google login error:", error);
    res.status(401).json({ success: false, message: "Invalid token" });
  }
});

app.post("/api/save-user-wallet", async (req, res) => {
  const { googleUserId, googleUserName, googleUserEmail, walletAddress } = req.body;

  try {
    await pool.query(
      `INSERT INTO users (google_user_id, google_user_name, google_user_email, wallet_address)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (google_user_id)
       DO UPDATE SET google_user_name = EXCLUDED.google_user_name,
                     google_user_email = EXCLUDED.google_user_email,
                     wallet_address = EXCLUDED.wallet_address;`,
      [googleUserId, googleUserName, googleUserEmail, walletAddress]
    );

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});


app.get("/api/user-claims/:googleUserId", async (req, res) => {
  const { googleUserId } = req.params;

  try {
    const { rows } = await pool.query(
      `SELECT * FROM claims WHERE google_user_id = $1 ORDER BY claimed_at DESC LIMIT 3;`,
      [googleUserId]
    );

    res.json({ success: true, claims: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Deposit $SHEET
app.post('/api/deposit-sheet', async (req, res) => {
  const { walletAddress, depositedAmount } = req.body;
  if (!walletAddress || !depositedAmount || depositedAmount <= 0) {
    return res.status(400).json({ error: 'walletAddress and depositedAmount are required.' });
  }

  try {
    const result = await pool.query(`
      INSERT INTO deposits (wallet_address, deposited_amount)
      VALUES ($1, $2)
      RETURNING id
    `, [walletAddress, depositedAmount]);

    res.json({ success: true, depositId: result.rows[0].id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to record deposit.' });
  }
});

// Refund $SHEET
app.post('/api/refund-sheet', async (req, res) => {
  const { walletAddress, refundAmount } = req.body;
  if (!walletAddress || !refundAmount || refundAmount <= 0) {
    return res.status(400).json({ error: 'walletAddress and refundAmount are required.' });
  }

  try {
    await pool.query(`
      UPDATE deposits
      SET refunded_amount = refunded_amount + $2
      WHERE wallet_address = $1
    `, [walletAddress, refundAmount]);

    res.json({ success: true, message: `Refunded ${refundAmount} $SHEET to ${walletAddress}.` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to record refund.' });
  }
});

app.listen(3000, () => console.log("API running at http://localhost:3000"));
