// Bod — playful gym + meal tracker. Dummy data + localStorage.
const $ = s => document.querySelector(s);
const store = {
  get(k, fb){ try{ const v = localStorage.getItem(k); return v ? JSON.parse(v) : fb }catch{ return fb } },
  set(k,v){ localStorage.setItem(k, JSON.stringify(v)) }
};
// migrate saved data from old Pip keys to Bod keys
['workouts','meals','vol','prot'].forEach(k=>{
  try{ if(!localStorage.getItem('bod_'+k) && localStorage.getItem('pip_'+k)) localStorage.setItem('bod_'+k, localStorage.getItem('pip_'+k)); }catch{}
});

// --- Duolingo-style game state: streaks, XP, gems, quests ---
const dayStr = (d=new Date())=> d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
const T = dayStr();
const Y = dayStr(new Date(Date.now()-864e5));
const DAILY_GOAL = 50;
function seedXpHist(){
  const h={}, vals=[45,60,20,80,55,70];
  for(let i=6;i>=1;i--) h[dayStr(new Date(Date.now()-i*864e5))]=vals[6-i];
  return h;
}
let xpTotal = store.get('bod_xp', 320);
let gems = store.get('bod_gems', 45);
let streak = store.get('bod_streak', {count:6,last:T});
let daily = store.get('bod_daily', {date:T,xp:30,goalDone:false});
let questState = store.get('bod_quests', {date:T,claimed:[]});
let xphist = store.get('bod_xphist', null) || seedXpHist();
Object.keys(xphist).forEach(k=>{ if((new Date(T)-new Date(k))/864e5 > 7) delete xphist[k]; });
if(daily.date!==T) daily={date:T,xp:0,goalDone:false};
if(questState.date!==T) questState={date:T,claimed:[]};
if(!(T in xphist)) xphist[T]=daily.xp;
function saveGame(){ store.set('bod_xp',xpTotal); store.set('bod_gems',gems); store.set('bod_streak',streak); store.set('bod_daily',daily); store.set('bod_quests',questState); store.set('bod_xphist',xphist); }

