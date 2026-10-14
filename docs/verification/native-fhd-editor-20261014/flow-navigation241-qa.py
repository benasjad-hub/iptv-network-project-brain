import importlib.util,os,pathlib,struct,unittest
from unittest.mock import patch
p=pathlib.Path(os.environ['FLOW_DISPLAY_CANDIDATE']);s=importlib.util.spec_from_file_location('display_candidate',p);m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
PROJECT='93a089fa-6105-47ce-bf4c-42c5561b3b41';URL='https://flow.google.com/project/'+PROJECT
class Socket:
 def __init__(self):self.sent=[]
 def sendall(self,data):self.sent.append(data)
class Cases(unittest.TestCase):
 def display(self):d=m.FlowDisplay.__new__(m.FlowDisplay);d.socket=Socket();return d
 def keys(self,d):
  raw=b''.join(d.socket.sent);return [struct.unpack('>BBHI',raw[i:i+8]) for i in range(0,len(raw),8)]
 def test_missing_or_noncallable_before_input(self):
  for callback in (None,True,1,'true'):
   d=self.display()
   with self.assertRaises((ValueError,TypeError)):d.open_project(PROJECT,callback)
   self.assertEqual(d.socket.sent,[])
 def test_invalid_project_before_input(self):
  for project in (None,[],PROJECT.upper(),URL,PROJECT+'?evil'):
   d=self.display()
   with self.assertRaises((ValueError,TypeError)):d.open_project(project,lambda url:True)
   self.assertEqual(d.socket.sent,[])
 def test_exact_callback_after_full_typing_before_one_enter(self):
  d=self.display();seen=[]
  def confirm(url):
   self.assertEqual(url,URL);downs=[k[3] for k in self.keys(d) if k[1]];self.assertNotIn(0xff0d,downs);self.assertEqual(''.join(chr(k) for k in downs if 32<=k<127),'l'+URL);seen.append(url);return True
  with patch.object(m.time,'sleep') as sleep:d.open_project(PROJECT,confirm)
  self.assertEqual(seen,[URL]);downs=[k[3] for k in self.keys(d) if k[1]];self.assertEqual(downs.count(0xff0d),1);self.assertTrue(any(c.args and c.args[0]>=0.4 for c in sleep.call_args_list))
 def test_false_and_truthy_nonbool_no_enter(self):
  for answer in (False,None,1,'true',{'confirmed':True}):
   d=self.display()
   with patch.object(m.time,'sleep'),self.assertRaises((ValueError,TypeError)):d.open_project(PROJECT,lambda url:answer)
   self.assertNotIn(0xff0d,[k[3] for k in self.keys(d) if k[1]])
 def test_callback_error_no_enter_and_no_retry(self):
  d=self.display();seen=[]
  def fail(url):seen.append(url);raise ValueError('uncertain address')
  with patch.object(m.time,'sleep'),self.assertRaises(ValueError):d.open_project(PROJECT,fail)
  self.assertEqual(seen,[URL]);self.assertNotIn(0xff0d,[k[3] for k in self.keys(d) if k[1]])
 def test_generate_still_forbidden(self):
  d=self.display()
  with self.assertRaises(ValueError):d.click('generate',840,833)
  self.assertEqual(d.socket.sent,[])
if __name__=='__main__':unittest.main(verbosity=2)