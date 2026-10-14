import importlib.util,os,pathlib,struct,unittest
from unittest.mock import patch
s=importlib.util.spec_from_file_location('display',pathlib.Path(os.environ['FLOW_DISPLAY_CANDIDATE']));m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
class Socket:
 def __init__(self):self.sent=[]
 def sendall(self,data):self.sent.append(data)
class Original(unittest.TestCase):
 def display(self):d=m.FlowDisplay.__new__(m.FlowDisplay);d.socket=Socket();return d
 def test_original720_exact_one_click(self):
  d=self.display()
  with patch.object(m.time,'sleep',return_value=None):d.click('result-download-original-720',740,240)
  self.assertEqual(b''.join(d.socket.sent),struct.pack('>BBHH',5,1,740,240)+struct.pack('>BBHH',5,0,740,240))
 def test_gif_enhanced_upgrade_generate_outside_original_row(self):
  for point in [(710,178),(715,282),(815,337),(840,833),(679,240),(879,240),(740,209),(740,266)]:
   d=self.display()
   with self.assertRaises(ValueError):d.click('result-download-original-720',*point)
   self.assertEqual(d.socket.sent,[])
 def test_unknown_quality_role_never_sends(self):
  d=self.display()
  with self.assertRaises(ValueError):d.click('download-any-quality',740,240)
  self.assertEqual(d.socket.sent,[])
if __name__=='__main__':unittest.main()
