import importlib.util,pathlib,tempfile,os,struct,zlib,binascii,unittest
s=importlib.util.spec_from_file_location('observation',pathlib.Path(os.environ['FLOW_RUNTIME_CANDIDATE'])/'flow-observation.py')
m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
def png(width=1280,height=900):
 def chunk(kind,body):return struct.pack('>I',len(body))+kind+body+struct.pack('>I',binascii.crc32(kind+body)&0xffffffff)
 raw=(b'\0'+bytes(width*3))*height
 return b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',width,height,8,2,0,0,0))+chunk(b'IDAT',zlib.compress(raw))+chunk(b'IEND',b'')
class Capture(unittest.TestCase):
 def setUp(self):
  self.temp=tempfile.TemporaryDirectory(prefix='studio-capture-qa-');self.root=pathlib.Path(self.temp.name);self.work=self.root/'work';self.work.mkdir();self.calls=[];self.body=png();self.strict_umask=False;self.after=None;self.original=m.subprocess.run
  def fake(args,**kwargs):
   self.calls.append((args,kwargs));self.assertEqual(args[0],'/usr/bin/ffmpeg');self.assertIn('-n',args);self.assertIn('x11grab',args);self.assertIn(':98',args);self.assertEqual(kwargs.get('timeout'),10);self.assertTrue(kwargs.get('check'));self.assertNotIn('shell',kwargs)
   self.assertEqual(kwargs['env']['XAUTHORITY'],'/home/iptv/daoudstudio/state/flow-desktop/Xauthority')
   if self.strict_umask:self.assertEqual(kwargs.get('umask'),0o077);self.assertNotIn('preexec_fn',kwargs)
   file=pathlib.Path(args[-1]);self.assertEqual(file.parent,self.work);file.write_bytes(self.body)
   if self.after:self.after(file)
  m.subprocess.run=fake
 def tearDown(self):m.subprocess.run=self.original;self.temp.cleanup()
 def test_valid_actual_png_bytes_accepted_with_private_mode(self):
  file,captured=m.capture_anchor(self.work);self.assertEqual(file.read_bytes(),self.body);self.assertEqual(file.stat().st_mode&0o777,0o600);self.assertGreater(captured,0)
 def test_subprocess_umask_is_explicit_and_no_preexec(self):
  self.strict_umask=True;m.capture_anchor(self.work)
 def test_relative_directory_refused_before_capture(self):
  with self.assertRaises(ValueError):m.capture_anchor('work')
  self.assertEqual(self.calls,[])
 def test_symlink_directory_refused_before_capture(self):
  link=self.root/'alias';link.symlink_to(self.work,target_is_directory=True)
  with self.assertRaises(ValueError):m.capture_anchor(link)
  self.assertEqual(self.calls,[])
 def test_wrong_dimensions_refused(self):
  self.body=png(640,480)
  with self.assertRaisesRegex(ValueError,'dimensions'):m.capture_anchor(self.work)
 def test_invalid_png_refused(self):
  self.body=bytes(128)
  with self.assertRaises(ValueError):m.capture_anchor(self.work)
 def test_replaced_symlink_cannot_change_victim_mode(self):
  victim=self.root/'unrelated-fixture.png';victim.write_bytes(b'fixture');victim.chmod(0o644)
  def replace(file):file.unlink();file.symlink_to(victim)
  self.after=replace
  with self.assertRaises((ValueError,OSError)):m.capture_anchor(self.work)
  self.assertEqual(victim.stat().st_mode&0o777,0o644)
if __name__=='__main__':unittest.main()
