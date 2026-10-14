import importlib.util,pathlib,os,unittest,json,hashlib,time,types
s=importlib.util.spec_from_file_location('job',os.environ['FLOW_JOB_PART']);m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
TEXT='exact same selected prompt'
class Predicates(unittest.TestCase):
 def op(self,edit=None):
  data={'nextStage':{'id':0,'kind':'video','engine':'flow','instruction':TEXT},'publish':False,'site':'fixture','completed':[]}
  if edit:edit(data)
  raw=json.dumps(data);return types.SimpleNamespace(instruction=raw,digest=hashlib.sha256(raw.encode()).hexdigest(),stage_id=0)
 def test_actual_nested_contract_hash(self):self.assertEqual(m._prompt_hash(self.op()),hashlib.sha256(TEXT.encode()).hexdigest())
 def test_no_root_aliases_rescue_wrong_nextstage(self):
  def change(data):data.update(kind='video',engine='flow',instruction=TEXT);data['nextStage']['kind']='image'
  with self.assertRaises(ValueError):m._prompt_hash(self.op(change))
 def test_exact_id_publish_and_stage_refusals(self):
  for value in (True,1,None):
   with self.assertRaises(ValueError):m._prompt_hash(self.op(lambda d:d.update(publish=value)))
  for edit in ({'id':False},{'id':1},{'kind':'image'},{'engine':'antigravity'},{'instruction':''}):
   with self.assertRaises(ValueError):m._prompt_hash(self.op(lambda d:d['nextStage'].update(edit)))
 def test_full_instruction_digest_mismatch_refused(self):
  op=self.op();op.digest='b'*64
  with self.assertRaises(ValueError):m._prompt_hash(op)
 def test_fresh_exact_boundary_and_numeric_equivalence(self):
  self.assertTrue(m._fresh(1000,1000));self.assertTrue(m._fresh(1000,1180));self.assertTrue(m._fresh(1000.0,1001.0))
 def test_invalid_or_stale_timestamp_refusals(self):
  for value,now in ((True,1000),(None,1000),(0,1000),(-1,1000),(1001,1000),(1000,1181),(float('nan'),1000),(float('inf'),1000),(1000,True),(1000,float('inf'))):
   with self.assertRaises(ValueError):m._fresh(value,now)
if __name__=='__main__':unittest.main(verbosity=2)