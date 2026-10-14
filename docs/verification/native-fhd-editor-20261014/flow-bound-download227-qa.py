import importlib.util,pathlib,os,subprocess,time,unittest
spec=importlib.util.spec_from_file_location('exports_fixture',pathlib.Path(__file__).with_name('flow-export224-qa.py'))
f=importlib.util.module_from_spec(spec);spec.loader.exec_module(f)
download=f.load('download_candidate','flow-download.py')
class Bound(f.Export):
 def setUp(self):
  super().setUp();self.media=self.root/'media';self.media.mkdir();self.name='Écran_20261014.mp4'
 def make_clip(self,seconds=8,width=1280,height=720):
  subprocess.run(['/usr/bin/ffmpeg','-hide_banner','-loglevel','error','-f','lavfi','-i',f'color=blue:size={width}x{height}:rate=1','-t',str(seconds),'-c:v','libx264','-preset','ultrafast','-crf','35','-pix_fmt','yuv420p',str(self.downloads/self.name)],check=True,timeout=25)
 def named_clip(self,seconds=8,width=1280,height=720):
  self.prepare();self.attempt(lambda:self.make_clip(seconds,width,height));f.m.bind_export_name(self.op,self.lease,self.name,self.native(self.name))
 def test_recorded_attempt_time_and_uuid_are_preserved(self):
  self.named_clip();intent=self.op.read()['export'];sub=f.m.prepare_bound_download(self.op,self.lease);self.assertEqual(sub['at'],intent['attemptedAt']);self.assertEqual(sub['expectedName'],self.name);before=self.op.file.read_bytes();again=f.m.prepare_bound_download(self.op,self.lease);self.assertEqual(again,sub);self.assertEqual(before,self.op.file.read_bytes())
 def test_real_unicode_ingest_decode_receipt_and_verified_release(self):
  self.named_clip();sub=f.m.prepare_bound_download(self.op,self.lease);out=download.finish_download(self.op,str(self.downloads),str(self.media),f.EMAIL,f.EMAIL);self.assertEqual(out['status'],'success');data=out['data'];self.assertEqual((data['width'],data['height'],data['seconds']),(1280,720,8.0));self.assertEqual((self.media/sub['assetName']).read_bytes(),(self.downloads/self.name).read_bytes());self.assertTrue(f.session.release_completed(self.op,self.lease,str(self.media)));self.assertEqual(download.finish_download(self.op,str(self.downloads),str(self.media),f.EMAIL,f.EMAIL),out)
 def reject_clip(self,seconds=8,width=1280,height=720):
  self.named_clip(seconds,width,height);f.m.prepare_bound_download(self.op,self.lease)
  with self.assertRaises(ValueError):download.finish_download(self.op,str(self.downloads),str(self.media),f.EMAIL,f.EMAIL)
  self.assertEqual(self.op.read()['state'],'submission-attempted');self.assertNotIn('result',self.op.read())
 def test_wrong_duration_never_completed(self):self.reject_clip(seconds=10)
 def test_portrait_dimensions_never_completed(self):self.reject_clip(width=720,height=1280)
 def test_old_file_refused(self):
  self.named_clip();f.m.prepare_bound_download(self.op,self.lease);old=self.op.read()['submittedAt']-1;os.utime(self.downloads/self.name,(old,old))
  with self.assertRaises(ValueError):download.finish_download(self.op,str(self.downloads),str(self.media),f.EMAIL,f.EMAIL)
  self.assertEqual(self.op.read()['state'],'submission-attempted')
 def test_changed_existing_download_identity_refused(self):
  self.named_clip();f.m.prepare_bound_download(self.op,self.lease);rec=self.op.read();rec['download']['expectedName']='other.mp4';self.op.write(rec);before=self.op.file.read_bytes()
  with self.assertRaises(ValueError):f.m.prepare_bound_download(self.op,self.lease)
  self.assertEqual(before,self.op.file.read_bytes())
 def test_duration_alias_cannot_replace_canonical_seconds(self):
  with self.assertRaises(ValueError):download._validate_media_metadata(self.op.read(),{'width':1280,'height':720,'seconds':None,'duration':8})
 def test_corrupt_download_subrecord_refuses_without_writing(self):
  self.prepare();self.attempt();f.m.bind_export_name(self.op,self.lease,self.name,self.native(self.name));rec=self.op.read();rec['download']=123;self.op.write(rec);before=self.op.file.read_bytes()
  with self.assertRaises(ValueError):f.m.prepare_bound_download(self.op,self.lease)
  self.assertEqual(before,self.op.file.read_bytes())
if __name__=='__main__':
 names=[n for n in Bound.__dict__ if n.startswith('test_')];result=unittest.TextTestRunner(verbosity=2).run(unittest.TestSuite(Bound(n) for n in names));raise SystemExit(not result.wasSuccessful())
