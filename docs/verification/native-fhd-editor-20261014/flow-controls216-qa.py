import importlib.util,os,pathlib,struct,unittest
from unittest.mock import patch
s=importlib.util.spec_from_file_location('display',pathlib.Path(os.environ['FLOW_DISPLAY_CANDIDATE']));m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
class Socket:
 def __init__(self):self.sent=[]
 def sendall(self,data):self.sent.append(data)
class Controls(unittest.TestCase):
 def display(self):d=m.FlowDisplay.__new__(m.FlowDisplay);d.socket=Socket();return d
 def test_exact_observed_controls_one_mouse_click_no_keyboard(self):
  for role,x,y in [('result-download-control',688,135),('result-prompt-expand',1035,473),('result-preview-back',50,134)]:
   d=self.display()
   with patch.object(m.time,'sleep',return_value=None):d.click(role,x,y)
   self.assertEqual(b''.join(d.socket.sent),struct.pack('>BBHH',5,1,x,y)+struct.pack('>BBHH',5,0,x,y))
 def test_each_role_refuses_outside_its_narrow_region(self):
  for role,points in {'result-download-control':[(674,135),(706,135),(688,119),(688,151)],'result-prompt-expand':[(1019,473),(1048,473),(1035,459),(1035,489)],'result-preview-back':[(34,134),(66,134),(50,114),(50,156)]}.items():
   for point in points:
    d=self.display()
    with self.assertRaises(ValueError):d.click(role,*point)
    self.assertEqual(d.socket.sent,[])
 def test_generate_not_reachable_through_research_roles(self):
  for role in ['result-download-control','result-prompt-expand','result-preview-back','generate']:
   d=self.display()
   with self.assertRaises(ValueError):d.click(role,840,833)
   self.assertEqual(d.socket.sent,[])
if __name__=='__main__':unittest.main()
