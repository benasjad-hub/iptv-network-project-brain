import importlib.util,os,pathlib,tempfile,time,json,hashlib,unittest,uuid
from unittest.mock import patch
base=pathlib.Path(os.environ['FLOW_JOB_CANDIDATE'])
def load(name,file):
 s=importlib.util.spec_from_file_location(name,base/file);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
m=load('job','flow-job.py');ops=load('operations','flow-operation.py');rt=load('runtime','flow-runtime.py');session=load('session','flow-session.py')
TASK='11111111-1111-4111-8111-111111111111';PROJECT='93a089fa-6105-47ce-bf4c-42c5561b3b41';OLD='b01cf30e-60f2-4d1f-9d8e-8cbf42fcb9ba';NEW='a4444444-4444-4444-8444-444444444444';EMAIL='qa@example.com';PROMPT='one bounded fixture video'
class Job(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory(prefix='studio-flow-job-qa-');self.root=pathlib.Path(self.tmp.name);self.oproot=self.root/'ops';self.oproot.mkdir();self.lock=self.root/'browser.lock'
  instruction=json.dumps({'nextStage':{'id':0,'engine':'flow','kind':'video','instruction':PROMPT},'completed':[],'publish':False,'site':'fixture'});req={'taskId':TASK,'stageId':0,'kind':'video','instruction':instruction,'operationId':TASK+':0','contextHash':hashlib.sha256(instruction.encode()).hexdigest()}
  self.op=ops.Operation(self.oproot,req).__enter__();self.lease=rt.BrowserLock(self.lock).__enter__();session.reserve(self.op,self.lease,PROJECT,EMAIL)
 def tearDown(self):self.lease.__exit__();self.op.__exit__();self.tmp.cleanup()
 def common(self):return {'operationId':self.op.operation,'contextHash':self.op.digest,'project':PROJECT,'email':EMAIL,'promptHash':hashlib.sha256(PROMPT.encode()).hexdigest(),'frameHash':'a'*64,'capturedAt':time.time()}
 def baseline(self):return {**self.common(),'galleryComplete':True,'noPending':True,'resultIds':[OLD]}
 def pending(self):return {**self.common(),'resultId':NEW,'pending':True}
 def submit(self):self.op.prepare(PROJECT,EMAIL,{'model':'Omni 1.1 Flash','cost':12,'balance':1050,'seconds':8,'height':720,'results':1},time.time());self.op.submit_once(lambda *_:None)
 def start(self):m.record_baseline(self.op,self.lease,self.baseline());self.submit()
 def saved(self):return {p.name:p.read_bytes() for p in self.op.directory.iterdir() if p.is_file()}
 def test_new_baseline_pending_private_no_completion_authority(self):
  self.start();m.bind_pending(self.op,self.lease,self.pending());self.assertIsNotNone(m.read_pending(self.op,self.lease));self.assertEqual(self.op.read()['state'],'submission-attempted');self.assertNotIn('result',self.op.read());self.assertFalse((self.op.directory/'flow-result.json').exists())
  for name in ('flow-job-baseline.json','flow-job-pending.json'):self.assertEqual((self.op.directory/name).stat().st_mode&0o777,0o600)
 def test_absent_pending_returns_none(self):self.assertIsNone(m.read_pending(self.op,self.lease))
 def test_incomplete_pending_bad_ids_refuse_baseline(self):
  for edit in ({'galleryComplete':False},{'galleryComplete':1},{'noPending':False},{'noPending':1},{'resultIds':[OLD,OLD]},{'resultIds':[OLD.upper()]},{'resultIds':[str(uuid.uuid4()) for _ in range(9)]},{'resultIds':None},{'extra':True}):
   with self.assertRaises(ValueError):m.record_baseline(self.op,self.lease,{**self.baseline(),**edit})
  self.assertFalse((self.op.directory/'flow-job-baseline.json').exists())
 def test_baseline_immutable_idempotent(self):
  w=self.baseline();m.record_baseline(self.op,self.lease,w);before=self.saved();m.record_baseline(self.op,self.lease,{**w,'capturedAt':time.time(),'frameHash':'b'*64});self.assertEqual(self.saved(),before)
  with self.assertRaises(ValueError):m.record_baseline(self.op,self.lease,{**w,'resultIds':[NEW]})
  self.assertEqual(self.saved(),before)
 def test_no_baseline_after_attempt(self):
  self.submit()
  with self.assertRaises(ValueError):m.record_baseline(self.op,self.lease,self.baseline())
 def test_no_pending_without_baseline_or_before_submit(self):
  with self.assertRaises(ValueError):m.bind_pending(self.op,self.lease,self.pending())
  self.submit()
  with self.assertRaises(ValueError):m.bind_pending(self.op,self.lease,self.pending())
 def test_historical_same_prompt_result_refused(self):
  self.start();before=self.saved()
  with self.assertRaises(ValueError):m.bind_pending(self.op,self.lease,{**self.pending(),'resultId':OLD})
  self.assertEqual(self.saved(),before)
 def test_pending_immutable_idempotent(self):
  self.start();w=self.pending();m.bind_pending(self.op,self.lease,w);before=self.saved();m.bind_pending(self.op,self.lease,{**w,'capturedAt':time.time(),'frameHash':'b'*64});self.assertEqual(self.saved(),before)
  with self.assertRaises(ValueError):m.bind_pending(self.op,self.lease,{**w,'resultId':'55555555-5555-4555-8555-555555555555'})
  self.assertEqual(self.saved(),before)
 def test_pending_exact_identity_types_time_refusals(self):
  self.start()
  for edit in ({'pending':False},{'pending':1},{'email':'other@example.com'},{'project':TASK},{'contextHash':'b'*64},{'operationId':TASK+':1'},{'promptHash':'b'*64},{'frameHash':'bad'},{'capturedAt':True},{'capturedAt':None},{'capturedAt':float('nan')},{'capturedAt':float('inf')},{'capturedAt':time.time()+100},{'capturedAt':self.op.read()['submittedAt']-1},{'resultId':NEW.upper()},{'extra':True}):
   with self.assertRaises(ValueError):m.bind_pending(self.op,self.lease,{**self.pending(),**edit})
 def test_stale_incoming_pending_refused(self):
  self.start();w=self.pending()
  with patch.object(m.time,'time',return_value=time.time()+200):
   with self.assertRaises(ValueError):m.bind_pending(self.op,self.lease,w)
 def test_durable_read_after_one_day_retains_bytes(self):
  self.start();m.bind_pending(self.op,self.lease,self.pending());before=self.saved()
  with patch.object(m.time,'time',return_value=time.time()+86400):self.assertIsNotNone(m.read_pending(self.op,self.lease))
  self.assertEqual(self.saved(),before)
 def test_context_stage_and_owner_cannot_change(self):
  self.start();original=self.op.instruction
  for edit in ({'id':1},{'id':False},{'engine':'antigravity'},{'kind':'image'}):
   altered=json.loads(original);altered['nextStage'].update(edit);self.op.instruction=json.dumps(altered)
   with self.assertRaises(ValueError):m.bind_pending(self.op,self.lease,self.pending())
  self.op.instruction=original;self.lock.with_name(self.lock.name+'.owner.json').unlink()
  with self.assertRaises(ValueError):m.bind_pending(self.op,self.lease,self.pending())
 def test_corrupt_pending_symlink_and_future_bound_refused(self):
  self.start();m.bind_pending(self.op,self.lease,self.pending());p=self.op.directory/'flow-job-pending.json';original=p.read_bytes();record=json.loads(original)
  for data in ({},{**record,'version':True},{**record,'boundAt':time.time()+100},{**record,'extra':True}):
   p.write_text(json.dumps(data))
   with self.assertRaises(ValueError):m.read_pending(self.op,self.lease)
  p.unlink();victim=self.root/'victim';victim.write_bytes(original);p.symlink_to(victim)
  with self.assertRaises(ValueError):m.read_pending(self.op,self.lease)
 def test_corrupt_baseline_blocks_pending_read(self):
  self.start();m.bind_pending(self.op,self.lease,self.pending());(self.op.directory/'flow-job-baseline.json').write_text('{}')
  with self.assertRaises(ValueError):m.read_pending(self.op,self.lease)
 def test_completed_and_wrong_actual_account_refused(self):
  self.start();rec=self.op.read()
  for edit in ({'state':'completed'},{'accountId':'other@example.com'}):
   self.op.write({**rec,**edit})
   with self.assertRaises(ValueError):m.bind_pending(self.op,self.lease,self.pending())
if __name__=='__main__':unittest.main(verbosity=2)