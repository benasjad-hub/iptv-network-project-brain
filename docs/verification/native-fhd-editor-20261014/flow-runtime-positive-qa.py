import importlib.util,pathlib,os,time,unittest
s=importlib.util.spec_from_file_location('fixture',pathlib.Path(__file__).with_name('flow206-qa.py'))
f=importlib.util.module_from_spec(s);s.loader.exec_module(f)
class Positive(f.Cases):
 def test_valid_prepared_reopens_without_browser_or_reset(self):
  self.seed();ledger=self.root/'ops'/f.TASK/'0'/'flow-receipt.json';before=ledger.read_bytes()
  out=f.m.prepare_request(self.req(),self.cfg,**self.deps)
  self.assertEqual(out['code'],'prepared');self.assertEqual(self.calls,[]);self.assertEqual(before,ledger.read_bytes())
 def test_stale_valid_prepared_requires_attention_without_reset(self):
  self.seed(changes={'capturedAt':time.time()-181});ledger=self.root/'ops'/f.TASK/'0'/'flow-receipt.json';before=ledger.read_bytes()
  out=f.m.prepare_request(self.req(),self.cfg,**self.deps)
  self.assertEqual(out['attention'],'stale-quote');self.assertEqual(self.calls,[]);self.assertEqual(before,ledger.read_bytes())
 def test_completed_valid_metadata_recovers_no_browser(self):
  r=self.result(self.meta());r.update(provider='google-flow',verified=True)
  self.seed('completed',result=r);self.mock_verified()
  self.assertEqual(f.m.prepare_request(self.recovery_request(),self.cfg,**self.deps)['status'],'success');self.assertEqual(self.calls,[])
 def test_core_compatible_integer_duration_recovers(self):
  r=self.result(self.meta());r.update(provider='google-flow',verified=True)
  self.seed('completed',result=r);self.mock_verified()
  self.deps['operation_module'].verify_video=lambda *args:{**self.meta(),'seconds':8.0}
  self.assertEqual(f.m.prepare_request(self.recovery_request(),self.cfg,**self.deps)['status'],'success');self.assertEqual(self.calls,[])
 def test_busy_global_lock_refuses_before_browser(self):
  with f.m.BrowserLock(self.cfg['browser_lock']):
   with self.assertRaises(RuntimeError):f.m.prepare_request(self.req(),self.cfg,**self.deps)
  self.assertEqual(self.calls,[])
 def test_boolean_duration_never_recovers(self):
  self.invalid_duration(True)
 def test_nan_duration_never_recovers(self):
  self.invalid_duration(float('nan'))
 def test_infinite_duration_never_recovers(self):
  self.invalid_duration(float('inf'))
 def invalid_duration(self,value):
  r=self.result({**self.meta(),'seconds':value});r.update(provider='google-flow',verified=True)
  self.seed('completed',result=r);self.mock_verified()
  with self.assertRaises(ValueError):f.m.prepare_request(self.recovery_request(),self.cfg,**self.deps)
  self.assertEqual(self.calls,[])
if __name__=='__main__':
 names=[n for n in Positive.__dict__ if n.startswith('test_')]
 result=unittest.TextTestRunner(verbosity=2).run(unittest.TestSuite(Positive(n) for n in names))
 raise SystemExit(not result.wasSuccessful())
