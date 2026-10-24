// Loads demo users, courses, labs and quizzes. Run once after schema.sql: npm run seed
require('dotenv').config();
const mysql = require('mysql2/promise'), bcrypt = require('bcryptjs');
(async () => {
  const db = await mysql.createConnection({ host: process.env.DB_HOST, user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME });
  const [[{ n }]] = await db.query('SELECT COUNT(*) n FROM users');
  if (n) { console.log('Database already has data - seed skipped'); process.exit(); }
  const h = await bcrypt.hash('demo123', 10);
  const user = async (name, email, role) => (await db.query('INSERT INTO users (name,email,password_hash,role) VALUES (?,?,?,?)', [name, email, h, role]))[0].insertId;
  await user('Admin User', 'admin@demo.com', 'admin');
  const inst = await user('Ravi Instructor', 'instructor@demo.com', 'instructor');
  await user('Asha Student', 'student@demo.com', 'student');
  const course = async (t, c, d) => (await db.query('INSERT INTO courses (title,category,description,instructor_id) VALUES (?,?,?,?)', [t, c, d, inst]))[0].insertId;
  const lesson = async (cid, no, t, quiz, lab) => {
    const id = (await db.query('INSERT INTO lessons (course_id,title,video_url,order_no) VALUES (?,?,?,?)', [cid, t, '/videos/sample.mp4', no]))[0].insertId;
    await db.query('INSERT INTO materials (lesson_id,title,file_url) VALUES (?,?,?)', [id, t + ' - notes', 'https://learn.microsoft.com/azure/']);
    if (lab) await db.query('INSERT INTO labs (lesson_id,title,instructions,video_url,max_marks) VALUES (?,?,?,?,20)', [id, lab, 'Watch the lab video, complete the task and submit a file, text answer or GitHub link.', '/videos/sample.mp4']);
    if (quiz) {
      const z = (await db.query('INSERT INTO quizzes (course_id,lesson_id,title) VALUES (?,?,?)', [cid, id, t + ' quiz']))[0].insertId;
      for (const [q, o, a] of quiz) await db.query('INSERT INTO quiz_questions (quiz_id,question_text,options,correct_option) VALUES (?,?,?,?)', [z, q, JSON.stringify(o), a]);
    }
  };
  const a = await course('Cloud Computing with Azure', 'Cloud', 'Virtual machines, virtual networks and NSGs, ending with a two-tier deployment.');
  await lesson(a, 1, 'Azure basics and regions', [['Which Azure resource filters traffic to a VM?', ['Network Security Group', 'Managed Disk', 'Azure Monitor'], 0], ['Which service gives VMs private communication?', ['Blob Storage', 'Virtual Network', 'Public IP'], 1]], 'Create your first Linux VM');
  await lesson(a, 2, 'Securing the database VM', [['Default MySQL port?', ['22', '3306', '443'], 1]], 'Lock down MySQL with NSG rules');
  const b = await course('Node.js Backend Development', 'Web', 'REST APIs with Express and MySQL.');
  await lesson(b, 1, 'REST APIs with Express', [['Which HTTP method updates a resource?', ['GET', 'PUT', 'TRACE'], 1]], 'Build a /health endpoint');
  await lesson(b, 2, 'Saving data in MySQL', [['How do you prevent SQL injection?', ['String concatenation', 'Parameterized queries', 'Longer passwords'], 1]], null);
  console.log('Seeded. Logins (password demo123): admin@demo.com, instructor@demo.com, student@demo.com');
  process.exit();
})().catch(e => { console.error(e.message); process.exit(1); });
