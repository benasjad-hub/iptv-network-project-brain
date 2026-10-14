import importlib.util,struct,unittest
from unittest.mock import patch
s=importlib.util.spec_from_file_location('display','/root/daoudstudio-staging/flow247-display.py');m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
class Socket:
 def __init__(self):self.sent=b''
 def sendall(self,b):self.sent+=b
class Regions(unittest.TestCase):
 def make(self):d=m.FlowDisplay.__new__(m.FlowDisplay);d.socket=Socket();return d
 def test_exact_secondary_down_up(self):
  d=self.make()
  with patch.object(m.time,'sleep'):d.click('existing-result-secondary-preview',480,280)
  self.assertEqual(d.socket.sent,struct.pack('>BBHH',5,1,480,280)+struct.pack('>BBHH',5,0,480,280))
 def test_outside_secondary_and_unknown_refuse(self):
  d=self.make()
  for role,x,y in (('existing-result-secondary-preview',330,280),('existing-result-secondary-preview',480,833),('generic',480,280)):
   with self.assertRaises(ValueError):d.click(role,x,y)
  self.assertEqual(d.socket.sent,b'')
 def test_generate_remains_forbidden(self):
  d=self.make()
  with self.assertRaises(ValueError):d.click('generate',840,833)
  self.assertEqual(d.socket.sent,b'')
if __name__=='__main__':unittest.main(verbosity=2)