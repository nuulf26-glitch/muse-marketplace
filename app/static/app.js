const app=document.getElementById('app'), navlinks=document.getElementById('navlinks'), navright=document.getElementById('navright'), toast=document.getElementById('toast');
let STATE={me:null,meta:null,talents:[],favorites:[],campaigns:[],notifications:[]};
const money=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(Number(n||0));
const esc=s=>String(s??'').replace(/[&<>"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));
function showToast(t){toast.textContent=t;toast.classList.add('show');setTimeout(()=>toast.classList.remove('show'),1800)}
async function api(path,opts={}){const init={credentials:'same-origin',headers:{'Content-Type':'application/json'},...opts};if(opts.body&&typeof opts.body!=='string')init.body=JSON.stringify(opts.body);const r=await fetch(path,init);let j={};try{j=await r.json()}catch{}if(!r.ok)throw new Error(j.error||'Something went wrong');return j}
async function boot(){const [me,meta,t,c,n]=await Promise.all([api('/api/me'),api('/api/meta'),api('/api/talents'),api('/api/campaigns'),api('/api/notifications').catch(()=>({notifications:[]}))]);STATE.me=me.user;STATE.meta=meta;STATE.talents=t.talents;STATE.favorites=t.favorites||[];STATE.campaigns=c.campaigns;STATE.notifications=n.notifications||[];renderNav();route()}
function renderNav(){
  const u=STATE.me;
  const profileHref=u&&!u.onboardingComplete?'#/onboarding':'#/dashboard';
  navlinks.innerHTML=`<a href="#/discover">Discover</a><a href="#/campaigns">Campaigns</a>${u&&u.onboardingComplete?'<a href="#/for-you">For You</a><a href="#/deals">Deals</a><a href="#/messages">Messages</a>':''}${u?.role==='admin'?'<a href="#/admin">Admin</a>':''}`;
  navright.innerHTML=u?`${u.role==='brand'&&u.onboardingComplete?'<a class="primary" href="#/campaigns/new">+ Create Campaign</a>':''}<div class="navnotice"><button class="iconbtn" id="noticeBtn" aria-label="Notifications">${STATE.notifications.filter(n=>!n.read).length?`<span class="pillcount">${STATE.notifications.filter(n=>!n.read).length}</span>`:'♡'}</button><div id="noticePanel" class="navnotice-panel hidden">${STATE.notifications.length?STATE.notifications.slice(0,6).map(n=>`<div class="service"><span>${esc(n.text)}</span></div>`).join(''):'<p class="muted">No notifications yet.</p>'}</div></div><a class="iconbtn" href="${profileHref}" aria-label="Account">${esc(u.name?.[0]||'U')}</a><button class="ghost small" id="logoutBtn">Log out</button>`:`<a class="navsignin" href="#/auth?mode=login">Sign in</a><a class="primary" href="#/auth?mode=signup">Join MUSE</a>`;
  document.getElementById('logoutBtn')?.addEventListener('click',async()=>{await api('/api/logout',{method:'POST'});STATE.me=null;STATE.notifications=[];renderNav();location.hash='#/'});
  document.getElementById('noticeBtn')?.addEventListener('click',()=>document.getElementById('noticePanel').classList.toggle('hidden'));
}
function profileBg(t,i=0){return t.profilePhoto?`style="background-image:url('${esc(t.profilePhoto)}')" class="photo profile-photo-img"`:`class="photo p${(i%6)+1}"`}
function talentCard(t,i=0){const saved=STATE.favorites.includes(t.id),followers=(t.platforms||[]).reduce((a,b)=>a+Number(b.followers||0),0);return `<article class="talent-card"><a href="#/talent/${t.id}" ${profileBg(t,i)}></a>${STATE.me?.role==='brand'?`<button class="heart ${saved?'saved':''}" data-fav="${t.id}">${saved?'♥':'♡'}</button>`:''}<div class="talentbody"><div class="name">${esc(t.name)} ${t.verified?'<span class="verified">✓</span>':''}</div><div class="mini">${esc((t.talentTypes||[]).join(' · '))}</div><div class="mini">${esc([t.city,t.country].filter(Boolean).join(', '))}</div><div class="tags">${(t.categories||[]).slice(0,3).map(x=>`<span class="tag">${esc(x)}</span>`).join('')}</div><div class="rate"><span><b>${followers>=1e6?(followers/1e6).toFixed(1)+'M':Math.round(followers/1000)+'K'}</b> reach</span><b>From ${money(t.startingRate)}</b></div></div></article>`}
function bindFavorites(){document.querySelectorAll('[data-fav]').forEach(b=>b.onclick=async e=>{e.preventDefault();e.stopPropagation();try{const r=await api('/api/favorites/'+b.dataset.fav,{method:'POST'});STATE.favorites=r.saved?[...new Set([...STATE.favorites,b.dataset.fav])]:STATE.favorites.filter(x=>x!==b.dataset.fav);route();showToast(r.saved?'Saved':'Removed')}catch(err){showToast(err.message)}})}
function cityOptions(country,selected=''){return `<option value="">Any city</option>${(STATE.meta?.cities?.[country]||[]).map(c=>`<option ${c===selected?'selected':''}>${esc(c)}</option>`).join('')}<option ${selected==='Other'?'selected':''}>Other</option>`}
function countryOptions(selected=''){return `<option value="">Any country</option>${(STATE.meta?.countries||[]).map(c=>`<option ${c===selected?'selected':''}>${esc(c)}</option>`).join('')}`}
function nationalityOptions(selected='',emptyLabel='Any nationality'){
  const countries=[...(STATE.meta?.countries||[])];
  // Preserve any nationality saved before this selector was introduced, while
  // keeping the standard global country list and Other in their expected order.
  if(selected&&selected!=='Other'&&!countries.includes(selected))countries.push(selected);
  return `<option value="">${esc(emptyLabel)}</option>${countries.map(c=>`<option value="${esc(c)}" ${c===selected?'selected':''}>${esc(c)}</option>`).join('')}<option value="Other" ${selected==='Other'?'selected':''}>Other</option>`;
}
function shell(content){app.innerHTML=content+`<footer class="footer"><div class="wrap">MUSE V1 · Premium talent marketplace · Payments, commission, subscription and AI matching are reserved for Phase 2.</div></footer>`;bindFavorites()}
function home(){shell(`<section class="wrap hero"><div><div class="eyebrow">THE TALENT MARKETPLACE FOR MODERN BRANDS</div><h1>Find the face for your next campaign.</h1><p>Discover creators and models, send direct offers, launch campaigns and manage every collaboration in one premium workspace.</p><form class="searchbox" id="heroSearch"><select name="country">${countryOptions('United Arab Emirates')}</select><select name="city">${cityOptions('United Arab Emirates','Dubai')}</select><button class="primary">Search Talent</button></form></div><div class="heroart"><div class="floatcard"><span class="eyebrow">FEATURED</span><b>Maya Al Noor ✓</b><span>Dubai · Fashion · Beauty</span></div></div></section><section class="statbar"><div><b>${STATE.talents.length}+</b><span>Curated talent</span></div><div><b>${STATE.campaigns.length}</b><span>Open campaigns</span></div><div><b>193</b><span>Countries supported</span></div><div><b>USD</b><span>V1 currency</span></div></section><section class="wrap section"><div class="sectionhead"><div><div class="eyebrow">DISCOVER</div><h2>Talent worth noticing.</h2></div><a href="#/discover">View all →</a></div><div class="cards">${STATE.talents.slice(0,4).map(talentCard).join('')}</div></section><section class="soft"><div class="wrap section"><div class="eyebrow">EXPLORE BY CATEGORY</div><div class="categories">${['Fashion','Beauty','Lifestyle','Fitness','UGC','Food'].map(c=>`<a class="category" href="#/discover?category=${encodeURIComponent(c)}"><span>✦</span><strong>${c}</strong></a>`).join('')}</div></div></section><section class="wrap section"><div class="eyebrow">HOW IT WORKS</div><h2>From discovery to done.</h2><div class="steps"><div class="box"><b>01</b><h3>Discover</h3><p>Search by talent type, location, category, platform and availability.</p></div><div class="box"><b>02</b><h3>Connect</h3><p>Send a direct offer or invite talent into a campaign.</p></div><div class="box"><b>03</b><h3>Deal</h3><p>Agree on price, deliverables and deadline in one deal room.</p></div><div class="box"><b>04</b><h3>Complete</h3><p>Track the collaboration from accepted to completed.</p></div></div></section>`);const hs=document.getElementById('heroSearch');const country=hs.country,city=hs.city;country.onchange=()=>city.innerHTML=cityOptions(country.value);hs.onsubmit=e=>{e.preventDefault();location.hash=`#/discover?country=${encodeURIComponent(country.value)}&city=${encodeURIComponent(city.value)}`}}
function discover(qs=''){
  const p=new URLSearchParams(qs);
  let filters={q:p.get('q')||'',type:p.get('type')||'',country:p.get('country')||'',city:p.get('city')||'',nationality:p.get('nationality')||'',category:p.get('category')||'',platform:p.get('platform')||'',followers:p.get('followers')||'',price:p.get('price')||'',language:p.get('language')||'',availability:p.get('availability')||''};
  const uniq=fn=>[...new Set(STATE.talents.flatMap(fn).filter(Boolean))].sort();
  const nationalities=uniq(t=>[t.nationality]), languages=uniq(t=>t.languages||[]), platforms=uniq(t=>(t.platforms||[]).map(x=>x.name));
  const reach=t=>{const list=t.platforms||[];const chosen=filters.platform?list.filter(x=>x.name===filters.platform):list;return chosen.reduce((a,b)=>a+Number(b.followers||0),0)};
  const filtered=()=>STATE.talents.filter(t=>(!filters.q||`${t.name} ${t.bio} ${(t.categories||[]).join(' ')} ${(t.languages||[]).join(' ')}`.toLowerCase().includes(filters.q.toLowerCase()))&&(!filters.type||(t.talentTypes||[]).includes(filters.type))&&(!filters.country||t.country===filters.country)&&(!filters.city||t.city===filters.city)&&(!filters.nationality||t.nationality===filters.nationality)&&(!filters.category||(t.categories||[]).includes(filters.category))&&(!filters.platform||(t.platforms||[]).some(x=>x.name===filters.platform))&&(!filters.followers||reach(t)>=Number(filters.followers))&&(!filters.price||Number(t.startingRate||0)<=Number(filters.price))&&(!filters.language||(t.languages||[]).includes(filters.language))&&(!filters.availability||t.availability===filters.availability));
  function paint(){
    shell(`<div class="wrap discover-page"><div class="discover-title"><div><span class="eyebrow">DISCOVER</span><h1>Find your next face.</h1><p class="muted">Search creators and models across markets, categories and platforms.</p></div><div class="discover-count"><b>${filtered().length}</b><span>profiles</span></div></div><div class="discover-searchbar"><span>⌕</span><input id="fQ" placeholder="Search talent, category or keyword" value="${esc(filters.q)}"></div><div class="discoverlayout"><aside class="filters"><div class="filter-head"><h3>Filters</h3><button class="textbtn" id="clearFilters">Reset</button></div><label>Talent type</label><select id="fType"><option value="">All talent</option><option ${filters.type==='Influencer'?'selected':''}>Influencer</option><option ${filters.type==='Model'?'selected':''}>Model</option></select><label>Country</label><select id="fCountry">${countryOptions(filters.country)}</select><label>City</label><select id="fCity">${cityOptions(filters.country,filters.city)}</select><label>Nationality</label><select id="fNationality"><option value="">Any nationality</option>${nationalities.map(x=>`<option ${filters.nationality===x?'selected':''}>${esc(x)}</option>`).join('')}</select><label>Category</label><select id="fCategory"><option value="">All categories</option>${['Fashion','Beauty','Lifestyle','Fitness','UGC','Food','Travel','Tech'].map(c=>`<option ${filters.category===c?'selected':''}>${c}</option>`).join('')}</select><label>Platform</label><select id="fPlatform"><option value="">Any platform</option>${platforms.map(x=>`<option ${filters.platform===x?'selected':''}>${esc(x)}</option>`).join('')}</select><label>Minimum followers</label><select id="fFollowers"><option value="">Any audience</option>${[[10000,'10K+'],[50000,'50K+'],[100000,'100K+'],[250000,'250K+'],[500000,'500K+'],[1000000,'1M+']].map(([v,l])=>`<option value="${v}" ${String(v)===filters.followers?'selected':''}>${l}</option>`).join('')}</select><label>Maximum starting rate</label><select id="fPrice"><option value="">Any price</option>${[250,500,750,1000,1500,2500].map(v=>`<option value="${v}" ${String(v)===filters.price?'selected':''}>Up to ${money(v)}</option>`).join('')}</select><label>Language</label><select id="fLanguage"><option value="">Any language</option>${languages.map(x=>`<option ${filters.language===x?'selected':''}>${esc(x)}</option>`).join('')}</select><label>Availability</label><select id="fAvailability"><option value="">Any availability</option><option ${filters.availability==='Available now'?'selected':''}>Available now</option><option ${filters.availability==='This month'?'selected':''}>This month</option></select></aside><section><div class="active-filters" id="activeFilters"></div><div class="cards discovercards">${filtered().map(talentCard).join('')||'<div class="empty">No talent matches these filters.</div>'}</div></section></div></div>`);
    const read=()=>{filters={q:fQ.value,type:fType.value,country:fCountry.value,city:fCity.value,nationality:fNationality.value,category:fCategory.value,platform:fPlatform.value,followers:fFollowers.value,price:fPrice.value,language:fLanguage.value,availability:fAvailability.value}};
    const refresh=()=>{document.querySelector('.discover-count b').textContent=filtered().length;document.querySelector('.discovercards').innerHTML=filtered().map(talentCard).join('')||'<div class="empty">No talent matches these filters.</div>';const labels=[filters.type,filters.country,filters.city,filters.nationality,filters.category,filters.platform,filters.followers?`${Number(filters.followers).toLocaleString()}+ followers`:'',filters.price?`≤ ${money(filters.price)}`:'',filters.language,filters.availability].filter(Boolean);activeFilters.innerHTML=labels.map(x=>`<span>${esc(x)}</span>`).join('');bindFavorites()};
    ['fQ','fType','fCountry','fCity','fNationality','fCategory','fPlatform','fFollowers','fPrice','fLanguage','fAvailability'].forEach(id=>document.getElementById(id).oninput=()=>{read();if(id==='fCountry'){filters.city='';fCity.innerHTML=cityOptions(filters.country)}refresh()});
    clearFilters.onclick=()=>{filters={q:'',type:'',country:'',city:'',nationality:'',category:'',platform:'',followers:'',price:'',language:'',availability:''};paint()};refresh();
  }
  paint();
}
async function talentProfile(id){
  const {talent:t}=await api('/api/talents/'+id);if(!t)return notFound();const saved=STATE.favorites.includes(t.id);
  const portfolio=(t.portfolio||[]).length?(t.portfolio||[]).map(x=>`<div class="shot profile-shot" style="background-image:url('${esc(x)}')"></div>`).join(''):`<div class="shot"></div><div class="shot"></div><div class="shot"></div>`;
  shell(`<section class="wrap profilehero"><div class="cover ${t.coverImage?'cover-img':''}" ${t.coverImage?`style="background-image:url('${esc(t.coverImage)}')"`:''}></div><div class="profilecard"><div class="avatar ${t.profilePhoto?'profile-photo-img':''}" ${t.profilePhoto?`style="background-image:url('${esc(t.profilePhoto)}')"`:''}></div><div><h1>${esc(t.name)} ${t.verified?'<span class="verified">✓</span>':''}</h1><p class="muted">${esc((t.talentTypes||[]).join(' · '))} · ${esc([t.city,t.country].filter(Boolean).join(', '))}</p></div><div class="actions">${STATE.me?.role==='brand'?`<button class="ghost" data-fav="${t.id}">${saved?'♥ Saved':'♡ Save'}</button><button class="ghost" id="inviteBtn">Invite to Campaign</button><button class="primary" id="offerBtn">Send Offer</button>`:''}</div></div><div class="profilegrid"><section><div class="box"><div class="eyebrow">ABOUT</div><p>${esc(t.bio||'')}</p><div class="detailrow">${[t.nationality,(t.languages||[]).join(' · '),t.availability].filter(Boolean).map(x=>`<span class="detailchip">${esc(x)}</span>`).join('')}</div></div><div class="box"><div class="sectionhead compact"><div class="eyebrow">PORTFOLIO</div><span class="mini">${(t.portfolio||[]).length||0} works</span></div><div class="portfolio">${portfolio}</div></div></section><aside><div class="box"><div class="eyebrow">STARTING RATE</div><div class="budget">${money(t.startingRate||0)}</div></div><div class="box"><div class="eyebrow">SERVICES</div>${(t.services||[]).map(s=>`<div class="service"><span>${esc(s.name)}</span><b>${money(s.price)}</b></div>`).join('')||'<p class="muted">No services added yet.</p>'}</div><div class="box"><div class="eyebrow">SOCIAL AUDIENCE</div>${(t.platforms||[]).map(p=>`<div class="service"><div><span>${esc(p.name)}</span>${p.handle?`<small>${esc(p.handle)}</small>`:''}</div><b>${Number(p.followers||0).toLocaleString()}</b></div>`).join('')||'<p class="muted">No social platforms added yet.</p>'}</div>${t.modelCategory?`<div class="box"><div class="eyebrow">MODEL DETAILS</div><p>${esc(t.modelCategory)}</p><p class="muted">${esc(t.measurements||'')}</p><p class="muted">Agency: ${esc(t.agency||'Not specified')}</p></div>`:''}</aside></div></section><div id="modalHost"></div>`);
  bindFavorites();
  document.getElementById('offerBtn')?.addEventListener('click',()=>{modalHost.innerHTML=`<div class="modalback"><form class="modal" id="offerForm"><span class="eyebrow">DIRECT OFFER</span><h2>Send an offer to ${esc(t.name)}</h2><input name="title" required placeholder="Offer title"><textarea name="details" required placeholder="Job details"></textarea><input name="deliverables" required placeholder="Deliverables"><div class="twocol"><input name="date" type="date" required><input name="price" type="number" min="1" required placeholder="Offered price USD"></div><button class="primary full">Send Offer</button><button type="button" class="ghost full" id="closeModal">Cancel</button></form></div>`;closeModal.onclick=()=>modalHost.innerHTML='';offerForm.onsubmit=async e=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.target));d.talentId=t.id;try{await api('/api/offers',{method:'POST',body:d});modalHost.innerHTML='';showToast('Offer sent')}catch(err){showToast(err.message)}}});
  document.getElementById('inviteBtn')?.addEventListener('click',()=>{const own=STATE.campaigns.filter(c=>c.brand_id===STATE.me.id&&c.status==='Open');modalHost.innerHTML=`<div class="modalback"><form class="modal" id="inviteForm"><span class="eyebrow">CAMPAIGN INVITE</span><h2>Invite ${esc(t.name)}</h2>${own.length?`<label>Choose campaign<select name="campaignId">${own.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></label><button class="primary full">Send invitation</button>`:`<div class="empty">Create a campaign before inviting talent.</div><a class="primary full center" href="#/campaigns/new">Create Campaign</a>`}<button type="button" class="ghost full" id="closeModal">Cancel</button></form></div>`;closeModal.onclick=()=>modalHost.innerHTML='';document.getElementById('inviteForm').onsubmit=async e=>{e.preventDefault();const cid=new FormData(e.target).get('campaignId');if(!cid)return;try{await api(`/api/campaigns/${cid}/invite`,{method:'POST',body:{talentId:t.id}});modalHost.innerHTML='';showToast('Campaign invitation sent')}catch(err){showToast(err.message)}}});
}
function campaignCard(c){return `<a class="campaignitem" href="#/campaign/${c.id}"><div class="brandlogo">${esc(c.brand_name?.[0]||'B')}</div><div class="grow"><div class="split"><b>${esc(c.name)}</b><b>${money(c.budget_min)}–${money(c.budget_max)}</b></div><div class="mini"><span class="brand-inline">${esc(c.brand_name||'Brand')} ${c.brand_verified?'✓':''}</span> · ${esc([c.city,c.country].filter(Boolean).join(', '))}${c.invited?' · <strong>Invited</strong>':''}</div><div class="tags"><span class="tag">${esc(c.category)}</span><span class="tag">${esc(c.talent_type)}</span><span class="tag">${esc(c.platform)}</span>${c.visibility==='Invite Only'?'<span class="tag">Invite Only</span>':''}</div></div></a>`}
function campaigns(){shell(`<section class="wrap section"><div class="sectionhead"><div><div class="eyebrow">OPPORTUNITIES</div><h2>Open campaigns.</h2></div>${STATE.me?.role==='brand'?'<a class="primary" href="#/campaigns/new">Create Campaign</a>':''}</div><div class="campaignlist">${STATE.campaigns.map(campaignCard).join('')||'<div class="empty">No campaigns yet.</div>'}</div></section>`)}

