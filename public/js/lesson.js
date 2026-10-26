/* Lesson page: video resume, study materials, labs and quizzes */
async function lesV(){const st=U.role=='student',l=await api('/lessons/'+V.b);const[pr,z]=await Promise.all([st?api('/lessons/'+V.b+'/progress'):{last_position_seconds:0},api('/lessons/'+V.b+'/quiz')]);
V.pos = pr.last_position_seconds || 0;

const courseData = st ? await api('/courses/' + V.a) : null;
const courseStats = st ? await api('/students/me/courses') : [];
const courseProgress = st
  ? courseStats.find(c => Number(c.course_id) === Number(V.a))
  : null;

const progressPercent = courseProgress ? pct(courseProgress) : 0;const lab=V.v=='lab',url=lab?l.lab.video_url:l.video_url;
 return `<button class=ln onclick="go('course',${V.a})">Back to ${E(l.course)}</button><h2 style="margin-top:8px">${E(l.title)}</h2>${st && courseProgress ? `
  <section class="card" style="margin:12px 0">
    <div style="display:flex;justify-content:space-between;gap:12px">
      <b>Overall course progress</b>
      <b>${progressPercent}%</b>
    </div>
    ${bar(progressPercent)}
    <p class="mu">
      ${courseProgress.watched}/${courseProgress.lessons} lessons ·
      ${courseProgress.labs_done}/${courseProgress.labs} labs ·
      ${courseProgress.quizzes_done}/${courseProgress.quizzes} quizzes
    </p>
  </section>
` : ''}
 <div class=tabs><button class="s ${lab?'':'on'}" onclick="go('lesson',${V.a},${V.b})">Lecture video</button>${l.lab&&l.lab.video_url?`<button class="s ${lab?'on':''}" onclick="go('lesson',${V.a},${V.b},'lab')">Lab video</button>`:''}</div>
 <div class=card>${url ? (() => {
  const videoUrl = String(url).trim();
  let youtubeId = null;

  try {
    const parsed = new URL(videoUrl);
    const host = parsed.hostname.toLowerCase();

    if (['youtube.com', 'www.youtube.com', 'm.youtube.com'].includes(host)) {
      if (parsed.pathname === '/watch') {
        youtubeId = parsed.searchParams.get('v');
      } else {
        const match = parsed.pathname.match(/^\/(?:embed|shorts)\/([a-zA-Z0-9_-]{11})/);
        if (match) youtubeId = match[1];
      }
    } else if (['youtu.be', 'www.youtu.be'].includes(host)) {
      youtubeId = parsed.pathname.split('/').filter(Boolean)[0];
    }
  } catch (_) {}

  if (youtubeId && /^[a-zA-Z0-9_-]{11}$/.test(youtubeId)) {
    return `<iframe
      title="Lesson video"
      src="https://www.youtube-nocookie.com/embed/${youtubeId}?enablejsapi=1&origin=${encodeURIComponent(location.origin)}"
      style="width:100%;aspect-ratio:16/9;border:0;border-radius:8px"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      referrerpolicy="strict-origin-when-cross-origin"
      allowfullscreen></iframe>`;
  }

  return `<video id="vd" controls preload="metadata" src="${E(videoUrl)}" style="width:100%;max-width:100%"></video>`;
})() : '<p class=mu>No video has been added to this lesson yet.</p>'}</div>
 <h3>Study materials</h3>${l.materials.length?'<ul>'+l.materials.map(m=>`<li><a href="${E(m.file_url)}" target=_blank rel=noopener>${E(m.title)}</a></li>`).join('')+'</ul>':'<p class=mu>No materials yet.</p>'}`+labH(l,st)+quizH(z,st)}

