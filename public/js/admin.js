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
