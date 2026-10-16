/* MUSE expansion: campaign marketplace, professional identity and teams.
   This layer intentionally keeps payments as tracking-only. */
(function(){
  function empty(text){return "<div class='empty'>"+esc(text)+"</div>";}
  function detail(value){return value?"<span class='detailchip'>"+esc(value)+"</span>":"";}
  function status(value){return "<span class='status'>"+esc(value||'Not set')+"</span>";}
  function audience(value){var n=Number(value||0);if(!n)return 'Not listed';if(n>=1000000)return (n/1000000).toFixed(1)+'M';if(n>=1000)return Math.round(n/1000)+'K';return n.toLocaleString();}
  function rating(person){var n=Number(person&&person.reviewCount||0),r=Number(person&&person.rating||0);return n?"<span class='rating'>★ "+r.toFixed(1)+" <small>("+n+")</small></span>":"<span class='rating rating-empty'>New on MUSE</span>";}
  function reliability(person){var score=person&&person.reliabilityScore;return score===null||score===undefined?"<span class='muted'>Building record</span>":"<b>"+esc(score)+"%</b> reliability";}
  function typeName(item){return item.opportunity_type||item.opportunityType||'Campaign';}
  function kindTag(item){var kind=typeName(item);return "<span class='tag type-"+esc(kind.toLowerCase())+"'>"+esc(kind)+"</span>";}
  function profileHref(person){return '#/'+(person.role==='brand'?'brand':'talent')+'/'+encodeURIComponent(person.id);}
  function emptyOption(label){return "<option value=''>"+esc(label)+"</option>";}
  function opportunityCard(c){
    return "<a class='campaignitem opportunity-card' href='#/campaign/"+encodeURIComponent(c.id)+"'><div class='brandlogo'>"+esc((c.brand_name||'M')[0])+"</div><div class='grow'><div class='split'><div><div class='inline-gap'>"+kindTag(c)+"<b>"+esc(c.name)+"</b></div><div class='mini'>"+esc(c.brand_name||'Brand')+" · "+esc([c.city,c.country].filter(Boolean).join(', ')||'Location flexible')+"</div></div><b>"+money(c.budget_min)+"–"+money(c.budget_max)+"</b></div><div class='tags'><span class='tag'>"+esc(c.category||'Creative')+"</span><span class='tag'>"+esc(c.talent_type||'Talent')+"</span>"+(c.visibility==='Invite Only'?"<span class='tag'>Private</span>":"<span class='tag'>Open</span>")+"</div></div></a>";
  }

  /* Keep the main navigation short, but surface the new workspaces once a
     person is signed in. */
  renderNav=function(){
    var u=STATE.me, profile=u?(u.role==='talent'?'#/talent/'+encodeURIComponent(u.id):u.role==='brand'?'#/brand/'+encodeURIComponent(u.id):'#/agency'):'';
    var signed='';
    if(u&&u.onboardingComplete){
      signed="<a href='#/for-you'>For You</a><a href='#/deals'>Deals</a><a href='#/messages'>Messages</a>";
      if(u.role==='brand')signed+="<a href='#/match'>MUSE Match</a><a href='#/collections'>Collections</a><a href='#/company'>Team</a>";
      if(u.role==='talent')signed+="<a href='#/jobs'>Jobs</a><a href='#/passport/"+encodeURIComponent(u.id)+"'>Passport</a><a href='#/media-kit/"+encodeURIComponent(u.id)+"'>Media kit</a>";
      if(u.role==='agency')signed="<a href='#/discover'>Discover</a><a href='#/agency'>Roster</a>";
      signed+="<a href='#/insights'>Insights</a>";
    }
    navlinks.innerHTML="<a href='#/discover'>Discover</a><a href='#/campaigns'>Campaigns</a><a href='#/map'>Map</a>"+signed+(u&&u.role==='admin'?"<a href='#/admin'>Admin</a>":'');
    navright.innerHTML=u?(u.role==='brand'&&u.onboardingComplete?"<a class='primary' href='#/campaigns/new'>+ Create</a>":'')+"<a class='iconbtn' href='"+profile+"' aria-label='Account'>"+esc((u.name||'U')[0])+"</a><button class='ghost small' id='logoutBtn'>Log out</button>":"<a class='navsignin' href='#/auth?mode=login'>Sign in</a><a class='primary' href='#/auth?mode=signup'>Join MUSE</a>";
    var logout=document.getElementById('logoutBtn');
    if(logout)logout.onclick=async function(){await api('/api/logout',{method:'POST'});STATE.me=null;STATE.notifications=[];renderNav();location.hash='#/';};
  };

  function opportunityHub(focus){
    var items=(STATE.campaigns||[]).filter(function(item){return !focus||typeName(item)===focus;});
    shell("<section class='wrap section opportunity-hub'><div class='sectionhead'><div><span class='eyebrow'>MUSE MARKETPLACE</span><h1>"+esc(focus?focus+' opportunities':'Campaigns, castings & jobs')+"</h1><p class='muted'>Public opportunities are open to qualified talent. Private castings only appear to the people invited.</p></div>"+(STATE.me&&STATE.me.role==='brand'?"<a class='primary' href='#/campaigns/new'>Create opportunity</a>":'')+"</div><div class='segmented'><a class='"+(!focus?'active':'')+"' href='#/campaigns'>All</a><a class='"+(focus==='Campaign'?'active':'')+"' href='#/campaigns?type=Campaign'>Campaigns</a><a class='"+(focus==='Casting'?'active':'')+"' href='#/campaigns?type=Casting'>Casting calls</a><a class='"+(focus==='Job'?'active':'')+"' href='#/jobs'>MUSE Jobs</a><a href='#/map'>Opportunity map</a></div><div class='campaignlist'>"+(items.map(opportunityCard).join('')||empty('No '+(focus?focus.toLowerCase()+' opportunities':'opportunities')+' yet.'))+"</div></section>");
  }
  campaigns=function(){var query=(location.hash.split('?')[1]||'');var focus=new URLSearchParams(query).get('type')||'';opportunityHub(focus);};
  function jobs(){opportunityHub('Job');}

  newCampaign=function(){
    if(!STATE.me||STATE.me.role!=='brand'){location.hash='#/auth?mode=signup';return;}
    var categories=['Fashion','Beauty','Lifestyle','Fitness','UGC','Food','Travel','Tech','Events'];
    shell("<section class='wrap narrow section'><span class='eyebrow'>BRAND WORKSPACE</span><h1>Create an opportunity</h1><p class='muted'>Use an open Casting to receive applications, or Invite Only for a private casting call.</p><form class='formcard rich-form' id='campaignForm'><label>Opportunity type<select name='opportunityType'><option>Campaign</option><option>Casting</option><option>Job</option></select></label><input name='name' required maxlength='140' placeholder='Opportunity title'><textarea name='description' required maxlength='3000' placeholder='Describe the creative direction, who is a fit and the work required.'></textarea><div class='twocol'><label>Talent needed<select name='talentType'><option>Influencer / Model / Content Creator</option><option>Influencer</option><option>Model</option><option>Content Creator</option><option>Photographer</option></select></label><label>Category<select name='category'>"+categories.map(function(x){return '<option>'+x+'</option>';}).join('')+"</select></label></div><div class='twocol'><label>Country<select name='country' id='campCountry'>"+countryOptions('United Arab Emirates')+"</select></label><label>City<select name='city' id='campCity'>"+cityOptions('United Arab Emirates','Dubai')+"</select></label></div><div class='twocol'><input name='platform' required placeholder='Platform / format, e.g. TikTok'><input name='deliverables' required placeholder='Deliverables, e.g. 2 reels + 5 photos'></div><div class='threecol'><input name='budgetMin' required type='number' min='1' placeholder='Minimum budget USD'><input name='budgetMax' required type='number' min='1' placeholder='Maximum budget USD'><input name='slots' required type='number' min='1' value='1' placeholder='People needed'></div><div class='twocol'><label>Deadline<input name='deadline' required type='date'></label><label>Visibility<select name='visibility'><option>Public</option><option>Invite Only</option></select></label></div><div class='form-divider'></div><h3>Usage rights</h3><p class='muted'>Clear rights keep the price and scope fair for both sides.</p><div class='twocol'><input name='usageRights' value='Organic social' placeholder='Usage, e.g. Organic social + ads'><input name='usageDuration' value='3 months' placeholder='Usage duration'></div><div class='twocol'><input name='territory' value='Campaign market' placeholder='Territory, e.g. Worldwide'><input name='exclusivity' value='None' placeholder='Exclusivity, e.g. Beauty 30 days'></div><input name='employmentType' placeholder='For Jobs: full-time, freelance, event day…'><button class='primary'>Publish opportunity</button></form></section>");
    var country=document.getElementById('campCountry'),city=document.getElementById('campCity');
    country.onchange=function(){city.innerHTML=cityOptions(country.value,'');};
    document.getElementById('campaignForm').onsubmit=async function(event){event.preventDefault();try{await api('/api/campaigns',{method:'POST',body:Object.fromEntries(new FormData(event.target))});await refreshMarketplaceState();showToast('Opportunity published');location.hash='#/campaigns';}catch(error){showToast(error.message);}};
  };

  campaignDetail=async function(id){
    var result=await api('/api/campaigns/'+encodeURIComponent(id));
    var c=result.campaign;if(!c)return notFound();
    var isBrand=STATE.me&&STATE.me.role==='brand';
    var extras=await Promise.all([api('/api/campaigns/'+encodeURIComponent(id)+'/team').catch(function(){return {members:[]};}),isBrand?api('/api/campaigns/'+encodeURIComponent(id)+'/applications').catch(function(){return {applications:[]};}):Promise.resolve({applications:[]})]);
    var team=extras[0].members||[],apps=extras[1].applications||[];
    var publicTeam=team.filter(function(x){return x.status==='Accepted';});
    var teamHtml=publicTeam.map(function(member){var p=member.talent;return "<a class='team-person' href='"+profileHref(p)+"'><span>"+esc((p.name||'M')[0])+"</span><div><b>"+esc(p.name)+"</b><small>"+esc(member.teamRole)+" · "+esc((p.talentTypes||[]).join(' · ')||'Talent')+"</small></div></a>";}).join('')||"<p class='muted'>The team will appear here once invitations are accepted.</p>";
    var apply=STATE.me&&STATE.me.role==='talent'?"<button class='primary full' id='applyBtn'>Apply / express interest</button>":STATE.me?"<p class='notice'>Talent accounts can apply to this opportunity.</p>":"<a class='primary full center' href='#/auth?mode=signup'>Join as Talent to apply</a>";
    var ownerTools=isBrand&&extras[0].isOwner?"<section class='box team-admin'><div class='sectionhead compact'><div><span class='eyebrow'>TEAM BUILDER</span><h3>Build this campaign team</h3></div><button class='ghost small' id='addTeamBtn'>+ Add talent</button></div><div class='application-list'>"+(apps.map(function(item){return "<div class='dealrow'><a class='grow' href='"+profileHref(item.talent)+"'><b>"+esc(item.talent.name)+"</b><div class='mini'>"+money(item.price)+" · "+rating(item.talent)+"</div><div class='mini'>"+esc(item.proposal||'')+"</div></a><button class='primary small' data-add-team='"+esc(item.talent.id)+"' data-team-name='"+esc(item.talent.name)+"'>Add to team</button></div>";}).join('')||"<p class='muted'>Applications will appear here. You can also add any public talent.</p>")+"</div></section>":'';
    shell("<section class='wrap campaignlayout expanded-campaign'><section><div class='inline-gap'>"+kindTag(c)+"<span class='eyebrow'>"+esc(c.visibility==='Invite Only'?'PRIVATE CASTING':'OPEN OPPORTUNITY')+"</span></div><h1 class='campaigntitle'>"+esc(c.name)+"</h1><p class='lead'>"+esc(c.description)+"</p><div class='box'><h3>Opportunity details</h3><div class='detailrow'>"+detail(c.talent_type)+detail(c.category)+detail([c.city,c.country].filter(Boolean).join(', '))+detail(c.platform)+"</div><p><b>Deliverables</b><br>"+esc(c.deliverables||'To be agreed')+"</p><p><b>Deadline</b><br>"+esc(c.deadline||'To be agreed')+"</p><p><b>People needed</b><br>"+esc(c.slots)+"</p></div><div class='box'><span class='eyebrow'>USAGE RIGHTS</span><div class='rights-grid'><div><span>Use</span><b>"+esc(c.usage_rights||'Organic social')+"</b></div><div><span>Duration</span><b>"+esc(c.usage_duration||'3 months')+"</b></div><div><span>Territory</span><b>"+esc(c.territory||'Campaign market')+"</b></div><div><span>Exclusivity</span><b>"+esc(c.exclusivity||'None')+"</b></div></div></div><section class='box'><div class='sectionhead compact'><div><span class='eyebrow'>TALENT TEAM</span><h3>People attached to this opportunity</h3></div><span class='mini'>"+publicTeam.length+" confirmed</span></div><div class='team-grid'>"+teamHtml+"</div></section>"+ownerTools+"</section><aside class='sidebarcta box'><div class='eyebrow'>BUDGET</div><div class='budget'>"+money(c.budget_min)+"–"+money(c.budget_max)+"</div><p class='muted'>Posted by <a href='#/brand/"+encodeURIComponent(c.brand_id)+"'>"+esc(c.brand_name||'Brand')+"</a></p><p class='muted'>"+(c.visibility==='Invite Only'?'This is a private casting for invited talent.':'Open applications are reviewed inside MUSE.')+"</p>"+apply+"</aside></section><div id='modalHost'></div>");
    var host=document.getElementById('modalHost');
    function teamModal(defaultId,defaultName){
      var choices=(STATE.talents||[]).map(function(p){return "<option value='"+esc(p.id)+"'"+(p.id===defaultId?' selected':'')+">"+esc(p.name)+" · "+esc([p.city,p.country].filter(Boolean).join(', '))+"</option>";}).join('');
      host.innerHTML="<div class='modalback'><form class='modal' id='teamForm'><span class='eyebrow'>TALENT TEAM</span><h2>Add "+esc(defaultName||'talent')+"</h2><label>Talent<select name='talentId'>"+choices+"</select></label><label>Role in this campaign<input name='teamRole' value='Creator' maxlength='80'></label><p class='muted'>They receive an invitation and choose whether to join the team.</p><button class='primary full'>Send team invitation</button><button type='button' class='ghost full' id='closeModal'>Cancel</button></form></div>";
      document.getElementById('closeModal').onclick=function(){host.innerHTML='';};
      document.getElementById('teamForm').onsubmit=async function(event){event.preventDefault();try{await api('/api/campaigns/'+encodeURIComponent(id)+'/team',{method:'POST',body:Object.fromEntries(new FormData(event.target))});host.innerHTML='';showToast('Team invitation sent');campaignDetail(id);}catch(error){showToast(error.message);}};
    }
    var add=document.getElementById('addTeamBtn');if(add)add.onclick=function(){teamModal('','');};
    Array.from(document.querySelectorAll('[data-add-team]')).forEach(function(button){button.onclick=function(){teamModal(button.dataset.addTeam,button.dataset.teamName);};});
    var applyButton=document.getElementById('applyBtn');
    if(applyButton)applyButton.onclick=function(){host.innerHTML="<div class='modalback'><form class='modal' id='applyForm'><span class='eyebrow'>APPLICATION</span><h2>Apply to "+esc(c.name)+"</h2><textarea name='proposal' required maxlength='3000' placeholder='Why are you the right fit?'></textarea><input name='price' required type='number' min='1' placeholder='Your price in USD'><button class='primary full'>Send application</button><button type='button' class='ghost full' id='closeModal'>Cancel</button></form></div>";document.getElementById('closeModal').onclick=function(){host.innerHTML='';};document.getElementById('applyForm').onsubmit=async function(event){event.preventDefault();try{await api('/api/campaigns/'+encodeURIComponent(id)+'/apply',{method:'POST',body:Object.fromEntries(new FormData(event.target))});host.innerHTML='';showToast('Application sent');}catch(error){showToast(error.message);}};};
  };

  async function matchPage(){
    if(!STATE.me||STATE.me.role!=='brand'){location.hash='#/auth?mode=signup';return;}
    var categories=['','Fashion','Beauty','Lifestyle','Fitness','UGC','Food','Travel','Tech','Events'];
    shell("<section class='wrap section match-page'><div class='sectionhead'><div><span class='eyebrow'>MUSE MATCH</span><h1>Find the strongest fits.</h1><p class='muted'>A transparent score using category, location, travel plans, availability, rate, verification and reviews — not hidden AI.</p></div></div><form class='match-form box' id='matchForm'><div class='twocol'><label>Talent type<select name='talentType'><option value=''>Any type</option><option>Influencer</option><option>Model</option><option>Content Creator</option></select></label><label>Category<select name='category'>"+categories.map(function(x){return "<option value='"+esc(x)+"'>"+(x||'Any category')+"</option>";}).join('')+"</select></label></div><div class='twocol'><label>Country<select name='country'>"+countryOptions(STATE.me.country||'')+"</select></label><label>City<select name='city'>"+cityOptions(STATE.me.country||'',STATE.me.city||'')+"</select></label></div><label>Maximum starting rate (USD)<input name='maxRate' min='0' type='number' placeholder='Optional'></label><button class='primary'>Find matches</button></form><div id='matchResults' class='match-results'>"+empty('Add campaign requirements to see MUSE Match results.')+"</div></section>");
    document.getElementById('matchForm').onsubmit=async function(event){event.preventDefault();var results=document.getElementById('matchResults');results.innerHTML=empty('Finding the best fits…');try{var output=await api('/api/match',{method:'POST',body:Object.fromEntries(new FormData(event.target))});results.innerHTML="<div class='sectionhead topgap'><div><span class='eyebrow'>TOP MATCHES</span><h2>"+output.matches.length+" people fit your brief</h2></div></div><div class='match-grid'>"+(output.matches.map(function(p){return "<article class='match-card'><a class='match-photo' href='"+profileHref(p)+"'"+(p.profilePhoto?" style=\"background-image:url('"+esc(p.profilePhoto)+"')\"":'')+">"+(p.profilePhoto?'':esc((p.name||'M')[0]))+"</a><div><div class='match-score'>"+esc(p.matchScore)+"% fit</div><h3>"+esc(p.name)+(p.verified?' <span class=\'verified\'>✓</span>':'')+"</h3><p class='mini'>"+esc((p.talentTypes||[]).join(' · '))+' · '+esc([p.city,p.country].filter(Boolean).join(', '))+"</p>"+rating(p)+"<div class='tags'>"+(p.matchReasons||[]).map(function(reason){return "<span class='tag'>"+esc(reason)+"</span>";}).join('')+"</div><a class='ghost small' href='"+profileHref(p)+"'>Open profile</a></div></article>";}).join('')||empty('No public talent matches this exact brief yet.'))+"</div>";}catch(error){results.innerHTML=empty(error.message);}};
  }

  async function passportPage(id){
    var result=await api('/api/passport/'+encodeURIComponent(id));var p=result.passport;if(!p)return notFound();
    var works=(p.workedCountries||[]).map(function(x){return '<span class=\'tag\'>'+esc(x)+'</span>';}).join('')||"<span class='muted'>Countries will appear as this professional record grows.</span>";
    shell("<section class='wrap section passport-page'><div class='passport-head box'><div class='passport-avatar'"+(p.profilePhoto?" style=\"background-image:url('"+esc(p.profilePhoto)+"')\"":'')+">"+(p.profilePhoto?'':esc((p.name||'M')[0]))+"</div><div class='grow'><span class='eyebrow'>MUSE PASSPORT</span><h1>"+esc(p.name)+(p.verified?' <span class=\'verified\'>✓</span>':'')+"</h1><p class='muted'>"+esc((p.talentTypes||[]).join(' · ')||'Talent')+' · '+esc([p.city,p.country].filter(Boolean).join(', '))+"</p>"+rating(p)+"</div><button class='ghost' id='sharePassport'>Copy passport link</button></div><div class='passport-grid'><article class='box'><span>VERIFICATION</span><b>"+(p.verificationBadges&&p.verificationBadges.length?esc(p.verificationBadges.join(' · ')):'In review / not requested')+"</b></article><article class='box'><span>COMPLETED DEALS</span><b>"+esc(p.completedDeals||0)+"</b></article><article class='box'><span>RELIABILITY</span><b>"+(p.reliabilityScore===null||p.reliabilityScore===undefined?'Building record':esc(p.reliabilityScore)+'%')+"</b></article><article class='box'><span>RATINGS</span><b>"+(p.reviewCount?esc(p.rating)+' / 5':'New on MUSE')+"</b></article></div><div class='box passport-body'><div class='sectionhead compact'><div><span class='eyebrow'>PROFESSIONAL IDENTITY</span><h2>Work passport</h2></div><a class='ghost small' href='#/talent/"+encodeURIComponent(p.id)+"'>View profile</a></div><p>"+esc(p.bio||'This professional is building their MUSE record.')+"</p><h3>Countries worked in</h3><div class='tags'>"+works+"</div><h3>Specialties</h3><div class='tags'>"+(p.categories||[]).map(function(x){return '<span class=\'tag\'>'+esc(x)+'</span>';}).join('')+"</div></div></section>");
    var share=document.getElementById('sharePassport');if(share)share.onclick=async function(){try{await navigator.clipboard.writeText(location.href);showToast('Passport link copied');}catch(error){showToast('Copy the link from your browser');}};
  }

  async function mediaKitPage(id){
    var result=await api('/api/passport/'+encodeURIComponent(id)),p=result.passport;if(!p)return notFound();
    var reach=(p.platforms||[]).reduce(function(total,item){return total+Number(item.followers||0);},0);
    var work=(p.portfolio||[]).slice(0,9).map(function(url){return "<div class='media-kit-work' style=\"background-image:url('"+esc(url)+"')\"></div>";}).join('')||"<div class='media-kit-empty'>Portfolio will appear here.</div>";
    var categories=(p.categories||[]).map(function(x){return '<span class=\'tag\'>'+esc(x)+'</span>';}).join('');
    var audienceRows=(p.platforms||[]).map(function(x){return "<div class='service'><span>"+esc(x.name)+"</span><b>"+Number(x.followers||0).toLocaleString()+"</b></div>";}).join('')||"<p class='muted'>Audience details not added.</p>";
    var serviceRows=(p.services||[]).map(function(x){return "<div class='service'><span>"+esc(x.name)+"</span><b>"+(Number(x.price||0)>0?money(x.price):'On request')+"</b></div>";}).join('')||"<p class='muted'>Services will appear here.</p>";
    shell("<section class='wrap section media-kit-page'><div class='media-kit-hero box'>"+(p.coverImage?"<div class='media-kit-cover' style=\"background-image:url('"+esc(p.coverImage)+"')\"></div>":'')+"<div class='media-kit-profile'><div class='passport-avatar'"+(p.profilePhoto?" style=\"background-image:url('"+esc(p.profilePhoto)+"')\"":'')+">"+(p.profilePhoto?'':esc((p.name||'M')[0]))+"</div><div class='grow'><span class='eyebrow'>MUSE MEDIA KIT</span><h1>"+esc(p.name)+(p.verified?' <span class=\'verified\'>✓</span>':'')+"</h1><p class='muted'>"+esc((p.talentTypes||[]).join(' · ')||'Talent')+' · '+esc([p.city,p.country].filter(Boolean).join(', '))+"</p>"+rating(p)+"</div><button class='ghost' id='shareMediaKit'>Copy media kit link</button></div></div><div class='media-kit-stats'><article class='box'><span>REACH</span><b>"+audience(reach)+"</b></article><article class='box'><span>STARTING RATE</span><b>"+(Number(p.startingRate||0)>0?money(p.startingRate):'On request')+"</b></article><article class='box'><span>RELIABILITY</span><b>"+(p.reliabilityScore===null||p.reliabilityScore===undefined?'Building record':esc(p.reliabilityScore)+'%')+"</b></article><article class='box'><span>COMPLETED</span><b>"+esc(p.completedDeals||0)+" deals</b></article></div><div class='media-kit-layout'><section class='box'><span class='eyebrow'>ABOUT</span><p class='lead small-lead'>"+esc(p.bio||'This creator is building their MUSE media kit.')+"</p><div class='tags'>"+categories+"</div><h3>Selected work</h3><div class='media-kit-grid'>"+work+"</div></section><aside class='media-kit-side'><section class='box'><span class='eyebrow'>AUDIENCE</span>"+audienceRows+"</section><section class='box'><span class='eyebrow'>SERVICES</span>"+serviceRows+"</section><section class='box'><span class='eyebrow'>CONTACT</span><p class='muted'>For protection, messages and offers stay inside MUSE.</p><a class='primary full center' href='#/talent/"+encodeURIComponent(p.id)+"'>Open MUSE profile</a></section></aside></div></section>");
    var share=document.getElementById('shareMediaKit');if(share)share.onclick=async function(){try{await navigator.clipboard.writeText(location.href);showToast('Media kit link copied');}catch(error){showToast('Copy the link from your browser');}};
  }

  async function collectionsPage(){
    if(!STATE.me||STATE.me.role!=='brand'){location.hash='#/auth';return;}
    var data=await api('/api/dashboard'),lists=data.shortlists||[];
    shell("<section class='wrap section'><div class='sectionhead'><div><span class='eyebrow'>SAVED TALENT</span><h1>Collections</h1><p class='muted'>Private lists shared by your company workspace.</p></div><a class='ghost' href='#/dashboard'>Workspace</a></div><div class='collection-grid'>"+(lists.map(function(list){return "<a class='collection-card' href='#/collection/"+encodeURIComponent(list.id)+"'><span class='eyebrow'>PRIVATE COLLECTION</span><h2>"+esc(list.name)+"</h2><p>"+list.talentIds.length+" saved talent</p><span>Open collection →</span></a>";}).join('')||empty('Create a shortlist from any talent profile.'))+"</div></section>");
  }

  function rateCalculator(){
    shell("<section class='wrap narrow section calculator-page'><span class='eyebrow'>MUSE TOOL</span><h1>Rate Calculator</h1><p class='muted'>A starting conversation range — always adjust for your creative value, licensing and scope.</p><form class='formcard' id='rateForm'><label>Followers / audience<input name='followers' type='number' min='0' value='50000'></label><label>Engagement rate (%)<input name='engagement' type='number' min='0' step='0.1' value='3'></label><label>Content pieces<input name='deliverables' type='number' min='1' value='1'></label><div class='twocol'><label>Usage rights<select name='usage'><option value='1'>Organic social only</option><option value='1.5'>Organic + brand website</option><option value='2.2'>Paid ads / broad usage</option></select></label><label>Exclusivity<select name='exclusivity'><option value='1'>No exclusivity</option><option value='1.25'>30-day category exclusivity</option><option value='1.6'>90-day category exclusivity</option></select></label></div><button class='primary'>Calculate range</button></form><div class='calculator-result box' id='rateResult'></div></section>");
    function calculate(){var f=new FormData(document.getElementById('rateForm')),followers=Number(f.get('followers')||0),engagement=Number(f.get('engagement')||0),pieces=Math.max(1,Number(f.get('deliverables')||1)),usage=Number(f.get('usage')||1),exclusive=Number(f.get('exclusivity')||1),base=Math.max(80,(followers/1000)*16*(1+Math.max(0,engagement-2)/20))*pieces*usage*exclusive,low=Math.round(base*.8/10)*10,high=Math.round(base*1.25/10)*10;document.getElementById('rateResult').innerHTML="<span class='eyebrow'>SUGGESTED STARTING RANGE</span><h2>"+money(low)+" – "+money(high)+"</h2><p>Based on audience, engagement, number of pieces, usage and exclusivity. Put the final amount and rights into the MUSE Deal Room.</p>";}
    document.getElementById('rateForm').oninput=calculate;document.getElementById('rateForm').onsubmit=function(event){event.preventDefault();calculate();};calculate();
  }

  async function insights(){
    if(!STATE.me){location.hash='#/auth';return;}
    var data=await api('/api/analytics');
    if(data.kind==='brand'){
      shell("<section class='wrap section insights-page'><span class='eyebrow'>BRAND ANALYTICS</span><h1>Campaign performance</h1><div class='metricgrid'><div class='metric'><span>Campaign views</span><b>"+data.campaignViews+"</b></div><div class='metric'><span>Applications</span><b>"+data.applications+"</b></div><div class='metric'><span>Active opportunities</span><b>"+data.activeCampaigns+"</b></div><div class='metric'><span>Deal rooms</span><b>"+data.deals+"</b></div></div><section class='box topgap'><div class='sectionhead compact'><div><span class='eyebrow'>BY OPPORTUNITY</span><h2>What is getting attention</h2></div></div><div class='analytics-list'>"+(data.campaigns.map(function(c){return "<a class='dealrow' href='#/campaign/"+encodeURIComponent(c.id)+"'><div><b>"+esc(c.name)+"</b><div class='mini'>"+esc(c.type)+" · "+esc(c.status)+"</div></div><div class='inline-gap'><span>"+c.views+" views</span><span>"+c.applications+" applications</span><span>"+c.teamMembers+" team</span></div></a>";}).join('')||empty('Create an opportunity to see campaign analytics.'))+"</div></section></section>");return;
    }
    if(data.kind==='talent'){
      var r=data.reliability||{};
      shell("<section class='wrap section insights-page'><span class='eyebrow'>CREATOR ANALYTICS</span><h1>Your MUSE presence</h1><div class='metricgrid'><div class='metric'><span>Profile views</span><b>"+data.profileViews+"</b></div><div class='metric'><span>Search appearances</span><b>"+data.searchAppearances+"</b></div><div class='metric'><span>Saved by brands</span><b>"+data.savedByBrands+"</b></div><div class='metric'><span>Connections</span><b>"+data.connections+"</b></div></div><div class='dashgrid topgap'><section class='box'><span class='eyebrow'>DEAL RECORD</span><h2>"+(r.reliabilityScore===null||r.reliabilityScore===undefined?'Building reliability':esc(r.reliabilityScore)+'% reliability')+"</h2><p class='muted'>"+esc(r.completedDeals||0)+" completed deals · "+esc(r.selfCancelledDeals||0)+" cancellations initiated by you.</p></section><section class='box'><span class='eyebrow'>NEXT STEP</span><h3>Make your profile easier to choose.</h3><p class='muted'>Keep your travel dates, availability, portfolio and rates current so brands can find a confident fit.</p><a class='primary small' href='#/settings'>Update profile</a></section></div></section>");return;
    }
    shell("<section class='wrap section'><h1>Insights</h1>"+empty('Insights will appear as your workspace becomes active.')+"</section>");
  }

  async function opportunityMap(){
    var result=await api('/api/opportunity-map'),items=result.opportunities||[];
    shell("<section class='wrap section map-page'><div class='sectionhead'><div><span class='eyebrow'>MUSE OPPORTUNITY MAP</span><h1>Where work is happening.</h1><p class='muted'>A live location board for open campaigns, castings and jobs.</p></div><a class='ghost' href='#/campaigns'>Browse all</a></div><div class='map-grid'>"+(items.map(function(item){return "<a class='map-pin-card' href='#/campaigns?type="+encodeURIComponent(item.type)+"'><span class='map-dot'></span><div><b>"+esc(item.city)+", "+esc(item.country)+"</b><small>"+esc(item.type)+" · "+item.count+" open</small></div><strong>"+item.count+"</strong></a>";}).join('')||empty('No public opportunities are pinned yet.'))+"</div></section>");
  }

  async function collectionPage(id){
    if(!STATE.me||STATE.me.role!=='brand'){location.hash='#/auth';return;}
    var data=await api('/api/shortlists/'+encodeURIComponent(id));
    shell("<section class='wrap section'><div class='sectionhead'><div><span class='eyebrow'>SAVED TALENT</span><h1>"+esc(data.collection.name)+"</h1><p class='muted'>A private collection for your brand workspace.</p></div><a class='ghost' href='#/dashboard'>Back to workspace</a></div><div class='cards'>"+(data.talents.map(talentCard).join('')||empty('This collection has no saved talent yet.'))+"</div></section>");
  }

  async function companyWorkspace(){
    if(!STATE.me||STATE.me.role!=='brand'){location.hash='#/auth';return;}
    var data=await api('/api/company');
    shell("<section class='wrap section company-page'><div class='sectionhead'><div><span class='eyebrow'>COMPANY TEAM</span><h1>"+esc(data.brandName)+" workspace</h1><p class='muted'>Invite people to manage one shared brand workspace with their own login.</p></div><a class='ghost' href='#/dashboard'>Workspace</a></div><div class='dashgrid'><section class='box'><span class='eyebrow'>TEAM MEMBERS</span><div class='team-list'>"+(data.members.map(function(m){return "<div class='dealrow'><div><b>"+esc(m.name||m.email)+"</b><div class='mini'>"+esc(m.role)+" · "+esc(m.status)+"</div></div></div>";}).join('')||empty('No extra team members yet.'))+"</div></section><section class='box'><span class='eyebrow'>INVITE TEAM MEMBER</span><h3>Give access without sharing a password.</h3><form class='stack-form' id='companyInviteForm'><input type='email' name='email' required placeholder='work@email.com'><select name='role'><option>Manager</option><option>Viewer</option><option>Owner</option></select><button class='primary'>Send workspace invitation</button></form><p class='muted'>If they do not have a MUSE Brand account yet, they can create one using this email and accept the invitation.</p></section></div></section>");
    document.getElementById('companyInviteForm').onsubmit=async function(event){event.preventDefault();try{await api('/api/company/invite',{method:'POST',body:Object.fromEntries(new FormData(event.target))});showToast('Workspace invitation created');companyWorkspace();}catch(error){showToast(error.message);}};
  }

  async function agencyWorkspace(){
    if(!STATE.me||STATE.me.role!=='agency'){location.hash='#/auth?mode=signup';return;}
    var data=await api('/api/agency'),roster=data.roster||[];
    shell("<section class='wrap section agency-page'><div class='sectionhead'><div><span class='eyebrow'>AGENCY ACCOUNT</span><h1>"+esc(STATE.me.name)+" roster</h1><p class='muted'>Invite talent from public MUSE profiles. Each person controls whether they join your roster.</p></div><a class='primary' href='#/discover'>Find talent</a></div><div class='metricgrid'><div class='metric'><span>Roster</span><b>"+roster.filter(function(x){return x.status==='Accepted';}).length+"</b></div><div class='metric'><span>Invitations</span><b>"+roster.filter(function(x){return x.status==='Invited';}).length+"</b></div><div class='metric'><span>Public profiles</span><b>"+(STATE.talents||[]).length+"</b></div><div class='metric'><span>Deals</span><b>Managed in MUSE</b></div></div><div class='campaignlist topgap'>"+(roster.map(function(r){return "<a class='dealrow' href='#/talent/"+encodeURIComponent(r.talentId)+"'><div><b>"+esc(r.name)+"</b><div class='mini'>"+esc((r.role||[]).join(' · ')||'Talent')+" · "+esc([r.city,r.country].filter(Boolean).join(', '))+"</div></div>"+status(r.status)+"</a>";}).join('')||empty('Your roster is empty. Open any talent profile to invite them.'))+"</div></section>");
  }

  /* Analytics and incoming team invitations extend the existing dashboard
     instead of replacing the core offers/deals workspace. */
  var baseDashboard=dashboard;
  dashboard=async function(){
    if(STATE.me&&STATE.me.role==='agency')return agencyWorkspace();
    await baseDashboard();
    if(!STATE.me||STATE.me.role==='admin')return;
    var root=document.querySelector('main > .wrap.section');if(!root)return;
    var requests=[api('/api/analytics')];
    if(STATE.me.role==='brand')requests.push(api('/api/company-invites').catch(function(){return {invites:[]};}));
    var results=await Promise.all(requests),stats=results[0],more=results[1]||{};
    var html="<section class='feature-dashboard topgap'><div class='sectionhead'><div><span class='eyebrow'>MUSE TOOLS</span><h2>"+(STATE.me.role==='brand'?'Plan & measure':'Build your professional record')+"</h2></div><a class='ghost small' href='#/insights'>Full insights</a></div>";
    if(STATE.me.role==='brand'){
      html+="<div class='feature-action-grid'><a class='tool-card' href='#/match'><b>MUSE Match</b><span>Find the best fit for a brief</span></a><a class='tool-card' href='#/collections'><b>Collections</b><span>Organize saved talent</span></a><a class='tool-card' href='#/company'><b>Company Team</b><span>Invite collaborators securely</span></a><a class='tool-card' href='#/map'><b>Opportunity Map</b><span>See active markets</span></a><a class='tool-card' href='#/campaigns/new'><b>Create casting</b><span>Open or private</span></a></div>";
      if((more.invites||[]).length)html+="<div class='box topgap'><span class='eyebrow'>WORKSPACE INVITATIONS</span>"+more.invites.map(function(x){return "<div class='dealrow'><div><b>"+esc(x.brand_name)+"</b><div class='mini'>"+esc(x.member_role)+" access</div></div><div class='inline'><button class='ghost small' data-company-invite='"+esc(x.id)+"' data-company-status='Declined'>Decline</button><button class='primary small' data-company-invite='"+esc(x.id)+"' data-company-status='Accepted'>Accept</button></div></div>";}).join('')+"</div>";
    }else{
      var dash=await api('/api/dashboard'),team=dash.teamInvites||[],agency=dash.agencyInvites||[];
      html+="<div class='feature-action-grid'><a class='tool-card' href='#/passport/"+encodeURIComponent(STATE.me.id)+"'><b>MUSE Passport</b><span>Share your professional record</span></a><a class='tool-card' href='#/media-kit/"+encodeURIComponent(STATE.me.id)+"'><b>Media Kit</b><span>Share work, reach and rates</span></a><a class='tool-card' href='#/rate-calculator'><b>Rate Calculator</b><span>Set a better starting rate</span></a><a class='tool-card' href='#/jobs'><b>MUSE Jobs</b><span>Browse professional roles</span></a><a class='tool-card' href='#/settings'><b>Travel & availability</b><span>Stay easy to book</span></a></div>";
      if(team.length)html+="<div class='box topgap'><span class='eyebrow'>TEAM INVITATIONS</span>"+team.map(function(x){return "<div class='dealrow'><div><b>"+esc(x.campaign_name)+"</b><div class='mini'>"+esc(x.brand_name)+" · "+esc(x.team_role)+"</div></div>"+(x.status==='Invited'?"<div class='inline'><button class='ghost small' data-team-invite='"+esc(x.id)+"' data-team-status='Declined'>Decline</button><button class='primary small' data-team-invite='"+esc(x.id)+"' data-team-status='Accepted'>Join team</button></div>":status(x.status))+"</div>";}).join('')+"</div>";
      if(agency.length)html+="<div class='box topgap'><span class='eyebrow'>AGENCY INVITATIONS</span>"+agency.map(function(x){return "<div class='dealrow'><div><b>"+esc(x.agency_name)+"</b><div class='mini'>Agency roster invitation</div></div>"+(x.status==='Invited'?"<div class='inline'><button class='ghost small' data-agency-invite='"+esc(x.id)+"' data-agency-status='Declined'>Decline</button><button class='primary small' data-agency-invite='"+esc(x.id)+"' data-agency-status='Accepted'>Accept</button></div>":status(x.status))+"</div>";}).join('')+"</div>";
    }
    html+='</section>';root.insertAdjacentHTML('beforeend',html);
    Array.from(document.querySelectorAll('[data-company-invite]')).forEach(function(button){button.onclick=async function(){try{await api('/api/company-members/'+encodeURIComponent(button.dataset.companyInvite)+'/respond',{method:'POST',body:{status:button.dataset.companyStatus}});showToast('Workspace invitation '+button.dataset.companyStatus.toLowerCase());dashboard();}catch(error){showToast(error.message);}};});
    Array.from(document.querySelectorAll('[data-team-invite]')).forEach(function(button){button.onclick=async function(){try{await api('/api/campaign-team/'+encodeURIComponent(button.dataset.teamInvite)+'/respond',{method:'POST',body:{status:button.dataset.teamStatus}});showToast('Team invitation '+button.dataset.teamStatus.toLowerCase());dashboard();}catch(error){showToast(error.message);}};});
    Array.from(document.querySelectorAll('[data-agency-invite]')).forEach(function(button){button.onclick=async function(){try{await api('/api/agency-roster/'+encodeURIComponent(button.dataset.agencyInvite)+'/respond',{method:'POST',body:{status:button.dataset.agencyStatus}});showToast('Agency invitation '+button.dataset.agencyStatus.toLowerCase());dashboard();}catch(error){showToast(error.message);}};});
  };

  function scheduleHtml(entries){
    return (entries||[]).slice(0,10).map(function(item){return "<div class='schedule-row'><b>"+esc(item.date)+"</b>"+status(item.status)+"</div>";}).join('')||"<p class='muted'>No calendar dates added yet.</p>";
  }
  function travelHtml(entries){
    return (entries||[]).map(function(item){return "<div class='travel-row'><div><b>"+esc(item.city)+", "+esc(item.country)+"</b><small>"+esc(item.startDate)+" → "+esc(item.endDate)+(item.note?' · '+esc(item.note):'')+"</small></div><span>✈</span></div>";}).join('')||"<p class='muted'>No travel mode dates are live.</p>";
  }

  /* Profiles become a professional social presence: selected work, a clear
     passport, availability and travel plans are all visible in one place. */
  var baseTalentProfile=talentProfile;
  talentProfile=async function(id){
    await baseTalentProfile(id);
    var result=await api('/api/talents/'+encodeURIComponent(id));var p=result.talent;if(!p)return;
    var column=document.querySelector('.profilegrid > section');
    if(!column)return;
    column.insertAdjacentHTML('beforeend',"<section class='box profile-professional'><div class='sectionhead compact'><div><span class='eyebrow'>MUSE PASSPORT</span><h3>Professional record</h3></div><a class='ghost small' href='#/passport/"+encodeURIComponent(p.id)+"'>Open passport</a></div><div class='passport-mini-grid'><div><span>Verification</span><b>"+(p.verificationBadges&&p.verificationBadges.length?esc(p.verificationBadges.join(' · ')):'Not verified yet')+"</b></div><div><span>Reliability</span><b>"+(p.reliabilityScore===null||p.reliabilityScore===undefined?'Building record':esc(p.reliabilityScore)+'%')+"</b></div><div><span>Completed</span><b>"+esc(p.completedDeals||0)+" deals</b></div></div></section><section class='box profile-professional'><div class='sectionhead compact'><div><span class='eyebrow'>AVAILABILITY</span><h3>Booking calendar</h3></div></div>"+scheduleHtml(p.availabilityCalendar)+"</section><section class='box profile-professional'><div class='sectionhead compact'><div><span class='eyebrow'>TRAVEL MODE</span><h3>Upcoming locations</h3></div></div>"+travelHtml(p.travelPlans)+"</section>");
    var actions=document.querySelector('.profilecard .actions');
    if(actions){
      var mediaKitHref='#/media-kit/'+encodeURIComponent(p.id);
      var mediaKitLinks=Array.from(actions.querySelectorAll('a')).filter(function(link){return link.getAttribute('href')===mediaKitHref;});
      mediaKitLinks.slice(1).forEach(function(link){link.remove();});
      if(!mediaKitLinks.length)actions.insertAdjacentHTML('beforeend',"<a class='ghost' href='"+mediaKitHref+"'>Media kit</a>");
    }
    if(actions&&STATE.me&&STATE.me.role==='agency'&&STATE.me.id!==p.id){actions.insertAdjacentHTML('beforeend',"<button class='primary' id='agencyInviteBtn'>Add to roster</button>");var invite=document.getElementById('agencyInviteBtn');invite.onclick=async function(){try{await api('/api/agency/roster',{method:'POST',body:{talentId:p.id}});showToast('Agency invitation sent');invite.disabled=true;invite.textContent='Invitation sent';}catch(error){showToast(error.message);}};}
    var offerButton=document.getElementById('offerBtn');
    if(offerButton&&STATE.me&&STATE.me.role==='brand')offerButton.onclick=function(){openEnhancedOffer(p);};
  };

  function openEnhancedOffer(talent){
    var host=document.getElementById('modalHost');if(!host)return;
    host.innerHTML="<div class='modalback'><form class='modal' id='enhancedOfferForm'><span class='eyebrow'>MUSE DEAL OFFER</span><h2>Set the scope clearly.</h2><input name='title' required maxlength='160' placeholder='Offer title'><textarea name='details' required maxlength='3000' placeholder='Job details'></textarea><input name='deliverables' required maxlength='1200' placeholder='Deliverables'><div class='twocol'><input name='date' type='date' required><input name='price' type='number' min='1' required placeholder='Offered price USD'></div><div class='form-divider'></div><h3>Usage rights</h3><input name='usageRights' value='Organic social' placeholder='Usage rights'><div class='twocol'><input name='usageDuration' value='3 months' placeholder='Usage duration'><input name='territory' value='Campaign market' placeholder='Territory'></div><input name='exclusivity' value='None' placeholder='Exclusivity'><label class='deal-terms-check'><input type='checkbox' name='agreeToTerms' required> I confirm the scope and rights are accurate and this work stays in MUSE.</label><button class='primary full'>Send offer</button><button type='button' class='ghost full' id='closeModal'>Cancel</button></form></div>";
    document.getElementById('closeModal').onclick=function(){host.innerHTML='';};
    document.getElementById('enhancedOfferForm').onsubmit=async function(event){event.preventDefault();var data=Object.fromEntries(new FormData(event.target));data.talentId=talent.id;data.agreeToTerms=data.agreeToTerms==='on';try{await api('/api/offers',{method:'POST',body:data});host.innerHTML='';showToast('Offer sent with usage rights');}catch(error){showToast(error.message);}};
  }

  function availabilityEditor(user){
    var entries=(user.availabilityCalendar||[]).map(function(x){return {date:x.date,status:x.status};});
    var travel=(user.travelPlans||[]).map(function(x){return {country:x.country,city:x.city,startDate:x.startDate,endDate:x.endDate,note:x.note||''};});
    var form=document.getElementById('settingsForm');if(!form)return;
    var submit=form.querySelector('button.primary:last-of-type');
    var html="<div class='form-divider muse-extra-divider'></div><section class='settings-extra'><div class='sectionhead compact'><div><span class='eyebrow'>AVAILABILITY CALENDAR</span><h3>Tell brands when you can work.</h3></div></div><div class='calendar-add'><input type='date' id='availabilityDate'><select id='availabilityStatus'><option>Available</option><option>Tentative</option><option>Booked</option></select><button type='button' class='ghost small' id='addAvailability'>Add date</button></div><div id='availabilityList' class='schedule-list'></div></section><section class='settings-extra'><div class='sectionhead compact'><div><span class='eyebrow'>TRAVEL MODE</span><h3>Appear in cities you are visiting.</h3></div></div><div class='travel-add'><select id='travelCountry'>"+countryOptions('')+"</select><select id='travelCity'>"+cityOptions('','')+"</select><input type='date' id='travelStart'><input type='date' id='travelEnd'><input maxlength='120' id='travelNote' placeholder='Optional note'><button type='button' class='ghost small' id='addTravel'>Add trip</button></div><div id='travelList' class='travel-list'></div></section><section class='settings-extra'><span class='eyebrow'>MUSE PASSPORT</span><h3>Countries worked in</h3><input id='workedCountries' value='"+esc((user.workedCountries||[]).join(', '))+"' placeholder='e.g. Norway, Monaco, Japan'></section><section class='settings-extra'><div class='sectionhead compact'><div><span class='eyebrow'>VERIFICATION</span><h3>Build trust with a verified profile.</h3></div></div><div id='verificationRequests'></div><form class='inline-form' id='verificationForm'><select name='kind'><option>Identity</option><option>Audience</option><option>Agency</option><option>Company</option></select><input name='note' maxlength='800' placeholder='Optional note for MUSE review'><button class='ghost small'>Request verification</button></form></section>";
    if(submit)submit.insertAdjacentHTML('beforebegin',html);else form.insertAdjacentHTML('beforeend',html);
    function renderAvailability(){var target=document.getElementById('availabilityList');target.innerHTML=entries.map(function(item,index){return "<div class='schedule-row'><b>"+esc(item.date)+"</b>"+status(item.status)+"<button class='textbtn' type='button' data-remove-availability='"+index+"'>Remove</button></div>";}).join('')||"<p class='muted'>Add individual days as Available, Tentative or Booked.</p>";Array.from(target.querySelectorAll('[data-remove-availability]')).forEach(function(button){button.onclick=function(){entries.splice(Number(button.dataset.removeAvailability),1);renderAvailability();};});}
    function renderTravel(){var target=document.getElementById('travelList');target.innerHTML=travel.map(function(item,index){return "<div class='travel-row'><div><b>"+esc(item.city)+", "+esc(item.country)+"</b><small>"+esc(item.startDate)+" → "+esc(item.endDate)+(item.note?' · '+esc(item.note):'')+"</small></div><button class='textbtn' type='button' data-remove-travel='"+index+"'>Remove</button></div>";}).join('')||"<p class='muted'>Add trips so relevant brands can find you in their city.</p>";Array.from(target.querySelectorAll('[data-remove-travel]')).forEach(function(button){button.onclick=function(){travel.splice(Number(button.dataset.removeTravel),1);renderTravel();};});}
    renderAvailability();renderTravel();
    document.getElementById('addAvailability').onclick=function(){var date=document.getElementById('availabilityDate').value,kind=document.getElementById('availabilityStatus').value;if(!date){showToast('Choose a date first');return;}entries=entries.filter(function(item){return item.date!==date;});entries.push({date:date,status:kind});entries.sort(function(a,b){return a.date.localeCompare(b.date);});renderAvailability();};
    var country=document.getElementById('travelCountry'),city=document.getElementById('travelCity');country.onchange=function(){city.innerHTML=cityOptions(country.value,'');};
    document.getElementById('addTravel').onclick=function(){var start=document.getElementById('travelStart').value,end=document.getElementById('travelEnd').value;if(!country.value||!city.value||!start||!end||end<start){showToast('Add city and valid travel dates');return;}travel.push({country:country.value,city:city.value,startDate:start,endDate:end,note:document.getElementById('travelNote').value});renderTravel();};
    async function renderVerification(){var holder=document.getElementById('verificationRequests');try{var result=await api('/api/verification-requests');holder.innerHTML=(result.requests||[]).map(function(item){return "<div class='schedule-row'><b>"+esc(item.kind)+" verification</b>"+status(item.status)+"</div>";}).join('')||"<p class='muted'>No verification requests yet.</p>";}catch(error){holder.innerHTML='';}}
    renderVerification();document.getElementById('verificationForm').onsubmit=async function(event){event.preventDefault();try{await api('/api/verification-requests',{method:'POST',body:Object.fromEntries(new FormData(event.target))});showToast('Verification request sent');event.target.reset();renderVerification();}catch(error){showToast(error.message);}};
    var baseSubmit=form.onsubmit;
    form.onsubmit=async function(event){if(baseSubmit)await baseSubmit.call(form,event);try{var worked=document.getElementById('workedCountries').value.split(',').map(function(x){return x.trim();}).filter(Boolean).slice(0,30);var result=await api('/api/me',{method:'PATCH',body:{availabilityCalendar:entries,travelPlans:travel,workedCountries:worked}});STATE.me=result.user;renderNav();showToast('Calendar, travel mode and passport saved');}catch(error){showToast(error.message);}};
  }

  function agencySettings(){
    var u=STATE.me;
    shell("<section class='wrap narrow section'><span class='eyebrow'>AGENCY SETTINGS</span><h1>Build your agency profile.</h1><form class='formcard' id='agencySettingsForm'><input name='name' required maxlength='120' value='"+esc(u.name)+"' placeholder='Agency name'><textarea name='bio' maxlength='500' placeholder='What does your agency represent?'>"+esc(u.bio||'')+"</textarea><div class='twocol'><select name='country' id='agencyCountry'>"+countryOptions(u.country||'')+"</select><select name='city' id='agencyCity'>"+cityOptions(u.country||'',u.city||'')+"</select></div><input name='agencySpecialties' value='"+esc((u.agencySpecialties||[]).join(', '))+"' placeholder='Specialties, e.g. Fashion, Beauty'><label class='visibility-card'><span>Finish and activate this account</span><select name='profileVisibility'><option>Private</option><option>Public</option></select></label><button class='primary'>Save agency profile</button></form></section>");
    var country=document.getElementById('agencyCountry'),city=document.getElementById('agencyCity');country.onchange=function(){city.innerHTML=cityOptions(country.value,'');};
    document.getElementById('agencySettingsForm').onsubmit=async function(event){event.preventDefault();var data=Object.fromEntries(new FormData(event.target));data.agencySpecialties=(data.agencySpecialties||'').split(',').map(function(x){return x.trim();}).filter(Boolean);data.onboardingComplete=true;try{var result=await api('/api/me',{method:'PATCH',body:data});STATE.me=result.user;renderNav();showToast('Agency profile saved');location.hash='#/agency';}catch(error){showToast(error.message);}};
  }

  var baseSettings=settings;
  settings=async function(){
    if(STATE.me&&STATE.me.role==='agency')return agencySettings();
    await baseSettings();
    if(STATE.me)availabilityEditor(STATE.me);
  };

  var baseDiscover=discover;
  discover=function(query){
    baseDiscover(query);
    if(!STATE.me)return;
    setTimeout(function(){var ids=Array.from(document.querySelectorAll(".talent-card a[href*='#/talent/']")).map(function(link){return (link.getAttribute('href').split('/').pop()||'').trim();}).filter(Boolean);if(ids.length)api('/api/analytics/impressions',{method:'POST',body:{profileIds:ids,context:'discover'}}).catch(function(){});},0);
  };

  function wireAgencySignup(){
    var host=document.getElementById('authFormHost');if(!host)return;
    var grid=host.querySelector('.account-type-grid');if(!grid)return;
    if(!grid.querySelector("input[value='agency']"))grid.insertAdjacentHTML('beforeend',"<label class='account-type'><input type='radio' name='accountType' value='agency'><span class='account-icon'>A</span><b>Agency</b><small>Manage talent rosters</small></label>");
    Array.from(grid.querySelectorAll('.account-type')).forEach(function(card){card.onclick=function(){Array.from(grid.querySelectorAll('.account-type')).forEach(function(item){item.classList.remove('selected');});card.classList.add('selected');};});
    var form=host.querySelector('form#authForm');if(!form||form.dataset.agencyWired)return;
    form.dataset.agencyWired='1';
    form.onsubmit=async function(event){
      event.preventDefault();var data=Object.fromEntries(new FormData(form));var type=data.accountType;
      data.role=type==='brand'?'brand':type==='agency'?'agency':'talent';
      data.talentTypes=data.role==='talent'?[type==='model'?'Model':type==='creator'?'Content Creator':'Influencer']:[];delete data.accountType;
      try{var result=await api('/api/signup',{method:'POST',body:data});STATE.me=result.user;await refreshMarketplaceState();renderNav();location.hash=STATE.me.role==='agency'?'#/onboarding':(STATE.me.onboardingComplete?'#/dashboard':'#/onboarding');}catch(error){showToast(error.message);}
    };
  }
  var baseAuth=auth;
  auth=function(query){
    baseAuth(query);
    setTimeout(function(){wireAgencySignup();var host=document.getElementById('authFormHost');if(host&&!host.dataset.agencyObserver){host.dataset.agencyObserver='1';new MutationObserver(function(){wireAgencySignup();}).observe(host,{childList:true,subtree:true});}},0);
  };

  var baseOnboarding=onboarding;
  onboarding=async function(){
    if(STATE.me&&STATE.me.role==='agency')return agencySettings();
    return baseOnboarding();
  };

  var baseAdmin=admin;
  admin=async function(){
    await baseAdmin();
    if(!STATE.me||STATE.me.role!=='admin')return;
    var root=document.querySelector('main > .wrap.section');if(!root)return;
    try{
      var data=await api('/api/admin/verification-requests'),requests=data.requests||[];
      root.insertAdjacentHTML('beforeend',"<section class='box topgap'><div class='sectionhead compact'><div><span class='eyebrow'>TRUST & VERIFICATION</span><h2>Pending requests</h2></div></div>"+(requests.map(function(r){return "<div class='dealrow'><div><b>"+esc(r.user_name)+"</b><div class='mini'>"+esc(r.kind)+" · "+esc(r.user_email)+"</div>"+(r.note?"<div class='mini'>"+esc(r.note)+"</div>":'')+"</div><div class='inline'><button class='ghost small' data-verify-request='"+esc(r.id)+"' data-verify-status='Rejected'>Reject</button><button class='primary small' data-verify-request='"+esc(r.id)+"' data-verify-status='Approved'>Approve</button></div></div>";}).join('')||empty('No verification requests waiting for review.'))+"</section>");
      Array.from(document.querySelectorAll('[data-verify-request]')).forEach(function(button){button.onclick=async function(){try{await api('/api/admin/verification-requests/'+encodeURIComponent(button.dataset.verifyRequest)+'/respond',{method:'POST',body:{status:button.dataset.verifyStatus}});showToast('Verification '+button.dataset.verifyStatus.toLowerCase());admin();}catch(error){showToast(error.message);}};});
    }catch(error){}
  };

  var legacyRoute=route;
  route=async function(){
    var raw=location.hash.replace(/^#/,'')||'/',parts=raw.split('?'),path=parts[0];
    try{
      if(path==='/match')return matchPage();
      if(path==='/jobs')return jobs();
      if(path==='/map')return opportunityMap();
      if(path==='/rate-calculator')return rateCalculator();
      if(path==='/insights')return insights();
      if(path==='/company')return companyWorkspace();
      if(path==='/agency')return agencyWorkspace();
      if(path==='/collections')return collectionsPage();
      var pass=path.match(/^\/passport\/([^/]+)$/);if(pass)return passportPage(pass[1]);
      var kit=path.match(/^\/media-kit\/([^/]+)$/);if(kit)return mediaKitPage(kit[1]);
      var collection=path.match(/^\/collection\/([^/]+)$/);if(collection)return collectionPage(collection[1]);
      return legacyRoute();
    }catch(error){console.error(error);shell("<section class='wrap section'><h2>Something went wrong.</h2><p class='muted'>"+esc(error.message)+"</p><a href='#/'>Back home</a></section>");}
  };

  function startExpansion(){
    if(STATE.meta){renderNav();route();return;}
    setTimeout(startExpansion,30);
  }

})();
