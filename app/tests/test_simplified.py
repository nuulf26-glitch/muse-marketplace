"""Integration checks against an isolated SQLite database, never production data."""
import unittest, tempfile, os, sys, threading, json, http.cookiejar
from urllib.request import build_opener, HTTPCookieProcessor, Request
from urllib.error import HTTPError
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import server

class SimplifiedFlow(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp=tempfile.TemporaryDirectory()
        server.DB=Path(cls.tmp.name)/'test.db'
        server.UPLOADS=Path(cls.tmp.name)/'uploads'
        server.init_db()
        cls.http=server.ThreadingHTTPServer(('127.0.0.1',0),server.Handler)
        cls.thread=threading.Thread(target=cls.http.serve_forever,daemon=True);cls.thread.start()
        cls.base='http://127.0.0.1:'+str(cls.http.server_port)
    @classmethod
    def tearDownClass(cls):
        cls.http.shutdown();cls.http.server_close();cls.tmp.cleanup()
    def client(self):return build_opener(HTTPCookieProcessor(http.cookiejar.CookieJar()))
    def call(self,client,path,body=None,method=None,expected=200):
        request=Request(self.base+path,data=json.dumps(body).encode() if body is not None else None,headers={'Content-Type':'application/json'},method=method)
        try:
            with client.open(request) as r:status=r.status;data=json.load(r)
        except HTTPError as e:status=e.code;data=json.load(e)
        self.assertEqual(status,expected,data);return data
    def user(self,role,name):
        c=self.client();u=self.call(c,'/api/signup',{'role':role,'name':name,'email':name+'@example.com','password':'Testing-Only-4829','talentTypes':['Content Creator'] if role=='talent' else []},expected=201)['user']
        self.call(c,'/api/me',{'onboardingComplete':True,'profileVisibility':'Public','country':'Japan','city':'Tokyo','bio':'Creative work','services':[{'name':'Reel','price':200}]},method='PATCH')
        return c,u
    def test_offer_to_completed_deal_and_private_tools(self):
        b,brand=self.user('brand','Brand');t,talent=self.user('talent','Creator');other,outsider=self.user('talent','Other');guest=self.client()
        self.assertTrue(self.call(guest,'/api/talents')['talents'])
        self.call(guest,'/api/workspace-events',expected=401)
        eid=self.call(t,'/api/workspace-events',{'title':'Outside collaboration','date':'2026-10-22','kind':'Shoot'})['id']
        self.assertEqual(self.call(other,'/api/workspace-events')['events'],[])
        self.call(other,'/api/workspace-events',{'id':eid,'action':'delete'},expected=404)
        self.call(t,'/api/workspace-events',{'title':'Bad date','date':'2026-02-31','kind':'Shoot'},expected=400)
        self.call(t,'/api/workspace-events',{'id':eid,'done':True})
        self.assertEqual(self.call(t,'/api/workspace-events')['events'][0]['done'],1)
        public=self.call(guest,'/api/talents/'+talent['id'])['talent']
        self.assertNotIn('events',public);self.assertEqual(public['services'][0]['price'],200)
        self.call(guest,'/api/favorites/'+talent['id'],{},expected=401)
        self.call(b,'/api/favorites/'+talent['id'],{})
        offer={'talentId':talent['id'],'title':'Editorial shoot','details':'One video','deliverables':'One video','date':'2026-10-25','price':500,'agreeToTerms':True}
        oid=self.call(b,'/api/offers',offer,expected=201)['id']
        self.call(other,'/api/offers/'+oid+'/respond',{'status':'Accepted','agreeToTerms':True},expected=403)
        chat=self.call(t,'/api/offers/'+oid+'/respond',{'status':'Negotiating'})['chatId']
        self.call(b,'/api/chats/'+chat)
        self.call(t,'/api/offers/'+oid+'/respond',{'status':'Accepted','agreeToTerms':True})
        self.call(t,'/api/offers/'+oid+'/respond',{'status':'Accepted','agreeToTerms':True},expected=409)
        deals=self.call(t,'/api/deals')['deals'];self.assertEqual(len(deals),1);did=deals[0]['id']
        self.call(other,'/api/deals/'+did+'/checklist',{'item':'content','done':True},expected=403)
        self.call(t,'/api/deals/'+did+'/checklist',{'item':'approved','done':True},expected=400)
        self.call(t,'/api/deals/'+did+'/checklist',{'item':'concept','done':True})
        self.assertTrue(self.call(b,'/api/deals/'+did)['checklist']['concept'])
        self.call(t,'/api/deals/'+did+'/status',{'status':'In Progress'})
        self.call(t,'/api/deals/'+did+'/messages',{'text':'Interested'},expected=201)
        self.call(t,'/api/deals/'+did+'/deliveries',{'note':'Final video delivered'},expected=201)
        self.call(t,'/api/deals/'+did+'/status',{'status':'Approved'},expected=409)
        self.call(b,'/api/deals/'+did+'/status',{'status':'Approved'})
        self.call(b,'/api/deals/'+did+'/status',{'status':'Completed'})
        self.call(t,'/api/deals/'+did+'/checklist',{'item':'posted','done':True},expected=409)
        self.call(t,'/api/workspace-events',{'id':eid,'action':'delete'})
        self.assertEqual(self.call(t,'/api/workspace-events')['events'],[])
        # Migration is repeatable and preserves the completed collaboration.
        server.init_db();self.assertEqual(self.call(t,'/api/deals/'+did)['deal']['status'],'Completed')
if __name__=='__main__':unittest.main()
