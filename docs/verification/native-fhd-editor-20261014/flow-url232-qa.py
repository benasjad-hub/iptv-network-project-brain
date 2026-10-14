import importlib.util,pathlib,os,struct,unittest
from unittest.mock import patch
base=pathlib.Path(os.environ['FLOW_URL_CANDIDATE']);s=importlib.util.spec_from_file_location('display_candidate',base/'flow-display.py');m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
class Socket:
 def __init__(self):self.data=b''
 def sendall(self,b):self.data+=b
class URL(unittest.TestCase):
 def object(self):d=m.FlowDisplay.__new__(m.FlowDisplay);d.socket=Socket();return d
 def events(self,d):self.assertEqual(len(d.socket.data)%8,0);return [struct.unpack('>BBHI',d.socket.data[i:i+8]) for i in range(0,len(d.socket.data),8)]
 def test_expose_only_ctrl_l_end_with_all_releases(self):
  d=self.object()
  with patch.object(m.time,'sleep'):d.expose_current_result_url()
  events=self.events(d);self.assertEqual([(v[3],v[1]) for v in events],[(0xffe3,1),(ord('l'),1),(ord('l'),0),(0xffe3,0),(0xff57,1),(0xff57,0)]);self.assertTrue(all(v[0]==4 and v[2]==0 for v in events))
 def test_restore_only_escape_without_enter_or_clipboard(self):
  d=self.object()
  with patch.object(m.time,'sleep'):d.restore_result_view()
  self.assertEqual([(v[3],v[1]) for v in self.events(d)],[(0xff1b,1),(0xff1b,0)])
 def test_methods_take_no_custom_key_or_url_argument(self):
  d=self.object()
  for fn in (d.expose_current_result_url,d.restore_result_view):
   with self.assertRaises(TypeError):fn('https://unrelated.example')
  self.assertEqual(d.socket.data,b'')
 def test_address_focus_exact_click_and_release(self):
  d=self.object()
  with patch.object(m.time,'sleep'):d.click('result-address-focus',500,70)
  self.assertEqual(d.socket.data,struct.pack('>BBHH',5,1,500,70)+struct.pack('>BBHH',5,0,500,70))
 def test_address_focus_bounds_and_types_refuse_before_input(self):
  d=self.object()
  for x,y in ((997,135),(840,833),(500,100),(True,70)):
   with self.assertRaises(ValueError):d.click('result-address-focus',x,y)
  self.assertEqual(d.socket.data,b'')
 def test_address_focus_does_not_bypass_generate_gate(self):
  d=self.object()
  with self.assertRaises(ValueError):d.click('generate',840,833)
  self.assertEqual(d.socket.data,b'')
if __name__=='__main__':unittest.main(verbosity=2)
