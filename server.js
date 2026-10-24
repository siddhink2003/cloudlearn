require('dotenv').config();
const express = require('express'), mysql = require('mysql2/promise'), bcrypt = require('bcryptjs'),
  jwt = require('jsonwebtoken'), path = require('path');
const multer = require('multer'), fs = require('fs');
const upDir = path.join(__dirname, 'public', 'uploads'); fs.mkdirSync(upDir, { recursive: true });
const upload = multer({ storage: multer.diskStorage({ destination: upDir, filename: (q, f, cb) => cb(null, Date.now() + '-' + f.originalname.replace(/[^\w.\-]/g, '_')) }),
  limits: { fileSize: 10 * 1024 * 1024 }, fileFilter: (q, f, cb) => cb(null, /\.(pdf|docx|zip|png|jpe?g|txt)$/i.test(f.originalname)) });
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const db = mysql.createPool({ host: process.env.DB_HOST, user: process.env.DB_USER,
  password: process.env.DB_PASSWORD, database: process.env.DB_NAME, connectionLimit: 10 });
const wrap = f => (q, s) => f(q, s).catch(e => { console.error(e); s.status(500).json({ error: 'Server error' }); });
const auth = (...roles) => (q, s, n) => {
  try {
    q.user = jwt.verify((q.headers.authorization || '').replace('Bearer ', ''), process.env.JWT_SECRET);
    if (roles.length && !roles.includes(q.user.role)) return s.status(403).json({ error: 'Forbidden' });
    n();
  } catch (e) { s.status(401).json({ error: 'Login required' }); }
};
const one = async (sql, p) => (await db.query(sql, p))[0][0];

app.get('/api/health', wrap(async (q, s) => { await db.query('SELECT 1'); s.json({ ok: true }); }));

/* Auth */
app.post('/api/register', wrap(async (q, s) => {
  const { name, email, password, role } = q.body;
  if (!name || !email || !password || password.length < 6) return s.status(400).json({ error: 'Name, email and a 6+ character password are required' });
  if (await one('SELECT 1 FROM users WHERE email=?', [email])) return s.status(409).json({ error: 'Email already registered' });
  await db.query('INSERT INTO users (name,email,password_hash,role) VALUES (?,?,?,?)',
    [name, email.toLowerCase(), await bcrypt.hash(password, 10), role === 'instructor' ? 'instructor' : 'student']);
  s.status(201).json({ ok: true });
}));
app.post('/api/login', wrap(async (q, s) => {
  const u = await one('SELECT * FROM users WHERE email=? AND status="active"', [(q.body.email || '').toLowerCase()]);
  if (!u || !(await bcrypt.compare(q.body.password || '', u.password_hash))) return s.status(401).json({ error: 'Invalid credentials' });
  s.json({ token: jwt.sign({ id: u.user_id, role: u.role, name: u.name }, process.env.JWT_SECRET, { expiresIn: '8h' }), name: u.name, role: u.role });
}));