async function brandProfile(id){
  const r=await api('/api/brands/'+id),b=r.brand;if(!b)return notFound();
  shell(`<section class="wrap brand-profile"><div class="brand-cover ${b.coverImage?'cover-img':''}" ${b.coverImage?`style="background-image:url('${esc(b.coverImage)}')"`:''}></div><div class="brand-profile-head"><div class="brand-logo ${b.profilePhoto?'profile-photo-img':''}" ${b.profilePhoto?`style="background-image:url('${esc(b.profilePhoto)}')"`:''}>${b.profilePhoto?'':esc((b.name||'B')[0])}</div><div><span class="eyebrow">${esc(b.industry||'BRAND')}</span><h1>${esc(b.name)} ${b.verified?'<span class="verified">✓</span>':''}</h1><p class="muted">${esc([b.city,b.country].filter(Boolean).join(', '))}</p></div>${b.website?`<a class="ghost brand-site" href="${esc(b.website)}" target="_blank" rel="noopener">Visit website ↗</a>`:''}</div><div class="brand-grid"><section class="box"><div class="eyebrow">ABOUT</div><p class="lead small-lead">${esc(b.bio||'This brand has not added an introduction yet.')}</p></section><aside class="box"><div class="eyebrow">ACTIVE CAMPAIGNS</div><div class="big-number">${r.campaigns.length}</div><p class="muted">Public opportunities from this brand</p></aside></div><section class="section brand-campaigns"><div class="sectionhead"><div><span class="eyebrow">OPPORTUNITIES</span><h2>Campaigns by ${esc(b.name)}</h2></div></div><div class="campaignlist">${r.campaigns.map(campaignCard).join('')||'<div class="empty">No public campaigns right now.</div>'}</div></section></section>`);
}