function addXP(n, quiet=false){
  xpTotal+=n; daily.xp+=n; xphist[T]=(xphist[T]||0)+n; saveGame(); renderHud();
  if(!quiet && !daily.goalDone && daily.xp>=DAILY_GOAL){
    daily.goalDone=true; gems+=10; saveGame(); renderHud();
    celebrate('DAILY GOAL SMASHED!', '+10 💎 BONUS', 'Chest unlocked. You are unstoppable.');
    confettiBurst(); bounceBod();
  }
}
function touchStreak(){
  if(streak.last===T) return;
  if(streak.last===Y){
    streak.count++;
    const ms={7:'1-WEEK STREAK! 🔥',14:'2-WEEK STREAK! 🔥🔥',30:'30-DAY STREAK!! 🏆',50:'50 DAYS! LEGEND 🏆',100:'100 DAYS?! MYTHIC 🏆'};
    if(ms[streak.count]){ gems+=20; streak.last=T; saveGame(); renderHud(); celebrate(ms[streak.count],'+20 💎','Bod is speechless. Almost.'); confettiBurst(); }
    else toast(`Streak extended: ${streak.count} days! 🔥`);
  } else { streak.count=1; toast('New streak started! Protect it 🔥'); }
  streak.last=T; saveGame();
}
function renderHud(){
  if(!$('#streakCount')) return;
  $('#streakCount').textContent=streak.count;
  $('#gemCount').textContent=gems;
  $('#goalLabel').textContent=`${Math.min(daily.xp,DAILY_GOAL)} / ${DAILY_GOAL} XP`;
  $('#xpFill').style.width=Math.min(100,daily.xp/DAILY_GOAL*100)+'%';
  $('#xpLabel').textContent = daily.goalDone ? 'Chest open! Come back tomorrow 🎉' : `${DAILY_GOAL-daily.xp} XP to open the chest!`;
  $('#chest').textContent = daily.goalDone ? '🎉' : (daily.xp>=DAILY_GOAL*0.6 ? '🎁' : '📦');
  $('#chest').classList.toggle('open', daily.goalDone);
  $('#totalXp').textContent=`Lv ${Math.floor(xpTotal/500)+1} • ${xpTotal} XP`;
  renderQuests(); renderLeague();
}
const QUESTS=[
  {id:'w1',icon:'🏋️',name:'Finish 1 workout',sub:'+20 XP',xp:20,goal:1,prog:()=>workouts.filter(w=>w.date===T).length},
  {id:'m2',icon:'🍙',name:'Log 2 meals',sub:'+15 XP',xp:15,goal:2,prog:()=>meals.filter(m=>(m.day||T)===T).length},
  {id:'x50',icon:'⚡',name:'Earn 50 XP today',sub:'+5 💎',xp:0,gems:5,goal:DAILY_GOAL,prog:()=>Math.min(daily.xp,DAILY_GOAL)},
];
function renderQuests(){
  const box=$('#questList'); if(!box) return;
  box.innerHTML=QUESTS.map(q=>{
    const p=Math.min(q.prog(),q.goal), done=p>=q.goal, claimed=questState.claimed.includes(q.id);
    return `<div class="quest ${claimed?'done':''}"><div class="quest-ico">${claimed?'✅':q.icon}</div><div class="quest-info"><b>${q.name}</b> <small>${p}/${q.goal} • ${q.sub}</small><div class="quest-bar"><div class="qfill" style="width:${p/q.goal*100}%"></div></div></div>${claimed?'<span class="pill">claimed</span>':`<button class="btn primary small claim" data-q="${q.id}" ${done?'':'disabled'}>CLAIM</button>`}</div>`;
  }).join('');
  box.querySelectorAll('.claim').forEach(b=>b.onclick=()=>claimQuest(b.dataset.q));
}
function claimQuest(id){
  const q=QUESTS.find(x=>x.id===id); if(!q||questState.claimed.includes(id)||q.prog()<q.goal) return;
  questState.claimed.push(id);
  if(q.gems) gems+=q.gems;
  saveGame(); addXP(q.xp||0, true); renderHud();
  celebrate('QUEST COMPLETE!', `+${q.xp||0} XP${q.gems?` +${q.gems} 💎`:''}`, q.name+' — done like a champ.');
  confettiBurst(); bounceBod();
}
const RIVALS=[{n:'Ava',e:'🦊',xp:340},{n:'Raj',e:'🐯',xp:290},{n:'Leo',e:'🐸',xp:230},{n:'Zoe',e:'🐰',xp:160},{n:'Max',e:'🐼',xp:95}];
function renderLeague(){
  const box=$('#leagueList'); if(!box) return;
  const mine=Object.values(xphist).reduce((a,b)=>a+b,0);
  const rows=[...RIVALS.map(r=>({...r,you:false})),{n:'You',e:'🐹',xp:mine,you:true}].sort((a,b)=>b.xp-a.xp);
  const medals=['🥇','🥈','🥉'];
  box.innerHTML=rows.map((r,i)=>`<div class="league-row ${r.you?'you':''}"><div class="lrk ${i<3?'m'+(i+1):''}">${medals[i]||(i+1)}</div><div class="lname">${r.e} ${r.n}</div><div class="lxp">${r.xp} XP</div></div>`).join('');
}
function celebrate(title, pill, sub){
  $('#celTitle').textContent=title; $('#celXp').textContent=pill;
  $('#celStreak').textContent=`🔥 ${streak.count}`;
  $('#celSub').textContent=sub||'Bod is doing happy backflips.';
  $('#celebrate').classList.add('open');
}

const seedWorkouts = [
  {id:1,date:'2026-10-14',name:'Barbell Squat',muscle:'Legs',sets:4,reps:8,weight:80},
  {id:2,date:'2026-10-14',name:'Bench Press',muscle:'Push',sets:4,reps:10,weight:60},
  {id:3,date:'2026-10-13',name:'Deadlift',muscle:'Pull',sets:3,reps:6,weight:100},
  {id:4,date:'2026-10-13',name:'Overnight Oats Power',muscle:'Push',sets:3,reps:12,weight:20},
  {id:5,date:'2026-10-12',name:'Pull-ups',muscle:'Pull',sets:4,reps:8,weight:0},
  {id:6,date:'2026-10-12',name:'Plank Party',muscle:'Core',sets:3,reps:1,weight:0},
  {id:7,date:'2026-10-11',name:'Morning Run',muscle:'Cardio',sets:1,reps:1,weight:0},
  {id:8,date:'2026-10-10',name:'Overhead Press',muscle:'Push',sets:3,reps:10,weight:35},
  {id:9,date:'2026-10-09',name:'Romanian Deadlift',muscle:'Legs',sets:3,reps:12,weight:50},
  {id:10,date:'2026-10-08',name:'Barbell Row',muscle:'Pull',sets:4,reps:10,weight:45},
];
const seedMeals = [
  {id:1,name:'Oats + whey + banana',protein:38,cals:520,time:'Breakfast'},
  {id:2,name:'Paneer bowl + rice',protein:32,cals:640,time:'Lunch'},
  {id:3,name:'Greek yoghurt + honey',protein:22,cals:280,time:'Snack'},
  {id:4,name:'Chicken curry + 2 roti',protein:40,cals:700,time:'Dinner'},
];
const seedHistory = [4200,5100,0,6300,5800,7200,8450,6100,5400,7800,6900,8200,7600,8450];
const seedProteinHist = [90,110,60,120,125,140,132,118,105,135,128,142,130,132];

