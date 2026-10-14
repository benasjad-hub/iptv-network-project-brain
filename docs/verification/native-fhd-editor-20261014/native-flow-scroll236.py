import importlib.util,pathlib,json,time,hashlib,os
base=pathlib.Path('/root/daoudstudio-staging/flow207-qa')
def load(name,file):
 s=importlib.util.spec_from_file_location(name,base/file);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
r=load('runtime','flow-runtime.py');o=load('observer','flow-observation.py');d=load('display','flow-display.py')
work=pathlib.Path('/root/daoudstudio-staging/native-flow-scroll236');work.mkdir(mode=0o700,exist_ok=True);proof=work/'proof.json'
if proof.exists():raise SystemExit('Existing probe retained; no replay')
meta=json.loads(pathlib.Path('/root/daoudstudio-staging/flow-qa-existing-sataarbil-metadata.json').read_text());lock=pathlib.Path('/home/iptv/daoudstudio/state/flow-desktop/.flow-browser.lock')
result={'startedAt':time.time(),'historicalReferenceOnly':True,'generationExecuted':False,'downloadExecuted':False,'taskMutation':False}
try:
 with r.BrowserLock(lock),r.BrowserLock(pathlib.Path(meta['home'])/'.worker.lock'):
  owner=lock.with_name(lock.name+'.owner.json')
  if owner.exists() and json.loads(owner.read_text()).get('state')=='active':raise ValueError('Active owner retained')
  frame,at=o.capture_anchor(work);obs=o.Observer(work,meta['cli'],meta['home'],frame);fh=hashlib.sha256(frame.read_bytes()).hexdigest()
  rec=obs.observe(frame,at,'Verify visible historical Google Flow project 93a089fa-6105-47ce-bf4c-42c5561b3b41, detail Clown encounters lion in arena. Pixel990440 must be INSIDE the expanded generation prompt vertical scroll area in the right side, not composer/timeline/media/action. Return false if uncertain.',{'projectMatches':'bool','historicalDetailMatches':'bool','promptScrollableAtPoint':'bool'},timeout=100)
  v=o.fresh_record(rec,fh)
  if any(v.get(k) is not True for k in ('projectMatches','historicalDetailMatches','promptScrollableAtPoint')):raise ValueError('Prompt scroll not verified')
  frames=[frame];ats=[at];hashes=[fh]
  with d.FlowDisplay() as display:
   for _ in range(2):
    display.scroll_result_prompt('down',1);time.sleep(0.5);f,t=obs.capture();frames.append(f);ats.append(t);hashes.append(hashlib.sha256(f.read_bytes()).hexdigest())
  result['scrollExecuted']=True;result['frameHashes']=hashes
  rec2=obs.observe(frames[-1],ats[-1],'Compare all THREE ordered own historical clip screenshots (last frame first in image list, previous frames ordered oldest then middle). Does displayed prompt change as its right-hand prompt panel scrolls, while same historical result/project remains? Is COMPLETE prompt beginning-to-end visible across these overlapping frames without any omitted portion? Is an explicit absolute native generation creation timestamp visible? Never infer timestamp from screenshots/files/browser-tab dates. nativeName only fully visible MP4 filename, otherwise null.',{'promptScrollMoved':'bool','sameHistoricalDetail':'bool','completePromptAcrossFrames':'bool','creationTimestampVisible':'bool','nativeName':'filename'},timeout=100,extra_frames=frames[:2])
  result.update(state='observed',frameHash=hashes[-1],capturedAt=ats[-1],observation=o.fresh_record(rec2,hashes[-1]))
except Exception as err:result.update(state='blocked',errorClass=type(err).__name__)
result['elapsedSeconds']=round(time.time()-result['startedAt'],3);proof.write_text(json.dumps(result));os.chmod(proof,0o600);print(json.dumps(result))