from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
from urllib import request as urlrequest, error as urlerror
from pathlib import Path
import sqlite3, json, hashlib, hmac, secrets, time, os, base64, mimetypes, uuid, math, shutil, re
from data import COUNTRIES, CITIES

ROOT=Path(__file__).resolve().parent
STATIC=ROOT/'static'
# On Render's free web service the source filesystem is ephemeral.  Setting
# MUSE_DATA_DIR to a mounted disk (or moving to Postgres) is therefore required
# for real accounts and uploaded work to survive restarts and deploys.
DATA_DIR=Path(os.environ.get('MUSE_DATA_DIR', str(ROOT))).expanduser()
DB=Path(os.environ.get('MUSE_DB', str(DATA_DIR/'muse.db'))).expanduser()
UPLOADS=Path(os.environ.get('MUSE_UPLOADS_DIR', str(DATA_DIR/'uploads'))).expanduser()
SESSION_DAYS=30
# MUSE is always a real-account marketplace.  Older deployments may still
# have MUSE_DEMO_MODE set, but it is intentionally ignored.
DEMO_MODE=False
SECURE_COOKIES=os.environ.get('MUSE_SECURE_COOKIES','').strip().lower() in ('1','true','yes','on')
MAX_REQUEST_BYTES=8*1024*1024
MAX_UPLOAD_BYTES=6*1024*1024
ALLOWED_UPLOAD_EXTENSIONS={'.jpg','.jpeg','.png','.webp','.gif','.pdf','.doc','.docx','.xls','.xlsx','.ppt','.pptx','.zip'}
RESET_TTL_SECONDS=60*60


def now(): return time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
def uid(prefix): return f"{prefix}_{uuid.uuid4().hex[:14]}"
def db():
    DB.parent.mkdir(parents=True,exist_ok=True)
    c=sqlite3.connect(DB,timeout=10); c.row_factory=sqlite3.Row; c.execute('PRAGMA foreign_keys=ON'); c.execute('PRAGMA busy_timeout=5000'); return c

def clean_text(value,limit=2000):
    return str(value or '').strip()[:limit]

def truthy(value):
    return value is True or str(value or '').strip().lower() in ('1','true','yes','on')

# This is deliberately enforced on the server (not only in the UI), so a
# browser request cannot bypass the marketplace's on-platform communication
# rule.  It is intentionally conservative: if it is unclear whether a message
# is sharing off-platform contact details, MUSE asks the sender to keep it in
# the Deal Room instead.
CONTACT_PATTERNS=(
    ('email', re.compile(r'\b[A-Z0-9._%+-]+\s*(?:@|\(\s*at\s*\)|\[\s*at\s*\]|\bat\b)\s*[A-Z0-9.-]+\s*(?:\.|\bdot\b)\s*[A-Z]{2,}\b',re.I)),
    ('link', re.compile(r'(?:https?://|www\.|\b(?:wa\.me|t\.me|linktr\.ee|bit\.ly|instagram\.com|ig\.me|tiktok\.com|telegram\.me)/)',re.I)),
    ('contact-app', re.compile(r'\b(?:whats\s*app|telegram|snapchat|wechat|kik|viber|signal)\b',re.I)),
    ('social-dm', re.compile(r'\b(?:dm|message|follow)\s*(?:me|us)?\b.{0,45}\b(?:instagram|insta|ig|tiktok|snap|twitter|x)\b|\b(?:instagram|insta|ig|tiktok|snap|twitter|x)\b.{0,30}\b(?:dm|message)\b',re.I)),
)
PHONE_PATTERN=re.compile(r'(?:\+?\d[\s().-]*){8,15}\d')
CONTACT_BLOCK_MESSAGE='To protect both sides, MUSE keeps phone numbers, email addresses, links and off-platform contact requests out of messages. Use the Deal Room instead.'

def contact_match(value):
    text=clean_text(value,6000)
    if not text:return None
    for kind,pattern in CONTACT_PATTERNS:
        if pattern.search(text):return kind
    if PHONE_PATTERN.search(text):return 'phone'
    return None

def record_safety_event(c,user_id,context,match_type):
    # Store the event type only, never the blocked text itself.
    c.execute('INSERT INTO safety_events VALUES(?,?,?,?,?)',(uid('safety'),user_id,context,match_type,now()))

def reject_contact(c,user_id,context,*values):
    for value in values:
        match=contact_match(value)
        if match:
            record_safety_event(c,user_id,context,match)
            return match
    return None

def safe_display_text(value,blocked='Available through MUSE.'):
    text=clean_text(value,6000)
    return blocked if text and contact_match(text) else text

def reset_email_ready():
    return bool(os.environ.get('RESEND_API_KEY','').strip() and os.environ.get('MUSE_EMAIL_FROM','').strip())

def reset_base_url(headers):
    configured=os.environ.get('MUSE_PUBLIC_URL','').strip().rstrip('/')
    if configured:return configured
    host=(headers.get('Host') or '').strip()
    if not host:return ''
    return ('http://' if host.startswith(('localhost','127.0.0.1')) else 'https://')+host

def send_reset_email(email,token,headers):
    """Send a one-time reset link via Resend when the owner configures it."""
    base=reset_base_url(headers)
    if not base or not reset_email_ready():return False
    reset_url=base+'/#/auth?mode=reset-password&token='+token
    payload=json.dumps({
        'from':os.environ['MUSE_EMAIL_FROM'],
        'to':[email],
        'subject':'Reset your MUSE password',
        'html':'<p>We received a request to reset your MUSE password.</p><p><a href="'+reset_url+'">Reset password</a></p><p>This link expires in one hour. If you did not request it, you can ignore this email.</p>'
    }).encode('utf-8')
    request=urlrequest.Request('https://api.resend.com/emails',data=payload,method='POST',headers={'Authorization':'Bearer '+os.environ['RESEND_API_KEY'],'Content-Type':'application/json'})
    try:
        with urlrequest.urlopen(request,timeout=12) as response:
            return 200<=response.status<300
    except (urlerror.URLError,TimeoutError,OSError):
        return False

def money_value(value,minimum=0):
    try:
        amount=float(value)
    except (TypeError,ValueError):
        return None
    if not math.isfinite(amount) or amount<minimum:
        return None
    return round(amount,2)

def whole_number(value,minimum=1):
    try:
        amount=int(value)
    except (TypeError,ValueError):
        return None
    return amount if amount>=minimum else None

def session_cookie(token='',max_age=0):
    parts=[f'muse_session={token}','Path=/','HttpOnly','SameSite=Lax',f'Max-Age={max_age}']
    if SECURE_COOKIES: parts.append('Secure')
    return '; '.join(parts)

def uploaded_url(value):
    value=clean_text(value,300)
    if not value.startswith('/uploads/') or '/' in value[len('/uploads/'):]:return ''
    return value

def upload_file_from_path(path):
    """Return a safe persisted upload for a public /uploads/ request."""
    if not path.startswith('/uploads/'): return None
    filename=path[len('/uploads/'):]
    if not filename or '/' in filename or '\\' in filename: return None
    target=UPLOADS/filename
    return target if target.is_file() else None

def hash_password(password, salt=None):
    salt=salt or secrets.token_hex(16)
    digest=hashlib.pbkdf2_hmac('sha256',password.encode(),salt.encode(),120000).hex()
    return salt+'$'+digest

def verify_password(password, stored):
    try:
        salt,digest=stored.split('$',1)
        actual=hashlib.pbkdf2_hmac('sha256',password.encode(),salt.encode(),120000).hex()
        return hmac.compare_digest(actual,digest)
    except Exception:return False

def ensure_column(c,table,column,definition):
    columns={row['name'] for row in c.execute(f'PRAGMA table_info({table})')}
    if column not in columns:c.execute(f'ALTER TABLE {table} ADD COLUMN {column} {definition}')

def bootstrap_admin(c):
    email=clean_text(os.environ.get('MUSE_BOOTSTRAP_ADMIN_EMAIL',''),254).lower()
    password=os.environ.get('MUSE_BOOTSTRAP_ADMIN_PASSWORD','')
    if not email or not password or len(password)<8:return
    if c.execute('SELECT 1 FROM users WHERE email=?',(email,)).fetchone():return
    name=clean_text(os.environ.get('MUSE_BOOTSTRAP_ADMIN_NAME','MUSE Admin'),120) or 'MUSE Admin'
    add_user(c,uid('admin'),email,password,'admin',name,1,{})

def create_deal_for_offer(c,offer,agreed_price,brand_terms_at=None,talent_terms_at=None):
    existing=c.execute('SELECT id FROM deals WHERE offer_id=?',(offer['id'],)).fetchone()
    if existing:return existing['id']
    deal_id=uid('deal')
    agreed_at=now()
    brand_terms_at=brand_terms_at or offer['terms_accepted_at'] or agreed_at
    talent_terms_at=talent_terms_at or agreed_at
    c.execute(
        '''INSERT INTO deals(
            id,brand_id,talent_id,campaign_id,offer_id,title,agreed_price,
            currency,deliverables,deadline,status,created_at,terms_version,
            brand_accepted_at,talent_accepted_at,usage_rights,usage_duration,
            territory,exclusivity
        ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)''',
        (deal_id,offer['brand_id'],offer['talent_id'],None,offer['id'],offer['title'],agreed_price,offer['currency'],offer['deliverables'],offer['date'],'Accepted',agreed_at,'MUSE Deal Terms v1.0',brand_terms_at,talent_terms_at,offer['usage_rights'] or 'Organic social',offer['usage_duration'] or '3 months',offer['territory'] or 'Campaign market',offer['exclusivity'] or 'None')
    )
    return deal_id

def public_user(row):
    if not row:return None
    d=dict(row); d.pop('password_hash',None)
    p=json.loads(d.pop('profile_json') or '{}'); d.update(p)
    d['verified']=bool(d.get('verified')); d['suspended']=bool(d.get('suspended'))
    if 'onboardingComplete' not in d:
        d['onboardingComplete'] = bool(d.get('bio')) or d.get('role') == 'admin'
    if 'profileVisibility' not in d:
        # Existing accounts retain the visibility they had before this setting
        # was introduced. New accounts start private below.
        d['profileVisibility']='Public'
    return d

def marketplace_user(row):
    """Return the public profile without data that could bypass MUSE."""
    d=public_user(row)
    if not d:return None
    for key in ('email','website','privateContact','contactDetails'):
        d.pop(key,None)
    # Handles identify off-platform accounts.  Public discovery shows audience
    # numbers, while contact remains in MUSE.
    d['platforms']=[
        {'name':clean_text(item.get('name'),50),'followers':money_value(item.get('followers')) or 0}
        for item in d.get('platforms',[]) if isinstance(item,dict) and clean_text(item.get('name'),50)
    ]
    for key in ('bio','brandFocus','agency'):
        if contact_match(d.get(key)):
            d[key]='Details available through MUSE.'
    d['profilePosts']=[
        {'url':uploaded_url(item.get('url')),'caption':'' if contact_match(item.get('caption')) else clean_text(item.get('caption'),300)}
        for item in d.get('profilePosts',[]) if isinstance(item,dict) and uploaded_url(item.get('url'))
    ]
    return d

def marketplace_campaign(row):
    d=dict(row)
    for key in ('name','description','deliverables'):
        if contact_match(d.get(key)):
            d[key]='Available through MUSE.' if key!='name' else 'MUSE campaign'
    return d

def rating_summary(c,user_id):
    row=c.execute('''SELECT COUNT(*) n, AVG(r.rating) average
        FROM deal_reviews r JOIN deals d ON d.id=r.deal_id
        WHERE d.status IN ('Completed','Cancelled') AND (
          (d.brand_id=? AND r.author_id=d.talent_id) OR
          (d.talent_id=? AND r.author_id=d.brand_id)
        )''',(user_id,user_id)).fetchone()
    return {'rating':round(float(row['average'] or 0),1),'reviewCount':int(row['n'] or 0)}

def marketplace_user_with_rating(c,row):
    user=marketplace_user(row)
    if user:
        user.update(rating_summary(c,user['id']))
        user.update(profile_reliability(c,user['id']))
        user['verificationBadges']=verification_summary(c,user['id'])
    return user

def suggestion_score(source,candidate):
    score=10 if candidate.get('verified') else 0
    if source.get('country') and source.get('country')==candidate.get('country'):score+=8
    if source.get('city') and source.get('city')==candidate.get('city'):score+=4
    source_words={str(x).lower() for x in (source.get('brandTags') or source.get('categories') or [])}
    candidate_words={str(x).lower() for x in (candidate.get('categories') or candidate.get('brandTags') or [])}
    score+=min(12,len(source_words & candidate_words)*4)
    score+=min(6,len(candidate.get('portfolio') or [])+len(candidate.get('profilePosts') or []))
    return score

def open_connection_chat(c,brand_id,talent_id,created):
    existing=c.execute('SELECT id,status FROM collaboration_requests WHERE talent_id=? AND brand_id=?',(talent_id,brand_id)).fetchone()
    if existing:
        if existing['status']!='Chat Open':c.execute('UPDATE collaboration_requests SET status=?,updated_at=? WHERE id=?',('Chat Open',created,existing['id']))
        return existing['id']
    chat_id=uid('request')
    c.execute('INSERT INTO collaboration_requests VALUES(?,?,?,?,?,?,?)',(chat_id,talent_id,brand_id,'Chat opened after the talent responded to a brand offer.','Chat Open',created,created))
    return chat_id

def is_live_profile(user):
    """Profiles remain private until their owner completes onboarding."""
    return bool(user and user.get('onboardingComplete') and user.get('profileVisibility','Public')=='Public' and not user.get('suspended'))


# A company workspace can have more than one signed-in brand user.  The
# underlying public brand is still a single profile, while its members share
# campaigns, deals and saved talent without sharing a password.
def workspace_brand_id(c,user):
    if not user or user.get('role')!='brand':
        return user.get('id') if user else None
    member=c.execute("SELECT brand_id FROM company_members WHERE user_id=? AND status='Accepted' ORDER BY created_at DESC LIMIT 1",(user['id'],)).fetchone()
    return member['brand_id'] if member else user['id']

def is_brand_workspace_member(c,user,brand_id):
    if not user or user.get('role')!='brand': return False
    return user['id']==brand_id or bool(c.execute("SELECT 1 FROM company_members WHERE brand_id=? AND user_id=? AND status='Accepted'",(brand_id,user['id'])).fetchone())