let workouts = store.get('bod_workouts', seedWorkouts);
let meals = store.get('bod_meals', seedMeals);
let volHist = store.get('bod_vol', seedHistory);
let protHist = store.get('bod_prot', seedProteinHist);

const speeches = [
  'Bod says: "Streaks are built one rep at a time. Like this one!"',
  'Bod says: "That owl wishes he had your biceps. Keep going!"',
  'Bod says: "Daily quest available: drink water. Reward: life."',
  'Bod says: "You are 3 workouts from passing Ava in the league. Hunt her. Nicely."',
  'Bod says: "Log a meal, earn XP, become legend. Simple math."',
];

// --- playful dots background (OpenAI-dot inspired) ---
(function dots(){
  const bg = $('#dotsBg'); const colors = ['#58cc02','#1cb0f6','#ffc800','#ff9600','#ff4b4b','#ce82ff'];
  for(let i=0;i<22;i++){ const d=document.createElement('i');
    const s=6+Math.random()*22; d.style.width=d.style.height=s+'px';
    d.style.left=Math.random()*100+'vw'; d.style.top=Math.random()*100+'vh';
    d.style.background=colors[i%colors.length]; d.style.animationDelay=(Math.random()*6)+'s';
    d.style.animationDuration=(6+Math.random()*6)+'s'; bg.appendChild(d);
  }
})();

// --- navigation ---
document.querySelectorAll('.tab').forEach(t=>t.onclick=()=>goto(t.dataset.page));
document.querySelectorAll('[data-goto]').forEach(b=>b.onclick=()=>goto(b.dataset.goto));
function goto(p){
  document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('active',t.dataset.page===p));
  document.querySelectorAll('.page').forEach(s=>s.classList.toggle('active',s.id==='page-'+p));
  window.scrollTo({top:0,behavior:'smooth'});
}

// --- Bod 3D hamster (Three.js) ---
const bod = $('#bod');
function say(t){ const el=$('#bodSpeech'); if(el) el.textContent=t; }
setInterval(()=>say(speeches[Math.floor(Math.random()*speeches.length)]), 9000);
let bodJumpV = 0, bodSpin = 0;
function bounceBod(){
  bodJumpV = 3.2; bodSpin = 6.5;
  bod.classList.remove('bounce'); void bod.offsetWidth; bod.classList.add('bounce');
}
bod.onclick = ()=>{ bounceBod(); say(speeches[Math.floor(Math.random()*speeches.length)]); };

