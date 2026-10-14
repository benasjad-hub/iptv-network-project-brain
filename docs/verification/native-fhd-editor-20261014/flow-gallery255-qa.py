import importlib.util,pathlib,time,json,unittest,hashlib,os,uuid,struct,zlib
from unittest.mock import patch
s=importlib.util.spec_from_file_location('fixture',pathlib.Path(__file__).with_name('flow-job244-qa.py'));f=importlib.util.module_from_spec(s);s.loader.exec_module(f)
s=importlib.util.spec_from_file_location('gallery',f.base/'flow-gallery.py');g=importlib.util.module_from_spec(s);s.loader.exec_module(g)
SECOND='3c738340-6084-4b52-b384-01d7b246c6fb'
def png(seed):
 def chunk(t,b):return struct.pack('>I',len(b))+t+b+struct.pack('>I',zlib.crc32(t+b)&0xffffffff)
 raw=(b'\x00'+bytes([seed%255,0,0])*1280)*900
 return b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',1280,900,8,2,0,0,0))+chunk(b'IDAT',zlib.compress(raw))+chunk(b'IEND',b'')
class Reader:
 def __init__(self,qa,file):self.qa=qa;self.work=file.parent;self.anchor=file
 def observe(self,file,at,question,fields,timeout=100,extra_frames=()):
  if timeout!=100 or len(extra_frames)>2:raise AssertionError('Unexpected observer ABI')
  q=self.qa;values={}
  for k,typ in fields.items():
   if typ=='bool':values[k]=True
   elif typ=='number':values[k]=q.count
   elif typ=='uuid':values[k]=q.ids[min(q.uuid_reads,len(q.ids)-1)];q.uuid_reads+=1
   else:raise AssertionError('Unsupported observation schema')
  if 'primaryAtPoint' in values:values['primaryAtPoint']=q.count>=1
  if 'secondaryAtPoint' in values:values['secondaryAtPoint']=q.count==2
  if q.false_field in values:values[q.false_field]=False
  if q.tamper:file.write_bytes(png(100))
  if q.change_owner:
   p=q.lock.with_name(q.lock.name+'.owner.json');owner=json.loads(p.read_text());owner.update(q.change_owner);p.write_text(json.dumps(owner))
  if q.cancel_after_observe:q.cancel=True
  if q.advance:q.clock+=q.advance
  return {'frameHash':hashlib.sha256(file.read_bytes()).hexdigest(),'capturedAt':at,'observedAt':time.time(),'elapsedSeconds':0.01,'observation':values,'frameHashes':[hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest() for p in (file,*extra_frames)]}
class Display:
 REGIONS={'result-preview-back':(35,115,65,155)}
 def __init__(self,q):self.q=q
 def __enter__(self):return self
 def __exit__(self,*a):pass
 def click(self,role,x,y):
  allowed={'existing-result-preview':(330,280),'existing-result-secondary-preview':(480,280),'result-address-focus':(500,70),'result-preview-back':(50,134)}
  if allowed.get(role)!=(x,y):raise AssertionError('Unapproved input')
  self.q.actions.append(role)
 def expose_current_result_url(self):self.q.actions.append('expose')
 def restore_result_view(self):self.q.actions.append('restore')