function loadYouTubeAPI() {
  if (window.YT && window.YT.Player) return Promise.resolve();

  if (window.youtubeAPIReady) return window.youtubeAPIReady;

  window.youtubeAPIReady = new Promise(resolve => {
    const previous = window.onYouTubeIframeAPIReady;

    window.onYouTubeIframeAPIReady = () => {
      if (typeof previous === 'function') previous();
      resolve();
    };

    if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(script);
    }
  });

  return window.youtubeAPIReady;
}

 function initP() {
  const vd = $('#vd');
  const yt = document.querySelector('iframe[src*="youtube-nocookie.com/embed/"]');
  const lab = V.v === 'lab';

  lp = {
    id: V.b,
    last: 0,
    lab,
    st: U.role === 'student'
  };

  // Existing direct video support.
  if (vd) {
    vd.addEventListener('loadedmetadata', () => {
      const p = lab ? +(localStorage.getItem('lab_' + V.b) || 0) : V.pos;

      if (p > 5 && p < vd.duration - 5) {
        vd.currentTime = p;
        const note = $('#nt');
        if (note) note.textContent = 'Resumed from your saved position, ' + fmt(p);
      } else {
        const note = $('#nt');
        if (note) note.textContent = 'Starting from the beginning';
      }
    });

    vd.addEventListener('timeupdate', () => {
      if (Math.abs(vd.currentTime - lp.last) >= 10) savePos();
    });

    ['pause', 'ended'].forEach(e => vd.addEventListener(e, savePos));
    return;
  }

  // YouTube support.
  if (!yt || typeof YT === 'undefined' || !YT.Player) return;

  new YT.Player(yt, {
    events: {
      onReady: event => {
        const player = event.target;
        const p = lab ? +(localStorage.getItem('lab_' + V.b) || 0) : V.pos;

        if (p > 5 && p < player.getDuration() - 5) {
          player.seekTo(p, true);
          const note = $('#nt');
          if (note) note.textContent = 'Resuming from your saved position, ' + fmt(p);
        } else {
          const note = $('#nt');
          if (note) note.textContent = 'Starting from the beginning';
        }

        lp.youtubePlayer = player;

        lp.youtubeTimer = setInterval(() => {
          if (!lp || lp.youtubePlayer !== player) return;

          const state = player.getPlayerState();

          // Save while playing, and save the final position when paused or ended.
          if (state === YT.PlayerState.PLAYING &&
              Math.abs(player.getCurrentTime() - lp.last) >= 10) {
            savePos();
          }
        }, 2000);
      },

      onStateChange: event => {
        if (
          event.data === YT.PlayerState.PAUSED ||
          event.data === YT.PlayerState.ENDED
        ) {
          savePos();
        }
      }
    }
  });
}
function savePos() {
  if (!lp || !tok) return;

  const vd = $('#vd');
  let t;
  let duration;

  if (vd) {
    if (!vd.duration || !Number.isFinite(vd.duration)) return;

    t = Math.floor(vd.currentTime);
    duration = Math.floor(vd.duration);
  } else if (lp.youtubePlayer) {
    const player = lp.youtubePlayer;

    t = Math.floor(player.getCurrentTime());
    duration = Math.floor(player.getDuration());

    if (!Number.isFinite(t) || !Number.isFinite(duration) || duration <= 0) {
      return;
    }
  } else {
    return;
  }

  lp.last = t;

  if (lp.lab) {
    localStorage.setItem('lab_' + lp.id, t);
    return;
  }

  if (!lp.st) return;

  fetch('/api/lessons/' + lp.id + '/progress', {
    method: 'PUT',
    keepalive: true,
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + tok
    },
    body: JSON.stringify({
      position: t,
      duration
    })
  })
    .then(() => {
      const n = $('#nt');
      if (n) n.textContent = 'Position ' + fmt(t) + ' saved to the database';
    })
    .catch(() => {});
}

function labH(l, st) {
  const b = l.lab;
  if (!b) return '';

  const s = b.submission;
  const exercise = b.coding_exercise;
  const language = exercise?.language || 'python';
  const canRun = st && !!exercise;

  const starterCode = language === 'java'
    ? 'public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, CloudLearn!");\n    }\n}'
    : 'print("Hello, CloudLearn!")';

  return `
    <h3>Lab: ${E(b.title)}</h3>

    <div class="card">
      <p>${E(b.instructions)}</p>
      <p class="mu">
        Maximum marks: ${b.max_marks}
        ${b.deadline ? ' · Deadline: ' + new Date(b.deadline).toLocaleString() : ''}
      </p>

      ${s ? `<p>Status: ${
        s.status === 'graded'
          ? `<span class="ok">Graded ${s.marks}/${b.max_marks}</span>${s.feedback ? ' · Feedback: ' + E(s.feedback) : ''}`
          : `<span class="fl">${s.status === 'late' ? 'Submitted late' : 'Submitted'}, waiting for grading</span>`
      }</p>` : ''}

      ${canRun ? `
        <section class="code-lab">
          <h3>Code Editor</h3>

          <label for="code-language">Language</label>
<select id="code-language" onchange="changeLabLanguage()">
  <option value="python" ${language === 'python' ? 'selected' : ''}>Python 3</option>
  <option value="java" ${language === 'java' ? 'selected' : ''}>Java</option>
</select>

          <label for="code-source">Write your code</label>
          <textarea
            id="code-source"
            spellcheck="false"
            autocapitalize="off"
            autocomplete="off"
            style="width:100%;min-height:260px;font-family:Consolas,monospace;tab-size:4"
          >${E(starterCode)}</textarea>

          <label for="code-input">Custom input (optional)</label>
          <textarea
            id="code-input"
            placeholder="Enter input for input() or Scanner..."
            style="width:100%;min-height:70px;font-family:Consolas,monospace"
          ></textarea>

          <div style="display:flex;gap:8px;flex-wrap:wrap;margin:12px 0">
            <button id="run-code-btn" onclick="runLabCode(${b.lab_id})">▶ Run Code</button>
            <button type="button" onclick="clearLabOutput()">Clear Output</button>
            <button type="button" onclick="resetLabCode()">Reset Code</button>
          </div>

          <h4>Output</h4>
          <pre id="code-output" style="white-space:pre-wrap;overflow-wrap:anywhere;min-height:60px;padding:12px;background:#111827;color:#e5e7eb;border-radius:6px">Output will appear here.</pre>
        </section>
      ` : st ? `
        <p class="mu">No coding exercise is configured for this lab yet.</p>
      ` : ''}

      ${st ? `
        <hr>
        <h3>Submit Lab</h3>
        <p class="mu">Submit your written answer or attach a file separately from running code.</p>
        <textarea id="lt" placeholder="Write your answer or paste a GitHub link"></textarea>
        <input id="lf" type="file">
        <p class="mu">Optional file: PDF, DOCX, ZIP, PNG, JPG or TXT, up to 10 MB.</p>
        <button onclick="subL(${b.lab_id})">${s ? 'Resubmit lab' : 'Submit lab'}</button>
      ` : ''}
    </div>
    
  `;
}

