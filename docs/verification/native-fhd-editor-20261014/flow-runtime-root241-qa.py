import importlib.util,pathlib,time,unittest,types,hashlib,json
s=importlib.util.spec_from_file_location('fixture',pathlib.Path(__file__).with_name('flow206-qa.py'));f=importlib.util.module_from_spec(s);s.loader.exec_module(f)
class Root(f.Cases):
 def setUp(self):
  super().setUp();self.after_nav=None;self.after_anchor=None;self.anchor_count=0;self.bad_address=None;outer=self;old_display=self.deps['display_module'].FlowDisplay;old_obs=self.deps['observation_module'].Observer
  class Display(old_display):
   def open_project(self,project,confirm_address):
    outer.assertEqual(project,f.PROJECT);outer.assertTrue((outer.root/'browser.lock.owner.json').is_file())
    for lock in (outer.cfg['browser_lock'],str(pathlib.Path(outer.cfg['home_path'])/'.worker.lock')):
     with outer.assertRaises(RuntimeError):
      with f.m.BrowserLock(lock):pass
    outer.calls.append('navigate')
    if outer.after_nav:outer.after_nav()
    if confirm_address('https://flow.google.com/project/'+project) is not True:raise ValueError('Unconfirmed URL')
    outer.calls.append('enter')
  class Obs(old_obs):
   def __init__(self,work,cli,home,anchor):outer.assertIn(pathlib.Path(anchor).name,('fresh-address.png','fresh-root.png'));super().__init__(work,cli,home,anchor)
   def capture(self):outer.calls.append('capture');return outer.root/'work'/('fresh-root.png' if (outer.root/'work'/'fresh-root.png').exists() else 'fresh-address.png'),time.time()
   def observe(self,file,captured,question,fields,**kwargs):
    out=super().observe(file,captured,question,fields,**kwargs)
    if outer.bad_address in fields:out['observation'][outer.bad_address]=False
    return out
  def anchor(work):
   outer.assertIn('navigate',outer.calls);outer.calls.append('anchor');outer.anchor_count+=1;p=pathlib.Path(work)/('fresh-address.png' if outer.anchor_count==1 else 'fresh-root.png');p.write_bytes(b'fixture root screenshot');p.chmod(0o600)
   if outer.after_anchor:outer.after_anchor()
   return p,time.time()
  self.deps['display_module'].FlowDisplay=Display;self.deps['observation_module'].Observer=Obs;self.deps['observation_module'].capture_anchor=anchor
 def test_fresh_supplied_anchor_replaced_after_navigation(self):
  old=self.anchor.read_bytes();out=f.m.prepare_request(self.req(),self.cfg,**self.deps);self.assertEqual(out['state'],'prepared');self.assertEqual(old,self.anchor.read_bytes());self.assertEqual(self.calls.count('navigate'),1);self.assertEqual(self.calls.count('anchor'),2);self.assertLess(self.calls.index('navigate'),self.calls.index('anchor'));self.assertLess(self.calls.index('anchor'),self.calls.index('observer'))
 def test_fresh_no_anchor_navigation_then_capture(self):self.cfg.pop('anchor_path');self.test_fresh_supplied_anchor_replaced_after_navigation()
 def test_prepared_no_navigation_or_recapture(self):self.seed();out=f.m.prepare_request(self.req(),self.cfg,**self.deps);self.assertEqual(out['state'],'prepared');self.assertEqual(self.calls,[])
 def test_attempted_no_navigation_or_recapture(self):self.seed(changes={'state':'submission-attempted','submittedAt':time.time()-1});self.assertEqual(f.m.prepare_request(self.req(),self.cfg,**self.deps)['status'],'pending');self.assertEqual(self.calls,[])
 def test_recover_only_absent_no_navigation(self):
  with self.assertRaises(ValueError):f.m.prepare_request(self.recovery_request(),self.cfg,**self.deps)
  self.assertEqual(self.calls,[])
 def test_completed_no_navigation_or_recapture(self):
  self.seed('completed',result=self.result(self.meta()));self.mock_verified();out=f.m.prepare_request(self.recovery_request(),self.cfg,**self.deps);self.assertEqual(out['status'],'success');self.assertEqual(self.calls,[])
 def test_cancel_before_navigation(self):self.cfg['cancel_callback']=lambda:True;self.assertEqual(f.m.prepare_request(self.req(),self.cfg,**self.deps)['status'],'attention');self.assertEqual(self.calls,[])
 def test_cancel_after_navigation_no_capture(self):
  self.after_nav=lambda:self.cfg.update(cancel_callback=lambda:True);self.assertEqual(f.m.prepare_request(self.req(),self.cfg,**self.deps)['status'],'attention');self.assertIn('navigate',self.calls);self.assertNotIn('anchor',self.calls);self.assertNotIn('observer',self.calls)
 def test_cancel_after_anchor_no_observe(self):
  self.after_anchor=lambda:self.cfg.update(cancel_callback=lambda:True);self.assertEqual(f.m.prepare_request(self.req(),self.cfg,**self.deps)['status'],'attention');self.assertIn('anchor',self.calls);self.assertNotIn('observe',self.calls)
 def test_missing_named_display_no_fallback(self):
  self.deps['display_module']=types.SimpleNamespace(Display=self.deps['display_module'].FlowDisplay)
  with self.assertRaises(ValueError):f.m.prepare_request(self.req(),self.cfg,**self.deps)
  self.assertNotIn('navigate',self.calls)
 def test_missing_open_project_refused(self):
  self.deps['display_module'].FlowDisplay.open_project=None
  with self.assertRaises((ValueError,TypeError)):f.m.prepare_request(self.req(),self.cfg,**self.deps)
  self.assertNotIn('anchor',self.calls)
 def test_unfocused_address_never_enters(self):
  self.bad_address='addressFocused'
  with self.assertRaises(ValueError):f.m.prepare_request(self.req(),self.cfg,**self.deps)
  self.assertNotIn('enter',self.calls)
 def test_wrong_typed_address_never_enters(self):
  self.bad_address='projectAddressMatches'
  with self.assertRaises(ValueError):f.m.prepare_request(self.req(),self.cfg,**self.deps)
  self.assertNotIn('enter',self.calls)
if __name__=='__main__':
 names=[n for n in Root.__dict__ if n.startswith('test_')];result=unittest.TextTestRunner(verbosity=2).run(unittest.TestSuite(Root(n) for n in names));raise SystemExit(not result.wasSuccessful())