(function initBod3D(){
  const canvas = $('#bod3d');
  if(!canvas || !window.THREE){ canvas.parentElement.innerHTML = '<div style="font-size:90px;text-align:center">🐹</div>'; return; }
  const renderer = new THREE.WebGLRenderer({canvas, alpha:true, antialias:true});
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio||1));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
  camera.position.set(0, 0.6, 6.2);

  scene.add(new THREE.HemisphereLight(0xffffff, 0xeadfc8, 1.1));
  const key = new THREE.DirectionalLight(0xffffff, 1.4); key.position.set(3,5,4); scene.add(key);
  const rim = new THREE.DirectionalLight(0xff8fb1, 0.7); rim.position.set(-4,2,-3); scene.add(rim);

  const ham = new THREE.Group(); scene.add(ham);
  const mat = (c,r=0.55)=>new THREE.MeshStandardMaterial({color:c, roughness:r, metalness:0.02});
  const ORANGE=0xffb26b, CREAM=0xfff4dd, PINK=0xff8fb1, DARK=0x2b2620, BLUE=0x6aa8ff;

  const body = new THREE.Mesh(new THREE.SphereGeometry(1.15, 40, 40), mat(ORANGE,0.6));
  body.scale.set(1, 0.98, 0.92); ham.add(body);

  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.72, 32, 32), mat(CREAM,0.7));
  belly.position.set(0,-0.28,0.72); belly.scale.set(1,1.05,0.55); ham.add(belly);

  // ears
  const ears=[];
  [[-0.72,0.88],[0.72,0.88]].forEach(([x,y])=>{
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.3, 24, 24), mat(ORANGE,0.6));
    ear.position.set(x,y,-0.05); ham.add(ear); ears.push(ear);
    const inner = new THREE.Mesh(new THREE.SphereGeometry(0.15, 20, 20), mat(PINK,0.6));
    inner.position.set(x,y,0.18); ham.add(inner); ears.push(inner);
  });

  // eyes
  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.16,24,24), mat(DARK,0.25));
  const eyeR = eyeL.clone(); eyeL.position.set(-0.38,0.22,0.95); eyeR.position.set(0.38,0.22,0.95);
  ham.add(eyeL,eyeR);
  const shineGeo = new THREE.SphereGeometry(0.05,12,12);
  const shineMat = new THREE.MeshBasicMaterial({color:0xffffff});
  const s1=new THREE.Mesh(shineGeo,shineMat); s1.position.set(-0.33,0.29,1.08);
  const s2=s1.clone(); s2.position.x=0.43; ham.add(s1,s2);

  // cheeks + nose + smile + tooth
  [[-0.62,-0.05],[0.62,-0.05]].forEach(([x,y])=>{
    const ch=new THREE.Mesh(new THREE.SphereGeometry(0.14,16,16), mat(PINK,0.8));
    ch.position.set(x,y,0.88); ch.scale.set(1,0.7,0.5); ham.add(ch);
  });
  const nose=new THREE.Mesh(new THREE.SphereGeometry(0.08,16,16), mat(PINK,0.5));
  nose.position.set(0,0.02,1.1); ham.add(nose);
  const smile=new THREE.Mesh(new THREE.TorusGeometry(0.13,0.025,10,24,Math.PI), mat(DARK,0.5));
  smile.position.set(0,-0.1,1.06); smile.rotation.z=Math.PI; ham.add(smile);
  const tooth=new THREE.Mesh(new THREE.BoxGeometry(0.09,0.09,0.02), new THREE.MeshStandardMaterial({color:0xffffff}));
  tooth.position.set(0,-0.14,1.1); ham.add(tooth);

  // sweatband (gym theme) + tiny knot
  const band=new THREE.Mesh(new THREE.TorusGeometry(0.95,0.11,14,48), mat(BLUE,0.5));
  band.position.set(0,0.62,0.1); band.rotation.x=Math.PI/2-0.18; ham.add(band);
  const knot=new THREE.Mesh(new THREE.SphereGeometry(0.12,14,14), mat(BLUE,0.5));
  knot.position.set(0.9,0.68,-0.15); ham.add(knot);

  // arms + feet + tail
  const armGeo=new THREE.CapsuleGeometry(0.16,0.35,6,14);
  const armL=new THREE.Mesh(armGeo, mat(ORANGE,0.6)); armL.position.set(-1.05,-0.15,0.35); armL.rotation.z=0.5;
  const armR=new THREE.Mesh(armGeo, mat(ORANGE,0.6)); armR.position.set(1.05,-0.15,0.35); armR.rotation.z=-0.5;
  ham.add(armL,armR);
  const footGeo=new THREE.SphereGeometry(0.26,18,18);
  const fL=new THREE.Mesh(footGeo, mat(DARK,0.7)); fL.position.set(-0.5,-1.0,0.35); fL.scale.set(1,0.55,1.3);
  const fR=fL.clone(); fR.position.x=0.5; ham.add(fL,fR);
  const tail=new THREE.Mesh(new THREE.SphereGeometry(0.22,16,16), mat(CREAM,0.7));
  tail.position.set(0,-0.3,-1.0); ham.add(tail);

  // mini dumbbell Bod holds
  const bell=new THREE.Group();
  const barM=new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.05,0.9,12), mat(DARK,0.4));
  barM.rotation.z=Math.PI/2; bell.add(barM);
  [[-0.45],[0.45]].forEach(([x])=>{
    const plate=new THREE.Mesh(new THREE.CylinderGeometry(0.2,0.2,0.12,18), mat(0x1c1a16,0.4));
    plate.rotation.z=Math.PI/2; plate.position.x=x; bell.add(plate);
  });
  bell.position.set(0,-0.55,1.0); bell.rotation.z=0.25; ham.add(bell);

  // soft ground shadow
  const shadow=new THREE.Mesh(new THREE.CircleGeometry(1.0,32),
    new THREE.MeshBasicMaterial({color:0x1c1a16, transparent:true, opacity:0.12}));
  shadow.rotation.x=-Math.PI/2; shadow.position.y=-1.35; scene.add(shadow);

  // sizing
  function size(){
    const w=ham.parent?210:210, h=220;
    const r=canvas.parentElement.getBoundingClientRect();
    renderer.setSize(r.width||210, r.height||220, false);
    camera.aspect=1; camera.updateProjectionMatrix();
  }
  size(); window.addEventListener('resize', size);

  let mx=0,my=0;
  document.addEventListener('mousemove', e=>{
    mx=(e.clientX/window.innerWidth-0.5)*2; my=(e.clientY/window.innerHeight-0.5)*2;
  });

  let t=0, blinkAt=2.5, groundY=0.25;
  ham.position.y=groundY;
  const clock=new THREE.Clock();
  (function tick(){
    requestAnimationFrame(tick);
    const dt=Math.min(0.05, clock.getDelta()); t+=dt;
    // idle bob + breathe
    ham.position.y += ((groundY + Math.sin(t*2.2)*0.09 + bodJumpV*dt*2.2) - ham.position.y)*Math.min(1,dt*10);
    if(bodJumpV>0){ bodJumpV-=dt*9; } else { bodJumpV=0; }
    if(bodSpin>0){ ham.rotation.y+=dt*bodSpin; bodSpin-=dt*6; if(bodSpin<0){bodSpin=0;ham.rotation.y=Math.round(ham.rotation.y/(Math.PI*2))*Math.PI*2;} }
    const s=1+Math.sin(t*3)*0.02; body.scale.set(s,2-s-0.02+0,0.92);
    // look at cursor
    ham.rotation.y += ((mx*0.55 + (bodSpin>0?0:0)) - ham.rotation.y)*Math.min(1,dt*5);
    ham.rotation.x += ((my*0.25) - ham.rotation.x)*Math.min(1,dt*5);
    // wave arms
    armL.rotation.z=0.5+Math.sin(t*3.2)*0.35; armR.rotation.z=-0.5-Math.sin(t*3.2+1)*0.35;
    bell.rotation.z=0.25+Math.sin(t*3.2)*0.12; bell.position.y=-0.55+Math.sin(t*3.2)*0.06;
    ears[0].position.y=0.88+Math.sin(t*4)*0.02;
    // blink
    if(t>blinkAt){ eyeL.scale.y=eyeR.scale.y=0.12; if(t>blinkAt+0.14){ eyeL.scale.y=eyeR.scale.y=1; blinkAt=t+2+Math.random()*3; } }
    // shadow pulse
    const h=Math.max(0,ham.position.y-groundY); shadow.scale.setScalar(1-h*0.15); shadow.material.opacity=0.12-h*0.02;
    renderer.render(scene,camera);
  })();
})();
function toast(msg){ const t=$('#toast'); t.textContent=msg; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),2200); }
function confettiBurst(){
  const c=$('#confetti'); const colors=['#58cc02','#1cb0f6','#ffc800','#ff9600','#ff4b4b'];
  for(let i=0;i<60;i++){ const p=document.createElement('i');
    p.style.left=Math.random()*100+'vw'; p.style.background=colors[i%colors.length];
    p.style.borderRadius=Math.random()>.5?'50%':'4px';
    p.style.animationDuration=(1.5+Math.random()*1.5)+'s'; c.appendChild(p);
    setTimeout(()=>p.remove(),3000);
  }
}

