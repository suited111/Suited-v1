const SuitedAccount={
  mode:'device',
  user:null,
  cloud:null,
  async init(){
    const cfg=window.SUITED_CLOUD_CONFIG;
    if(cfg?.supabaseUrl&&cfg?.supabaseAnonKey&&window.supabase){
      try{
        this.cloud=window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseAnonKey);
        this.mode='cloud';
        const {data}=await this.cloud.auth.getSession();
        this.user=data?.session?.user||null;
        if(this.user) await this.pullCloudState();
        this.cloud.auth.onAuthStateChange(async(_event,session)=>{this.user=session?.user||null;if(this.user)await this.pullCloudState();updateAccountButton()});
      }catch(e){console.warn('Cloud account unavailable, using device mode',e)}
    }else{
      this.user=get('suitedDeviceAccount',null);
    }
    updateAccountButton();
  },
  async signUp(email,password,name){
    if(this.mode==='cloud'){
      const {data,error}=await this.cloud.auth.signUp({email,password,options:{data:{name}}});
      if(error)throw error;this.user=data.user;return 'Check your email to confirm your Suited account.';
    }
    const account={id:'device-'+Date.now(),email,name,createdAt:new Date().toISOString()};set('suitedDeviceAccount',account);this.user=account;updateAccountButton();return 'Beta account created on this device.';
  },
  async signIn(email,password){
    if(this.mode==='cloud'){
      const {data,error}=await this.cloud.auth.signInWithPassword({email,password});if(error)throw error;this.user=data.user;await this.pullCloudState();return;
    }
    const account=get('suitedDeviceAccount',null);if(!account||account.email.toLowerCase()!==email.toLowerCase())throw new Error('No beta account with that email on this device.');this.user=account;updateAccountButton();
  },
  async signOut(){if(this.mode==='cloud')await this.cloud.auth.signOut();this.user=null;if(this.mode==='device')localStorage.removeItem('suitedDeviceAccount');updateAccountButton();home()},
  async pushCloudState(){if(this.mode!=='cloud'||!this.user)return;const payload={user_id:this.user.id,profile:get('profile',{}),saved:get('saved',[]),updated_at:new Date().toISOString()};await this.cloud.from('customer_state').upsert(payload,{onConflict:'user_id'});},
  async pullCloudState(){if(this.mode!=='cloud'||!this.user)return;const {data,error}=await this.cloud.from('customer_state').select('profile,saved').eq('user_id',this.user.id).maybeSingle();if(!error&&data){if(data.profile)set('profile',data.profile);if(data.saved)set('saved',data.saved);updateBadge();}},
  async saveProfileAndSync(profileData){set('profile',profileData);await this.pushCloudState()},
  async saveLooksAndSync(savedIds){set('saved',savedIds);await this.pushCloudState()}
};

function updateAccountButton(){const b=document.getElementById('accountButton');if(!b)return;if(SuitedAccount.user){const label=SuitedAccount.user.user_metadata?.name||SuitedAccount.user.name||SuitedAccount.user.email?.split('@')[0]||'Account';b.textContent=label}else b.textContent='Account'}

function account(){const u=SuitedAccount.user;const cloud=SuitedAccount.mode==='cloud';if(u){const name=u.user_metadata?.name||u.name||'Suited shopper';const email=u.email||'';app.innerHTML=`<section class="account-layout"><div class="panel"><span class="eyebrow">MY SUITED ACCOUNT</span><h1>Welcome, ${escapeHtml(name)}.</h1><p class="subtext">${cloud?'Your account is connected to cloud sync. Your profile and saved looks can follow you across devices.':'This beta account currently lives on this device. The cloud-sync connection is built and ready to switch on.'}</p><div class="account-status ${cloud?'cloud':'device'}"><strong>${cloud?'Cloud sync on':'Device beta mode'}</strong><span>${cloud?'Profile + saved looks sync automatically.':'No password is stored in device mode.'}</span></div><div class="summary-list account-details"><div class="summary-item"><span>Email</span><strong>${escapeHtml(email||'Device beta')}</strong></div><div class="summary-item"><span>Saved looks</span><strong>${get('saved',[]).length}</strong></div><div class="summary-item"><span>Profile size</span><strong>${get('profile',{}).size||'Not set'}</strong></div></div><div class="actions"><button class="primary" onclick="profile()">Edit style profile</button><button class="secondary" onclick="saved()">My lookbook</button><button class="secondary" onclick="SuitedAccount.signOut()">Sign out</button></div></div><aside class="summary-card"><span class="eyebrow">ACCOUNT ROADMAP</span><h3>Built for your future avatar.</h3><p>Measurements, style history, saved outfits and eventually your AI avatar can all live against this account rather than one browser.</p></aside></section>`;return}
  app.innerHTML=`<section class="account-layout"><div class="panel"><span class="eyebrow">SUITED ACCOUNT</span><h1>Keep your style profile with you.</h1><p class="subtext">Create an account so Suited can remember your measurements, preferences and lookbook. Cloud sync is already wired into the app and needs one free backend connection to become cross-device.</p><div class="auth-tabs"><button class="primary" onclick="showSignUp()">Create account</button><button class="secondary" onclick="showSignIn()">Sign in</button></div><div id="authForm"></div></div><aside class="summary-card"><span class="eyebrow">WHY AN ACCOUNT?</span><h3>Shop once. Learn forever.</h3><p>Suited can build on your fit, favourite styles, saved outfits and shopping history instead of starting again every visit.</p></aside></section>`;showSignUp()}

function showSignUp(){const box=document.getElementById('authForm');if(!box)return;box.innerHTML=`<form id="signupForm" class="auth-form"><label>Name<input name="name" required autocomplete="name"></label><label>Email<input name="email" type="email" required autocomplete="email"></label>${SuitedAccount.mode==='cloud'?'<label>Password<input name="password" type="password" minlength="8" required autocomplete="new-password"></label>':''}<button class="primary large" type="submit">Create my Suited account</button><small>${SuitedAccount.mode==='cloud'?'Secure cloud account.':'Beta device account — cloud connection is the final activation step.'}</small></form>`;box.querySelector('form').onsubmit=async e=>{e.preventDefault();const f=Object.fromEntries(new FormData(e.target));try{const msg=await SuitedAccount.signUp(f.email,f.password||'',f.name);toast(msg);setTimeout(account,400)}catch(err){toast(err.message)}}}
function showSignIn(){const box=document.getElementById('authForm');if(!box)return;box.innerHTML=`<form id="signinForm" class="auth-form"><label>Email<input name="email" type="email" required autocomplete="email"></label>${SuitedAccount.mode==='cloud'?'<label>Password<input name="password" type="password" required autocomplete="current-password"></label>':''}<button class="primary large" type="submit">Sign in</button></form>`;box.querySelector('form').onsubmit=async e=>{e.preventDefault();const f=Object.fromEntries(new FormData(e.target));try{await SuitedAccount.signIn(f.email,f.password||'');toast('Signed in');setTimeout(account,300)}catch(err){toast(err.message)}}}

// Sync changes made by the existing V1 profile/lookbook functions without rewriting the whole app.
const originalSet=window.set;
window.addEventListener('storage',()=>updateAccountButton());
SuitedAccount.init();
