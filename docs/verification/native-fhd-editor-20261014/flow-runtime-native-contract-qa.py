import importlib.util,pathlib,time,json,hashlib,unittest
s=importlib.util.spec_from_file_location('fixture',pathlib.Path(__file__).with_name('flow206-qa.py'))
f=importlib.util.module_from_spec(s);s.loader.exec_module(f)
class Contract(f.Cases):
 def setUp(self):
  super().setUp();self.cfg['submit_after_prepare']=True;self.open_menu=False;self.generates=0;self.wrong=None;outer=self
  self.ledger=self.root/'ops'/f.TASK/'0'/'flow-receipt.json'
  original_prepare=self.deps['controller_module'].prepare
  def prepare(*args):
   result=original_prepare(*args);self.open_menu=True;return result
  self.deps['controller_module'].prepare=prepare
  class Observer:
   def __init__(self,*args):outer.calls.append('observer')
   def capture(self):outer.calls.append('capture');return outer.anchor,time.time()
   def observe(self,file,captured,question,fields,**kwargs):
    outer.calls.append('observe')
    return {'frameHash':hashlib.sha256(file.read_bytes()).hexdigest(),'capturedAt':captured,'observation':{k:(k!=outer.wrong and (not outer.open_menu if k=='unobscured' else True)) for k in fields}}
  class Display:
   def __enter__(self):return self
   def __exit__(self,*args):pass
   def click(self,role,*args):
    outer.calls.append(role)
    if role=='video-settings':outer.open_menu=False
   def generate_once(self,x,y,permit,attempt):
    outer.assertEqual(json.loads(outer.ledger.read_text())['state'],'submission-attempted');outer.generates+=1
  self.deps['observation_module']=f.types.SimpleNamespace(Observer=Observer,fresh_record=f.load('immutable_observations','flow-observation.py').fresh_record)
  self.deps['display_module']=f.types.SimpleNamespace(FlowDisplay=Display)
  self.deps['submit_module']=f.load('immutable_submit','flow-submit.py')
 def test_real_submit_gate_and_actual_ledger_one_generate_then_readonly_recovery(self):
  out=f.m.prepare_request(self.req(),self.cfg,**self.deps);self.assertEqual(out['status'],'pending');self.assertTrue(out['submitted']);self.assertEqual(self.generates,1)
  before=list(self.calls);self.assertEqual(f.m.prepare_request(self.req(),self.cfg,**self.deps)['status'],'pending');self.assertEqual(self.generates,1);self.assertEqual(before,self.calls)
 def test_real_submit_wrong_prompt_never_attempts(self):
  self.wrong='promptMatches'
  with self.assertRaises(ValueError):f.m.prepare_request(self.req(),self.cfg,**self.deps)
  self.assertEqual(self.generates,0);self.assertEqual(json.loads(self.ledger.read_text())['state'],'prepared')
 def test_real_submit_wrong_current_cost_never_attempts(self):
  self.wrong='costMatches'
  with self.assertRaises(ValueError):f.m.prepare_request(self.req(),self.cfg,**self.deps)
  self.assertEqual(self.generates,0);self.assertEqual(json.loads(self.ledger.read_text())['state'],'prepared')
if __name__=='__main__':
 names=[n for n in Contract.__dict__ if n.startswith('test_')]
 result=unittest.TextTestRunner(verbosity=2).run(unittest.TestSuite(Contract(n) for n in names))
 raise SystemExit(not result.wasSuccessful())
