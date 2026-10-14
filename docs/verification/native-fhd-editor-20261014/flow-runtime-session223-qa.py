import importlib.util,pathlib,json,unittest
spec=importlib.util.spec_from_file_location('fixture',pathlib.Path(__file__).with_name('flow206-qa.py'))
f=importlib.util.module_from_spec(spec);spec.loader.exec_module(f)
session=f.load('real_session','flow-session.py')
OTHER='33333333-3333-4333-8333-333333333333'
class Wiring(f.Cases):
 def journal(self):return self.root/'browser.lock.owner.json'
 def reserve_other(self):
  q=self.req();q['taskId']=OTHER;q['operationId']=OTHER+':0'
  with f.opmod.Operation(self.root/'ops',q) as op,f.m.BrowserLock(self.cfg['browser_lock']) as lease:session.reserve(op,lease,f.PROJECT,'qa@example.com')
 def test_fresh_reserves_before_capture_and_keeps_prepared(self):
  original=self.deps['observation_module'].Observer;outer=self
  class Obs(original):
   def __init__(self,*args):outer.assertTrue(outer.journal().is_file());super().__init__(*args)
  self.deps['observation_module'].Observer=Obs
  out=f.m.prepare_request(self.req(),self.cfg,**self.deps)
  self.assertEqual(out['state'],'prepared');self.assertEqual(json.loads(self.journal().read_text())['state'],'active')
 def test_other_owner_waits_without_capture_or_overwrite(self):
  self.reserve_other();before=self.journal().read_bytes();out=f.m.prepare_request(self.req(),self.cfg,**self.deps)
  self.assertEqual(out['status'],'waiting');self.assertFalse(out['submitted']);self.assertFalse(out['generationExecuted']);self.assertEqual(out['operationId'],self.req()['operationId']);self.assertEqual(out['contextHash'],self.req()['contextHash']);self.assertEqual(self.calls,[]);self.assertEqual(before,self.journal().read_bytes())
 def test_corrupt_owner_blocks_before_capture(self):
  self.journal().write_text('{bad')
  with self.assertRaises(ValueError):f.m.prepare_request(self.req(),self.cfg,**self.deps)
  self.assertEqual(self.calls,[]);self.assertEqual(self.journal().read_text(),'{bad')
 def test_existing_prepared_is_readonly_without_reservation(self):
  self.seed();out=f.m.prepare_request(self.req(),self.cfg,**self.deps)
  self.assertEqual(out['state'],'prepared');self.assertEqual(self.calls,[]);self.assertFalse(self.journal().exists())
if __name__=='__main__':
 names=[n for n in Wiring.__dict__ if n.startswith('test_')]
 result=unittest.TextTestRunner(verbosity=2).run(unittest.TestSuite(Wiring(n) for n in names));raise SystemExit(not result.wasSuccessful())