def deal_access(c,user,deal):
    if not user or not deal:return False
    if user.get('role')=='admin':return True
    if user.get('id')==deal['talent_id']:return True
    return is_brand_workspace_member(c,user,deal['brand_id'])

def profile_reliability(c,user_id):
    completed=c.execute("SELECT COUNT(*) n FROM deals WHERE status='Completed' AND (brand_id=? OR talent_id=?)",(user_id,user_id)).fetchone()['n']
    cancelled=c.execute("SELECT COUNT(*) n FROM deals WHERE status='Cancelled' AND cancelled_by=?",(user_id,)).fetchone()['n']
    total=int(completed or 0)+int(cancelled or 0)
    score=round(100*int(completed or 0)/total) if total else None
    return {'reliabilityScore':score,'completedDeals':int(completed or 0),'selfCancelledDeals':int(cancelled or 0)}

def verification_summary(c,user_id):
    rows=c.execute("SELECT kind FROM verification_requests WHERE user_id=? AND status='Approved' ORDER BY reviewed_at DESC",(user_id,)).fetchall()
    return [r['kind'] for r in rows]

def record_view(c,entity_type,entity_id,viewer_id,context='profile'):
    if viewer_id and viewer_id!=entity_id:
        c.execute('INSERT INTO activity_views VALUES(?,?,?,?,?,?)',(uid('view'),entity_type,entity_id,viewer_id,context,now()))

def normalise_availability(value):
    values=value if isinstance(value,list) else []
    seen=set(); out=[]
    for item in values[:180]:
        if not isinstance(item,dict):continue
        date=clean_text(item.get('date'),10)
        status=clean_text(item.get('status'),20)
        if not re.fullmatch(r'\d{4}-\d{2}-\d{2}',date) or status not in ('Available','Booked','Tentative'):continue
        if date in seen:continue
        seen.add(date); out.append({'date':date,'status':status})
    return sorted(out,key=lambda item:item['date'])

def normalise_travel(value):
    values=value if isinstance(value,list) else []
    out=[]
    for item in values[:24]:
        if not isinstance(item,dict):continue
        country=clean_text(item.get('country'),120); city=clean_text(item.get('city'),120)
        start=clean_text(item.get('startDate'),10); end=clean_text(item.get('endDate'),10)
        if not country or not city or not re.fullmatch(r'\d{4}-\d{2}-\d{2}',start) or not re.fullmatch(r'\d{4}-\d{2}-\d{2}',end) or end<start:continue
        note=clean_text(item.get('note'),120)
        out.append({'country':country,'city':city,'startDate':start,'endDate':end,'note':'Available through MUSE.' if contact_match(note) else note})
    return sorted(out,key=lambda item:(item['startDate'],item['endDate']))

def travels_to(profile,country,city):
    for trip in profile.get('travelPlans') or []:
        if isinstance(trip,dict) and trip.get('country')==country and trip.get('city')==city:return True
    return False

def match_talent(c,brand,criteria,row):
    talent=marketplace_user_with_rating(c,row)
    if not talent or not is_live_profile(talent):return None
    score=0; reasons=[]
    talent_type=clean_text(criteria.get('talentType'),80)
    category=clean_text(criteria.get('category'),80)
    country=clean_text(criteria.get('country'),120)
    city=clean_text(criteria.get('city'),120)
    max_rate=money_value(criteria.get('maxRate'))
    if talent_type and talent_type in (talent.get('talentTypes') or []):score+=24; reasons.append('Right talent type')
    if category and category in (talent.get('categories') or []):score+=22; reasons.append('Category fit')
    if country and talent.get('country')==country:score+=18; reasons.append('Same market')
    if city and talent.get('city')==city:score+=10; reasons.append('Nearby')
    if country and city and travels_to(talent,country,city):score+=14; reasons.append('Traveling there')
    if max_rate is not None and talent.get('startingRate') and float(talent.get('startingRate'))<=max_rate:score+=12; reasons.append('Within budget')
    if talent.get('availability') in ('Available now','This month'):score+=6; reasons.append('Available')
    if talent.get('verified'):score+=8; reasons.append('Verified')
    if talent.get('rating'):score+=min(6,round(float(talent['rating']))); reasons.append('Strong reviews')
    if not score:score=1; reasons.append('Public profile')
    talent['matchScore']=min(100,score); talent['matchReasons']=reasons[:4]
    return talent

def init_db():
    c=db()
    c.execute('PRAGMA journal_mode=WAL')
    c.executescript('''
    CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,email TEXT UNIQUE NOT NULL,password_hash TEXT NOT NULL,role TEXT NOT NULL,name TEXT NOT NULL,verified INTEGER DEFAULT 0,suspended INTEGER DEFAULT 0,profile_json TEXT DEFAULT '{}',created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS workspace_events(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,title TEXT NOT NULL,date TEXT NOT NULL,kind TEXT NOT NULL,done INTEGER DEFAULT 0,FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE);
    CREATE TABLE IF NOT EXISTS collaboration_checklist(deal_id TEXT NOT NULL,item TEXT NOT NULL,done INTEGER DEFAULT 0,PRIMARY KEY(deal_id,item),FOREIGN KEY(deal_id) REFERENCES deals(id) ON DELETE CASCADE);
    CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id TEXT NOT NULL,expires INTEGER NOT NULL,FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE);
    CREATE TABLE IF NOT EXISTS campaigns(id TEXT PRIMARY KEY,brand_id TEXT NOT NULL,name TEXT NOT NULL,description TEXT,talent_type TEXT,category TEXT,country TEXT,city TEXT,platform TEXT,deliverables TEXT,budget_min REAL,budget_max REAL,currency TEXT DEFAULT 'USD',deadline TEXT,slots INTEGER DEFAULT 1,visibility TEXT DEFAULT 'Public',status TEXT DEFAULT 'Open',created_at TEXT NOT NULL,FOREIGN KEY(brand_id) REFERENCES users(id));
    CREATE TABLE IF NOT EXISTS applications(id TEXT PRIMARY KEY,campaign_id TEXT NOT NULL,talent_id TEXT NOT NULL,proposal TEXT,price REAL,status TEXT DEFAULT 'Applied',created_at TEXT NOT NULL,FOREIGN KEY(campaign_id) REFERENCES campaigns(id),FOREIGN KEY(talent_id) REFERENCES users(id));
    CREATE TABLE IF NOT EXISTS campaign_invites(id TEXT PRIMARY KEY,campaign_id TEXT NOT NULL,talent_id TEXT NOT NULL,status TEXT DEFAULT 'Invited',created_at TEXT NOT NULL,UNIQUE(campaign_id,talent_id),FOREIGN KEY(campaign_id) REFERENCES campaigns(id),FOREIGN KEY(talent_id) REFERENCES users(id));
    CREATE TABLE IF NOT EXISTS offers(id TEXT PRIMARY KEY,brand_id TEXT NOT NULL,talent_id TEXT NOT NULL,title TEXT,details TEXT,deliverables TEXT,date TEXT,price REAL,currency TEXT DEFAULT 'USD',status TEXT DEFAULT 'Pending',created_at TEXT NOT NULL,FOREIGN KEY(brand_id) REFERENCES users(id),FOREIGN KEY(talent_id) REFERENCES users(id));
    CREATE TABLE IF NOT EXISTS deals(id TEXT PRIMARY KEY,brand_id TEXT NOT NULL,talent_id TEXT NOT NULL,campaign_id TEXT,offer_id TEXT,title TEXT,agreed_price REAL,currency TEXT DEFAULT 'USD',deliverables TEXT,deadline TEXT,status TEXT DEFAULT 'Accepted',created_at TEXT NOT NULL,FOREIGN KEY(brand_id) REFERENCES users(id),FOREIGN KEY(talent_id) REFERENCES users(id));
    CREATE TABLE IF NOT EXISTS deal_messages(id TEXT PRIMARY KEY,deal_id TEXT NOT NULL,from_user TEXT NOT NULL,text TEXT,file_name TEXT,file_url TEXT,created_at TEXT NOT NULL,FOREIGN KEY(deal_id) REFERENCES deals(id),FOREIGN KEY(from_user) REFERENCES users(id));
    CREATE TABLE IF NOT EXISTS collaboration_requests(id TEXT PRIMARY KEY,talent_id TEXT NOT NULL,brand_id TEXT NOT NULL,note TEXT,status TEXT DEFAULT 'Pending',created_at TEXT NOT NULL,updated_at TEXT NOT NULL,UNIQUE(talent_id,brand_id),FOREIGN KEY(talent_id) REFERENCES users(id),FOREIGN KEY(brand_id) REFERENCES users(id));
    CREATE TABLE IF NOT EXISTS collaboration_messages(id TEXT PRIMARY KEY,request_id TEXT NOT NULL,from_user TEXT NOT NULL,text TEXT,file_name TEXT,file_url TEXT,created_at TEXT NOT NULL,FOREIGN KEY(request_id) REFERENCES collaboration_requests(id),FOREIGN KEY(from_user) REFERENCES users(id));
    CREATE TABLE IF NOT EXISTS deal_deliveries(id TEXT PRIMARY KEY,deal_id TEXT NOT NULL,submitted_by TEXT NOT NULL,note TEXT,file_name TEXT,file_url TEXT,status TEXT DEFAULT 'Submitted',created_at TEXT NOT NULL,FOREIGN KEY(deal_id) REFERENCES deals(id),FOREIGN KEY(submitted_by) REFERENCES users(id));
    CREATE TABLE IF NOT EXISTS deal_revisions(id TEXT PRIMARY KEY,deal_id TEXT NOT NULL,requested_by TEXT NOT NULL,note TEXT NOT NULL,status TEXT DEFAULT 'Open',created_at TEXT NOT NULL,resolved_at TEXT,FOREIGN KEY(deal_id) REFERENCES deals(id),FOREIGN KEY(requested_by) REFERENCES users(id));
    CREATE TABLE IF NOT EXISTS deal_disputes(id TEXT PRIMARY KEY,deal_id TEXT NOT NULL,opened_by TEXT NOT NULL,reason TEXT NOT NULL,status TEXT DEFAULT 'Open',created_at TEXT NOT NULL,updated_at TEXT NOT NULL,resolution_note TEXT,FOREIGN KEY(deal_id) REFERENCES deals(id),FOREIGN KEY(opened_by) REFERENCES users(id));
    CREATE TABLE IF NOT EXISTS deal_reviews(id TEXT PRIMARY KEY,deal_id TEXT NOT NULL,author_id TEXT NOT NULL,rating INTEGER NOT NULL,comment TEXT,created_at TEXT NOT NULL,UNIQUE(deal_id,author_id),FOREIGN KEY(deal_id) REFERENCES deals(id),FOREIGN KEY(author_id) REFERENCES users(id));
    CREATE TABLE IF NOT EXISTS safety_events(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,context TEXT NOT NULL,match_type TEXT NOT NULL,created_at TEXT NOT NULL,FOREIGN KEY(user_id) REFERENCES users(id));
    CREATE TABLE IF NOT EXISTS password_resets(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,token_hash TEXT NOT NULL,expires INTEGER NOT NULL,used_at TEXT,created_at TEXT NOT NULL,FOREIGN KEY(user_id) REFERENCES users(id));
    CREATE TABLE IF NOT EXISTS connections(id TEXT PRIMARY KEY,brand_id TEXT NOT NULL,talent_id TEXT NOT NULL,initiator_id TEXT NOT NULL,status TEXT DEFAULT 'Pending',created_at TEXT NOT NULL,updated_at TEXT NOT NULL,UNIQUE(brand_id,talent_id),FOREIGN KEY(brand_id) REFERENCES users(id),FOREIGN KEY(talent_id) REFERENCES users(id),FOREIGN KEY(initiator_id) REFERENCES users(id));
    CREATE TABLE IF NOT EXISTS favorites(brand_id TEXT NOT NULL,talent_id TEXT NOT NULL,PRIMARY KEY(brand_id,talent_id));
    CREATE TABLE IF NOT EXISTS shortlists(id TEXT PRIMARY KEY,brand_id TEXT NOT NULL,name TEXT NOT NULL,created_at TEXT NOT NULL,FOREIGN KEY(brand_id) REFERENCES users(id));
    CREATE TABLE IF NOT EXISTS shortlist_talent(shortlist_id TEXT NOT NULL,talent_id TEXT NOT NULL,PRIMARY KEY(shortlist_id,talent_id));
    CREATE TABLE IF NOT EXISTS notifications(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,text TEXT NOT NULL,read INTEGER DEFAULT 0,created_at TEXT NOT NULL,FOREIGN KEY(user_id) REFERENCES users(id));
    CREATE TABLE IF NOT EXISTS activity_views(id TEXT PRIMARY KEY,entity_type TEXT NOT NULL,entity_id TEXT NOT NULL,viewer_id TEXT NOT NULL,context TEXT NOT NULL,created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS verification_requests(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,kind TEXT NOT NULL,status TEXT DEFAULT 'Pending',note TEXT,submitted_at TEXT NOT NULL,reviewed_at TEXT,reviewed_by TEXT,FOREIGN KEY(user_id) REFERENCES users(id));
    CREATE TABLE IF NOT EXISTS campaign_team_members(id TEXT PRIMARY KEY,campaign_id TEXT NOT NULL,talent_id TEXT NOT NULL,team_role TEXT NOT NULL,status TEXT DEFAULT 'Invited',created_at TEXT NOT NULL,updated_at TEXT NOT NULL,UNIQUE(campaign_id,talent_id),FOREIGN KEY(campaign_id) REFERENCES campaigns(id),FOREIGN KEY(talent_id) REFERENCES users(id));
    CREATE TABLE IF NOT EXISTS agency_roster(id TEXT PRIMARY KEY,agency_id TEXT NOT NULL,talent_id TEXT NOT NULL,status TEXT DEFAULT 'Invited',created_at TEXT NOT NULL,updated_at TEXT NOT NULL,UNIQUE(agency_id,talent_id),FOREIGN KEY(agency_id) REFERENCES users(id),FOREIGN KEY(talent_id) REFERENCES users(id));
    CREATE TABLE IF NOT EXISTS company_members(id TEXT PRIMARY KEY,brand_id TEXT NOT NULL,user_id TEXT,email TEXT NOT NULL,member_role TEXT NOT NULL,status TEXT DEFAULT 'Invited',created_at TEXT NOT NULL,updated_at TEXT NOT NULL,UNIQUE(brand_id,email),FOREIGN KEY(brand_id) REFERENCES users(id),FOREIGN KEY(user_id) REFERENCES users(id));
    ''')
    ensure_column(c,'offers','counter_price','REAL')
    ensure_column(c,'offers','counter_note','TEXT')
    ensure_column(c,'offers','countered_at','TEXT')
    ensure_column(c,'offers','terms_accepted_at','TEXT')
    ensure_column(c,'deals','payment_plan',"TEXT DEFAULT 'Not set'")
    ensure_column(c,'deals','payment_status',"TEXT DEFAULT 'Not set'")
    ensure_column(c,'deals','payment_note','TEXT')
    ensure_column(c,'deals','payment_sent_at','TEXT')
    ensure_column(c,'deals','payment_received_at','TEXT')
    ensure_column(c,'deals','terms_version',"TEXT DEFAULT 'MUSE Deal Terms v1.0'")
    ensure_column(c,'deals','brand_accepted_at','TEXT')
    ensure_column(c,'deals','talent_accepted_at','TEXT')
    ensure_column(c,'deals','cancelled_by','TEXT')
    ensure_column(c,'deals','cancelled_at','TEXT')
    ensure_column(c,'deals','cancel_reason','TEXT')
    ensure_column(c,'campaigns','opportunity_type',"TEXT DEFAULT 'Campaign'")
    ensure_column(c,'campaigns','usage_rights',"TEXT DEFAULT 'Organic social'")
    ensure_column(c,'campaigns','usage_duration',"TEXT DEFAULT '3 months'")
    ensure_column(c,'campaigns','territory',"TEXT DEFAULT 'Campaign market'")
    ensure_column(c,'campaigns','exclusivity',"TEXT DEFAULT 'None'")
    ensure_column(c,'campaigns','employment_type','TEXT')
    ensure_column(c,'offers','usage_rights',"TEXT DEFAULT 'Organic social'")
    ensure_column(c,'offers','usage_duration',"TEXT DEFAULT '3 months'")
    ensure_column(c,'offers','territory',"TEXT DEFAULT 'Campaign market'")
    ensure_column(c,'offers','exclusivity',"TEXT DEFAULT 'None'")
    ensure_column(c,'deals','usage_rights',"TEXT DEFAULT 'Organic social'")
    ensure_column(c,'deals','usage_duration',"TEXT DEFAULT '3 months'")
    ensure_column(c,'deals','territory',"TEXT DEFAULT 'Campaign market'")
    ensure_column(c,'deals','exclusivity',"TEXT DEFAULT 'None'")
    bootstrap_admin(c)
    c.commit(); c.close()
    UPLOADS.mkdir(parents=True,exist_ok=True)