/* Courses */
app.get('/api/courses', auth(), wrap(async (q, s) => {
  const like = '%' + (q.query.q || '') + '%';
  s.json((await db.query(`SELECT c.*, u.name AS instructor FROM courses c JOIN users u ON u.user_id=c.instructor_id
    WHERE c.status='published' AND (c.title LIKE ? OR c.category LIKE ? OR u.name LIKE ?)`, [like, like, like]))[0]);
}));
app.get('/api/courses/:id', auth(), wrap(async (q, s) => {
  const c = await one('SELECT * FROM courses WHERE course_id=?', [q.params.id]);
  if (!c) return s.status(404).json({ error: 'Not found' });
  c.lessons = (await db.query(`SELECT l.*, COALESCE(p.last_position_seconds,0) AS last_position_seconds, COALESCE(p.is_completed,0) AS is_completed
    FROM lessons l LEFT JOIN playback_progress p ON p.lesson_id=l.lesson_id AND p.student_id=? WHERE l.course_id=? ORDER BY l.order_no`, [q.user.id, q.params.id]))[0];
  s.json(c);
}));
app.post('/api/courses', auth('instructor', 'admin'), wrap(async (q, s) => {
  const r = await db.query('INSERT INTO courses (title,description,category,instructor_id) VALUES (?,?,?,?)',
    [q.body.title, q.body.description, q.body.category, q.user.id]);
  s.status(201).json({ course_id: r[0].insertId });
}));
app.post('/api/courses/:id/lessons', auth('instructor', 'admin'), wrap(async (q, s) => {
  const c = await one('SELECT instructor_id FROM courses WHERE course_id=?', [q.params.id]);
  if (!c || (c.instructor_id !== q.user.id && q.user.role !== 'admin')) return s.status(403).json({ error: 'Not your course' });
  const b = q.body, n = (await one('SELECT COUNT(*)+1 AS n FROM lessons WHERE course_id=?', [q.params.id])).n;
  const r = await db.query('INSERT INTO lessons (course_id,title,video_url,duration_seconds,order_no) VALUES (?,?,?,?,?)',
    [q.params.id, b.title, b.video_url, b.duration_seconds || 0, n]);
  const id = r[0].insertId;
  for (const m of b.materials || []) if (m.title) await db.query('INSERT INTO materials (lesson_id,title,file_url) VALUES (?,?,?)', [id, m.title, m.file_url]);
  if (b.lab) await db.query('INSERT INTO labs (lesson_id,title,instructions,video_url,deadline,max_marks) VALUES (?,?,?,?,?,?)',
    [id, b.lab.title, b.lab.instructions, b.lab.video_url, b.lab.deadline || null, b.lab.max_marks || 20]);
  if (b.quiz && b.quiz.questions && b.quiz.questions.length) {
    const qz = await db.query('INSERT INTO quizzes (course_id,lesson_id,title) VALUES (?,?,?)', [q.params.id, id, b.quiz.title || b.title + ' quiz']);
    for (const x of b.quiz.questions) await db.query('INSERT INTO quiz_questions (quiz_id,question_text,options,correct_option) VALUES (?,?,?,?)',
      [qz[0].insertId, x.question, JSON.stringify(x.options), x.correct]);
  }
  s.status(201).json({ lesson_id: id });
}));
app.post('/api/courses/:id/enroll', auth('student'), wrap(async (q, s) => {
  await db.query('INSERT IGNORE INTO enrollments (student_id,course_id) VALUES (?,?)', [q.user.id, q.params.id]);
  s.json({ ok: true });
}));

/* Video resume */
app.get('/api/lessons/:id/progress', auth('student'), wrap(async (q, s) => {
  const p = await one('SELECT last_position_seconds, is_completed FROM playback_progress WHERE student_id=? AND lesson_id=?', [q.user.id, q.params.id]);
  s.json(p || { last_position_seconds: 0, is_completed: 0 });
}));
app.put('/api/lessons/:id/progress', auth('student'), wrap(async (q, s) => {
  const l = await one(`SELECT l.duration_seconds FROM lessons l JOIN enrollments e ON e.course_id=l.course_id AND e.student_id=? WHERE l.lesson_id=?`, [q.user.id, q.params.id]);
  if (!l) return s.status(403).json({ error: 'Not enrolled' });
  const dur = l.duration_seconds || Math.floor(+q.body.duration || 0), pos = Math.max(0, Math.floor(+q.body.position || 0)), done = dur && pos >= 0.9 * dur ? 1 : 0;
  if (!l.duration_seconds && dur) await db.query('UPDATE lessons SET duration_seconds=? WHERE lesson_id=?', [dur, q.params.id]);
  await db.query(`INSERT INTO playback_progress (student_id,lesson_id,last_position_seconds,is_completed) VALUES (?,?,?,?)
    ON DUPLICATE KEY UPDATE last_position_seconds=VALUES(last_position_seconds), is_completed=GREATEST(is_completed,VALUES(is_completed))`,
    [q.user.id, q.params.id, pos, done]);
  s.json({ saved: pos });
}));
app.get('/api/students/me/continue-learning', auth('student'), wrap(async (q, s) => {
  s.json((await db.query(`SELECT l.lesson_id, l.title, c.course_id, c.title AS course, p.last_position_seconds, l.duration_seconds, p.updated_at
    FROM playback_progress p JOIN lessons l ON l.lesson_id=p.lesson_id JOIN courses c ON c.course_id=l.course_id
    WHERE p.student_id=? AND p.is_completed=0 ORDER BY p.updated_at DESC LIMIT 5`, [q.user.id]))[0]);
}));

