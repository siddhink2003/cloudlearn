/* Instructor dashboard: courses, lessons, coding exercises and lab grading */

async function insV() {
  const [cs, subs] = await Promise.all([
    api('/instructor/courses'),
    api('/instructor/submissions')
  ]);

  return `
    <h2>My courses</h2>

    ${cs.map(c => `
      <div class="card">
        <b>${E(c.title)}</b>
        <span class="chip">${E(c.category)}</span>
        <p class="mu">${c.lessons} lessons · ${c.students} students enrolled</p>
        <button class="s" onclick="go('course',${c.course_id})">Open</button>
        <button class="s" onclick="dc(${c.course_id})">Delete</button>
      </div>
    `).join('') || '<p class="mu">No courses yet.</p>'}

    <h3>Create a course</h3>
    <div class="card">
      <input id="ct" placeholder="Course title">
      <input id="cc" placeholder="Category">
      <textarea id="cd" placeholder="Description"></textarea>
      <button onclick="ac()">Create course</button>
    </div>

    ${cs.length ? `
      <h3>Add a lesson</h3>
      <div class="card">
        <label for="lc">Course</label>
        <select id="lc">
          ${cs.map(c => `
            <option value="${c.course_id}">${E(c.title)}</option>
          `).join('')}
        </select>

        <label for="lt2">Lesson title</label>
        <input id="lt2" placeholder="Lesson title">

        <label for="lv">Lecture video URL</label>
        <input id="lv" placeholder="YouTube URL or direct video URL">

        <h4>Study materials</h4>
        <input id="lm" placeholder="Study material title (optional)">
        <input id="lu" placeholder="Study material link (optional)">

        <hr>
        <h4>Lab assignment</h4>
        <input id="ll" placeholder="Lab title (optional)">
        <textarea id="li" placeholder="Lab instructions"></textarea>
        <input id="llv" placeholder="Lab video URL (optional)">

        <label for="lmks">Maximum marks</label>
        <input id="lmks" type="number" min="1" max="100"
          value="20" placeholder="Maximum marks">

        <h4>Coding exercise</h4>

        <label>
          <input type="checkbox" id="code-enabled"
            onchange="toggleCodeExercise()">
          Add a runnable coding exercise
        </label>

        <div id="code-exercise-fields" style="display:none">
          <label for="code-exercise-language">Programming language</label>
          <select id="code-exercise-language"
            onchange="setInstructorStarterCode()">
            <option value="python">Python 3</option>
            <option value="java">Java</option>
          </select>

          <label for="code-exercise-starter">Starter code</label>
          <textarea id="code-exercise-starter"
            spellcheck="false"
            style="width:100%;min-height:180px;font-family:Consolas,monospace"></textarea>

          <label for="code-exercise-tests">Grading test cases (JSON)</label>
          <textarea id="code-exercise-tests"
            style="width:100%;min-height:140px;font-family:Consolas,monospace"
            placeholder='[{"input":"","expected":"Hello, CloudLearn!"}]'></textarea>

          <p class="mu">
            Test cases are used for grading. They must be validated and kept
            private by the server.
          </p>
        </div>

        <hr>
        <h4>Quiz (optional)</h4>
        <input id="lq" placeholder="Quiz question (optional)">
        <input id="lo" placeholder="Quiz options, separated by commas">
        <label for="la">Correct option number</label>
        <input id="la" type="number" min="1" value="1">

        <button onclick="al()">Add lesson</button>
      </div>
    ` : ''}

    <h3>Lab submissions</h3>

    ${subs.length ? `
      <div class="card" style="overflow-x:auto">
        <table>
          <tr>
            <th>Student</th>
            <th>Lab</th>
            <th>Answer</th>
            <th>Marks and feedback</th>
          </tr>

          ${subs.map(s => `
            <tr>
              <td>
                ${E(s.student)}
                <div class="mu">${new Date(s.submitted_at).toLocaleString()}</div>
              </td>
              <td>${E(s.lab)}</td>
              <td>
                ${E(s.text_answer)}
                ${s.file_url ? `
                  <div>
                    <a href="${E(s.file_url)}"
                      target="_blank" rel="noopener">Attached file</a>
                  </div>
                ` : ''}
              </td>
              <td>
                <input id="m${s.submission_id}"
                  type="number" min="0" max="${s.max_marks}"
                  value="${s.marks ?? ''}"
                  placeholder="Marks /${s.max_marks}">

                <input id="f${s.submission_id}"
                  value="${E(s.feedback || '')}"
                  placeholder="Feedback">

                <button class="s"
                  onclick="gr(${s.submission_id})">Save grade</button>
              </td>
            </tr>
          `).join('')}
        </table>
      </div>
    ` : '<p class="mu">No submissions yet.</p>'}
  `;
}


