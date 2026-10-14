import importlib.util,os,pathlib,tempfile,time,json,hashlib,unittest
from unittest.mock import patch
base=pathlib.Path(os.environ['FLOW_LINEAGE_CANDIDATE'])
def load(name,file):
 s=importlib.util.spec_from_file_location(name,base/file);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
m=load('lineage','flow-lineage.py');operations=load('ops','flow-operation.py');runtime=load('runtime','flow-runtime.py');session=load('session','flow-session.py')
TASK='11111111-1111-4111-8111-111111111111';PROJECT='93a089fa-6105-47ce-bf4c-42c5561b3b41';RESULT='a4444444-4444-4444-8444-444444444444';EMAIL='qa@example.com';PROMPT='one bounded test clip'
class Lineage(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory(prefix='studio-lineage-qa-');self.root=pathlib.Path(self.tmp.name);self.ops=self.root/'ops';self.ops.mkdir();self.lock=self.root/'browser.lock'
  instruction=json.dumps({'nextStage':{'id':0,'engine':'flow','kind':'video','instruction':PROMPT},'completed':[],'publish':False,'site':'fixture'})
  req={'taskId':TASK,'stageId':0,'kind':'video','instruction':instruction,'operationId':TASK+':0','contextHash':hashlib.sha256(instruction.encode()).hexdigest()}
  self.op=operations.Operation(self.ops,req).__enter__();self.lease=runtime.BrowserLock(self.lock).__enter__();session.reserve(self.op,self.lease,PROJECT,EMAIL)
  self.op.prepare(PROJECT,EMAIL,{'model':'Omni 1.1 Flash','cost':12,'balance':1050,'seconds':8,'height':720,'results':1},time.time());self.op.submit_once(lambda *_:None)
 def tearDown(self):self.lease.__exit__();self.op.__exit__();self.tmp.cleanup()
 def witness(self):
  now=time.time();return {'operationId':self.op.operation,'contextHash':self.op.digest,'project':PROJECT,'email':EMAIL,'resultId':RESULT,'promptHash':hashlib.sha256(PROMPT.encode()).hexdigest(),'frameHash':'a'*64,'capturedAt':now,'createdAt':self.op.read()['submittedAt']+0.000001,'completed':True}
 def saved(self):return {str(p.name):p.read_bytes() for p in self.op.directory.iterdir() if p.is_file()}
 def test_absent_is_none(self):self.assertIsNone(m.read_result(self.op,self.lease))
 def test_bind_persist_private_readback_no_completion(self):
  m.bind_result(self.op,self.lease,self.witness());self.assertIsNotNone(m.read_result(self.op,self.lease));self.assertEqual(self.op.read()['state'],'submission-attempted');self.assertNotIn('result',self.op.read())
  for p in self.op.directory.glob('*.json'):self.assertEqual(p.stat().st_mode&0o777,0o600)
 def test_same_identity_new_frame_retains_original_bytes(self):
  w=self.witness();m.bind_result(self.op,self.lease,w);before=self.saved();m.bind_result(self.op,self.lease,{**w,'frameHash':'b'*64,'capturedAt':time.time()});self.assertEqual(before,self.saved())
 def test_changed_identity_refuses_without_write(self):
  w=self.witness();m.bind_result(self.op,self.lease,w);before=self.saved()
  for edit in ({'resultId':'55555555-5555-4555-8555-555555555555'},{'createdAt':w['createdAt']+0.00001},{'email':'other@example.com'},{'contextHash':'b'*64},{'promptHash':'b'*64}):
   with self.assertRaises(ValueError):m.bind_result(self.op,self.lease,{**w,**edit,'capturedAt':time.time()})
  self.assertEqual(before,self.saved())
 def test_historical_same_prompt_fresh_download_refuses(self):
  w=self.witness();w['createdAt']=self.op.read()['submittedAt']-1;before=self.saved()
  with self.assertRaises(ValueError):m.bind_result(self.op,self.lease,w)
  self.assertEqual(before,self.saved())
 def test_bad_types_future_hidden_values_refuse(self):
  for edit in ({'createdAt':None},{'createdAt':True},{'createdAt':float('nan')},{'createdAt':time.time()+10},{'capturedAt':time.time()+10},{'completed':1},{'resultId':RESULT.upper()},{'frameHash':'bad'},{'extra':True}):
   with self.assertRaises(ValueError):m.bind_result(self.op,self.lease,{**self.witness(),**edit})
 def test_stale_capture_refuses(self):
  w=self.witness();later=time.time()+200
  with patch.object(m.time,'time',return_value=later):
   with self.assertRaises(ValueError):m.bind_result(self.op,self.lease,w)
 def test_read_survives_elapsed_time_without_write(self):
  m.bind_result(self.op,self.lease,self.witness());before=self.saved()
  with patch.object(m.time,'time',return_value=time.time()+86400):self.assertIsNotNone(m.read_result(self.op,self.lease))
  self.assertEqual(before,self.saved())
 def test_missing_owner_refuses(self):
  self.lock.with_name(self.lock.name+'.owner.json').unlink()
  with self.assertRaises(ValueError):m.bind_result(self.op,self.lease,self.witness())
 def test_prepared_or_missing_actual_account_refuses(self):
  saved=self.op.read()
  for edit in ({'state':'prepared'},{'accountId':None},{'project':None}):
   self.op.write({**saved,**edit})
   with self.assertRaises(ValueError):m.bind_result(self.op,self.lease,self.witness())
 def test_saved_corruption_and_symlink_refuse(self):
  m.bind_result(self.op,self.lease,self.witness());files=[p for p in self.op.directory.glob('*.json') if p!=self.op.file];self.assertEqual(len(files),1);p=files[0];original=p.read_bytes();p.write_text('{}')
  with self.assertRaises(ValueError):m.read_result(self.op,self.lease)
  p.unlink();victim=self.root/'victim';victim.write_bytes(original);p.symlink_to(victim)
  with self.assertRaises(ValueError):m.read_result(self.op,self.lease)
 def test_alternate_receipt_is_never_trusted(self):
  alt=self.op.directory/'flow-lineage.json';alt.write_text('{}');self.assertIsNone(m.read_result(self.op,self.lease))
 def test_exact_saved_stage_contract(self):
  original=self.op.instruction;obj=json.loads(original)
  changes=[{'id':False},{'id':1},{'engine':'antigravity'},{'kind':'image'}]
  for change in changes:
   altered=json.loads(original);altered['nextStage'].update(change);self.op.instruction=json.dumps(altered)
   with self.assertRaises(ValueError):m.bind_result(self.op,self.lease,self.witness())
  altered=json.loads(original);altered['nextStage'].pop('id');altered['stageId']=0;self.op.instruction=json.dumps(altered)
  with self.assertRaises(ValueError):m.bind_result(self.op,self.lease,self.witness())
  altered=json.loads(original);altered['publish']=0;self.op.instruction=json.dumps(altered)
  with self.assertRaises(ValueError):m.bind_result(self.op,self.lease,self.witness())
  self.op.instruction=original
 def test_saved_extra_and_future_bound_refuse(self):
  m.bind_result(self.op,self.lease,self.witness());p=self.op.directory/'flow-result.json';record=json.loads(p.read_text())
  for edit in ({'extra':True},{'version':True},{'boundAt':time.time()+100}):
   p.write_text(json.dumps({**record,**edit}))
   with self.assertRaises(ValueError):m.read_result(self.op,self.lease)
if __name__=='__main__':unittest.main(verbosity=2)