import importlib.util,os,pathlib,tempfile,time,json,hashlib,unittest,types
BASE=pathlib.Path(os.environ['FLOW_RUNTIME_CANDIDATE'])
REAL_META=json.loads(pathlib.Path(os.environ['FLOW_QA_METADATA_FILE']).read_text())
def load(name,file):
 s=importlib.util.spec_from_file_location(name,BASE/file);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
m=load('runtime_candidate','flow-runtime.py');opmod=load('real_operation','flow-operation.py')
TASK='11111111-1111-4111-8111-111111111111';PROJECT='93a089fa-6105-47ce-bf4c-42c5561b3b41'
class Cases(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory(prefix='studio-flow-preflight-qa-');self.root=pathlib.Path(self.tmp.name);self.calls=[]
  for name in ['ops','media','work','home']: (self.root/name).mkdir()
  self.cli=self.root/'agy';self.cli.write_text('# unused fake CLI file');self.cli.chmod(0o700)
  self.anchor=self.root/'work'/'anchor.png';self.anchor.write_bytes(b'fixture anchor; no real PNG/native observation')
  self.cfg={'operation_root':self.root/'ops','media_root':self.root/'media','work_root':self.root/'work','anchor_path':self.anchor,'cli_path':REAL_META['cli'],'home_path':REAL_META['home'],'browser_lock':str(self.root/'browser.lock'),'project':PROJECT,'email':'qa@example.com','cancel_callback':lambda:False}
  calls=self.calls;anchor=self.anchor
  class Obs:
   def __init__(self,*args):calls.append('observer')
   def capture(self):calls.append('capture');return anchor,time.time()
   def observe(self,file,captured,question,fields,**kwargs):
    calls.append('observe');return {'frameHash':hashlib.sha256(file.read_bytes()).hexdigest(),'capturedAt':captured,'observation':{k:True for k in fields}}
  class Display:
   def __enter__(self):calls.append('display');return self
   def __exit__(self,*args):pass
   def click(self,*args):calls.append('click')
  def prepare(op,obs,display,project,email,prompt):
   with display() as d:d.click('close-profile',1007,146)
   r=op.prepare(project,email,{'model':'Omni 1.1 Flash','cost':12,'seconds':8,'height':720,'results':1,'balance':1050},time.time())
   return {'state':r['state'],'operationId':r['operationId'],'contextHash':r['contextHash'],'quotedCredits':12,'expiresAt':time.time()+180}
  def fresh(record,digest):
   if record['frameHash']!=digest or not 0<=time.time()-record['capturedAt']<=180:raise ValueError('Fixture record not fresh/matching')
   return record['observation']
  self.deps={'operation_module':opmod,'observation_module':types.SimpleNamespace(Observer=Obs,fresh_record=fresh),'display_module':types.SimpleNamespace(FlowDisplay=Display),'controller_module':types.SimpleNamespace(prepare=prepare)}
 def tearDown(self):self.tmp.cleanup()
 def req(self,extra=False,engine='flow'):
  ctx={'site':'fixture','originalInstruction':'one clip','completed':[],'nextStage':{'id':0,'kind':'video','engine':engine,'instruction':'one bounded video'},'publish':False}
  if extra:ctx['engine']='flow'
  text=json.dumps(ctx);return {'taskId':TASK,'stageId':0,'kind':'video','operationId':TASK+':0','contextHash':hashlib.sha256(text.encode()).hexdigest(),'instruction':text,'recoverOnly':False}
 def legacy_display(self):self.deps['display_module'].Display=self.deps['display_module'].FlowDisplay
 def test_actual_flowrequest_shape_has_engine_on_nextstage_only(self):self.assertEqual(m.prepare_request(self.req(),self.cfg,**self.deps)['status'],'waiting')
 def test_actual_flowdisplay_class_contract(self):self.assertEqual(m.prepare_request(self.req(),self.cfg,**self.deps)['status'],'waiting')
 def test_missing_cancellation_callback_refuses_before_input(self):
  self.legacy_display();self.cfg.pop('cancel_callback')
  try:
   out=m.prepare_request(self.req(),self.cfg,**self.deps);self.assertEqual(out.get('status'),'attention')
  except m.CancelledError:pass
  self.assertEqual(self.calls,[])
 def test_nonflow_nextstage_refuses_before_input(self):
  self.legacy_display()
  with self.assertRaises(Exception):m.prepare_request(self.req(engine='other'),self.cfg,**self.deps)
  self.assertEqual(self.calls,[])
 def test_missing_explicit_account_project_no_defaults(self):
  self.legacy_display();self.cfg.pop('email');self.cfg.pop('project')
  with self.assertRaises(Exception):m.prepare_request(self.req(),self.cfg,**self.deps)
  self.assertEqual(self.calls,[])
 def seed(self,state='prepared',changes=None,result=None):
  q=self.req()
  with opmod.Operation(self.root/'ops',q) as op:
   rec=op.prepare(PROJECT,'qa@example.com',{'model':'Omni 1.1 Flash','cost':12,'seconds':8,'height':720,'results':1,'balance':1050},time.time())
   if state=='completed':rec.update(state=state,submittedAt=time.time()-1,result=result)
   if changes:rec.update(changes)
   op.write(rec)
 def meta(self):return {'provider':'google-flow','verified':True,'url':'/studio-media/22222222-2222-4222-8222-222222222222.mp4','sha256':'a'*64,'bytes':1000,'width':1280,'height':720,'seconds':8}
 def recovery_request(self):q=self.req();q['recoverOnly']=True;return q
 def result(self,data):
  q=self.req();return {'status':'success','accountId':'qa@example.com','email':'qa@example.com','operationId':q['operationId'],'contextHash':q['contextHash'],'data':data}
 def mock_verified(self):self.deps['operation_module']=types.SimpleNamespace(Operation=opmod.Operation,verify_video=lambda *args:self.meta())
 def test_completed_missing_verified_metadata_never_success(self):
  self.seed('completed',result=self.result({'url':self.meta()['url']}));self.mock_verified()
  with self.assertRaises(Exception):m.prepare_request(self.recovery_request(),self.cfg,**self.deps)
 def test_completed_missing_result_identity_never_success(self):
  r=self.result(self.meta());r.pop('operationId');self.seed('completed',result=r);self.mock_verified()
  with self.assertRaises(Exception):m.prepare_request(self.recovery_request(),self.cfg,**self.deps)
 def test_prepared_future_quote_refused(self):
  self.seed(changes={'capturedAt':time.time()+100})
  with self.assertRaises(Exception):m.prepare_request(self.req(),self.cfg,**self.deps)
 def test_prepared_zero_quote_refused(self):
  self.seed(changes={'quote':{'model':'Omni 1.1 Flash','cost':0,'seconds':8,'height':720,'results':1,'balance':1050}})
  with self.assertRaises(Exception):m.prepare_request(self.req(),self.cfg,**self.deps)
 def test_visual_binding_bool_revision_differs_from_number(self):
  q=self.req();ctx=json.loads(q['instruction']);v={'pageId':'doc','fieldId':'field','fieldKind':'video','revision':1,'currentValue':'/old.mp4','ownerId':'owner'};q['visualBinding']=v;ctx['visualBinding']={**v,'revision':True};q['instruction']=json.dumps(ctx);q['contextHash']=hashlib.sha256(q['instruction'].encode()).hexdigest()
  with self.assertRaises(Exception):m.prepare_request(q,self.cfg,**self.deps)
  self.assertEqual(self.calls,[])
 def test_actual_sqlite_task_witness_cancel_and_kind_change(self):
  import sqlite3
  q=self.req();ctx=json.loads(q['instruction']);db=self.root/'tasks.sqlite';c=sqlite3.connect(db);c.execute('CREATE TABLE tasks(id TEXT,site TEXT,instruction TEXT,state TEXT,checkpoint TEXT)');cp={'kind':'agent','plan':{'steps':[ctx['nextStage']]},'completed':[]};c.execute('INSERT INTO tasks VALUES(?,?,?,?,?)',(TASK,ctx['site'],ctx['originalInstruction'],'queued',json.dumps(cp)));c.commit();witness=m.make_task_witness(db,q);self.assertFalse(witness());c.execute("UPDATE tasks SET state='cancelled'");c.commit();self.assertTrue(witness());cp['kind']='article';c.execute("UPDATE tasks SET state='queued',checkpoint=?",(json.dumps(cp),));c.commit();self.assertTrue(witness());c.close()
if __name__=='__main__':unittest.main()
