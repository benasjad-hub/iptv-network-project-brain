import importlib.util,pathlib,json,time,hashlib,os
base=pathlib.Path('/root/daoudstudio-staging/flow207-qa')
def load(name,file):
 s=importlib.util.spec_from_file_location(name,base/file);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
r=load('runtime','flow-runtime.py');o=load('observer','flow-observation.py');d=load('display','flow-display.py')
spec=importlib.util.spec_from_file_location('candidate_display','/root/daoudstudio-staging/flow241-candidate/flow-display.py');display=importlib.util.module_from_spec(spec);spec.loader.exec_module(display)
work=pathlib.Path('/root/daoudstudio-staging/native-flow-root241');work.mkdir(mode=0o700,exist_ok=True);proof=work/'proof.json'
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
  rec=obs.observe(frame,at,'Confirm ordinary Chrome address bar is visible on this private browser. It currently shows a Google search from a previous malformed Flow URL. No task or generation claim.',{'browserAddressBarVisible':'bool'},timeout=100)
  result.update(beforeFrameHash=fh,beforeObservation=o.fresh_record(rec,fh),inputExecuted=False,enterAuthorized=False)
  if result['beforeObservation'].get('browserAddressBarVisible') is not True:raise ValueError('Browser surface unverified')
  def confirm_address(expected_url):
   if expected_url!='https://flow.google.com/project/93a089fa-6105-47ce-bf4c-42c5561b3b41':raise ValueError('Canonical target changed')
   address,at=o.capture_anchor(work);reader=o.Observer(work,meta['cli'],meta['home'],address);current,current_at=reader.capture();ch=hashlib.sha256(current.read_bytes()).hexdigest()
   receipt=reader.observe(current,current_at,f'Exact expected URL {expected_url} visible in FOCUSED address field (not search text/content)',{'addressFocused':'bool','projectAddressMatches':'bool'},timeout=100)
   witness=o.fresh_record(receipt,ch);result.update(typedFrameHash=ch,typedObservation=witness)
   accepted=all(witness.get(k) is True for k in ('addressFocused','projectAddressMatches'));result['enterAuthorized']=accepted;return accepted
  result['inputExecuted']=True
  with display.FlowDisplay() as driver:driver.open_project('93a089fa-6105-47ce-bf4c-42c5561b3b41',confirm_address)
  time.sleep(2)
  after,after_at=o.capture_anchor(work);reader=o.Observer(work,meta['cli'],meta['home'],after);ah=hashlib.sha256(after.read_bytes()).hexdigest()
  receipt=reader.observe(after,after_at,'Confirm exact Flow project93a089fa-6105-47ce-bf4c-42c5561b3b41 ROOT not /edit/ detail. Profile button999135 must be real account profile, not OK.',{'projectRootMatches':'bool','profileButtonAtPoint':'bool','detailAbsent':'bool'},timeout=100)
  result.update(state='root-observed',afterFrameHash=ah,afterObservation=o.fresh_record(receipt,ah))
except Exception as err:result.update(state='blocked',errorClass=type(err).__name__)
result['providerDiagnostics']=provider_meta;result['elapsedSeconds']=round(time.time()-result['startedAt'],3);proof.write_text(json.dumps(result));os.chmod(proof,0o600);print(json.dumps(result))