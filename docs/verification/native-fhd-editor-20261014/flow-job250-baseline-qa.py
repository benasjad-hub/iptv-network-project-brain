import importlib.util,pathlib,unittest,time,json
from unittest.mock import patch
s=importlib.util.spec_from_file_location('fixture',pathlib.Path(__file__).with_name('flow-job244-qa.py'));f=importlib.util.module_from_spec(s);s.loader.exec_module(f);m=f.m
class Baseline(f.Job):
 def test_valid_absent_core_baseline_no_submission(self):
  m.record_baseline(self.op,self.lease,self.baseline());self.assertIsNone(self.op.read());self.assertFalse((self.op.directory/'flow-result.json').exists());self.assertIsNotNone(m._read(self.op,self.lease,'flow-job-baseline.json'))
 def test_valid_prepared_baseline(self):
  self.op.prepare(f.PROJECT,f.EMAIL,{'model':'Omni 1.1 Flash','cost':12,'balance':1050,'seconds':8,'height':720,'results':1},time.time());m.record_baseline(self.op,self.lease,self.baseline());self.assertEqual(self.op.read()['state'],'prepared')
 def test_incomplete_pending_and_bad_ids_refused(self):self.test_incomplete_pending_bad_ids_refuse_baseline()
 def test_immutable_baseline_no_rewrite(self):self.test_baseline_immutable_idempotent()
 def test_actual_attempt_marker_blocks_new_baseline(self):
  (self.op.directory/'generation-attempt.json').write_text('{}')
  with self.assertRaises(ValueError):m.record_baseline(self.op,self.lease,self.baseline())
 def test_any_submitted_field_even_none_blocks_baseline(self):
  self.op.prepare(f.PROJECT,f.EMAIL,{'model':'Omni 1.1 Flash','cost':12,'balance':1050,'seconds':8,'height':720,'results':1},time.time());self.op.write({**self.op.read(),'submittedAt':None})
  with self.assertRaises(ValueError):m.record_baseline(self.op,self.lease,self.baseline())
 def test_stored_baseline_survives_elapsed_day(self):
  m.record_baseline(self.op,self.lease,self.baseline());record=m._read(self.op,self.lease,'flow-job-baseline.json');before=self.saved()
  with patch.object(m.time,'time',return_value=time.time()+86400):m._baseline_record(self.op,self.lease,record)
  self.assertEqual(before,self.saved())
if __name__=='__main__':
 names=[n for n in Baseline.__dict__ if n.startswith('test_')];result=unittest.TextTestRunner(verbosity=2).run(unittest.TestSuite(Baseline(n) for n in names));raise SystemExit(not result.wasSuccessful())