class Gallery(f.Job):
 def setUp(self):
  super().setUp();self.frames=self.root/'frames';self.frames.mkdir(mode=0o700);self.count=2;self.ids=[f.OLD,SECOND];self.uuid_reads=0;self.actions=[];self.false_field=None;self.tamper=False;self.mode=0o600;self.bad_anchor=False;self.cancel=False;self.scene_count=0;self.change_owner=None;self.cancel_after_observe=False;self.advance=0;self.clock=None
 def scene(self):
  self.scene_count+=1;p=self.frames/('frame-'+str(uuid.uuid4())+'.png');p.write_bytes(png(self.scene_count));p.chmod(self.mode);r=Reader(self,p)
  if self.bad_anchor:r.anchor=self.frames/'wrong.png'
  return p,time.time(),r
 def collect(self):
  with patch.object(g.time,'sleep',lambda *_:None):return g.collect_baseline(self.op,self.lease,self.scene,lambda:Display(self),lambda:self.cancel)
 def test_two_ids_return_valid_baseline_no_generate_or_core_write(self):
  w=self.collect();self.assertEqual(w['resultIds'],self.ids);self.assertEqual(w['operationId'],self.op.operation);self.assertIsNone(self.op.read());self.assertFalse((self.op.directory/'flow-job-baseline.json').exists());self.assertEqual(self.actions.count('existing-result-preview'),1);self.assertEqual(self.actions.count('existing-result-secondary-preview'),1);self.assertEqual(self.actions.count('expose'),2);f.m.record_baseline(self.op,self.lease,w)
 def test_zero_gallery_has_no_input(self):
  self.count=0;w=self.collect();self.assertEqual(w['resultIds'],[]);self.assertEqual(self.actions,[])
 def test_one_result_never_clicks_secondary(self):
  self.count=1;w=self.collect();self.assertEqual(w['resultIds'],[f.OLD]);self.assertNotIn('existing-result-secondary-preview',self.actions)
 def test_more_than_two_refuses_before_input(self):
  self.count=3
  with self.assertRaises(ValueError):self.collect()
  self.assertEqual(self.actions,[])
 def test_pending_incomplete_or_wrong_root_refuse_before_input(self):
  for key in ('rootMatches','galleryComplete','noFilter','noPending'):
   self.false_field=key
   with self.assertRaises(ValueError):self.collect()
   self.assertEqual(self.actions,[])
 def test_changed_gallery_refuses_after_bounded_inputs(self):
  self.false_field='galleryUnchanged'
  with self.assertRaises(ValueError):self.collect()
  self.assertLessEqual(self.actions.count('existing-result-preview'),1)
 def test_null_uuid_not_guessed_or_retried(self):
  self.ids=[None]
  with self.assertRaises(ValueError):self.collect()
  self.assertEqual(self.actions.count('existing-result-preview'),1);self.assertNotIn('existing-result-secondary-preview',self.actions)
 def test_duplicate_uuid_refused(self):
  self.ids=[f.OLD,f.OLD]
  with self.assertRaises(ValueError):self.collect()
 def test_cancel_refuses_all_input(self):
  self.cancel=True
  with self.assertRaises((ValueError,RuntimeError)):self.collect()
  self.assertEqual(self.actions,[])
 def test_attempted_core_never_recollects_baseline(self):
  self.submit()
  with self.assertRaises(ValueError):self.collect()
  self.assertEqual(self.actions,[])
 def test_existing_generation_marker_blocks(self):
  (self.op.directory/'generation-attempt.json').write_text('{}')
  with self.assertRaises(ValueError):self.collect()
  self.assertEqual(self.actions,[])
 def test_modified_context_blocks_before_input(self):
  self.op.instruction+=' '
  with self.assertRaises(ValueError):self.collect()
  self.assertEqual(self.actions,[])
 def test_frame_changed_during_observe_refuses(self):
  self.tamper=True
  with self.assertRaises(ValueError):self.collect()
  self.assertEqual(self.actions,[])
 def test_wrong_anchor_refused(self):
  self.bad_anchor=True
  with self.assertRaises(ValueError):self.collect()
  self.assertEqual(self.actions,[])
 def test_nonprivate_frame_refused(self):
  self.mode=0o644
  with self.assertRaises(ValueError):self.collect()
  self.assertEqual(self.actions,[])
 def test_owner_email_changed_during_observation_refused(self):
  self.count=0;self.change_owner={'email':'other@example.com'}
  with self.assertRaises(ValueError):self.collect()
  self.assertEqual(self.actions,[])
 def test_owner_reservation_changed_during_observation_refused(self):
  self.count=0;p=self.lock.with_name(self.lock.name+'.owner.json');j=json.loads(p.read_text());self.change_owner={'reservedAt':j['reservedAt']-1}
  with self.assertRaises(ValueError):self.collect()
 def test_cancel_during_last_observation_refuses_return(self):
  self.count=0;self.cancel_after_observe=True
  with self.assertRaises(ValueError):self.collect()
  self.assertEqual(self.actions,[])
 def test_whole_history_age_includes_last_observation_time(self):
  self.clock=time.time()+1;self.advance=21
  with patch.object(g.time,'time',lambda:self.clock):
   with self.assertRaises(ValueError):self.collect()
if __name__=='__main__':
 names=[n for n in Gallery.__dict__ if n.startswith('test_')];result=unittest.TextTestRunner(verbosity=2).run(unittest.TestSuite(Gallery(n) for n in names));raise SystemExit(not result.wasSuccessful())
