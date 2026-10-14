import pathlib,subprocess,json,time,os,importlib.util
base=pathlib.Path('/root/daoudstudio-staging/flow207-qa');meta=json.loads(pathlib.Path('/root/daoudstudio-staging/flow-qa-existing-sataarbil-metadata.json').read_text());work=pathlib.Path('/home/iptv/daoudstudio/state/agent-acceptance/native-flow-service234');proof=pathlib.Path('/root/daoudstudio-staging/native-flow-service234-proof.json')
if proof.exists() or work.exists():raise SystemExit('Existing service-user probe preserved')
subprocess.run(['install','-d','-m','700','-o','iptv','-g','iptv',str(work)],check=True)
for name in ('flow-observation.py','flow-prepare.py','antigravity-acceptance.py'):
 subprocess.run(['install','-m','600','-o','iptv','-g','iptv',str(base/name),str(work/name)],check=True)
script="""import importlib.util,pathlib,json,sys,hashlib,time
p=pathlib.Path(__file__).parent;s=importlib.util.spec_from_file_location('o',p/'flow-observation.py');o=importlib.util.module_from_spec(s);s.loader.exec_module(o)
start=time.time();result={'serviceUser':'iptv','noBrowserInput':True,'noGeneration':True,'noAuthCopy':True}
try:
 frame,at=o.capture_anchor(p);obs=o.Observer(p,sys.argv[1],sys.argv[2],frame);rec=obs.observe(frame,at,'Observe ONLY current Google Flow visible project 93a089fa-6105-47ce-bf4c-42c5561b3b41. Do not infer login/account from project alone.',{'isFlow':'bool','projectMatches':'bool'},timeout=100);result.update(state='observed',observation=o.fresh_record(rec,hashlib.sha256(frame.read_bytes()).hexdigest()),frameHash=rec['frameHash'])
except Exception as err:result.update(state='blocked',errorClass=type(err).__name__)
result['elapsedSeconds']=round(time.time()-start,3);print(json.dumps(result))
"""
source=work/'service-probe.py';source.write_text(script);os.chmod(source,0o600);st=work.stat();os.chown(source,st.st_uid,st.st_gid)
s=importlib.util.spec_from_file_location('r',base/'flow-runtime.py');r=importlib.util.module_from_spec(s);s.loader.exec_module(r)
result={'serviceUser':'iptv','startedAt':time.time(),'noPermissionsOrAuthChange':True}
try:
 with r.BrowserLock('/home/iptv/daoudstudio/state/flow-desktop/.flow-browser.lock'),r.BrowserLock(pathlib.Path(meta['home'])/'.worker.lock'):
  owner=pathlib.Path('/home/iptv/daoudstudio/state/flow-desktop/.flow-browser.lock.owner.json')
  if owner.exists() and json.loads(owner.read_text()).get('state')=='active':raise ValueError('Owner retained')
  p=subprocess.run(['runuser','-u','iptv','--','python3',str(source),meta['cli'],meta['home']],cwd=work,stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,text=True,timeout=130);result.update(exitCode=p.returncode,probe=json.loads(p.stdout) if p.returncode==0 and len(p.stdout)<4000 else None)
except Exception as err:result.update(state='blocked',errorClass=type(err).__name__)
result['elapsedSeconds']=round(time.time()-result['startedAt'],3);proof.write_text(json.dumps(result));os.chmod(proof,0o600);print(json.dumps(result))