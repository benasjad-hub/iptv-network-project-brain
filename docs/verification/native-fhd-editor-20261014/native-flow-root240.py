import importlib.util,pathlib,json,time,hashlib,os
base=pathlib.Path('/root/daoudstudio-staging/flow207-qa')
def load(name,file):
 s=importlib.util.spec_from_file_location(name,base/file);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
r=load('runtime','flow-runtime.py');o=load('observer','flow-observation.py');d=load('display','flow-display.py')
work=pathlib.Path('/root/daoudstudio-staging/native-flow-root240');work.mkdir(mode=0o700,exist_ok=True);proof=work/'proof.json'
if proof.exists():raise SystemExit('Existing probe retained; no replay')
meta=json.loads(pathlib.Path('/root/daoudstudio-staging/flow-qa-existing-sataarbil-metadata.json').read_text());lock=pathlib.Path('/home/iptv/daoudstudio/state/flow-desktop/.flow-browser.lock')
original_load=o.load
provider_meta=[]
def diagnostic_load(name,file):
 module=original_load(name,file)
 if file=='antigravity-acceptance.py':
  original_run=module.run
  def measured(*args,**kwargs):
   response=original_run(*args,**kwargs);provider_meta.append({'status':response.get('status'),'exit':response.get('exit'),'errorClass':response.get('errorClass'),'responseLength':len(response.get('response','')),'keys':sorted(response.keys())});return response
  module.run=measured
 return module
o.load=diagnostic_load
result={'startedAt':time.time(),'historicalReferenceOnly':True,'generationExecuted':False,'downloadExecuted':False,'taskMutation':False}
try:
 with r.BrowserLock(lock),r.BrowserLock(pathlib.Path(meta['home'])/'.worker.lock'):
  owner=lock.with_name(lock.name+'.owner.json')
  if owner.exists() and json.loads(owner.read_text()).get('state')=='active':raise ValueError('Active owner retained')
  frame,at=o.capture_anchor(work);obs=o.Observer(work,meta['cli'],meta['home'],frame);fh=hashlib.sha256(frame.read_bytes()).hexdigest()
  rec=obs.observe(frame,at,'Confirm this is the existing private Flow project93a089fa-6105-47ce-bf4c-42c5561b3b41 and visible historical Clown encounters lion in arena detail. No task output or generation claim.',{'projectMatches':'bool','historicalDetailMatches':'bool'},timeout=100)
  result.update(state='observed',frameHash=fh,capturedAt=at,observation=o.fresh_record(rec,fh),inputExecuted=False)
  if any(result['observation'].get(k) is not True for k in ('projectMatches','historicalDetailMatches')):raise ValueError('Fresh prior-project witness required')
  with d.FlowDisplay() as driver:driver.open_project('93a089fa-6105-47ce-bf4c-42c5561b3b41')
  result['inputExecuted']=True;time.sleep(1.5)
  after,after_at=o.capture_anchor(work);next_obs=o.Observer(work,meta['cli'],meta['home'],after);ah=hashlib.sha256(after.read_bytes()).hexdigest()
  record=next_obs.observe(after,after_at,'Confirm visible URL is exact Flow project93a089fa-6105-47ce-bf4c-42c5561b3b41 ROOT, not /edit/ detail, and profile button at999135 is account profile, not OK. Only visible facts.',{'projectRootMatches':'bool','profileButtonAtPoint':'bool','detailAbsent':'bool'},timeout=100)
  result.update(state='root-observed',afterFrameHash=ah,afterObservation=o.fresh_record(record,ah))
except Exception as err:result.update(state='blocked',errorClass=type(err).__name__)
result['providerDiagnostics']=provider_meta;result['elapsedSeconds']=round(time.time()-result['startedAt'],3);proof.write_text(json.dumps(result));os.chmod(proof,0o600);print(json.dumps(result))