// --- charts ---
function drawMainChart(){
  const svg=$('#mainChart'); const W=600,H=240,P=28;
  const maxV=Math.max(...volHist,1000), maxP=Math.max(...protHist,50);
  const x=i=>P+i*(W-2*P)/(volHist.length-1);
  const yV=v=>H-P-(v/maxV)*(H-2*P), yP=v=>H-P-(v/maxP)*(H-2*P);
  const line=(arr,fn)=>arr.map((v,i)=>(i?'L':'M')+x(i).toFixed(1)+' '+fn(v).toFixed(1)).join(' ');
  const area=line(volHist,yV)+` L${x(volHist.length-1)} ${H-P} L${P} ${H-P} Z`;
  svg.innerHTML=`
    <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1cb0f6" stop-opacity=".22"/><stop offset="1" stop-color="#1cb0f6" stop-opacity="0"/></linearGradient></defs>
    ${[0.25,0.5,0.75].map(f=>`<line x1="${P}" x2="${W-P}" y1="${H*f}" y2="${H*f}" stroke="#e5e5e5" stroke-dasharray="6 6"/>`).join('')}
    <path d="${area}" fill="url(#g)"/>
    <path d="${line(volHist,yV)}" fill="none" stroke="#1cb0f6" stroke-width="3.5" stroke-linecap="round" class="draw"/>
    <path d="${line(protHist,yP)}" fill="none" stroke="#58cc02" stroke-width="3" stroke-dasharray="1 7" stroke-linecap="round"/>
    ${volHist.map((v,i)=>`<g class="pt" style="animation-delay:${i*60}ms"><circle cx="${x(i)}" cy="${yV(v)}" r="6" fill="#ffc800" stroke="#ff9600" stroke-width="2.5"><title>${v} kg</title></circle></g>`).join('')}`;
  $('#chartDays').innerHTML = volHist.map((_,i)=>`<span>${i%2? '': 'd'+(i+1)}</span>`).join('');
}
function drawWeekBars(){
  const days=['M','T','W','T','F','S','S']; const sets=[12,8,15,10,14,18,9];
  const colors=['#58cc02','#1cb0f6','#ffc800','#ff9600','#ff4b4b','#ce82ff','#58cc02'];
  $('#weekBars').innerHTML=days.map((d,i)=>`<div class="bar-col"><div class="bar" style="height:${sets[i]*7}px;background:${colors[i]}"></div><span>${d}</span></div>`).join('');
}

