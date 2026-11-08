import cv2,numpy as np,json,sys
src=sys.argv[1]; outdir=sys.argv[2]
im=cv2.imread(src); h,w=im.shape[:2]
b,g,r=[im[...,i].astype(np.float32) for i in range(3)]
dom=g-np.maximum(r,b)
a=np.clip((90-dom)/60,0,1)            # strong green dominance -> transparent
a=cv2.GaussianBlur(a,(0,0),0.7)
g2=np.where(a<0.999,np.minimum(g,np.maximum(r,b)+6),g)   # despill on edges
day=np.dstack([b,g2,r]).clip(0,255)
# window: bright low-saturation cream block in the middle band
hsv=cv2.cvtColor(im,cv2.COLOR_BGR2HSV); L=cv2.cvtColor(im,cv2.COLOR_BGR2GRAY)
m=((hsv[...,1]<125)&(hsv[...,2]>165)).astype(np.uint8)
cy=int(h*0.585); row=m[cy]; xs=np.where(row)[0]
runs=np.split(xs,np.where(np.diff(xs)>2)[0]+1); c=[q for q in runs if q[0]<w*0.43<q[-1]][0]; wx0,wx1=int(c[0]),int(c[-1])
cx=(wx0+wx1)//2; ys=np.where(m[:,cx])[0]; runs=np.split(ys,np.where(np.diff(ys)>2)[0]+1); rr=[q for q in runs if q[0]<cy<q[-1]][0]; wy0,wy1=int(rr[0]),int(rr[-1])
# plug tip: rightmost opaque pixel
cols=np.where((a>0.5).any(0))[0]; px=int(cols[-1]); py=int(np.mean(np.where(a[:,px-3]>0.5)[0]))
# NIGHT relight: the same transfer the projector's night image has (its roller case goes from about RGB 218,212,209 by day
# to 67,83,104 at night: R x0.31, G x0.39, B x0.50), plus a faint warm spill on the end that faces the projector's bulb
f=day/255.0
xx=np.linspace(0,1,w)[None,:].repeat(h,0)
warm=np.clip((xx-0.55)/0.45,0,1)**2
night=np.empty_like(f)
night[...,2]=f[...,2]*(0.31+0.16*warm)
night[...,1]=f[...,1]*(0.39+0.05*warm)
night[...,0]=f[...,0]*(0.50-0.06*warm)
night=(night.clip(0,1)*255)
for name,img in (('day',day),('night',night)):
  rgba=np.dstack([img.astype(np.uint8),(a*255).astype(np.uint8)])
  cv2.imwrite(f'{outdir}/budgeterry-{name}.webp',rgba,[cv2.IMWRITE_WEBP_QUALITY,90]); cv2.imwrite(f'batt-{name}.png',rgba)
json.dump(dict(w=w,h=h,window=[wx0,wy0,wx1,wy1],plug=[px,py]),open(f'{outdir}/budgeterry-geo.json','w'))
print(w,h,'window',wx0,wy0,wx1,wy1,'plug',px,py)
