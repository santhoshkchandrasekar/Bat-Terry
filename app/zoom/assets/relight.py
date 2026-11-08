import cv2,numpy as np
c=cv2.imread('day-cut.png',cv2.IMREAD_UNCHANGED).astype(np.float32)/255
bgr,a=c[...,:3],c[...,3:]
L=bgr.mean(2,keepdims=True)
# kill the sun patches: compress highlights hard, keep the form shading
x=np.clip(bgr,0,1)
x=np.where(x>0.55,0.55+(x-0.55)*0.35,x)
# desaturate toward luminance, then moonlight: cool, dim, slight blue lift in shadows
x=L+(x-L)*0.55
x=x*0.46
x=x*np.array([1.22,0.98,0.80])          # BGR: more blue, less red
x=x+np.array([0.035,0.02,0.01])*(1-x)  # blue lift in shadows
# gentle top-down moon falloff (light from upper left)
h,w=x.shape[:2]; yy,xx=np.mgrid[0:h,0:w].astype(np.float32)
fall=1.05-0.25*(yy/h)-0.10*(xx/w)
x=np.clip(x*fall[...,None],0,1)
out=np.dstack([x,a])*255
cv2.imwrite('night-relit.png',out.astype(np.uint8))
cv2.imwrite('app/zoom/assets/projector/screen-night.webp',out.astype(np.uint8),[cv2.IMWRITE_WEBP_QUALITY,90])
# preview over the night page colour
bg=np.zeros_like(bgr);bg[:]=(21/255,13/255,15/255)
pv=(x*a+bg*(1-a))*255
cv2.imwrite('night-relit-pv.png',cv2.resize(pv.astype(np.uint8),(1400,600)))
