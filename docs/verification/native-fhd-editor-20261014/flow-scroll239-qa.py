import importlib.util,pathlib,os,struct,unittest
from unittest.mock import patch
base=pathlib.Path(os.environ['FLOW_SCROLL_CANDIDATE']);s=importlib.util.spec_from_file_location('display',base/'flow-display.py');m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
class Socket:
 def __init__(self):self.data=b''
 def sendall(self,b):self.data+=b
class Scroll(unittest.TestCase):
 def object(self):d=m.FlowDisplay.__new__(m.FlowDisplay);d.socket=Socket();return d
 def test_down_three_fixed_pairs_and_no_button_hold(self):
  d=self.object()
  with patch.object(m.time,'sleep'):d.scroll_result_prompt('down',3)
  self.assertEqual(d.socket.data,(struct.pack('>BBHH',5,16,900,410)+struct.pack('>BBHH',5,0,900,410))*3)
 def test_up_default_exact_release(self):
  d=self.object()
  with patch.object(m.time,'sleep'):d.scroll_result_prompt('up')
  self.assertEqual(d.socket.data,struct.pack('>BBHH',5,8,900,410)+struct.pack('>BBHH',5,0,900,410))
 def test_invalid_direction_steps_refuse_without_input(self):
  d=self.object()
  for direction,steps in (('left',1),('DOWN',1),(1,1),(None,1),('down',True),('up',0),('up',4),('up',1.0)):
   with self.assertRaises(ValueError):d.scroll_result_prompt(direction,steps)
  self.assertEqual(d.socket.data,b'')
 def test_no_custom_coordinate_or_key(self):
  d=self.object()
  with self.assertRaises(TypeError):d.scroll_result_prompt('down',1,840,833)
  self.assertEqual(d.socket.data,b'')
 def test_plain_generate_still_forbidden(self):
  d=self.object()
  with self.assertRaises(ValueError):d.click('generate',840,833)
  self.assertEqual(d.socket.data,b'')
if __name__=='__main__':unittest.main(verbosity=2)