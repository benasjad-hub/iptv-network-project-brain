import importlib.util,pathlib,json,time,hashlib,os
base=pathlib.Path('/root/daoudstudio-staging/flow207-qa')
def load(name,file):
 s=importlib.util.spec_from_file_location(name,base/file);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
r=load('runtime','flow-runtime.py');o=load('observer','flow-observation.py');d=load('display','flow-display.py')
spec=importlib.util.spec_from_file_location('candidate_display','/root/daoudstudio-staging/flow247-display.py');display=importlib.util.module_from_spec(spec);spec.loader.exec_module(display)
work=pathlib.Path('/root/daoudstudio-staging/native-flow-secondary247');work.mkdir(mode=0o700,exist_ok=True);proof=work/'proof.json'
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
  rec=obs.observe(frame,at,'Confirm Flow project93a089fa-6105-47ce-bf4c-42c5561b3b41 ROOT, historical SECOND video card is at pixel480280, not composer/control, and no visible pending generation. Read visible facts only.',{'projectRootMatches':'bool','secondaryCardAtPoint':'bool','noVisiblePending':'bool'},timeout=100)
  result.update(beforeFrameHash=fh,beforeObservation=o.fresh_record(rec,fh),inputExecuted=False)
  if any(result['beforeObservation'].get(k) is not True for k in ('projectRootMatches','secondaryCardAtPoint','noVisiblePending')):raise ValueError('Fresh historical card witness refused')
  with display.FlowDisplay() as driver:driver.click('existing-result-secondary-preview',480,280)
  result['inputExecuted']=True;time.sleep(1)
  detail,detail_at=o.capture_anchor(work);reader=o.Observer(work,meta['cli'],meta['home'],detail);dh=hashlib.sha256(detail.read_bytes()).hexdigest()
  receipt=reader.observe(detail,detail_at,'Confirm visible /edit/ result detail belongs to existing Flow project93a089fa-6105-47ce-bf4c-42c5561b3b41 and original point50070 is Chrome address bar. Do not infer obscured resultUUID.',{'projectDetailMatches':'bool','addressAtPoint':'bool'},timeout=100)
  result.update(detailFrameHash=dh,detailObservation=o.fresh_record(receipt,dh))
  if any(result['detailObservation'].get(k) is not True for k in ('projectDetailMatches','addressAtPoint')):raise ValueError('Result detail address witness refused')
  with display.FlowDisplay() as driver:
   driver.click('result-address-focus',500,70);time.sleep(0.4);driver.expose_current_result_url();time.sleep(1.2)
   try:
    address,at=o.capture_anchor(work);reader=o.Observer(work,meta['cli'],meta['home'],address);ah=hashlib.sha256(address.read_bytes()).hexdigest()
    receipt=reader.observe(address,at,'FirstPNG shows focused currentURL tail afterEnd, second is same clicked historicalresult detail BEFOREfocus. Return exact canonical lowercase UUID after /edit/ ONLY if every character visibly readable; null otherwise. Confirm this is the historical second result, not newly generated task output.',{'resultId':'uuid','historicalReference':'bool'},timeout=100,extra_frames=(detail,))
    result.update(state='historical-id-observed',addressFrameHash=ah,addressObservation=o.fresh_record(receipt,ah))
   finally:driver.restore_result_view()
except Exception as err:result.update(state='blocked',errorClass=type(err).__name__)
result['providerDiagnostics']=provider_meta;result['elapsedSeconds']=round(time.time()-result['startedAt'],3);proof.write_text(json.dumps(result));os.chmod(proof,0o600);print(json.dumps(result))