// BACKEND: Express (web server) + SQLite (database in one file)
const express = require('express');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const app = express();
const db = new Database('lovelink.db');   // creates the file if missing

app.use(express.json());                  // lets us read JSON sent from the browser
app.use(express.static('public'));        // serves index.html, style.css, script.js

// SQL: create the tables the first time the server runs
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT, email TEXT UNIQUE, password TEXT,
  age INTEGER, city TEXT, bio TEXT, token TEXT
);
CREATE TABLE IF NOT EXISTS likes (
  from_id INTEGER, to_id INTEGER, UNIQUE(from_id, to_id)
);`);

// Middleware: checks the login token before private routes run
function requireLogin(req, res, next) {
  const token = req.headers.authorization;
  const user = token && db.prepare('SELECT * FROM users WHERE token = ?').get(token);
  if (!user) return res.status(401).json({ error: 'Please log in first.' });
  req.user = user;
  next();
}

app.post('/api/register', (req, res) => {
  const { name, email, password, age, city, bio } = req.body;
  if (!name || !email || !password || !city) return res.status(400).json({ error: 'Please fill in all fields.' });
  if (age < 21 || age > 99) return res.status(400).json({ error: 'You must be 21 or older.' });
  if (password.length < 6) return res.status(400).json({ error: 'Password needs 6+ characters.' });
  const token = crypto.randomBytes(24).toString('hex');
  try {
    db.prepare('INSERT INTO users (name,email,password,age,city,bio,token) VALUES (?,?,?,?,?,?,?)')
      .run(name, email.toLowerCase(), bcrypt.hashSync(password, 10), age, city, bio || '', token);
    res.json({ token, name });
  } catch (e) {
    res.status(400).json({ error: 'That email is already registered.' });
  }
});

app.post('/api/login', (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get((req.body.email || '').toLowerCase());
  if (!user || !bcrypt.compareSync(req.body.password || '', user.password))
    return res.status(401).json({ error: 'Wrong email or password.' });
  const token = crypto.randomBytes(24).toString('hex');
  db.prepare('UPDATE users SET token = ? WHERE id = ?').run(token, user.id);
  res.json({ token, name: user.name });
});

// People you haven't liked yet, optionally filtered by city
app.get('/api/profiles', requireLogin, (req, res) => {
  const city = '%' + (req.query.city || '') + '%';
  const rows = db.prepare(`SELECT id,name,age,city,bio FROM users
    WHERE id != ? AND city LIKE ? AND id NOT IN (SELECT to_id FROM likes WHERE from_id = ?)`)
    .all(req.user.id, city, req.user.id);
  res.json(rows);
});

app.post('/api/like/:id', requireLogin, (req, res) => {
  const them = Number(req.params.id);
  db.prepare('INSERT OR IGNORE INTO likes VALUES (?,?)').run(req.user.id, them);
  const likedBack = db.prepare('SELECT 1 FROM likes WHERE from_id = ? AND to_id = ?').get(them, req.user.id);
  res.json({ match: !!likedBack });
});

// A match = both people liked each other
app.get('/api/matches', requireLogin, (req, res) => {
  const rows = db.prepare(`SELECT id,name,age,city,email FROM users WHERE
    id IN (SELECT to_id FROM likes WHERE from_id = ?) AND
    id IN (SELECT from_id FROM likes WHERE to_id = ?)`).all(req.user.id, req.user.id);
  res.json(rows);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('LoveLink running at http://localhost:' + PORT));