async function campaignDetail(id){const {campaign:c}=await api('/api/campaigns/'+id);if(!c)return notFound();shell(`<section class="wrap campaignlayout"><section><div class="eyebrow">CAMPAIGN</div><h1 class="campaigntitle">${esc(c.name)}</h1><p class="lead">${esc(c.description)}</p><div class="box"><h3>Campaign details</h3><div class="detailrow"><span class="detailchip">${esc(c.talent_type)}</span><span class="detailchip">${esc(c.category)}</span><span class="detailchip">${esc([c.city,c.country].filter(Boolean).join(', '))}</span><span class="detailchip">${esc(c.platform)}</span></div><p><b>Deliverables:</b> ${esc(c.deliverables)}</p><p><b>Deadline:</b> ${esc(c.deadline)}</p><p><b>Talent needed:</b> ${esc(c.slots)}</p></div></section><aside class="sidebarcta box"><div class="eyebrow">BUDGET</div><div class="budget">${money(c.budget_min)}–${money(c.budget_max)}</div><p class="muted">Posted by <a href="#/brand/${c.brand_id}">${esc(c.brand_name)} ${c.brand_verified?'✓':''}</a></p>${STATE.me?.role==='talent'?'<button class="primary full" id="applyBtn">Apply to campaign</button>':STATE.me?'<p class="notice">Switch to a Talent account to apply.</p>':'<a class="primary full center" href="#/auth">Join as Talent to apply</a>'}</aside></section><div id="modalHost"></div>`);document.getElementById('applyBtn')?.addEventListener('click',()=>{modalHost.innerHTML=`<div class="modalback"><form class="modal" id="applyForm"><h2>Apply to ${esc(c.name)}</h2><textarea name="proposal" required placeholder="Your proposal"></textarea><input name="price" required type="number" min="1" placeholder="Your price in USD"><button class="primary full">Send application</button><button type="button" class="ghost full" id="closeModal">Cancel</button></form></div>`;closeModal.onclick=()=>modalHost.innerHTML='';applyForm.onsubmit=async e=>{e.preventDefault();try{await api(`/api/campaigns/${c.id}/apply`,{method:'POST',body:Object.fromEntries(new FormData(e.target))});modalHost.innerHTML='';showToast('Application sent')}catch(err){showToast(err.message)}}})}
function newCampaign(){if(STATE.me?.role!=='brand'){location.hash='#/auth';return}shell(`<section class="wrap narrow section"><div class="eyebrow">BRAND WORKSPACE</div><h2>Create Campaign</h2><form class="formcard" id="campaignForm"><input name="name" required placeholder="Campaign name"><textarea name="description" required placeholder="Description"></textarea><div class="twocol"><select name="talentType"><option>Influencer / Model</option><option>Influencer</option><option>Model</option></select><select name="category">${['Fashion','Beauty','Lifestyle','Fitness','UGC','Food','Travel','Tech'].map(c=>`<option>${c}</option>`).join('')}</select></div><div class="twocol"><select name="country" id="campCountry">${countryOptions('United Arab Emirates')}</select><select name="city" id="campCity">${cityOptions('United Arab Emirates')}</select></div><div class="twocol"><input name="platform" placeholder="Platform"><input name="deliverables" placeholder="Deliverables"></div><div class="threecol"><input name="budgetMin" type="number" placeholder="Min budget"><input name="budgetMax" type="number" placeholder="Max budget"><input name="slots" type="number" value="1" min="1" placeholder="Talent count"></div><div class="twocol"><input name="deadline" type="date"><select name="visibility"><option>Public</option><option>Invite Only</option></select></div><button class="primary">Publish Campaign</button></form></section>`);campCountry.onchange=()=>campCity.innerHTML=cityOptions(campCountry.value);campaignForm.onsubmit=async e=>{e.preventDefault();try{await api('/api/campaigns',{method:'POST',body:Object.fromEntries(new FormData(e.target))});const c=await api('/api/campaigns');STATE.campaigns=c.campaigns;showToast('Campaign published');location.hash='#/campaigns'}catch(err){showToast(err.message)}}}
async function dashboard(){if(!STATE.me){location.hash='#/auth';return}const d=await api('/api/dashboard');const u=STATE.me;if(u.role==='admin'){location.hash='#/admin';return}const offers=d.offers||[],deals=d.deals||[],apps=d.applications||[];shell(`<section class="wrap section"><div class="dashhead"><div><div class="eyebrow">WORKSPACE</div><h2>${esc(u.name)}</h2><p class="muted">Signed in as ${esc(u.role)}</p></div><div class="demo-switch"><button data-demo="brand">Brand demo</button><button data-demo="talent">Talent demo</button><a href="#/settings">Settings</a></div></div><div class="metricgrid"><div class="metric"><span>Offers</span><b>${offers.length}</b></div><div class="metric"><span>Active deals</span><b>${deals.filter(x=>x.status!=='Completed').length}</b></div><div class="metric"><span>Completed</span><b>${deals.filter(x=>x.status==='Completed').length}</b></div><div class="metric"><span>${u.role==='brand'?'Saved talent':'Applications'}</span><b>${u.role==='brand'?(d.favorites||[]).length:apps.length}</b></div></div><div class="dashgrid"><section class="box"><h3>Recent offers</h3>${offers.length?offers.map(o=>`<div class="service"><div><b>${esc(o.title)}</b><small>${money(o.price)} · ${esc(o.status)}</small></div>${u.role==='talent'&&o.status==='Pending'?`<div class="inline"><button class="ghost small" data-offer="${o.id}" data-status="Declined">Decline</button><button class="primary small" data-offer="${o.id}" data-status="Accepted">Accept</button></div>`:''}</div>`).join(''):'<p class="muted">No offers yet.</p>'}</section><section class="box"><h3>Quick access</h3><p><a href="#/discover">Discover talent</a></p><p><a href="#/campaigns">Campaign marketplace</a></p><p><a href="#/deals">Deal rooms</a></p><p><a href="#/settings">Profile settings</a></p></section></div>${u.role==='brand'?`<div class="sectionhead topgap"><div><h2>Saved talent</h2></div></div><div class="cards">${(d.favorites||[]).map(talentCard).join('')||'<div class="empty">Save talent from Discover.</div>'}</div><div class="sectionhead topgap"><div><h2>Shortlists</h2></div><button class="ghost" id="newList">+ New list</button></div><div class="campaignlist">${(d.shortlists||[]).map(l=>`<div class="dealrow"><div><b>${esc(l.name)}</b><div class="mini">${l.talentIds.length} talent</div></div></div>`).join('')||'<div class="empty">No shortlists yet.</div>'}</div>`:`<div class="sectionhead topgap"><div><h2>Applications</h2></div></div><div class="campaignlist">${apps.map(a=>`<div class="dealrow"><div><b>${esc(a.campaign_name)}</b><div class="mini">${money(a.price)} · ${esc(a.status)}</div></div></div>`).join('')||'<div class="empty">No applications yet.</div>'}</div><div class="sectionhead topgap"><div><h2>Campaign invitations</h2></div></div><div class="campaignlist">${(d.invitations||[]).map(i=>`<a class="dealrow" href="#/campaign/${i.campaign_id}"><div><b>${esc(i.campaign_name)}</b><div class="mini">Invited by ${esc(i.brand_name)} · ${esc(i.status)}</div></div><span>View →</span></a>`).join('')||'<div class="empty">No invitations yet.</div>'}</div>`}</section>`);document.querySelectorAll('[data-offer]').forEach(b=>b.onclick=async()=>{try{await api(`/api/offers/${b.dataset.offer}/respond`,{method:'POST',body:{status:b.dataset.status}});showToast('Offer updated');dashboard()}catch(err){showToast(err.message)}});document.getElementById('newList')?.addEventListener('click',async()=>{const name=prompt('Shortlist name');if(name){try{await api('/api/shortlists',{method:'POST',body:{name}});dashboard()}catch(err){showToast(err.message)}}})}
async function deals(){if(!STATE.me){location.hash='#/auth';return}const {deals}=await api('/api/deals');shell(`<section class="wrap section"><div class="eyebrow">DEALS</div><h2>Your deal rooms.</h2><div class="campaignlist">${deals.map(d=>`<a class="dealrow" href="#/deal/${d.id}"><div><b>${esc(d.title)}</b><div class="mini">${esc(d.deliverables)} · Due ${esc(d.deadline)}</div></div><div><span class="status">${esc(d.status)}</span> <b>${money(d.agreed_price)}</b></div></a>`).join('')||'<div class="empty">No deals yet.</div>'}</div></section>`)}
async function dealRoom(id){if(!STATE.me){location.hash='#/auth';return}const {deal:d,messages}=await api('/api/deals/'+id);shell(`<section class="wrap section"><div class="dealroomhead"><div><div class="eyebrow">DEAL ROOM</div><h2>${esc(d.title)}</h2></div><select id="dealStatus">${['Accepted','In Progress','Submitted','Approved','Completed'].map(s=>`<option ${s===d.status?'selected':''}>${s}</option>`).join('')}</select></div><div class="dealgrid"><section class="box chat"><div class="messages" id="messages">${messages.map(m=>`<div class="msg ${m.from_user===STATE.me.id?'me':''}">${esc(m.text)}${m.file_url?`<a class="file-link" href="${esc(m.file_url)}" target="_blank">📎 ${esc(m.file_name||'Attachment')}</a>`:''}</div>`).join('')}</div><form class="messageform" id="messageForm"><input name="text" placeholder="Write a message..."><button class="primary">Send</button></form><div class="uploadbox topgap"><label class="mini">Attach a file</label><input type="file" id="dealFile"></div></section><aside class="box"><div class="eyebrow">AGREEMENT</div><div class="budget">${money(d.agreed_price)}</div><p><b>Deliverables</b><br>${esc(d.deliverables)}</p><p><b>Deadline</b><br>${esc(d.deadline)}</p><p><b>Status</b><br>${esc(d.status)}</p><hr><p class="muted">Payment is intentionally excluded from V1. The deal structure is ready for payment status, platform fee and talent payout later.</p></aside></div></section>`);dealStatus.onchange=async()=>{try{await api(`/api/deals/${id}/status`,{method:'POST',body:{status:dealStatus.value}});showToast('Status updated')}catch(err){showToast(err.message)}};let filePayload=null;dealFile.onchange=async()=>{const file=dealFile.files[0];if(!file)return;try{filePayload=await uploadFile(file);showToast('File ready to send')}catch(err){showToast(err.message);dealFile.value=''}};messageForm.onsubmit=async e=>{e.preventDefault();const text=e.target.text.value.trim();if(!text&&!filePayload)return;try{await api(`/api/deals/${id}/messages`,{method:'POST',body:{text,fileName:filePayload?.name,fileUrl:filePayload?.url}});filePayload=null;e.target.reset();dealFile.value='';dealRoom(id)}catch(err){showToast(err.message)}}}
async function messages(){if(!STATE.me){location.hash='#/auth';return}const {deals}=await api('/api/deals');shell(`<section class="wrap section"><div class="eyebrow">MESSAGES</div><h2>Conversations.</h2><div class="campaignlist">${deals.map(d=>`<a class="dealrow" href="#/deal/${d.id}"><div><b>${esc(d.title)}</b><div class="mini">${esc(d.other_name||'Conversation')}</div></div><span>Open →</span></a>`).join('')||'<div class="empty">No conversations yet.</div>'}</div></section>`)}
async function uploadFile(file){const data=await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(file)});return api('/api/upload',{method:'POST',body:{filename:file.name,data}})}

