
CREATE TABLE IF NOT EXISTS coding_exercises (
  exercise_id INT AUTO_INCREMENT PRIMARY KEY,
  lab_id INT NOT NULL UNIQUE,
  language VARCHAR(20) NOT NULL DEFAULT 'python',
  starter_code TEXT,
  test_cases JSON NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (lab_id) REFERENCES labs(lab_id) ON DELETE CASCADE
);
