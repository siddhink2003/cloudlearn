CREATE DATABASE IF NOT EXISTS cloudlearn;
USE cloudlearn;

CREATE TABLE users (
  user_id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(100) NOT NULL,
  role ENUM('student','instructor','admin') NOT NULL DEFAULT 'student',
  status ENUM('active','inactive') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE courses (
  course_id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(150) NOT NULL,
  description TEXT,
  category VARCHAR(60),
  instructor_id INT NOT NULL,
  status ENUM('draft','published') DEFAULT 'published',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (instructor_id) REFERENCES users(user_id)
);
CREATE TABLE enrollments (
  enrollment_id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  course_id INT NOT NULL,
  enrolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_enroll (student_id, course_id),
  FOREIGN KEY (student_id) REFERENCES users(user_id),
  FOREIGN KEY (course_id) REFERENCES courses(course_id) ON DELETE CASCADE
);
CREATE TABLE lessons (
  lesson_id INT AUTO_INCREMENT PRIMARY KEY,
  course_id INT NOT NULL,
  title VARCHAR(150) NOT NULL,
  video_url VARCHAR(300),
  duration_seconds INT NOT NULL DEFAULT 0,
  order_no INT NOT NULL DEFAULT 1,
  FOREIGN KEY (course_id) REFERENCES courses(course_id) ON DELETE CASCADE
);
CREATE TABLE materials (
  material_id INT AUTO_INCREMENT PRIMARY KEY,
  lesson_id INT NOT NULL,
  title VARCHAR(150),
  file_url VARCHAR(300),
  FOREIGN KEY (lesson_id) REFERENCES lessons(lesson_id) ON DELETE CASCADE
);
CREATE TABLE playback_progress (
  student_id INT NOT NULL,
  lesson_id INT NOT NULL,
  last_position_seconds INT NOT NULL DEFAULT 0,
  is_completed TINYINT(1) NOT NULL DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (student_id, lesson_id),
  FOREIGN KEY (student_id) REFERENCES users(user_id),
  FOREIGN KEY (lesson_id) REFERENCES lessons(lesson_id) ON DELETE CASCADE
);
CREATE TABLE labs (
  lab_id INT AUTO_INCREMENT PRIMARY KEY,
  lesson_id INT NOT NULL,
  title VARCHAR(150) NOT NULL,
  instructions TEXT,
  video_url VARCHAR(300),
  deadline DATETIME NULL,
  max_marks INT NOT NULL DEFAULT 20,
  FOREIGN KEY (lesson_id) REFERENCES lessons(lesson_id) ON DELETE CASCADE
);
CREATE TABLE lab_submissions (
  submission_id INT AUTO_INCREMENT PRIMARY KEY,
  lab_id INT NOT NULL,
  student_id INT NOT NULL,
  text_answer TEXT,
  file_url VARCHAR(300),
  submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status ENUM('submitted','late','graded') DEFAULT 'submitted',
  marks INT NULL,
  feedback TEXT,
  FOREIGN KEY (lab_id) REFERENCES labs(lab_id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES users(user_id)
);
CREATE TABLE quizzes (
  quiz_id INT AUTO_INCREMENT PRIMARY KEY,
  course_id INT NOT NULL,
  lesson_id INT NULL,
  title VARCHAR(150) NOT NULL,
  time_limit_minutes INT DEFAULT 10,
  max_attempts INT DEFAULT 3,
  pass_score INT DEFAULT 50,
  FOREIGN KEY (course_id) REFERENCES courses(course_id) ON DELETE CASCADE
);
CREATE TABLE quiz_questions (
  question_id INT AUTO_INCREMENT PRIMARY KEY,
  quiz_id INT NOT NULL,
  question_text VARCHAR(300) NOT NULL,
  options JSON NOT NULL,
  correct_option INT NOT NULL,
  marks INT NOT NULL DEFAULT 1,
  FOREIGN KEY (quiz_id) REFERENCES quizzes(quiz_id) ON DELETE CASCADE
);
CREATE TABLE quiz_results (
  result_id INT AUTO_INCREMENT PRIMARY KEY,
  quiz_id INT NOT NULL,
  student_id INT NOT NULL,
  score INT NOT NULL,
  total INT NOT NULL,
  attempt_no INT NOT NULL,
  attempted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (quiz_id) REFERENCES quizzes(quiz_id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES users(user_id)
);
CREATE INDEX idx_enroll_student ON enrollments(student_id);
CREATE INDEX idx_lessons_course ON lessons(course_id);

-- Least-privilege application user (on Azure replace 'localhost' with the App VM private IP or subnet, e.g. '10.0.1.%')
CREATE USER IF NOT EXISTS 'cloudlearn_app'@'localhost' IDENTIFIED BY 'change_me';
GRANT SELECT, INSERT, UPDATE, DELETE ON cloudlearn.* TO 'cloudlearn_app'@'localhost';