async function onboarding(){
  if(!STATE.me){location.hash='#/auth?mode=signup';return}
  if(STATE.me.role==='admin'){location.hash='#/admin';return}
  const u=STATE.me, talent=u.role==='talent';
  let step=1, photo=u.profilePhoto||'', cover=u.coverImage||'', portfolio=[...(u.portfolio||[])];
  const draft={name:u.name||'',bio:u.bio||'',country:u.country||'',city:u.city||'',nationality:u.nationality||'',talentTypes:[...(u.talentTypes||[])],categories:[...(u.categories||[])],languages:[...(u.languages||[])],availability:u.availability||'Available now',startingRate:u.startingRate||'',modelCategory:u.modelCategory||'',measurements:u.measurements||'',agency:u.agency||'',industry:u.industry||'',website:u.website||'',instagram:'',instagramFollowers:'',tiktok:'',tiktokFollowers:'',youtube:'',youtubeFollowers:'',service1:'',service1Price:'',service2:'',service2Price:''};
  (u.platforms||[]).forEach(p=>{const k=String(p.name||'').toLowerCase();if(k==='instagram'){draft.instagram=p.handle||'';draft.instagramFollowers=p.followers||''}if(k==='tiktok'){draft.tiktok=p.handle||'';draft.tiktokFollowers=p.followers||''}if(k==='youtube'){draft.youtube=p.handle||'';draft.youtubeFollowers=p.followers||''}});
  (u.services||[]).slice(0,2).forEach((x,i)=>{draft['service'+(i+1)]=x.name||'';draft['service'+(i+1)+'Price']=x.price||''});
  function syncCurrent(){const form=document.getElementById('onboardForm');if(!form)return;const fd=new FormData(form);for(const [k,v] of fd.entries())draft[k]=v;if(talent){draft.talentTypes=fd.getAll('talentType');draft.categories=fd.getAll('category')}}
  function progress(){return `<div class="onboard-progress"><span class="${step>=1?'active':''}"></span><span class="${step>=2?'active':''}"></span><span class="${step>=3?'active':''}"></span></div><div class="onboard-step-label">Step ${step} of 3</div>`}
  function frame(body){shell(`<section class="onboard-page"><aside class="onboard-aside"><a class="onboard-logo" href="#/">MUSE</a><div><span class="eyebrow">CREATE YOUR PROFILE</span><h1>${talent?'Make brands remember you.':'Build a brand profile talent can trust.'}</h1><p>${talent?'Your profile is your storefront. Add enough detail for brands to understand your work at a glance.':'Give talent the context they need before they accept an offer or apply to your campaign.'}</p></div><div class="onboard-aside-foot">You can edit everything later in Settings.</div></aside><main class="onboard-main"><div class="onboard-top">${progress()}<button class="textbtn" id="saveLater">Save & exit</button></div>${body}</main></section>`);document.getElementById('saveLater').onclick=async()=>{syncCurrent();await save(false);location.hash='#/dashboard'}}
  async function save(complete){
    const payload={name:draft.name,bio:draft.bio,country:draft.country,city:draft.city,profilePhoto:photo,coverImage:cover,onboardingComplete:complete};
    if(talent){Object.assign(payload,{talentTypes:draft.talentTypes,categories:draft.categories,nationality:draft.nationality,languages:String(draft.languages||'').split(',').map(x=>x.trim()).filter(Boolean),availability:draft.availability,startingRate:Number(draft.startingRate||0),modelCategory:draft.modelCategory,measurements:draft.measurements,agency:draft.agency,portfolio,platforms:[['Instagram',draft.instagram,draft.instagramFollowers],['TikTok',draft.tiktok,draft.tiktokFollowers],['YouTube',draft.youtube,draft.youtubeFollowers]].filter(x=>x[1]||x[2]).map(x=>({name:x[0],handle:x[1],followers:Number(x[2]||0)})),services:[[draft.service1,draft.service1Price],[draft.service2,draft.service2Price]].filter(x=>x[0]).map(x=>({name:x[0],price:Number(x[1]||0)}))})}else Object.assign(payload,{industry:draft.industry,website:draft.website});
    const r=await api('/api/me',{method:'PATCH',body:payload});STATE.me=r.user;renderNav();if(talent){const t=await api('/api/talents');STATE.talents=t.talents;STATE.favorites=t.favorites||STATE.favorites}
  }
  function navButtons(last=false){return `<div class="onboard-actions">${step>1?'<button type="button" class="ghost" id="backStep">Back</button>':'<span></span>'}<button class="primary" type="submit">${last?'Finish profile':'Continue'}</button></div>`}
  function bindForm(){const f=document.getElementById('onboardForm');document.getElementById('backStep')?.addEventListener('click',()=>{syncCurrent();step--;paint()});f.onsubmit=async e=>{e.preventDefault();syncCurrent();if(step<3){step++;paint();return}try{await save(true);showToast('Profile ready');location.hash='#/dashboard'}catch(err){showToast(err.message)}}}
  function paint(){
    if(step===1){
      frame(`<form id="onboardForm" class="onboard-card"><div class="onboard-heading"><span class="eyebrow">${talent?'THE BASICS':'BRAND IDENTITY'}</span><h2>${talent?'Start with who you are.':'Introduce your brand.'}</h2></div><div class="profile-upload-row"><div class="onboard-avatar ${photo?'profile-photo-img':''}" ${photo?`style="background-image:url('${esc(photo)}')"`:''}>${photo?'':'+'}</div><div><b>${talent?'Profile photo':'Brand logo'}</b><p class="mini">JPG or PNG · max 6 MB</p><label class="ghost file-label">Choose image<input type="file" id="onboardPhoto" accept="image/*" hidden></label></div></div><label>${talent?'Full name / Stage name':'Brand name'}<input name="name" required value="${esc(draft.name)}" placeholder="${talent?'e.g. Maya Al Noor':'e.g. LUMÉ Beauty'}"></label><label>${talent?'Bio':'About'}<textarea name="bio" required maxlength="500" placeholder="Tell people what makes ${talent?'your work':'your brand'} distinctive.">${esc(draft.bio)}</textarea></label><div class="twocol"><label>Country of residence<select name="country" id="onCountry" required>${countryOptions(draft.country)}</select></label><label>City<select name="city" id="onCity" required>${cityOptions(draft.country,draft.city)}</select></label></div>${talent?`<label>Nationality <span class="optional">Optional</span><select name="nationality">${nationalityOptions(draft.nationality,'Nationality (optional)')}</select></label>`:`<div class="twocol"><label>Industry<input name="industry" value="${esc(draft.industry)}" required placeholder="e.g. Beauty"></label><label>Website / social<input name="website" value="${esc(draft.website)}" placeholder="https://"></label></div>`}${navButtons()}`);
      onCountry.onchange=()=>{draft.country=onCountry.value;onCity.innerHTML=cityOptions(onCountry.value,'')};onboardPhoto.onchange=async()=>{if(onboardPhoto.files[0])try{const r=await uploadFile(onboardPhoto.files[0]);photo=r.url;paint()}catch(err){showToast(err.message)}};bindForm();return;
    }
    if(step===2&&talent){
      const cats=['Fashion','Beauty','Lifestyle','Fitness','UGC','Food','Travel','Tech'];
      frame(`<form id="onboardForm" class="onboard-card"><div class="onboard-heading"><span class="eyebrow">YOUR WORK</span><h2>What should brands hire you for?</h2></div><label>Talent type</label><div class="choice-grid"><label class="choice"><input type="checkbox" name="talentType" value="Influencer" ${draft.talentTypes.includes('Influencer')?'checked':''}><span><b>Influencer</b><small>Social content & campaigns</small></span></label><label class="choice"><input type="checkbox" name="talentType" value="Model" ${draft.talentTypes.includes('Model')?'checked':''}><span><b>Model</b><small>Shoots, runway & commercial work</small></span></label></div><label>Categories</label><div class="chip-checks">${cats.map(c=>`<label><input type="checkbox" name="category" value="${c}" ${draft.categories.includes(c)?'checked':''}><span>${c}</span></label>`).join('')}</div><div class="twocol"><label>Languages<input name="languages" value="${esc(Array.isArray(draft.languages)?draft.languages.join(', '):draft.languages)}" placeholder="Arabic, English"></label><label>Availability<select name="availability"><option ${draft.availability==='Available now'?'selected':''}>Available now</option><option ${draft.availability==='This month'?'selected':''}>This month</option><option ${draft.availability==='Unavailable'?'selected':''}>Unavailable</option></select></label></div><label>Starting rate (USD)<input name="startingRate" type="number" min="0" value="${esc(draft.startingRate)}" placeholder="500"></label>${navButtons()}`);bindForm();return;
    }
    if(step===2&&!talent){
      frame(`<form id="onboardForm" class="onboard-card"><div class="onboard-heading"><span class="eyebrow">YOUR PRESENCE</span><h2>Make the profile feel official.</h2></div><div class="cover-upload ${cover?'cover-img':''}" ${cover?`style="background-image:url('${esc(cover)}')"`:''}><div><b>Brand cover image</b><p>Use a campaign, product or editorial image.</p><label class="ghost file-label">Upload cover<input type="file" id="onboardCover" accept="image/*" hidden></label></div></div><div class="preview-panel"><span class="eyebrow">PROFILE PREVIEW</span><h3>${esc(draft.name||'Your Brand')}</h3><p>${esc(draft.bio||'Your brand description will appear here.')}</p><div class="detailrow"><span class="detailchip">${esc(draft.industry||'Industry')}</span><span class="detailchip">${esc([draft.city,draft.country].filter(Boolean).join(', ')||'Location')}</span></div></div>${navButtons()}`);onboardCover.onchange=async()=>{if(onboardCover.files[0])try{const r=await uploadFile(onboardCover.files[0]);cover=r.url;paint()}catch(err){showToast(err.message)}};bindForm();return;
    }
    if(step===3&&talent){
      frame(`<form id="onboardForm" class="onboard-card"><div class="onboard-heading"><span class="eyebrow">PORTFOLIO & SOCIALS</span><h2>Show the proof.</h2><p class="muted">These fields are optional, but stronger profiles get more context from brands.</p></div><div class="social-grid"><label>Instagram handle<input name="instagram" value="${esc(draft.instagram)}" placeholder="@username"></label><label>Instagram followers<input name="instagramFollowers" type="number" min="0" value="${esc(draft.instagramFollowers)}" placeholder="250000"></label><label>TikTok handle<input name="tiktok" value="${esc(draft.tiktok)}" placeholder="@username"></label><label>TikTok followers<input name="tiktokFollowers" type="number" min="0" value="${esc(draft.tiktokFollowers)}" placeholder="500000"></label><label>YouTube channel<input name="youtube" value="${esc(draft.youtube)}" placeholder="Channel name"></label><label>YouTube subscribers<input name="youtubeFollowers" type="number" min="0" value="${esc(draft.youtubeFollowers)}" placeholder="80000"></label></div><div class="form-divider"></div><h3>Services</h3><div class="twocol"><input name="service1" value="${esc(draft.service1)}" placeholder="e.g. Instagram Reel"><input name="service1Price" type="number" value="${esc(draft.service1Price)}" placeholder="Price USD"></div><div class="twocol"><input name="service2" value="${esc(draft.service2)}" placeholder="e.g. Campaign Shoot"><input name="service2Price" type="number" value="${esc(draft.service2Price)}" placeholder="Price USD"></div><div class="form-divider"></div><h3>Portfolio</h3><label class="uploadbox portfolio-upload">Add up to 6 portfolio images<input type="file" id="portfolioFiles" accept="image/*" multiple></label>${portfolio.length?`<div class="portfolio-thumbs">${portfolio.map((x,i)=>`<div style="background-image:url('${esc(x)}')"><button type="button" data-remove-portfolio="${i}">×</button></div>`).join('')}</div>`:''}<div class="model-extra ${draft.talentTypes.includes('Model')?'':'soft-hidden'}"><h3>Model details</h3><div class="twocol"><input name="modelCategory" value="${esc(draft.modelCategory)}" placeholder="Fashion / Commercial"><input name="measurements" value="${esc(draft.measurements)}" placeholder="Measurements"></div><input name="agency" value="${esc(draft.agency)}" placeholder="Agency representation (optional)"></div>${navButtons(true)}`);
      portfolioFiles.onchange=async()=>{const files=[...portfolioFiles.files].slice(0,Math.max(0,6-portfolio.length));for(const f of files){try{const r=await uploadFile(f);portfolio.push(r.url)}catch(err){showToast(err.message)}}paint()};document.querySelectorAll('[data-remove-portfolio]').forEach(b=>b.onclick=()=>{portfolio.splice(Number(b.dataset.removePortfolio),1);paint()});bindForm();return;
    }
    frame(`<form id="onboardForm" class="onboard-card"><div class="onboard-heading"><span class="eyebrow">READY TO GO</span><h2>Your brand profile is ready.</h2><p class="muted">Next you can discover talent, save profiles and create your first campaign.</p></div><div class="brand-ready-card"><div class="brand-ready-cover ${cover?'cover-img':''}" ${cover?`style="background-image:url('${esc(cover)}')"`:''}></div><div><span class="eyebrow">${esc(draft.industry||'BRAND')}</span><h2>${esc(draft.name||'Your Brand')}</h2><p>${esc(draft.bio||'')}</p><div class="detailrow"><span class="detailchip">${esc([draft.city,draft.country].filter(Boolean).join(', '))}</span>${draft.website?'<span class="detailchip">Website added</span>':''}</div></div></div>${navButtons(true)}`);bindForm();
  }
  paint();
}

