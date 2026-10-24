# CloudLearn - E-Learning and Course Management Platform
Member 1 delivers this application. Member 2 uses it for the database, Azure and DevOps work.

## Folder structure
```
cloudlearn/
  server.js        Node.js + Express REST API (all business logic)
  schema.sql       MySQL tables (Member 2 owns this)
  seed.js          Loads demo users/courses:  npm run seed
  Jenkinsfile      CI/CD pipeline (Member 2 owns this)
  .env.example     Settings: copy to .env
  package.json
  public/          Website served by Express
    index.html       Page shell
    css/style.css    All styling (light and dark theme)
    js/              core.js (API client, router), auth.js, student.js, lesson.js,
                     instructor.js, admin.js, main.js
    videos/sample.mp4  Demo lecture video
    uploads/         Lab files uploaded by students (created automatically)
```

## How it works
Browser (public/index.html) -> HTTP calls to /api/... -> server.js -> MySQL.
- Login returns a token; the browser sends it with every call.
- Video resume: the page saves the video time to PUT /api/lessons/:id/progress every 10 seconds, on pause and when the page closes. The API stores it in table playback_progress (one row per student and lesson). When the lesson opens again, GET /api/lessons/:id/progress returns the time and the video jumps to it.
- Labs: student submits text, link or file (saved in public/uploads, path stored in MySQL). Instructor grades.
- Quizzes: answers are checked on the server; correct answers are never sent before submitting.

## Run on your PC (Windows / Mac / Linux)
1. Install Node.js 18+ (nodejs.org) and MySQL 8 (MySQL Installer on Windows). Remember the MySQL root password.
2. Open a terminal in the cloudlearn folder.
3. Create the database:  `mysql -u root -p < schema.sql`
   (on Windows, if mysql is not recognised, open "MySQL Command Line Client" and run `source C:/path/to/cloudlearn/schema.sql;`)
4. Copy `.env.example` to `.env`. Set DB_PASSWORD to `change_me` (the password in schema.sql) or change it in both places. Set JWT_SECRET to any long random text.
5. `npm install`
6. `npm run seed`      (creates demo accounts, password demo123)
7. `npm start`
8. Open http://localhost:3000 and log in as student@demo.com / demo123 (also instructor@demo.com, admin@demo.com).
Health check: http://localhost:3000/api/health

## Test the video resume
Log in as the student, enroll in a course, open a lesson, play to about 1:00, close the tab, reopen the site, click Continue learning or the lesson. The video resumes near 1:00. Log in from another browser: same position.

## Member 2 handoff
Database
- Review/extend schema.sql, add indexes, create the least-privilege user (host must be the App VM private IP/subnet on Azure).
- Backups: nightly mysqldump to a separate disk.
Azure
- VNet 10.0.0.0/16, subnets app 10.0.1.0/24 and db 10.0.2.0/24. VM1 (app, public IP), VM2 (database, no public IP).
- NSG App VM: 80/443 from Internet; 22 (and 8080 for Jenkins) only from your IP. NSG DB VM: 3306 only from 10.0.1.0/24; deny Internet.
- DB VM: set `bind-address` to its private IP, restart MySQL, run schema.sql and `npm run seed` (seed can be run from the App VM once DB_HOST points to the DB VM).
- App VM: install nginx, Node.js 18+, pm2. Copy project to /var/www/cloudlearn, create .env with DB_HOST=<DB VM private IP>, then `npm ci --omit=dev && pm2 start server.js --name cloudlearn && pm2 save`. Nginx: proxy_pass http://127.0.0.1:3000; set `client_max_body_size 20m;` and allow video range requests (default is fine). Add HTTPS with certbot if you have a domain.
- Videos: public/videos is on the App VM disk. For more/larger videos move them to Azure Blob Storage and put the URL in the lesson's video URL.
DevOps
- Push the project to GitHub (.gitignore already excludes node_modules, .env, uploads).
- Jenkins: add SSH credential `azure-app-vm-key`, fill the VM IP placeholders in Jenkinsfile, create a Pipeline job, add a GitHub webhook.
- Monitoring: Azure Monitor alerts for CPU, disk and VM down. Stop/deallocate VMs when idle to save credits.
Environment variables: PORT, DB_HOST, DB_USER, DB_PASSWORD, DB_NAME, JWT_SECRET.

## API summary
POST /api/register, /api/login · GET /api/courses, /api/courses/:id, /api/lessons/:id · POST /api/courses/:id/enroll
GET/PUT /api/lessons/:id/progress (PUT {"position":750,"duration":1200}) · GET /api/students/me/continue-learning, /api/students/me/courses
POST /api/labs/:id/submissions (multipart) · GET /api/instructor/submissions, /api/instructor/courses · PUT /api/submissions/:id/grade
POST /api/courses, /api/courses/:id/lessons · DELETE /api/courses/:id
GET /api/lessons/:id/quiz · POST /api/quizzes/:id/attempt
GET /api/admin/stats, /api/admin/users · PUT /api/admin/users/:id/status
