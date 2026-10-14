import importlib.util,pathlib,time,json,hashlib,unittest
s=importlib.util.spec_from_file_location('fixture',pathlib.Path(__file__).with_name('flow206-qa.py'))
f=importlib.util.module_from_spec(s);s.loader.exec_module(f)
class Profile(f.Cases):
 def setUp(self):
  super().setUp();outer=self;self.fields={'isFlow':True,'projectMatches':True,'profileOpen':False,'profileButtonAtPoint':True};self.bad_hash=False;self.cancel_after_vision=False
  class Observer:
   def __init__(self,*args):outer.calls.append('observer')
   def capture(self):outer.calls.append('capture');return outer.anchor,time.time()
   def observe(self,file,captured,question,fields,**kwargs):
    outer.calls.append('observe')
    if outer.cancel_after_vision:outer.cfg['cancel_callback']=lambda:True
    return {'frameHash':'wrong' if outer.bad_hash else hashlib.sha256(file.read_bytes()).hexdigest(),'capturedAt':captured,'observation':outer.fields}
  class Display:
   def __enter__(self):return self
   def __exit__(self,*args):pass
   def click(self,role,*args):outer.calls.append(role)
  self.deps['observation_module'].Observer=Observer;self.deps['display_module']=f.types.SimpleNamespace(FlowDisplay=Display)
 def test_closed_profile_opens_exactly_once_before_prepare(self):
  self.assertEqual(f.m.prepare_request(self.req(),self.cfg,**self.deps)['status'],'waiting');self.assertEqual(self.calls.count('profile'),1);self.assertLess(self.calls.index('profile'),self.calls.index('close-profile'))
 def test_already_open_profile_not_toggled_closed(self):
  self.fields['profileOpen']=True
  self.assertEqual(f.m.prepare_request(self.req(),self.cfg,**self.deps)['status'],'waiting');self.assertNotIn('profile',self.calls)
 def reject_without_input(self):
  with self.assertRaises(ValueError):f.m.prepare_request(self.req(),self.cfg,**self.deps)
  self.assertNotIn('profile',self.calls);self.assertNotIn('close-profile',self.calls)
 def test_wrong_project_stops_before_input(self):self.fields['projectMatches']=False;self.reject_without_input()
 def test_unknown_profile_state_stops_before_input(self):self.fields['profileOpen']=None;self.reject_without_input()
 def test_closed_profile_missing_button_stops_before_input(self):self.fields['profileButtonAtPoint']=False;self.reject_without_input()
 def test_wrong_frame_hash_stops_before_input(self):self.bad_hash=True;self.reject_without_input()
 def test_cancel_after_vision_stops_before_input(self):
  self.cancel_after_vision=True;out=f.m.prepare_request(self.req(),self.cfg,**self.deps);self.assertEqual(out['status'],'attention');self.assertNotIn('profile',self.calls);self.assertNotIn('close-profile',self.calls)
if __name__=='__main__':
 names=[n for n in Profile.__dict__ if n.startswith('test_')]
 result=unittest.TextTestRunner(verbosity=2).run(unittest.TestSuite(Profile(n) for n in names))
 raise SystemExit(not result.wasSuccessful())