async function settings(){if(!STATE.me){location.hash='#/auth';return}const u=STATE.me;const talent=u.role==='talent';shell(`<section class="wrap narrow section"><div class="eyebrow">SETTINGS</div><h2>Edit profile.</h2><form class="formcard" id="settingsForm"><div class="inline"><div class="upload-preview ${u.profilePhoto?'profile-photo-img':''}" ${u.profilePhoto?`style="background-image:url('${esc(u.profilePhoto)}')"`:''}></div><div><label>Profile photo</label><input type="file" id="profilePhoto"></div></div><div class="uploadbox"><label>Cover image</label><input type="file" id="coverImage"></div><input name="name" value="${esc(u.name)}" placeholder="Name"><textarea name="bio" placeholder="Bio">${esc(u.bio||'')}</textarea><div class="twocol"><select name="country" id="setCountry">${countryOptions(u.country||'')}</select><select name="city" id="setCity">${cityOptions(u.country||'',u.city||'')}</select></div>${talent?`<div class="checkrow"><label><input type="checkbox" name="talentType" value="Influencer" ${(u.talentTypes||[]).includes('Influencer')?'checked':''}> Influencer</label><label><input type="checkbox" name="talentType" value="Model" ${(u.talentTypes||[]).includes('Model')?'checked':''}> Model</label></div><input name="categories" value="${esc((u.categories||[]).join(', '))}" placeholder="Categories e.g. Fashion, Beauty"><input name="languages" value="${esc((u.languages||[]).join(', '))}" placeholder="Languages e.g. Arabic, English"><div class="twocol"><input name="nationality" value="${esc(u.nationality||'')}" placeholder="Nationality (optional)"><input name="startingRate" type="number" value="${esc(u.startingRate||'')}" placeholder="Starting rate USD"></div><select name="availability"><option ${u.availability==='Available now'?'selected':''}>Available now</option><option ${u.availability==='This month'?'selected':''}>This month</option><option ${u.availability==='Unavailable'?'selected':''}>Unavailable</option></select><input name="modelCategory" value="${esc(u.modelCategory||'')}" placeholder="Model category (optional)"><input name="measurements" value="${esc(u.measurements||'')}" placeholder="Measurements (optional)"><input name="agency" value="${esc(u.agency||'')}" placeholder="Agency representation (optional)"><div class="notice">Social platforms and service packages can be edited as JSON-ready profile data in this V1; the next polish pass can add repeatable visual editors.</div>`:`<input name="industry" value="${esc(u.industry||'')}" placeholder="Industry"><input name="website" value="${esc(u.website||'')}" placeholder="Website / socials">`}<button class="primary">Save changes</button></form></section>`);setCountry.onchange=()=>setCity.innerHTML=cityOptions(setCountry.value);let photo=u.profilePhoto||'',cover=u.coverImage||'';profilePhoto.onchange=async()=>{if(profilePhoto.files[0]){try{const r=await uploadFile(profilePhoto.files[0]);photo=r.url;showToast('Profile photo uploaded')}catch(err){showToast(err.message)}}};coverImage.onchange=async()=>{if(coverImage.files[0]){try{const r=await uploadFile(coverImage.files[0]);cover=r.url;showToast('Cover uploaded')}catch(err){showToast(err.message)}}};settingsForm.onsubmit=async e=>{e.preventDefault();const fd=new FormData(e.target),d=Object.fromEntries(fd.entries());d.profilePhoto=photo;d.coverImage=cover;if(talent){d.talentTypes=fd.getAll('talentType');d.categories=(d.categories||'').split(',').map(x=>x.trim()).filter(Boolean);d.languages=(d.languages||'').split(',').map(x=>x.trim()).filter(Boolean);d.startingRate=Number(d.startingRate||0)}try{const r=await api('/api/me',{method:'PATCH',body:d});STATE.me=r.user;renderNav();showToast('Profile saved')}catch(err){showToast(err.message)}}}
async function admin(){if(STATE.me?.role!=='admin'){location.hash='#/dashboard';return}const [u,d]=await Promise.all([api('/api/admin/users'),api('/api/dashboard')]);shell(`<section class="wrap section"><div class="eyebrow">ADMIN</div><h2>Marketplace control center.</h2><div class="metricgrid"><div class="metric"><span>Users</span><b>${d.users}</b></div><div class="metric"><span>Talent</span><b>${u.users.filter(x=>x.role==='talent').length}</b></div><div class="metric"><span>Campaigns</span><b>${d.campaigns}</b></div><div class="metric"><span>Deals</span><b>${d.deals}</b></div></div><div class="table"><div class="tr head"><span>User</span><span>Role</span><span>Status</span><span>Action</span></div>${u.users.map(x=>`<div class="tr"><span>${esc(x.name)}</span><span>${esc(x.role)}</span><span>${x.suspended?'Suspended':x.verified?'Verified':'Active'}</span><button class="ghost small" data-suspend="${x.id}">${x.suspended?'Restore':'Suspend'}</button></div>`).join('')}</div></section>`);document.querySelectorAll('[data-suspend]').forEach(b=>b.onclick=async()=>{try{await api(`/api/admin/users/${b.dataset.suspend}/suspend`,{method:'POST'});showToast('User status updated');admin()}catch(err){showToast(err.message)}})}
function auth(qs=''){
  if(STATE.me){location.hash=STATE.me.onboardingComplete?'#/dashboard':'#/onboarding';return}
  const params=new URLSearchParams(qs), initial=params.get('mode')==='signup'?'signup':'login';
  shell(`<section class="authpage auth-v2"><div class="authart"><div class="authcopy"><span class="eyebrow">MUSE</span><h1>Where talent meets the right brands.</h1><p>Build a profile, discover opportunities and manage collaborations in one place.</p><div class="authproof"><span>✦ Global talent discovery</span><span>✦ Campaigns & direct offers</span><span>✦ Deal rooms built in</span></div></div></div><section class="authcard"><div class="auth-tabs"><button class="auth-tab" id="loginTab">Sign in</button><button class="auth-tab" id="signupTab">Create account</button></div><div id="authFormHost"></div><div class="demo"><span>Demo access</span><button data-demo-login="brand@demo.com">Brand</button><button data-demo-login="talent@demo.com">Talent</button><button data-demo-login="admin@demo.com">Admin</button></div><p class="mini">Demo password: demo1234</p></section></section>`);
  function paint(mode){
    loginTab.classList.toggle('active',mode==='login'); signupTab.classList.toggle('active',mode==='signup');
    authFormHost.innerHTML=mode==='login'?`<div class="auth-heading"><h2>Welcome back</h2><p class="muted">Sign in to continue to your workspace.</p></div><form id="authForm" class="auth-form"><label>Email<input name="email" type="email" required placeholder="you@example.com"></label><label>Password<input name="password" type="password" required placeholder="••••••••"></label><button class="primary full auth-submit">Sign in</button></form>`:`<div class="auth-heading"><h2>Create your account</h2><p class="muted">Choose how you want to use MUSE. You can update talent types later.</p></div><form id="authForm" class="auth-form"><div class="account-type-grid"><label class="account-type selected"><input type="radio" name="accountType" value="brand" checked><span class="account-icon">B</span><b>Brand</b><small>Find and hire talent</small></label><label class="account-type"><input type="radio" name="accountType" value="influencer"><span class="account-icon">I</span><b>Influencer</b><small>Find brand opportunities</small></label><label class="account-type"><input type="radio" name="accountType" value="model"><span class="account-icon">M</span><b>Model</b><small>Get booked for shoots</small></label></div><label>Name<input name="name" required placeholder="Full name / Brand name"></label><label>Email<input name="email" type="email" required placeholder="you@example.com"></label><label>Password<input name="password" type="password" minlength="6" required placeholder="6+ characters"></label><button class="primary full auth-submit">Create account</button></form>`;
    if(mode==='signup')document.querySelectorAll('.account-type').forEach(card=>card.addEventListener('click',()=>{document.querySelectorAll('.account-type').forEach(x=>x.classList.remove('selected'));card.classList.add('selected')}));
    authForm.onsubmit=async e=>{e.preventDefault();const fd=new FormData(e.target),d=Object.fromEntries(fd.entries());if(mode==='signup'){const at=d.accountType;d.role=at==='brand'?'brand':'talent';d.talentTypes=at==='brand'?[]:[at==='model'?'Model':'Influencer'];delete d.accountType}try{const r=await api(mode==='login'?'/api/login':'/api/signup',{method:'POST',body:d});STATE.me=r.user;const n=await api('/api/notifications').catch(()=>({notifications:[]}));STATE.notifications=n.notifications||[];renderNav();location.hash=STATE.me.role==='admin'?'#/admin':(!STATE.me.onboardingComplete?'#/onboarding':'#/dashboard')}catch(err){showToast(err.message)}};
  }
  loginTab.onclick=()=>paint('login'); signupTab.onclick=()=>paint('signup');
  document.querySelectorAll('[data-demo-login]').forEach(b=>b.onclick=async()=>{try{const r=await api('/api/login',{method:'POST',body:{email:b.dataset.demoLogin,password:'demo1234'}});STATE.me=r.user;STATE.notifications=(await api('/api/notifications')).notifications;renderNav();location.hash=STATE.me.role==='admin'?'#/admin':'#/dashboard'}catch(err){showToast(err.message)}});
  paint(initial);
}