/* Labs */
app.post('/api/labs/:id/submissions', auth('student'), upload.single('file'), wrap(async (q, s) => {
  const lab = await one('SELECT deadline FROM labs WHERE lab_id=?', [q.params.id]);
  if (!lab) return s.status(404).json({ error: 'Lab not found' });
  const late = lab.deadline && new Date() > new Date(lab.deadline) ? 'late' : 'submitted';
  await db.query('INSERT INTO lab_submissions (lab_id,student_id,text_answer,file_url,status) VALUES (?,?,?,?,?)',
    [q.params.id, q.user.id, q.body.text_answer, q.file ? '/uploads/' + q.file.filename : q.body.file_url, late]);
  s.status(201).json({ status: late });
}));
app.get('/api/instructor/submissions', auth('instructor', 'admin'), wrap(async (q, s) => {
  s.json((await db.query(`SELECT sb.*, u.name AS student, lb.title AS lab, lb.max_marks FROM lab_submissions sb
    JOIN labs lb ON lb.lab_id=sb.lab_id JOIN lessons l ON l.lesson_id=lb.lesson_id JOIN courses c ON c.course_id=l.course_id
    JOIN users u ON u.user_id=sb.student_id WHERE c.instructor_id=? OR ?='admin' ORDER BY sb.submitted_at DESC`, [q.user.id, q.user.role]))[0]);
}));
app.put('/api/submissions/:id/grade', auth('instructor', 'admin'), wrap(async (q, s) => {
  await db.query('UPDATE lab_submissions SET marks=?, feedback=?, status="graded" WHERE submission_id=?', [q.body.marks, q.body.feedback, q.params.id]);
  s.json({ ok: true });
}));

/* Quizzes */
app.get('/api/lessons/:id/quiz', auth(), wrap(async (q, s) => {
  const z = await one('SELECT * FROM quizzes WHERE lesson_id=?', [q.params.id]);
  if (!z) return s.json(null);
  z.questions = (await db.query('SELECT question_id, question_text, options, marks FROM quiz_questions WHERE quiz_id=?', [z.quiz_id]))[0];
  z.last = await one('SELECT score,total,attempt_no FROM quiz_results WHERE quiz_id=? AND student_id=? ORDER BY result_id DESC LIMIT 1', [z.quiz_id, q.user.id]) || null;
  s.json(z);
}));
app.post('/api/quizzes/:id/attempt', auth('student'), wrap(async (q, s) => {
  const z = await one('SELECT * FROM quizzes WHERE quiz_id=?', [q.params.id]);
  const n = (await one('SELECT COUNT(*) AS n FROM quiz_results WHERE quiz_id=? AND student_id=?', [q.params.id, q.user.id])).n;
  if (n >= z.max_attempts) return s.status(403).json({ error: 'No attempts left' });
  const qs = (await db.query('SELECT question_id, correct_option, marks FROM quiz_questions WHERE quiz_id=?', [q.params.id]))[0];
  let score = 0, total = 0;
  qs.forEach(x => { total += x.marks; if (+(q.body.answers || {})[x.question_id] === x.correct_option) score += x.marks; });
  await db.query('INSERT INTO quiz_results (quiz_id,student_id,score,total,attempt_no) VALUES (?,?,?,?,?)', [q.params.id, q.user.id, score, total, n + 1]);
  s.json({ score, total, passed: total ? (100 * score / total) >= z.pass_score : false,
    correct: Object.fromEntries(qs.map(x => [x.question_id, x.correct_option])) });
}));

