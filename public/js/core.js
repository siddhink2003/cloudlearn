/* CloudLearn core: helpers, API client, router and renderer */
const $=s=>document.querySelector(s);
const E=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const fmt=s=>{s=Math.floor(s||0);return Math.floor(s/60)+':'+String(s%60).padStart(2,'0')};
let tok=localStorage.getItem('cl_tok'),U=JSON.parse(localStorage.getItem('cl_user')||'null'),V={n:'home'},lp=null,ALL=[];
const T=m=>{const t=$('#toast');t.textContent=m;t.style.opacity=1;setTimeout(()=>t.style.opacity=0,2400)};
async function act(f){try{await f()}catch(e){T(e.message)}}
async function api(p,m='GET',b){const o={method:m,headers:{}};if(tok)o.headers.Authorization='Bearer '+tok;
 if(b instanceof FormData)o.body=b;else if(b){o.headers['Content-Type']='application/json';o.body=JSON.stringify(b)}
 const r=await fetch('/api'+p,o),d=await r.json().catch(()=>({}));if(!r.ok){if(r.status==401&&tok)out();throw new Error(d.error||'Request failed')}return d}
const bar=(p,m)=>`<div class=bar><i style="width:${Math.min(100,p||0)}%"></i>${m?`<b style="left:calc(${Math.min(100,m)}% - 1px)"></b>`:''}</div>`;
const pct=c=>Math.round(100*(c.watched+c.labs_done+c.quizzes_done)/Math.max(1,c.lessons+c.labs+c.quizzes));
function go(n,a,b,v){savePos();lp=null;V={n,a,b,v};R();scrollTo(0,0)}
async function R(){const a=$('#app');if(!tok){a.innerHTML=authV();return}
 try{const v={home:U.role=='student'?stuV:U.role=='instructor'?insV:admV,course:crsV,lesson:lesV}[V.n];const h=await v();
  a.innerHTML=`<header><div class=bar-in><span class=br onclick="go('home')"><span class=logo>▶</span>CloudLearn</span><span class=user><span class=av>${E(U.name[0])}</span><span class=ut><b>${E(U.name)}</b><small>${U.role}</small></span><button class=s onclick=out()>Log out</button></span></div></header><main>${h}</main><footer>CloudLearn · Node.js + MySQL on Microsoft Azure</footer>`;
  if(V.n=='lesson')initP()}catch(e){if(tok)a.innerHTML=`<main><p>${E(e.message)}</p><button onclick="go('home')">Home</button></main>`}}

/* helpers for visuals */
const grad=s=>{let h=0;for(const c of String(s))h=(h*31+c.charCodeAt(0))%360;return `linear-gradient(135deg,hsl(${h} 62% 34%),hsl(${(h+45)%360} 68% 50%))`};
const ico=s=>({Cloud:'☁️',Web:'🌐',DevOps:'⚙️'}[s]||'📘');
