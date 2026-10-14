import importlib.util,pathlib,time,unittest
s=importlib.util.spec_from_file_location('fixture',pathlib.Path(__file__).with_name('flow206-qa.py'))
f=importlib.util.module_from_spec(s);s.loader.exec_module(f)
class Anchor(f.Cases):
 def setUp(self):
  super().setUp();self.snapshots=0;self.after_capture=None
  def capture(work):
   for lock in [self.cfg['browser_lock'],str(pathlib.Path(self.cfg['home_path'])/'.worker.lock')]:
    with self.assertRaises(RuntimeError):
     with f.m.BrowserLock(lock):pass
   self.snapshots+=1;file=pathlib.Path(work)/'own-auto-fixture.png';file.write_bytes(b'fixture snapshot; no real native pixels');file.chmod(0o600)
   if self.after_capture:self.after_capture()
   return file,time.time()
  self.deps['observation_module'].capture_anchor=capture
 def test_missing_anchor_automatically_captures_once_under_leases(self):
  self.cfg.pop('anchor_path');self.assertEqual(f.m.prepare_request(self.req(),self.cfg,**self.deps)['status'],'waiting');self.assertEqual(self.snapshots,1)
 def test_supplied_anchor_is_not_replaced(self):
  before=self.anchor.read_bytes();self.assertEqual(f.m.prepare_request(self.req(),self.cfg,**self.deps)['status'],'waiting');self.assertEqual(self.snapshots,0);self.assertEqual(before,self.anchor.read_bytes())
 def test_stale_supplied_anchor_is_refused_without_recapture(self):
  import os
  old=time.time()-181;os.utime(self.anchor,(old,old))
  with self.assertRaises(ValueError):f.m.prepare_request(self.req(),self.cfg,**self.deps)
  self.assertEqual(self.snapshots,0);self.assertEqual(self.calls,[])
 def test_prepared_recovery_does_not_capture(self):
  self.seed();self.cfg.pop('anchor_path');self.assertEqual(f.m.prepare_request(self.req(),self.cfg,**self.deps)['status'],'waiting');self.assertEqual(self.snapshots,0);self.assertEqual(self.calls,[])
 def test_attempted_recovery_does_not_capture(self):
  self.seed(changes={'state':'submission-attempted','submittedAt':time.time()-1});self.cfg.pop('anchor_path');self.assertEqual(f.m.prepare_request(self.req(),self.cfg,**self.deps)['status'],'pending');self.assertEqual(self.snapshots,0);self.assertEqual(self.calls,[])
 def test_cancelled_before_capture_never_captures(self):
  self.cfg.pop('anchor_path');self.cfg['cancel_callback']=lambda:True
  self.assertEqual(f.m.prepare_request(self.req(),self.cfg,**self.deps)['status'],'attention');self.assertEqual(self.snapshots,0);self.assertEqual(self.calls,[])
 def test_cancelled_after_capture_never_observes_or_inputs(self):
  self.cfg.pop('anchor_path')
  def cancel():self.cfg['cancel_callback']=lambda:True
  self.after_capture=cancel
  self.assertEqual(f.m.prepare_request(self.req(),self.cfg,**self.deps)['status'],'attention');self.assertEqual(self.snapshots,1);self.assertEqual(self.calls,[])
if __name__=='__main__':
 names=[n for n in Anchor.__dict__ if n.startswith('test_')]
 result=unittest.TextTestRunner(verbosity=2).run(unittest.TestSuite(Anchor(n) for n in names))
 raise SystemExit(not result.wasSuccessful())
