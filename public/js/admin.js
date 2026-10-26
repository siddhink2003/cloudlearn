/* Admin dashboard: statistics, user management and course management */

async function admV() {
  const [st, us, courses] = await Promise.all([
    api('/admin/stats'),
    api('/admin/users'),
    api('/instructor/courses')
  ]);

  return `
    <h2>Platform overview</h2>

    <div class="g">
      ${Object.entries(st).map(([k, v]) => `
        <div class="card stat">
          <div class="mu">${E(k)}</div>
          <b>${v}</b>
        </div>
      `).join('')}
    </div>

    <h3>Add Instructor</h3>
    <div class="card">
      <form id="addInstructorForm">
        <label for="instructorName">Full name</label>
        <input id="instructorName" name="name" type="text"
          maxlength="100" required>

        <label for="instructorEmail">Email address</label>
        <input id="instructorEmail" name="email" type="email"
          maxlength="150" required>

        <label for="instructorPassword">Initial password</label>
        <input id="instructorPassword" name="password" type="password"
          minlength="8" maxlength="72" required>

        <button type="submit">Create Instructor</button>
      </form>
      <p id="instructorMessage" role="status" aria-live="polite"></p>
    </div>

    <h3>Users</h3>
    <div class="card" style="overflow-x:auto">
      <table>
        <tr>
          <th>Name</th>
          <th>Email</th>
          <th>Role</th>
          <th>Status</th>
          <th>Action</th>
        </tr>
        ${us.map(u => `
          <tr>
            <td>${E(u.name)}</td>
            <td>${E(u.email)}</td>
            <td>${E(u.role)}</td>
            <td>${E(u.status)}</td>
            <td>
              <button class="s"
                onclick="us(${u.user_id},'${u.status === 'active' ? 'inactive' : 'active'}')">
                ${u.status === 'active' ? 'Deactivate' : 'Activate'}
              </button>
            </td>
          </tr>
        `).join('')}
      </table>
    </div>

    <h3>Course management</h3>
    <div class="card" style="overflow-x:auto">
      <table>
        <tr>
          <th>Course</th>
          <th>Instructor ID</th>
          <th>Lessons</th>
          <th>Enrolled students</th>
          <th>Action</th>
        </tr>
        ${courses.map(c => `
          <tr>
            <td>${E(c.title || c.name || 'Untitled')}</td>
            <td>${E(String(c.instructor_id ?? 'N/A'))}</td>
            <td>${E(String(c.lessons ?? 0))}</td>
            <td>${E(String(c.students ?? 0))}</td>
            <td>
              <button class="s"
                onclick="deleteCourse(${c.course_id})">
                Delete course
              </button>
            </td>
          </tr>
        `).join('')}
      </table>
      ${courses.length ? '' : '<p>No courses found.</p>'}
    </div>
  `;
}

const us = (id, s) => act(async () => {
  await api('/admin/users/' + id + '/status', 'PUT', { status: s });
  R();
});

const deleteCourse = id => act(async () => {
  if (!confirm('Delete this course? This may permanently remove course data.')) {
    return;
  }

  await api('/courses/' + id, 'DELETE');
  R();
});

document.addEventListener('submit', async event => {
  if (event.target.id !== 'addInstructorForm') return;

  event.preventDefault();

  const form = event.target;
  const message = document.getElementById('instructorMessage');
  const button = form.querySelector('button[type="submit"]');

  const data = {
    name: form.elements.name.value.trim(),
    email: form.elements.email.value.trim(),
    password: form.elements.password.value
  };

  button.disabled = true;
  message.textContent = 'Creating instructor account...';

  try {
    const result = await api('/admin/instructors', 'POST', data);

    form.reset();
    R();
  } catch (error) {
    message.textContent = error.message || 'Could not create instructor.';
  } finally {
    button.disabled = false;
  }
});