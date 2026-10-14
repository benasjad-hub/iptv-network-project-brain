import pathlib,json
rows=[]
for p in pathlib.Path('/proc').iterdir():
 if not p.name.isdigit():continue
 try:
  if (p/'comm').read_text().strip()!='x11vnc':continue
  args=(p/'cmdline').read_bytes().decode().split('\0')
  values={k:args[args.index(k)+1] for k in ('-display','-rfbport','-input') if k in args and args.index(k)+1<len(args)}
  if values.get('-rfbport')!='5908' and values.get('-display')!=':98':continue
  rows.append({'pid':int(p.name),'inputOptions':values,'viewOnly':'-viewonly' in args,'noXTest':'-noxtest' in args,'noXKB':'-noxkb' in args,'readOnlyMetadata':True})
 except (OSError,UnicodeError):continue
print(json.dumps({'matchedPrivateDisplay':rows,'noAuthArgumentsOrContentsReported':True}))