// --- render all ---
function vol(w){ return w.sets*w.reps*w.weight; }
function render(){
  store.set('bod_workouts',workouts); store.set('bod_meals',meals);
  const totalVol = workouts.reduce((a,w)=>a+vol(w),0);
  const totalSets = workouts.reduce((a,w)=>a+w.sets,0);
  meals.forEach(m=>{ if(!m.day) m.day=T; });
  const todayMeals = meals.filter(m=>m.day===T);
  const prot = todayMeals.reduce((a,m)=>a+ +m.protein,0);
  const cals = todayMeals.reduce((a,m)=>a+ +m.cals,0);
  $('#statWorkouts').textContent = 5 + Math.floor(workouts.length/4);
  $('#statVolume').textContent = (totalVol + 8450).toLocaleString() + ' kg';
  $('#statProtein').textContent = (todayMeals.length? Math.round(prot/todayMeals.length*4.2):0) + ' g';
  $('#statCals').textContent = (todayMeals.length? Math.round(cals/todayMeals.length*4.4):0).toLocaleString();
  $('#wTotal').textContent = workouts.length; $('#wSets').textContent = totalSets;
  const pct = Math.min(100, Math.round(prot/160*100));
  $('#proteinPct').textContent = pct+'%';
  $('#proteinRing').style.strokeDashoffset = 302 - 302*pct/100;
  $('#todayFuel').textContent = `${prot}g / 160g protein • ${cals.toLocaleString()} / 2,500 kcal`;
  $('#calBar').style.width = Math.min(100,cals/2500*100)+'%';
  $('#macroProteinLabel').textContent = `${prot} / 160 g`; $('#macroProtein').style.width = Math.min(100,prot/160*100)+'%';
  $('#macroCalLabel').textContent = `${cals.toLocaleString()} / 2500 kcal`; $('#macroCal').style.width = Math.min(100,cals/2500*100)+'%';
  // workouts table
  const q = ($('#workoutSearch').value||'').toLowerCase();
  const chip = document.querySelector('#muscleChips .chip.active')?.textContent || 'All';
  $('#workoutRows').innerHTML = workouts
    .filter(w=>(chip==='All'||w.muscle===chip) && w.name.toLowerCase().includes(q))
    .map(w=>`<tr><td>${w.date.slice(5)}</td><td>${w.name}</td><td><span class="meal-tag">${w.muscle}</span></td><td>${w.sets} × ${w.reps}</td><td>${w.weight} kg</td><td>${vol(w).toLocaleString()} kg</td><td><button class="del" data-id="${w.id}">✕</button></td></tr>`).join('') || '<tr><td colspan=7 style="text-align:center;color:var(--muted)">No workouts. Bod is napping. Add one!</td></tr>';
  document.querySelectorAll('.del').forEach(b=>b.onclick=()=>{ workouts=workouts.filter(w=>w.id!=b.dataset.id); render(); });
  // meals
  const mq = ($('#mealSearch').value||'').toLowerCase();
  const em = {Breakfast:'🌅',Lunch:'🌞',Snack:'🍪',Dinner:'🌙'};
  $('#mealList').innerHTML = meals.filter(m=>m.name.toLowerCase().includes(mq))
    .map(m=>`<div class="meal"><div class="act-emoji">${em[m.time]||'🍙'}</div><div class="meal-info"><b>${m.name}</b><span>${m.time} • ${m.cals} kcal</span></div><span class="meal-tag">💪 ${m.protein}g</span><button class="del" data-mid="${m.id}">✕</button></div>`).join('');
  document.querySelectorAll('[data-mid]').forEach(b=>b.onclick=()=>{ meals=meals.filter(m=>m.id!=b.dataset.mid); render(); });
  // activity
  const acts = [
    ...workouts.slice(0,3).map(w=>({e:'🏋️',t:`<b>${w.name}</b> — ${w.sets}×${w.reps} @ ${w.weight}kg`,s:w.date})),
    ...meals.slice(0,2).map(m=>({e:'🍙',t:`<b>${m.name}</b> — ${m.protein}g protein`,s:m.time})),
  ];
  $('#activityFeed').innerHTML = acts.map(a=>`<div class="act"><div class="act-emoji">${a.e}</div><div>${a.t}</div><span class="pill" style="margin-left:auto">${a.s}</span></div>`).join('');
  drawMainChart(); drawWeekBars(); renderHud();
}
$('#workoutSearch').oninput = render; $('#mealSearch').oninput = render;
document.querySelectorAll('#muscleChips .chip').forEach(c=>c.onclick=()=>{document.querySelectorAll('#muscleChips .chip').forEach(x=>x.classList.remove('active'));c.classList.add('active');render();});

