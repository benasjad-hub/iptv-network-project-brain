import pathlib,subprocess,os,json,re
base=pathlib.Path('/root/daoudstudio-staging/flow207-qa');env={**os.environ,'FLOW_RUNTIME_CANDIDATE':str(base),'FLOW_QA_METADATA_FILE':'/root/daoudstudio-staging/flow-qa-existing-sataarbil-metadata.json','FLOW_DISPLAY_CANDIDATE':'/root/daoudstudio-staging/flow-display-reviewed217.py'}
suites=[base/'flow206-qa.py',base/'flow-runtime-positive-qa.py',base/'flow-runtime-submit-qa.py',base/'flow-runtime-native-contract-qa.py',base/'flow-runtime-profile-qa.py',base/'flow-runtime-anchor-qa.py',base/'flow-capture-anchor-qa.py',base/'flow-runtime-download-contract-qa.py',pathlib.Path('/root/daoudstudio-staging/flow-preview214-qa.py'),pathlib.Path('/root/daoudstudio-staging/flow-controls216-qa.py'),pathlib.Path('/root/daoudstudio-staging/flow-original217-qa.py')]
total=0;results=[]
for file in suites:
 result=subprocess.run(['/usr/bin/python3',str(file),'-v'],env=env,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,timeout=60)
 match=re.search(r'Ran (\d+) tests? in ([\d.]+)s',result.stdout)
 row={'suite':file.name,'exit':result.returncode,'cases':int(match[1]) if match else None,'seconds':float(match[2]) if match else None};results.append(row)
 if result.returncode:print(result.stdout);raise SystemExit('Changed-code acceptance failed')
 total+=row['cases'];print(json.dumps(row),flush=True)
proof={'total':total,'allPassed':True,'syntheticAndMockedOnly':True,'noNativeGeneration':True,'suites':results}
path=pathlib.Path('/root/daoudstudio-staging/final218-qa-proof.json');path.write_text(json.dumps(proof));os.chmod(path,0o600);print(json.dumps({'total':total,'allPassed':True,'noNativeGeneration':True}))
