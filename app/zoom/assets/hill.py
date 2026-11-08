import cv2,numpy as np
def autumn(img,mask_keep):
  hsv=cv2.cvtColor(img,cv2.COLOR_BGR2HSV).astype(np.float32); h,w=hsv.shape[:2]
  leaf=((hsv[...,0]>=22)&(hsv[...,0]<=95)&(hsv[...,1]>45)).astype(np.float32)*mask_keep
  leaf=cv2.GaussianBlur(leaf,(0,0),1.0)
  rng=np.random.default_rng(5); nz=cv2.resize(rng.random((h//70+2,w//70+2)).astype(np.float32),(w,h),interpolation=cv2.INTER_CUBIC)
  tgt=np.interp(nz,[0,.3,.55,.8,1],[4,10,16,22,32])
  leaf*=0.7
  hsv[...,0]=hsv[...,0]*(1-leaf)+tgt*leaf; hsv[...,1]=np.clip(hsv[...,1]*(1-.18*leaf),0,255)
  return cv2.cvtColor(hsv.astype(np.uint8),cv2.COLOR_HSV2BGR)
for n in ['day','night']:
  im=cv2.imread(f'hill-{n}.png'); h,w=im.shape[:2]
  b,g,r=[im[...,i].astype(np.float32) for i in range(3)]
  L=cv2.cvtColor(im,cv2.COLOR_BGR2GRAY).astype(np.float32)
  mu=cv2.blur(L,(11,11)); sd=np.sqrt(np.maximum(cv2.blur(L*L,(11,11))-mu*mu,0))
  hsv0=cv2.cvtColor(im,cv2.COLOR_BGR2HSV).astype(np.float32)
  if n=='day': sky=((b>r+28)&(b>g+5)&(sd<9))|((sd<10)&(hsv0[...,1]<55)&(L>150))
  else:        sky=((b>r+8)&(sd<9)&(L<120))
  yy,xx=np.ogrid[:h,:w]; cv2.circle(sky_u:=sky.astype(np.uint8),(342,152),34,1,-1) if n=='night' else None
  sky=(sky_u if n=='night' else sky.astype(np.uint8))
  sky[int(h*0.6):]=0
  sky[int(h*0.2):,int(w*0.962):]=0
  if n=='day':
    cl=((sd<10)&(hsv0[...,1]<55)&(L>150)); cl[:,int(w*0.9):]=False
    sky=(((b>r+28)&(b>g+5)&(sd<9))|cl).astype(np.uint8); sky[int(h*0.6):]=0; sky[int(h*0.2):,int(w*0.962):]=0
  # keep only sky connected to the top band
  nl,lab=cv2.connectedComponents(sky,8); top=set(np.unique(lab[:int(h*0.25)]))-{0}
  sk=np.isin(lab,list(top)).astype(np.float32)
  sk=cv2.morphologyEx(sk,cv2.MORPH_CLOSE,np.ones((9,9),np.uint8))
  sk=cv2.morphologyEx(sk,cv2.MORPH_OPEN,np.ones((3,3),np.uint8))
  a=1-cv2.GaussianBlur(sk,(0,0),1.6)
  # soften the city horizon: haze the skyline band so it settles into the page
  hz=np.ones((h,w),np.float32); y0,y1=int(h*0.40),int(h*0.56)
  ramp=np.clip((np.arange(h)-y0)/(y1-y0),0,1)[:,None]; band=(np.arange(h)[:,None]>=y0-int(h*.12))&(np.arange(h)[:,None]<y1)
  hz=np.broadcast_to(np.where(band,0.6+0.4*ramp,1),(h,w)).copy(); hz[:,int(w*0.9):]=1
  a=a*hz
  topf=np.clip((np.arange(h)-h*0.31)/(h*0.14),0,1)[:,None]**1.4
  a=a*topf
  # drop floating cloud scraps in the upper sky: small, smooth components
  up=(a>0.5).astype(np.uint8); up[int(h*0.45):]=0
  nl,lab,st,_=cv2.connectedComponentsWithStats(up,8)
  for i in range(1,nl):
    if st[i,4]<4000 and sd[lab==i].mean()<14: a[lab==i]=0
  a=cv2.erode(a,np.ones((3,3),np.uint8))
  up2=cv2.erode(a,np.ones((5,5),np.uint8)); a[:int(h*0.3)]=up2[:int(h*0.3)]
  # bottom stays solid; the top canopy keeps its own alpha
  img=autumn(im,np.ones((h,w),np.float32))
  # despill the sky colour from soft edges
  e=(a>0.02)&(a<0.98); e=cv2.dilate(e.astype(np.uint8),np.ones((5,5),np.uint8))>0
  fb,fg_,fr=[img[...,i].astype(np.float32) for i in range(3)]
  fb=np.where(e,np.minimum(fb,fr*0.95),fb); fg_=np.where(e,np.minimum(fg_,np.maximum(fr*1.05,fb)),fg_); img=np.dstack([fb,fg_,fr]).clip(0,255).astype(np.uint8)
  if n=='day':
    x=img.astype(np.float32)/255; x=x*np.array([0.93,0.98,1.05]); x=np.clip(x,0,1)  # golden hour
    x=0.5*x+0.5*np.power(x,1.12); img=(x*255).astype(np.uint8)
  out=np.dstack([img,(np.clip(a,0,1)*255).astype(np.uint8)])
  cv2.imwrite(f'app/zoom/assets/hill-{n}.webp',out,[cv2.IMWRITE_WEBP_QUALITY,88])
  for tag,col in [('pg',(232,238,243) if n=='day' else (21,13,15)),('mag',(255,0,255))]:
    bg=np.zeros((h,w,3),np.float32);bg[:]=col; al=out[...,3:].astype(np.float32)/255
    cv2.imwrite(f'hill-{n}-{tag}.png',cv2.resize((out[...,:3]*al+bg*(1-al)).astype(np.uint8),(1400,600)))
print('ok')
