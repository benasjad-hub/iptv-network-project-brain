import importlib.util,pathlib,subprocess,unittest
s=importlib.util.spec_from_file_location('fixture',pathlib.Path(__file__).with_name('flow206-qa.py'))
f=importlib.util.module_from_spec(s);s.loader.exec_module(f)
download=f.load('immutable_download','flow-download.py')
class Interop(f.Cases):
 def make_completed(self):
  directory=self.root/'downloads';directory.mkdir();q=self.req()
  with f.opmod.Operation(self.root/'ops',q) as op:
   op.prepare(f.PROJECT,'qa@example.com',{'model':'Omni 1.1 Flash','cost':12,'seconds':8,'height':720,'results':1,'balance':1050},f.time.time())
   op.submit_once(lambda *_:None) # fixture only; NO native Generate
   download.prepare_download(op,directory,'synthetic-export.mp4','qa@example.com','qa@example.com')
   subprocess.run(['/usr/bin/ffmpeg','-hide_banner','-v','error','-f','lavfi','-i','color=c=blue:s=1280x720:r=4:d=8','-c:v','libx264','-preset','ultrafast','-pix_fmt','yuv420p','-an',str(directory/'synthetic-export.mp4')],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,check=True,timeout=20)
   result=download.finish_download(op,directory,self.root/'media','qa@example.com','qa@example.com')
   self.assertNotIn('provider',result);self.assertNotIn('verified',result);self.assertEqual(result['data']['provider'],'google-flow');self.assertTrue(result['data']['verified'])
  return result
 def test_real_downloader_receipt_and_decode_recover_without_invented_envelope(self):
  expected=self.make_completed();actual=f.m.prepare_request(self.recovery_request(),self.cfg,**self.deps)
  self.assertEqual(actual,expected);self.assertEqual(self.calls,[])
 def test_bad_nested_provider_is_rejected(self):
  self.make_completed()
  with f.opmod.Operation(self.root/'ops',self.req()) as op:
   rec=op.read();rec['result']['data']['provider']='foreign';op.write(rec)
  with self.assertRaises(ValueError):f.m.prepare_request(self.recovery_request(),self.cfg,**self.deps)
  self.assertEqual(self.calls,[])
 def test_bad_nested_verified_is_rejected(self):
  self.make_completed()
  with f.opmod.Operation(self.root/'ops',self.req()) as op:
   rec=op.read();rec['result']['data']['verified']=False;op.write(rec)
  with self.assertRaises(ValueError):f.m.prepare_request(self.recovery_request(),self.cfg,**self.deps)
  self.assertEqual(self.calls,[])
if __name__=='__main__':
 names=[n for n in Interop.__dict__ if n.startswith('test_')]
 result=unittest.TextTestRunner(verbosity=2).run(unittest.TestSuite(Interop(n) for n in names))
 raise SystemExit(not result.wasSuccessful())