// --- ingredient auto-estimate: local DB (instant) + Open Food Facts (free, no key) ---
const FOOD_DB = [
  {k:['paneer'], p:18, c:265}, {k:['chicken breast','chicken'], p:31, c:165},
  {k:['egg','eggs'], per:1, p:6, c:70, g:50}, {k:['whey','protein scoop','scoop'], per:1, p:24, c:120, g:30},
  {k:['rice'], p:2.7, c:130, cup:150}, {k:['roti','chapati'], per:1, p:4, c:120, g:40},
  {k:['oats'], p:13, c:389}, {k:['milk'], p:3.4, c:42}, {k:['curd','yogurt','yoghurt','greek yogurt'], p:5, c:59},
  {k:['dal','lentil','toor','moong'], p:9, c:116}, {k:['rajma','kidney bean'], p:8, c:127},
  {k:['chana','chickpea','chole'], p:9, c:164}, {k:['soya','soy chunk'], p:52, c:340},
  {k:['peanut butter'], p:25, c:588, tbsp:16}, {k:['peanut','groundnut'], p:26, c:567},
  {k:['almond','badam'], p:21, c:579}, {k:['banana'], per:1, p:1.3, c:105, g:120},
  {k:['apple'], per:1, p:0.5, c:95, g:180}, {k:['bread'], per:1, p:4, c:90, g:30},
  {k:['pasta'], p:5, c:131}, {k:['potato','aloo'], p:2, c:77}, {k:['sweet potato'], p:1.6, c:86},
  {k:['fish','salmon','tuna'], p:25, c:200}, {k:['mutton'], p:25, c:294}, {k:['tofu'], p:8, c:76},
  {k:['cheese'], p:25, c:402}, {k:['butter','ghee'], p:0.9, c:717, tbsp:14},
  {k:['honey'], p:0.3, c:304, tbsp:21}, {k:['samosa'], per:1, p:4, c:260, g:100},
  {k:['dosa'], per:1, p:5, c:170, g:100}, {k:['idli'], per:1, p:2, c:60, g:40},
];
function findLocal(name){
  name=name.toLowerCase();
  return FOOD_DB.find(f=>f.k.some(k=>name.includes(k)));
}
function parseQty(s){
  // returns {qty, unit, name}
  const m = s.trim().match(/^(\d+\.?\d*)\s*(g|kg|ml|cup|cups|tbsp|tsp|pc|pcs|piece|pieces|slice|slices|egg|eggs|roti|scoop|scoops)?\s*(.*)$/i);
  if(!m) return {qty:1, unit:'', name:s.trim()};
  return {qty:parseFloat(m[1]), unit:(m[2]||'').toLowerCase(), name:(m[3]||'').trim()||s.trim()};
}
function gramsFor(item, food){
  const {qty, unit} = item;
  if(unit==='kg') return qty*1000;
  if(unit==='g'||unit==='ml') return qty;
  if(unit.startsWith('cup')) return qty*(food?.cup||150);
  if(unit==='tbsp') return qty*(food?.tbsp||15);
  if(unit==='tsp') return qty*5;
  if(['pc','pcs','piece','pieces','slice','slices','egg','eggs','roti','scoop','scoops'].includes(unit)) return qty*(food?.g||50);
  if(unit==='' && food?.per) return qty*(food.g||50); // "2 eggs", "1 scoop"
  return qty*100; // bare number = that many 100g servings ("2" paneer = 200g)
}
async function lookupOFF(name){
  // Open Food Facts: free, no API key, CORS-enabled
  const r = await fetch(`https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(name)}&search_simple=1&action=process&json=1&page_size=1`);
  const j = await r.json();
  const prod = j.products?.[0]; if(!prod) return null;
  const n = prod.nutriments||{};
  const p100 = n.proteins_100g ?? n.proteins ?? null;
  let k100 = n['energy-kcal_100g'] ?? null;
  if(k100==null && n.energy_100g!=null) k100 = n.energy_100g/4.184;
  if(p100==null||k100==null) return null;
  return {p:+p100, c:+k100, label:prod.product_name||name};
}
async function estimateIngredients(){
  const box = $('#ingResult');
  const raw = $('#ingInput').value.trim();
  if(!raw){ box.innerHTML='<span class="tiny">Type something first — e.g. 100g paneer, 2 eggs</span>'; return; }
  const parts = raw.split(/[,+\n;]+| and /i).map(s=>s.trim()).filter(Boolean);
  box.innerHTML = '<span class="tiny">Bod is sniffing the ingredients… 🐹👃</span>';
  let totalP=0, totalC=0; const rows=[];
  for(const part of parts){
    const item = parseQty(part);
    const name = item.name || part;
    let food = findLocal(name);
    if(food){
      const g = item.unit===''&&!food.per&&!/g|kg|cup|tbsp|tsp|ml/.test(part.toLowerCase()) ? 100 : gramsFor(item, food);
      // if user typed just "paneer" with no qty -> 100g
      const grams = /^\D+$/.test(part.trim()) ? 100 : g;
      const p = food.per ? item.qty*food.p : grams/100*food.p;
      const c = food.per ? item.qty*food.c : grams/100*food.c;
      totalP+=p; totalC+=c; rows.push({t:`${part} ≈ ${Math.round(grams)}g`, p, c, src:'📦 local'});
    } else {
      try{
        const off = await lookupOFF(name);
        if(off){
          const g = /^\D+$/.test(part.trim()) ? 100 : gramsFor(item, null) || 100;
          const grams = isNaN(g)?100:g;
          const p = grams/100*off.p, c = grams/100*off.c;
          totalP+=p; totalC+=c; rows.push({t:`${part} → ${off.label.slice(0,28)}`, p, c, src:'🌍 OFF'});
        } else rows.push({t:`${part} — not found, skipped`, p:0, c:0, src:'❓'});
      }catch{ rows.push({t:`${part} — offline, skipped`, p:0, c:0, src:'❓'}); }
    }
  }
  totalP=Math.round(totalP*10)/10; totalC=Math.round(totalC);
  box.innerHTML = rows.map(r=>`<div class="ing-row">🍽️ ${r.t} <b>• ${Math.round(r.p)}g • ${Math.round(r.c)}kcal</b><span class="src">${r.src}</span></div>`).join('')
    + `<div class="ing-total"><span>Total ≈ ${totalP}g protein • ${totalC} kcal</span><button type="button" id="useEstimate">Use →</button></div>`;
  $('#useEstimate').onclick=()=>{
    $('#mealProtein').value=totalP; $('#mealCals').value=totalC;
    if(!$('#mealName').value) $('#mealName').value = parts.slice(0,3).join(' + ').slice(0,60);
    toast('Auto-filled! Tweak if needed 😋'); bounceBod();
  };
}
$('#ingBtn').onclick = estimateIngredients;
$('#ingInput')?.addEventListener('keydown', e=>{ if(e.key==='Enter'){ e.preventDefault(); estimateIngredients(); } });

