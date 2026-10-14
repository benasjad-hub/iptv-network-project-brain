import json,pathlib,os,subprocess
meta=json.loads(pathlib.Path('/root/daoudstudio-staging/flow-qa-existing-sataarbil-metadata.json').read_text());home=pathlib.Path(meta['home']);lock=home/'.worker.lock';rows={}
for label,path in (('registeredHome',home),('workerLease',lock),('originalCli',pathlib.Path(meta['cli']))):
 st=path.stat();rows[label]={'uid':st.st_uid,'gid':st.st_gid,'mode':oct(st.st_mode&0o777),'serviceRead':subprocess.run(['runuser','-u','iptv','--','test','-r',str(path)],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL).returncode==0,'serviceWrite':subprocess.run(['runuser','-u','iptv','--','test','-w',str(path)],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL).returncode==0}
print(json.dumps({'readOnlyAccessMetadata':True,'noAuthContentsOrPermissionChanges':True,'serviceUser':'iptv','checks':rows}))
