import importlib.util,pathlib,json,time,hashlib,os
base=pathlib.Path('/root/daoudstudio-staging/flow207-qa')
def load(name,file):
 spec=importlib.util.spec_from_file_location(name,base/file);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m
runtime=load('private_runtime','flow-runtime.py');obsmod=load('private_observer','flow-observation.py')
work=pathlib.Path('/root/daoudstudio-staging/native-flow-result230');work.mkdir(mode=0o700,exist_ok=True);proof=work/'proof.json'
if proof.exists():raise SystemExit('Existing observation retained; no replay')
meta=json.loads(pathlib.Path('/root/daoudstudio-staging/flow-qa-existing-sataarbil-metadata.json').read_text())
lock=pathlib.Path('/home/iptv/daoudstudio/state/flow-desktop/.flow-browser.lock');owner=lock.with_name(lock.name+'.owner.json')
provider_diagnostic={}
original_load=obsmod.load
def diagnostic_load(name,file):
 module=original_load(name,file)
 if file=='antigravity-acceptance.py':
  original_run=module.run
  def run(*args,**kwargs):
   value=original_run(*args,**kwargs)
   provider_diagnostic.update({k:value.get(k) for k in ('status','exit','errorClass')});provider_diagnostic['responseLength']=len(value.get('response',''))
   return value
  module.run=run
 return module
obsmod.load=diagnostic_load
result={'startedAt':time.time(),'nativeReadOnly':True,'noBrowserInput':True,'notAppTaskOutput':True,'generationExecuted':False,'downloadExecuted':False,'readyForExport':False}
try:
 with runtime.BrowserLock(lock),runtime.BrowserLock(pathlib.Path(meta['home'])/'.worker.lock'):
  if owner.exists() and json.loads(owner.read_text()).get('state')=='active':raise ValueError('Active native owner retained')
  frame,captured=obsmod.capture_anchor(work);digest=hashlib.sha256(frame.read_bytes()).hexdigest();observer=obsmod.Observer(work,meta['cli'],meta['home'],frame)
  record=observer.observe(frame,captured,'Read only the currently visible Flow reference. projectMatches means the visible address is project 93a089fa-6105-47ce-bf4c-42c5561b3b41. resultId is the FULL result UUID after /edit/ only if ALL its characters are visible, otherwise null; never reconstruct or guess hidden characters. nativeName is a FULL filename explicitly visible in a Chrome download notification only, otherwise null; never derive it from a clip title or date. This historical reference is NOT the saved app task output.',{'isFlow':'bool','projectMatches':'bool','resultId':'uuid','nativeName':'filename'},timeout=100)
  value=obsmod.fresh_record(record,digest);result.update(state='observed',capturedAt=captured,frameHash=digest,observation=value,elapsedSeconds=round(time.time()-result['startedAt'],3))
except Exception as err:result.update(state='blocked',errorClass=type(err).__name__,safeReason=str(err) if str(err) in ('Original visual provider unavailable','Visual result unavailable','Visual contract mismatch','Selected model unavailable','Fresh matching Flow frame required') else 'other-validation',providerDiagnostic=provider_diagnostic,elapsedSeconds=round(time.time()-result['startedAt'],3))
proof.write_text(json.dumps(result));os.chmod(proof,0o600);print(json.dumps(result))