async function settings(){
  if(!STATE.me){location.hash='#/auth';return}
  const user=STATE.me;
  const talent=user.role==='talent';
  const platformByName=Object.fromEntries((user.platforms||[]).map(item=>[String(item.name||'').toLowerCase(),item]));
  const services=user.services||[];
  let photo=user.profilePhoto||'',cover=user.coverImage||'',portfolio=[...(user.portfolio||[])];
  const socialFields=talent
    ?'<div class="form-divider"></div><h3>Social audience</h3><div class="social-grid"><label>Instagram handle<input name="instagram" value="'+esc(platformByName.instagram?.handle||'')+'" placeholder="@username"></label><label>Instagram followers<input name="instagramFollowers" type="number" min="0" value="'+esc(platformByName.instagram?.followers||'')+'" placeholder="250000"></label><label>TikTok handle<input name="tiktok" value="'+esc(platformByName.tiktok?.handle||'')+'" placeholder="@username"></label><label>TikTok followers<input name="tiktokFollowers" type="number" min="0" value="'+esc(platformByName.tiktok?.followers||'')+'" placeholder="500000"></label><label>YouTube channel<input name="youtube" value="'+esc(platformByName.youtube?.handle||'')+'" placeholder="Channel name"></label><label>YouTube subscribers<input name="youtubeFollowers" type="number" min="0" value="'+esc(platformByName.youtube?.followers||'')+'" placeholder="80000"></label></div><div class="form-divider"></div><h3>Services</h3><div class="twocol"><input name="service1" value="'+esc(services[0]?.name||'')+'" placeholder="e.g. Instagram Reel"><input name="service1Price" type="number" min="0" value="'+esc(services[0]?.price||'')+'" placeholder="Price USD"></div><div class="twocol"><input name="service2" value="'+esc(services[1]?.name||'')+'" placeholder="e.g. Campaign Shoot"><input name="service2Price" type="number" min="0" value="'+esc(services[1]?.price||'')+'" placeholder="Price USD"></div><div class="form-divider"></div><h3>Portfolio</h3><label class="uploadbox portfolio-upload">Add up to 6 portfolio images<input type="file" id="portfolioFiles" accept="image/*" multiple></label><p class="mini" id="portfolioCount">'+portfolio.length+' portfolio image'+(portfolio.length===1?'':'s')+' saved</p>'
    :'';
  const talentFields=talent
    ?'<div class="checkrow"><label><input type="checkbox" name="talentType" value="Influencer" '+((user.talentTypes||[]).includes('Influencer')?'checked':'')+'> Influencer</label><label><input type="checkbox" name="talentType" value="Model" '+((user.talentTypes||[]).includes('Model')?'checked':'')+'> Model</label></div><input name="categories" value="'+esc((user.categories||[]).join(', '))+'" placeholder="Categories, e.g. Fashion, Beauty"><input name="languages" value="'+esc((user.languages||[]).join(', '))+'" placeholder="Languages, e.g. Arabic, English"><div class="twocol"><input name="nationality" value="'+esc(user.nationality||'')+'" placeholder="Nationality (optional)"><input name="startingRate" type="number" min="0" value="'+esc(user.startingRate||'')+'" placeholder="Starting rate USD"></div><select name="availability"><option '+(user.availability==='Available now'?'selected':'')+'>Available now</option><option '+(user.availability==='This month'?'selected':'')+'>This month</option><option '+(user.availability==='Unavailable'?'selected':'')+'>Unavailable</option></select><input name="modelCategory" value="'+esc(user.modelCategory||'')+'" placeholder="Model category (optional)"><input name="measurements" value="'+esc(user.measurements||'')+'" placeholder="Measurements (optional)"><input name="agency" value="'+esc(user.agency||'')+'" placeholder="Agency representation (optional)">'
    :'<input name="industry" required value="'+esc(user.industry||'')+'" placeholder="Industry"><input name="website" value="'+esc(user.website||'')+'" placeholder="Website / social">';

  shell(
    '<section class="wrap narrow section"><div class="eyebrow">SETTINGS</div><h2>Edit profile.</h2>'+
    '<form class="formcard" id="settingsForm">'+
      '<div class="inline"><div class="upload-preview '+(photo?'profile-photo-img':'')+'" '+(photo?'style="background-image:url(\''+esc(photo)+'\')"':'')+'></div><div><label>Profile photo</label><input type="file" id="profilePhoto" accept="image/*"></div></div>'+
      '<div class="uploadbox"><label>Cover image<input type="file" id="coverImage" accept="image/*"></label></div>'+
      '<input name="name" required maxlength="120" value="'+esc(user.name)+'" placeholder="Name"><textarea name="bio" maxlength="500" placeholder="Bio">'+esc(user.bio||'')+'</textarea>'+
      '<div class="twocol"><select name="country" id="setCountry">'+countryOptions(user.country||'')+'</select><select name="city" id="setCity">'+cityOptions(user.country||'',user.city||'')+'</select></div>'+
      talentFields+socialFields+
      '<button class="primary">Save changes</button>'+
    '</form></section>'
  );

  const country=document.getElementById('setCountry');
  const city=document.getElementById('setCity');
  country.onchange=()=>city.innerHTML=cityOptions(country.value);
  document.getElementById('profilePhoto').onchange=async()=>{
    const file=document.getElementById('profilePhoto').files[0];
    if(!file)return;
    try{photo=(await uploadFile(file)).url;showToast('Profile photo uploaded')}catch(error){showToast(error.message)}
  };
  document.getElementById('coverImage').onchange=async()=>{
    const file=document.getElementById('coverImage').files[0];
    if(!file)return;
    try{cover=(await uploadFile(file)).url;showToast('Cover uploaded')}catch(error){showToast(error.message)}
  };
  document.getElementById('portfolioFiles')?.addEventListener('change',async()=>{
    const files=[...document.getElementById('portfolioFiles').files].slice(0,Math.max(0,6-portfolio.length));
    try{
      for(const file of files)portfolio.push((await uploadFile(file)).url);
      const count=document.getElementById('portfolioCount');
      if(count)count.textContent=portfolio.length+' portfolio image'+(portfolio.length===1?'':'s')+' saved';
      showToast(files.length?'Portfolio updated':'Portfolio limit reached');
    }catch(error){showToast(error.message)}
  });
  document.getElementById('settingsForm').onsubmit=async event=>{
    event.preventDefault();
    const formData=new FormData(event.target);
    const data=Object.fromEntries(formData.entries());
    data.profilePhoto=photo;
    data.coverImage=cover;
    if(talent){
      data.talentTypes=formData.getAll('talentType');
      data.categories=(data.categories||'').split(',').map(item=>item.trim()).filter(Boolean);
      data.languages=(data.languages||'').split(',').map(item=>item.trim()).filter(Boolean);
      data.startingRate=Number(data.startingRate||0);
      data.portfolio=portfolio;
      data.platforms=[
        ['Instagram',data.instagram,data.instagramFollowers],
        ['TikTok',data.tiktok,data.tiktokFollowers],
        ['YouTube',data.youtube,data.youtubeFollowers]
      ].filter(item=>item[1]||item[2]).map(item=>({name:item[0],handle:item[1],followers:Number(item[2]||0)}));
      data.services=[
        [data.service1,data.service1Price],
        [data.service2,data.service2Price]
      ].filter(item=>item[0]).map(item=>({name:item[0],price:Number(item[1]||0)}));
      delete data.instagram;delete data.instagramFollowers;delete data.tiktok;delete data.tiktokFollowers;delete data.youtube;delete data.youtubeFollowers;delete data.service1;delete data.service1Price;delete data.service2;delete data.service2Price;
    }
    try{
      const result=await api('/api/me',{method:'PATCH',body:data});
      STATE.me=result.user;
      await refreshMarketplaceState();
      renderNav();
      showToast('Profile saved');
    }catch(error){showToast(error.message)}
  };
}

async function refreshMarketplaceState(){
  const [talents,campaigns,notes]=await Promise.all([
    api('/api/talents'),
    api('/api/campaigns'),
    api('/api/notifications').catch(()=>({notifications:[]}))
  ]);
  STATE.talents=talents.talents||[];
  STATE.favorites=talents.favorites||[];
  STATE.campaigns=campaigns.campaigns||[];
  STATE.notifications=notes.notifications||[];
}

