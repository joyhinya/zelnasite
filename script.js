// ---------- 1. VARIABLES ----------
let token = localStorage.getItem('token');   // saved login, survives page refresh

// ---------- 2. HELPER: talk to the backend ----------
async function api(url, method = 'GET', body) {
  const response = await fetch(url, {
    method: method,
    headers: { 'Content-Type': 'application/json', 'Authorization': token || '' },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error);   // jump to the catch block
  return data;
}

// ---------- 3. SHOW MESSAGES ----------
function say(text) {
  document.getElementById('message').textContent = text;
}

// ---------- 4. SWITCH PAGES ----------
function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
  document.getElementById(name).classList.remove('hidden');
  say('');
  if (name === 'browse') loadProfiles();
  if (name === 'matches') loadMatches();
}

// ---------- 5. HIDE/SHOW NAV LINKS DEPENDING ON LOGIN ----------
function updateNav() {
  const loggedIn = !!token;
  document.querySelectorAll('.private').forEach(el => el.style.display = loggedIn ? '' : 'none');
  document.querySelectorAll('.public').forEach(el => el.style.display = loggedIn ? 'none' : '');
}

// ---------- 6. BUILD A PROFILE CARD ----------
function makeCard(person, withLike) {
  const card = document.createElement('div');
  card.className = 'card';
  const title = document.createElement('h3');
  title.textContent = person.name + ', ' + person.age;
  const info = document.createElement('p');
  info.textContent = person.city + (person.bio ? ' - ' + person.bio : '');
  card.append(title, info);
  if (withLike) {
    const btn = document.createElement('button');
    btn.textContent = 'Like';
    btn.addEventListener('click', async () => {
      try {
        const result = await api('/api/like/' + person.id, 'POST');
        say(result.match ? "It's a match with " + person.name + "!" : 'You liked ' + person.name);
        card.remove();
      } catch (err) { say(err.message); }
    });
    card.append(btn);
  } else {
    const contact = document.createElement('p');
    contact.textContent = 'Email: ' + person.email;
    card.append(contact);
  }
  return card;
}

// ---------- 7. LOAD DATA ----------
async function loadProfiles() {
  try {
    const city = document.getElementById('cityFilter').value;
    const people = await api('/api/profiles?city=' + encodeURIComponent(city));
    const list = document.getElementById('profileList');
    list.innerHTML = '';
    if (people.length === 0) say('No one new to show right now.');
    people.forEach(p => list.append(makeCard(p, true)));
  } catch (err) { say(err.message); }
}

async function loadMatches() {
  try {
    const people = await api('/api/matches');
    const list = document.getElementById('matchList');
    list.innerHTML = '';
    if (people.length === 0) say('No matches yet. Keep liking!');
    people.forEach(p => list.append(makeCard(p, false)));
  } catch (err) { say(err.message); }
}

// ---------- 8. LOGIN / SIGN UP ----------
function saveLogin(data) {
  token = data.token;
  localStorage.setItem('token', token);
  updateNav();
  showPage('browse');
}

document.getElementById('loginBtn').addEventListener('click', async () => {
  try {
    saveLogin(await api('/api/login', 'POST', {
      email: document.getElementById('loginEmail').value,
      password: document.getElementById('loginPass').value
    }));
  } catch (err) { say(err.message); }
});

document.getElementById('regBtn').addEventListener('click', async () => {
  try {
    saveLogin(await api('/api/register', 'POST', {
      name: document.getElementById('regName').value,
      email: document.getElementById('regEmail').value,
      password: document.getElementById('regPass').value,
      age: Number(document.getElementById('regAge').value),
      city: document.getElementById('regCity').value,
      bio: document.getElementById('regBio').value
    }));
  } catch (err) { say(err.message); }
});

document.getElementById('logout').addEventListener('click', () => {
  token = null;
  localStorage.removeItem('token');
  updateNav();
  showPage('home');
});

// ---------- 9. CONNECT BUTTONS AND LINKS ----------
document.querySelectorAll('[data-page]').forEach(el => {
  el.addEventListener('click', (e) => { e.preventDefault(); showPage(el.dataset.page); });
});
document.getElementById('cityFilter').addEventListener('input', loadProfiles);

// ---------- 10. START ----------
updateNav();
showPage('home');
