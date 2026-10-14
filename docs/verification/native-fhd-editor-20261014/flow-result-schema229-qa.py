import importlib.util,os,pathlib,json,unittest
base=pathlib.Path(os.environ['FLOW_SCHEMA_CANDIDATE']);s=importlib.util.spec_from_file_location('typed_parser',base/'flow-prepare.py');m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
class Schema(unittest.TestCase):
 def parse(self,v,fields):return m.parse_json({'status':'SUCCESS','structured_output':v},fields)
 def test_old_contracts_unchanged(self):self.assertEqual(self.parse({'yes':True,'n':1008,'model':'Omni 1.1 Flash'},{'yes':'bool','n':'number','model':'model'})['n'],1008)
 def test_nullable_unseen_values(self):self.assertEqual(self.parse({'id':None,'name':None},{'id':'uuid','name':'filename'}),{'id':None,'name':None})
 def test_exact_lower_uuid_and_unicode_filename(self):self.assertEqual(self.parse({'id':'44444444-4444-4444-8444-444444444444','name':'Écran_20261014.mp4'},{'id':'uuid','name':'filename'})['name'],'Écran_20261014.mp4')
 def test_uuid_hidden_uppercase_url_and_types_refused(self):
  for v in ('44444444-4444-4444-8444-44444444…','AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA','https://flow.google.com/project/44444444-4444-4444-8444-444444444444',True,123,[]):
   with self.assertRaises(ValueError):self.parse({'id':v},{'id':'uuid'})
 def test_unsafe_names_refused(self):
  for v in ('../a.mp4','a\\b.mp4','a:b.mp4','.hidden.mp4','a\n.mp4','a.mp4 ',' a.mp4','a .mp4',True,123,[],('é'*121)+'.mp4'):
   with self.assertRaises(ValueError):self.parse({'name':v},{'name':'filename'})
 def test_unknown_kind_is_not_generic_string_backdoor(self):
  with self.assertRaises(ValueError):self.parse({'unsafe':'anything'},{'unsafe':'string'})
 def test_missing_extra_keys_and_error_receipt_refused(self):
  for v in ({},{'id':None,'extra':'ignored'}):
   with self.assertRaises(ValueError):self.parse(v,{'id':'uuid'})
  with self.assertRaises(ValueError):m.parse_json({'status':'ERROR','structured_output':{'id':None}},{'id':'uuid'})
 def test_bool_is_not_number(self):
  with self.assertRaises(ValueError):self.parse({'n':True},{'n':'number'})
 def test_json_response_transport_uses_same_guards(self):
  self.assertEqual(m.parse_json({'status':'SUCCESS','response':json.dumps({'name':'vidéo.mp4'})},{'name':'filename'}),{'name':'vidéo.mp4'})
if __name__=='__main__':unittest.main(verbosity=2)
