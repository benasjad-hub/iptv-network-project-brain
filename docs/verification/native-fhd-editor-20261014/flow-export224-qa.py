import importlib.util,os,pathlib,tempfile,time,json,hashlib,unittest
from unittest.mock import patch
base=pathlib.Path(os.environ['FLOW_EXPORT_CANDIDATE'])
def load(name,file):
 s=importlib.util.spec_from_file_location(name,base/file);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
m=load('exports','flow-export.py');operations=load('ops','flow-operation.py');runtime=load('runtime','flow-runtime.py');session=load('session','flow-session.py')
TASK='11111111-1111-4111-8111-111111111111';PROJECT='93a089fa-6105-47ce-bf4c-42c5561b3b41';RESULT='44444444-4444-4444-8444-444444444444';EMAIL='qa@example.com';PROMPT='one bounded test clip'
class Export(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory(prefix='studio-export-qa-');self.root=pathlib.Path(self.tmp.name);self.downloads=self.root/'downloads';self.downloads.mkdir();self.ops=self.root/'ops';self.ops.mkdir();self.lock=self.root/'browser.lock'
  instruction=json.dumps({'nextStage':{'id':0,'engine':'flow','kind':'video','instruction':PROMPT},'completed':[],'publish':False,'site':'fixture'})
  self.req={'taskId':TASK,'stageId':0,'kind':'video','instruction':instruction,'operationId':TASK+':0','contextHash':hashlib.sha256(instruction.encode()).hexdigest()}
  self.op=operations.Operation(self.ops,self.req).__enter__();self.lease=runtime.BrowserLock(self.lock).__enter__();session.reserve(self.op,self.lease,PROJECT,EMAIL)
  self.op.prepare(PROJECT,EMAIL,{'model':'Omni 1.1 Flash','cost':12,'balance':1050,'seconds':8,'height':720,'results':1},time.time());self.op.submit_once(lambda *_:None)
 def tearDown(self):self.lease.__exit__();self.op.__exit__();self.tmp.cleanup()
 def witness(self):return {'operationId':self.op.operation,'contextHash':self.op.digest,'project':PROJECT,'email':EMAIL,'resultId':RESULT,'promptHash':hashlib.sha256(PROMPT.encode()).hexdigest(),'frameHash':'a'*64,'capturedAt':time.time(),'completed':True,'original720':True}
 def native(self,name):
  w=self.witness();w.pop('completed');w['name']=name;return w
 def prepare(self):return m.prepare_export(self.op,self.lease,str(self.downloads),self.witness())
 def attempt(self,action=lambda:None):return m.attempt_export_once(self.op,self.lease,lambda:False,action)
 def test_persist_before_click_and_unknown_never_replays(self):
  self.prepare();calls=[]
  def action():
   self.assertEqual(self.op.read()['export']['state'],'attempted');calls.append(1);raise TimeoutError('unknown ordinary export')
  with self.assertRaises(TimeoutError):self.attempt(action)
  before=self.op.file.read_bytes();self.attempt(lambda:calls.append(2));self.assertEqual(calls,[1]);self.assertEqual(before,self.op.file.read_bytes())
 def test_same_prepare_keeps_original_baseline_and_time(self):
  self.prepare();before=self.op.file.read_bytes();(self.downloads/'later.mp4').write_bytes(b'later');self.prepare();self.assertEqual(before,self.op.file.read_bytes())
 def test_changed_result_refuses(self):
  self.prepare();w=self.witness();w['resultId']='55555555-5555-4555-8555-555555555555'
  with self.assertRaises(ValueError):m.prepare_export(self.op,self.lease,str(self.downloads),w)
 def test_wrong_prompt_and_future_timestamp_refuse_before_write(self):
  before=self.op.file.read_bytes()
  for edit in ({'promptHash':'b'*64},{'capturedAt':time.time()+100},{'capturedAt':True},{'original720':1}):
   with self.assertRaises(ValueError):m.prepare_export(self.op,self.lease,str(self.downloads),{**self.witness(),**edit})
  self.assertEqual(before,self.op.file.read_bytes())
 def test_baseline_legacy_cannot_be_bound(self):
  name='legacy.mp4';(self.downloads/name).write_bytes(b'old');self.prepare();self.attempt()
  with self.assertRaises(ValueError):m.bind_export_name(self.op,self.lease,name,self.native(name))
 def test_safe_unicode_native_filename_binds_once(self):
  name='Écran_20261014.mp4';self.prepare();self.attempt();m.bind_export_name(self.op,self.lease,name,self.native(name));before=self.op.file.read_bytes();m.bind_export_name(self.op,self.lease,name,self.native(name));self.assertEqual(before,self.op.file.read_bytes());self.assertEqual(self.op.read()['export']['expectedName'],name);self.assertEqual(self.op.read()['state'],'submission-attempted');self.assertNotIn('result',self.op.read())
 def test_unsafe_names_and_wrong_native_result_refuse(self):
  self.prepare();self.attempt();before=self.op.file.read_bytes()
  for name in ('../old.mp4','bad\\old.mp4','a:old.mp4','.hidden.mp4','bad\n.mp4','a.mp4 '):
   with self.assertRaises(ValueError):m.bind_export_name(self.op,self.lease,name,self.native(name))
  name='new.mp4';w=self.native(name);w['resultId']='55555555-5555-4555-8555-555555555555'
  with self.assertRaises(ValueError):m.bind_export_name(self.op,self.lease,name,w)
  self.assertEqual(before,self.op.file.read_bytes())
 def test_symlink_baseline_rejected(self):
  victim=self.root/'victim';victim.write_bytes(b'private');(self.downloads/'a.mp4').symlink_to(victim)
  with self.assertRaises(ValueError):self.prepare()
  self.assertNotIn('export',self.op.read())
 def test_missing_owner_and_cancel_refuse_before_action(self):
  self.prepare();calls=[]
  with self.assertRaises(Exception):m.attempt_export_once(self.op,self.lease,lambda:True,lambda:calls.append(1))
  self.assertEqual(calls,[]);self.assertEqual(self.op.read()['export']['state'],'prepared')
  self.lock.with_name(self.lock.name+'.owner.json').unlink()
  with self.assertRaises(ValueError):self.attempt(lambda:calls.append(1))
  self.assertEqual(calls,[])
 def test_directory_replacement_refused(self):
  self.prepare();self.downloads.rename(self.root/'old-dir');self.downloads.mkdir();calls=[]
  with self.assertRaises(ValueError):self.attempt(lambda:calls.append(1))
  self.assertEqual(calls,[])
 def test_overlarge_baseline_refuses_before_intent(self):
  for index in range(129):(self.downloads/('legacy-'+str(index)+'.mp4')).write_bytes(b'x')
  with self.assertRaises(ValueError):self.prepare()
  self.assertNotIn('export',self.op.read())
 def test_corrupt_saved_intent_cannot_trigger_action(self):
  self.prepare();rec=self.op.read();rec['export']['at']=time.time()+100;self.op.write(rec);calls=[]
  with self.assertRaises(ValueError):self.attempt(lambda:calls.append(1))
  self.assertEqual(calls,[])
 def test_same_named_retry_cannot_hide_changed_native_identity(self):
  name='new.mp4';self.prepare();self.attempt();m.bind_export_name(self.op,self.lease,name,self.native(name));before=self.op.file.read_bytes();w=self.native(name);w['contextHash']='b'*64
  with self.assertRaises(ValueError):m.bind_export_name(self.op,self.lease,name,w)
  self.assertEqual(before,self.op.file.read_bytes())
 def test_future_stored_witness_refuses_before_action(self):
  self.prepare();rec=self.op.read();rec['export']['witness']['capturedAt']=time.time()+100;self.op.write(rec);calls=[]
  with self.assertRaises(ValueError):self.attempt(lambda:calls.append(1))
  self.assertEqual(calls,[])
 def test_invalid_action_does_not_persist_attempt(self):
  self.prepare();before=self.op.file.read_bytes()
  with self.assertRaises(ValueError):m.attempt_export_once(self.op,self.lease,lambda:False,None)
  self.assertEqual(before,self.op.file.read_bytes())
 def test_duplicate_baseline_and_bool_version_refuse(self):
  (self.downloads/'legacy.mp4').write_bytes(b'old');self.prepare();rec=self.op.read();saved=json.loads(json.dumps(rec))
  for change in ('duplicate','version'):
   rec=json.loads(json.dumps(saved))
   if change=='duplicate':rec['export']['baseline']['entries']*=2
   else:rec['export']['version']=True
   self.op.write(rec);calls=[]
   with self.assertRaises(ValueError):self.attempt(lambda:calls.append(1))
   self.assertEqual(calls,[])
 def test_stale_prepared_witness_never_triggers_action(self):
  self.prepare();now=time.time()+200;calls=[]
  with patch.object(m.time,'time',return_value=now):
   with self.assertRaises(ValueError):self.attempt(lambda:calls.append(1))
  self.assertEqual(calls,[]);self.assertEqual(self.op.read()['export']['state'],'prepared')
 def test_named_recovery_survives_elapsed_time_without_writing(self):
  name='new.mp4';self.prepare();self.attempt();m.bind_export_name(self.op,self.lease,name,self.native(name));before=self.op.file.read_bytes();now=time.time()+200
  with patch.object(m.time,'time',return_value=now):m.bind_export_name(self.op,self.lease,name,self.native(name))
  self.assertEqual(before,self.op.file.read_bytes())
 def test_named_attempt_retry_never_calls_action(self):
  name='new.mp4';self.prepare();self.attempt();m.bind_export_name(self.op,self.lease,name,self.native(name));before=self.op.file.read_bytes();calls=[];self.attempt(lambda:calls.append(1));self.assertEqual(calls,[]);self.assertEqual(before,self.op.file.read_bytes())
 def test_missing_actual_operation_account_or_project_refuses(self):
  saved=self.op.read()
  for key in ('accountId','project'):
   rec={**saved,key:None};self.op.write(rec)
   with self.assertRaises(ValueError):self.prepare()
   self.assertNotIn('export',self.op.read())
if __name__=='__main__':unittest.main(verbosity=2)
