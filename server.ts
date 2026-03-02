import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import crypto from "crypto";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;
const db = new Database("passwords.db");

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS vaults (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    encrypted_password TEXT NOT NULL,
    iv TEXT NOT NULL,
    salt TEXT NOT NULL,
    questions TEXT NOT NULL, -- JSON array of questions
    theme TEXT, -- Theme icon
    theme_label TEXT, -- Theme label
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Migration: Add columns if they don't exist
try {
  db.exec("ALTER TABLE vaults ADD COLUMN theme TEXT");
} catch (e) {}
try {
  db.exec("ALTER TABLE vaults ADD COLUMN theme_label TEXT");
} catch (e) {}

app.use(express.json());

// Encryption helper
function deriveKey(answers: string[], salt: string) {
  const password = answers.join("|");
  // Increase iterations to 600,000 for "Seed Phrase" level security
  return crypto.pbkdf2Sync(password, salt, 600000, 32, 'sha256');
}

function encrypt(text: string, answers: string[]) {
  const salt = crypto.randomBytes(16).toString('hex');
  const key = deriveKey(answers, salt);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return {
    encryptedData: encrypted,
    iv: iv.toString('hex'),
    salt: salt
  };
}

function decrypt(encryptedData: string, iv: string, salt: string, answers: string[]) {
  try {
    const key = deriveKey(answers, salt);
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, Buffer.from(iv, 'hex'));
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (e) {
    return null;
  }
}

// API Routes
app.get("/api/vaults", (req, res) => {
  const rows = db.prepare("SELECT id, title, encrypted_password, iv, salt, questions, theme, theme_label, created_at FROM vaults ORDER BY created_at DESC").all();
  res.json(rows.map(row => ({
    ...row,
    questions: JSON.parse(row.questions as string)
  })));
});

app.post("/api/vaults", (req, res) => {
  const { title, password, questions, answers, theme, theme_label } = req.body;
  if (!title || !password || !questions || !answers) {
    return res.status(400).json({ error: "Missing fields" });
  }

  const { encryptedData, iv, salt } = encrypt(password, answers);
  
  const stmt = db.prepare("INSERT INTO vaults (title, encrypted_password, iv, salt, questions, theme, theme_label) VALUES (?, ?, ?, ?, ?, ?, ?)");
  const result = stmt.run(title, encryptedData, iv, salt, JSON.stringify(questions), theme, theme_label);
  
  res.json({ id: result.lastInsertRowid });
});

app.post("/api/vaults/:id/decrypt", (req, res) => {
  const { id } = req.params;
  const { answers } = req.body;
  
  const vault = db.prepare("SELECT * FROM vaults WHERE id = ?").get(id) as any;
  if (!vault) return res.status(404).json({ error: "Not found" });
  
  const decrypted = decrypt(vault.encrypted_password, vault.iv, vault.salt, answers);
  if (decrypted === null) {
    return res.status(401).json({ error: "Incorrect answers. Decryption failed." });
  }
  
  res.json({ password: decrypted });
});

app.delete("/api/vaults/:id", (req, res) => {
  db.prepare("DELETE FROM vaults WHERE id = ?").run(req.params.id);
  res.json({ success: true });
});

app.post("/api/vaults/restore", (req, res) => {
  const { vaults } = req.body;
  if (!Array.isArray(vaults)) {
    return res.status(400).json({ error: "Invalid data format" });
  }

  const stmt = db.prepare("INSERT INTO vaults (title, encrypted_password, iv, salt, questions, theme, theme_label, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
  
  const insertMany = db.transaction((items) => {
    for (const item of items) {
      stmt.run(
        item.title, 
        item.encrypted_password || item.encryptedData, // Handle both formats
        item.iv, 
        item.salt, 
        JSON.stringify(item.questions), 
        item.theme, 
        item.theme_label,
        item.created_at || new Date().toISOString()
      );
    }
  });

  try {
    insertMany(vaults);
    res.json({ success: true, count: vaults.length });
  } catch (e) {
    res.status(500).json({ error: "Failed to restore data" });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
