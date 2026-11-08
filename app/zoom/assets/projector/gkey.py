import cv2,numpy as np,json
for n,out in [('gday','day'),('gnight','night')]:
  im=cv2.imread(n+'.png'); h,w=im.shape[:2]
  ycc=cv2.cvtColor(im,cv2.COLOR_BGR2YCrCb).astype(np.float32)
  d=np.hypot(ycc[...,1]-25,ycc[...,2]-46)
  a=np.clip((d-28)/(70-28),0,1)
  # tighten: the screen green is also very saturated and bright green-dominant
  b,g,r=[im[...,i].astype(np.float32) for i in range(3)]
  dom=g-np.maximum(r,b)
  a=np.where(dom<60,np.maximum(a,np.clip((60-dom)/40,0,1)),a)
  a=cv2.GaussianBlur(a,(0,0),0.6)
  # despill: pull green down to the other channels where the key bled in
  spill=np.clip(1-a,0,1)
  g2=np.minimum(g,np.maximum(r,b)+ (1-spill)*80)
  near=cv2.dilate((a<0.5).astype(np.uint8),np.ones((7,7),np.uint8))>0
  g2=np.where(a>0.98,g,g2)
  g2=np.where(near,np.minimum(g2,np.maximum(r,b)+8),g2)
  img=np.dstack([b,g2,r]).clip(0,255).astype(np.uint8)
  # geometry: fabric = big bright neutral block
  L=cv2.cvtColor(im,cv2.COLOR_BGR2GRAY).astype(np.float32); hsv=cv2.cvtColor(im,cv2.COLOR_BGR2HSV)
  neu=((hsv[...,1]<(45 if out=='day' else 90))&(L>(95 if out=='day' else 60))).astype(np.uint8)
  band=neu[int(h*.35):int(h*.65)]
  cols=np.where(band.mean(0)>.97)[0]; runs=np.split(cols,np.where(np.diff(cols)>3)[0]+1); c=max(runs,key=len); fx0,fx1=int(c[0]),int(c[-1])
  rows=np.where(neu[:,fx0+(fx1-fx0)//3:fx0+2*(fx1-fx0)//3].mean(1)>.97)[0]; runs=np.split(rows,np.where(np.diff(rows)>3)[0]+1); rr=max(runs,key=len); fy0,fy1=int(rr[0]),int(rr[-1])
  # autumn recolour for leaves (green hue, not hardware, not key)
  H=hsv[...,0].astype(np.float32); S=hsv[...,1].astype(np.float32); V=hsv[...,2].astype(np.float32)
  hsv2=cv2.cvtColor(img,cv2.COLOR_BGR2HSV).astype(np.float32)
  leaf=((hsv2[...,0]>=18)&(hsv2[...,0]<=95)&(hsv2[...,1]>40)&(a>0.05)).astype(np.float32)
  leaf[fy0-int(h*.12):fy1+int(h*.1), fx0-int(w*.03):fx1+int(w*.03)]=0
  leaf=cv2.GaussianBlur(leaf,(0,0),1.0)
  rng=np.random.default_rng(3); nz=cv2.resize(rng.random((h//60+2,w//60+2)).astype(np.float32),(w,h),interpolation=cv2.INTER_CUBIC)
  tgt=np.interp(nz,[0,.3,.55,.8,1],[3,9,15,22,30])
  hsv2[...,0]=hsv2[...,0]*(1-leaf)+tgt*leaf; hsv2[...,1]=np.clip(hsv2[...,1]*(1+.2*leaf),0,255); hsv2[...,2]*=(1-.05*leaf)
  img=cv2.cvtColor(hsv2.astype(np.uint8),cv2.COLOR_HSV2BGR)
  rgba=np.dstack([img,(a*255).astype(np.uint8)])
  cv2.imwrite(out+'-cut.png',rgba)
  cv2.imwrite('app/zoom/assets/projector/screen-'+out+'.webp',rgba,[cv2.IMWRITE_WEBP_QUALITY,90])
  json.dump(dict(w=w,h=h,fabric=[fx0,fy0,fx1,fy1]),open(out+'-geo.json','w'))
  print(out,w,h,'fabric',fx0,fy0,fx1,fy1)