async function talentProfile(id){
  const result=await api('/api/talents/'+encodeURIComponent(id));
  const t=result.talent;
  if(!t)return notFound();

  let saved=STATE.favorites.includes(t.id),shortlists=[],ownCampaigns=[];
  if(STATE.me?.role==='brand'){
    const [workspace,campaignData]=await Promise.all([api('/api/dashboard'),api('/api/campaigns')]);
    shortlists=workspace.shortlists||[];
    STATE.favorites=(workspace.favorites||[]).map(item=>item.id);
    saved=STATE.favorites.includes(t.id);
    ownCampaigns=(campaignData.campaigns||[]).filter(item=>item.brand_id===STATE.me.id&&item.status==='Open');
  }

  const portfolio=(t.portfolio||[]).length
    ?(t.portfolio||[]).map(item=>'<div class="shot profile-shot" style="background-image:url(\''+esc(item)+'\')"></div>').join('')
    :'<div class="shot"></div><div class="shot"></div><div class="shot"></div>';
  const actions=STATE.me?.role==='brand'
    ?'<button class="ghost" data-fav="'+esc(t.id)+'">'+(saved?'♥ Saved':'♡ Save')+'</button><button class="ghost" id="shortlistBtn">Shortlist</button><button class="ghost" id="inviteBtn">Invite to Campaign</button><button class="primary" id="offerBtn">Send Offer</button>'
    :'';

  shell(
    '<section class="wrap profilehero">'+
      '<div class="cover '+(t.coverImage?'cover-img':'')+'" '+(t.coverImage?'style="background-image:url(\''+esc(t.coverImage)+'\')"':'')+'></div>'+
      '<div class="profilecard">'+
        '<div class="avatar '+(t.profilePhoto?'profile-photo-img':'')+'" '+(t.profilePhoto?'style="background-image:url(\''+esc(t.profilePhoto)+'\')"':'')+'></div>'+
        '<div><h1>'+esc(t.name)+' '+(t.verified?'<span class="verified">✓</span>':'')+'</h1><p class="muted">'+esc((t.talentTypes||[]).join(' · '))+' · '+esc([t.city,t.country].filter(Boolean).join(', '))+'</p></div>'+
        '<div class="actions">'+actions+'</div>'+
      '</div>'+
      '<div class="profilegrid"><section>'+
        '<div class="box"><div class="eyebrow">ABOUT</div><p>'+esc(t.bio||'')+'</p><div class="detailrow">'+[t.nationality,(t.languages||[]).join(' · '),t.availability].filter(Boolean).map(item=>'<span class="detailchip">'+esc(item)+'</span>').join('')+'</div></div>'+
        '<div class="box"><div class="sectionhead compact"><div class="eyebrow">PORTFOLIO</div><span class="mini">'+((t.portfolio||[]).length||0)+' works</span></div><div class="portfolio">'+portfolio+'</div></div>'+
      '</section><aside>'+
        '<div class="box"><div class="eyebrow">STARTING RATE</div><div class="budget">'+money(t.startingRate||0)+'</div></div>'+
        '<div class="box"><div class="eyebrow">SERVICES</div>'+((t.services||[]).map(item=>'<div class="service"><span>'+esc(item.name)+'</span><b>'+money(item.price)+'</b></div>').join('')||'<p class="muted">No services added yet.</p>')+'</div>'+
        '<div class="box"><div class="eyebrow">SOCIAL AUDIENCE</div>'+((t.platforms||[]).map(item=>'<div class="service"><div><span>'+esc(item.name)+'</span>'+(item.handle?'<small>'+esc(item.handle)+'</small>':'')+'</div><b>'+Number(item.followers||0).toLocaleString()+'</b></div>').join('')||'<p class="muted">No social platforms added yet.</p>')+'</div>'+
        (t.modelCategory?'<div class="box"><div class="eyebrow">MODEL DETAILS</div><p>'+esc(t.modelCategory)+'</p><p class="muted">'+esc(t.measurements||'')+'</p><p class="muted">Agency: '+esc(t.agency||'Not specified')+'</p></div>':'')+
      '</aside></div>'+
    '</section><div id="modalHost"></div>'
  );
  bindFavorites();
  const host=document.getElementById('modalHost');

  document.getElementById('offerBtn')?.addEventListener('click',()=>{
    host.innerHTML='<div class="modalback"><form class="modal" id="offerForm"><span class="eyebrow">DIRECT OFFER</span><h2>Send an offer to '+esc(t.name)+'</h2><input name="title" required placeholder="Offer title"><textarea name="details" required placeholder="Job details"></textarea><input name="deliverables" required placeholder="Deliverables"><div class="twocol"><input name="date" type="date" required><input name="price" type="number" min="1" required placeholder="Offered price USD"></div><button class="primary full">Send Offer</button><button type="button" class="ghost full" id="closeModal">Cancel</button></form></div>';
    document.getElementById('closeModal').onclick=()=>host.innerHTML='';
    document.getElementById('offerForm').onsubmit=async event=>{
      event.preventDefault();
      const data=Object.fromEntries(new FormData(event.target));
      data.talentId=t.id;
      try{await api('/api/offers',{method:'POST',body:data});host.innerHTML='';showToast('Offer sent')}catch(error){showToast(error.message)}
    };
  });

  document.getElementById('inviteBtn')?.addEventListener('click',()=>{
    const options=ownCampaigns.map(item=>'<option value="'+esc(item.id)+'">'+esc(item.name)+'</option>').join('');
    host.innerHTML='<div class="modalback"><form class="modal" id="inviteForm"><span class="eyebrow">CAMPAIGN INVITE</span><h2>Invite '+esc(t.name)+'</h2>'+(options?'<label>Choose campaign<select name="campaignId">'+options+'</select></label><button class="primary full">Send invitation</button>':'<div class="empty">Create a campaign before inviting talent.</div><a class="primary full center" href="#/campaigns/new">Create Campaign</a>')+'<button type="button" class="ghost full" id="closeModal">Cancel</button></form></div>';
    document.getElementById('closeModal').onclick=()=>host.innerHTML='';
    document.getElementById('inviteForm').onsubmit=async event=>{
      event.preventDefault();
      const campaignId=new FormData(event.target).get('campaignId');
      if(!campaignId)return;
      try{await api('/api/campaigns/'+encodeURIComponent(campaignId)+'/invite',{method:'POST',body:{talentId:t.id}});host.innerHTML='';showToast('Campaign invitation sent')}catch(error){showToast(error.message)}
    };
  });

  document.getElementById('shortlistBtn')?.addEventListener('click',()=>{
    const options=shortlists.map(item=>'<option value="'+esc(item.id)+'">'+esc(item.name)+' ('+item.talentIds.length+')</option>').join('');
    host.innerHTML='<div class="modalback"><form class="modal" id="shortlistForm"><span class="eyebrow">SHORTLIST</span><h2>Save '+esc(t.name)+'</h2>'+(options?'<label>Choose a shortlist<select name="shortlistId">'+options+'</select></label><button class="primary full">Update shortlist</button>':'<label>New shortlist name<input name="name" required maxlength="80" placeholder="e.g. Dubai beauty launch"></label><button class="primary full">Create & add talent</button>')+'<button type="button" class="ghost full" id="closeModal">Cancel</button></form></div>';
    document.getElementById('closeModal').onclick=()=>host.innerHTML='';
    document.getElementById('shortlistForm').onsubmit=async event=>{
      event.preventDefault();
      try{
        const formData=new FormData(event.target);
        let shortlistId=formData.get('shortlistId');
        if(!shortlistId){
          const created=await api('/api/shortlists',{method:'POST',body:{name:formData.get('name')}});
          shortlistId=created.id;
        }
        const changed=await api('/api/shortlists/'+encodeURIComponent(shortlistId)+'/toggle',{method:'POST',body:{talentId:t.id}});
        host.innerHTML='';
        showToast(changed.added?'Added to shortlist':'Removed from shortlist');
      }catch(error){showToast(error.message)}
    };
  });
}

function newCampaign(){
  if(STATE.me?.role!=='brand'){location.hash='#/auth?mode=signup';return}
  const categories=['Fashion','Beauty','Lifestyle','Fitness','UGC','Food','Travel','Tech'];
  shell(
    '<section class="wrap narrow section"><div class="eyebrow">BRAND WORKSPACE</div><h2>Create Campaign</h2>'+
    '<form class="formcard" id="campaignForm">'+
      '<input name="name" required maxlength="140" placeholder="Campaign name">'+
      '<textarea name="description" required maxlength="3000" placeholder="Describe the campaign, creative direction and who is a fit."></textarea>'+
      '<div class="twocol"><select name="talentType"><option>Influencer / Model</option><option>Influencer</option><option>Model</option></select><select name="category">'+categories.map(item=>'<option>'+item+'</option>').join('')+'</select></div>'+
      '<div class="twocol"><select name="country" id="campCountry">'+countryOptions('United Arab Emirates')+'</select><select name="city" id="campCity">'+cityOptions('United Arab Emirates')+'</select></div>'+
      '<div class="twocol"><input name="platform" required placeholder="Platform, e.g. Instagram"><input name="deliverables" required placeholder="Deliverables"></div>'+
      '<div class="threecol"><input name="budgetMin" required type="number" min="1" placeholder="Min budget"><input name="budgetMax" required type="number" min="1" placeholder="Max budget"><input name="slots" required type="number" value="1" min="1" placeholder="Talent count"></div>'+
      '<div class="twocol"><input name="deadline" required type="date"><select name="visibility"><option>Public</option><option>Invite Only</option></select></div>'+
      '<button class="primary">Publish Campaign</button>'+
    '</form></section>'
  );
  const country=document.getElementById('campCountry');
  const city=document.getElementById('campCity');
  country.onchange=()=>city.innerHTML=cityOptions(country.value);
  document.getElementById('campaignForm').onsubmit=async event=>{
    event.preventDefault();
    try{
      await api('/api/campaigns',{method:'POST',body:Object.fromEntries(new FormData(event.target))});
      await refreshMarketplaceState();
      showToast('Campaign published');
      location.hash='#/campaigns';
    }catch(error){showToast(error.message)}
  };
}

async function dashboard(){
  if(!STATE.me){location.hash='#/auth';return}
  const data=await api('/api/dashboard');
  const user=STATE.me;
  if(user.role==='admin'){location.hash='#/admin';return}
  const offers=data.offers||[],deals=data.deals||[],applications=data.applications||[];
  const offerRows=offers.length?offers.map(offer=>{
    const amount=offer.status==='Countered'&&offer.counter_price?money(offer.counter_price)+' counter':money(offer.price);
    const note=offer.status==='Countered'&&offer.counter_note?' · '+esc(offer.counter_note):'';
    let actions='';
    if(user.role==='talent'&&offer.status==='Pending')actions='<div class="inline"><button class="ghost small" data-offer="'+esc(offer.id)+'" data-status="Declined">Decline</button><button class="ghost small" data-counter="'+esc(offer.id)+'">Counter</button><button class="primary small" data-offer="'+esc(offer.id)+'" data-status="Accepted">Accept</button></div>';
    if(user.role==='brand'&&offer.status==='Countered')actions='<div class="inline"><button class="ghost small" data-offer="'+esc(offer.id)+'" data-status="Declined">Decline counter</button><button class="primary small" data-offer="'+esc(offer.id)+'" data-status="Accepted">Accept counter</button></div>';
    return '<div class="service"><div><b>'+esc(offer.title)+'</b><small>'+amount+' · '+esc(offer.status)+note+'</small></div>'+actions+'</div>';
  }).join(''):'<p class="muted">No offers yet.</p>';
  const applicantRows=applications.length?applications.map(item=>
    '<a class="dealrow" href="#/talent/'+encodeURIComponent(item.talent_id)+'"><div><b>'+esc(item.talent_name)+'</b><div class="mini">'+esc(item.campaign_name)+' · '+money(item.price)+'</div><div class="mini">'+esc(item.proposal||'')+'</div></div><span>View profile →</span></a>'
  ).join(''):'<div class="empty">Applications will appear here when talent applies.</div>';

  shell(
    '<section class="wrap section">'+
      '<div class="dashhead"><div><div class="eyebrow">WORKSPACE</div><h2>'+esc(user.name)+'</h2><p class="muted">Signed in as '+esc(user.role)+'</p></div><a class="ghost" href="#/settings">Settings</a></div>'+
      '<div class="metricgrid"><div class="metric"><span>Offers</span><b>'+offers.length+'</b></div><div class="metric"><span>Active deals</span><b>'+deals.filter(item=>item.status!=='Completed').length+'</b></div><div class="metric"><span>Completed</span><b>'+deals.filter(item=>item.status==='Completed').length+'</b></div><div class="metric"><span>'+(user.role==='brand'?'Saved talent':'Applications')+'</span><b>'+(user.role==='brand'?(data.favorites||[]).length:applications.length)+'</b></div></div>'+
      '<div class="dashgrid"><section class="box"><h3>Recent offers</h3>'+offerRows+'</section><section class="box"><h3>Quick access</h3><p><a href="#/discover">Discover talent</a></p><p><a href="#/campaigns">Campaign marketplace</a></p><p><a href="#/deals">Deal rooms</a></p><p><a href="#/settings">Profile settings</a></p></section></div>'+
      (user.role==='brand'
        ?'<div class="sectionhead topgap"><div><h2>Campaign applications</h2></div></div><div class="campaignlist">'+applicantRows+'</div><div class="sectionhead topgap"><div><h2>Saved talent</h2></div></div><div class="cards">'+((data.favorites||[]).map(talentCard).join('')||'<div class="empty">Save talent from Discover.</div>')+'</div><div class="sectionhead topgap"><div><h2>Shortlists</h2></div><button class="ghost" id="newList">+ New list</button></div><div class="campaignlist">'+((data.shortlists||[]).map(item=>'<div class="dealrow"><div><b>'+esc(item.name)+'</b><div class="mini">'+item.talentIds.length+' talent</div></div></div>').join('')||'<div class="empty">No shortlists yet.</div>')+'</div>'
        :'<div class="sectionhead topgap"><div><h2>Applications</h2></div></div><div class="campaignlist">'+(applications.map(item=>'<div class="dealrow"><div><b>'+esc(item.campaign_name)+'</b><div class="mini">'+money(item.price)+' · '+esc(item.status)+'</div></div></div>').join('')||'<div class="empty">No applications yet.</div>')+'</div><div class="sectionhead topgap"><div><h2>Campaign invitations</h2></div></div><div class="campaignlist">'+((data.invitations||[]).map(item=>'<a class="dealrow" href="#/campaign/'+encodeURIComponent(item.campaign_id)+'"><div><b>'+esc(item.campaign_name)+'</b><div class="mini">Invited by '+esc(item.brand_name)+' · '+esc(item.status)+'</div></div><span>View →</span></a>').join('')||'<div class="empty">No invitations yet.</div>')+'</div>')+
    '</section><div id="modalHost"></div>'
  );
  bindFavorites();

  document.querySelectorAll('[data-offer]').forEach(button=>button.onclick=async()=>{
    try{
      await api('/api/offers/'+encodeURIComponent(button.dataset.offer)+'/respond',{method:'POST',body:{status:button.dataset.status}});
      showToast('Offer updated');
      dashboard();
    }catch(error){showToast(error.message)}
  });
  document.querySelectorAll('[data-counter]').forEach(button=>button.onclick=()=>{
    const offer=offers.find(item=>item.id===button.dataset.counter);
    const host=document.getElementById('modalHost');
    host.innerHTML='<div class="modalback"><form class="modal" id="counterForm"><span class="eyebrow">COUNTER OFFER</span><h2>'+esc(offer.title)+'</h2><input name="counterPrice" type="number" min="1" required placeholder="Your counter price USD"><textarea name="counterNote" maxlength="1200" placeholder="Optional note for the brand"></textarea><button class="primary full">Send counter offer</button><button type="button" class="ghost full" id="closeModal">Cancel</button></form></div>';
    document.getElementById('closeModal').onclick=()=>host.innerHTML='';
    document.getElementById('counterForm').onsubmit=async event=>{
      event.preventDefault();
      const formData=Object.fromEntries(new FormData(event.target));
      try{
        await api('/api/offers/'+encodeURIComponent(offer.id)+'/respond',{method:'POST',body:{status:'Countered',counterPrice:formData.counterPrice,counterNote:formData.counterNote}});
        host.innerHTML='';
        showToast('Counter offer sent');
        dashboard();
      }catch(error){showToast(error.message)}
    };
  });
  document.getElementById('newList')?.addEventListener('click',async()=>{
    const name=window.prompt('Shortlist name');
    if(!name)return;
    try{await api('/api/shortlists',{method:'POST',body:{name}});dashboard()}catch(error){showToast(error.message)}
  });
}

