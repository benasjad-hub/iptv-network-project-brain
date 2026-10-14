import importlib.util,pathlib,os,json,unittest,stat,types
from unittest.mock import patch
s=importlib.util.spec_from_file_location('fixture',pathlib.Path(__file__).with_name('flow-job244-qa.py'));f=importlib.util.module_from_spec(s);s.loader.exec_module(f);m=f.m
class IO(f.Job):
 def name(self):return 'flow-job-baseline.json'
 def path(self):return self.op.directory/self.name()
 def record(self):return {'version':1,'fixture':True,'value':'same owner private file'}
 def test_context_live_owned_before_any_core_submission(self):
  session,journal,record=m._context(self.op,self.lease);self.assertEqual(journal['operationId'],self.op.operation);self.assertEqual(journal['contextHash'],self.op.digest);self.assertIsNone(record)
 def test_regular_atomic_private_readback_and_nonoverwriting(self):
  self.assertIsNone(m._read(self.op,self.lease,self.name()));m._write_new(self.op,self.lease,self.name(),self.record());self.assertEqual(m._read(self.op,self.lease,self.name()),self.record());self.assertEqual(self.path().stat().st_mode&0o777,0o600);before=self.path().read_bytes()
  with self.assertRaises((ValueError,FileExistsError)):m._write_new(self.op,self.lease,self.name(),{'other':True})
  self.assertEqual(before,self.path().read_bytes());self.assertEqual(sorted(p.name for p in self.op.directory.iterdir()),['.flow.lock',self.name()])
 def test_only_two_canonical_job_names(self):
  for name in ('flow-receipt.json','flow-result.json','.flow.lock','../flow-job-baseline.json','other.json',None,[]):
   with self.assertRaises((ValueError,TypeError)):m._write_new(self.op,self.lease,name,self.record())
  self.assertEqual(sorted(p.name for p in self.op.directory.iterdir()),['.flow.lock'])
 def test_existing_symlink_not_followed_or_overwritten(self):
  victim=self.root/'victim';victim.write_text('retained');self.path().symlink_to(victim)
  with self.assertRaises(ValueError):m._read(self.op,self.lease,self.name())
  with self.assertRaises((ValueError,FileExistsError)):m._write_new(self.op,self.lease,self.name(),self.record())
  self.assertEqual(victim.read_text(),'retained');self.assertTrue(self.path().is_symlink())
 def test_malformed_duplicate_oversized_nondict_json_refused(self):
  for raw in (b'{}x',b'{"version":1,"version":2}',b'{"a":"\xff"}',b'[]',b'"string"',b' '*16385):
   self.path().write_bytes(raw);self.path().chmod(0o600)
   with self.assertRaises(ValueError):m._read(self.op,self.lease,self.name())
 def test_unsafe_existing_mode_refused_without_chmod(self):
  self.path().write_text(json.dumps(self.record()));self.path().chmod(0o644)
  with self.assertRaises(ValueError):m._read(self.op,self.lease,self.name())
  self.assertEqual(self.path().stat().st_mode&0o777,0o644)
 def test_invalid_write_type_size_no_file_or_temp(self):
  for data in ([],None,'x',{'a':'x'*16385}):
   with self.assertRaises((ValueError,TypeError)):m._write_new(self.op,self.lease,self.name(),data)
  self.assertEqual(sorted(p.name for p in self.op.directory.iterdir()),['.flow.lock'])
 def test_current_owner_removal_blocks_read_and_write(self):
  self.lock.with_name(self.lock.name+'.owner.json').unlink()
  with self.assertRaises(ValueError):m._read(self.op,self.lease,self.name())
  with self.assertRaises(ValueError):m._write_new(self.op,self.lease,self.name(),self.record())
 def test_changed_actual_instruction_digest_blocks_io(self):
  self.op.instruction+=' '
  with self.assertRaises(ValueError):m._read(self.op,self.lease,self.name())
  with self.assertRaises(ValueError):m._write_new(self.op,self.lease,self.name(),self.record())
 def test_changing_target_fd_metadata_during_read_refused(self):
  m._write_new(self.op,self.lease,self.name(),self.record());original=m.os.fstat;counter=[0];target=str(self.path())
  def unstable(fd):
   value=original(fd)
   try:is_target=os.readlink('/proc/self/fd/'+str(fd))==target
   except OSError:is_target=False
   if is_target:
    counter[0]+=1
    if counter[0]>1:
     attrs={n:getattr(value,n) for n in dir(value) if n.startswith('st_')};attrs['st_mtime_ns']+=1;attrs['st_mtime']+=1;return types.SimpleNamespace(**attrs)
   return value
  with patch.object(m.os,'fstat',side_effect=unstable):
   with self.assertRaises(ValueError):m._read(self.op,self.lease,self.name())
 def test_directory_sync_failure_is_not_success(self):
  original=m.os.open;directory=str(self.op.directory)
  def fail_dir(path,flags,*args,**kwargs):
   if os.fspath(path)==directory:raise OSError('fixture directory unavailable')
   return original(path,flags,*args,**kwargs)
  with patch.object(m.os,'open',side_effect=fail_dir):
   with self.assertRaises((OSError,ValueError)):m._write_new(self.op,self.lease,self.name(),self.record())
 def test_disappearance_after_lstat_is_not_absence(self):
  self.path().write_text(json.dumps(self.record()));self.path().chmod(0o600);original=m.os.open;target=str(self.path())
  def disappear(path,flags,*args,**kwargs):
   if os.fspath(path)==target:self.path().unlink()
   return original(path,flags,*args,**kwargs)
  with patch.object(m.os,'open',side_effect=disappear):
   with self.assertRaises(ValueError):m._read(self.op,self.lease,self.name())
if __name__=='__main__':
 names=[n for n in IO.__dict__ if n.startswith('test_')];result=unittest.TextTestRunner(verbosity=2).run(unittest.TestSuite(IO(n) for n in names));raise SystemExit(not result.wasSuccessful())