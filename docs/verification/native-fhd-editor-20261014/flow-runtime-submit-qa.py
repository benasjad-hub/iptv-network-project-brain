import importlib.util,pathlib,unittest
s=importlib.util.spec_from_file_location('fixture',pathlib.Path(__file__).with_name('flow206-qa.py'))
f=importlib.util.module_from_spec(s);s.loader.exec_module(f)
class Submission(f.Cases):
 def setUp(self):
  super().setUp();self.sends=0;self.after=None
  def submit(op,obs,display,cancelled):
   self.assertFalse(cancelled());self.assertIsNotNone(op.lock)
   for lock in [self.cfg['browser_lock'],str(pathlib.Path(self.cfg['home_path'])/'.worker.lock')]:
    with self.assertRaises(RuntimeError):
     with f.m.BrowserLock(lock):pass
   def send(attempt,current):
    self.assertEqual(op.read()['state'],'submission-attempted');self.sends+=1
   op.submit_once(send)
   if self.after:self.after()
   return op.recover()
  self.deps['submit_module']=f.types.SimpleNamespace(submit=submit)
 def test_default_does_not_submit(self):
  self.assertEqual(f.m.prepare_request(self.req(),self.cfg,**self.deps)['status'],'waiting');self.assertEqual(self.sends,0)
 def test_enabled_fresh_persists_once_holds_both_leases_and_recovers(self):
  self.cfg['submit_after_prepare']=True
  out=f.m.prepare_request(self.req(),self.cfg,**self.deps);self.assertEqual(out['status'],'pending');self.assertTrue(out['submitted']);self.assertEqual(self.sends,1)
  before=list(self.calls);out=f.m.prepare_request(self.req(),self.cfg,**self.deps)
  self.assertEqual(out['status'],'pending');self.assertEqual(self.sends,1);self.assertEqual(self.calls,before)
 def test_existing_prepared_is_not_auto_submitted(self):
  self.seed();self.cfg['submit_after_prepare']=True
  self.assertEqual(f.m.prepare_request(self.req(),self.cfg,**self.deps)['status'],'waiting');self.assertEqual(self.sends,0);self.assertEqual(self.calls,[])
 def test_cancellation_after_attempt_reports_pending_not_unsubmitted(self):
  self.cfg['submit_after_prepare']=True
  def fail():raise f.m.CancelledError('fixture cancellation after durable attempt')
  self.after=fail;out=f.m.prepare_request(self.req(),self.cfg,**self.deps)
  self.assertEqual(out['status'],'pending');self.assertTrue(out['submitted']);self.assertEqual(self.sends,1)
 def test_timeout_after_attempt_never_replays(self):
  self.cfg['submit_after_prepare']=True
  def fail():raise TimeoutError('fixture uncertain click outcome')
  self.after=fail
  with self.assertRaises(TimeoutError):f.m.prepare_request(self.req(),self.cfg,**self.deps)
  before=list(self.calls);self.assertEqual(f.m.prepare_request(self.req(),self.cfg,**self.deps)['status'],'pending');self.assertEqual(self.calls,before);self.assertEqual(self.sends,1)
 def test_invalid_trusted_flag_refuses_before_input(self):
  self.cfg['submit_after_prepare']='1'
  with self.assertRaises(ValueError):f.m.prepare_request(self.req(),self.cfg,**self.deps)
  self.assertEqual(self.calls,[]);self.assertEqual(self.sends,0)
 def test_cancellation_after_prepare_never_submits(self):
  self.cfg['submit_after_prepare']=True;old=self.deps['controller_module'].prepare
  def cancel(*args):
   result=old(*args);self.cfg['cancel_callback']=lambda:True;return result
  self.deps['controller_module'].prepare=cancel
  out=f.m.prepare_request(self.req(),self.cfg,**self.deps);self.assertEqual(out['submitted'],False);self.assertEqual(self.sends,0)
 def test_controller_leaves_settings_open_must_close_before_submit(self):
  self.cfg['submit_after_prepare']=True;old=self.deps['controller_module'].prepare
  self.settings_open=False;raw_display=self.deps['display_module'].FlowDisplay
  outer=self
  class Display(raw_display):
   def click(self,role,*args):
    super().click(role,*args)
    if role=='video-settings':outer.settings_open=False
  self.deps['display_module'].FlowDisplay=Display
  def prepare(*args):
   result=old(*args);self.settings_open=True;return result
  self.deps['controller_module'].prepare=prepare
  raw_submit=self.deps['submit_module'].submit
  def submit(*args):
   self.assertFalse(self.settings_open,'Immutable controller ends with quote settings menu open; immutable submit requires unobscured composer')
   return raw_submit(*args)
  self.deps['submit_module'].submit=submit
  self.assertEqual(f.m.prepare_request(self.req(),self.cfg,**self.deps)['status'],'pending')
if __name__=='__main__':
 names=[n for n in Submission.__dict__ if n.startswith('test_')]
 result=unittest.TextTestRunner(verbosity=2).run(unittest.TestSuite(Submission(n) for n in names))
 raise SystemExit(not result.wasSuccessful())
