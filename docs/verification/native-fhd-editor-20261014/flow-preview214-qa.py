import importlib.util,os,pathlib,struct,unittest
from unittest.mock import patch
s=importlib.util.spec_from_file_location('display',pathlib.Path(os.environ['FLOW_DISPLAY_CANDIDATE']));m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
class Socket:
 def __init__(self):self.sent=[]
 def sendall(self,data):self.sent.append(data)
class Preview(unittest.TestCase):
 def display(self):d=m.FlowDisplay.__new__(m.FlowDisplay);d.socket=Socket();return d
 def test_existing_preview_one_click_no_keys_or_generate(self):
  d=self.display()
  with patch.object(m.time,'sleep',return_value=None):d.click('existing-result-preview',330,280)
  self.assertEqual(b''.join(d.socket.sent),struct.pack('>BBHH',5,1,330,280)+struct.pack('>BBHH',5,0,330,280))
 def test_preview_outside_observed_card_refuses_no_input(self):
  for point in [(259,280),(402,280),(330,169),(330,426),(840,833)]:
   d=self.display()
   with self.assertRaises(ValueError):d.click('existing-result-preview',*point)
   self.assertEqual(d.socket.sent,[])
 def test_plain_generate_still_forbidden(self):
  d=self.display()
  with self.assertRaises(ValueError):d.click('generate',840,833)
  self.assertEqual(d.socket.sent,[])
if __name__=='__main__':unittest.main()