/* Default starter code for the selected language */

function instructorStarterCode(language) {
  if (language === 'java') {
    return `public class Main {
    public static void main(String[] args) {
        System.out.println("Hello, CloudLearn!");
    }
}`;
  }

  return 'print("Hello, CloudLearn!")';
}


/* Show or hide coding exercise fields */

function toggleCodeExercise() {
  const enabled = document.querySelector('#code-enabled');
  const fields = document.querySelector('#code-exercise-fields');

  if (fields && enabled) {
    fields.style.display = enabled.checked ? 'block' : 'none';
  }

  if (enabled?.checked) {
    setInstructorStarterCode();
  }
}


/* Change the starter code when the instructor selects a language */

function setInstructorStarterCode() {
  const language = document.querySelector('#code-exercise-language')?.value;
  const starter = document.querySelector('#code-exercise-starter');

  if (!language || !starter) return;

  starter.value = instructorStarterCode(language);
}


/* Create course */

const ac = () => act(async () => {
  const title = document.querySelector('#ct').value.trim();

  if (!title) {
    throw new Error('Enter a course title.');
  }

  await api('/courses', 'POST', {
    title,
    category: document.querySelector('#cc').value.trim(),
    description: document.querySelector('#cd').value.trim()
  });

  T('Course created');
  R();
});


/* Create lesson, lab, coding exercise and quiz */

const al = () => act(async () => {
  const lessonTitle = document.querySelector('#lt2').value.trim();
  const labTitle = document.querySelector('#ll').value.trim();
  const codeEnabled = document.querySelector('#code-enabled').checked;

  const quizQuestion = document.querySelector('#lq').value.trim();
  const quizOptions = document.querySelector('#lo').value
    .split(',')
    .map(x => x.trim())
    .filter(Boolean);

  if (!lessonTitle) {
    throw new Error('Enter a lesson title.');
  }

  if (codeEnabled && !labTitle) {
    throw new Error('Enter a lab title for the coding exercise.');
  }

  if (quizQuestion && quizOptions.length < 2) {
    throw new Error('Add at least two quiz options.');
  }

  const maximumMarks = Number(document.querySelector('#lmks').value);

  if (labTitle && (!Number.isInteger(maximumMarks) ||
      maximumMarks < 1 || maximumMarks > 100)) {
    throw new Error('Maximum marks must be between 1 and 100.');
  }

  let codingExercise = null;

  if (codeEnabled) {
    const language =
      document.querySelector('#code-exercise-language').value;

    const starterCode =
      document.querySelector('#code-exercise-starter').value;

    const testsText =
      document.querySelector('#code-exercise-tests').value.trim();

    let testCases;

    try {
      testCases = JSON.parse(testsText);
    } catch {
      throw new Error('Grading test cases must be valid JSON.');
    }

    if (!Array.isArray(testCases) ||
        testCases.length < 1 ||
        testCases.length > 20) {
      throw new Error('Provide between 1 and 20 grading test cases.');
    }

    for (const test of testCases) {
      if (!test ||
          typeof test.input !== 'string' ||
          typeof test.expected !== 'string') {
        throw new Error(
          'Each test case must contain string fields named input and expected.'
        );
      }
    }

    codingExercise = {
      language,
      starter_code: starterCode,
      test_cases: testCases
    };
  }

  const q = document.querySelector('#lq').value.trim();

  const lessonData = {
    title: lessonTitle,
    video_url: document.querySelector('#lv').value.trim(),

    materials: [{
      title: document.querySelector('#lm').value.trim(),
      file_url: document.querySelector('#lu').value.trim()
    }],

    lab: labTitle ? {
      title: labTitle,
      instructions: document.querySelector('#li').value,
      video_url: document.querySelector('#llv').value.trim(),
      max_marks: maximumMarks
    } : null,

    coding_exercise: codingExercise,

    quiz: q ? {
      questions: [{
        question: q,
        options: quizOptions,
        correct: Math.min(
          quizOptions.length,
          Math.max(1, Number(document.querySelector('#la').value) || 1)
        ) - 1
      }]
    } : null
  };

  await api(
    '/courses/' + document.querySelector('#lc').value + '/lessons',
    'POST',
    lessonData
  );

  T('Lesson added');
  R();
});


/* Delete course */

const dc = id => act(async () => {
  if (!confirm('Delete this course?')) return;

  await api('/courses/' + id, 'DELETE');
  R();
});


/* Grade student submission */

const gr = id => act(async () => {
  const marks = document.querySelector('#m' + id).value;

  if (marks === '') {
    throw new Error('Enter marks.');
  }

  await api('/submissions/' + id + '/grade', 'PUT', {
    marks: Number(marks),
    feedback: document.querySelector('#f' + id).value
  });

  T('Grade saved');
  R();
});