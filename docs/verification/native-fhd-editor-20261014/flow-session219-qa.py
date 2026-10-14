import importlib.util,os,pathlib,tempfile,time,json,hashlib,unittest
base=pathlib.Path(os.environ['FLOW_SESSION_CANDIDATE'])
def load(name,file):
 spec=importlib.util.spec_from_file_location(name,base/file);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m
m=load('session','flow-session.py');opmod=load('operations','flow-operation.py');runtime=load('runtime','flow-runtime.py')
TASK='11111111-1111-4111-8111-111111111111';OTHER='33333333-3333-4333-8333-333333333333';PROJECT='93a089fa-6105-47ce-bf4c-42c5561b3b41'
def req(task=TASK):
 text=json.dumps({'site':'fixture','completed':[],'publish':False,'nextStage':{'id':0,'kind':'video','engine':'flow','instruction':'one test clip'}});return {'taskId':task,'stageId':0,'kind':'video','instruction':text,'operationId':task+':0','contextHash':hashlib.sha256(text.encode()).hexdigest()}
class Session(unittest.TestCase):
 def setUp(self):self.temp=tempfile.TemporaryDirectory(prefix='studio-session-qa-');self.root=pathlib.Path(self.temp.name);self.ops=self.root/'ops';self.ops.mkdir();self.lock=self.root/'browser.lock';self.journal=self.root/'browser.lock.owner.json'
 def tearDown(self):self.temp.cleanup()
 def test_reserve_same_reuses_other_context_waits(self):
  with opmod.Operation(self.ops,req()) as op,runtime.BrowserLock(self.lock) as lease:
   self.assertTrue(m.reserve(op,lease,PROJECT,'qa@example.com')['acquired']);before=self.journal.read_bytes();self.assertTrue(m.reserve(op,lease,PROJECT,'qa@example.com')['reused']);self.assertEqual(before,self.journal.read_bytes())
   with opmod.Operation(self.ops,req(OTHER)) as other:self.assertTrue(m.reserve(other,lease,PROJECT,'qa@example.com')['busy'])
   self.assertEqual(before,self.journal.read_bytes())
 def test_attempted_ledger_cannot_release_as_cancelled_even_without_ui_attempt_file(self):
  with opmod.Operation(self.ops,req()) as op,runtime.BrowserLock(self.lock) as lease:
   m.reserve(op,lease,PROJECT,'qa@example.com');op.prepare(PROJECT,'qa@example.com',{'model':'Omni 1.1 Flash','cost':12,'seconds':8,'height':720,'results':1,'balance':1050},time.time());op.submit_once(lambda *_:None);before=self.journal.read_bytes()
   with self.assertRaises(ValueError):m.release_cancelled(op,lease,lambda:True)
   self.assertEqual(before,self.journal.read_bytes())
 def test_invalid_project_refused_before_journal(self):
  with opmod.Operation(self.ops,req()) as op,runtime.BrowserLock(self.lock) as lease:
   with self.assertRaises(ValueError):m.reserve(op,lease,'not-a-project','qa@example.com')
   self.assertFalse(self.journal.exists())
 def test_corrupt_existing_journal_is_not_missing(self):
  self.journal.write_text('{bad')
  with opmod.Operation(self.ops,req()) as op,runtime.BrowserLock(self.lock) as lease:
   with self.assertRaises(ValueError):m.reserve(op,lease,PROJECT,'qa@example.com')
   self.assertEqual(self.journal.read_text(),'{bad')
 def test_cancelled_before_submit_releases_then_other_can_reserve(self):
  with opmod.Operation(self.ops,req()) as op,runtime.BrowserLock(self.lock) as lease:
   m.reserve(op,lease,PROJECT,'qa@example.com');self.assertTrue(m.release_cancelled(op,lease,lambda:True))
   with opmod.Operation(self.ops,req(OTHER)) as other:self.assertTrue(m.reserve(other,lease,PROJECT,'qa@example.com')['acquired'])
 def test_false_cancellation_does_not_release(self):
  with opmod.Operation(self.ops,req()) as op,runtime.BrowserLock(self.lock) as lease:
   m.reserve(op,lease,PROJECT,'qa@example.com');before=self.journal.read_bytes()
   with self.assertRaises(ValueError):m.release_cancelled(op,lease,lambda:False)
   self.assertEqual(before,self.journal.read_bytes())
 def test_future_clock_does_not_create_journal(self):
  with opmod.Operation(self.ops,req()) as op,runtime.BrowserLock(self.lock) as lease:
   with self.assertRaises(ValueError):m.reserve(op,lease,PROJECT,'qa@example.com',clock=lambda:time.time()+100)
   self.assertFalse(self.journal.exists())
 def test_existing_old_active_owner_is_not_stolen(self):
  with opmod.Operation(self.ops,req()) as op,runtime.BrowserLock(self.lock) as lease:
   m.reserve(op,lease,PROJECT,'qa@example.com');data=json.loads(self.journal.read_text());data['reservedAt']=time.time()-86400;self.journal.write_text(json.dumps(data));before=self.journal.read_bytes()
   with opmod.Operation(self.ops,req(OTHER)) as other:self.assertTrue(m.reserve(other,lease,PROJECT,'qa@example.com')['busy'])
   self.assertEqual(before,self.journal.read_bytes())
 def test_symlink_owner_is_refused_without_touching_target(self):
  victim=self.root/'victim.json';victim.write_text('fixture');self.journal.symlink_to(victim)
  with opmod.Operation(self.ops,req()) as op,runtime.BrowserLock(self.lock) as lease:
   with self.assertRaises(ValueError):m.reserve(op,lease,PROJECT,'qa@example.com')
   self.assertEqual(victim.read_text(),'fixture')
 def test_future_existing_reserved_timestamp_is_not_accepted(self):
  with opmod.Operation(self.ops,req()) as op,runtime.BrowserLock(self.lock) as lease:
   m.reserve(op,lease,PROJECT,'qa@example.com');data=json.loads(self.journal.read_text());data['reservedAt']=time.time()+0.5;self.journal.write_text(json.dumps(data));before=self.journal.read_bytes()
   with self.assertRaises(ValueError):m.reserve(op,lease,PROJECT,'qa@example.com')
   self.assertEqual(before,self.journal.read_bytes())
 def test_trailing_newline_project_is_not_canonical(self):
  with opmod.Operation(self.ops,req()) as op,runtime.BrowserLock(self.lock) as lease:
   with self.assertRaises(ValueError):m.reserve(op,lease,PROJECT+'\n','qa@example.com')
   self.assertFalse(self.journal.exists())
 def test_live_recovery_completed_helper_releases_only_after_real_decode(self):
  import subprocess
  download=load('immutable_download','flow-download.py');media=self.root/'media';media.mkdir();downloads=self.root/'downloads';downloads.mkdir()
  with opmod.Operation(self.ops,req()) as op,runtime.BrowserLock(self.lock) as lease:
   m.reserve(op,lease,PROJECT,'qa@example.com');op.prepare(PROJECT,'qa@example.com',{'model':'Omni 1.1 Flash','cost':12,'seconds':8,'height':720,'results':1,'balance':1050},time.time());op.submit_once(lambda *_:None)
   download.prepare_download(op,downloads,'fixture.mp4','qa@example.com','qa@example.com')
   subprocess.run(['/usr/bin/ffmpeg','-hide_banner','-v','error','-f','lavfi','-i','color=c=blue:s=1280x720:r=4:d=8','-c:v','libx264','-preset','ultrafast','-pix_fmt','yuv420p','-an',str(downloads/'fixture.mp4')],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,timeout=20,check=True)
   download.finish_download(op,downloads,media,'qa@example.com','qa@example.com');self.assertTrue(m.release_completed(op,lease,media));self.assertEqual(json.loads(self.journal.read_text())['releaseReason'],'completed')
if __name__=='__main__':unittest.main()