// modals
const wM=$('#workoutModal'), mM=$('#mealModal');
$('#openWorkoutModal').onclick=()=>{ wM.classList.add('open'); wM.querySelector('[name=date]').value=new Date().toISOString().slice(0,10); };
$('#openMealModal').onclick=()=>mM.classList.add('open');
document.querySelectorAll('.close-modal').forEach(b=>b.onclick=()=>b.closest('.modal-bg').classList.remove('open'));
document.querySelectorAll('.modal-bg').forEach(m=>m.onclick=e=>{ if(e.target===m) m.classList.remove('open') });

$('#workoutForm').onsubmit=e=>{
  e.preventDefault(); const f=new FormData(e.target);
  const sets=+f.get('sets');
  workouts.unshift({id:Date.now(),date:f.get('date'),name:f.get('name'),muscle:f.get('muscle'),sets:sets,reps:+f.get('reps'),weight:+f.get('weight')});
  volHist.push(workouts.reduce((a,w)=>a+vol(w),0)%9000+4000); volHist.shift();
  wM.classList.remove('open'); e.target.reset();
  const gained=20+sets*2; touchStreak(); addXP(gained);
  render(); bounceBod(); confettiBurst(); toast(`Workout saved! +${gained} XP 🎉`);
};
$('#mealForm').onsubmit=e=>{
  e.preventDefault(); const f=new FormData(e.target);
  meals.unshift({id:Date.now(),day:T,name:f.get('name'),protein:+f.get('protein'),cals:+f.get('cals'),time:f.get('time')});
  mM.classList.remove('open'); e.target.reset();
  touchStreak(); addXP(10);
  render(); bounceBod(); confettiBurst(); toast('Meal logged! +10 XP 😋');
};
$('#celBtn').onclick=()=>$('#celebrate').classList.remove('open');
$('#resetBtn').onclick=()=>{ localStorage.clear(); workouts=[...seedWorkouts]; meals=[...seedMeals]; volHist=[...seedHistory]; protHist=[...seedProteinHist]; xpTotal=320; gems=45; streak={count:6,last:T}; daily={date:T,xp:30,goalDone:false}; questState={date:T,claimed:[]}; xphist=seedXpHist(); xphist[T]=30; saveGame(); render(); toast('Fresh dummy data! Streak protected 🛡️'); };

render();
