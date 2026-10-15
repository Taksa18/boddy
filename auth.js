// Bod auth: real accounts via Firebase (free) + guest/offline fallback.
// ---------------------------------------------------------------
// ONE-TIME SETUP (~5 min, owner only). Until you do this, the app
// works in guest mode and nothing breaks:
//  1. console.firebase.google.com → Add project "boddy" (skip Analytics)
//  2. Build → Authentication → Get started → turn ON Email/Password + Google
//  3. Authentication → Settings → Authorized domains → Add "taksa18.github.io"
//  4. Project Overview → </> Add web app → copy the firebaseConfig values
//  5. Paste them below, then: Build → Firestore Database → Create database
//  6. In Firestore → Rules tab, paste the rules from chat, Publish.
// ---------------------------------------------------------------
const BOD_FIREBASE_CONFIG = {
  apiKey: "AIzaSyB49MU_2Ej3w1E4C7S2dSW4jmMvS2p6KvY",
  authDomain: "boddy-1c930.firebaseapp.com",
  projectId: "boddy-1c930",
};
const HAS_CLOUD = BOD_FIREBASE_CONFIG.apiKey && !String(BOD_FIREBASE_CONFIG.apiKey).startsWith("PASTE");

window.__bodNS = "bod_"; // storage namespace — set BEFORE app.js loads
let _user = null, _db = null, _auth = null, _saveT = null, _appLoaded = false;

function loadAppOnce(after){
  if(_appLoaded) return; _appLoaded = true;
  const s = document.createElement("script");
  s.src = "app.js";
  if(after) s.onload = after;
  document.body.appendChild(s);
}

// ---- Firestore sync (whole profile in one doc: users/{uid}) ----
const DOC_FIELDS = ["workouts","meals","vol","prot","xp","gems","streak","daily","quests","xphist"];
function collectState(){
  try{
    if(typeof workouts === "undefined") return null;
    return { workouts, meals, vol: volHist, prot: protHist, xp: xpTotal,
             gems, streak, daily, quests: questState, xphist, updatedAt: Date.now() };
  }catch{ return null; }
}
function writeState(ns, doc){
  DOC_FIELDS.forEach(f=>{
    if(doc[f] !== undefined){
      try{ localStorage.setItem(ns + f, JSON.stringify(doc[f])); }catch{}
    }
  });
}
window.cloudSave = function(){
  if(!_user || !_db) return;
  clearTimeout(_saveT);
  _saveT = setTimeout(async ()=>{
    const st = collectState(); if(!st) return;
    try{ await _db.collection("users").doc(_user.uid).set(st, {merge:true}); }catch{}
  }, 1500);
};
async function syncFromCloud(){
  if(!_user || !_db) return;
  const ref = _db.collection("users").doc(_user.uid);
  const flag = "bod_cloud_" + _user.uid;
  try{
    if(sessionStorage.getItem("bod_wiped")){
      // fresh cleanup just ran locally — push the empty state up, don't restore old cloud dummy
      sessionStorage.removeItem("bod_wiped");
      const st = collectState();
      if(st) await ref.set(st);
      sessionStorage.setItem(flag, "1");
      return;
    }
    const snap = await ref.get();
    if(snap.exists && !sessionStorage.getItem(flag)){
      writeState(window.__bodNS, snap.data() || {});
      sessionStorage.setItem(flag, "1");
      location.reload(); // load cloud data into state — once per session
    } else if(!snap.exists){
      const st = collectState();
      if(st) await ref.set(st);
      sessionStorage.setItem(flag, "1");
    }
  }catch{}
}

// ---- auth flows ----
function showOverlay(v){ document.getElementById("authScreen").style.display = v ? "grid" : "none"; }
function paintChip(name, initial){
  const chip = document.getElementById("userChip");
  chip.hidden = false;
  document.getElementById("userName").textContent = name;
  document.getElementById("userAvatar").textContent = initial;
}
async function enterUser(user){
  _user = user;
  window.__bodNS = "bod_" + user.uid + "_";
  const name = user.displayName || (user.email ? user.email.split("@")[0] : "you");
  paintChip(name, name[0].toUpperCase());
  document.getElementById("logoutBtn").onclick = async ()=>{
    try{ await _auth.signOut(); }catch{}
    location.reload();
  };
  showOverlay(false);
  loadAppOnce(()=>syncFromCloud());
}
function enterGuest(){
  _user = null;
  window.__bodNS = "bod_";
  paintChip("guest", "G");
  document.getElementById("logoutBtn").onclick = ()=>location.reload();
  showOverlay(false);
  loadAppOnce();
}

const FRIENDLY = {
  "auth/user-not-found": "No account with that email — hit SIGN UP instead.",
  "auth/wrong-password": "Wrong password. Try again.",
  "auth/invalid-credential": "Wrong email or password. Try again.",
  "auth/email-already-in-use": "Account already exists — LOG IN instead.",
  "auth/weak-password": "Password must be 6+ characters.",
  "auth/invalid-email": "That email looks off. Check it.",
  "auth/popup-closed-by-user": "Google popup closed — try again.",
};
function authError(e){
  const box = document.getElementById("authErr");
  box.hidden = false;
  box.textContent = FRIENDLY[e.code] || ("Hmm: " + (e.message || "login failed"));
}
function wireForms(){
  let mode = "login";
  const go = document.getElementById("authGo");
  document.getElementById("tabLogin").onclick = ()=>{ mode="login"; syncTabs(); };
  document.getElementById("tabSignup").onclick = ()=>{ mode="signup"; syncTabs(); };
  function syncTabs(){
    document.getElementById("tabLogin").classList.toggle("active", mode==="login");
    document.getElementById("tabSignup").classList.toggle("active", mode==="signup");
    go.textContent = mode==="login" ? "LOG IN" : "CREATE ACCOUNT";
  }
  document.getElementById("authForm").onsubmit = async (e)=>{
    e.preventDefault();
    document.getElementById("authErr").hidden = true;
    go.disabled = true;
    const email = document.getElementById("authEmail").value.trim();
    const pass = document.getElementById("authPass").value;
    try{
      const cred = mode==="login"
        ? await _auth.signInWithEmailAndPassword(email, pass)
        : await _auth.createUserWithEmailAndPassword(email, pass);
      await enterUser(cred.user);
    }catch(err){ authError(err); go.disabled = false; }
  };
  document.getElementById("googleBtn").onclick = async ()=>{
    document.getElementById("authErr").hidden = true;
    try{
      const cred = await _auth.signInWithPopup(new firebase.auth.GoogleAuthProvider());
      await enterUser(cred.user);
    }catch(err){ authError(err); }
  };
  document.getElementById("guestBtn").onclick = ()=>enterGuest();
}

// ---- boot ----
(function boot(){
  if(!HAS_CLOUD || !window.firebase){
    document.getElementById("authScreen").classList.add("no-cloud");
    document.getElementById("cloudNote").hidden = false;
    wireGuestOnly();
    enterGuest();
    return;
  }
  firebase.initializeApp(BOD_FIREBASE_CONFIG);
  _auth = firebase.auth();
  try{ _db = firebase.firestore(); }catch{ _db = null; }
  wireForms();
  _auth.onAuthStateChanged((user)=>{ if(user) enterUser(user); });
  // logged-out users stay on the overlay until they act
})();
function wireGuestOnly(){
  document.getElementById("guestBtn").onclick = ()=>enterGuest();
}
