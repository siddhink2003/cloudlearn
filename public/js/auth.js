/* Login and registration */
function authV() {
  const isReg = V.auth === 'reg';

  return `<div class="auth-wrap">
    <section class="auth-hero">
      <span class="br"><span class="logo">▶</span>CloudLearn</span>
      <h1>Learn at your pace.<br>Pick up exactly where you stopped.</h1>
      <ul>
        <li>▶ Video resume remembers every lecture</li>
        <li>🧪 Hands-on labs with instructor feedback</li>
        <li>📝 Quizzes with instant results</li>
        <li>📈 Progress tracking across all courses</li>
      </ul>
    </section>
    <section class="auth-form">
      <div class="seg">
        <button class="s ${isReg ? '' : 'on'}"
          onclick="V.auth='login';R()">Log in</button>
        <button class="s ${isReg ? 'on' : ''}"
          onclick="V.auth='reg';R()">Create account</button>
      </div>
      ${isReg ? `
        <h2>Create your account</h2>
        <label for="rn">Full name</label>
        <input id="rn" autocomplete="name">
        <label for="re">Email</label>
        <input id="re" type="email" autocomplete="email">
        <label for="rp">Password (6+ characters)</label>
        <input id="rp" type="password" autocomplete="new-password">
        <button class="wide" onclick="reg()">Create account</button>
      ` : `
        <h2>Welcome back</h2>
        <label for="e">Email</label>
        <input id="e" type="email" autocomplete="email">
        <label for="p">Password</label>
        <input id="p" type="password" autocomplete="current-password">
        <button class="wide" onclick="login()">Log in</button>
        <p class="hint">Demo accounts: student@demo.com, instructor@demo.com
        or admin@demo.com. Use password demo123 if the demo seed data exists.</p>
      `}
    </section>
  </div>`;
}

const login = (e, p) => act(async () => {
  const d = await api('/login', 'POST', {
    email: e || $('#e').value,
    password: p || $('#p').value
  });

  tok = d.token;
  U = { name: d.name, role: d.role };
  localStorage.setItem('cl_tok', tok);
  localStorage.setItem('cl_user', JSON.stringify(U));
  go('home');
});

const reg = () => act(async () => {
  const name = $('#rn').value.trim();
  const email = $('#re').value.trim();
  const password = $('#rp').value;

  if (!name || !email || password.length < 6) {
    throw new Error('Enter your name, a valid email, and a password of at least 6 characters.');
  }

  await api('/register', 'POST', { name, email, password });

  V.auth = 'login';
  R();

  alert('Account created. Please log in with your new account.');
});

function out() {
  savePos();
  tok = null;
  U = null;
  lp = null;
  localStorage.removeItem('cl_tok');
  localStorage.removeItem('cl_user');
  R();
}
