import importlib.util,pathlib,os,unittest,json
from unittest.mock import patch
base=pathlib.Path(os.environ['FLOW_VISION_CANDIDATE']);s=importlib.util.spec_from_file_location('original_runner',base/'antigravity-acceptance.py');m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
class Models(unittest.TestCase):
 def invoke(self,**kwargs):
  calls=[]
  class Process:
   returncode=0
   def __init__(self,args,**options):calls.append((args,options))
   def communicate(self,timeout):return json.dumps({'status':'SUCCESS','response':'{"seen":true}'}),'private stderr must not be retained'
  with patch.object(m.subprocess,'Popen',Process):result=m.run('/fixed/agy','/registered/home','/own/work','Read only frame',**kwargs)
  return calls,result
 def test_old_default_preserved(self):
  calls,result=self.invoke();args=calls[0][0];self.assertEqual(args[args.index('--model')+1],'gemini-3.1-pro-high');self.assertNotIn('stderr',result);self.assertIn('--sandbox',args);self.assertEqual(args[args.index('--mode')+1],'plan')
 def test_current_model_explicit_once(self):
  calls,result=self.invoke(model='gemini-3.8-flash-medium');args=calls[0][0];self.assertEqual(args.count('--model'),1);self.assertEqual(args[args.index('--model')+1],'gemini-3.8-flash-medium');self.assertEqual(result['status'],'SUCCESS')
 def test_unknown_or_nonstring_rejected_before_process(self):
  for v in ('other',True,['gemini-3.8-flash-medium'],'gemini-3.8-flash-medium --dangerously-skip-permissions'):
   with patch.object(m.subprocess,'Popen') as create:
    with self.assertRaises(ValueError):m.run('/fixed/agy','/registered/home','/own/work','Read only frame',model=v)
    create.assert_not_called()
if __name__=='__main__':unittest.main(verbosity=2)