function changeLabLanguage() {
  const language = document.querySelector('#code-language')?.value;
  const source = document.querySelector('#code-source');
  const input = document.querySelector('#code-input');

  if (!source || !language) return;

  if (language === 'java') {
    source.value = `public class Main {
    public static void main(String[] args) {
        System.out.println("Hello, CloudLearn!");
    }
}`;
  } else {
    source.value = 'print("Hello, CloudLearn!")';
  }

  if (input) input.value = '';
  clearLabOutput();
}


async function runLabCode(labId) {
  const button = document.querySelector('#run-code-btn');
  const output = document.querySelector('#code-output');

  if (!button || !output) return;

  button.disabled = true;
  output.textContent = 'Running code...';

  try {
    const result = await api('/labs/' + labId + '/run', 'POST', {
      language: document.querySelector('#code-language').value,
      code: document.querySelector('#code-source').value,
      input: document.querySelector('#code-input').value
    });

    output.textContent = result.output || '(No output)';

    if (result.error) {
      output.textContent += '\n\nError: ' + result.error;
    }

    if (!result.success && !result.error) {
      output.textContent += '\n\nExecution did not complete successfully.';
    }
  } catch (error) {
    output.textContent = 'Error: ' + error.message;
  } finally {
    button.disabled = false;
  }
}

function clearLabOutput() {
  const output = document.querySelector('#code-output');
  if (output) output.textContent = '';
}

function resetLabCode() {
  const language = document.querySelector('#code-language')?.value;
  const source = document.querySelector('#code-source');
  if (!source || !language) return;

  source.value = language === 'java'
    ? 'public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, CloudLearn!");\n    }\n}'
    : 'print("Hello, CloudLearn!")';

  const input = document.querySelector('#code-input');
  if (input) input.value = '';

  clearLabOutput();
}
const subL=id=>act(async()=>{const f=new FormData();f.append('text_answer',$('#lt').value.trim());if($('#lf').files[0])f.append('file',$('#lf').files[0]);if(!$('#lt').value.trim()&&!$('#lf').files[0])throw new Error('Add an answer, link or file first');await api('/labs/'+id+'/submissions','POST',f);T('Lab submitted');R()});
function quizH(z,st){if(!z)return'';let h='<h3>Quiz</h3><div class=card>';
 if(V.res){const r=V.res;h+=`<p><b>Score: ${r.score}/${r.total}</b> · <span class="${r.passed?'ok':'fl'}">${r.passed?'Passed':'Not passed yet'}</span></p>`}else if(z.last)h+=`<p><b>Last score: ${z.last.score}/${z.last.total}</b> (attempt ${z.last.attempt_no} of ${z.max_attempts})</p>`;
 if(st)h+=z.questions.map((q,i)=>{const c=V.res&&V.res.correct[q.question_id];return `<p><b>${i+1}. ${E(q.question_text)}</b>${V.res?(V.res.mine[q.question_id]==c?' <span class=ok>Correct</span>':' <span class=fl>Incorrect, answer: '+E(q.options[c])+'</span>'):''}</p>`+q.options.map((o,j)=>`<label style="display:block"><input type=radio name="q${q.question_id}" value=${j} style="display:inline;width:auto;margin-right:6px">${E(o)}</label>`).join('')}).join('')+`<br><button onclick="subQ(${z.quiz_id})">${z.last?'Try again':'Submit quiz'}</button>`;
 return h+'</div>'}
const subQ=id=>act(async()=>{const a={};document.querySelectorAll('input[type=radio]:checked').forEach(r=>a[r.name.slice(1)]=+r.value);const n=document.querySelectorAll('.card label').length&&new Set([...document.querySelectorAll('input[type=radio]')].map(r=>r.name)).size;
 if(Object.keys(a).length<n)throw new Error('Answer every question first');const r=await api('/quizzes/'+id+'/attempt','POST',{answers:a});V.res={...r,mine:a};await R();V.res=null;T('Quiz scored: '+r.score+'/'+r.total)});
