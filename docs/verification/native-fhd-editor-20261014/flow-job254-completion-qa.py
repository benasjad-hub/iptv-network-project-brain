import importlib.util,pathlib,time,json,unittest
from unittest.mock import patch
s=importlib.util.spec_from_file_location('fixture',pathlib.Path(__file__).with_name('flow-job244-qa.py'));f=importlib.util.module_from_spec(s);s.loader.exec_module(f);m=f.m
class Completion(f.Job):
 def complete_w(self):return {**self.common(),'resultId':f.NEW,'completed':True}
 def pending_start(self):self.start();m.bind_pending(self.op,self.lease,self.pending())
 def test_actual_chain_preserves_core_no_finish_authority(self):
  self.pending_start();m.bind_completed(self.op,self.lease,self.complete_w());self.assertIsNotNone(m.read_completed(self.op,self.lease));self.assertEqual(self.op.read()['state'],'submission-attempted');self.assertFalse((self.op.directory/'flow-result.json').exists());self.assertNotIn('result',self.op.read());self.assertEqual((self.op.directory/'flow-job-completed.json').stat().st_mode&0o777,0o600)
 def test_absent_completed_none_and_no_pending_refuses_binding(self):
  self.assertIsNone(m.read_completed(self.op,self.lease))
  with self.assertRaises(ValueError):m.bind_completed(self.op,self.lease,self.complete_w())
  self.start()
  with self.assertRaises(ValueError):m.bind_completed(self.op,self.lease,self.complete_w())
 def test_historical_different_identity_flags_and_types_refused(self):
  self.pending_start()
  for edit in ({'resultId':f.OLD},{'resultId':'55555555-5555-4555-8555-555555555555'},{'completed':False},{'completed':1},{'contextHash':'b'*64},{'promptHash':'b'*64},{'frameHash':'bad'},{'capturedAt':True},{'capturedAt':None},{'capturedAt':float('nan')},{'capturedAt':time.time()+10},{'email':'other@example.com'},{'extra':1},{'resultId':f.NEW.upper()}):
   with self.assertRaises(ValueError):m.bind_completed(self.op,self.lease,{**self.complete_w(),**edit})
  self.assertFalse((self.op.directory/'flow-job-completed.json').exists())
 def test_before_pending_bound_and_stale_refused(self):
  self.pending_start();p=m.read_pending(self.op,self.lease)
  with self.assertRaises(ValueError):m.bind_completed(self.op,self.lease,{**self.complete_w(),'capturedAt':p['boundAt']-1})
  w=self.complete_w()
  with patch.object(m.time,'time',return_value=time.time()+200):
   with self.assertRaises(ValueError):m.bind_completed(self.op,self.lease,w)
 def test_same_result_retry_retains_original_bytes(self):
  self.pending_start();w=self.complete_w();m.bind_completed(self.op,self.lease,w);before=self.saved();m.bind_completed(self.op,self.lease,{**w,'capturedAt':time.time(),'frameHash':'b'*64});self.assertEqual(before,self.saved())
 def test_elapsed_day_recovery_preserves_files(self):
  self.pending_start();m.bind_completed(self.op,self.lease,self.complete_w());before=self.saved()
  with patch.object(m.time,'time',return_value=time.time()+86400):self.assertIsNotNone(m.read_completed(self.op,self.lease))
  self.assertEqual(before,self.saved())
 def test_corrupt_complete_cannot_be_read(self):
  self.pending_start();m.bind_completed(self.op,self.lease,self.complete_w());p=self.op.directory/'flow-job-completed.json';r=json.loads(p.read_text())
  for bad in ({},{**r,'version':True},{**r,'boundAt':time.time()+100},{**r,'witness':{**r['witness'],'resultId':f.OLD}},{**r,'witness':{**r['witness'],'completed':False}},{**r,'extra':True}):
   p.write_text(json.dumps(bad))
   with self.assertRaises(ValueError):m.read_completed(self.op,self.lease)
 def test_changed_pending_identity_blocks_completed_read(self):
  self.pending_start();m.bind_completed(self.op,self.lease,self.complete_w());p=self.op.directory/'flow-job-pending.json';r=json.loads(p.read_text());r['witness']['resultId']='55555555-5555-4555-8555-555555555555';p.write_text(json.dumps(r))
  with self.assertRaises(ValueError):m.read_completed(self.op,self.lease)
 def test_lost_owner_blocks_existing_completed_read(self):
  self.pending_start();m.bind_completed(self.op,self.lease,self.complete_w());self.lock.with_name(self.lock.name+'.owner.json').unlink()
  with self.assertRaises(ValueError):m.read_completed(self.op,self.lease)
if __name__=='__main__':
 names=[n for n in Completion.__dict__ if n.startswith('test_')];result=unittest.TextTestRunner(verbosity=2).run(unittest.TestSuite(Completion(n) for n in names));raise SystemExit(not result.wasSuccessful())