async function admin(){
  if(STATE.me?.role!=='admin'){location.hash='#/dashboard';return}
  const [userData,dashboardData]=await Promise.all([api('/api/admin/users'),api('/api/dashboard')]);
  shell(
    '<section class="wrap section"><div class="eyebrow">ADMIN</div><h2>Marketplace control center.</h2>'+
      '<div class="metricgrid"><div class="metric"><span>Users</span><b>'+dashboardData.users+'</b></div><div class="metric"><span>Talent</span><b>'+userData.users.filter(item=>item.role==='talent').length+'</b></div><div class="metric"><span>Campaigns</span><b>'+dashboardData.campaigns+'</b></div><div class="metric"><span>Deals</span><b>'+dashboardData.deals+'</b></div></div>'+
      '<div class="table"><div class="tr head"><span>User</span><span>Role</span><span>Status</span><span>Action</span></div>'+
      userData.users.map(item=>'<div class="tr"><span>'+esc(item.name)+'</span><span>'+esc(item.role)+'</span><span>'+(item.suspended?'Suspended':item.verified?'Verified':'Needs review')+(item.safetyFlags?' · '+item.safetyFlags+' safety flag'+(item.safetyFlags===1?'':'s'):'')+'</span><div class="inline"><button class="ghost small" data-verify="'+esc(item.id)+'">'+(item.verified?'Unverify':'Verify')+'</button><button class="ghost small" data-suspend="'+esc(item.id)+'">'+(item.suspended?'Restore':'Suspend')+'</button></div></div>').join('')+
      '</div></section>'
  );
  document.querySelectorAll('[data-verify]').forEach(button=>button.onclick=async()=>{
    try{await api('/api/admin/users/'+encodeURIComponent(button.dataset.verify)+'/verify',{method:'POST',body:{}});showToast('Verification updated');admin()}catch(error){showToast(error.message)}
  });
  document.querySelectorAll('[data-suspend]').forEach(button=>button.onclick=async()=>{
    try{await api('/api/admin/users/'+encodeURIComponent(button.dataset.suspend)+'/suspend',{method:'POST',body:{}});showToast('User status updated');admin()}catch(error){showToast(error.message)}
  });
}

function auth(qs=''){
  if(STATE.me){location.hash=STATE.me.onboardingComplete?'#/dashboard':'#/onboarding';return}
  const params=new URLSearchParams(qs);
  const initial=params.get('mode')==='signup'?'signup':'login';
  const demoPanel=STATE.meta?.demoMode
    ?'<div class="demo"><span>Demo access</span><button data-demo-login="brand@demo.com">Brand</button><button data-demo-login="talent@demo.com">Talent</button><button data-demo-login="admin@demo.com">Admin</button></div><p class="mini">Demo password: demo1234</p>'
    :'';
  shell(
    '<section class="authpage auth-v2"><div class="authart"><div class="authcopy"><span class="eyebrow">MUSE</span><h1>Where talent meets the right brands.</h1><p>Build a profile, discover opportunities and manage collaborations in one place.</p><div class="authproof"><span>✦ Global talent discovery</span><span>✦ Campaigns & direct offers</span><span>✦ Deal rooms built in</span></div></div></div>'+
    '<section class="authcard"><div class="auth-tabs"><button class="auth-tab" id="loginTab">Sign in</button><button class="auth-tab" id="signupTab">Create account</button></div><div id="authFormHost"></div>'+demoPanel+'</section></section>'
  );
  const loginTab=document.getElementById('loginTab');
  const signupTab=document.getElementById('signupTab');
  const host=document.getElementById('authFormHost');
  async function finishAuth(path,data){
    const result=await api(path,{method:'POST',body:data});
    STATE.me=result.user;
    await refreshMarketplaceState();
    renderNav();
    location.hash=STATE.me.role==='admin'?'#/admin':(!STATE.me.onboardingComplete?'#/onboarding':'#/dashboard');
  }
  function paint(mode){
    loginTab.classList.toggle('active',mode==='login');
    signupTab.classList.toggle('active',mode==='signup');
    host.innerHTML=mode==='login'
      ?'<div class="auth-heading"><h2>Welcome back</h2><p class="muted">Sign in to continue to your workspace.</p></div><form id="authForm" class="auth-form"><label>Email<input name="email" type="email" required placeholder="you@example.com"></label><label>Password<input name="password" type="password" required placeholder="••••••••"></label><button class="primary full auth-submit">Sign in</button></form>'
      :'<div class="auth-heading"><h2>Create your account</h2><p class="muted">Choose how you want to use MUSE. You can update talent types later.</p></div><form id="authForm" class="auth-form"><div class="account-type-grid"><label class="account-type selected"><input type="radio" name="accountType" value="brand" checked><span class="account-icon">B</span><b>Brand</b><small>Find and hire talent</small></label><label class="account-type"><input type="radio" name="accountType" value="influencer"><span class="account-icon">I</span><b>Influencer</b><small>Find brand opportunities</small></label><label class="account-type"><input type="radio" name="accountType" value="model"><span class="account-icon">M</span><b>Model</b><small>Get booked for shoots</small></label></div><label>Name<input name="name" required maxlength="120" placeholder="Full name / Brand name"></label><label>Email<input name="email" type="email" required placeholder="you@example.com"></label><label>Password<input name="password" type="password" minlength="8" required placeholder="8+ characters"></label><button class="primary full auth-submit">Create account</button></form>';
    if(mode==='signup')document.querySelectorAll('.account-type').forEach(card=>card.addEventListener('click',()=>{
      document.querySelectorAll('.account-type').forEach(item=>item.classList.remove('selected'));
      card.classList.add('selected');
    }));
    document.getElementById('authForm').onsubmit=async event=>{
      event.preventDefault();
      const data=Object.fromEntries(new FormData(event.target));
      if(mode==='signup'){
        const type=data.accountType;
        data.role=type==='brand'?'brand':'talent';
        data.talentTypes=type==='brand'?[]:[type==='model'?'Model':'Influencer'];
        delete data.accountType;
      }
      try{await finishAuth(mode==='login'?'/api/login':'/api/signup',data)}catch(error){showToast(error.message)}
    };
  }
  loginTab.onclick=()=>paint('login');
  signupTab.onclick=()=>paint('signup');
  document.querySelectorAll('[data-demo-login]').forEach(button=>button.onclick=async()=>{
    try{await finishAuth('/api/login',{email:button.dataset.demoLogin,password:'demo1234'})}catch(error){showToast(error.message)}
  });
  paint(initial);
}
function notFound(){shell(`<section class="wrap section"><h2>Page not found.</h2><a href="#/">Back home</a></section>`)}
async function route(){window.scrollTo(0,0);const raw=location.hash.replace(/^#/,'')||'/';const [path,qs='']=raw.split('?');try{if(path==='/')return home();if(path==='/discover')return discover(qs);if(path==='/campaigns')return campaigns();if(path==='/campaigns/new')return newCampaign();if(path==='/dashboard')return dashboard();if(path==='/deals')return deals();if(path==='/messages')return messages();if(path==='/settings')return settings();if(path==='/onboarding')return onboarding();if(path==='/admin')return admin();if(path==='/auth')return auth(qs);let m;if((m=path.match(/^\/talent\/([^/]+)$/)))return talentProfile(m[1]);if((m=path.match(/^\/brand\/([^/]+)$/)))return brandProfile(m[1]);if((m=path.match(/^\/campaign\/([^/]+)$/)))return campaignDetail(m[1]);if((m=path.match(/^\/deal\/([^/]+)$/)))return dealRoom(m[1]);return notFound()}catch(err){console.error(err);shell(`<section class="wrap section"><h2>Something went wrong.</h2><p class="muted">${esc(err.message)}</p><a href="#/">Back home</a></section>`)} }
/* Boot is owned by simplified.js. */ Promise.resolve().catch(err=>{console.error(err);app.innerHTML=`<section class="wrap section"><h2>Could not connect to the MUSE server.</h2><p class="muted">Start the site with <code>python3 server.py</code>.</p></section>`})
