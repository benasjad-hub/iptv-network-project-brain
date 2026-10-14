import importlib.util,pathlib,json,time,hashlib,os
base=pathlib.Path('/root/daoudstudio-staging/flow207-qa')
def load(name,file):
 s=importlib.util.spec_from_file_location(name,base/file);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
r=load('runtime','flow-runtime.py');o=load('observer','flow-observation.py');d=load('display','flow-display.py')
work=pathlib.Path('/root/daoudstudio-staging/native-flow-prompt234');work.mkdir(mode=0o700,exist_ok=True);proof=work/'proof.json'
if proof.exists():raise SystemExit('Existing probe retained; no replay')
meta=json.loads(pathlib.Path('/root/daoudstudio-staging/flow-qa-existing-sataarbil-metadata.json').read_text());lock=pathlib.Path('/home/iptv/daoudstudio/state/flow-desktop/.flow-browser.lock')
result={'startedAt':time.time(),'historicalReferenceOnly':True,'generationExecuted':False,'downloadExecuted':False,'taskMutation':False}
try:
 with r.BrowserLock(lock),r.BrowserLock(pathlib.Path(meta['home'])/'.worker.lock'):
  owner=lock.with_name(lock.name+'.owner.json')
  if owner.exists() and json.loads(owner.read_text()).get('state')=='active':raise ValueError('Active owner retained')
  frame,at=o.capture_anchor(work);obs=o.Observer(work,meta['cli'],meta['home'],frame);fh=hashlib.sha256(frame.read_bytes()).hexdigest()
  rec=obs.observe(frame,at,'Verify visible historical Google Flow project 93a089fa-6105-47ce-bf4c-42c5561b3b41 and current detail Clown encounters lion in arena. Pixel(1035,473) must be the small expand chevron for the displayed generation prompt, not Generate, input, download or any editing action. Return false if uncertain.',{'projectMatches':'bool','historicalDetailMatches':'bool','promptExpandAtPoint':'bool'},timeout=100)
  v=o.fresh_record(rec,fh)
  if any(v.get(k) is not True for k in ('projectMatches','historicalDetailMatches','promptExpandAtPoint')):raise ValueError('Prompt expand not verified')
  with d.FlowDisplay() as display:display.click('result-prompt-expand',1035,473)
  result['promptExpandExecuted']=True;time.sleep(1)
  frame2,at2=o.capture_anchor(work);obs2=o.Observer(work,meta['cli'],meta['home'],frame2);fh2=hashlib.sha256(frame2.read_bytes()).hexdigest()
  rec2=obs2.observe(frame2,at2,'Read only expanded historical result prompt. Is the COMPLETE generation prompt fully visible with no truncation/ellipsis/scroll-hidden text? Is an explicit absolute generation creation timestamp visibly displayed for THIS result? createdAtUnix means its exact epoch seconds ONLY if visible date/time/timezone unambiguously identifies it. Return null if no timestamp or ambiguous, NEVER derive from screenshot/file/download/browser-tab date. Is native MP4 download filename visibly displayed? This is old reference, never app task output.',{'completePromptVisible':'bool','creationTimestampVisible':'bool','createdAtUnix':'number','nativeName':'filename'},timeout=100)
  result.update(state='observed',frameHash=fh2,capturedAt=at2,observation=o.fresh_record(rec2,fh2))
except Exception as err:result.update(state='blocked',errorClass=type(err).__name__)
result['elapsedSeconds']=round(time.time()-result['startedAt'],3);proof.write_text(json.dumps(result));os.chmod(proof,0o600);print(json.dumps(result))