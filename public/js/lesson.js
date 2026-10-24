/* Lesson page: video resume, study materials, labs and quizzes */
async function lesV(){const st=U.role=='student',l=await api('/lessons/'+V.b);const[pr,z]=await Promise.all([st?api('/lessons/'+V.b+'/progress'):{last_position_seconds:0},api('/lessons/'+V.b+'/quiz')]);
 V.pos=pr.last_position_seconds;const lab=V.v=='lab',url=lab?l.lab.video_url:l.video_url;
 return `<button class=ln onclick="go('course',${V.a})">Back to ${E(l.course)}</button><h2 style="margin-top:8px">${E(l.title)}</h2>
 <div class=tabs><button class="s ${lab?'':'on'}" onclick="go('lesson',${V.a},${V.b})">Lecture video</button>${l.lab&&l.lab.video_url?`<button class="s ${lab?'on':''}" onclick="go('lesson',${V.a},${V.b},'lab')">Lab video</button>`:''}</div>
 <div class=card>${url?`<video id=vd controls preload=metadata src="${E(url)}"></video>`:'<p class=mu>No video has been added to this lesson yet.</p>'}<p id=nt class=mu></p>${st?'':'<p class=mu>Instructor preview: playback position is not saved.</p>'}</div>
 <h3>Study materials</h3>${l.materials.length?'<ul>'+l.materials.map(m=>`<li><a href="${E(m.file_url)}" target=_blank rel=noopener>${E(m.title)}</a></li>`).join('')+'</ul>':'<p class=mu>No materials yet.</p>'}`+labH(l,st)+quizH(z,st)}
function initP(){const vd=$('#vd');if(!vd)return;const lab=V.v=='lab';lp={id:V.b,last:0,lab,st:U.role=='student'};
 vd.addEventListener('loadedmetadata',()=>{const p=lab?+(localStorage.getItem('lab_'+V.b)||0):V.pos;if(p>5&&p<vd.duration-5){vd.currentTime=p;$('#nt').textContent='Resumed from your saved position, '+fmt(p)}else $('#nt').textContent='Starting from the beginning'});
 vd.addEventListener('timeupdate',()=>{if(Math.abs(vd.currentTime-lp.last)>=10)savePos()});['pause','ended'].forEach(e=>vd.addEventListener(e,savePos))}
function savePos(){const vd=$('#vd');if(!lp||!vd||!vd.duration||!tok)return;const t=Math.floor(vd.currentTime);lp.last=t;
 if(lp.lab){localStorage.setItem('lab_'+lp.id,t);return}if(!lp.st)return;
 fetch('/api/lessons/'+lp.id+'/progress',{method:'PUT',keepalive:true,headers:{'Content-Type':'application/json',Authorization:'Bearer '+tok},body:JSON.stringify({position:t,duration:Math.floor(vd.duration)})}).then(()=>{const n=$('#nt');if(n)n.textContent='Position '+fmt(t)+' saved to the database'}).catch(()=>{})}
addEventListener('pagehide',savePos);document.addEventListener('visibilitychange',()=>{if(document.hidden)savePos()});

function labH(l,st){const b=l.lab;if(!b)return'';const s=b.submission;return `<h3>Lab: ${E(b.title)}</h3><div class=card><p>${E(b.instructions)}</p><p class=mu>Maximum marks: ${b.max_marks}${b.deadline?' · Deadline: '+new Date(b.deadline).toLocaleString():''}</p>`
 +(s?`<p>Status: ${s.status=='graded'?`<span class=ok>Graded ${s.marks}/${b.max_marks}</span>${s.feedback?' · Feedback: '+E(s.feedback):''}`:`<span class=fl>${s.status=='late'?'Submitted late':'Submitted'}, waiting for grading</span>`}</p>`:'')
 +(st?`<textarea id=lt placeholder="Write your answer or paste a GitHub link"></textarea><input id=lf type=file><p class=mu>Optional file: PDF, DOCX, ZIP, PNG, JPG or TXT, up to 10 MB.</p><button onclick="subL(${b.lab_id})">${s?'Resubmit lab':'Submit lab'}</button>`:'')+'</div>'}
const subL=id=>act(async()=>{const f=new FormData();f.append('text_answer',$('#lt').value.trim());if($('#lf').files[0])f.append('file',$('#lf').files[0]);if(!$('#lt').value.trim()&&!$('#lf').files[0])throw new Error('Add an answer, link or file first');await api('/labs/'+id+'/submissions','POST',f);T('Lab submitted');R()});
function quizH(z,st){if(!z)return'';let h='<h3>Quiz</h3><div class=card>';
 if(V.res){const r=V.res;h+=`<p><b>Score: ${r.score}/${r.total}</b> · <span class="${r.passed?'ok':'fl'}">${r.passed?'Passed':'Not passed yet'}</span></p>`}else if(z.last)h+=`<p><b>Last score: ${z.last.score}/${z.last.total}</b> (attempt ${z.last.attempt_no} of ${z.max_attempts})</p>`;
 if(st)h+=z.questions.map((q,i)=>{const c=V.res&&V.res.correct[q.question_id];return `<p><b>${i+1}. ${E(q.question_text)}</b>${V.res?(V.res.mine[q.question_id]==c?' <span class=ok>Correct</span>':' <span class=fl>Incorrect, answer: '+E(q.options[c])+'</span>'):''}</p>`+q.options.map((o,j)=>`<label style="display:block"><input type=radio name="q${q.question_id}" value=${j} style="display:inline;width:auto;margin-right:6px">${E(o)}</label>`).join('')}).join('')+`<br><button onclick="subQ(${z.quiz_id})">${z.last?'Try again':'Submit quiz'}</button>`;
 return h+'</div>'}
const subQ=id=>act(async()=>{const a={};document.querySelectorAll('input[type=radio]:checked').forEach(r=>a[r.name.slice(1)]=+r.value);const n=document.querySelectorAll('.card label').length&&new Set([...document.querySelectorAll('input[type=radio]')].map(r=>r.name)).size;
 if(Object.keys(a).length<n)throw new Error('Answer every question first');const r=await api('/quizzes/'+id+'/attempt','POST',{answers:a});V.res={...r,mine:a};await R();V.res=null;T('Quiz scored: '+r.score+'/'+r.total)});