def add_user(c,id,email,password,role,name,verified=0,profile=None):
    c.execute('INSERT INTO users VALUES(?,?,?,?,?,?,?,?,?)',(id,email,hash_password(password),role,name,verified,0,json.dumps(profile or {}),now()))

class Handler(SimpleHTTPRequestHandler):
    def __init__(self,*args,**kwargs): super().__init__(*args,directory=str(STATIC),**kwargs)
    def log_message(self,fmt,*args): print('[MUSE]',fmt%args)
    def end_headers(self):
        self.send_header('X-Content-Type-Options','nosniff')
        self.send_header('Referrer-Policy','strict-origin-when-cross-origin')
        self.send_header('Permissions-Policy','camera=(), microphone=(), geolocation=()')
        self.send_header('Content-Security-Policy',"default-src 'self'; connect-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; font-src 'self' data:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'")
        super().end_headers()
    def send_json(self,obj,status=200,cookie=None):
        body=json.dumps(obj,ensure_ascii=False).encode(); self.send_response(status); self.send_header('Content-Type','application/json; charset=utf-8'); self.send_header('Content-Length',str(len(body))); self.send_header('Cache-Control','no-store');
        if cookie:self.send_header('Set-Cookie',cookie)
        self.end_headers(); self.wfile.write(body)
    def body(self):
        try:
            length=int(self.headers.get('Content-Length','0') or 0)
            if length>MAX_REQUEST_BYTES:
                self.send_json({'error':'Request is too large.'},413)
                return None
            return json.loads(self.rfile.read(length) or b'{}')
        except:return {}
    def cookies(self):
        out={}
        for part in (self.headers.get('Cookie') or '').split(';'):
            if '=' in part:
                k,v=part.strip().split('=',1); out[k]=v
        return out
    def me(self,c):
        token=self.cookies().get('muse_session')
        if not token:return None
        row=c.execute('SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? AND s.expires>?',(token,int(time.time()))).fetchone()
        return public_user(row)
    def require(self,c,roles=None):
        u=self.me(c)
        if not u:self.send_json({'error':'Authentication required'},401); return None
        if u.get('suspended'):self.send_json({'error':'Account suspended'},403); return None
        if roles and u['role'] not in roles:self.send_json({'error':'Not allowed'},403); return None
        return u
    def serve_upload(self,path):
        target=upload_file_from_path(path)
        if not target:return self.send_error(404)
        try:
            size=target.stat().st_size
            content_type=mimetypes.guess_type(str(target))[0] or 'application/octet-stream'
            self.send_response(200)
            self.send_header('Content-Type',content_type)
            self.send_header('Content-Length',str(size))
            self.send_header('Cache-Control','private, max-age=3600')
            if target.suffix.lower() not in {'.jpg','.jpeg','.png','.webp','.gif'}:
                self.send_header('Content-Disposition',f'attachment; filename="{target.name}"')
            self.end_headers()
            with target.open('rb') as source: shutil.copyfileobj(source,self.wfile)
        except OSError:
            self.send_error(404)
    def do_GET(self):
        p=urlparse(self.path); path=p.path
        if not path.startswith('/api/'):
            if path.startswith('/uploads/'):
                return self.serve_upload(path)
            if path!='/' and not (STATIC/path.lstrip('/')).exists(): self.path='/index.html'
            return super().do_GET()
        c=db()
        try:
            if path=='/api/meta': return self.send_json({'countries':COUNTRIES,'cities':CITIES,'demoMode':DEMO_MODE,'passwordRecoveryEnabled':reset_email_ready(),'opportunityTypes':['Campaign','Casting','Job'],'verificationTypes':['Identity','Audience','Agency','Company']})
            if path=='/api/me': return self.send_json({'user':self.me(c)})
            if path=='/api/opportunity-map':
                rows=[]
                for r in c.execute("SELECT country,city,opportunity_type,COUNT(*) n FROM campaigns WHERE status='Open' AND visibility='Public' GROUP BY country,city,opportunity_type ORDER BY n DESC,country,city"):
                    rows.append({'country':r['country'] or 'Global','city':r['city'] or 'Online','type':r['opportunity_type'] or 'Campaign','count':int(r['n'] or 0)})
                return self.send_json({'opportunities':rows})
            if path=='/api/analytics':
                u=self.require(c)
                if not u:return
                if u['role']=='brand':
                    wid=workspace_brand_id(c,u)
                    campaign_rows=[]
                    for camp in c.execute('SELECT id,name,opportunity_type,status FROM campaigns WHERE brand_id=? AND status!=? ORDER BY created_at DESC',(wid,'Deleted')):
                        views=c.execute("SELECT COUNT(*) n FROM activity_views WHERE entity_type='campaign' AND entity_id=?",(camp['id'],)).fetchone()['n']
                        apps=c.execute('SELECT COUNT(*) n FROM applications WHERE campaign_id=?',(camp['id'],)).fetchone()['n']
                        team=c.execute("SELECT COUNT(*) n FROM campaign_team_members WHERE campaign_id=? AND status='Accepted'",(camp['id'],)).fetchone()['n']
                        campaign_rows.append({'id':camp['id'],'name':camp['name'],'type':camp['opportunity_type'] or 'Campaign','status':camp['status'],'views':int(views or 0),'applications':int(apps or 0),'teamMembers':int(team or 0)})
                    return self.send_json({'kind':'brand','campaignViews':sum(x['views'] for x in campaign_rows),'applications':sum(x['applications'] for x in campaign_rows),'activeCampaigns':len([x for x in campaign_rows if x['status']=='Open']),'deals':int(c.execute('SELECT COUNT(*) n FROM deals WHERE brand_id=?',(wid,)).fetchone()['n'] or 0),'campaigns':campaign_rows})
                if u['role']=='talent':
                    profile_views=c.execute("SELECT COUNT(*) n FROM activity_views WHERE entity_type='profile' AND entity_id=?",(u['id'],)).fetchone()['n']
                    appearances=c.execute("SELECT COUNT(*) n FROM activity_views WHERE entity_type='impression' AND entity_id=?",(u['id'],)).fetchone()['n']
                    saved=c.execute('SELECT COUNT(*) n FROM favorites WHERE talent_id=?',(u['id'],)).fetchone()['n']
                    connections=c.execute('SELECT COUNT(*) n FROM connections WHERE talent_id=?',(u['id'],)).fetchone()['n']
                    deal_count=c.execute('SELECT COUNT(*) n FROM deals WHERE talent_id=?',(u['id'],)).fetchone()['n']
                    stats=profile_reliability(c,u['id'])
                    return self.send_json({'kind':'talent','profileViews':int(profile_views or 0),'searchAppearances':int(appearances or 0),'savedByBrands':int(saved or 0),'connections':int(connections or 0),'deals':int(deal_count or 0),'reliability':stats})
                if u['role']=='agency':
                    roster=c.execute("SELECT COUNT(*) n FROM agency_roster WHERE agency_id=? AND status='Accepted'",(u['id'],)).fetchone()['n']
                    return self.send_json({'kind':'agency','rosterSize':int(roster or 0)})
                return self.send_json({'kind':'admin'})
            if path=='/api/company':
                u=self.require(c,['brand'])
                if not u:return
                wid=workspace_brand_id(c,u)
                owner=c.execute('SELECT id,name,profile_json FROM users WHERE id=?',(wid,)).fetchone()
                members=[]
                for r in c.execute('SELECT cm.*,u.name user_name,u.email user_email FROM company_members cm LEFT JOIN users u ON u.id=cm.user_id WHERE cm.brand_id=? ORDER BY cm.created_at',(wid,)):
                    members.append({'id':r['id'],'email':r['user_email'] or r['email'],'name':r['user_name'] or '', 'role':r['member_role'],'status':r['status'],'userId':r['user_id']})
                return self.send_json({'brandId':wid,'brandName':owner['name'] if owner else u['name'],'isOwner':u['id']==wid,'members':members})
            if path=='/api/company-invites':
                u=self.require(c,['brand'])
                if not u:return
                rows=[dict(r) for r in c.execute('SELECT cm.*,b.name brand_name FROM company_members cm JOIN users b ON b.id=cm.brand_id WHERE cm.user_id=? AND cm.status=? ORDER BY cm.created_at DESC',(u['id'],'Pending'))]
                return self.send_json({'invites':rows})
            if path=='/api/agency':
                u=self.require(c,['agency'])
                if not u:return
                roster=[]
                for r in c.execute('SELECT ar.*,u.name talent_name,u.profile_json FROM agency_roster ar JOIN users u ON u.id=ar.talent_id WHERE ar.agency_id=? ORDER BY ar.updated_at DESC',(u['id'],)):
                    profile=marketplace_user_with_rating(c,c.execute('SELECT * FROM users WHERE id=?',(r['talent_id'],)).fetchone()) or {}
                    roster.append({'id':r['id'],'talentId':r['talent_id'],'name':r['talent_name'],'status':r['status'],'role':profile.get('talentTypes',[]),'city':profile.get('city'),'country':profile.get('country'),'rating':profile.get('rating'),'reviewCount':profile.get('reviewCount')})
                return self.send_json({'agency':u,'roster':roster})
            if path=='/api/verification-requests':
                u=self.require(c)
                if not u:return
                rows=[dict(r) for r in c.execute('SELECT id,kind,status,note,submitted_at,reviewed_at FROM verification_requests WHERE user_id=? ORDER BY submitted_at DESC',(u['id'],))]
                return self.send_json({'requests':rows})
            if path=='/api/admin/verification-requests':
                u=self.require(c,['admin'])
                if not u:return
                rows=[dict(r) for r in c.execute('SELECT vr.*,u.name user_name,u.email user_email FROM verification_requests vr JOIN users u ON u.id=vr.user_id WHERE vr.status=? ORDER BY vr.submitted_at',('Pending',))]
                return self.send_json({'requests':rows})
            if path.startswith('/api/passport/'):
                tid=path.split('/')[-1]
                row=c.execute("SELECT * FROM users WHERE id=? AND role='talent' AND suspended=0",(tid,)).fetchone()
                talent=marketplace_user_with_rating(c,row); me=self.me(c)
                if not talent or (not is_live_profile(talent) and not (me and (me['id']==tid or me['role']=='admin'))):return self.send_json({'error':'Passport not found'},404)
                return self.send_json({'passport':talent})
            if path.startswith('/api/shortlists/'):
                sid=path.split('/')[-1]; u=self.require(c,['brand'])
                if not u:return
                wid=workspace_brand_id(c,u)
                shortlist=c.execute('SELECT * FROM shortlists WHERE id=? AND brand_id=?',(sid,wid)).fetchone()
                if not shortlist:return self.send_json({'error':'Collection not found'},404)
                people=[]
                for r in c.execute('SELECT u.* FROM shortlist_talent st JOIN users u ON u.id=st.talent_id WHERE st.shortlist_id=?',(sid,)):
                    person=marketplace_user_with_rating(c,r)
                    if person:people.append(person)
                return self.send_json({'collection':dict(shortlist),'talents':people})
            if path=='/api/talents':
                fav=[]; me=self.me(c)
                if me and me['role']=='brand': fav=[r['talent_id'] for r in c.execute('SELECT talent_id FROM favorites WHERE brand_id=?',(workspace_brand_id(c,me),))]
                rows=[u for u in (marketplace_user_with_rating(c,r) for r in c.execute("SELECT * FROM users WHERE role='talent' AND suspended=0 ORDER BY verified DESC, created_at DESC")) if is_live_profile(u)]
                return self.send_json({'talents':rows,'favorites':fav})
            if path.startswith('/api/talents/'):
                r=c.execute("SELECT * FROM users WHERE id=? AND role='talent' AND suspended=0",(path.split('/')[-1],)).fetchone()
                talent=marketplace_user_with_rating(c,r)
                me=self.me(c)
                allowed=bool(talent and (is_live_profile(talent) or (me and (me.get('id')==talent.get('id') or me.get('role')=='admin'))))
                if allowed and me and me.get('id')!=talent.get('id'):
                    record_view(c,'profile',talent['id'],me['id'],'talent-profile'); c.commit()
                return self.send_json({'talent':talent if allowed else None},200 if allowed else 404)
            if path.startswith('/api/brands/'):
                bid=path.split('/')[-1]
                r=c.execute("SELECT * FROM users WHERE id=? AND role='brand' AND suspended=0",(bid,)).fetchone()
                if not r:return self.send_json({'error':'Brand not found'},404)
                brand=marketplace_user_with_rating(c,r)
                me=self.me(c)
                if not is_live_profile(brand) and not (me and (me.get('id')==brand.get('id') or me.get('role')=='admin')):return self.send_json({'error':'Brand not found'},404)
                campaigns=[marketplace_campaign(x) for x in c.execute("SELECT c.*,u.name brand_name,u.verified brand_verified FROM campaigns c JOIN users u ON u.id=c.brand_id WHERE c.brand_id=? AND c.status!='Deleted' AND c.visibility='Public' ORDER BY c.created_at DESC",(bid,))]
                request=None; me=self.me(c)
                if me and me['role']=='talent':
                    request=c.execute('SELECT id,status,note,created_at,updated_at FROM collaboration_requests WHERE talent_id=? AND brand_id=?',(me['id'],bid)).fetchone()
                if me and me.get('id')!=brand.get('id'):
                    record_view(c,'profile',brand['id'],me['id'],'brand-profile'); c.commit()
                return self.send_json({'brand':brand,'campaigns':campaigns,'collaborationRequest':dict(request) if request else None})
            if path=='/api/campaigns':
                me=self.me(c)
                base=[marketplace_campaign(r) for r in c.execute('SELECT c.*,u.name brand_name,u.verified brand_verified FROM campaigns c JOIN users u ON u.id=c.brand_id WHERE c.status!=? ORDER BY c.created_at DESC',('Deleted',))]
                rows=[]
                for row in base:
                    row['invited']=False
                    if row.get('visibility')=='Public': rows.append(row); continue
                    if me and (me.get('role')=='admin' or is_brand_workspace_member(c,me,row.get('brand_id'))): rows.append(row); continue
                    if me and me.get('role')=='talent':
                        inv=c.execute('SELECT status FROM campaign_invites WHERE campaign_id=? AND talent_id=?',(row['id'],me['id'])).fetchone()
                        if inv:
                            row['invited']=True; row['invite_status']=inv['status']; rows.append(row)
                return self.send_json({'campaigns':rows})
            if path.startswith('/api/campaigns/') and path.endswith('/team'):
                cid=path.split('/')[3]; campaign=c.execute('SELECT * FROM campaigns WHERE id=?',(cid,)).fetchone()
                if not campaign:return self.send_json({'error':'Campaign not found'},404)
                me=self.me(c)
                is_owner=bool(me and is_brand_workspace_member(c,me,campaign['brand_id']))
                members=[]
                for r in c.execute('SELECT tm.id AS membership_id,tm.status AS team_status,tm.team_role AS team_role,u.* FROM campaign_team_members tm JOIN users u ON u.id=tm.talent_id WHERE tm.campaign_id=? ORDER BY tm.created_at',(cid,)):
                    person=marketplace_user_with_rating(c,r)
                    if person:members.append({'id':r['membership_id'],'status':r['team_status'],'teamRole':r['team_role'],'talent':person})
                if not is_owner:
                    members=[m for m in members if m['status']=='Accepted']
                return self.send_json({'members':members,'isOwner':is_owner})
            if path.startswith('/api/campaigns/') and path.endswith('/applications'):
                cid=path.split('/')[3]; u=self.require(c,['brand'])
                if not u:return
                camp=c.execute('SELECT * FROM campaigns WHERE id=?',(cid,)).fetchone()
                if not camp or not is_brand_workspace_member(c,u,camp['brand_id']):return self.send_json({'error':'Not allowed'},403)
                items=[]
                for r in c.execute('SELECT a.id AS application_id,a.proposal AS application_proposal,a.price AS application_price,a.status AS application_status,a.created_at AS application_created_at,u.* FROM applications a JOIN users u ON u.id=a.talent_id WHERE a.campaign_id=? ORDER BY a.created_at DESC',(cid,)):
                    talent=marketplace_user_with_rating(c,r)
                    if talent:items.append({'id':r['application_id'],'proposal':safe_display_text(r['application_proposal']),'price':r['application_price'],'status':r['application_status'],'createdAt':r['application_created_at'],'talent':talent})
                return self.send_json({'applications':items})
            if path.startswith('/api/campaigns/'):
                cid=path.split('/')[-1]
                r=c.execute('SELECT c.*,u.name brand_name,u.verified brand_verified FROM campaigns c JOIN users u ON u.id=c.brand_id WHERE c.id=?',(cid,)).fetchone()
                if not r:return self.send_json({'campaign':None},404)
                row=marketplace_campaign(r); me=self.me(c); row['invited']=False
                if row.get('visibility')=='Invite Only':
                    allowed=bool(me and (me.get('role')=='admin' or is_brand_workspace_member(c,me,row.get('brand_id'))))
                    if me and me.get('role')=='talent':
                        inv=c.execute('SELECT status FROM campaign_invites WHERE campaign_id=? AND talent_id=?',(cid,me['id'])).fetchone()
                        if inv: allowed=True; row['invited']=True; row['invite_status']=inv['status']
                    if not allowed:return self.send_json({'error':'This campaign is invite only.'},403)
                if me and me.get('id')!=row.get('brand_id'):
                    record_view(c,'campaign',cid,me['id'],'campaign-detail'); c.commit()
                return self.send_json({'campaign':row})
            if path=='/api/workspace-events':
                u=self.require(c)
                if not u:return
                return self.send_json({'events':[dict(r) for r in c.execute('SELECT id,title,date,kind,done FROM workspace_events WHERE user_id=? ORDER BY date,id',(u['id'],))]})
            if path=='/api/dashboard':
                u=self.require(c); 
                if not u:return
                if u['role']=='brand':
                    wid=workspace_brand_id(c,u)
                    offers=[dict(r) for r in c.execute('SELECT o.*,u.name talent_name FROM offers o JOIN users u ON u.id=o.talent_id WHERE brand_id=? ORDER BY o.created_at DESC',(wid,))]
                    deals=[dict(r) for r in c.execute('SELECT d.*,u.name talent_name FROM deals d JOIN users u ON u.id=d.talent_id WHERE brand_id=? ORDER BY d.created_at DESC',(wid,))]
                    apps=[dict(r) for r in c.execute('SELECT a.*,u.name talent_name,c.name campaign_name FROM applications a JOIN users u ON u.id=a.talent_id JOIN campaigns c ON c.id=a.campaign_id WHERE c.brand_id=? ORDER BY a.created_at DESC',(wid,))]
                    fav=[marketplace_user_with_rating(c,r) for r in c.execute("SELECT u.* FROM favorites f JOIN users u ON u.id=f.talent_id WHERE f.brand_id=?",(wid,))]
                    requests=[]
                    for row in c.execute('SELECT r.*,u.name talent_name,u.verified talent_verified,u.profile_json FROM collaboration_requests r JOIN users u ON u.id=r.talent_id WHERE r.brand_id=? ORDER BY r.updated_at DESC',(wid,)):
                        item=dict(row); item.pop('profile_json',None)
                        profile=marketplace_user_with_rating(c,c.execute('SELECT * FROM users WHERE id=?',(item['talent_id'],)).fetchone()) or {}
                        for key in ('city','country','talentTypes','categories','profilePhoto','rating','reviewCount'):
                            item[key]=profile.get(key)
                        item['note']=safe_display_text(item.get('note'))
                        item['talent_verified']=bool(item.get('talent_verified')); requests.append(item)
                    lists=[]
                    for l in c.execute('SELECT * FROM shortlists WHERE brand_id=?',(wid,)):
                        d=dict(l); d['talentIds']=[x['talent_id'] for x in c.execute('SELECT talent_id FROM shortlist_talent WHERE shortlist_id=?',(l['id'],))]; lists.append(d)
                    company=[dict(x) for x in c.execute('SELECT id,user_id,email,member_role,status FROM company_members WHERE brand_id=? ORDER BY created_at',(wid,))]
                    return self.send_json({'offers':offers,'deals':deals,'applications':apps,'favorites':fav,'shortlists':lists,'collaborationRequests':requests,'workspaceBrandId':wid,'companyMembers':company})
                elif u['role']=='talent':
                    offers=[dict(r) for r in c.execute('SELECT o.*,u.name brand_name FROM offers o JOIN users u ON u.id=o.brand_id WHERE talent_id=? ORDER BY o.created_at DESC',(u['id'],))]
                    deals=[dict(r) for r in c.execute('SELECT d.*,u.name brand_name FROM deals d JOIN users u ON u.id=d.brand_id WHERE talent_id=? ORDER BY d.created_at DESC',(u['id'],))]
                    apps=[dict(r) for r in c.execute('SELECT a.*,c.name campaign_name FROM applications a JOIN campaigns c ON c.id=a.campaign_id WHERE talent_id=? ORDER BY a.created_at DESC',(u['id'],))]
                    invites=[dict(r) for r in c.execute('SELECT i.*,c.name campaign_name,c.brand_id,b.name brand_name FROM campaign_invites i JOIN campaigns c ON c.id=i.campaign_id JOIN users b ON b.id=c.brand_id WHERE i.talent_id=? ORDER BY i.created_at DESC',(u['id'],))]
                    requests=[dict(r) for r in c.execute('SELECT r.*,b.name brand_name,b.verified brand_verified FROM collaboration_requests r JOIN users b ON b.id=r.brand_id WHERE r.talent_id=? ORDER BY r.updated_at DESC',(u['id'],))]
                    team_invites=[dict(r) for r in c.execute('SELECT tm.*,c.name campaign_name,b.name brand_name FROM campaign_team_members tm JOIN campaigns c ON c.id=tm.campaign_id JOIN users b ON b.id=c.brand_id WHERE tm.talent_id=? ORDER BY tm.updated_at DESC',(u['id'],))]
                    agency_invites=[dict(r) for r in c.execute('SELECT ar.*,a.name agency_name FROM agency_roster ar JOIN users a ON a.id=ar.agency_id WHERE ar.talent_id=? ORDER BY ar.updated_at DESC',(u['id'],))]
                    return self.send_json({'offers':offers,'deals':deals,'applications':apps,'invitations':invites,'collaborationRequests':requests,'teamInvites':team_invites,'agencyInvites':agency_invites})
                elif u['role']=='agency':
                    roster=[dict(r) for r in c.execute('SELECT ar.*,t.name talent_name FROM agency_roster ar JOIN users t ON t.id=ar.talent_id WHERE ar.agency_id=? ORDER BY ar.updated_at DESC',(u['id'],))]
                    return self.send_json({'roster':roster})
                return self.send_json({'users':c.execute('SELECT COUNT(*) n FROM users').fetchone()['n'],'campaigns':c.execute('SELECT COUNT(*) n FROM campaigns').fetchone()['n'],'deals':c.execute('SELECT COUNT(*) n FROM deals').fetchone()['n']})
            if path=='/api/deals':
                u=self.require(c); 
                if not u:return
                if u['role']=='brand': rows=c.execute('SELECT d.*,u.name other_name FROM deals d JOIN users u ON u.id=d.talent_id WHERE d.brand_id=? ORDER BY d.created_at DESC',(workspace_brand_id(c,u),))
                elif u['role']=='talent': rows=c.execute('SELECT d.*,u.name other_name FROM deals d JOIN users u ON u.id=d.brand_id WHERE d.talent_id=? ORDER BY d.created_at DESC',(u['id'],))
                else: rows=c.execute('SELECT d.*,u.name other_name FROM deals d JOIN users u ON u.id=d.talent_id ORDER BY d.created_at DESC')
                return self.send_json({'deals':[dict(r) for r in rows]})
            if path=='/api/messages':
                u=self.require(c)
                if not u:return
                if u['role']=='brand':
                    rows=c.execute("SELECT r.*,t.name other_name,t.profile_json FROM collaboration_requests r JOIN users t ON t.id=r.talent_id WHERE r.brand_id=? AND r.status='Chat Open' ORDER BY r.updated_at DESC",(workspace_brand_id(c,u),))
                elif u['role']=='talent':
                    rows=c.execute("SELECT r.*,b.name other_name,b.profile_json FROM collaboration_requests r JOIN users b ON b.id=r.brand_id WHERE r.talent_id=? AND r.status='Chat Open' ORDER BY r.updated_at DESC",(u['id'],))
                else:
                    rows=[]
                chats=[]
                for row in rows:
                    item=dict(row); item.pop('profile_json',None); chats.append(item)
                return self.send_json({'chats':chats})
            if path=='/api/for-you':
                u=self.require(c)
                if not u:return
                if u['role'] not in ('brand','talent') or not u.get('onboardingComplete'):
                    return self.send_json({'cards':[]})
                target_role='talent' if u['role']=='brand' else 'brand'
                cards=[]
                for row in c.execute('SELECT * FROM users WHERE role=? AND suspended=0 ORDER BY verified DESC,created_at DESC',(target_role,)):
                    candidate=marketplace_user_with_rating(c,row)
                    if not candidate or not is_live_profile(candidate):continue
                    brand_id=workspace_brand_id(c,u) if u['role']=='brand' else candidate['id']
                    talent_id=candidate['id'] if u['role']=='brand' else u['id']
                    if c.execute('SELECT 1 FROM connections WHERE brand_id=? AND talent_id=?',(brand_id,talent_id)).fetchone():continue
                    candidate['suggestionScore']=suggestion_score(u,candidate)
                    cards.append(candidate)
                cards.sort(key=lambda item:(item.get('suggestionScore',0),item.get('verified',False),item.get('rating',0)),reverse=True)
                return self.send_json({'cards':cards[:30]})
            if path=='/api/connections':
                u=self.require(c)
                if not u:return
                if u['role'] not in ('brand','talent'):return self.send_json({'connections':[]})
                brand_scope=workspace_brand_id(c,u) if u['role']=='brand' else u['id']
                rows=c.execute('SELECT * FROM connections WHERE brand_id=? OR talent_id=? ORDER BY updated_at DESC',(brand_scope,u['id']))
                connections=[]
                for row in rows:
                    item=dict(row); other_id=item['talent_id'] if u['role']=='brand' else item['brand_id']
                    other=marketplace_user_with_rating(c,c.execute('SELECT * FROM users WHERE id=?',(other_id,)).fetchone())
                    if not other:continue
                    chat=c.execute("SELECT id FROM collaboration_requests WHERE brand_id=? AND talent_id=? AND status='Chat Open'",(item['brand_id'],item['talent_id'])).fetchone()
                    item['other']=other; item['chatId']=chat['id'] if chat else None
                    connections.append(item)
                return self.send_json({'connections':connections})
            if path.startswith('/api/chats/'):
                u=self.require(c)
                if not u:return
                rid=path.split('/')[3]
                row=c.execute('SELECT r.*,t.name talent_name,b.name brand_name FROM collaboration_requests r JOIN users t ON t.id=r.talent_id JOIN users b ON b.id=r.brand_id WHERE r.id=?',(rid,)).fetchone()
                if not row:return self.send_json({'error':'Chat not found'},404)
                request=dict(row)
                if request['status']!='Chat Open' or not (u['role']=='admin' or u['id']==request['talent_id'] or is_brand_workspace_member(c,u,request['brand_id'])):return self.send_json({'error':'Not allowed'},403)
                messages=[dict(r) for r in c.execute('SELECT m.*,u.name from_name FROM collaboration_messages m JOIN users u ON u.id=m.from_user WHERE request_id=? ORDER BY m.created_at',(rid,))]
                request['note']=safe_display_text(request.get('note'))
                for item in messages:item['text']=safe_display_text(item.get('text'),'Message hidden for safety.')
                return self.send_json({'request':request,'messages':messages})
            if path.startswith('/api/deals/'):
                u=self.require(c); 
                if not u:return
                did=path.split('/')[3]; d=c.execute('SELECT * FROM deals WHERE id=?',(did,)).fetchone()
                if not d:return self.send_json({'error':'Not found'},404)
                dd=dict(d)
                dd['brand_name']=c.execute('SELECT name FROM users WHERE id=?',(d['brand_id'],)).fetchone()['name']
                dd['talent_name']=c.execute('SELECT name FROM users WHERE id=?',(d['talent_id'],)).fetchone()['name']
                if not deal_access(c,u,dd):return self.send_json({'error':'Not allowed'},403)
                msgs=[dict(r) for r in c.execute('SELECT m.*,u.name from_name FROM deal_messages m JOIN users u ON u.id=m.from_user WHERE deal_id=? ORDER BY m.created_at',(did,))]
                deliveries=[dict(r) for r in c.execute('SELECT x.*,u.name from_name FROM deal_deliveries x JOIN users u ON u.id=x.submitted_by WHERE deal_id=? ORDER BY x.created_at DESC',(did,))]
                revisions=[dict(r) for r in c.execute('SELECT x.*,u.name from_name FROM deal_revisions x JOIN users u ON u.id=x.requested_by WHERE deal_id=? ORDER BY x.created_at DESC',(did,))]
                disputes=[dict(r) for r in c.execute('SELECT x.*,u.name from_name FROM deal_disputes x JOIN users u ON u.id=x.opened_by WHERE deal_id=? ORDER BY x.created_at DESC',(did,))]
                reviews=[dict(r) for r in c.execute('SELECT x.*,u.name from_name FROM deal_reviews x JOIN users u ON u.id=x.author_id WHERE deal_id=? ORDER BY x.created_at',(did,))]
                for item in msgs:item['text']=safe_display_text(item.get('text'),'Message hidden for safety.')
                for item in deliveries:item['note']=safe_display_text(item.get('note'),'Delivery details available in MUSE.')
                for item in revisions:item['note']=safe_display_text(item.get('note'),'Revision details available in MUSE.')
                for item in disputes:item['reason']=safe_display_text(item.get('reason'),'Support case details are available to MUSE.')
                for item in reviews:item['comment']=safe_display_text(item.get('comment'),'Review available in MUSE.')
                return self.send_json({'checklist':{r['item']:bool(r['done']) for r in c.execute('SELECT item,done FROM collaboration_checklist WHERE deal_id=?',(did,))},'deal':dd,'messages':msgs,'deliveries':deliveries,'revisions':revisions,'disputes':disputes,'reviews':reviews})
            if path=='/api/notifications':
                u=self.require(c); 
                if not u:return
                rows=[dict(r) for r in c.execute('SELECT * FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 50',(u['id'],))]
                return self.send_json({'notifications':rows})
            if path=='/api/admin/users':
                u=self.require(c,['admin']);
                if not u:return
                rows=[]
                for r in c.execute('SELECT * FROM users ORDER BY created_at DESC'):
                    item=public_user(r)
                    item['safetyFlags']=c.execute('SELECT COUNT(*) n FROM safety_events WHERE user_id=?',(item['id'],)).fetchone()['n']
                    rows.append(item)
                return self.send_json({'users':rows})
            return self.send_json({'error':'Not found'},404)
        finally:c.close()
    def do_POST(self):
        path=urlparse(self.path).path; data=self.body()
        if data is None:return
        c=db()
        try:
            if path=='/api/workspace-events':
                u=self.require(c)
                if not u:return
                event_id=clean_text(data.get('id'),80)
                if event_id:
                    if not c.execute('SELECT 1 FROM workspace_events WHERE id=? AND user_id=?',(event_id,u['id'])).fetchone():return self.send_json({'error':'Event not found'},404)
                    if data.get('action')=='delete':c.execute('DELETE FROM workspace_events WHERE id=? AND user_id=?',(event_id,u['id']))
                    elif type(data.get('done')) is bool:c.execute('UPDATE workspace_events SET done=? WHERE id=? AND user_id=?',(int(data['done']),event_id,u['id']))
                    else:return self.send_json({'error':'Invalid event action'},400)
                else:
                    title=clean_text(data.get('title'),160); date=clean_text(data.get('date'),10); kind=data.get('kind')
                    try:time.strptime(date,'%Y-%m-%d')
                    except ValueError:return self.send_json({'error':'Enter a valid date'},400)
                    if not title or kind not in ('Shoot','Content deadline','Posting date','Collaboration','Reminder'):return self.send_json({'error':'Enter an event title and type'},400)
                    event_id=uid('event')
                    c.execute('INSERT INTO workspace_events VALUES(?,?,?,?,?,0)',(event_id,u['id'],title,date,kind))
                c.commit();return self.send_json({'ok':True,'id':event_id})
            if path.startswith('/api/deals/') and path.endswith('/checklist'):
                u=self.require(c)
                if not u:return
                did=path.split('/')[3]; d=c.execute('SELECT * FROM deals WHERE id=?',(did,)).fetchone()
                if not d or not deal_access(c,u,d):return self.send_json({'error':'Not allowed'},403)
                item=data.get('item');done=data.get('done')
                if item not in ('concept','content','posted') or type(done) is not bool:return self.send_json({'error':'Invalid checklist item'},400)
                if d['status'] in ('Completed','Cancelled','In Review'):return self.send_json({'error':'This checklist is read-only'},409)
                c.execute('INSERT INTO collaboration_checklist VALUES(?,?,?) ON CONFLICT(deal_id,item) DO UPDATE SET done=excluded.done',(did,item,int(done)))
                c.commit();return self.send_json({'ok':True})
            if path=='/api/signup':
                email=clean_text(data.get('email',''),254).lower(); password=str(data.get('password','')); role=data.get('role'); name=clean_text(data.get('name',''),120)
                if role not in ('brand','talent','agency') or '@' not in email or len(password)<8 or not name:return self.send_json({'error':'Complete all required fields; use a valid email and a password of at least 8 characters.'},400)
                if c.execute('SELECT 1 FROM users WHERE email=?',(email,)).fetchone():return self.send_json({'error':'Email already exists.'},409)
                id=uid('user'); profile={'country':data.get('country',''),'city':data.get('city',''),'bio':'','talentTypes':data.get('talentTypes',[]) if role=='talent' else [],'categories':[],'languages':[],'platforms':[],'services':[],'portfolio':[],'profilePosts':[],'availabilityCalendar':[],'travelPlans':[],'workedCountries':[],'profileVisibility':'Private','onboardingComplete':False}
                c.execute('INSERT INTO users VALUES(?,?,?,?,?,?,?,?,?)',(id,email,hash_password(password),role,name,0,0,json.dumps(profile),now()))
                pending=c.execute("SELECT id,brand_id FROM company_members WHERE email=? AND user_id IS NULL AND status='Invited'",(email,)).fetchall()
                for invite in pending:
                    c.execute("UPDATE company_members SET user_id=?,status='Pending',updated_at=? WHERE id=?",(id,now(),invite['id']))
                    c.execute('INSERT INTO notifications VALUES(?,?,?,?,?)',(uid('n'),id,'You have a company workspace invitation waiting in MUSE.',0,now()))
                token=secrets.token_urlsafe(32); c.execute('INSERT INTO sessions VALUES(?,?,?)',(token,id,int(time.time())+SESSION_DAYS*86400)); c.commit(); return self.send_json({'user':public_user(c.execute('SELECT * FROM users WHERE id=?',(id,)).fetchone())},201,session_cookie(token,SESSION_DAYS*86400))
            if path=='/api/login':
                r=c.execute('SELECT * FROM users WHERE email=?',(str(data.get('email','')).lower(),)).fetchone()
                if not r or not verify_password(str(data.get('password','')),r['password_hash']):return self.send_json({'error':'Email or password is incorrect.'},401)
                if r['suspended']:return self.send_json({'error':'This account is suspended.'},403)
                token=secrets.token_urlsafe(32); c.execute('INSERT INTO sessions VALUES(?,?,?)',(token,r['id'],int(time.time())+SESSION_DAYS*86400)); c.commit(); return self.send_json({'user':public_user(r)},200,session_cookie(token,SESSION_DAYS*86400))
            if path=='/api/logout':
                token=self.cookies().get('muse_session');
                if token:c.execute('DELETE FROM sessions WHERE token=?',(token,)); c.commit()
                return self.send_json({'ok':True},200,session_cookie('',0))
            if path=='/api/auth/password-reset/request':
                email=clean_text(data.get('email'),254).lower()
                if not email or '@' not in email:return self.send_json({'error':'Enter the email for your MUSE account.'},400)
                if not reset_email_ready():return self.send_json({'error':'Password recovery email is not configured yet. Ask the MUSE team to enable it.'},503)
                account=c.execute('SELECT id FROM users WHERE email=?',(email,)).fetchone()
                # Always return the same message for an unknown address, so the
                # endpoint cannot be used to discover which emails have accounts.
                if not account:return self.send_json({'ok':True,'message':'If an account exists for that email, a reset link has been sent.'})
                created=now(); token=secrets.token_urlsafe(32); token_hash=hashlib.sha256(token.encode()).hexdigest()
                c.execute('UPDATE password_resets SET used_at=? WHERE user_id=? AND used_at IS NULL',(created,account['id']))
                c.execute('INSERT INTO password_resets VALUES(?,?,?,?,?,?)',(uid('reset'),account['id'],token_hash,int(time.time())+RESET_TTL_SECONDS,None,created))
                c.commit()
                if not send_reset_email(email,token,self.headers):
                    c.execute('UPDATE password_resets SET used_at=? WHERE token_hash=?',(now(),token_hash)); c.commit()
                    return self.send_json({'error':'We could not send the reset email. Please try again shortly.'},502)
                return self.send_json({'ok':True,'message':'If an account exists for that email, a reset link has been sent.'})
            if path=='/api/auth/password-reset/confirm':
                token=clean_text(data.get('token'),300); password=str(data.get('password',''))
                if not token or len(password)<8:return self.send_json({'error':'Use the reset link and choose a password with at least 8 characters.'},400)
                token_hash=hashlib.sha256(token.encode()).hexdigest()
                reset=c.execute('SELECT * FROM password_resets WHERE token_hash=? AND used_at IS NULL AND expires>? ORDER BY created_at DESC LIMIT 1',(token_hash,int(time.time()))).fetchone()
                if not reset:return self.send_json({'error':'This reset link is invalid or has expired. Request a new one.'},400)
                completed=now()
                c.execute('UPDATE users SET password_hash=? WHERE id=?',(hash_password(password),reset['user_id']))
                c.execute('UPDATE password_resets SET used_at=? WHERE id=?',(completed,reset['id']))
                c.execute('DELETE FROM sessions WHERE user_id=?',(reset['user_id'],))
                c.commit(); return self.send_json({'ok':True})
            if path=='/api/analytics/impressions':
                u=self.require(c)
                if not u:return
                profile_ids=data.get('profileIds') if isinstance(data.get('profileIds'),list) else []
                saved=0
                for pid in list(dict.fromkeys(clean_text(x,80) for x in profile_ids))[:30]:
                    target=marketplace_user_with_rating(c,c.execute("SELECT * FROM users WHERE id=? AND role='talent' AND suspended=0",(pid,)).fetchone())
                    if target and target['id']!=u['id'] and is_live_profile(target):
                        record_view(c,'impression',target['id'],u['id'],clean_text(data.get('context'),'discover') or 'discover'); saved+=1
                c.commit(); return self.send_json({'recorded':saved})
            if path=='/api/match':
                u=self.require(c,['brand'])
                if not u:return
                root=workspace_brand_id(c,u)
                brand=public_user(c.execute('SELECT * FROM users WHERE id=?',(root,)).fetchone()) or u
                criteria={
                    'talentType':clean_text(data.get('talentType'),80),
                    'category':clean_text(data.get('category'),80),
                    'country':clean_text(data.get('country') or brand.get('country'),120),
                    'city':clean_text(data.get('city') or brand.get('city'),120),
                    'maxRate':data.get('maxRate')
                }
                matches=[]
                for row in c.execute("SELECT * FROM users WHERE role='talent' AND suspended=0 ORDER BY verified DESC,created_at DESC"):
                    item=match_talent(c,brand,criteria,row)
                    if item:matches.append(item)
                matches.sort(key=lambda item:(item.get('matchScore',0),item.get('rating',0),item.get('verified',False)),reverse=True)
                return self.send_json({'criteria':criteria,'matches':matches[:10],'method':'Transparent fit score — not AI'})
            if path=='/api/verification-requests':
                u=self.require(c)
                if not u:return
                kind=clean_text(data.get('kind'),30)
                if kind not in ('Identity','Audience','Agency','Company'):return self.send_json({'error':'Choose a valid verification type.'},400)
                if c.execute("SELECT 1 FROM verification_requests WHERE user_id=? AND kind=? AND status='Pending'",(u['id'],kind)).fetchone():return self.send_json({'error':'That verification request is already pending.'},409)
                note=clean_text(data.get('note'),800)
                if reject_contact(c,u['id'],'verification-request',note):
                    c.commit(); return self.send_json({'error':CONTACT_BLOCK_MESSAGE},422)
                c.execute('INSERT INTO verification_requests VALUES(?,?,?,?,?,?,?,?,?)',(uid('verify'),u['id'],kind,'Pending',note,now(),None,None)); c.commit()
                return self.send_json({'ok':True},201)
            if path=='/api/company/invite':
                u=self.require(c,['brand'])
                if not u:return
                wid=workspace_brand_id(c,u)
                email=clean_text(data.get('email'),254).lower(); member_role=clean_text(data.get('role'),20) or 'Manager'
                if '@' not in email or member_role not in ('Owner','Manager','Viewer'):return self.send_json({'error':'Enter an email and choose Owner, Manager or Viewer.'},400)
                if c.execute('SELECT 1 FROM company_members WHERE brand_id=? AND email=?',(wid,email)).fetchone():return self.send_json({'error':'That person is already invited to this workspace.'},409)
                account=c.execute('SELECT id,role FROM users WHERE email=?',(email,)).fetchone()
                if account and account['role']!='brand':return self.send_json({'error':'This email belongs to a non-brand account. Team members need a Brand account.'},400)
                status='Pending' if account else 'Invited'; member_id=uid('company')
                c.execute('INSERT INTO company_members VALUES(?,?,?,?,?,?,?,?)',(member_id,wid,account['id'] if account else None,email,member_role,status,now(),now()))
                if account:c.execute('INSERT INTO notifications VALUES(?,?,?,?,?)',(uid('n'),account['id'],f"You were invited to join {u['name']}'s company workspace.",0,now()))
                c.commit(); return self.send_json({'id':member_id,'status':status},201)
            if path.startswith('/api/company-members/') and path.endswith('/respond'):
                u=self.require(c,['brand'])
                if not u:return
                member_id=path.split('/')[3]; member=c.execute('SELECT * FROM company_members WHERE id=? AND user_id=?',(member_id,u['id'])).fetchone()
                if not member:return self.send_json({'error':'Workspace invitation not found.'},404)
                if member['status']!='Pending':return self.send_json({'error':'This invitation has already been answered.'},409)
                status=clean_text(data.get('status'),20)
                if status not in ('Accepted','Declined'):return self.send_json({'error':'Choose Accepted or Declined.'},400)
                c.execute('UPDATE company_members SET status=?,updated_at=? WHERE id=?',(status,now(),member_id))
                c.execute('INSERT INTO notifications VALUES(?,?,?,?,?)',(uid('n'),member['brand_id'],f"A company workspace invitation was {status.lower()}.",0,now()))
                c.commit(); return self.send_json({'ok':True,'status':status})
            if path=='/api/agency/roster':
                u=self.require(c,['agency'])
                if not u:return
                talent_id=clean_text(data.get('talentId'),80)
                target=marketplace_user_with_rating(c,c.execute("SELECT * FROM users WHERE id=? AND role='talent' AND suspended=0",(talent_id,)).fetchone())
                if not target or not is_live_profile(target):return self.send_json({'error':'Talent profile is not available.'},404)
                if c.execute('SELECT 1 FROM agency_roster WHERE agency_id=? AND talent_id=?',(u['id'],talent_id)).fetchone():return self.send_json({'error':'This talent is already on your roster or has an invitation.'},409)
                created=now(); roster_id=uid('roster')
                c.execute('INSERT INTO agency_roster VALUES(?,?,?,?,?,?)',(roster_id,u['id'],talent_id,'Invited',created,created))
                c.execute('INSERT INTO notifications VALUES(?,?,?,?,?)',(uid('n'),talent_id,f"{u['name']} invited you to their agency roster.",0,created))
                c.commit(); return self.send_json({'id':roster_id,'status':'Invited'},201)
            if path.startswith('/api/agency-roster/') and path.endswith('/respond'):
                u=self.require(c,['talent'])
                if not u:return
                roster_id=path.split('/')[3]; roster=c.execute('SELECT * FROM agency_roster WHERE id=? AND talent_id=?',(roster_id,u['id'])).fetchone()
                if not roster:return self.send_json({'error':'Agency invitation not found.'},404)
                if roster['status']!='Invited':return self.send_json({'error':'This invitation has already been answered.'},409)
                status=clean_text(data.get('status'),20)
                if status not in ('Accepted','Declined'):return self.send_json({'error':'Choose Accepted or Declined.'},400)
                c.execute('UPDATE agency_roster SET status=?,updated_at=? WHERE id=?',(status,now(),roster_id))
                c.execute('INSERT INTO notifications VALUES(?,?,?,?,?)',(uid('n'),roster['agency_id'],f"{u['name']} {status.lower()} your agency roster invitation.",0,now()))
                c.commit(); return self.send_json({'ok':True,'status':status})
            if path.startswith('/api/campaigns/') and path.endswith('/team'):
                u=self.require(c,['brand'])
                if not u:return
                cid=path.split('/')[3]; campaign=c.execute('SELECT * FROM campaigns WHERE id=?',(cid,)).fetchone()
                if not campaign or not is_brand_workspace_member(c,u,campaign['brand_id']):return self.send_json({'error':'Campaign not found.'},404)
                talent_id=clean_text(data.get('talentId'),80); team_role=clean_text(data.get('teamRole'),80) or 'Creator'
                target=marketplace_user_with_rating(c,c.execute("SELECT * FROM users WHERE id=? AND role='talent' AND suspended=0",(talent_id,)).fetchone())
                if not target or not is_live_profile(target):return self.send_json({'error':'Talent profile is not available.'},404)
                if c.execute('SELECT 1 FROM campaign_team_members WHERE campaign_id=? AND talent_id=?',(cid,talent_id)).fetchone():return self.send_json({'error':'This person is already in the campaign team.'},409)
                created=now(); member_id=uid('team')
                c.execute('INSERT INTO campaign_team_members VALUES(?,?,?,?,?,?,?)',(member_id,cid,talent_id,team_role,'Invited',created,created))
                c.execute('INSERT INTO notifications VALUES(?,?,?,?,?)',(uid('n'),talent_id,f"You were invited to join the team for {campaign['name']}.",0,created))
                c.commit(); return self.send_json({'id':member_id,'status':'Invited'},201)
            if path.startswith('/api/campaign-team/') and path.endswith('/respond'):
                u=self.require(c,['talent'])
                if not u:return
                member_id=path.split('/')[3]; member=c.execute('SELECT * FROM campaign_team_members WHERE id=? AND talent_id=?',(member_id,u['id'])).fetchone()
                if not member:return self.send_json({'error':'Team invitation not found.'},404)
                if member['status']!='Invited':return self.send_json({'error':'This invitation has already been answered.'},409)
                status=clean_text(data.get('status'),20)
                if status not in ('Accepted','Declined'):return self.send_json({'error':'Choose Accepted or Declined.'},400)
                c.execute('UPDATE campaign_team_members SET status=?,updated_at=? WHERE id=?',(status,now(),member_id))
                c.execute('INSERT INTO notifications VALUES(?,?,?,?,?)',(uid('n'),c.execute('SELECT brand_id FROM campaigns WHERE id=?',(member['campaign_id'],)).fetchone()['brand_id'],f"{u['name']} {status.lower()} a campaign team invitation.",0,now()))
                c.commit(); return self.send_json({'ok':True,'status':status})
            if path=='/api/connections':
                u=self.require(c)
                if not u:return
                return self.send_json({'error':'Brands start collaborations by sending an offer. Talent can apply to campaigns.'},403)
            if path.startswith('/api/connections/') and path.endswith('/respond'):
                u=self.require(c)
                if not u:return
                return self.send_json({'error':'Please use a brand offer to accept or negotiate a collaboration.'},403)
            if path.startswith('/api/brands/') and path.endswith('/requests'):
                u=self.require(c,['talent'])
                if not u:return
                return self.send_json({'error':'Apply to an open campaign or respond to a brand offer to collaborate.'},403)
            if path.startswith('/api/requests/') and path.endswith('/open-chat'):
                u=self.require(c,['brand'])
                if not u:return
                return self.send_json({'error':'Send an offer first. Chat opens when the talent accepts or negotiates.'},403)
            if path.startswith('/api/requests/') and path.endswith('/messages'):
                u=self.require(c)
                if not u:return
                rid=path.split('/')[3]
                request=c.execute('SELECT * FROM collaboration_requests WHERE id=?',(rid,)).fetchone()
                if not request or request['status']!='Chat Open' or not (u['role']=='admin' or u['id']==request['talent_id'] or is_brand_workspace_member(c,u,request['brand_id'])):
                    return self.send_json({'error':'Chat is not available.'},403)
                text=clean_text(data.get('text'),5000); file_url=uploaded_url(data.get('fileUrl')); file_name=clean_text(data.get('fileName'),180) if file_url else None
                if not text and not file_url:return self.send_json({'error':'Write a message or attach a file.'},400)
                if reject_contact(c,u['id'],'collaboration-chat',text,file_name):
                    c.commit(); return self.send_json({'error':CONTACT_BLOCK_MESSAGE},422)
                created=now()
                c.execute('INSERT INTO collaboration_messages VALUES(?,?,?,?,?,?,?)',(uid('chatmsg'),rid,u['id'],text,file_name,file_url or None,created))
                c.execute('UPDATE collaboration_requests SET updated_at=? WHERE id=?',(created,rid))
                other=request['talent_id'] if u['role']=='brand' else request['brand_id']
                c.execute('INSERT INTO notifications VALUES(?,?,?,?,?)',(uid('n'),other,f"New chat message from {u['name']}",0,created))
                c.commit(); return self.send_json({'ok':True},201)
            if path=='/api/campaigns':
                u=self.require(c,['brand']);
                if not u:return
                name=clean_text(data.get('name'),140); description=clean_text(data.get('description'),3000)
                budget_min=money_value(data.get('budgetMin')); budget_max=money_value(data.get('budgetMax')); slots=whole_number(data.get('slots'))
                visibility=data.get('visibility','Public')
                if not name or not description or budget_min is None or budget_max is None or budget_min<=0 or budget_max<budget_min or not slots:return self.send_json({'error':'Add a name, description, valid budget range and talent count.'},400)
                if visibility not in ('Public','Invite Only'):return self.send_json({'error':'Invalid campaign visibility.'},400)
                opportunity_type=clean_text(data.get('opportunityType'),30) or 'Campaign'
                if opportunity_type not in ('Campaign','Casting','Job'):return self.send_json({'error':'Choose Campaign, Casting or Job.'},400)
                if reject_contact(c,u['id'],'campaign',name,description,data.get('deliverables')):
                    c.commit(); return self.send_json({'error':CONTACT_BLOCK_MESSAGE},422)
                id=uid('camp'); vals=(id,workspace_brand_id(c,u),name,description,clean_text(data.get('talentType','Influencer / Model / Content Creator'),80),clean_text(data.get('category'),80),clean_text(data.get('country'),120),clean_text(data.get('city'),120),clean_text(data.get('platform'),120),clean_text(data.get('deliverables'),1000),budget_min,budget_max,'USD',clean_text(data.get('deadline'),30),slots,visibility,'Open',now(),opportunity_type,clean_text(data.get('usageRights'),100) or 'Organic social',clean_text(data.get('usageDuration'),60) or '3 months',clean_text(data.get('territory'),100) or 'Campaign market',clean_text(data.get('exclusivity'),100) or 'None',clean_text(data.get('employmentType'),80))
                c.execute('''INSERT INTO campaigns(id,brand_id,name,description,talent_type,category,country,city,platform,deliverables,budget_min,budget_max,currency,deadline,slots,visibility,status,created_at,opportunity_type,usage_rights,usage_duration,territory,exclusivity,employment_type) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)''',vals); c.commit(); return self.send_json({'id':id},201)
            if path.startswith('/api/campaigns/') and path.endswith('/invite'):
                u=self.require(c,['brand']);
                if not u:return
                cid=path.split('/')[3]; talent_id=str(data.get('talentId',''))
                camp=c.execute('SELECT id,name FROM campaigns WHERE id=? AND brand_id=? AND status!=?',(cid,workspace_brand_id(c,u),'Deleted')).fetchone()
                if not camp:return self.send_json({'error':'Campaign not found'},404)
                target=c.execute("SELECT id FROM users WHERE id=? AND role='talent' AND suspended=0",(talent_id,)).fetchone()
                if not target:return self.send_json({'error':'Talent not found'},404)
                if c.execute('SELECT 1 FROM campaign_invites WHERE campaign_id=? AND talent_id=?',(cid,talent_id)).fetchone():return self.send_json({'error':'Talent is already invited to this campaign.'},409)
                c.execute('INSERT INTO campaign_invites VALUES(?,?,?,?,?)',(uid('inv'),cid,talent_id,'Invited',now()))
                c.execute('INSERT INTO notifications VALUES(?,?,?,?,?)',(uid('n'),talent_id,f"You were invited to {camp['name']} by {u['name']}",0,now()))
                c.commit(); return self.send_json({'ok':True},201)
            if path.startswith('/api/campaigns/') and path.endswith('/apply'):
                u=self.require(c,['talent']);
                if not u:return
                cid=path.split('/')[3]
                camp=c.execute('SELECT visibility,status FROM campaigns WHERE id=?',(cid,)).fetchone()
                if not camp or camp['status']!='Open':return self.send_json({'error':'Campaign is not open.'},400)
                if camp['visibility']=='Invite Only' and not c.execute('SELECT 1 FROM campaign_invites WHERE campaign_id=? AND talent_id=?',(cid,u['id'])).fetchone():return self.send_json({'error':'This campaign is invite only.'},403)
                if c.execute('SELECT 1 FROM applications WHERE campaign_id=? AND talent_id=?',(cid,u['id'])).fetchone():return self.send_json({'error':'You already applied.'},409)
                proposal=clean_text(data.get('proposal'),3000); price=money_value(data.get('price'))
                if not proposal or price is None or price<=0:return self.send_json({'error':'Add a proposal and a valid price.'},400)
                if reject_contact(c,u['id'],'campaign-application',proposal):
                    c.commit(); return self.send_json({'error':CONTACT_BLOCK_MESSAGE},422)
                c.execute('INSERT INTO applications VALUES(?,?,?,?,?,?,?)',(uid('app'),cid,u['id'],proposal,price,'Applied',now())); c.execute('UPDATE campaign_invites SET status=? WHERE campaign_id=? AND talent_id=?',('Applied',cid,u['id'])); brand=c.execute('SELECT brand_id,name FROM campaigns WHERE id=?',(cid,)).fetchone();
                if brand:c.execute('INSERT INTO notifications VALUES(?,?,?,?,?)',(uid('n'),brand['brand_id'],f"New application for {brand['name']}",0,now()))
                c.commit(); return self.send_json({'ok':True},201)
            if path=='/api/offers':
                u=self.require(c,['brand']);
                if not u:return
                talent_id=clean_text(data.get('talentId'),80); title=clean_text(data.get('title'),160); details=clean_text(data.get('details'),3000); deliverables=clean_text(data.get('deliverables'),1200); date=clean_text(data.get('date'),30); price=money_value(data.get('price'))
                target=marketplace_user_with_rating(c,c.execute("SELECT * FROM users WHERE id=? AND role='talent' AND suspended=0",(talent_id,)).fetchone())
                if not target or not is_live_profile(target):return self.send_json({'error':'Talent profile is not available.'},404)
                if not title or not details or not deliverables or not date or price is None or price<=0:return self.send_json({'error':'Complete the offer details and enter a valid price.'},400)
                if not truthy(data.get('agreeToTerms')):return self.send_json({'error':'Confirm the MUSE Deal Terms before sending the offer.'},400)
                if reject_contact(c,u['id'],'offer',title,details,deliverables):
                    c.commit(); return self.send_json({'error':CONTACT_BLOCK_MESSAGE},422)
                oid=uid('offer')
                c.execute(
                    'INSERT INTO offers(id,brand_id,talent_id,title,details,deliverables,date,price,currency,status,created_at,terms_accepted_at,usage_rights,usage_duration,territory,exclusivity) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
                    (oid,workspace_brand_id(c,u),talent_id,title,details,deliverables,date,price,'USD','Pending',now(),now(),clean_text(data.get('usageRights'),100) or 'Organic social',clean_text(data.get('usageDuration'),60) or '3 months',clean_text(data.get('territory'),100) or 'Campaign market',clean_text(data.get('exclusivity'),100) or 'None')
                )
                c.execute('INSERT INTO notifications VALUES(?,?,?,?,?)',(uid('n'),talent_id,f"You received an offer from {u['name']}",0,now()))
                c.commit(); return self.send_json({'id':oid},201)
            if path.startswith('/api/offers/') and path.endswith('/respond'):
                u=self.require(c);
                if not u:return
                oid=path.split('/')[3]; o=c.execute('SELECT * FROM offers WHERE id=?',(oid,)).fetchone()
                if not o:return self.send_json({'error':'Offer not found'},404)
                status=data.get('status')
                if u['role']=='talent':
                    if o['talent_id']!=u['id']:return self.send_json({'error':'Not allowed'},403)
                    if o['status']!='Pending':return self.send_json({'error':'This offer has already been answered.'},409)
                    if status not in ('Accepted','Declined','Countered','Negotiating'):return self.send_json({'error':'Invalid offer response.'},400)
                    if status=='Negotiating':
                        chat_id=open_connection_chat(c,o['brand_id'],o['talent_id'],now())
                        c.execute('INSERT INTO notifications VALUES(?,?,?,?,?)',(uid('n'),o['brand_id'],f"{u['name']} wants to discuss your offer: {o['title']}",0,now()))
                        c.commit(); return self.send_json({'ok':True,'chatId':chat_id})
                    if status=='Countered':
                        counter_price=money_value(data.get('counterPrice'))
                        counter_note=clean_text(data.get('counterNote'),1200)
                        if counter_price is None or counter_price<=0:return self.send_json({'error':'Enter a valid counter offer price.'},400)
                        if not truthy(data.get('agreeToTerms')):return self.send_json({'error':'Confirm the MUSE Deal Terms before sending a counter offer.'},400)
                        if reject_contact(c,u['id'],'counter-offer',counter_note):
                            c.commit(); return self.send_json({'error':CONTACT_BLOCK_MESSAGE},422)
                        c.execute('UPDATE offers SET status=?,counter_price=?,counter_note=?,countered_at=? WHERE id=?',('Countered',counter_price,counter_note,now(),oid))
                        c.execute('INSERT INTO notifications VALUES(?,?,?,?,?)',(uid('n'),o['brand_id'],f"{u['name']} sent a counter offer for {o['title']}",0,now()))
                    else:
                        c.execute('UPDATE offers SET status=? WHERE id=?',(status,oid))
                        if status=='Accepted':
                            if not truthy(data.get('agreeToTerms')):return self.send_json({'error':'Confirm the MUSE Deal Terms before accepting this offer.'},400)
                            create_deal_for_offer(c,o,o['price'],talent_terms_at=now())
                            c.execute('INSERT INTO notifications VALUES(?,?,?,?,?)',(uid('n'),o['brand_id'],f"{u['name']} accepted your offer",0,now()))
                        else:
                            c.execute('INSERT INTO notifications VALUES(?,?,?,?,?)',(uid('n'),o['brand_id'],f"{u['name']} declined your offer",0,now()))
                    chat_id=open_connection_chat(c,o['brand_id'],o['talent_id'],now()) if status in ('Accepted','Countered') else None
                    c.commit(); return self.send_json({'ok':True,'chatId':chat_id})
                if u['role']=='brand':
                    if not is_brand_workspace_member(c,u,o['brand_id']):return self.send_json({'error':'Not allowed'},403)
                    if o['status']!='Countered':return self.send_json({'error':'This offer does not have a pending counter.'},409)
                    if status not in ('Accepted','Declined'):return self.send_json({'error':'Invalid counter response.'},400)
                    if status=='Accepted' and not truthy(data.get('agreeToTerms')):return self.send_json({'error':'Confirm the MUSE Deal Terms before accepting this counter offer.'},400)
                    c.execute('UPDATE offers SET status=? WHERE id=?',(status,oid))
                    if status=='Accepted':
                        create_deal_for_offer(c,o,o['counter_price'] or o['price'],brand_terms_at=now(),talent_terms_at=o['countered_at'] or now())
                        text=f"{u['name']} accepted your counter offer"
                    else:
                        text=f"{u['name']} declined your counter offer"
                    c.execute('INSERT INTO notifications VALUES(?,?,?,?,?)',(uid('n'),o['talent_id'],text,0,now()))
                    c.commit(); return self.send_json({'ok':True})
                return self.send_json({'error':'Not allowed'},403)
            if path.startswith('/api/deals/') and path.endswith('/messages'):
                u=self.require(c);
                if not u:return
                did=path.split('/')[3]; d=c.execute('SELECT * FROM deals WHERE id=?',(did,)).fetchone();
                if not deal_access(c,u,d):return self.send_json({'error':'Not allowed'},403)
                text=clean_text(data.get('text'),5000); file_url=uploaded_url(data.get('fileUrl')); file_name=clean_text(data.get('fileName'),180) if file_url else None
                if not text and not file_url:return self.send_json({'error':'Write a message or attach a file.'},400)
                if reject_contact(c,u['id'],'deal-room',text,file_name):
                    c.commit(); return self.send_json({'error':CONTACT_BLOCK_MESSAGE},422)
                c.execute('INSERT INTO deal_messages VALUES(?,?,?,?,?,?,?)',(uid('msg'),did,u['id'],text,file_name,file_url or None,now())); c.commit(); return self.send_json({'ok':True},201)
            if path.startswith('/api/deals/') and path.endswith('/deliveries'):
                u=self.require(c,['talent'])
                if not u:return
                did=path.split('/')[3]; d=c.execute('SELECT * FROM deals WHERE id=? AND talent_id=?',(did,u['id'])).fetchone()
                if not d:return self.send_json({'error':'Not allowed'},403)
                if d['status'] in ('In Review','Completed'):return self.send_json({'error':'This deal is not accepting deliveries right now.'},409)
                note=clean_text(data.get('note'),1800); file_url=uploaded_url(data.get('fileUrl')); file_name=clean_text(data.get('fileName'),180) if file_url else None
                if not note and not file_url:return self.send_json({'error':'Add a delivery note or attach the work.'},400)
                if reject_contact(c,u['id'],'delivery',note,file_name):
                    c.commit(); return self.send_json({'error':CONTACT_BLOCK_MESSAGE},422)
                created=now()
                c.execute('INSERT INTO deal_deliveries VALUES(?,?,?,?,?,?,?,?)',(uid('delivery'),did,u['id'],note,file_name,file_url or None,'Submitted',created))
                c.execute("UPDATE deal_revisions SET status='Resolved',resolved_at=? WHERE deal_id=? AND status='Open'",(created,did))
                c.execute('UPDATE deals SET status=? WHERE id=?',('Submitted',did))
                c.execute('INSERT INTO notifications VALUES(?,?,?,?,?)',(uid('n'),d['brand_id'],f"{u['name']} submitted work for {d['title']}",0,created))
                c.commit(); return self.send_json({'ok':True,'status':'Submitted'},201)
            if path.startswith('/api/deals/') and path.endswith('/revisions'):
                u=self.require(c,['brand'])
                if not u:return
                did=path.split('/')[3]; d=c.execute('SELECT * FROM deals WHERE id=?',(did,)).fetchone()
                if not d or not is_brand_workspace_member(c,u,d['brand_id']):return self.send_json({'error':'Not allowed'},403)
                if d['status']!='Submitted':return self.send_json({'error':'A delivery must be submitted before requesting a revision.'},409)
                note=clean_text(data.get('note'),1800)
                if not note:return self.send_json({'error':'Describe the revision needed.'},400)
                if reject_contact(c,u['id'],'revision',note):
                    c.commit(); return self.send_json({'error':CONTACT_BLOCK_MESSAGE},422)
                created=now()
                c.execute('INSERT INTO deal_revisions VALUES(?,?,?,?,?,?,?)',(uid('revision'),did,u['id'],note,'Open',created,None))
                c.execute('UPDATE deals SET status=? WHERE id=?',('Revision Requested',did))
                c.execute('INSERT INTO notifications VALUES(?,?,?,?,?)',(uid('n'),d['talent_id'],f"{u['name']} requested a revision for {d['title']}",0,created))
                c.commit(); return self.send_json({'ok':True,'status':'Revision Requested'},201)
            if path.startswith('/api/deals/') and path.endswith('/disputes'):
                u=self.require(c)
                if not u:return
                did=path.split('/')[3]; d=c.execute('SELECT * FROM deals WHERE id=?',(did,)).fetchone()
                if not deal_access(c,u,d):return self.send_json({'error':'Not allowed'},403)
                if d['status']=='Completed':return self.send_json({'error':'Completed deals cannot open a new support case.'},409)
                if c.execute("SELECT 1 FROM deal_disputes WHERE deal_id=? AND status='Open'",(did,)).fetchone():return self.send_json({'error':'A support case is already open for this deal.'},409)
                reason=clean_text(data.get('reason'),1800)
                if not reason:return self.send_json({'error':'Describe what needs support.'},400)
                if reject_contact(c,u['id'],'dispute',reason):
                    c.commit(); return self.send_json({'error':CONTACT_BLOCK_MESSAGE},422)
                created=now(); other=d['talent_id'] if u['role']=='brand' else d['brand_id']
                c.execute('INSERT INTO deal_disputes VALUES(?,?,?,?,?,?,?,?)',(uid('dispute'),did,u['id'],reason,'Open',created,created,None))
                c.execute('UPDATE deals SET status=? WHERE id=?',('In Review',did))
                c.execute('INSERT INTO notifications VALUES(?,?,?,?,?)',(uid('n'),other,f"A MUSE support case was opened for {d['title']}",0,created))
                c.commit(); return self.send_json({'ok':True,'status':'In Review'},201)
            if path.startswith('/api/deals/') and path.endswith('/reviews'):
                u=self.require(c)
                if not u:return
                did=path.split('/')[3]; d=c.execute('SELECT * FROM deals WHERE id=?',(did,)).fetchone()
                if not deal_access(c,u,d):return self.send_json({'error':'Not allowed'},403)
                if d['status'] not in ('Completed','Cancelled'):return self.send_json({'error':'Reviews open after a deal is completed or cancelled.'},409)
                review_author=d['brand_id'] if u['role']=='brand' else u['id']
                if c.execute('SELECT 1 FROM deal_reviews WHERE deal_id=? AND author_id=?',(did,review_author)).fetchone():return self.send_json({'error':'You already left a review for this deal.'},409)
                rating=whole_number(data.get('rating'))
                comment=clean_text(data.get('comment'),1000)
                if rating is None or rating>5:return self.send_json({'error':'Choose a rating from 1 to 5.'},400)
                if reject_contact(c,u['id'],'review',comment):
                    c.commit(); return self.send_json({'error':CONTACT_BLOCK_MESSAGE},422)
                created=now(); other=d['talent_id'] if u['role']=='brand' else d['brand_id']
                c.execute('INSERT INTO deal_reviews VALUES(?,?,?,?,?,?)',(uid('review'),did,review_author,rating,comment,created))
                c.execute('INSERT INTO notifications VALUES(?,?,?,?,?)',(uid('n'),other,f"{u['name']} left a review for {d['title']}",0,created))
                c.commit(); return self.send_json({'ok':True},201)
            if path.startswith('/api/deals/') and path.endswith('/cancel'):
                u=self.require(c)
                if not u:return
                did=path.split('/')[3]; d=c.execute('SELECT * FROM deals WHERE id=?',(did,)).fetchone()
                if not deal_access(c,u,d):return self.send_json({'error':'Not allowed'},403)
                if d['status'] in ('Completed','Cancelled'):return self.send_json({'error':'This deal is already closed.'},409)
                reason=clean_text(data.get('reason'),1000)
                if reject_contact(c,u['id'],'deal-cancellation',reason):
                    c.commit(); return self.send_json({'error':CONTACT_BLOCK_MESSAGE},422)
                cancelled=now(); other=d['talent_id'] if u['role']=='brand' else d['brand_id']; cancelled_by=d['brand_id'] if u['role']=='brand' else u['id']
                c.execute('UPDATE deals SET status=?,cancelled_by=?,cancelled_at=?,cancel_reason=? WHERE id=?',('Cancelled',cancelled_by,cancelled,reason,did))
                c.execute('INSERT INTO notifications VALUES(?,?,?,?,?)',(uid('n'),other,f"{u['name']} cancelled the deal {d['title']}",0,cancelled))
                c.commit(); return self.send_json({'ok':True,'status':'Cancelled'})
            if path.startswith('/api/deals/') and path.endswith('/payment/plan'):
                u=self.require(c)
                if not u:return
                did=path.split('/')[3]; d=c.execute('SELECT * FROM deals WHERE id=?',(did,)).fetchone()
                if not deal_access(c,u,d):return self.send_json({'error':'Not allowed'},403)
                if (d['payment_status'] or 'Not set') in ('Transfer Sent','Received'):
                    return self.send_json({'error':'Payment tracking cannot be changed after a transfer is marked as sent.'},409)
                plan=clean_text(data.get('paymentPlan'),40)
                if plan not in ('Full','Deposit','Milestones'):return self.send_json({'error':'Choose Full, Deposit or Milestones.'},400)
                note=clean_text(data.get('paymentNote'),800)
                if reject_contact(c,u['id'],'payment-note',note):
                    c.commit(); return self.send_json({'error':CONTACT_BLOCK_MESSAGE},422)
                updated=now()
                c.execute('UPDATE deals SET payment_plan=?,payment_note=?,payment_status=? WHERE id=?',(plan,note,'Planned',did))
                other=d['talent_id'] if u['role']=='brand' else d['brand_id']
                c.execute('INSERT INTO notifications VALUES(?,?,?,?,?)',(uid('n'),other,f"{u['name']} set up payment tracking for {d['title']}",0,updated))
                c.commit(); return self.send_json({'ok':True,'paymentStatus':'Planned'})
            if path.startswith('/api/deals/') and path.endswith('/payment/sent'):
                u=self.require(c,['brand'])
                if not u:return
                did=path.split('/')[3]; d=c.execute('SELECT * FROM deals WHERE id=?',(did,)).fetchone()
                if not d or not is_brand_workspace_member(c,u,d['brand_id']):return self.send_json({'error':'Not allowed'},403)
                if (d['payment_status'] or 'Not set')!='Planned':return self.send_json({'error':'Set a payment plan before marking a transfer as sent.'},409)
                updated=now()
                c.execute('UPDATE deals SET payment_status=?,payment_sent_at=? WHERE id=?',('Transfer Sent',updated,did))
                c.execute('INSERT INTO notifications VALUES(?,?,?,?,?)',(uid('n'),d['talent_id'],f"{u['name']} marked the payment transfer as sent for {d['title']}",0,updated))
                c.commit(); return self.send_json({'ok':True,'paymentStatus':'Transfer Sent'})
            if path.startswith('/api/deals/') and path.endswith('/payment/received'):
                u=self.require(c,['talent'])
                if not u:return
                did=path.split('/')[3]; d=c.execute('SELECT * FROM deals WHERE id=? AND talent_id=?',(did,u['id'])).fetchone()
                if not d:return self.send_json({'error':'Not allowed'},403)
                if (d['payment_status'] or 'Not set')!='Transfer Sent':return self.send_json({'error':'The brand has not marked a transfer as sent yet.'},409)
                updated=now()
                c.execute('UPDATE deals SET payment_status=?,payment_received_at=? WHERE id=?',('Received',updated,did))
                c.execute('INSERT INTO notifications VALUES(?,?,?,?,?)',(uid('n'),d['brand_id'],f"{u['name']} confirmed payment receipt for {d['title']}",0,updated))
                c.commit(); return self.send_json({'ok':True,'paymentStatus':'Received'})
            if path.startswith('/api/deals/') and path.endswith('/status'):
                u=self.require(c);
                if not u:return
                did=path.split('/')[3]; d=c.execute('SELECT * FROM deals WHERE id=?',(did,)).fetchone();
                if not deal_access(c,u,d):return self.send_json({'error':'Not allowed'},403)
                status=data.get('status'); allowed=['Accepted','In Progress','Submitted','Revision Requested','Approved','Completed','Cancelled','In Review']
                if status not in allowed:return self.send_json({'error':'Invalid status'},400)
                if u['role']!='admin':
                    allowed_transition=(
                        (status=='In Progress' and d['status'] in ('Accepted','Revision Requested')) or
                        (u['role']=='talent' and status=='Submitted' and d['status'] in ('In Progress','Revision Requested')) or
                        (u['role']=='brand' and status=='Approved' and d['status']=='Submitted') or
                        (u['role']=='brand' and status=='Completed' and d['status']=='Approved')
                    )
                    if not allowed_transition:return self.send_json({'error':'That action is not available at this stage of the deal.'},409)
                    if status=='Submitted' and not c.execute('SELECT 1 FROM deal_deliveries WHERE deal_id=?',(did,)).fetchone():
                        return self.send_json({'error':'Upload or add a delivery before submitting work.'},409)
                c.execute('UPDATE deals SET status=? WHERE id=?',(status,did)); c.commit(); return self.send_json({'ok':True})
            if path.startswith('/api/favorites/'):
                u=self.require(c,['brand']);
                if not u:return
                tid=path.split('/')[-1]
                if not c.execute("SELECT 1 FROM users WHERE id=? AND role='talent' AND suspended=0",(tid,)).fetchone():return self.send_json({'error':'Talent profile is not available.'},404)
                wid=workspace_brand_id(c,u)
                if c.execute('SELECT 1 FROM favorites WHERE brand_id=? AND talent_id=?',(wid,tid)).fetchone():c.execute('DELETE FROM favorites WHERE brand_id=? AND talent_id=?',(wid,tid)); saved=False
                else:c.execute('INSERT INTO favorites VALUES(?,?)',(wid,tid)); saved=True
                c.commit(); return self.send_json({'saved':saved})
            if path=='/api/shortlists':
                u=self.require(c,['brand']);
                if not u:return
                name=clean_text(data.get('name','New list'),80) or 'New list'
                sid=uid('list'); c.execute('INSERT INTO shortlists VALUES(?,?,?,?)',(sid,workspace_brand_id(c,u),name,now())); c.commit(); return self.send_json({'id':sid},201)
            if path.startswith('/api/shortlists/') and path.endswith('/toggle'):
                u=self.require(c,['brand']);
                if not u:return
                sid=path.split('/')[3]; tid=data.get('talentId'); owner=c.execute('SELECT 1 FROM shortlists WHERE id=? AND brand_id=?',(sid,workspace_brand_id(c,u))).fetchone();
                if not owner:return self.send_json({'error':'List not found'},404)
                if not c.execute("SELECT 1 FROM users WHERE id=? AND role='talent' AND suspended=0",(tid,)).fetchone():return self.send_json({'error':'Talent profile is not available.'},404)
                if c.execute('SELECT 1 FROM shortlist_talent WHERE shortlist_id=? AND talent_id=?',(sid,tid)).fetchone():c.execute('DELETE FROM shortlist_talent WHERE shortlist_id=? AND talent_id=?',(sid,tid)); added=False
                else:c.execute('INSERT INTO shortlist_talent VALUES(?,?)',(sid,tid)); added=True
                c.commit(); return self.send_json({'added':added})
            if path=='/api/upload':
                u=self.require(c); 
                if not u:return
                raw=data.get('data',''); filename=os.path.basename(clean_text(data.get('filename','file'),180))
                ext=Path(filename).suffix.lower()
                if ext not in ALLOWED_UPLOAD_EXTENSIONS:return self.send_json({'error':'Use an image, PDF, Office document or ZIP file.'},400)
                if ',' in raw:raw=raw.split(',',1)[1]
                try:blob=base64.b64decode(raw,validate=True)
                except:return self.send_json({'error':'Invalid file'},400)
                if len(blob)>MAX_UPLOAD_BYTES:return self.send_json({'error':'File too large (6 MB max).'},413)
                UPLOADS.mkdir(parents=True,exist_ok=True)
                target=f"{uuid.uuid4().hex}{ext}"
                temporary=UPLOADS/(target+'.uploading')
                temporary.write_bytes(blob)
                temporary.replace(UPLOADS/target)
                return self.send_json({'url':'/uploads/'+target,'name':filename},201)
            if path.startswith('/api/admin/users/') and path.endswith('/verify'):
                u=self.require(c,['admin']);
                if not u:return
                tid=path.split('/')[4]; r=c.execute('SELECT verified FROM users WHERE id=?',(tid,)).fetchone()
                if not r:return self.send_json({'error':'User not found'},404)
                c.execute('UPDATE users SET verified=? WHERE id=?',(0 if r['verified'] else 1,tid)); c.commit(); return self.send_json({'ok':True})
            if path.startswith('/api/admin/users/') and path.endswith('/suspend'):
                u=self.require(c,['admin']);
                if not u:return
                tid=path.split('/')[4]; r=c.execute('SELECT suspended FROM users WHERE id=?',(tid,)).fetchone();
                if not r:return self.send_json({'error':'User not found'},404)
                if tid==u['id']:return self.send_json({'error':'You cannot suspend your own admin account.'},400)
                c.execute('UPDATE users SET suspended=? WHERE id=?',(0 if r['suspended'] else 1,tid)); c.commit(); return self.send_json({'ok':True})
            if path.startswith('/api/admin/verification-requests/') and path.endswith('/respond'):
                u=self.require(c,['admin'])
                if not u:return
                rid=path.split('/')[4]; request_row=c.execute('SELECT * FROM verification_requests WHERE id=?',(rid,)).fetchone()
                if not request_row:return self.send_json({'error':'Verification request not found.'},404)
                if request_row['status']!='Pending':return self.send_json({'error':'This verification request has already been reviewed.'},409)
                status=clean_text(data.get('status'),20)
                if status not in ('Approved','Rejected'):return self.send_json({'error':'Choose Approved or Rejected.'},400)
                c.execute('UPDATE verification_requests SET status=?,reviewed_at=?,reviewed_by=? WHERE id=?',(status,now(),u['id'],rid))
                if status=='Approved':c.execute('UPDATE users SET verified=1 WHERE id=?',(request_row['user_id'],))
                c.execute('INSERT INTO notifications VALUES(?,?,?,?,?)',(uid('n'),request_row['user_id'],f"Your {request_row['kind']} verification request was {status.lower()}.",0,now()))
                c.commit(); return self.send_json({'ok':True,'status':status})
            return self.send_json({'error':'Not found'},404)
        finally:c.close()
    def do_PATCH(self):
        path=urlparse(self.path).path; data=self.body()
        if data is None:return
        c=db()
        try:
            if path=='/api/me':
                u=self.require(c); 
                if not u:return
                row=c.execute('SELECT * FROM users WHERE id=?',(u['id'],)).fetchone(); p=json.loads(row['profile_json'] or '{}')
                allowed={'bio','country','city','nationality','talentTypes','categories','languages','availability','startingRate','modelCategory','measurements','agency','industry','website','companySize','brandFocus','onboardingComplete','profileVisibility','workedCountries','agencySpecialties','companyDescription'}
                public_values=[data.get('name'),data.get('bio'),data.get('brandFocus'),data.get('agency')]
                if isinstance(data.get('profilePosts'),list):
                    public_values.extend(item.get('caption') for item in data['profilePosts'] if isinstance(item,dict))
                if isinstance(data.get('services'),list):
                    public_values.extend(item.get('name') for item in data['services'] if isinstance(item,dict))
                if reject_contact(c,u['id'],'public-profile',*public_values):
                    c.commit(); return self.send_json({'error':CONTACT_BLOCK_MESSAGE},422)
                if 'profileVisibility' in data and data.get('profileVisibility') not in ('Public','Private'):
                    return self.send_json({'error':'Choose Public or Private profile visibility.'},400)
                for k in allowed:
                    if k in data:p[k]=data[k]
                if 'profilePhoto' in data:p['profilePhoto']=uploaded_url(data.get('profilePhoto'))
                if 'coverImage' in data:p['coverImage']=uploaded_url(data.get('coverImage'))
                if 'portfolio' in data and isinstance(data['portfolio'],list):
                    p['portfolio']=[uploaded_url(item) for item in data['portfolio'][:18] if uploaded_url(item)]
                if 'profilePosts' in data and isinstance(data['profilePosts'],list):
                    posts=[]
                    for item in data['profilePosts'][:24]:
                        if not isinstance(item,dict):continue
                        url=uploaded_url(item.get('url'))
                        if url:posts.append({'url':url,'caption':clean_text(item.get('caption'),300)})
                    p['profilePosts']=posts
                if 'availabilityCalendar' in data:
                    p['availabilityCalendar']=normalise_availability(data.get('availabilityCalendar'))
                if 'travelPlans' in data:
                    p['travelPlans']=normalise_travel(data.get('travelPlans'))
                if 'platforms' in data and isinstance(data['platforms'],list):
                    p['platforms']=[{'name':clean_text(item.get('name'),50),'handle':clean_text(item.get('handle'),100),'followers':money_value(item.get('followers')) or 0} for item in data['platforms'][:6] if isinstance(item,dict) and clean_text(item.get('name'),50)]
                if 'services' in data and isinstance(data['services'],list):
                    p['services']=[{'name':clean_text(item.get('name'),100),'price':money_value(item.get('price')) or 0} for item in data['services'][:6] if isinstance(item,dict) and clean_text(item.get('name'),100)]
                if 'brandTags' in data and isinstance(data['brandTags'],list):
                    p['brandTags']=[clean_text(item,50) for item in data['brandTags'][:8] if clean_text(item,50)]
                name=clean_text(data.get('name',row['name']),120) or row['name']
                c.execute('UPDATE users SET name=?,profile_json=? WHERE id=?',(name,json.dumps(p),u['id'])); c.commit(); return self.send_json({'user':public_user(c.execute('SELECT * FROM users WHERE id=?',(u['id'],)).fetchone())})
            return self.send_json({'error':'Not found'},404)
        finally:c.close()

if __name__=='__main__':
    init_db(); port=int(os.environ.get('PORT','8000')); print(f'MUSE running on http://localhost:{port}'); ThreadingHTTPServer(('0.0.0.0',port),Handler).serve_forever()