/* Extra routes used by the frontend */
app.get('/api/lessons/:id', auth(), wrap(async (q, s) => {
  const l = await one('SELECT l.*, c.title AS course FROM lessons l JOIN courses c ON c.course_id=l.course_id WHERE l.lesson_id=?', [q.params.id]);
  if (!l) return s.status(404).json({ error: 'Not found' });
  if (q.user.role === 'student' && !(await one('SELECT 1 FROM enrollments WHERE student_id=? AND course_id=?', [q.user.id, l.course_id]))) return s.status(403).json({ error: 'Enroll first' });
  l.materials = (await db.query('SELECT title,file_url FROM materials WHERE lesson_id=?', [l.lesson_id]))[0];
  l.lab = (await one('SELECT * FROM labs WHERE lesson_id=?', [l.lesson_id])) || null;
  if (l.lab) l.lab.submission = (await one('SELECT * FROM lab_submissions WHERE lab_id=? AND student_id=? ORDER BY submission_id DESC LIMIT 1', [l.lab.lab_id, q.user.id])) || null;
  s.json(l);
}));
app.get('/api/students/me/courses', auth('student'), wrap(async (q, s) => {
  s.json((await db.query(`SELECT c.course_id, c.title, c.category,
    (SELECT COUNT(*) FROM lessons WHERE course_id=c.course_id) AS lessons,
    (SELECT COUNT(*) FROM playback_progress p JOIN lessons l ON l.lesson_id=p.lesson_id WHERE l.course_id=c.course_id AND p.student_id=e.student_id AND p.is_completed=1) AS watched,
    (SELECT COUNT(*) FROM labs lb JOIN lessons l ON l.lesson_id=lb.lesson_id WHERE l.course_id=c.course_id) AS labs,
    (SELECT COUNT(DISTINCT sb.lab_id) FROM lab_submissions sb JOIN labs lb ON lb.lab_id=sb.lab_id JOIN lessons l ON l.lesson_id=lb.lesson_id WHERE l.course_id=c.course_id AND sb.student_id=e.student_id) AS labs_done,
    (SELECT COUNT(*) FROM quizzes z WHERE z.course_id=c.course_id) AS quizzes,
    (SELECT COUNT(DISTINCT r.quiz_id) FROM quiz_results r JOIN quizzes z ON z.quiz_id=r.quiz_id WHERE z.course_id=c.course_id AND r.student_id=e.student_id) AS quizzes_done
    FROM enrollments e JOIN courses c ON c.course_id=e.course_id WHERE e.student_id=?`, [q.user.id]))[0]);
}));
app.get('/api/instructor/courses', auth('instructor', 'admin'), wrap(async (q, s) => {
  s.json((await db.query(`SELECT c.*, (SELECT COUNT(*) FROM lessons WHERE course_id=c.course_id) AS lessons,
    (SELECT COUNT(*) FROM enrollments WHERE course_id=c.course_id) AS students FROM courses c WHERE c.instructor_id=? OR ?='admin'`, [q.user.id, q.user.role]))[0]);
}));
app.delete('/api/courses/:id', auth('instructor', 'admin'), wrap(async (q, s) => {
  await db.query("DELETE FROM courses WHERE course_id=? AND (instructor_id=? OR ?='admin')", [q.params.id, q.user.id, q.user.role]); s.json({ ok: true });
}));
app.put('/api/admin/users/:id/status', auth('admin'), wrap(async (q, s) => {
  await db.query('UPDATE users SET status=? WHERE user_id=?', [q.body.status === 'inactive' ? 'inactive' : 'active', q.params.id]); s.json({ ok: true });
}));

/* Admin */
app.get('/api/admin/stats', auth('admin'), wrap(async (q, s) => {
  s.json(await one(`SELECT (SELECT COUNT(*) FROM users) users, (SELECT COUNT(*) FROM courses) courses,
    (SELECT COUNT(*) FROM enrollments) enrollments, (SELECT COUNT(*) FROM lab_submissions) submissions`));
}));
app.get('/api/admin/users', auth('admin'), wrap(async (q, s) => {
  s.json((await db.query('SELECT user_id,name,email,role,status,created_at FROM users'))[0]);
}));

app.listen(process.env.PORT || 3000, () => console.log('CloudLearn running on port ' + (process.env.PORT || 3000)));
