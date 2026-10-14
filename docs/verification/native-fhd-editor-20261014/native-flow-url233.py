import importlib.util,pathlib,json,time,hashlib,os
base=pathlib.Path('/root/daoudstudio-staging/flow207-qa')
def load(name,file):
 s=importlib.util.spec_from_file_location(name,base/file);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
r=load('runtime','flow-runtime.py');o=load('observer','flow-observation.py');dmod=load('display','flow-display.py')
work=pathlib.Path('/root/daoudstudio-staging/native-flow-url233');work.mkdir(mode=0o700,exist_ok=True);proof=work/'proof.json'
if proof.exists():raise SystemExit('Existing read-only identity probe retained; no replay')
meta=json.loads(pathlib.Path('/root/daoudstudio-staging/flow-qa-existing-sataarbil-metadata.json').read_text());lock=pathlib.Path('/home/iptv/daoudstudio/state/flow-desktop/.flow-browser.lock')
result={'startedAt':time.time(),'notAppTaskOutput':True,'generationExecuted':False,'downloadExecuted':False,'clipboardAccess':False,'navigationExecuted':False,'readyForExport':False}
try:
 with r.BrowserLock(lock),r.BrowserLock(pathlib.Path(meta['home'])/'.worker.lock'):
  owner=lock.with_name(lock.name+'.owner.json')
  if owner.exists() and json.loads(owner.read_text()).get('state')=='active':raise ValueError('Active owner retained')
  frame,at=o.capture_anchor(work);before_hash=hashlib.sha256(frame.read_bytes()).hexdigest();obs=o.Observer(work,meta['cli'],meta['home'],frame)
  record=obs.observe(frame,at,'Confirm current visible Google Flow project 93a089fa-6105-47ce-bf4c-42c5561b3b41 only. addressFocusAtPoint means pixel(500,70) is INSIDE Chrome current address text input, not a webpage button; return false if obscured. Never infer obscured text.',{'isFlow':'bool','projectMatches':'bool','addressFocusAtPoint':'bool'},timeout=100);v=o.fresh_record(record,before_hash)
  if v.get('isFlow') is not True or v.get('projectMatches') is not True or v.get('addressFocusAtPoint') is not True:raise ValueError('Current project not verified')
  result['verifiedBeforeProject']=True;result['beforeFrameHash']=before_hash
  with dmod.FlowDisplay() as display:
   try:
    display.click('result-address-focus',500,70);time.sleep(0.4);display.expose_current_result_url();time.sleep(1.2);result['exposeExecuted']=True
    frame2,at2=o.capture_anchor(work);after_hash=hashlib.sha256(frame2.read_bytes()).hexdigest();obs2=o.Observer(work,meta['cli'],meta['home'],frame2)
    record2=obs2.observe(frame2,at2,'Read FULL result UUID after /edit/ at the END of current focused browser address ONLY if all36characters visible. If partly hidden/null/ambiguous return null. Never reconstruct or guess. This is an OLD reference clip, not app task output.',{'resultId':'uuid'},timeout=100)
    result.update(afterFrameHash=after_hash,capturedAt=at2,observation=o.fresh_record(record2,after_hash),state='observed')
   finally:
    display.restore_result_view();result['viewRestored']=True
except Exception as err:result.update(state='blocked',errorClass=type(err).__name__)
result['elapsedSeconds']=round(time.time()-result['startedAt'],3);proof.write_text(json.dumps(result));os.chmod(proof,0o600);print(json.dumps(result))
