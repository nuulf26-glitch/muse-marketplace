/* MUSE production experience. Loaded after the original V1 script. */
(function(){
  function pEmpty(text, extra){
    return "<div class='empty "+(extra||"")+"'>"+esc(text)+"</div>";
  }
  function pAudience(value){
    var n=Number(value||0);
    if(!n)return "";
    if(n>=1000000)return (n/1000000).toFixed(n%1000000?1:0)+"M";
    if(n>=1000)return Math.round(n/1000)+"K";
    return n.toLocaleString();
  }
  function pPhotoAttr(user){
    if(user.profilePhoto){
      return "class='photo profile-photo-img' style=\"background-image:url('"+esc(user.profilePhoto)+"')\"";
    }
    return "class='photo photo-empty'";
  }
  function pDate(value){
    if(!value)return "";
    var date=new Date(value);
    return isNaN(date.getTime())?esc(value):date.toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"});
  }
  function pPortfolio(items, emptyText){
    items=items||[];
    if(!items.length)return pEmpty(emptyText,"profile-empty-state");
    return items.map(function(item){
      var image=typeof item==="string"?item:item&&item.url;
      return image?"<div class='shot profile-shot' style=\"background-image:url('"+esc(image)+"')\"></div>":"";
    }).join("");
  }
  function pGallery(posts, emptyText){
    posts=posts||[];
    if(!posts.length)return pEmpty(emptyText,"profile-empty-state");
    return posts.map(function(post){
      var item=typeof post==="string"?{url:post,caption:""}:post||{};
      if(!item.url)return "";
      return "<article class='gallery-post'><div class='gallery-media' style=\"background-image:url('"+esc(item.url)+"')\"></div>"+(item.caption?"<p>"+esc(item.caption)+"</p>":"")+"</article>";
    }).join("");
  }
  function pDetail(value){
    return value?"<span class='detailchip'>"+esc(value)+"</span>":"";
  }
  function pStatus(value){
    return "<span class='status'>"+esc(value||"Not set")+"</span>";
  }

  shell=function(content){
    app.innerHTML=content+"<footer class='footer'><div class='wrap'>MUSE · Real profiles, direct collaborations and external payment tracking.</div></footer>";
    bindFavorites();
  };
  profileBg=function(user){
    return pPhotoAttr(user);
  };
  talentCard=function(talent){
    var saved=STATE.favorites.includes(talent.id);
    var followers=(talent.platforms||[]).reduce(function(total,item){return total+Number(item.followers||0);},0);
    var rate=Number(talent.startingRate||0)>0?"From "+money(talent.startingRate):"Rate on request";
    return "<article class='talent-card'>"+
      "<a href='#/talent/"+encodeURIComponent(talent.id)+"' "+pPhotoAttr(talent)+">"+
      (talent.profilePhoto?"":"<span class='photo-empty-label'>Photo not added</span>")+"</a>"+
      (STATE.me&&STATE.me.role==="brand"?"<button class='heart "+(saved?"saved":"")+"' data-fav='"+esc(talent.id)+"'>"+(saved?"♥":"♡")+"</button>":"")+
      "<div class='talentbody'><div class='name'>"+esc(talent.name)+(talent.verified?" <span class='verified'>✓</span>":"")+"</div>"+
      "<div class='mini'>"+esc((talent.talentTypes||[]).join(" · ")||"Talent")+"</div>"+
      "<div class='tags'>"+(talent.categories||[]).slice(0,3).map(function(item){return "<span class='tag'>"+esc(item)+"</span>";}).join("")+"</div>"+
      "<div class='mini'>"+esc([talent.city,talent.country].filter(Boolean).join(", ")||"Location not added")+"</div>"+
      (typeof museRating==="function"?museRating(talent):"")+
      "<div class='tags'>"+(talent.categories||[]).slice(0,3).map(function(item){return "<span class='tag'>"+esc(item)+"</span>";}).join("")+"</div>"+
      "<div class='tags'>"+(talent.categories||[]).slice(0,3).map(function(item){return "<span class='tag'>"+esc(item)+"</span>";}).join("")+"</div>"+
      "<div class='rate'><span>"+(followers?"<b>"+pAudience(followers)+"</b> reach":"Audience not listed")+"</span><b>"+rate+"</b></div></div></article>";
  };

  home=function(){
    var talents=STATE.talents||[], campaigns=STATE.campaigns||[];
    shell("<section class='wrap hero'><div><div class='eyebrow'>THE TALENT MARKETPLACE FOR MODERN BRANDS</div>"+
      "<h1>Find the right person for your next campaign.</h1>"+
      "<p>Real creators and models build their own profiles. Brands can discover talent, send offers and manage every agreed deal in one workspace.</p>"+
      "<form class='searchbox' id='heroSearch'><select name='country'>"+countryOptions("")+"</select><select name='city'>"+cityOptions("","")+"</select><button class='primary'>Search talent</button></form></div>"+
      "<div class='heroart'><div class='floatcard'><span class='eyebrow'>REAL PROFILES ONLY</span><b>Built for genuine collaborations.</b><span>Every profile is added and managed by its owner.</span></div></div></section>"+
      "<section class='statbar'><div><b>"+talents.length+"</b><span>Live talent profiles</span></div><div><b>"+campaigns.length+"</b><span>Open campaigns</span></div><div><b>Real</b><span>No demo accounts</span></div><div><b>USD</b><span>Deal currency</span></div></section>"+
      "<section class='wrap section'><div class='sectionhead'><div><div class='eyebrow'>DISCOVER</div><h2>Talent worth noticing.</h2></div><a href='#/discover'>View all →</a></div>"+
      "<div class='cards'>"+(talents.slice(0,4).map(talentCard).join("")||pEmpty("No live profiles yet. The first completed profiles will appear here."))+"</div></section>"+
      "<section class='soft'><div class='wrap section'><div class='eyebrow'>EXPLORE BY CATEGORY</div><div class='categories'>"+
      ["Fashion","Beauty","Lifestyle","Fitness","UGC","Food"].map(function(category){return "<a class='category' href='#/discover?category="+encodeURIComponent(category)+"'><span>✦</span><strong>"+category+"</strong></a>";}).join("")+
      "</div></div></section><section class='wrap section'><div class='eyebrow'>HOW IT WORKS</div><h2>From profile to partnership.</h2><div class='steps'>"+
      "<div class='box'><b>01</b><h3>Build a profile</h3><p>Talent and brands add their own work, location and details.</p></div>"+
      "<div class='box'><b>02</b><h3>Offer</h3><p>Brands send offers. Talent can also apply to open campaigns.</p></div>"+
      "<div class='box'><b>03</b><h3>Chat</h3><p>The talent accepts or negotiates the brand offer to open a chat.</p></div>"+
      "<div class='box'><b>04</b><h3>Track the deal</h3><p>Agree terms and track an external payment transfer in the deal room.</p></div>"+
      "</div></section>");
    var form=document.getElementById("heroSearch");
    var country=form.country, city=form.city;
    country.onchange=function(){city.innerHTML=cityOptions(country.value);};
    form.onsubmit=function(event){event.preventDefault();location.hash="#/discover?country="+encodeURIComponent(country.value)+"&city="+encodeURIComponent(city.value);};
  };

  auth=function(queryString){
    if(STATE.me){location.hash=STATE.me.onboardingComplete?"#/dashboard":"#/onboarding";return;}
    var initial=new URLSearchParams(queryString||"").get("mode")==="signup"?"signup":"login";
    shell("<section class='authpage auth-v2'><div class='authart'><div class='authcopy'><span class='eyebrow'>MUSE</span><h1>Where talent meets the right brands.</h1><p>Create a genuine profile, discover opportunities and manage collaborations in one place.</p><div class='authproof'><span>✦ Real profiles only</span><span>✦ Brand-led chat</span><span>✦ Deal tracking built in</span></div></div></div><section class='authcard'><div class='auth-tabs'><button class='auth-tab' id='loginTab'>Sign in</button><button class='auth-tab' id='signupTab'>Create account</button></div><div id='authFormHost'></div></section></section>");
    var loginTab=document.getElementById("loginTab");
    var signupTab=document.getElementById("signupTab");
    var host=document.getElementById("authFormHost");
    async function finish(path,data){
      var result=await api(path,{method:"POST",body:data});
      STATE.me=result.user;
      await refreshMarketplaceState();
      renderNav();
      location.hash=STATE.me.role==="admin"?"#/admin":(STATE.me.onboardingComplete?"#/dashboard":"#/onboarding");
    }
    function paint(mode){
      loginTab.classList.toggle("active",mode==="login");
      signupTab.classList.toggle("active",mode==="signup");
      if(mode==="login"){
        host.innerHTML="<div class='auth-heading'><h2>Welcome back</h2><p class='muted'>Sign in to continue to your workspace.</p></div><form id='authForm' class='auth-form'><label>Email<input name='email' type='email' required autocomplete='email' placeholder='you@example.com'></label><label>Password<input name='password' type='password' required autocomplete='current-password' placeholder='••••••••'></label><button class='primary full auth-submit'>Sign in</button></form>";
      }else{
        host.innerHTML="<div class='auth-heading'><h2>Create your account</h2><p class='muted'>Choose your role. You can complete the full profile next.</p></div><form id='authForm' class='auth-form'><div class='account-type-grid'><label class='account-type selected'><input type='radio' name='accountType' value='brand' checked><span class='account-icon'>B</span><b>Brand</b><small>Find and hire talent</small></label><label class='account-type'><input type='radio' name='accountType' value='influencer'><span class='account-icon'>I</span><b>Influencer</b><small>Find opportunities</small></label><label class='account-type'><input type='radio' name='accountType' value='model'><span class='account-icon'>M</span><b>Model</b><small>Get booked</small></label><label class='account-type'><input type='radio' name='accountType' value='creator'><span class='account-icon'>C</span><b>Content Creator</b><small>Create content for brands</small></label></div><label>Name<input name='name' required maxlength='120' autocomplete='name' placeholder='Full name / Brand name'></label><label>Email<input name='email' type='email' required autocomplete='email' placeholder='you@example.com'></label><label>Password<input name='password' type='password' minlength='8' required autocomplete='new-password' placeholder='8+ characters'></label><button class='primary full auth-submit'>Create account</button></form>";
        Array.from(document.querySelectorAll(".account-type")).forEach(function(card){
          card.addEventListener("click",function(){
            Array.from(document.querySelectorAll(".account-type")).forEach(function(item){item.classList.remove("selected");});
            card.classList.add("selected");
          });
        });
      }
      document.getElementById("authForm").onsubmit=async function(event){
        event.preventDefault();
        var data=Object.fromEntries(new FormData(event.target));
        if(mode==="signup"){
          var type=data.accountType;
          data.role=type==="brand"?"brand":"talent";
          data.talentTypes=type==="brand"?[]:[type==="model"?"Model":type==="creator"?"Content Creator":"Influencer"];
          delete data.accountType;
        }
        try{await finish(mode==="login"?"/api/login":"/api/signup",data);}catch(error){showToast(error.message);}
      };
    }
    loginTab.onclick=function(){paint("login");};
    signupTab.onclick=function(){paint("signup");};
    paint(initial);
  };

  brandProfile=async function(id){
    var result=await api("/api/brands/"+encodeURIComponent(id));
    var brand=result.brand;
    if(!brand)return notFound();
    var request=result.collaborationRequest;
    var campaigns=result.campaigns||[];
    var details=[brand.industry,brand.companySize,[brand.city,brand.country].filter(Boolean).join(", ")].filter(Boolean);
    var action="";
    if(STATE.me&&STATE.me.id===brand.id){
      action="<a class='ghost' href='#/settings'>Edit public profile</a>";
    }else if(STATE.me&&STATE.me.role==="talent"){
      if(request&&request.status==="Chat Open")action="<a class='primary' href='#/chat/"+encodeURIComponent(request.id)+"'>Open chat</a>";
      else action="<a class='primary' href='#/campaigns'>Browse campaigns</a>";
    }else if(!STATE.me){
      action="<a class='primary' href='#/campaigns'>Browse campaigns</a>";
    }
    var logo=brand.profilePhoto
      ?"<div class='brand-logo profile-photo-img' style=\"background-image:url('"+esc(brand.profilePhoto)+"')\"></div>"
      :"<div class='brand-logo'>"+esc((brand.name||"B").slice(0,1))+"</div>";
    shell("<section class='wrap brand-profile'><div class='brand-cover "+(brand.coverImage?"cover-img":"")+"' "+(brand.coverImage?"style=\"background-image:url('"+esc(brand.coverImage)+"')\"":"")+"></div>"+
      "<div class='brand-profile-head'>"+logo+"<div><span class='eyebrow'>"+esc(brand.industry||"BRAND")+"</span><h1>"+esc(brand.name)+(brand.verified?" <span class='verified'>✓</span>":"")+"</h1><p class='muted'>"+esc([brand.city,brand.country].filter(Boolean).join(", ")||"Location not added")+"</p>"+(typeof museRating==="function"?museRating(brand):"")+"</div><div class='brand-site'>"+action+"</div></div>"+
      "<div class='brand-grid'><section><div class='box'><div class='eyebrow'>ABOUT</div><p class='small-lead'>"+esc(brand.bio||"This brand is still completing its public introduction.")+"</p>"+
      (brand.brandFocus?"<p class='muted'><b>Focus</b><br>"+esc(brand.brandFocus)+"</p>":"")+
      "<div class='detailrow'>"+details.map(pDetail).join("")+(brand.brandTags||[]).map(pDetail).join("")+"</div>"+
      "<p class='muted safety-copy'>Contact details stay private. Collaborations and messages happen in MUSE.</p></div>"+
      "<div class='box'><div class='sectionhead compact'><div class='eyebrow'>BRAND PORTFOLIO</div><span class='mini'>"+(brand.portfolio||[]).length+" items</span></div><div class='portfolio'>"+pPortfolio(brand.portfolio,"This brand has not added portfolio work yet.")+"</div></div>"+
      "<div class='box'><div class='sectionhead compact'><div class='eyebrow'>BRAND GALLERY</div><span class='mini'>"+(brand.profilePosts||[]).length+" photos</span></div><div class='profile-gallery'>"+pGallery(brand.profilePosts,"This brand has not shared photos yet.")+"</div></div></section>"+
      "<aside><div class='box'><div class='eyebrow'>COLLABORATION</div><p>"+(STATE.me&&STATE.me.role==="talent"?"Apply to an open campaign, or respond when this brand sends you an offer.":"Brands send offers with the scope, price and deadline.")+"</p><p class='muted'>Chat opens when talent accepts an offer or chooses to negotiate.</p></div>"+
      "<div class='box'><div class='eyebrow'>OPEN CAMPAIGNS</div><div class='big-number'>"+campaigns.length+"</div><p class='muted'>Public opportunities from this brand.</p></div></aside></div>"+
      "<section class='section brand-campaigns'><div class='sectionhead'><div><div class='eyebrow'>OPPORTUNITIES</div><h2>Open campaigns.</h2></div></div><div class='campaignlist'>"+(campaigns.map(campaignCard).join("")||pEmpty("No public campaigns yet."))+"</div></section></section><div id='modalHost'></div>");
  };

  talentProfile=async function(id){
    var result=await api("/api/talents/"+encodeURIComponent(id));
    var talent=result.talent;
    if(!talent)return notFound();
    var isOwner=STATE.me&&STATE.me.id===talent.id;
    var audience=(talent.platforms||[]).reduce(function(total,item){return total+Number(item.followers||0);},0);
    var portfolioCount=(talent.portfolio||[]).length;
    var profileStats="<section class='profile-stats'><div><span>Audience</span><b>"+(audience?pAudience(audience):"Not listed")+"</b></div><div><span>Portfolio</span><b>"+portfolioCount+" "+(portfolioCount===1?"work":"works")+"</b></div><div><span>Availability</span><b>"+esc(talent.availability||"Not set")+"</b></div><div><span>Starting rate</span><b>"+(Number(talent.startingRate||0)>0?money(talent.startingRate):"On request")+"</b></div></section>";
    var saved=STATE.favorites.includes(talent.id), shortlists=[], ownCampaigns=[];
    if(STATE.me&&STATE.me.role==="brand"){
      var workspace=await api("/api/dashboard");
      var campaignData=await api("/api/campaigns");
      shortlists=workspace.shortlists||[];
      STATE.favorites=(workspace.favorites||[]).map(function(item){return item.id;});
      saved=STATE.favorites.includes(talent.id);
      ownCampaigns=(campaignData.campaigns||[]).filter(function(item){return item.brand_id===STATE.me.id&&item.status==="Open";});
    }
    var avatar=talent.profilePhoto
      ?"<div class='avatar profile-photo-img' style=\"background-image:url('"+esc(talent.profilePhoto)+"')\"></div>"
      :"<div class='avatar empty-avatar'>"+esc((talent.name||"M").slice(0,1))+"</div>";
    var actions=isOwner
      ?"<span class='public-badge'>"+(talent.profileVisibility==="Private"?"Your private profile":"Your public profile")+"</span><a class='ghost' href='#/settings'>Edit profile</a>"
      :STATE.me&&STATE.me.role==="brand"
        ?"<button class='ghost' data-fav='"+esc(talent.id)+"'>"+(saved?"♥ Saved":"♡ Save")+"</button><button class='ghost' id='shortlistBtn'>Shortlist</button><button class='ghost' id='inviteBtn'>Invite to campaign</button><button class='primary' id='offerBtn'>Send offer</button>"
        :"<a class='primary' href='#/auth?mode=signup'>Join MUSE to work together</a>";
    shell("<section class='wrap profilehero'><div class='cover "+(talent.coverImage?"cover-img":"")+"' "+(talent.coverImage?"style=\"background-image:url('"+esc(talent.coverImage)+"')\"":"")+"></div><div class='profilecard'>"+avatar+
      "<div><h1>"+esc(talent.name)+(talent.verified?" <span class='verified'>✓</span>":"")+"</h1><p class='muted'>"+esc((talent.talentTypes||[]).join(" · ")||"Talent")+" · "+esc([talent.city,talent.country].filter(Boolean).join(", ")||"Location not added")+"</p>"+(typeof museRating==="function"?museRating(talent):"")+"</div><div class='actions'>"+actions+"</div></div>"+
      profileStats+"<div class='profilegrid'><section><div class='box'><div class='eyebrow'>ABOUT</div><p>"+esc(talent.bio||"This talent is still completing their public introduction.")+"</p><div class='detailrow'>"+[talent.nationality,(talent.languages||[]).join(" · "),talent.availability].filter(Boolean).map(pDetail).join("")+"</div></div>"+
      "<div class='box'><div class='eyebrow'>WORK WITH</div><div class='tags'>"+((talent.categories||[]).map(pDetail).join("")||"<span class='muted'>Categories will appear here.</span>")+"</div></div>"+
      "<div class='box'><div class='sectionhead compact'><div class='eyebrow'>SELECTED WORK</div><span class='mini'>"+(talent.portfolio||[]).length+" works</span></div><div class='portfolio'>"+pPortfolio(talent.portfolio,"No portfolio work has been added yet.")+"</div></div>"+
      "<div class='box'><div class='sectionhead compact'><div class='eyebrow'>PROFILE GALLERY</div><span class='mini'>"+(talent.profilePosts||[]).length+" photos</span></div><p class='muted'>Photos, work and moments shared directly by "+esc(talent.name)+".</p><div class='profile-gallery'>"+pGallery(talent.profilePosts,"No gallery photos have been shared yet.")+"</div></div></section><aside>"+
      "<div class='box'><div class='eyebrow'>STARTING RATE</div><div class='budget'>"+(Number(talent.startingRate||0)>0?money(talent.startingRate):"On request")+"</div></div>"+
      "<div class='box'><div class='eyebrow'>SERVICES</div>"+((talent.services||[]).map(function(item){return "<div class='service'><span>"+esc(item.name)+"</span><b>"+(Number(item.price||0)>0?money(item.price):"On request")+"</b></div>";}).join("")||"<p class='muted'>No services added yet.</p>")+"</div>"+
      "<div class='box'><div class='eyebrow'>SOCIAL AUDIENCE</div>"+((talent.platforms||[]).map(function(item){return "<div class='service'><div><span>"+esc(item.name)+"</span><small>Audience only · contact stays in MUSE</small></div><b>"+(item.followers?Number(item.followers).toLocaleString():"Not listed")+"</b></div>";}).join("")||"<p class='muted'>No social platforms added yet.</p>")+"</div>"+
      (talent.modelCategory?"<div class='box'><div class='eyebrow'>MODEL DETAILS</div><p>"+esc(talent.modelCategory)+"</p>"+(talent.measurements?"<p class='muted'>"+esc(talent.measurements)+"</p>":"")+(talent.agency?"<p class='muted'>Agency: "+esc(talent.agency)+"</p>":"")+"</div>":"")+
      "</aside></div></section><div id='modalHost'></div>");
    bindFavorites();
    var host=document.getElementById("modalHost");
    var offerButton=document.getElementById("offerBtn");
    if(offerButton)offerButton.onclick=function(){
      host.innerHTML="<div class='modalback'><form class='modal' id='offerForm'><span class='eyebrow'>DIRECT OFFER</span><h2>Send an offer to "+esc(talent.name)+"</h2><input name='title' required maxlength='160' placeholder='Offer title'><textarea name='details' required maxlength='3000' placeholder='Job details'></textarea><input name='deliverables' required maxlength='1200' placeholder='Deliverables'><div class='twocol'><input name='date' type='date' required><input name='price' type='number' min='1' required placeholder='Offered price USD'></div><label class='deal-terms-check'><input type='checkbox' name='agreeToTerms' required> I confirm these terms are accurate and this collaboration will stay in MUSE.</label><button class='primary full'>Send offer</button><button type='button' class='ghost full' id='closeModal'>Cancel</button></form></div>";
      document.getElementById("closeModal").onclick=function(){host.innerHTML="";};
      document.getElementById("offerForm").onsubmit=async function(event){event.preventDefault();var data=Object.fromEntries(new FormData(event.target));data.agreeToTerms=data.agreeToTerms==="on";data.talentId=talent.id;try{await api("/api/offers",{method:"POST",body:data});host.innerHTML="";showToast("Offer sent");}catch(error){showToast(error.message);}};
    };
    var inviteButton=document.getElementById("inviteBtn");
    if(inviteButton)inviteButton.onclick=function(){
      var options=ownCampaigns.map(function(item){return "<option value='"+esc(item.id)+"'>"+esc(item.name)+"</option>";}).join("");
      host.innerHTML="<div class='modalback'><form class='modal' id='inviteForm'><span class='eyebrow'>CAMPAIGN INVITE</span><h2>Invite "+esc(talent.name)+"</h2>"+(options?"<label>Choose campaign<select name='campaignId'>"+options+"</select></label><button class='primary full'>Send invitation</button>":"<div class='empty'>Create a campaign before inviting talent.</div><a class='primary full center' href='#/campaigns/new'>Create campaign</a>")+"<button type='button' class='ghost full' id='closeModal'>Cancel</button></form></div>";
      document.getElementById("closeModal").onclick=function(){host.innerHTML="";};
      document.getElementById("inviteForm").onsubmit=async function(event){event.preventDefault();var campaignId=new FormData(event.target).get("campaignId");if(!campaignId)return;try{await api("/api/campaigns/"+encodeURIComponent(campaignId)+"/invite",{method:"POST",body:{talentId:talent.id}});host.innerHTML="";showToast("Campaign invitation sent");}catch(error){showToast(error.message);}};
    };
    var shortlistButton=document.getElementById("shortlistBtn");
    if(shortlistButton)shortlistButton.onclick=function(){
      var options=shortlists.map(function(item){return "<option value='"+esc(item.id)+"'>"+esc(item.name)+" ("+item.talentIds.length+")</option>";}).join("");
      host.innerHTML="<div class='modalback'><form class='modal' id='shortlistForm'><span class='eyebrow'>SHORTLIST</span><h2>Save "+esc(talent.name)+"</h2>"+(options?"<label>Choose a shortlist<select name='shortlistId'>"+options+"</select></label><button class='primary full'>Update shortlist</button>":"<label>New shortlist name<input name='name' required maxlength='80' placeholder='Shortlist name'></label><button class='primary full'>Create & add talent</button>")+"<button type='button' class='ghost full' id='closeModal'>Cancel</button></form></div>";
      document.getElementById("closeModal").onclick=function(){host.innerHTML="";};
      document.getElementById("shortlistForm").onsubmit=async function(event){event.preventDefault();try{var formData=new FormData(event.target);var shortlistId=formData.get("shortlistId");if(!shortlistId){var created=await api("/api/shortlists",{method:"POST",body:{name:formData.get("name")}});shortlistId=created.id;}var changed=await api("/api/shortlists/"+encodeURIComponent(shortlistId)+"/toggle",{method:"POST",body:{talentId:talent.id}});host.innerHTML="";showToast(changed.added?"Added to shortlist":"Removed from shortlist");}catch(error){showToast(error.message);}};
    };
  };

  function pRequestRow(item, mode){
    var isBrand=mode==="brand";
    var name=isBrand?item.talent_name:item.brand_name;
    var href=isBrand?"#/talent/"+encodeURIComponent(item.talent_id):"#/brand/"+encodeURIComponent(item.brand_id);
    var detail=isBrand?([item.city,item.country].filter(Boolean).join(", ")||"Profile shared"):"Collaboration request sent";
    var action="";
    if(item.status==="Pending"&&isBrand)action="<a class='primary small' href='#/talent/"+encodeURIComponent(item.talent_id)+"'>View profile & send offer</a>";
    else if(item.status==="Chat Open")action="<a class='primary small' href='#/chat/"+encodeURIComponent(item.id)+"'>Open chat</a>";
    else action=pStatus(item.status);
    return "<div class='dealrow collab-row'><a class='grow' href='"+href+"'><b>"+esc(name)+"</b><div class='mini'>"+esc(detail)+" · "+esc(item.status)+"</div>"+(item.note?"<div class='mini collab-note'>“"+esc(item.note)+"”</div>":"")+"</a><div class='inline'>"+action+"</div></div>";
  }
  dashboard=async function(){
    if(!STATE.me){location.hash="#/auth";return;}
    var data=await api("/api/dashboard");
    var user=STATE.me;
    if(user.role==="admin"){location.hash="#/admin";return;}
    var offers=data.offers||[], dealsList=data.deals||[], applications=data.applications||[], requests=data.collaborationRequests||[];
    var offerRows=offers.length?offers.map(function(offer){
      var amount=offer.status==="Countered"&&offer.counter_price?money(offer.counter_price)+" counter":money(offer.price);
      var controls="";
      if(user.role==="talent"&&offer.status==="Pending")controls="<div class='inline'><button class='ghost small' data-offer='"+esc(offer.id)+"' data-status='Declined'>Decline</button><button class='ghost small' data-negotiate='"+esc(offer.id)+"'>Negotiate</button><button class='ghost small' data-counter='"+esc(offer.id)+"'>Counter price</button><button class='primary small' data-offer='"+esc(offer.id)+"' data-status='Accepted'>Accept</button></div>";
      if(user.role==="brand"&&offer.status==="Countered")controls="<div class='inline'><button class='ghost small' data-offer='"+esc(offer.id)+"' data-status='Declined'>Decline counter</button><button class='primary small' data-offer='"+esc(offer.id)+"' data-status='Accepted'>Accept counter</button></div>";
      return "<div class='service'><div><b>"+esc(offer.title)+"</b><p><a href='"+(user.role==="talent"?"#/brand/"+encodeURIComponent(offer.brand_id):"#/talent/"+encodeURIComponent(offer.talent_id))+"'>"+esc(offer.brand_name||offer.talent_name||"View profile")+"</a></p><small>"+amount+" · "+esc(offer.status)+(offer.counter_note?" · "+esc(offer.counter_note):"")+"</small><p>"+esc(offer.details||"")+"</p><p><b>Deliverables:</b> "+esc(offer.deliverables||"")+"<br><b>Deadline:</b> "+esc(offer.date||"")+"<br><b>Usage rights:</b> "+esc(offer.usage_rights||"Organic social")+" · "+esc(offer.usage_duration||"")+" · "+esc(offer.territory||"")+"<br><b>Exclusivity:</b> "+esc(offer.exclusivity||"None")+"</p></div>"+controls+"</div>";
    }).join(""):"<p class='muted'>No offers yet.</p>";
    var requestTitle=user.role==="brand"?"Collaboration requests":"Requests sent";
    var requestRows=requests.map(function(item){return pRequestRow(item,user.role);}).join("")||pEmpty(user.role==="brand"?"Talent collaboration requests will appear here.":"Your requests to brands will appear here.");
    var applicationsHtml=applications.map(function(item){
      return user.role==="brand"
        ?"<a class='dealrow' href='#/talent/"+encodeURIComponent(item.talent_id)+"'><div><b>"+esc(item.talent_name)+"</b><div class='mini'>"+esc(item.campaign_name)+" · "+money(item.price)+"</div><div class='mini'>"+esc(item.proposal||"")+"</div></div><span>View profile →</span></a>"
        :"<div class='dealrow'><div><b>"+esc(item.campaign_name)+"</b><div class='mini'>"+money(item.price)+" · "+esc(item.status)+"</div></div></div>";
    }).join("")||pEmpty(user.role==="brand"?"Applications will appear here when talent applies.":"No campaign applications yet.");
    var publicProfileHref=user.role==="talent"?"#/talent/"+encodeURIComponent(user.id):"#/brand/"+encodeURIComponent(user.id);
    var profileActions="<div class='dashboard-actions'><a class='ghost' href='#/settings'>Edit profile</a>"+(user.onboardingComplete?"<a class='primary' href='"+publicProfileHref+"'>View public profile</a>":"")+"</div>";
    shell("<section class='wrap section'><div class='dashhead'><div><div class='eyebrow'>WORKSPACE</div><h2>"+esc(user.name)+"</h2><p class='muted'>Signed in as "+esc(user.role)+"</p></div>"+profileActions+"</div>"+
      "<div class='metricgrid'><div class='metric'><span>Offers</span><b>"+offers.length+"</b></div><div class='metric'><span>Active deals</span><b>"+dealsList.filter(function(item){return item.status!=="Completed";}).length+"</b></div><div class='metric'><span>Completed</span><b>"+dealsList.filter(function(item){return item.status==="Completed";}).length+"</b></div><div class='metric'><span>"+(user.role==="brand"?"Requests":"Requests sent")+"</span><b>"+requests.length+"</b></div></div>"+
      "<div class='dashgrid'><section class='box'><h3>Recent offers</h3>"+offerRows+"</section><section class='box'><h3>Quick access</h3><p><a href='#/discover'>Discover talent</a></p><p><a href='#/campaigns'>Campaign marketplace</a></p><p><a href='#/messages'>Messages</a></p><p><a href='#/deals'>Deal rooms</a></p></section></div>"+
      "<div class='sectionhead topgap'><div><h2>"+requestTitle+"</h2></div></div><div class='campaignlist'>"+requestRows+"</div>"+
      (user.role==="brand"
        ?"<div class='sectionhead topgap'><div><h2>Campaign applications</h2></div></div><div class='campaignlist'>"+applicationsHtml+"</div><div class='sectionhead topgap'><div><h2>Saved talent</h2></div></div><div class='cards'>"+((data.favorites||[]).map(talentCard).join("")||pEmpty("Save talent from Discover."))+"</div><div class='sectionhead topgap'><div><h2>Shortlists</h2></div><button class='ghost' id='newList'>+ New list</button></div><div class='campaignlist'>"+((data.shortlists||[]).map(function(item){return "<div class='dealrow'><div><b>"+esc(item.name)+"</b><div class='mini'>"+item.talentIds.length+" talent</div></div></div>";}).join("")||pEmpty("No shortlists yet."))+"</div>"
        :"<div class='sectionhead topgap'><div><h2>Applications</h2></div></div><div class='campaignlist'>"+applicationsHtml+"</div><div class='sectionhead topgap'><div><h2>Campaign invitations</h2></div></div><div class='campaignlist'>"+((data.invitations||[]).map(function(item){return "<a class='dealrow' href='#/campaign/"+encodeURIComponent(item.campaign_id)+"'><div><b>"+esc(item.campaign_name)+"</b><div class='mini'>Invited by "+esc(item.brand_name)+" · "+esc(item.status)+"</div></div><span>View →</span></a>";}).join("")||pEmpty("No invitations yet."))+"</div>")+
      "</section><div id='modalHost'></div>");
    bindFavorites();
    Array.from(document.querySelectorAll("[data-negotiate]")).forEach(function(button){
      button.onclick=async function(){try{var result=await api("/api/offers/"+encodeURIComponent(button.dataset.negotiate)+"/respond",{method:"POST",body:{status:"Negotiating"}});location.hash="#/chat/"+encodeURIComponent(result.chatId);}catch(error){showToast(error.message);}};
    });
    Array.from(document.querySelectorAll("[data-open-chat]")).forEach(function(button){
      button.onclick=async function(){try{await api("/api/requests/"+encodeURIComponent(button.dataset.openChat)+"/open-chat",{method:"POST",body:{}});showToast("Chat opened");dashboard();}catch(error){showToast(error.message);}};
    });
    Array.from(document.querySelectorAll("[data-offer]")).forEach(function(button){
      button.onclick=async function(){
        if(button.dataset.status!=="Accepted"){
          try{await api("/api/offers/"+encodeURIComponent(button.dataset.offer)+"/respond",{method:"POST",body:{status:button.dataset.status}});showToast("Offer updated");dashboard();}catch(error){showToast(error.message);}
          return;
        }
        var offer=offers.find(function(item){return item.id===button.dataset.offer;});
        var host=document.getElementById("modalHost");
        host.innerHTML="<div class='modalback'><form class='modal' id='acceptOfferForm'><span class='eyebrow'>CONFIRM AGREEMENT</span><h2>Accept "+esc(offer&&offer.title||"this offer")+"</h2><p class='muted'>This creates a shared MUSE Deal Room for the scope, deadline and agreed price. Accepting does not mean payment has been made.</p><label class='deal-terms-check'><input type='checkbox' name='agreeToTerms' required> I agree to keep this collaboration and communication in MUSE.</label><button class='primary full'>Accept & create Deal Room</button><button type='button' class='ghost full' id='closeModal'>Cancel</button></form></div>";
        document.getElementById("closeModal").onclick=function(){host.innerHTML="";};
        document.getElementById("acceptOfferForm").onsubmit=async function(event){event.preventDefault();try{await api("/api/offers/"+encodeURIComponent(button.dataset.offer)+"/respond",{method:"POST",body:{status:"Accepted",agreeToTerms:true}});host.innerHTML="";showToast("Deal Room created");dashboard();}catch(error){showToast(error.message);}};
      };
    });
    Array.from(document.querySelectorAll("[data-counter]")).forEach(function(button){
      button.onclick=function(){
        var offer=offers.find(function(item){return item.id===button.dataset.counter;});
        var host=document.getElementById("modalHost");
        host.innerHTML="<div class='modalback'><form class='modal' id='counterForm'><span class='eyebrow'>COUNTER OFFER</span><h2>"+esc(offer.title)+"</h2><input name='counterPrice' type='number' min='1' required placeholder='Your counter price USD'><textarea name='counterNote' maxlength='1200' placeholder='Optional note for the brand'></textarea><label class='deal-terms-check'><input type='checkbox' name='agreeToTerms' required> I agree to keep this collaboration and communication in MUSE.</label><button class='primary full'>Send counter offer</button><button type='button' class='ghost full' id='closeModal'>Cancel</button></form></div>";
        document.getElementById("closeModal").onclick=function(){host.innerHTML="";};
        document.getElementById("counterForm").onsubmit=async function(event){event.preventDefault();var formData=Object.fromEntries(new FormData(event.target));formData.agreeToTerms=formData.agreeToTerms==="on";try{await api("/api/offers/"+encodeURIComponent(offer.id)+"/respond",{method:"POST",body:{status:"Countered",counterPrice:formData.counterPrice,counterNote:formData.counterNote,agreeToTerms:formData.agreeToTerms}});host.innerHTML="";showToast("Counter offer sent");dashboard();}catch(error){showToast(error.message);}};
      };
    });
    var newList=document.getElementById("newList");
    if(newList)newList.onclick=async function(){var name=window.prompt("Shortlist name");if(!name)return;try{await api("/api/shortlists",{method:"POST",body:{name:name}});dashboard();}catch(error){showToast(error.message);}};
  };

  messages=async function(){
    if(!STATE.me){location.hash="#/auth";return;}
    var results=await Promise.all([api("/api/messages"),api("/api/deals")]);
    var chats=results[0].chats||[], dealsList=results[1].deals||[];
    shell("<section class='wrap section'><div class='eyebrow'>MESSAGES</div><h2>Conversations.</h2><p class='muted'>Chat opens after talent accepts a brand offer or chooses to negotiate.</p><div class='sectionhead topgap'><div><h3>Collaboration chats</h3></div></div><div class='campaignlist'>"+
      (chats.map(function(item){return "<a class='dealrow' href='#/chat/"+encodeURIComponent(item.id)+"'><div><b>"+esc(item.other_name)+"</b><div class='mini'>Collaboration chat · "+pDate(item.updated_at)+"</div></div><span>Open →</span></a>";}).join("")||pEmpty("No collaboration chats yet."))+
      "</div><div class='sectionhead topgap'><div><h3>Deal rooms</h3></div></div><div class='campaignlist'>"+
      (dealsList.map(function(item){return "<a class='dealrow' href='#/deal/"+encodeURIComponent(item.id)+"'><div><b>"+esc(item.title)+"</b><div class='mini'>"+esc(item.other_name||"Deal")+"</div></div><div>"+pStatus(item.status)+"</div></a>";}).join("")||pEmpty("No deal rooms yet."))+
      "</div></section>");
  };
  chatRoom=async function(id){
    if(!STATE.me){location.hash="#/auth";return;}
    var result=await api("/api/chats/"+encodeURIComponent(id));
    var request=result.request, chatMessages=result.messages||[];
    var other=STATE.me.role==="brand"?request.talent_name:request.brand_name;
    shell("<section class='wrap section'><div class='dealroomhead'><div><div class='eyebrow'>COLLABORATION CHAT</div><h2>"+esc(other)+"</h2><p class='muted'>Started after the brand reviewed the collaboration request.</p></div><a class='ghost' href='#/messages'>All messages</a></div><div class='chat-room box'><div class='chat-context'>"+(request.note?"Original request: "+esc(request.note):"No note was added to the request.")+"</div><div class='messages' id='chatMessages'>"+
      (chatMessages.map(function(item){return "<div class='msg "+(item.from_user===STATE.me.id?"me":"")+"'><b>"+(item.from_user===STATE.me.id?"You":esc(item.from_name))+"</b><br>"+esc(item.text||"")+(item.file_url?"<a class='file-link' href='"+esc(item.file_url)+"' target='_blank' rel='noopener'>📎 "+esc(item.file_name||"Attachment")+"</a>":"")+"</div>";}).join("")||"<p class='muted'>Say hello and start the conversation.</p>")+
      "</div><form class='messageform' id='chatForm'><input name='text' maxlength='5000' placeholder='Write a message...'><button class='primary'>Send</button></form><div class='uploadbox topgap'><label class='mini'>Attach a file<input type='file' id='chatFile'></label></div></div></section>");
    var filePayload=null;
    var fileInput=document.getElementById("chatFile");
    fileInput.onchange=async function(){
      var file=fileInput.files[0]; if(!file)return;
      try{filePayload=await uploadFile(file);showToast("File ready to send");}catch(error){showToast(error.message);fileInput.value="";}
    };
    document.getElementById("chatForm").onsubmit=async function(event){
      event.preventDefault();
      var text=event.target.text.value.trim();
      if(!text&&!filePayload)return;
      try{await api("/api/requests/"+encodeURIComponent(id)+"/messages",{method:"POST",body:{text:text,fileName:filePayload&&filePayload.name,fileUrl:filePayload&&filePayload.url}});chatRoom(id);}catch(error){showToast(error.message);}
    };
  };

  deals=async function(){
    if(!STATE.me){location.hash="#/auth";return;}
    var result=await api("/api/deals");
    var dealsList=result.deals||[];
    shell("<section class='wrap section'><div class='eyebrow'>DEALS</div><h2>Your deal rooms.</h2><div class='campaignlist'>"+
      (dealsList.map(function(item){return "<a class='dealrow' href='#/deal/"+encodeURIComponent(item.id)+"'><div><b>"+esc(item.title)+"</b><div class='mini'>"+esc(item.deliverables||"Deliverables to be added")+" · Due "+esc(item.deadline||"Not set")+"</div><div class='mini'>Payment: "+esc(item.payment_status||"Not set")+"</div></div><div>"+pStatus(item.status)+" <b>"+money(item.agreed_price)+"</b></div></a>";}).join("")||pEmpty("No deals yet."))+
      "</div></section>");
  };
  dealRoom=async function(id){
    if(!STATE.me){location.hash="#/auth";return;}
    var result=await api("/api/deals/"+encodeURIComponent(id));
    var deal=result.deal, dealMessages=result.messages||[];
    var paymentStatus=deal.payment_status||"Not set";
    var paymentPlan=deal.payment_plan||"Not set";
    var canPlan=paymentStatus==="Not set"||paymentStatus==="Planned";
    var paymentControls="";
    if(canPlan){
      paymentControls="<form class='payment-form' id='paymentPlanForm'><label>Payment plan<select name='paymentPlan'><option "+(paymentPlan==="Full"?"selected":"")+">Full</option><option "+(paymentPlan==="Deposit"?"selected":"")+">Deposit</option><option "+(paymentPlan==="Milestones"?"selected":"")+">Milestones</option></select></label><label>Tracking note<textarea name='paymentNote' maxlength='800' placeholder='Optional note, e.g. deposit timing'>"+esc(deal.payment_note||"")+"</textarea></label><button class='ghost small'>Save payment plan</button></form>";
    }else{
      paymentControls="<div class='payment-summary'><span>Plan</span><b>"+esc(paymentPlan)+"</b>"+(deal.payment_note?"<p>"+esc(deal.payment_note)+"</p>":"")+"</div>";
    }
    var paymentAction="";
    if(STATE.me.role==="brand"&&paymentStatus==="Planned")paymentAction="<button class='primary full' id='markTransferBtn'>Mark transfer sent</button>";
    if(STATE.me.role==="talent"&&paymentStatus==="Transfer Sent")paymentAction="<button class='primary full' id='confirmPaymentBtn'>Confirm receipt</button>";
    shell("<section class='wrap section'><div class='dealroomhead'><div><div class='eyebrow'>DEAL ROOM</div><h2>"+esc(deal.title)+"</h2></div><select id='dealStatus'>"+["Accepted","In Progress","Submitted","Approved","Completed"].map(function(status){return "<option "+(status===deal.status?"selected":"")+">"+status+"</option>";}).join("")+"</select></div>"+
      "<div class='dealgrid'><section class='box chat'><div class='messages' id='dealMessages'>"+
      (dealMessages.map(function(item){return "<div class='msg "+(item.from_user===STATE.me.id?"me":"")+"'><b>"+(item.from_user===STATE.me.id?"You":esc(item.from_name))+"</b><br>"+esc(item.text||"")+(item.file_url?"<a class='file-link' href='"+esc(item.file_url)+"' target='_blank' rel='noopener'>📎 "+esc(item.file_name||"Attachment")+"</a>":"")+"</div>";}).join("")||"<p class='muted'>Use this room to manage the agreed collaboration.</p>")+
      "</div><form class='messageform' id='dealMessageForm'><input name='text' maxlength='5000' placeholder='Write a message...'><button class='primary'>Send</button></form><div class='uploadbox topgap'><label class='mini'>Attach a file<input type='file' id='dealFile'></label></div></section>"+
      "<aside class='deal-sidebar'><div class='box'><div class='eyebrow'>AGREEMENT</div><div class='budget'>"+money(deal.agreed_price)+"</div><p><b>Deliverables</b><br>"+esc(deal.deliverables||"Not set")+"</p><p><b>Deadline</b><br>"+esc(deal.deadline||"Not set")+"</p><p><b>Status</b><br>"+esc(deal.status)+"</p></div>"+
      "<div class='box payment-tracker'><div class='eyebrow'>PAYMENT TRACKING</div><div class='payment-status-row'><span>"+pStatus(paymentStatus)+"</span><span class='mini'>"+(paymentStatus==="Received"?"Receipt confirmed":paymentStatus==="Transfer Sent"?"Waiting for talent confirmation":paymentStatus==="Planned"?"Plan saved":"Set a plan to begin")+"</span></div><p class='muted'>MUSE does not collect card details, hold funds or process a transfer. This only records an external payment between you.</p>"+paymentControls+paymentAction+"</div></aside></div></section>");
    document.getElementById("dealStatus").onchange=async function(){
      try{await api("/api/deals/"+encodeURIComponent(id)+"/status",{method:"POST",body:{status:this.value}});showToast("Deal status updated");}catch(error){showToast(error.message);}
    };
    var filePayload=null;
    var fileInput=document.getElementById("dealFile");
    fileInput.onchange=async function(){var file=fileInput.files[0];if(!file)return;try{filePayload=await uploadFile(file);showToast("File ready to send");}catch(error){showToast(error.message);fileInput.value="";}};
    document.getElementById("dealMessageForm").onsubmit=async function(event){event.preventDefault();var text=event.target.text.value.trim();if(!text&&!filePayload)return;try{await api("/api/deals/"+encodeURIComponent(id)+"/messages",{method:"POST",body:{text:text,fileName:filePayload&&filePayload.name,fileUrl:filePayload&&filePayload.url}});dealRoom(id);}catch(error){showToast(error.message);}};
    var planForm=document.getElementById("paymentPlanForm");
    if(planForm)planForm.onsubmit=async function(event){event.preventDefault();try{await api("/api/deals/"+encodeURIComponent(id)+"/payment/plan",{method:"POST",body:Object.fromEntries(new FormData(event.target))});showToast("Payment plan saved");dealRoom(id);}catch(error){showToast(error.message);}};
    var transferButton=document.getElementById("markTransferBtn");
    if(transferButton)transferButton.onclick=async function(){try{await api("/api/deals/"+encodeURIComponent(id)+"/payment/sent",{method:"POST",body:{}});showToast("Transfer marked as sent");dealRoom(id);}catch(error){showToast(error.message);}};
    var receiptButton=document.getElementById("confirmPaymentBtn");
    if(receiptButton)receiptButton.onclick=async function(){try{await api("/api/deals/"+encodeURIComponent(id)+"/payment/received",{method:"POST",body:{}});showToast("Payment receipt confirmed");dealRoom(id);}catch(error){showToast(error.message);}};
  };

  settings=async function(){
    if(!STATE.me){location.hash="#/auth";return;}
    var user=STATE.me, talent=user.role==="talent";
    var platformByName=Object.fromEntries((user.platforms||[]).map(function(item){return [String(item.name||"").toLowerCase(),item];}));
    var services=user.services||[];
    var photo=user.profilePhoto||"", cover=user.coverImage||"", portfolio=(user.portfolio||[]).slice();
    var profilePosts=(user.profilePosts||[]).map(function(item){
      var url=typeof item==="string"?item:item&&item.url;
      return url?{url:url,caption:typeof item==="string"?"":item.caption||""}:null;
    }).filter(Boolean);
    var title=talent?"Develop your profile.":"Develop your brand profile.";
    var publicProfileHref=talent?"#/talent/"+encodeURIComponent(user.id):"#/brand/"+encodeURIComponent(user.id);
    var profileVisibility=user.profileVisibility||"Public";
    var profilePreviewCallout=user.onboardingComplete
      ?"<div class='profile-preview-callout'><div><span class='eyebrow'>"+(profileVisibility==="Public"?"PUBLIC PROFILE":"PRIVATE PROFILE")+"</span><p>"+(profileVisibility==="Public"?"People can discover this profile in MUSE.":"Only you can view this profile. It is hidden from discovery.")+"</p></div><a class='ghost small' href='"+publicProfileHref+"'>View profile →</a></div>"
      :"<div class='profile-preview-callout'><div><span class='eyebrow'>PUBLIC PROFILE</span><p>Finish your profile before it becomes visible to people.</p></div><a class='ghost small' href='#/onboarding'>Complete profile</a></div>";
    var privacyField="<div class='visibility-card'><div><span class='eyebrow'>PROFILE VISIBILITY</span><b>"+(profileVisibility==="Public"?"Visible in MUSE":"Hidden from discovery")+"</b><p>Private profiles never appear in search, For You or public profile lists.</p></div><label><span>Visibility</span><select name='profileVisibility'><option "+(profileVisibility==="Public"?"selected":"")+">Public</option><option "+(profileVisibility==="Private"?"selected":"")+">Private</option></select></label></div>";
    var roleFields=talent
      ?"<div class='checkrow'><label><input type='checkbox' name='talentType' value='Influencer' "+((user.talentTypes||[]).includes("Influencer")?"checked":"")+"> Influencer</label><label><input type='checkbox' name='talentType' value='Model' "+((user.talentTypes||[]).includes("Model")?"checked":"")+"> Model</label><label><input type='checkbox' name='talentType' value='Content Creator' "+((user.talentTypes||[]).includes("Content Creator")?"checked":"")+"> Content Creator</label></div><input name='categories' value='"+esc((user.categories||[]).join(", "))+"' placeholder='Categories, e.g. Fashion, Beauty'><input name='languages' value='"+esc((user.languages||[]).join(", "))+"' placeholder='Languages, e.g. Arabic, English'><div class='twocol'><select name='nationality'>"+nationalityOptions(user.nationality||"","Nationality (optional)")+"</select><input name='startingRate' type='number' min='0' value='"+esc(user.startingRate||"")+"' placeholder='Starting rate USD'></div><select name='availability'><option "+(user.availability==="Available now"?"selected":"")+">Available now</option><option "+(user.availability==="This month"?"selected":"")+">This month</option><option "+(user.availability==="Unavailable"?"selected":"")+">Unavailable</option></select><input name='modelCategory' value='"+esc(user.modelCategory||"")+"' placeholder='Model category (optional)'><input name='measurements' value='"+esc(user.measurements||"")+"' placeholder='Measurements (optional)'><input name='agency' value='"+esc(user.agency||"")+"' placeholder='Agency representation (optional)'>"
      :"<div class='twocol'><input name='industry' value='"+esc(user.industry||"")+"' placeholder='Industry'><input name='companySize' value='"+esc(user.companySize||"")+"' placeholder='Company size (optional)'></div><label class='private-field'>Private website (not shown on your public profile)<input name='website' value='"+esc(user.website||"")+"' placeholder='Optional internal reference'></label><input name='brandFocus' value='"+esc(user.brandFocus||"")+"' placeholder='What does your brand focus on?'><input name='brandTags' value='"+esc((user.brandTags||[]).join(", "))+"' placeholder='Brand keywords, separated by commas'>";
    var socialFields=talent
      ?"<div class='form-divider'></div><h3>Social audience</h3><div class='social-grid'><label>Instagram handle<input name='instagram' value='"+esc(platformByName.instagram&&platformByName.instagram.handle||"")+"' placeholder='Add handle'></label><label>Instagram followers<input name='instagramFollowers' type='number' min='0' value='"+esc(platformByName.instagram&&platformByName.instagram.followers||"")+"' placeholder='Follower count'></label><label>TikTok handle<input name='tiktok' value='"+esc(platformByName.tiktok&&platformByName.tiktok.handle||"")+"' placeholder='Add handle'></label><label>TikTok followers<input name='tiktokFollowers' type='number' min='0' value='"+esc(platformByName.tiktok&&platformByName.tiktok.followers||"")+"' placeholder='Follower count'></label><label>YouTube channel<input name='youtube' value='"+esc(platformByName.youtube&&platformByName.youtube.handle||"")+"' placeholder='Channel name'></label><label>YouTube subscribers<input name='youtubeFollowers' type='number' min='0' value='"+esc(platformByName.youtube&&platformByName.youtube.followers||"")+"' placeholder='Subscriber count'></label></div><div class='form-divider'></div><h3>Services</h3><div class='twocol'><input name='service1' value='"+esc(services[0]&&services[0].name||"")+"' placeholder='Service name'><input name='service1Price' type='number' min='0' value='"+esc(services[0]&&services[0].price||"")+"' placeholder='Price USD'></div><div class='twocol'><input name='service2' value='"+esc(services[1]&&services[1].name||"")+"' placeholder='Service name'><input name='service2Price' type='number' min='0' value='"+esc(services[1]&&services[1].price||"")+"' placeholder='Price USD'></div>"
      :"";
    shell("<section class='wrap narrow section'><div class='eyebrow'>SETTINGS</div><h2>"+title+"</h2>"+profilePreviewCallout+"<form class='formcard' id='settingsForm'>"+privacyField+"<div class='inline'><div class='upload-preview "+(photo?"profile-photo-img":"empty-avatar")+"' id='profilePreview' "+(photo?"style=\"background-image:url('"+esc(photo)+"')\"":"")+">"+(photo?"":esc((user.name||"M").slice(0,1)))+"</div><div><label>"+(talent?"Profile photo":"Brand logo")+"<input type='file' id='profilePhoto' accept='image/*'></label></div></div><div class='uploadbox'><label>Cover image<input type='file' id='coverImage' accept='image/*'></label></div><input name='name' required maxlength='120' value='"+esc(user.name)+"' placeholder='"+(talent?"Name":"Brand name")+"'><textarea name='bio' maxlength='500' placeholder='"+(talent?"Tell brands about your work":"Tell talent about your brand")+"'>"+esc(user.bio||"")+"</textarea><div class='twocol'><select name='country' id='setCountry'>"+countryOptions(user.country||"")+"</select><select name='city' id='setCity'>"+cityOptions(user.country||"",user.city||"")+"</select></div>"+roleFields+socialFields+"<div class='form-divider'></div><h3>"+(talent?"Portfolio":"Brand portfolio")+"</h3><label class='uploadbox portfolio-upload'>Add up to 18 selected-work images<input type='file' id='portfolioFiles' accept='image/*' multiple></label><div class='portfolio-thumbs' id='portfolioPreview'></div><div class='form-divider'></div><div class='sectionhead compact'><div><h3>Profile gallery</h3><p class='muted'>Share work, behind-the-scenes or any photos you want people to see.</p></div><span class='mini' id='galleryCount'></span></div><label class='uploadbox portfolio-upload'>Add gallery photos<input type='file' id='galleryFiles' accept='image/*' multiple></label><div class='gallery-editor' id='galleryEditor'></div><button class='primary'>Save changes</button></form></section>");
    function renderPortfolio(){
      var preview=document.getElementById("portfolioPreview");
      preview.innerHTML=portfolio.map(function(item,index){return "<div style=\"background-image:url('"+esc(item)+"')\"><button type='button' data-remove-portfolio='"+index+"' aria-label='Remove image'>×</button></div>";}).join("");
      Array.from(preview.querySelectorAll("[data-remove-portfolio]")).forEach(function(button){button.onclick=function(){portfolio.splice(Number(button.dataset.removePortfolio),1);renderPortfolio();};});
    }
    function renderGallery(){
      var editor=document.getElementById("galleryEditor");
      var counter=document.getElementById("galleryCount");
      counter.textContent=profilePosts.length+" / 24 photos";
      editor.innerHTML=profilePosts.map(function(post,index){
        return "<article class='gallery-editor-post'><div class='gallery-editor-image' style=\"background-image:url('"+esc(post.url)+"')\"></div><div class='gallery-editor-copy'><input type='text' data-gallery-caption='"+index+"' maxlength='300' value='"+esc(post.caption||"")+"' placeholder='Write a caption (optional)'><button type='button' class='ghost small' data-remove-gallery='"+index+"'>Remove</button></div></article>";
      }).join("")||pEmpty("No gallery photos yet. Add photos to make this feel like your social profile.");
      Array.from(editor.querySelectorAll("[data-gallery-caption]")).forEach(function(input){
        input.oninput=function(){profilePosts[Number(input.dataset.galleryCaption)].caption=input.value;};
      });
      Array.from(editor.querySelectorAll("[data-remove-gallery]")).forEach(function(button){
        button.onclick=function(){profilePosts.splice(Number(button.dataset.removeGallery),1);renderGallery();};
      });
    }
    renderPortfolio();
    renderGallery();
    var country=document.getElementById("setCountry"), city=document.getElementById("setCity");
    country.onchange=function(){city.innerHTML=cityOptions(country.value);};
    document.getElementById("profilePhoto").onchange=async function(){var file=this.files[0];if(!file)return;try{photo=(await uploadFile(file)).url;var preview=document.getElementById("profilePreview");preview.classList.remove("empty-avatar");preview.classList.add("profile-photo-img");preview.style.backgroundImage="url('"+photo+"')";preview.textContent="";showToast("Profile image uploaded");}catch(error){showToast(error.message);}};
    document.getElementById("coverImage").onchange=async function(){var file=this.files[0];if(!file)return;try{cover=(await uploadFile(file)).url;showToast("Cover uploaded");}catch(error){showToast(error.message);}};
    document.getElementById("portfolioFiles").onchange=async function(){var files=Array.from(this.files).slice(0,Math.max(0,18-portfolio.length));try{for(var i=0;i<files.length;i++){portfolio.push((await uploadFile(files[i])).url);}renderPortfolio();showToast(files.length?"Portfolio updated":"Portfolio limit reached");}catch(error){showToast(error.message);}};
    document.getElementById("galleryFiles").onchange=async function(){var files=Array.from(this.files).slice(0,Math.max(0,24-profilePosts.length));try{for(var i=0;i<files.length;i++){profilePosts.push({url:(await uploadFile(files[i])).url,caption:""});}renderGallery();showToast(files.length?"Gallery updated":"Gallery limit reached");}catch(error){showToast(error.message);}};
    document.getElementById("settingsForm").onsubmit=async function(event){
      event.preventDefault();
      var formData=new FormData(event.target), data=Object.fromEntries(formData.entries());
      data.profilePhoto=photo; data.coverImage=cover; data.portfolio=portfolio; data.profilePosts=profilePosts;
      if(talent){
        data.talentTypes=formData.getAll("talentType");
        data.categories=(data.categories||"").split(",").map(function(item){return item.trim();}).filter(Boolean);
        data.languages=(data.languages||"").split(",").map(function(item){return item.trim();}).filter(Boolean);
        data.startingRate=Number(data.startingRate||0);
        data.platforms=[["Instagram",data.instagram,data.instagramFollowers],["TikTok",data.tiktok,data.tiktokFollowers],["YouTube",data.youtube,data.youtubeFollowers]].filter(function(item){return item[1]||item[2];}).map(function(item){return {name:item[0],handle:item[1],followers:Number(item[2]||0)};});
        data.services=[[data.service1,data.service1Price],[data.service2,data.service2Price]].filter(function(item){return item[0];}).map(function(item){return {name:item[0],price:Number(item[1]||0)};});
      }else{
        data.brandTags=(data.brandTags||"").split(",").map(function(item){return item.trim();}).filter(Boolean);
      }
      try{var result=await api("/api/me",{method:"PATCH",body:data});STATE.me=result.user;await refreshMarketplaceState();renderNav();showToast("Profile saved");}catch(error){showToast(error.message);}
    };
  };

  discover=function(queryString){
    var params=new URLSearchParams(queryString||"");
    var filters={
      q:params.get("q")||"",
      type:params.get("type")||"",
      country:params.get("country")||"",
      city:params.get("city")||"",
      nationality:params.get("nationality")||"",
      category:params.get("category")||"",
      platform:params.get("platform")||"",
      followers:params.get("followers")||"",
      followersOther:params.get("followersOther")||"",
      price:params.get("price")||"",
      priceOther:params.get("priceOther")||"",
      language:params.get("language")||"",
      availability:params.get("availability")||""
    };
    var talentTypes=["Influencer","Model","Content Creator"];
    var standardCategories=["Fashion","Beauty","Lifestyle","Fitness","UGC","Food","Travel","Tech"];
    var standardPlatforms=["Instagram","TikTok","YouTube"];
    var standardLanguages=["Arabic","English","Japanese","Portuguese","Spanish","French","Hindi","Tagalog","Turkish"];
    var standardAvailability=["Available now","This month"];
    var standardCountries=(STATE.meta&&STATE.meta.countries)||[];
    var standardCities=Object.keys((STATE.meta&&STATE.meta.cities)||{}).reduce(function(all,country){
      return all.concat(STATE.meta.cities[country]||[]);
    },[]);
    function unique(getter){
      var values=[];
      (STATE.talents||[]).forEach(function(talent){
        (getter(talent)||[]).forEach(function(value){
          if(value&&values.indexOf(value)===-1)values.push(value);
        });
      });
      return values.sort();
    }
    function optionsWithDefaults(defaults,fromProfiles){
      var values=defaults.slice();
      fromProfiles.forEach(function(value){
        if(value&&values.indexOf(value)===-1)values.push(value);
      });
      return values;
    }
    function optionList(items,selected){
      return items.map(function(item){
        return "<option value='"+esc(item)+"'"+(item===selected?" selected":"")+">"+esc(item)+"</option>";
      }).join("");
    }
    function optionListWithOther(items,selected){
      return optionList(items.filter(function(item){return item!=="Other";}),selected)+"<option value='Other'"+(selected==="Other"?" selected":"")+">Other</option>";
    }
    function filterCountryOptions(selected){
      return "<option value=''>Any country</option>"+optionList(standardCountries,selected)+"<option value='Other'"+(selected==="Other"?" selected":"")+">Other</option>";
    }
    function matchesOne(value,selected,known){
      if(!selected)return true;
      if(selected==="Other")return !!value&&(value==="Other"||known.indexOf(value)===-1);
      return value===selected;
    }
    function matchesAny(values,selected,known){
      if(!selected)return true;
      return (values||[]).some(function(value){return matchesOne(value,selected,known);});
    }
    function audience(talent){
      var platforms=talent.platforms||[];
      if(filters.platform)platforms=platforms.filter(function(item){return matchesOne(item.name,filters.platform,standardPlatforms);});
      return platforms.reduce(function(total,item){return total+Number(item.followers||0);},0);
    }
    function matches(talent){
      var searchable=[talent.name,talent.bio,(talent.categories||[]).join(" "),(talent.languages||[]).join(" ")].join(" ").toLowerCase();
      var minimumFollowers=filters.followers==="Other"?Number(filters.followersOther||0):Number(filters.followers||0);
      var maximumRate=filters.price==="Other"?Number(filters.priceOther||0):Number(filters.price||0);
      return (!filters.q||searchable.indexOf(filters.q.toLowerCase())!==-1)&&
        matchesAny(talent.talentTypes,filters.type,talentTypes)&&
        matchesOne(talent.country,filters.country,standardCountries)&&
        matchesOne(talent.city,filters.city,standardCities)&&
        matchesOne(talent.nationality,filters.nationality,standardCountries)&&
        matchesAny(talent.categories,filters.category,standardCategories)&&
        matchesAny((talent.platforms||[]).map(function(item){return item.name;}),filters.platform,standardPlatforms)&&
        (!filters.followers||filters.followers==="Other"&&!filters.followersOther||audience(talent)>=minimumFollowers)&&
        (!filters.price||filters.price==="Other"&&!filters.priceOther||Number(talent.startingRate||0)<=maximumRate)&&
        matchesAny(talent.languages,filters.language,standardLanguages)&&
        matchesOne(talent.availability,filters.availability,standardAvailability);
    }
    function currentTalents(){return (STATE.talents||[]).filter(matches);}
    function cards(){
      var results=currentTalents();
      return results.map(talentCard).join("")||pEmpty("No talent matches these filters.");
    }
    function paint(){
      var languages=optionsWithDefaults(standardLanguages,unique(function(talent){return talent.languages||[];}));
      var platforms=optionsWithDefaults(standardPlatforms,unique(function(talent){return (talent.platforms||[]).map(function(item){return item.name;});}));
      var categories=standardCategories;
      shell("<div class='wrap discover-page'><div class='discover-title'><div><span class='eyebrow'>DISCOVER</span><h1>Find the right creative partner.</h1><p class='muted'>Search influencers, models and content creators across markets, categories and platforms.</p></div><div class='discover-count'><b>"+currentTalents().length+"</b><span>profiles</span></div></div>"+
        "<div class='discover-searchbar'><span>⌕</span><input id='fQ' placeholder='Search talent, category or keyword' value='"+esc(filters.q)+"'></div>"+
        "<div class='discoverlayout'><aside class='filters'><div class='filter-head'><h3>Filters</h3><button class='textbtn' id='clearFilters'>Reset</button></div>"+
        "<label>Talent type</label><select id='fType'><option value=''>All talent</option>"+optionListWithOther(talentTypes,filters.type)+"</select>"+
        "<label>Country</label><select id='fCountry'>"+filterCountryOptions(filters.country)+"</select>"+
        "<label>City</label><select id='fCity'>"+cityOptions(filters.country,filters.city)+"</select>"+
        "<label>Nationality</label><select id='fNationality'>"+nationalityOptions(filters.nationality,"Any nationality")+"</select>"+
        "<label>Category</label><select id='fCategory'><option value=''>All categories</option>"+optionListWithOther(categories,filters.category)+"</select>"+
        "<label>Platform</label><select id='fPlatform'><option value=''>Any platform</option>"+optionListWithOther(platforms,filters.platform)+"</select>"+
        "<label>Minimum followers</label><select id='fFollowers'><option value=''>Any audience</option>"+[[10000,"10K+"],[50000,"50K+"],[100000,"100K+"],[250000,"250K+"],[500000,"500K+"],[1000000,"1M+"]].map(function(item){return "<option value='"+item[0]+"'"+(String(item[0])===filters.followers?" selected":"")+">"+item[1]+"</option>";}).join("")+"<option value='Other'"+(filters.followers==="Other"?" selected":"")+">Other</option></select>"+(filters.followers==="Other"?"<input class='filter-custom-input' id='fFollowersOther' type='number' min='0' inputmode='numeric' placeholder='Custom minimum followers' value='"+esc(filters.followersOther||"")+"'>":"")+
        "<label>Maximum starting rate</label><select id='fPrice'><option value=''>Any price</option>"+[250,500,750,1000,1500,2500].map(function(value){return "<option value='"+value+"'"+(String(value)===filters.price?" selected":"")+">Up to "+money(value)+"</option>";}).join("")+"<option value='Other'"+(filters.price==="Other"?" selected":"")+">Other</option></select>"+(filters.price==="Other"?"<input class='filter-custom-input' id='fPriceOther' type='number' min='0' inputmode='decimal' placeholder='Custom maximum USD' value='"+esc(filters.priceOther||"")+"'>":"")+
        "<label>Language</label><select id='fLanguage'><option value=''>Any language</option>"+optionListWithOther(languages,filters.language)+"</select>"+
        "<label>Availability</label><select id='fAvailability'><option value=''>Any availability</option>"+optionListWithOther(standardAvailability,filters.availability)+"</select>"+
        "</aside><section><div class='active-filters' id='activeFilters'></div><div class='cards discovercards' id='discoverCards'>"+cards()+"</div></section></div></div>");
      function readFilters(){
        filters={
          q:document.getElementById("fQ").value,
          type:document.getElementById("fType").value,
          country:document.getElementById("fCountry").value,
          city:document.getElementById("fCity").value,
          nationality:document.getElementById("fNationality").value,
          category:document.getElementById("fCategory").value,
          platform:document.getElementById("fPlatform").value,
          followers:document.getElementById("fFollowers").value,
          followersOther:document.getElementById("fFollowersOther")?document.getElementById("fFollowersOther").value:"",
          price:document.getElementById("fPrice").value,
          priceOther:document.getElementById("fPriceOther")?document.getElementById("fPriceOther").value:"",
          language:document.getElementById("fLanguage").value,
          availability:document.getElementById("fAvailability").value
        };
      }
      function refresh(){
        var items=currentTalents();
        document.querySelector(".discover-count b").textContent=items.length;
        document.getElementById("discoverCards").innerHTML=items.map(talentCard).join("")||pEmpty("No talent matches these filters.");
        var followerLabel=filters.followers==="Other"?(filters.followersOther?Number(filters.followersOther).toLocaleString()+"+ followers":"Custom audience"):filters.followers?Number(filters.followers).toLocaleString()+"+ followers":"";
        var priceLabel=filters.price==="Other"?(filters.priceOther?"Up to "+money(filters.priceOther):"Custom price"):filters.price?"Up to "+money(filters.price):"";
        var labels=[filters.type,filters.country,filters.city,filters.nationality,filters.category,filters.platform,followerLabel,priceLabel,filters.language,filters.availability].filter(Boolean);
        document.getElementById("activeFilters").innerHTML=labels.map(function(label){return "<span>"+esc(label)+"</span>";}).join("");
        bindFavorites();
      }
      document.getElementById("fQ").oninput=function(){readFilters();refresh();};
      ["fType","fCountry","fCity","fNationality","fCategory","fPlatform","fFollowers","fPrice","fLanguage","fAvailability"].forEach(function(id){
        document.getElementById(id).onchange=function(){
          readFilters();
          if(id==="fFollowers"||id==="fPrice"){
            paint();
            return;
          }
          if(id==="fCountry"){
            filters.city="";
            document.getElementById("fCity").innerHTML=cityOptions(filters.country,"");
          }
          refresh();
        };
      });
      ["fFollowersOther","fPriceOther"].forEach(function(id){
        var field=document.getElementById(id);
        if(field)field.oninput=function(){readFilters();refresh();};
      });
      document.getElementById("clearFilters").onclick=function(){
        filters={q:"",type:"",country:"",city:"",nationality:"",category:"",platform:"",followers:"",followersOther:"",price:"",priceOther:"",language:"",availability:""};
        paint();
      };
      refresh();
    }
    paint();
  };

  newCampaign=function(){
    if(!STATE.me||STATE.me.role!=="brand"){location.hash="#/auth?mode=signup";return;}
    var categories=["Fashion","Beauty","Lifestyle","Fitness","UGC","Food","Travel","Tech"];
    shell("<section class='wrap narrow section'><div class='eyebrow'>BRAND WORKSPACE</div><h2>Create Campaign</h2><form class='formcard' id='campaignForm'>"+
      "<input name='name' required maxlength='140' placeholder='Campaign name'>"+
      "<textarea name='description' required maxlength='3000' placeholder='Describe the campaign, creative direction and who is a fit.'></textarea>"+
      "<div class='twocol'><select name='talentType'><option>Influencer / Model / Content Creator</option><option>Influencer</option><option>Model</option><option>Content Creator</option></select><select name='category'>"+categories.map(function(item){return "<option>"+item+"</option>";}).join("")+"</select></div>"+
      "<div class='twocol'><select name='country' id='campCountry'>"+countryOptions("United Arab Emirates")+"</select><select name='city' id='campCity'>"+cityOptions("United Arab Emirates")+"</select></div>"+
      "<div class='twocol'><input name='platform' required placeholder='Platform, e.g. Instagram'><input name='deliverables' required placeholder='Deliverables'></div>"+
      "<div class='threecol'><input name='budgetMin' required type='number' min='1' placeholder='Min budget'><input name='budgetMax' required type='number' min='1' placeholder='Max budget'><input name='slots' required type='number' value='1' min='1' placeholder='Talent count'></div>"+
      "<div class='twocol'><input name='deadline' required type='date'><select name='visibility'><option>Public</option><option>Invite Only</option></select></div>"+
      "<button class='primary'>Publish Campaign</button></form></section>");
    var country=document.getElementById("campCountry"), city=document.getElementById("campCity");
    country.onchange=function(){city.innerHTML=cityOptions(country.value);};
    document.getElementById("campaignForm").onsubmit=async function(event){
      event.preventDefault();
      try{
        await api("/api/campaigns",{method:"POST",body:Object.fromEntries(new FormData(event.target))});
        await refreshMarketplaceState();
        showToast("Campaign published");
        location.hash="#/campaigns";
      }catch(error){showToast(error.message);}
    };
  };

  var originalOnboarding=onboarding;
  var creatorOnboardingObserver=null;
  onboarding=async function(){
    window.__museCreatorSelected=(STATE.me&&STATE.me.talentTypes||[]).indexOf("Content Creator")!==-1;
    if(creatorOnboardingObserver)creatorOnboardingObserver.disconnect();
    function addCreatorChoice(){
      Array.from(document.querySelectorAll(".choice-grid")).forEach(function(grid){
        var input=grid.querySelector("input[name='talentType'][value='Content Creator']");
        if(input){
          input.onchange=function(){window.__museCreatorSelected=input.checked;};
          return;
        }
        grid.insertAdjacentHTML("beforeend","<label class='choice content-creator-choice'><input type='checkbox' name='talentType' value='Content Creator'"+(window.__museCreatorSelected?" checked":"")+"><span><b>Content Creator</b><small>UGC, editorial and brand content</small></span></label>");
        input=grid.querySelector("input[name='talentType'][value='Content Creator']");
        if(input)input.onchange=function(){window.__museCreatorSelected=input.checked;};
      });
    }
    await originalOnboarding();
    addCreatorChoice();
    creatorOnboardingObserver=new MutationObserver(function(){addCreatorChoice();});
    creatorOnboardingObserver.observe(app,{childList:true,subtree:true});
  };

  route=async function(){
    window.scrollTo(0,0);
    var raw=location.hash.replace(/^#/,"")||"/";
    var split=raw.split("?"), path=split[0], queryString=split[1]||"";
    try{
      if(path==="/")return home();
      if(path==="/discover")return discover(queryString);
      if(path==="/campaigns")return campaigns();
      if(path==="/campaigns/new")return newCampaign();
      if(path==="/for-you")return forYou();
      if(path==="/dashboard")return dashboard();
      if(path==="/deals")return deals();
      if(path==="/messages")return messages();
      if(path==="/settings")return settings();
      if(path==="/onboarding")return onboarding();
      if(path==="/admin")return admin();
      if(path==="/auth")return auth(queryString);
      var match;
      if((match=path.match(/^\/talent\/([^/]+)$/)))return talentProfile(match[1]);
      if((match=path.match(/^\/brand\/([^/]+)$/)))return brandProfile(match[1]);
      if((match=path.match(/^\/campaign\/([^/]+)$/)))return campaignDetail(match[1]);
      if((match=path.match(/^\/deal\/([^/]+)$/)))return dealRoom(match[1]);
      if((match=path.match(/^\/chat\/([^/]+)$/)))return chatRoom(match[1]);
      return notFound();
    }catch(error){
      console.error(error);
      shell("<section class='wrap section'><h2>Something went wrong.</h2><p class='muted'>"+esc(error.message)+"</p><a href='#/'>Back home</a></section>");
    }
  };

  /* app.js calls boot() before this enhancement layer loads.  Let that
     completed boot initialise STATE.meta and then render through this route. */
})();

/* Suggested people and Connect live in their own lightweight discovery flow.
   A Connect never creates a deal by itself: the recipient accepts first, then
   MUSE opens an on-platform chat. */
(function(){
  function ratingMarkup(person){
    var count=Number(person&&person.reviewCount||0), rating=Number(person&&person.rating||0);
    if(!count)return "<span class='rating rating-empty'>New on MUSE</span>";
    return "<span class='rating' aria-label='"+rating+" out of 5 from "+count+" reviews'>★ "+rating.toFixed(1)+" <small>("+count+")</small></span>";
  }
  museRating=ratingMarkup;
  function peerHref(person){return "#/"+(person.role==="brand"?"brand":"talent")+"/"+encodeURIComponent(person.id);}
  function suggestionCard(person,index,total){
    var image=person.profilePhoto?"style=\"background-image:url('"+esc(person.profilePhoto)+"')\"":"";
    var kind=person.role==="brand"?(person.industry||"Brand"):(person.talentTypes||[]).join(" · ")||"Talent";
    var supporting=person.role==="brand"
      ?(person.brandFocus||"Open to the right creative partnerships.")
      :((person.categories||[]).join(" · ")||"Creative profile")+(person.startingRate?" · From "+money(person.startingRate):"");
    return "<article class='for-you-card' id='suggestionCard'><div class='for-you-progress'><span>"+(index+1)+" / "+total+"</span><span>Suggested for you</span></div><a class='for-you-image "+(person.profilePhoto?"profile-photo-img":"for-you-placeholder")+"' href='"+peerHref(person)+"' "+image+">"+(person.profilePhoto?"":"<span>"+esc((person.name||"M").slice(0,1))+"</span>")+"</a><div class='for-you-body'><div class='eyebrow'>FOR YOU</div><div class='for-you-title'><div><h2>"+esc(person.name)+(person.verified?" <span class='verified'>✓</span>":"")+"</h2><p>"+esc(kind)+" · "+esc([person.city,person.country].filter(Boolean).join(", ")||"Location not added")+"</p></div>"+ratingMarkup(person)+"</div><p class='small-lead'>"+esc(supporting)+"</p><div class='tags'>"+((person.categories||person.brandTags||[]).slice(0,4).map(function(tag){return "<span class='tag'>"+esc(tag)+"</span>";}).join(""))+"</div><p class='muted for-you-hint'>Swipe up to skip, or view the profile to explore a collaboration.</p><div class='for-you-actions'><button class='ghost' id='skipSuggestion'>Skip ↑</button><button class='primary' id='connectSuggestion'>Connect</button></div></div></article>";
  }
  forYou=async function(){
    if(!STATE.me){location.hash="#/auth?mode=signup";return;}
    if(!STATE.me.onboardingComplete){location.hash="#/onboarding";return;}
    var result=await api("/api/for-you"), cards=result.cards||[], current=0;
    shell("<section class='wrap for-you-page'><div class='for-you-heading'><div><span class='eyebrow'>FOR YOU</span><h1>Suggested creative partners.</h1><p class='muted'>Brands send offers. Talent can review brand profiles, apply to campaigns and respond to offers.</p></div><a class='ghost' href='#/discover'>Browse all</a></div><div id='forYouStage'></div></section>");
    var stage=document.getElementById("forYouStage");
    function next(message){
      current+=1;
      if(message)showToast(message);
      paint();
    }
    function paint(){
      if(!cards.length||current>=cards.length){stage.innerHTML="<div class='empty for-you-finished'><b>You're all caught up.</b><p>New public profiles will appear here as people join MUSE.</p><a class='primary' href='#/discover'>Browse Discover</a></div>";return;}
      var person=cards[current];
      stage.innerHTML=suggestionCard(person,current,cards.length);
      document.getElementById("skipSuggestion").onclick=function(){next("Skipped");};
      document.getElementById("connectSuggestion").textContent=STATE.me.role==="brand"?"View & send offer":"View brand & campaigns";
      document.getElementById("connectSuggestion").onclick=function(){location.hash=peerHref(person);};
      var card=document.getElementById("suggestionCard"), startY=null;
      card.addEventListener("touchstart",function(event){startY=event.touches[0].clientY;},{passive:true});
      card.addEventListener("touchend",function(event){if(startY!==null&&startY-event.changedTouches[0].clientY>54)next("Skipped");startY=null;},{passive:true});
    }
    paint();
  };
  deals=async function(){
    if(!STATE.me){location.hash="#/auth";return;}
    var results=await Promise.all([api("/api/deals"),api("/api/connections")]);
    var dealsList=results[0].deals||[], connections=results[1].connections||[], me=STATE.me;
    function connectionRow(item){
      var other=item.other||{}, incoming=item.initiator_id!==me.id, href=peerHref(other);
      var action="<a class='ghost small' href='"+href+"'>View profile</a>";
      if(item.status==="Pending")action="<a class='ghost small' href='#/dashboard'>Review offers</a>";
      else if(item.status==="Connected"&&item.chatId)action="<a class='primary small' href='#/chat/"+encodeURIComponent(item.chatId)+"'>Open chat</a>";
      else if(item.status==="Pending")action="<span class='status'>Connection sent</span>";
      else action="<span class='status'>"+esc(item.status)+"</span>";
      return "<div class='dealrow connection-row'><a class='grow' href='"+href+"'><b>"+esc(other.name||"MUSE member")+"</b><div class='mini'>"+esc(other.role==="brand"?(other.industry||"Brand"):(other.talentTypes||[]).join(" · ")||"Talent")+" · "+ratingMarkup(other)+"</div><div class='mini'>"+(incoming?"Wants to connect with you":"Your connection")+"</div></a>"+action+"</div>";
    }
    shell("<section class='wrap section'><div class='eyebrow'>DEALS & CONNECTIONS</div><h2>Your collaborations.</h2><a class='primary' href='#/dashboard'>Review offers</a><div class='sectionhead topgap'><div><h3>Connections</h3><p class='muted'>New collaborations begin with a brand offer. Review offers in your workspace.</p></div><a class='ghost small' href='#/for-you'>For You</a></div><div class='campaignlist'>"+(connections.map(connectionRow).join("")||"<div class='empty'>No connections yet. Use For You to meet someone new.</div>")+"</div><div class='sectionhead topgap'><div><h3>Deal rooms</h3></div></div><div class='campaignlist'>"+(dealsList.map(function(item){return "<a class='dealrow' href='#/deal/"+encodeURIComponent(item.id)+"'><div><b>"+esc(item.title)+"</b><div class='mini'>"+esc(item.deliverables||"Deliverables to be added")+" · Due "+esc(item.deadline||"Not set")+"</div><div class='mini'>Payment: "+esc(item.payment_status||"Not set")+"</div></div><div><span class='status'>"+esc(item.status)+"</span> <b>"+money(item.agreed_price)+"</b></div></a>";}).join("")||"<div class='empty'>No deals yet.</div>")+"</div></section>");
    Array.from(document.querySelectorAll("[data-connection]")).forEach(function(button){button.onclick=async function(){try{var result=await api("/api/connections/"+encodeURIComponent(button.dataset.connection)+"/respond",{method:"POST",body:{status:button.dataset.connectionStatus}});showToast(result.status==="Connected"?"Chat opened":"Connection passed");if(result.chatId)location.hash="#/chat/"+encodeURIComponent(result.chatId);else deals();}catch(error){showToast(error.message);}};});
  };
})();

/* The Deal Room is where an introduction becomes a traceable collaboration.
   Payment remains tracking-only until MUSE is connected to a payment provider. */
(function(){
  function dealDate(value){
    if(!value)return "Not recorded";
    var date=new Date(value);
    return isNaN(date.getTime())?esc(value):date.toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"});
  }
  function dealStatus(value){return "<span class='status'>"+esc(value||"Not set")+"</span>";}
  function dealFile(item){return item.file_url?"<a class='file-link' href='"+esc(item.file_url)+"' target='_blank' rel='noopener'>📎 "+esc(item.file_name||"Attachment")+"</a>":"";}
  function openDealModal(content){var host=document.getElementById("dealModalHost");host.innerHTML="<div class='modalback'>"+content+"</div>";var close=document.getElementById("closeModal");if(close)close.onclick=function(){host.innerHTML="";};return host;}
  function paymentReceipt(deal){
    var lines=["MUSE PAYMENT RECORD","", "Deal: "+deal.title,"Amount: "+money(deal.agreed_price),"Payment status: "+(deal.payment_status||"Not set"),"Plan: "+(deal.payment_plan||"Not set"),"Recorded: "+new Date().toLocaleString(),"", "This is a MUSE tracking record for an external payment. It is not a tax invoice or proof that MUSE processed funds."];
    var link=document.createElement("a");link.href=URL.createObjectURL(new Blob([lines.join("\n")],{type:"text/plain"}));link.download="MUSE-payment-record-"+String(deal.id||"deal")+".txt";link.click();setTimeout(function(){URL.revokeObjectURL(link.href);},1000);
  }
  chatRoom=async function(id){
    if(!STATE.me){location.hash="#/auth";return;}
    var result=await api("/api/chats/"+encodeURIComponent(id));
    var request=result.request, chatMessages=result.messages||[];
    var other=STATE.me.role==="brand"?request.talent_name:request.brand_name;
    var offerAction=STATE.me.role==="brand"?"<button class='primary' id='chatOfferBtn'>Send offer</button>":"";
    shell("<section class='wrap section'><div class='dealroomhead'><div><div class='eyebrow'>MUSE CHAT</div><h2>"+esc(other)+"</h2><p class='muted'>Keep messages, files and deal terms in MUSE.</p></div><div class='inline'>"+offerAction+"<a class='ghost' href='#/messages'>All messages</a></div></div><div class='chat-room box'><div class='chat-safety'><b>Protected conversation</b><span>Phone numbers, email addresses, external links and off-platform contact requests are blocked. Use Send offer when you agree on the work.</span></div><div class='chat-context'>"+(request.note?"Original request: "+esc(request.note):"Connected through MUSE.")+"</div><div class='messages' id='chatMessages'>"+(chatMessages.map(function(item){return "<div class='msg "+(item.from_user===STATE.me.id?"me":"")+"'><b>"+(item.from_user===STATE.me.id?"You":esc(item.from_name))+"</b><br>"+esc(item.text||"")+dealFile(item)+"</div>";}).join("")||"<p class='muted'>Say hello and keep the collaboration in MUSE.</p>")+"</div><form class='messageform' id='chatForm'><input name='text' maxlength='5000' placeholder='Write a message inside MUSE...'><button class='primary'>Send</button></form><div class='uploadbox topgap'><label class='mini'>Attach a file<input type='file' id='chatFile'></label></div></div></section><div id='dealModalHost'></div>");
    var filePayload=null, fileInput=document.getElementById("chatFile");
    fileInput.onchange=async function(){var file=fileInput.files[0];if(!file)return;try{filePayload=await uploadFile(file);showToast("File ready to send");}catch(error){showToast(error.message);fileInput.value="";}};
    document.getElementById("chatForm").onsubmit=async function(event){event.preventDefault();var text=event.target.text.value.trim();if(!text&&!filePayload)return;try{await api("/api/requests/"+encodeURIComponent(id)+"/messages",{method:"POST",body:{text:text,fileName:filePayload&&filePayload.name,fileUrl:filePayload&&filePayload.url}});chatRoom(id);}catch(error){showToast(error.message);}};
    var offerButton=document.getElementById("chatOfferBtn");
    if(offerButton)offerButton.onclick=function(){
      var host=openDealModal("<form class='modal' id='chatOfferForm'><span class='eyebrow'>SEND OFFER</span><h2>Make it a MUSE deal</h2><input name='title' required maxlength='160' placeholder='Offer title'><textarea name='details' required maxlength='3000' placeholder='Job details'></textarea><input name='deliverables' required maxlength='1200' placeholder='Deliverables'><div class='twocol'><input name='date' type='date' required><input name='price' type='number' min='1' required placeholder='Offered price USD'></div><label class='deal-terms-check'><input type='checkbox' name='agreeToTerms' required> I confirm these terms are accurate and this collaboration stays in MUSE.</label><button class='primary full'>Send offer</button><button type='button' class='ghost full' id='closeModal'>Cancel</button></form>");
      document.getElementById("chatOfferForm").onsubmit=async function(event){event.preventDefault();var data=Object.fromEntries(new FormData(event.target));data.talentId=request.talent_id;data.agreeToTerms=data.agreeToTerms==="on";try{await api("/api/offers",{method:"POST",body:data});host.innerHTML="";showToast("Offer sent");}catch(error){showToast(error.message);}};
    };
  };
  dealRoom=async function(id){
    if(!STATE.me){location.hash="#/auth";return;}
    var result=await api("/api/deals/"+encodeURIComponent(id));
    var deal=result.deal, messages=result.messages||[], deliveries=result.deliveries||[], revisions=result.revisions||[], disputes=result.disputes||[], reviews=result.reviews||[];
    var isBrand=STATE.me.role==="brand", isTalent=STATE.me.role==="talent", closed=deal.status==="Completed"||deal.status==="Cancelled", activeDispute=disputes.find(function(item){return item.status==="Open";});
    var paymentStatus=deal.payment_status||"Not set", paymentPlan=deal.payment_plan||"Not set", canPlan=paymentStatus==="Not set"||paymentStatus==="Planned";
    var deliveryRows=deliveries.map(function(item){return "<article class='work-entry'><div><b>Submitted "+dealDate(item.created_at)+"</b><p>"+esc(item.note||"Work uploaded")+"</p>"+dealFile(item)+"</div>"+dealStatus(item.status)+"</article>";}).join("")||"<p class='muted'>No work has been submitted yet.</p>";
    var revisionRows=revisions.map(function(item){return "<article class='work-entry'><div><b>Revision requested "+dealDate(item.created_at)+"</b><p>"+esc(item.note)+"</p></div>"+dealStatus(item.status)+"</article>";}).join("")||"<p class='muted'>No revision requests.</p>";
    var reviewRows=reviews.map(function(item){return "<article class='review-entry'><b>"+esc(item.from_name)+"</b><span>"+"★".repeat(Number(item.rating||0))+"</span>"+(item.comment?"<p>"+esc(item.comment)+"</p>":"")+"</article>";}).join("")||"<p class='muted'>Reviews appear after the deal closes.</p>";
    var statusActions="";
    if(!closed&&!activeDispute){
      if(deal.status==="Accepted"||deal.status==="Revision Requested")statusActions+="<button class='primary' data-deal-status='In Progress'>Start work</button>";
      if(isBrand&&deal.status==="Submitted")statusActions+="<button class='ghost' id='requestRevisionBtn'>Request revision</button><button class='primary' data-deal-status='Approved'>Approve work</button>";
      if(isBrand&&deal.status==="Approved")statusActions+="<button class='primary' data-deal-status='Completed'>Complete deal</button>";
      statusActions+="<button class='ghost danger-action' id='cancelDealBtn'>Cancel deal</button>";
    }
    var paymentControls=canPlan?"<form class='payment-form' id='paymentPlanForm'><label>Payment plan<select name='paymentPlan'><option "+(paymentPlan==="Full"?"selected":"")+">Full</option><option "+(paymentPlan==="Deposit"?"selected":"")+">Deposit</option><option "+(paymentPlan==="Milestones"?"selected":"")+">Milestones</option></select></label><label>Tracking note<textarea name='paymentNote' maxlength='800' placeholder='Optional timing or milestone note'></textarea></label><button class='ghost small'>Save payment plan</button></form>":"<div class='payment-summary'><span>Plan</span><b>"+esc(paymentPlan)+"</b>"+(deal.payment_note?"<p>"+esc(deal.payment_note)+"</p>":"")+"</div>";
    var paymentAction="";
    if(isBrand&&paymentStatus==="Planned")paymentAction="<button class='primary full' id='markTransferBtn'>Mark transfer sent</button>";
    if(isTalent&&paymentStatus==="Transfer Sent")paymentAction="<button class='primary full' id='confirmPaymentBtn'>Confirm receipt</button>";
    if(paymentStatus==="Received")paymentAction="<button class='ghost full' id='downloadReceiptBtn'>Download payment record</button>";
    var myReview=reviews.some(function(item){return item.author_id===STATE.me.id;});
    var reviewForm=closed&&!myReview?"<form class='review-form' id='reviewForm'><label>How was the collaboration?<select name='rating' required><option value='5'>5 stars</option><option value='4'>4 stars</option><option value='3'>3 stars</option><option value='2'>2 stars</option><option value='1'>1 star</option></select></label><textarea name='comment' maxlength='1000' placeholder='Optional review for future MUSE members'></textarea><button class='primary small'>Leave review</button></form>":"";
    var supportBlock=activeDispute?"<div class='support-open'><b>Support case open</b><p>"+esc(activeDispute.reason)+"</p><span class='mini'>MUSE review in progress</span></div>":(!closed?"<button class='ghost small' id='openDisputeBtn'>Open support case</button>":"");
    var deliveryForm=isTalent&&!closed&&!activeDispute?"<form class='delivery-form' id='deliveryForm'><textarea name='note' maxlength='1800' placeholder='What are you submitting?'></textarea><div class='inline'><label class='uploadbox mini'>Attach final work<input type='file' id='deliveryFile'></label><button class='primary'>Submit work</button></div></form>":"";
    shell("<section class='wrap section'><div class='dealroomhead'><div><div class='eyebrow'>MUSE DEAL ROOM</div><h2>"+esc(deal.title)+"</h2><p class='muted'>"+dealStatus(deal.status)+" · all messages and files stay inside MUSE.</p></div><div class='inline'>"+statusActions+"<a class='ghost' href='#/deals'>All deals</a></div></div><div class='dealgrid deal-grid-v2'><section class='deal-main'><div class='box chat'><div class='chat-safety'><b>Protected Deal Room</b><span>Contact details and external links are blocked to keep this collaboration protected in MUSE.</span></div><div class='messages' id='dealMessages'>"+(messages.map(function(item){return "<div class='msg "+(item.from_user===STATE.me.id?"me":"")+"'><b>"+(item.from_user===STATE.me.id?"You":esc(item.from_name))+"</b><br>"+esc(item.text||"")+dealFile(item)+"</div>";}).join("")||"<p class='muted'>Use this room to manage the agreed collaboration.</p>")+"</div><form class='messageform' id='dealMessageForm'><input name='text' maxlength='5000' placeholder='Write a message inside MUSE...'><button class='primary'>Send</button></form><div class='uploadbox topgap'><label class='mini'>Attach a file<input type='file' id='dealFile'></label></div></div><div class='box workroom'><div class='sectionhead compact'><div><div class='eyebrow'>WORKROOM</div><h3>Deliveries</h3></div>"+dealStatus(deal.status)+"</div><div class='work-list'>"+deliveryRows+"</div>"+deliveryForm+"</div><div class='box workroom'><div class='eyebrow'>REVISIONS</div><div class='work-list'>"+revisionRows+"</div></div><div class='box'><div class='eyebrow'>REVIEWS</div><div class='review-list'>"+reviewRows+"</div>"+reviewForm+"</div></section><aside class='deal-sidebar'><div class='box agreement-card'><div class='eyebrow'>DEAL RECORD</div><div class='budget'>"+money(deal.agreed_price)+"</div><p><b>Deliverables</b><br>"+esc(deal.deliverables||"Not set")+"</p><p><b>Deadline</b><br>"+esc(deal.deadline||"Not set")+"</p><div class='agreement-accepted'><span>✓ Brand accepted</span><small>"+dealDate(deal.brand_accepted_at)+"</small><span>✓ Talent accepted</span><small>"+dealDate(deal.talent_accepted_at)+"</small></div><p class='mini'>"+esc(deal.terms_version||"MUSE Deal Terms v1.0")+" · recorded agreement, not legal advice.</p></div><div class='box payment-tracker'><div class='eyebrow'>PAYMENT TRACKING</div><div class='payment-status-row'>"+dealStatus(paymentStatus)+"<span class='mini'>"+(paymentStatus==="Received"?"Receipt confirmed":paymentStatus==="Transfer Sent"?"Waiting for confirmation":paymentStatus==="Planned"?"Plan saved":"Set a plan to begin")+"</span></div><p class='muted'>MUSE records the payment flow here. It does not collect card details or hold funds in this version.</p>"+paymentControls+paymentAction+"</div><div class='box'><div class='eyebrow'>MUSE SUPPORT</div><p class='muted'>If something is not right, open a support case. The room is frozen while it is reviewed.</p>"+supportBlock+"</div></aside></div></section><div id='dealModalHost'></div>");
    Array.from(document.querySelectorAll("[data-deal-status]")).forEach(function(button){button.onclick=async function(){try{await api("/api/deals/"+encodeURIComponent(id)+"/status",{method:"POST",body:{status:button.dataset.dealStatus}});showToast("Deal updated");dealRoom(id);}catch(error){showToast(error.message);}};});
    var messageFile=null, messageInput=document.getElementById("dealFile");
    messageInput.onchange=async function(){var file=messageInput.files[0];if(!file)return;try{messageFile=await uploadFile(file);showToast("File ready to send");}catch(error){showToast(error.message);messageInput.value="";}};
    document.getElementById("dealMessageForm").onsubmit=async function(event){event.preventDefault();var text=event.target.text.value.trim();if(!text&&!messageFile)return;try{await api("/api/deals/"+encodeURIComponent(id)+"/messages",{method:"POST",body:{text:text,fileName:messageFile&&messageFile.name,fileUrl:messageFile&&messageFile.url}});dealRoom(id);}catch(error){showToast(error.message);}};
    var deliveryFile=null, deliveryInput=document.getElementById("deliveryFile");
    if(deliveryInput)deliveryInput.onchange=async function(){var file=deliveryInput.files[0];if(!file)return;try{deliveryFile=await uploadFile(file);showToast("Delivery file ready");}catch(error){showToast(error.message);deliveryInput.value="";}};
    var deliveryFormNode=document.getElementById("deliveryForm");
    if(deliveryFormNode)deliveryFormNode.onsubmit=async function(event){event.preventDefault();var note=new FormData(event.target).get("note");try{await api("/api/deals/"+encodeURIComponent(id)+"/deliveries",{method:"POST",body:{note:note,fileName:deliveryFile&&deliveryFile.name,fileUrl:deliveryFile&&deliveryFile.url}});showToast("Work submitted for review");dealRoom(id);}catch(error){showToast(error.message);}};
    var planForm=document.getElementById("paymentPlanForm");
    if(planForm)planForm.onsubmit=async function(event){event.preventDefault();try{await api("/api/deals/"+encodeURIComponent(id)+"/payment/plan",{method:"POST",body:Object.fromEntries(new FormData(event.target))});showToast("Payment plan saved");dealRoom(id);}catch(error){showToast(error.message);}};
    var sent=document.getElementById("markTransferBtn");if(sent)sent.onclick=async function(){try{await api("/api/deals/"+encodeURIComponent(id)+"/payment/sent",{method:"POST",body:{}});showToast("Transfer marked as sent");dealRoom(id);}catch(error){showToast(error.message);}};
    var received=document.getElementById("confirmPaymentBtn");if(received)received.onclick=async function(){try{await api("/api/deals/"+encodeURIComponent(id)+"/payment/received",{method:"POST",body:{}});showToast("Payment receipt confirmed");dealRoom(id);}catch(error){showToast(error.message);}};
    var receipt=document.getElementById("downloadReceiptBtn");if(receipt)receipt.onclick=function(){paymentReceipt(deal);};
    var revisionButton=document.getElementById("requestRevisionBtn");
    if(revisionButton)revisionButton.onclick=function(){var host=openDealModal("<form class='modal' id='revisionForm'><span class='eyebrow'>REQUEST REVISION</span><h2>What needs changing?</h2><textarea name='note' required maxlength='1800' placeholder='Describe the revision clearly'></textarea><button class='primary full'>Send revision request</button><button type='button' class='ghost full' id='closeModal'>Cancel</button></form>");document.getElementById("revisionForm").onsubmit=async function(event){event.preventDefault();try{await api("/api/deals/"+encodeURIComponent(id)+"/revisions",{method:"POST",body:Object.fromEntries(new FormData(event.target))});host.innerHTML="";showToast("Revision request sent");dealRoom(id);}catch(error){showToast(error.message);}};};
    var cancelButton=document.getElementById("cancelDealBtn");
    if(cancelButton)cancelButton.onclick=function(){var host=openDealModal("<form class='modal' id='cancelForm'><span class='eyebrow'>CANCEL DEAL</span><h2>Close this deal?</h2><p class='muted'>Both sides can leave a review once it is cancelled.</p><textarea name='reason' maxlength='1000' placeholder='Optional cancellation reason'></textarea><button class='primary full'>Cancel deal</button><button type='button' class='ghost full' id='closeModal'>Keep deal</button></form>");document.getElementById("cancelForm").onsubmit=async function(event){event.preventDefault();try{await api("/api/deals/"+encodeURIComponent(id)+"/cancel",{method:"POST",body:Object.fromEntries(new FormData(event.target))});host.innerHTML="";showToast("Deal cancelled — reviews are now open");dealRoom(id);}catch(error){showToast(error.message);}};};
    var disputeButton=document.getElementById("openDisputeBtn");
    if(disputeButton)disputeButton.onclick=function(){var host=openDealModal("<form class='modal' id='disputeForm'><span class='eyebrow'>MUSE SUPPORT</span><h2>What needs support?</h2><textarea name='reason' required maxlength='1800' placeholder='Describe the issue without sharing contact details'></textarea><button class='primary full'>Open support case</button><button type='button' class='ghost full' id='closeModal'>Cancel</button></form>");document.getElementById("disputeForm").onsubmit=async function(event){event.preventDefault();try{await api("/api/deals/"+encodeURIComponent(id)+"/disputes",{method:"POST",body:Object.fromEntries(new FormData(event.target))});host.innerHTML="";showToast("Support case opened");dealRoom(id);}catch(error){showToast(error.message);}};};
    var reviewFormNode=document.getElementById("reviewForm");
    if(reviewFormNode)reviewFormNode.onsubmit=async function(event){event.preventDefault();try{await api("/api/deals/"+encodeURIComponent(id)+"/reviews",{method:"POST",body:Object.fromEntries(new FormData(event.target))});showToast("Review saved");dealRoom(id);}catch(error){showToast(error.message);}};
  };
})();

/* Account recovery is kept separate from the legacy auth renderer so the
   public login screen stays compact while reset links remain one-time only. */
(function(){
  var baseAuth=auth;
  function recoveryPage(params){
    var token=params.get("token")||"";
    if(token){
      shell("<section class='authpage auth-v2'><div class='authart'><div class='authcopy'><span class='eyebrow'>MUSE ACCOUNT</span><h1>Choose a new password.</h1><p>This secure link can be used once and expires in one hour.</p></div></div><section class='authcard'><div class='auth-heading'><h2>Reset password</h2><p class='muted'>Use at least 8 characters.</p></div><form class='auth-form' id='resetPasswordForm'><label>New password<input name='password' type='password' minlength='8' required autocomplete='new-password'></label><label>Confirm new password<input name='confirmPassword' type='password' minlength='8' required autocomplete='new-password'></label><button class='primary full'>Save new password</button><a class='ghost full center' href='#/auth'>Back to sign in</a></form></section></section>");
      document.getElementById("resetPasswordForm").onsubmit=async function(event){
        event.preventDefault();
        var values=Object.fromEntries(new FormData(event.target));
        if(values.password!==values.confirmPassword){showToast("Passwords do not match");return;}
        try{await api("/api/auth/password-reset/confirm",{method:"POST",body:{token:token,password:values.password}});showToast("Password updated. Please sign in.");location.hash="#/auth";}catch(error){showToast(error.message);}
      };
      return;
    }
    shell("<section class='authpage auth-v2'><div class='authart'><div class='authcopy'><span class='eyebrow'>MUSE ACCOUNT</span><h1>Get back into MUSE.</h1><p>Enter the email on your account and we will send a one-time reset link.</p></div></div><section class='authcard'><div class='auth-heading'><h2>Forgot password?</h2><p class='muted'>The link expires after one hour.</p></div><form class='auth-form' id='requestResetForm'><label>Email<input name='email' type='email' required autocomplete='email' placeholder='you@example.com'></label><button class='primary full'>Send reset link</button><a class='ghost full center' href='#/auth'>Back to sign in</a></form></section></section>");
    document.getElementById("requestResetForm").onsubmit=async function(event){
      event.preventDefault();
      try{var values=Object.fromEntries(new FormData(event.target));var result=await api("/api/auth/password-reset/request",{method:"POST",body:values});showToast(result.message||"Check your email for a reset link.");}catch(error){showToast(error.message);}
    };
  }
  auth=function(queryString){
    var params=new URLSearchParams(queryString||"");
    if(params.get("mode")==="reset-password")return recoveryPage(params);
    baseAuth(queryString);
    var host=document.getElementById("authFormHost");
    if(!host)return;
    function addForgotLink(){
      var form=host.querySelector("form#authForm");
      if(!form||!form.querySelector("input[autocomplete='current-password']")||form.querySelector(".forgot-password-link"))return;
      form.insertAdjacentHTML("beforeend","<button type='button' class='forgot-password-link' id='forgotPasswordBtn'>Forgot password?</button>");
      var button=document.getElementById("forgotPasswordBtn");
      if(button)button.onclick=function(){location.hash="#/auth?mode=reset-password";};
    }
    addForgotLink();
    var observer=new MutationObserver(addForgotLink);
    observer.observe(host,{childList:true,subtree:true});
  };
})();
