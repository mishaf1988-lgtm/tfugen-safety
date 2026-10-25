import sys, time
from Xlib import X, display
from Xlib.ext import xtest
d = display.Display()
def move(x, y): xtest.fake_input(d, X.MotionNotify, x=x, y=y); d.sync()
def click(x, y):
    move(x, y); time.sleep(0.15)
    xtest.fake_input(d, X.ButtonPress, 1); d.sync(); time.sleep(0.05)
    xtest.fake_input(d, X.ButtonRelease, 1); d.sync()
def key(name):
    from Xlib import XK
    kc = d.keysym_to_keycode(XK.string_to_keysym(name))
    xtest.fake_input(d, X.KeyPress, kc); d.sync(); xtest.fake_input(d, X.KeyRelease, kc); d.sync()
cmd = sys.argv[1]
if cmd == 'click': click(int(sys.argv[2]), int(sys.argv[3]))
elif cmd == 'move': move(int(sys.argv[2]), int(sys.argv[3]))
elif cmd == 'key': key(sys.argv[2])
