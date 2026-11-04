var Sr=(e,n)=>()=>(e&&(n=e(e=0)),n);function lr(e,n){for(var t=[],i=+!n,o=0,r=0;e.length;){var a=ec(e,i||n);if(typeof a=="object"){for(i?(n=null,a.w.length==a.u&&(t.push(n=a.w),r+=a.u)):(t.push(n),a.e=0);!a.l;){var s=lc(e,a,n);s||M(5),n?a.e=a.y:(t.push(s),r+=s.length,Ju(a.w,0,s.length),a.w.set(s,a.w.length-s.length))}o=a.b+a.c*4}else o=a;e=e.subarray(o)}return uc(t,r)}var $u,P,zn,Zu,Wn,Ft,an,Ju,qu,M,ar,Qu,ec,ye,sn,nc,tc,ic,oc,sr,wt,rc,Ut,ac,rn,sc,lc,uc,ur=Sr(()=>{$u=ArrayBuffer,P=Uint8Array,zn=Uint16Array,Zu=Int16Array,Wn=Int32Array,Ft=function(e,n,t){if(P.prototype.slice)return P.prototype.slice.call(e,n,t);(n==null||n<0)&&(n=0),(t==null||t>e.length)&&(t=e.length);var i=new P(t-n);return i.set(e.subarray(n,t)),i},an=function(e,n,t,i){if(P.prototype.fill)return P.prototype.fill.call(e,n,t,i);for((t==null||t<0)&&(t=0),(i==null||i>e.length)&&(i=e.length);t<i;++t)e[t]=n;return e},Ju=function(e,n,t,i){if(P.prototype.copyWithin)return P.prototype.copyWithin.call(e,n,t,i);for((t==null||t<0)&&(t=0),(i==null||i>e.length)&&(i=e.length);t<i;)e[n++]=e[t++]},qu=["invalid zstd data","window size too large (>2046MB)","invalid block type","FSE accuracy too high","match distance too far back","unexpected EOF"],M=function(e,n,t){var i=new Error(n||qu[e]);if(i.code=e,Error.captureStackTrace&&Error.captureStackTrace(i,M),!t)throw i;return i},ar=function(e,n,t){for(var i=0,o=0;i<t;++i)o|=e[n++]<<(i<<3);return o},Qu=function(e,n){return(e[n]|e[n+1]<<8|e[n+2]<<16|e[n+3]<<24)>>>0},ec=function(e,n){var t=e[0]|e[1]<<8|e[2]<<16;if(t==3126568&&e[3]==253){var i=e[4],o=i>>5&1,r=i>>2&1,a=i&3,s=i>>6;i&8&&M(0);var l=6-o,u=a==3?4:a,c=ar(e,l,u);l+=u;var d=s?1<<s:o,f=ar(e,l,d)+(s==1&&256),g=f;if(!o){var m=1<<10+(e[5]>>3);g=m+(m>>3)*(e[5]&7)}g>2145386496&&M(1);var p=new P((n==1?f||g:n?0:g)+12);return p[0]=1,p[4]=4,p[8]=8,{b:l+d,y:0,l:0,d:c,w:n&&n!=1?n:p.subarray(12),e:g,o:new Wn(p.buffer,0,3),u:f,c:r,m:Math.min(131072,g)}}else if((t>>4|e[3]<<20)==25481893)return Qu(e,4)+8;M(0)},ye=function(e){for(var n=0;1<<n<=e;++n);return n-1},sn=function(e,n,t){var i=(n<<3)+4,o=(e[n]&15)+5;o>t&&M(3);for(var r=1<<o,a=r,s=-1,l=-1,u=-1,c=r,d=new $u(512+(r<<2)),f=new Zu(d,0,256),g=new zn(d,0,256),m=new zn(d,512,r),p=512+(r<<1),h=new P(d,p,r),I=new P(d,p+r);s<255&&a>0;){var y=ye(a+1),E=i>>3,b=(1<<y+1)-1,C=(e[E]|e[E+1]<<8|e[E+2]<<16)>>(i&7)&b,S=(1<<y)-1,L=b-a-1,x=C&S;if(x<L?(i+=y,C=x):(i+=y+1,C>S&&(C-=L)),f[++s]=--C,C==-1?(a+=C,h[--c]=s):a-=C,!C)do{var k=i>>3;l=(e[k]|e[k+1]<<8)>>(i&7)&3,i+=2,s+=l}while(l==3)}(s>255||a)&&M(0);for(var _=0,O=(r>>1)+(r>>3)+3,w=r-1,U=0;U<=s;++U){var R=f[U];if(R<1){g[U]=-R;continue}for(u=0;u<R;++u){h[_]=U;do _=_+O&w;while(_>=c)}}for(_&&M(0),u=0;u<r;++u){var A=g[h[u]]++,v=I[u]=o-ye(A);m[u]=(A<<v)-r}return[i+7>>3,{b:o,s:h,n:I,t:m}]},nc=function(e,n){var t=0,i=-1,o=new P(292),r=e[n],a=o.subarray(0,256),s=o.subarray(256,268),l=new zn(o.buffer,268);if(r<128){var u=sn(e,n+1,6),c=u[0],d=u[1];n+=r;var f=c<<3,g=e[n];g||M(0);for(var m=0,p=0,h=d.b,I=h,y=(++n<<3)-8+ye(g);y-=h,!(y<f);){var E=y>>3;if(m+=(e[E]|e[E+1]<<8)>>(y&7)&(1<<h)-1,a[++i]=d.s[m],y-=I,y<f)break;E=y>>3,p+=(e[E]|e[E+1]<<8)>>(y&7)&(1<<I)-1,a[++i]=d.s[p],h=d.n[m],m=d.t[m],I=d.n[p],p=d.t[p]}++i>255&&M(0)}else{for(i=r-127;t<i;t+=2){var b=e[++n];a[t]=b>>4,a[t+1]=b&15}++n}var C=0;for(t=0;t<i;++t){var S=a[t];S>11&&M(0),C+=S&&1<<S-1}var L=ye(C)+1,x=1<<L,k=x-C;for(k&k-1&&M(0),a[i++]=ye(k)+1,t=0;t<i;++t){var S=a[t];++s[a[t]=S&&L+1-S]}var _=new P(x<<1),O=_.subarray(0,x),w=_.subarray(x);for(l[L]=0,t=L;t>0;--t){var U=l[t];an(w,t,U,l[t-1]=U+s[t]*(1<<L-t))}for(l[0]!=x&&M(0),t=0;t<i;++t){var R=a[t];if(R){var A=l[R];an(O,t,A,l[R]=A+(1<<L-R))}}return[n,{n:w,b:L,s:O}]},tc=sn(new P([81,16,99,140,49,198,24,99,12,33,196,24,99,102,102,134,70,146,4]),0,6)[1],ic=sn(new P([33,20,196,24,99,140,33,132,16,66,8,33,132,16,66,8,33,68,68,68,68,68,68,68,68,36,9]),0,6)[1],oc=sn(new P([32,132,16,66,102,70,68,68,68,68,36,73,2]),0,5)[1],sr=function(e,n){for(var t=e.length,i=new Wn(t),o=0;o<t;++o)i[o]=n,n+=1<<e[o];return i},wt=new P(new Wn([0,0,0,0,16843009,50528770,134678020,202050057,269422093]).buffer,0,36),rc=sr(wt,0),Ut=new P(new Wn([0,0,0,0,0,0,0,0,16843009,50528770,117769220,185207048,252579084,16]).buffer,0,53),ac=sr(Ut,3),rn=function(e,n,t){var i=e.length,o=n.length,r=e[i-1],a=(1<<t.b)-1,s=-t.b;r||M(0);for(var l=0,u=t.b,c=(i<<3)-8+ye(r)-u,d=-1;c>s&&d<o;){var f=c>>3,g=(e[f]|e[f+1]<<8|e[f+2]<<16)>>(c&7);l=(l<<u|g)&a,n[++d]=t.s[l],c-=u=t.n[l]}(c!=s||d+1!=o)&&M(0)},sc=function(e,n,t){var i=6,o=n.length,r=o+3>>2,a=r<<1,s=r+a;rn(e.subarray(i,i+=e[0]|e[1]<<8),n.subarray(0,r),t),rn(e.subarray(i,i+=e[2]|e[3]<<8),n.subarray(r,a),t),rn(e.subarray(i,i+=e[4]|e[5]<<8),n.subarray(a,s),t),rn(e.subarray(i),n.subarray(s),t)},lc=function(e,n,t){var i,o=n.b,r=e[o],a=r>>1&3;n.l=r&1;var s=r>>3|e[o+1]<<5|e[o+2]<<13,l=(o+=3)+s;if(a==1)return o>=e.length?void 0:(n.b=o+1,t?(an(t,e[o],n.y,n.y+=s),t):an(new P(s),e[o]));if(!(l>e.length)){if(a==0)return n.b=l,t?(t.set(e.subarray(o,l),n.y),n.y+=s,t):Ft(e,o,l);if(a==2){var u=e[o],c=u&3,d=u>>2&3,f=u>>4,g=0,m=0;c<2?d&1?f|=e[++o]<<4|(d&2&&e[++o]<<12):f=u>>3:(m=d,d<2?(f|=(e[++o]&63)<<4,g=e[o]>>6|e[++o]<<2):d==2?(f|=e[++o]<<4|(e[++o]&3)<<12,g=e[o]>>2|e[++o]<<6):(f|=e[++o]<<4|(e[++o]&63)<<12,g=e[o]>>6|e[++o]<<2|e[++o]<<10)),++o;var p=t?t.subarray(n.y,n.y+n.m):new P(n.m),h=p.length-f;if(c==0)p.set(e.subarray(o,o+=f),h);else if(c==1)an(p,e[o++],h);else{var I=n.h;if(c==2){var y=nc(e,o);g+=o-(o=y[0]),n.h=I=y[1]}else I||M(0);(m?sc:rn)(e.subarray(o,o+=g),p.subarray(h),I)}var E=e[o++];if(E){E==255?E=(e[o++]|e[o++]<<8)+32512:E>127&&(E=E-128<<8|e[o++]);var b=e[o++];b&3&&M(0);for(var C=[ic,oc,tc],S=2;S>-1;--S){var L=b>>(S<<1)+2&3;if(L==1){var x=new P([0,0,e[o++]]);C[S]={s:x.subarray(2,3),n:x.subarray(0,1),t:new zn(x.buffer,0,1),b:0}}else L==2?(i=sn(e,o,9-(S&1)),o=i[0],C[S]=i[1]):L==3&&(n.t||M(0),C[S]=n.t[S])}var k=n.t=C,_=k[0],O=k[1],w=k[2],U=e[l-1];U||M(0);var R=(l<<3)-8+ye(U)-w.b,A=R>>3,v=0,ee=(e[A]|e[A+1]<<8)>>(R&7)&(1<<w.b)-1;A=(R-=O.b)>>3;var me=(e[A]|e[A+1]<<8)>>(R&7)&(1<<O.b)-1;A=(R-=_.b)>>3;var B=(e[A]|e[A+1]<<8)>>(R&7)&(1<<_.b)-1;for(++E;--E;){var ke=w.s[ee],un=w.n[ee],he=_.s[B],ne=_.n[B],Fe=O.s[me],oe=O.n[me];A=(R-=Fe)>>3;var Se=1<<Fe,X=Se+((e[A]|e[A+1]<<8|e[A+2]<<16|e[A+3]<<24)>>>(R&7)&Se-1);A=(R-=Ut[he])>>3;var re=ac[he]+((e[A]|e[A+1]<<8|e[A+2]<<16)>>(R&7)&(1<<Ut[he])-1);A=(R-=wt[ke])>>3;var Ie=rc[ke]+((e[A]|e[A+1]<<8|e[A+2]<<16)>>(R&7)&(1<<wt[ke])-1);if(A=(R-=un)>>3,ee=w.t[ee]+((e[A]|e[A+1]<<8)>>(R&7)&(1<<un)-1),A=(R-=ne)>>3,B=_.t[B]+((e[A]|e[A+1]<<8)>>(R&7)&(1<<ne)-1),A=(R-=oe)>>3,me=O.t[me]+((e[A]|e[A+1]<<8)>>(R&7)&(1<<oe)-1),X>3)n.o[2]=n.o[1],n.o[1]=n.o[0],n.o[0]=X-=3;else{var Ee=X-(Ie!=0);Ee?(X=Ee==3?n.o[0]-1:n.o[Ee],Ee>1&&(n.o[2]=n.o[1]),n.o[1]=n.o[0],n.o[0]=X):X=n.o[0]}for(var S=0;S<Ie;++S)p[v+S]=p[h+S];v+=Ie,h+=Ie;var ae=v-X;if(ae<0){var se=-ae,cn=n.e+ae;se>re&&(se=re);for(var S=0;S<se;++S)p[v+S]=n.w[cn+S];v+=se,re-=se,ae=0}for(var S=0;S<re;++S)p[v+S]=p[ae+S];v+=re}if(v!=h)for(;h<p.length;)p[v++]=p[h++];else v=p.length;t?n.y+=v:p=Ft(p,0,v)}else if(t){if(n.y+=f,h)for(var S=0;S<f;++S)p[S]=p[h+S]}else h&&(p=Ft(p,h));return n.b=l,p}M(2)}},uc=function(e,n){if(e.length==1)return e[0];for(var t=new P(n),i=0,o=0;i<e.length;++i){var r=e[i];t.set(r,o),o+=r.length}return t}});var G=["textData","derivedTextData","textUserLayoutVersion","textExplicitLayoutVersion"],Z=["strokeGeometry","vectorData"],Er={fillStyleId:["styleIdForFill"],strokeStyleId:["styleIdForStrokeFill"],textStyleId:["styleIdForText"],effectStyleId:["styleIdForEffect"],gridStyleId:["styleIdForGrid"],fills:["fillPaints","backgroundPaints","backgroundColor"],strokes:["strokePaints"],effects:["effects"],layoutGrids:["layoutGrids"],exportSettings:["exportSettings"],cornerRadius:["cornerRadius"],independentCorners:["rectangleCornerRadiiIndependent"],topLeftRadius:["rectangleTopLeftCornerRadius","rectangleCornerRadiiIndependent"],topRightRadius:["rectangleTopRightCornerRadius","rectangleCornerRadiiIndependent"],bottomLeftRadius:["rectangleBottomLeftCornerRadius","rectangleCornerRadiiIndependent"],bottomRightRadius:["rectangleBottomRightCornerRadius","rectangleCornerRadiiIndependent"],cornerSmoothing:["cornerSmoothing"],borderTopWeight:["borderTopWeight",...Z],borderRightWeight:["borderRightWeight",...Z],borderBottomWeight:["borderBottomWeight",...Z],borderLeftWeight:["borderLeftWeight",...Z],independentStrokeWeights:["borderStrokeWeightsIndependent","borderTopWeight","borderRightWeight","borderBottomWeight","borderLeftWeight",...Z],strokeWeight:["strokeWeight",...Z],strokeJoin:["strokeJoin",...Z],strokeMiterLimit:["miterLimit",...Z],strokeCap:[...Z],dashPattern:[...Z],text:[...G],styleRuns:[...G],fontSize:["fontSize",...G],fontFamily:["fontName","fontVersion",...G],fontWeight:["semanticWeight",...G],italic:["semanticItalic",...G],lineHeight:["lineHeight",...G],letterSpacing:["letterSpacing","textTracking",...G],textAutoResize:["textAutoResize",...G],textDecorationStyle:["textDecorationStyle",...G],textDecorationThickness:["textDecorationThickness",...G],textDecorationFills:["textDecorationFillPaints",...G],textUnderlineOffset:["textUnderlineOffset",...G],leadingTrim:["leadingTrim",...G],maxLines:["maxLines",...G],fontVariations:["fontVariations",...G],fontFeatures:["fontVariantCommonLigatures","fontVariantContextualLigatures","toggledOnOTFeatures","toggledOffOTFeatures",...G],minWidth:["minSize"],minHeight:["minSize"],maxWidth:["maxSize"],maxHeight:["maxSize"],vectorNetwork:["vectorData","fillGeometry","strokeGeometry"],fillGeometry:["fillGeometry","vectorData"],strokeGeometry:["strokeGeometry","vectorData"],isMask:["mask"],maskType:["maskType"],maskIsOutline:["maskIsOutline"],componentPropertyDefinitions:["componentPropDefs"],componentPropertyReferences:["componentPropRefs"],componentPropertyAssignments:["componentPropAssignments"],variantPropSpecs:["variantPropSpecs"]};function Ar(e=[]){return new Set(e.flatMap(n=>Er[n]??[]))}function zt(e,n){if(!Ar(e.source.editedFields??[]).has(n))return e.source.fig.rawNodeFields[n]}var z=Uint8Array,Ae=Uint16Array,Nr=Int32Array,Wt=new z([0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0,0,0,0]),Kt=new z([0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13,0,0]),Dr=new z([16,17,18,0,8,7,9,6,10,5,11,4,12,3,13,2,14,1,15]),Yt=function(e,n){for(var t=new Ae(31),i=0;i<31;++i)t[i]=n+=1<<e[i-1];for(var o=new Nr(t[30]),i=1;i<30;++i)for(var r=t[i];r<t[i+1];++r)o[r]=r-t[i]<<5|i;return{b:t,r:o}},Xt=Yt(Wt,2),jt=Xt.b,Cr=Xt.r;jt[28]=258,Cr[258]=28;var $t=Yt(Kt,0),Rr=$t.b,zc=$t.r,$n=new Ae(32768);for(D=0;D<32768;++D)te=(D&43690)>>1|(D&21845)<<1,te=(te&52428)>>2|(te&13107)<<2,te=(te&61680)>>4|(te&3855)<<4,$n[D]=((te&65280)>>8|(te&255)<<8)>>1;var te,D,we=(function(e,n,t){for(var i=e.length,o=0,r=new Ae(n);o<i;++o)e[o]&&++r[e[o]-1];var a=new Ae(n);for(o=1;o<n;++o)a[o]=a[o-1]+r[o-1]<<1;var s;if(t){s=new Ae(1<<n);var l=15-n;for(o=0;o<i;++o)if(e[o])for(var u=o<<4|e[o],c=n-e[o],d=a[e[o]-1]++<<c,f=d|(1<<c)-1;d<=f;++d)s[$n[d]>>l]=u}else for(s=new Ae(i),o=0;o<i;++o)e[o]&&(s[o]=$n[a[e[o]-1]++]>>15-e[o]);return s}),Ue=new z(288);for(D=0;D<144;++D)Ue[D]=8;var D;for(D=144;D<256;++D)Ue[D]=9;var D;for(D=256;D<280;++D)Ue[D]=7;var D;for(D=280;D<288;++D)Ue[D]=8;var D,Zt=new z(32);for(D=0;D<32;++D)Zt[D]=5;var D;var Or=we(Ue,9,1);var br=we(Zt,5,1),Yn=function(e){for(var n=e[0],t=1;t<e.length;++t)e[t]>n&&(n=e[t]);return n},j=function(e,n,t){var i=n/8|0;return(e[i]|e[i+1]<<8)>>(n&7)&t},Xn=function(e,n){var t=n/8|0;return(e[t]|e[t+1]<<8|e[t+2]<<16)>>(n&7)},vr=function(e){return(e+7)/8|0},Jn=function(e,n,t){return(n==null||n<0)&&(n=0),(t==null||t>e.length)&&(t=e.length),new z(e.subarray(n,t))};var Pr=["unexpected EOF","invalid block type","invalid length/literal","invalid distance","stream finished","no stream handler",,"no callback","invalid UTF-8 data","extra field too long","date not in range 1980-2099","filename too long","stream finishing","invalid zip data"],H=function(e,n,t){var i=new Error(n||Pr[e]);if(i.code=e,Error.captureStackTrace&&Error.captureStackTrace(i,H),!t)throw i;return i},Lr=function(e,n,t,i){var o=e.length,r=i?i.length:0;if(!o||n.f&&!n.l)return t||new z(0);var a=!t,s=a||n.i!=2,l=n.i;a&&(t=new z(o*3));var u=function(ae){var se=t.length;if(ae>se){var cn=new z(Math.max(se*2,ae));cn.set(t),t=cn}},c=n.f||0,d=n.p||0,f=n.b||0,g=n.l,m=n.d,p=n.m,h=n.n,I=o*8;do{if(!g){c=j(e,d,1);var y=j(e,d+1,3);if(d+=3,y)if(y==1)g=Or,m=br,p=9,h=5;else if(y==2){var S=j(e,d,31)+257,L=j(e,d+10,15)+4,x=S+j(e,d+5,31)+1;d+=14;for(var k=new z(x),_=new z(19),O=0;O<L;++O)_[Dr[O]]=j(e,d+O*3,7);d+=L*3;for(var w=Yn(_),U=(1<<w)-1,R=we(_,w,1),O=0;O<x;){var A=R[j(e,d,U)];d+=A&15;var E=A>>4;if(E<16)k[O++]=E;else{var v=0,ee=0;for(E==16?(ee=3+j(e,d,3),d+=2,v=k[O-1]):E==17?(ee=3+j(e,d,7),d+=3):E==18&&(ee=11+j(e,d,127),d+=7);ee--;)k[O++]=v}}var me=k.subarray(0,S),B=k.subarray(S);p=Yn(me),h=Yn(B),g=we(me,p,1),m=we(B,h,1)}else H(1);else{var E=vr(d)+4,b=e[E-4]|e[E-3]<<8,C=E+b;if(C>o){l&&H(0);break}s&&u(f+b),t.set(e.subarray(E,C),f),n.b=f+=b,n.p=d=C*8,n.f=c;continue}if(d>I){l&&H(0);break}}s&&u(f+131072);for(var ke=(1<<p)-1,un=(1<<h)-1,he=d;;he=d){var v=g[Xn(e,d)&ke],ne=v>>4;if(d+=v&15,d>I){l&&H(0);break}if(v||H(2),ne<256)t[f++]=ne;else if(ne==256){he=d,g=null;break}else{var Fe=ne-254;if(ne>264){var O=ne-257,oe=Wt[O];Fe=j(e,d,(1<<oe)-1)+jt[O],d+=oe}var Se=m[Xn(e,d)&un],X=Se>>4;Se||H(3),d+=Se&15;var B=Rr[X];if(X>3){var oe=Kt[X];B+=Xn(e,d)&(1<<oe)-1,d+=oe}if(d>I){l&&H(0);break}s&&u(f+131072);var re=f+Fe;if(f<B){var Ie=r-B,Ee=Math.min(B,re);for(Ie+f<0&&H(3);f<Ee;++f)t[f]=i[Ie+f]}for(;f<re;++f)t[f]=t[f-B]}}n.l=g,n.p=he,n.b=f,n.f=c,g&&(c=1,n.m=p,n.d=m,n.n=h)}while(!c);return f!=t.length&&a?Jn(t,0,f):t.subarray(0,f)};var Mr=new z(0);var J=function(e,n){return e[n]|e[n+1]<<8},K=function(e,n){return(e[n]|e[n+1]<<8|e[n+2]<<16|e[n+3]<<24)>>>0},jn=function(e,n){return K(e,n)+K(e,n+4)*4294967296};function Be(e,n){return Lr(e,{i:2},n&&n.out,n&&n.dictionary)}var Zn=typeof TextDecoder<"u"&&new TextDecoder,_r=0;try{Zn.decode(Mr,{stream:!0}),_r=1}catch{}var Vr=function(e){for(var n="",t=0;;){var i=e[t++],o=(i>127)+(i>223)+(i>239);if(t+o>e.length)return{s:n,r:Jn(e,t-1)};o?o==3?(i=((i&15)<<18|(e[t++]&63)<<12|(e[t++]&63)<<6|e[t++]&63)-65536,n+=String.fromCharCode(55296|i>>10,56320|i&1023)):o&1?n+=String.fromCharCode((i&31)<<6|e[t++]&63):n+=String.fromCharCode((i&15)<<12|(e[t++]&63)<<6|e[t++]&63):n+=String.fromCharCode(i)}};function xr(e,n){if(n){for(var t="",i=0;i<e.length;i+=16384)t+=String.fromCharCode.apply(null,e.subarray(i,i+16384));return t}else{if(Zn)return Zn.decode(e);var o=Vr(e),r=o.s,t=o.r;return t.length&&H(8),r}}var Gr=function(e,n){return n+30+J(e,n+26)+J(e,n+28)},kr=function(e,n,t){var i=J(e,n+28),o=J(e,n+30),r=xr(e.subarray(n+46,n+46+i),!(J(e,n+8)&2048)),a=n+46+i,s=Fr(e,a,o,t,K(e,n+20),K(e,n+24),K(e,n+42)),l=s[0],u=s[1],c=s[2];return[J(e,n+10),l,u,r,a+o+J(e,n+32),c]},Fr=function(e,n,t,i,o,r,a){var s=o==4294967295,l=r==4294967295,u=a==4294967295,c=n+t,d=s+l+u;if(i&&d){for(;n+4<c;n+=4+J(e,n+2))if(J(e,n)==1)return[s?jn(e,n+4+8*l):o,l?jn(e,n+4):r,u?jn(e,n+4+8*(l+s)):a,1];i<2&&H(13)}return[o,r,a,0]};function Jt(e,n){for(var t={},i=e.length-22;K(e,i)!=101010256;--i)(!i||e.length-i>65558)&&H(13);var o=J(e,i+8);if(!o)return{};var r=K(e,i+16),a=K(e,i-20)==117853008;if(a){var s=K(e,i-12);a=K(e,s)==101075792,a&&(o=K(e,s+32),r=K(e,s+48))}for(var l=n&&n.filter,u=0;u<o;++u){var c=kr(e,r,a),d=c[0],f=c[1],g=c[2],m=c[3],p=c[4],h=c[5],I=Gr(e,h);r=p,(!l||l({name:m,size:f,originalSize:g,compression:d}))&&(d?d==8?t[m]=Be(e.subarray(I,I+f),{out:new z(g)}):H(14,"unknown compression type "+d):t[m]=Jn(e,I,I+f))}return t}function T(e){return`${e.sessionID}:${e.localID}`}var Te={r:0,g:0,b:0,a:1};var He="Inter",qn=4;var Qn=typeof globalThis=="object"&&globalThis||typeof window=="object"&&window||typeof self=="object"&&self||typeof global=="object"&&global||(function(){return this})()||Function("return this")();function et(e){return typeof Qn.Buffer<"u"&&Qn.Buffer.isBuffer(e)}function nt(e){if(!e||typeof e!="object")return!1;let n=Object.getPrototypeOf(e);return n===null||n===Object.prototype||Object.getPrototypeOf(n)===null?Object.prototype.toString.call(e)==="[object Object]":!1}function tt(e){return Object.getOwnPropertySymbols(e).filter(n=>Object.prototype.propertyIsEnumerable.call(e,n))}function it(e){return e==null?e===void 0?"[object Undefined]":"[object Null]":Object.prototype.toString.call(e)}var qt="[object RegExp]",Qt="[object String]",ei="[object Number]",ni="[object Boolean]",ot="[object Arguments]",ti="[object Symbol]",ii="[object Date]",oi="[object Map]",ri="[object Set]",ai="[object Array]",si="[object Function]",li="[object ArrayBuffer]",dn="[object Object]",ui="[object Error]",ci="[object DataView]",di="[object Uint8Array]",fi="[object Uint8ClampedArray]",gi="[object Uint16Array]",pi="[object Uint32Array]",mi="[object BigUint64Array]",hi="[object Int8Array]",Ii="[object Int16Array]",Ti="[object Int32Array]",yi="[object BigInt64Array]",Si="[object Float32Array]",Ei="[object Float64Array]";function Ai(e,n){return e===n||Number.isNaN(e)&&Number.isNaN(n)}function Ni(e,n,t){return ze(e,n,void 0,void 0,void 0,void 0,t)}function ze(e,n,t,i,o,r,a){let s=a(e,n,t,i,o,r);if(s!==void 0)return s;if(typeof e==typeof n)switch(typeof e){case"bigint":case"string":case"boolean":case"symbol":case"undefined":return e===n;case"number":return e===n||Object.is(e,n);case"function":return e===n;case"object":return We(e,n,r,a)}return We(e,n,r,a)}function We(e,n,t,i){if(Object.is(e,n))return!0;let o=it(e),r=it(n);if(o===ot&&(o=dn),r===ot&&(r=dn),o!==r)return!1;switch(o){case Qt:return e.toString()===n.toString();case ei:{let l=e.valueOf(),u=n.valueOf();return Ai(l,u)}case ni:case ii:case ti:return Object.is(e.valueOf(),n.valueOf());case qt:return e.source===n.source&&e.flags===n.flags;case si:return e===n}t=t??new Map;let a=t.get(e),s=t.get(n);if(a!=null&&s!=null)return a===n;t.set(e,n),t.set(n,e);try{switch(o){case oi:{if(e.size!==n.size)return!1;for(let[l,u]of e.entries())if(!n.has(l)||!ze(u,n.get(l),l,e,n,t,i))return!1;return!0}case ri:{if(e.size!==n.size)return!1;let l=Array.from(e.values()),u=Array.from(n.values());for(let c=0;c<l.length;c++){let d=l[c],f=u.findIndex(g=>ze(d,g,void 0,e,n,t,i));if(f===-1)return!1;u.splice(f,1)}return!0}case ai:case di:case fi:case gi:case pi:case mi:case hi:case Ii:case Ti:case yi:case Si:case Ei:{if(et(e)!==et(n)||e.length!==n.length)return!1;for(let l=0;l<e.length;l++)if(!ze(e[l],n[l],l,e,n,t,i))return!1;return!0}case li:return e.byteLength!==n.byteLength?!1:We(new Uint8Array(e),new Uint8Array(n),t,i);case ci:return e.byteLength!==n.byteLength||e.byteOffset!==n.byteOffset?!1:We(new Uint8Array(e),new Uint8Array(n),t,i);case ui:return e.name===n.name&&e.message===n.message;case dn:{if(!(We(e.constructor,n.constructor,t,i)||nt(e)&&nt(n)))return!1;let u=[...Object.keys(e),...tt(e)],c=[...Object.keys(n),...tt(n)];if(u.length!==c.length)return!1;for(let d=0;d<u.length;d++){let f=u[d],g=e[f];if(!Object.hasOwn(n,f))return!1;let m=n[f];if(!ze(g,m,f,e,n,t,i))return!1}return!0}default:return!1}}finally{t.delete(e),t.delete(n)}}function Di(){}function q(e,n){return Ni(e,n,Di)}function rt(e){return e!=null}function at(){return{format:null,id:null,orderKey:null,editedFields:[],fig:{rawSize:null,rawTransform:null,rawNodeFields:{},layout:null,symbolOverrides:[],componentPropAssignments:[],derivedSymbolData:[],derivedSymbolDataLayoutVersion:null,uniformScaleFactor:null}}}function pn(e,n,t={}){return{id:e(),type:n,name:n.charAt(0)+n.slice(1).toLowerCase(),parentId:null,childIds:[],x:0,y:0,width:100,height:100,rotation:0,source:at(),figmaDerivedLayout:null,fills:n==="TEXT"?[{type:"SOLID",color:Te,opacity:1,visible:!0}]:[],strokes:[],effects:[],layoutGrids:[],fillStyleId:null,strokeStyleId:null,textStyleId:null,effectStyleId:null,gridStyleId:null,sharedStyleType:null,opacity:1,cornerRadius:0,topLeftRadius:0,topRightRadius:0,bottomRightRadius:0,bottomLeftRadius:0,independentCorners:!1,cornerSmoothing:0,visible:!0,locked:!1,clipsContent:!1,text:"",fontSize:14,fontFamily:He,fontWeight:400,italic:!1,textAlignHorizontal:"LEFT",textDirection:"AUTO",textLanguage:null,leadingTrim:"NONE",lineHeight:null,letterSpacing:0,layoutMode:"NONE",layoutDirection:"AUTO",layoutWrap:"NO_WRAP",primaryAxisAlign:"MIN",counterAxisAlign:"MIN",primaryAxisSizing:"FIXED",counterAxisSizing:"FIXED",itemSpacing:0,counterAxisSpacing:0,paddingTop:0,paddingRight:0,paddingBottom:0,paddingLeft:0,blendMode:"PASS_THROUGH",layoutPositioning:"AUTO",layoutGrow:0,layoutAlignSelf:"AUTO",vectorNetwork:null,handleMirroring:"NONE",fillGeometry:[],strokeGeometry:[],arcData:null,textAlignVertical:"TOP",textAutoResize:"NONE",textCase:"ORIGINAL",textDecoration:"NONE",textDecorationStyle:"SOLID",textDecorationThickness:null,textDecorationFills:[],textDecorationSkipInk:!0,textUnderlineOffset:null,maxLines:null,styleRuns:[],fontVariations:[],fontFeatures:[],horizontalConstraint:"MIN",verticalConstraint:"MIN",strokeCap:"NONE",strokeJoin:"MITER",dashPattern:[],borderTopWeight:0,borderRightWeight:0,borderBottomWeight:0,borderLeftWeight:0,independentStrokeWeights:!1,strokeMiterLimit:4,minWidth:null,maxWidth:null,minHeight:null,maxHeight:null,isMask:!1,maskType:"ALPHA",maskIsOutline:!1,gridTemplateColumns:[],gridTemplateRows:[],gridColumnGap:0,gridRowGap:0,gridPosition:null,counterAxisAlignContent:"AUTO",itemReverseZIndex:!1,strokesIncludedInLayout:!1,expanded:!0,textTruncation:"DISABLED",autoRename:!0,pointCount:5,starInnerRadius:.38,componentId:null,overrides:{},componentPropertyDefinitions:[],componentPropertyReferences:[],componentPropertyAssignments:{},componentPropertyValues:{},componentKey:null,sourceLibraryKey:null,publishId:null,overrideKey:null,sharedSymbolVersion:null,publishedVersion:null,isPublishable:!1,isSymbolPublishable:!1,symbolDescription:"",symbolLinks:[],variantPropSpecs:[],boundVariables:{},variableModes:{},exportSettings:[],pluginData:[],pluginRelaunchData:[],internalOnly:!1,flipX:!1,flipY:!1,textPicture:null,figmaDerivedTextGlyphs:null,...t}}var Ci=new Set(["CANVAS","FRAME","GROUP","BOOLEAN_OPERATION","SECTION","COMPONENT","COMPONENT_SET","INSTANCE"]);function mn(e){return{vertices:e.vertices.map(n=>({...n})),segments:e.segments.map(n=>({...n,tangentStart:{...n.tangentStart},tangentEnd:{...n.tangentEnd}})),regions:e.regions.map(n=>({windingRule:n.windingRule,loops:n.loops.map(t=>[...t])}))}}function hn(e){let n={x:0,y:0};return{vertices:e.vertices,segments:e.segments.map(t=>({start:t.start,end:t.end,tangentStart:t.tangentStart??{...n},tangentEnd:t.tangentEnd??{...n}})),regions:e.regions??[]}}function fn(e){let n={...e,color:{...e.color}};return e.gradientStops&&(n.gradientStops=e.gradientStops.map(wr)),e.gradientTransform&&(n.gradientTransform={...e.gradientTransform}),e.imageTransform&&(n.imageTransform={...e.imageTransform}),e.patternSpacing&&(n.patternSpacing={...e.patternSpacing}),e.noiseSize&&(n.noiseSize={...e.noiseSize}),n}function Ri(e){let n={...e,color:{...e.color}};return e.dashPattern&&(n.dashPattern=[...e.dashPattern]),n}function Oi(e){return{...e,color:{...e.color},offset:{...e.offset}}}function bi(e){return{...e,style:{...e.style,fills:e.style.fills?e.style.fills.map(fn):void 0,textDecorationFills:e.style.textDecorationFills?e.style.textDecorationFills.map(fn):void 0,fontVariations:e.style.fontVariations?e.style.fontVariations.map(n=>({...n})):void 0,fontFeatures:e.style.fontFeatures?e.style.fontFeatures.map(n=>({...n})):void 0}}}var gn=new WeakMap;function Y(e,n){return gn.set(n,gn.get(e)??e),n}function In(e,n){return e===n?!0:(gn.get(e)??e)===(gn.get(n)??n)}function W(e){return e.map(fn)}function ue(e){return e.map(Ri)}function Ne(e){return e.map(Oi)}function vi(e){return e.map(n=>({...n,color:n.color?{...n.color}:void 0}))}function ce(e){return e.map(bi)}function ie(e){return e.map(n=>({windingRule:n.windingRule,commandsBlob:n.commandsBlob.slice(),fills:n.fills?W(n.fills):void 0}))}function De(e,n,t){let i=ie(e);if(n===1&&t===1)return i;for(let o of i){let r=new DataView(o.commandsBlob.buffer,o.commandsBlob.byteOffset,o.commandsBlob.byteLength),a=0;for(;a<o.commandsBlob.length;){let s=o.commandsBlob[a];if(a+=1,s===0)continue;let l=0;if(s===1||s===2?l=1:s===3?l=2:s===4&&(l=3),l===0||a+l*8>o.commandsBlob.length)break;for(let u=0;u<l;u++)r.setFloat32(a,r.getFloat32(a,!0)*n,!0),r.setFloat32(a+4,r.getFloat32(a+4,!0)*t,!0),a+=8}}return i}function $(e,n){if(e!==void 0)return e.length>0?n(e):[]}function wr(e){return{color:{...e.color},position:e.position}}function le(e){return e?.map(n=>({...n}))??[]}function Ur(e){return e?.map(n=>({...n,variantOptions:n.variantOptions?[...n.variantOptions]:void 0,preferredValues:n.preferredValues?[...n.preferredValues]:void 0}))??[]}function Br(e){return e?e.map(n=>({...n,commandsBlob:new Uint8Array(n.commandsBlob)})):null}function Hr(e){return{startingAngle:e.startingAngle,endingAngle:e.endingAngle,innerRadius:e.innerRadius}}function Ke(e,n,t="deep"){let{id:i,parentId:o,childIds:r,...a}=e;return t==="fig-import"?{...a,...n!==null?{componentId:n}:{},source:at(),boundVariables:{...e.boundVariables},variableModes:{...e.variableModes},overrides:Object.keys(e.overrides).length>0?structuredClone(e.overrides):{},componentPropertyAssignments:{...e.componentPropertyAssignments},componentPropertyValues:{...e.componentPropertyValues}}:{...a,...n!==null?{componentId:n}:{},boundVariables:{...e.boundVariables},variableModes:{...e.variableModes},overrides:Object.keys(e.overrides).length>0?structuredClone(e.overrides):{},fills:$(e.fills,s=>Y(s,W(s))),strokes:$(e.strokes,s=>Y(s,ue(s))),effects:$(e.effects,s=>Y(s,Ne(s))),layoutGrids:$(e.layoutGrids,vi),styleRuns:$(e.styleRuns,s=>Y(s,ce(s))),source:n===null?structuredClone(e.source):at(),dashPattern:$(e.dashPattern,s=>[...s]),fontVariations:$(e.fontVariations,s=>s.map(l=>({...l}))),fontFeatures:$(e.fontFeatures,s=>s.map(l=>({...l}))),textDecorationFills:$(e.textDecorationFills,W),fillGeometry:$(e.fillGeometry,ie),strokeGeometry:$(e.strokeGeometry,ie),gridTemplateColumns:le(e.gridTemplateColumns),gridTemplateRows:le(e.gridTemplateRows),componentPropertyDefinitions:Ur(e.componentPropertyDefinitions),componentPropertyReferences:le(e.componentPropertyReferences),componentPropertyAssignments:{...e.componentPropertyAssignments},symbolLinks:le(e.symbolLinks),variantPropSpecs:le(e.variantPropSpecs),pluginData:le(e.pluginData),pluginRelaunchData:le(e.pluginRelaunchData),exportSettings:le(e.exportSettings),componentPropertyValues:{...e.componentPropertyValues},figmaDerivedLayout:e.figmaDerivedLayout?{...e.figmaDerivedLayout}:null,arcData:e.arcData?Hr(e.arcData):null,vectorNetwork:e.vectorNetwork?mn(e.vectorNetwork):null,textPicture:e.textPicture?new Uint8Array(e.textPicture):null,figmaDerivedTextGlyphs:e.figmaDerivedTextGlyphs?Y(e.figmaDerivedTextGlyphs,Br(e.figmaDerivedTextGlyphs)??[]):null,gridPosition:e.gridPosition?{...e.gridPosition}:null}}function Tn(e){return Math.min(1024,Math.max(.01,e))}var Pi=()=>[1,0,0,0,1,0,0,0,1],zr=(e,n)=>[e[0]*n[0]+e[1]*n[3]+e[2]*n[6],e[0]*n[1]+e[1]*n[4]+e[2]*n[7],e[0]*n[2]+e[1]*n[5]+e[2]*n[8],e[3]*n[0]+e[4]*n[3]+e[5]*n[6],e[3]*n[1]+e[4]*n[4]+e[5]*n[7],e[3]*n[2]+e[4]*n[5]+e[5]*n[8],e[6]*n[0]+e[7]*n[3]+e[8]*n[6],e[6]*n[1]+e[7]*n[4]+e[8]*n[7],e[6]*n[2]+e[7]*n[5]+e[8]*n[8]],Wr=(...e)=>{if(e.length===0)return Pi();let n=e[0].slice();for(let t=1;t<e.length;t++)n=zr(n,e[t]);return n},Kr=(e,n)=>[1,0,e,0,1,n,0,0,1],Yr=(e,n=0,t=0)=>{let i=Math.sin(e),o=Math.cos(e);return[o,-i,i*t+(1-o)*n,i,o,-i*n+(1-o)*t,0,0,1]},Xr=(e,n,t=0,i=0)=>[e,0,t-e*t,0,n,i-n*i,0,0,1],jr=e=>{let n=e[0]*e[4]*e[8]+e[1]*e[5]*e[6]+e[2]*e[3]*e[7]-e[2]*e[4]*e[6]-e[1]*e[3]*e[8]-e[0]*e[5]*e[7];return n?[(e[4]*e[8]-e[5]*e[7])/n,(e[2]*e[7]-e[1]*e[8])/n,(e[1]*e[5]-e[2]*e[4])/n,(e[5]*e[6]-e[3]*e[8])/n,(e[0]*e[8]-e[2]*e[6])/n,(e[2]*e[3]-e[0]*e[5])/n,(e[3]*e[7]-e[4]*e[6])/n,(e[1]*e[6]-e[0]*e[7])/n,(e[0]*e[4]-e[1]*e[3])/n]:null},Li=(e,n)=>{if(n.length%2)throw new Error("mapPoints requires even length [x,y,...].");let t=n.slice();for(let i=0;i<t.length;i+=2){let o=t[i],r=t[i+1],a=e[6]*o+e[7]*r+e[8],s=e[0]*o+e[1]*r+e[2],l=e[3]*o+e[4]*r+e[5];t[i]=s/a,t[i+1]=l/a}return t},$r=(e,n)=>{let t=Li(e,[n.x,n.y]);return{x:t[0],y:t[1]}},V={identity:Pi,multiply:Wr,translated:Kr,rotated:Yr,scaled:Xr,invert:jr,mapPoints:Li,mapPoint:$r};function yn(e,n){let t=[],i=e;for(;i&&(t.unshift(i),!!i.parentId);)i=n.getNode(i.parentId);let o=V.identity();for(let r of t){let a=Sn(r);o=V.multiply(o,a)}return o}function st(e,n){let t=yn(e,n),i=V.mapPoints(t,[0,0]);return{x:i[0],y:i[1]}}function Sn(e){let n=e.rotation*Math.PI/180,t=e.width/2,i=e.height/2,o=e.flipX?-1:1,r=e.flipY?-1:1,a=V.identity();return a=V.multiply(a,V.translated(e.x,e.y)),a=V.multiply(a,V.translated(t,i)),(e.flipX||e.flipY)&&(a=V.multiply(a,V.scaled(o,r))),e.rotation&&(a=V.multiply(a,V.rotated(n,0,0))),a=V.multiply(a,V.translated(-t,-i)),a}var Zr=new Map([{weight:100,names:["thin","hairline","extrathin","ultrathin"]},{weight:200,names:["extralight","ultralight"]},{weight:300,names:["light"]},{weight:400,names:["regular","normal","book","roman","plain"]},{weight:500,names:["medium"]},{weight:600,names:["semibold","demibold"]},{weight:700,names:["bold"]},{weight:800,names:["extrabold","ultrabold"]},{weight:900,names:["black","heavy"]}].flatMap(({names:e,weight:n})=>e.map(t=>[t,n])));function Mi(e){return e.toLowerCase().replace(/italic|oblique/u,"").replace(/[^a-z0-9]+/gu,"")}function _i(e){let n=e??"",t=/(?:italic|oblique)/iu.test(n),i=Mi(n),o=i.match(/(?:^|[^0-9])([1-9]00)(?:[^0-9]|$)/u)?.[1];return{weight:o?Number(o):Zr.get(i)??400,italic:t}}function Ce(e){return _i(e).weight}function Q(e,n){let t={...e};for(let i=0;i<n.length;i++){let o=n[i];delete t[o]}return t}function lt(e,n){let t={},i=Object.keys(e);for(let o=0;o<i.length;o++){let r=i[o],a=e[r];n(a,r)||(t[r]=a)}return t}function ut(e,n,t){let i=e[n].length,o=Object.keys(e.boundVariables).filter(r=>{if(r===n)return!0;if(!r.startsWith(`${n}/`))return!1;let a=Number.parseInt(r.split("/")[1]??"",10);return Number.isNaN(a)||a<0||a>=i});o.length!==0&&(e.boundVariables=Q(e.boundVariables,o),t.boundVariables={...e.boundVariables})}function Vi(e,n){let t=[n.created?e.on("node:created",n.created):null,n.updated?e.on("node:updated",n.updated):null,n.previewUpdated?e.on("node:previewUpdated",n.previewUpdated):null,n.deleted?e.on("node:deleted",n.deleted):null,n.reparented?e.on("node:reparented",n.reparented):null,n.reordered?e.on("node:reordered",n.reordered):null].filter(i=>!!i);return()=>{for(let i of t)i()}}var xi=new Set(["CANVAS","FRAME","GROUP","SECTION","COMPONENT","COMPONENT_SET","INSTANCE"]),Jr=new Set(["COMPONENT","INSTANCE"]);function Gi(e){return e.fills.some(n=>n.visible)||e.strokes.some(n=>n.visible)}function Ye(e,n,t,i){let o=yn(t,i),r=V.invert(o);if(!r)return!1;let[a,s]=V.mapPoints(r,[e,n]);return a>=0&&a<=t.width&&s>=0&&s<=t.height}function qr(e,n,t,i,o,r){return Ye(n,t,i,e)&&(Xe(e,n,t,o,r)||Gi(i))?i:null}function Qr(e,n,t,i,o,r){if(i.type==="GROUP")return Ye(n,t,i,e)?r?Xe(e,n,t,o,r)??i:i:null;let a=Xe(e,n,t,o,r);return a?i.locked?i:a:Ye(n,t,i,e)&&Gi(i)?i:null}function Xe(e,n,t,i,o=!1){let r=e.nodes.get(i);if(!r||r.clipsContent&&!Ye(n,t,r,e))return null;for(let a=r.childIds.length-1;a>=0;a--){let s=r.childIds[a],l=e.nodes.get(s);if(!(!l||l.internalOnly||!l.visible)){if(xi.has(l.type)){if(Jr.has(l.type)&&!o){let c=qr(e,n,t,l,s,o);if(c)return c;continue}let u=Qr(e,n,t,l,s,o);if(u)return u;continue}if(Ye(n,t,l,e))return l}}return null}function ki(e,n,t,i){return Xe(e,n,t,i??e.rootId,!1)}function Fi(e,n,t,i){return Xe(e,n,t,i??e.rootId,!0)}function wi(e,n,t,i,o,r,a){let s=e.nodes.get(i);if(!s)return null;let l=null;for(let u of s.childIds){if(a.has(u))continue;let c=e.nodes.get(u);if(!c||c.internalOnly||!c.visible)continue;let d=o+c.x,f=r+c.y;if(!xi.has(c.type)||n<d||n>d+c.width||t<f||t>f+c.height)continue;l=c;let g=wi(e,n,t,u,d,f,a);g&&(l=g)}return l}function Ui(e,n,t,i,o){return wi(e,n,t,o??e.rootId,0,0,i)}var Bi=()=>({emit(e,...n){for(let t=this.events[e]||[],i=0,o=t.length;i<o;i++)t[i](...n)},events:{},on(e,n){return(this.events[e]||=[]).push(n),()=>{this.events[e]=this.events[e]?.filter(t=>n!==t)}}});var En=["width","height","minWidth","maxWidth","minHeight","maxHeight","fills","strokes","effects","opacity","cornerRadius","topLeftRadius","topRightRadius","bottomRightRadius","bottomLeftRadius","independentCorners","layoutMode","layoutDirection","layoutWrap","primaryAxisAlign","counterAxisAlign","primaryAxisSizing","counterAxisSizing","itemSpacing","counterAxisSpacing","paddingTop","paddingRight","paddingBottom","paddingLeft","gridTemplateColumns","gridTemplateRows","gridColumnGap","gridRowGap","gridPosition","clipsContent","independentStrokeWeights","borderTopWeight","borderRightWeight","borderBottomWeight","borderLeftWeight","boundVariables","variableModes"];function de(e,n,t){e[n]=t}function je(e,n,t){if(t==="fills")de(e,t,W(n.fills));else if(t==="strokes")de(e,t,ue(n.strokes));else if(t==="effects")de(e,t,Ne(n.effects));else if(t==="styleRuns")de(e,t,ce(n.styleRuns));else if(t==="boundVariables")de(e,t,{...n.boundVariables});else if(t==="variableModes")de(e,t,{...n.variableModes});else if(t==="gridPosition")de(e,t,n.gridPosition?{...n.gridPosition}:null);else{let i=n[t];de(e,t,Array.isArray(i)?structuredClone(i):i)}}function $e(e,n,t,i="deep"){let o=e.nodes.get(n);if(o)for(let r of o.childIds){let a=e.nodes.get(r);if(!a)continue;let s=e.createNode(a.type,t,Ke(a,r,i));a.childIds.length>0&&$e(e,r,s.id,i)}}function Ki(e,n,t,i){let o=e.nodes.get(n),r=e.nodes.get(t);if(!o||!r)return;let a=new Map;for(let l of r.childIds){let u=e.nodes.get(l);if(!u)continue;let c=i[`${u.id}:sourceComponentId`],d=typeof c=="string"?c:u.componentId;d&&a.set(d,u)}for(let l of o.childIds)if(!a.has(l)){let u=e.nodes.get(l);if(!u)continue;let c=e.createNode(u.type,t,Ke(u,l));u.childIds.length>0&&$e(e,l,c.id),a.set(l,c)}for(let l of o.childIds){let u=e.nodes.get(l),c=a.get(l);if(!(!u||!c)){for(let d of En)`${c.id}:${d}`in i||je(c,u,d);for(let d of["name","text","fontSize","fontWeight","fontFamily","textDirection"])`${c.id}:${d}`in i||je(c,u,d);u.childIds.length>0&&!(`${c.id}:componentId`in i)&&Ki(e,l,c.id,i)}}let s=o.childIds;r.childIds.sort((l,u)=>{let c=e.nodes.get(l),d=e.nodes.get(u),f=c?i[`${c.id}:sourceComponentId`]:void 0,g=d?i[`${d.id}:sourceComponentId`]:void 0,m=typeof f=="string"?f:c?.componentId,p=typeof g=="string"?g:d?.componentId;return(m?s.indexOf(m):-1)-(p?s.indexOf(p):-1)})}function Ze(e){let n={};for(let t of En)je(n,e,t);return n}function ea(e,n,t,i={}){let o=e.nodes.get(n);if(o?.type!=="COMPONENT")return null;let r={...Ze(o),name:o.name,componentId:n},a=e.createNode("INSTANCE",t,{...r,...i});return $e(e,o.id,a.id),a}function na(e,n,t,i="deep"){let o=e.nodes.get(n),r=e.nodes.get(t);!o||!r||o.type!=="INSTANCE"||$e(e,t,n,i)}function ta(e,n,t){let i=e.nodes.get(n),o=e.nodes.get(t);if(!i||o?.type!=="COMPONENT"||i.type!=="INSTANCE")return;let r=i.componentId?e.nodes.get(i.componentId):void 0,a={componentId:t};for(let l of En)l in i.overrides||je(a,o,l);(!r||i.name===r.name)&&(a.name=o.name);let s=Array.from(i.childIds);for(let l of s)e.deleteNode(l);e.updateNode(n,a),$e(e,t,n)}function ia(e,n){let t=e.nodes.get(n);if(t?.type==="COMPONENT")for(let i of Yi(e,n)){for(let o of En)o in i.overrides||je(i,t,o);Ki(e,t.id,i.id,i.overrides)}}function oa(e,n){let t=e.nodes.get(n);t?.type==="INSTANCE"&&(t.componentId&&e.instanceIndex.get(t.componentId)?.delete(n),t.type="FRAME",t.componentId=null,t.overrides={})}function ra(e,n){let t=e.nodes.get(n);if(t?.componentId)return e.nodes.get(t.componentId)}function Yi(e,n){let t=e.instanceIndex.get(n);if(!t)return[];let i=[];for(let o of t){let r=e.nodes.get(o);r&&i.push(r)}return i}var aa=new Set(["fontFamily","fontWeight","italic","fontSize","lineHeight","letterSpacing","textDecoration","textCase","fontFeatures"]);function Xi(e,n){let t={...n};return"fills"in n&&!("fillStyleId"in n)&&e.fillStyleId&&(t.fillStyleId=null),"strokes"in n&&!("strokeStyleId"in n)&&e.strokeStyleId&&(t.strokeStyleId=null),"effects"in n&&!("effectStyleId"in n)&&e.effectStyleId&&(t.effectStyleId=null),"layoutGrids"in n&&!("gridStyleId"in n)&&e.gridStyleId&&(t.gridStyleId=null),Object.keys(n).some(i=>aa.has(i))&&!("textStyleId"in n)&&e.textStyleId&&(t.textStyleId=null),t}var ct=new Set(["text","fontSize","fontFamily","fontWeight","italic","textAlignHorizontal","textDirection","textAlignVertical","lineHeight","letterSpacing","textDecoration","textCase","styleRuns","fills","width","height"]),dt=new Set(["text","fontSize","fontFamily","fontWeight","italic","textDirection","lineHeight","letterSpacing","textCase","styleRuns"]),sa=new Set(["x","y","width","height","rotation","parentId","childIds","layoutMode","layoutDirection","layoutWrap","primaryAxisSizing","counterAxisSizing","itemSpacing","counterAxisSpacing","paddingTop","paddingRight","paddingBottom","paddingLeft","layoutGrow","layoutAlignSelf","layoutPositioning","minWidth","maxWidth","minHeight","maxHeight","visible","text","fontSize","lineHeight","letterSpacing","styleRuns","textAutoResize"]);function la(e,n,t){let i=e.nodes.get(n);if(!i||(t=Object.fromEntries(Object.entries(t).filter(([,r])=>r!==void 0)),Object.keys(t).every(r=>i[r]===t[r])))return null;if(Object.keys(t).some(r=>sa.has(r))&&e.clearAbsPosCache(),i.type==="TEXT"){let r=Object.keys(t).some(s=>ct.has(s));i.textPicture&&r&&(i.textPicture=null);let a=Object.keys(t).some(s=>dt.has(s));i.figmaDerivedTextGlyphs&&a&&(i.figmaDerivedTextGlyphs=null)}let o=t.vectorNetwork?{...t,vectorNetwork:hn(t.vectorNetwork)}:t;return e.positionPreviewVersion++,Object.assign(i,o),o}function ua(e,n){if(n.length===0)return;let t=new Set(e.source.editedFields);for(let i of n)t.add(i);e.source.editedFields=[...t]}function ji(e,n){e.variables.set(n.id,n);let t=e.variableCollections.get(n.collectionId);t&&!t.variableIds.includes(n.id)&&t.variableIds.push(n.id)}function $i(e,n){let t=e.variables.get(n);if(!t)return;e.variables.delete(n);let i=e.variableCollections.get(t.collectionId);i&&(i.variableIds=i.variableIds.filter(o=>o!==n));for(let o of e.nodes.values())Object.values(o.boundVariables).includes(n)&&(o.boundVariables=lt(o.boundVariables,r=>r===n),e.emitter.emit("node:updated",o.id,{boundVariables:{...o.boundVariables}}),pt(e,o.id))}function Zi(e,n){e.variableCollections.set(n.id,n),e.activeMode.has(n.id)||e.activeMode.set(n.id,n.defaultModeId)}function ca(e,n){return n!==void 0?n:e==="COLOR"?{...Te}:e==="FLOAT"?0:e==="BOOLEAN"?!1:""}function da(e,n,t,i,o,r){let a=e.variableCollections.get(o);if(!a)throw new Error(`Collection "${o}" not found`);let s=n(),l=ca(i,r),u={};for(let d of a.modes)u[d.modeId]=structuredClone(l);let c={id:s,name:t,type:i,collectionId:o,valuesByMode:u,description:"",hiddenFromPublishing:!1};return ji(e,c),c}function fa(e,n,t){let i=n(),o=n(),r={id:i,name:t,modes:[{modeId:o,name:"Mode 1"}],defaultModeId:o,variableIds:[]};return Zi(e,r),r}function ga(e,n){let t=e.variableCollections.get(n);if(t)for(let i of Array.from(t.variableIds))$i(e,i);e.variableCollections.delete(n),e.activeMode.delete(n)}function ft(e,n){let t=e.activeMode.get(n);return t||(e.variableCollections.get(n)?.defaultModeId??"")}function gt(e,n,t){let i=e.nodes.get(n);for(;i;){let o=i.variableModes[t];if(o)return o;i=i.parentId?e.nodes.get(i.parentId):void 0}return ft(e,t)}function pa(e,n,t){e.activeMode.set(n,t)}function ma(e,n,t,i,o){let r=e.variableCollections.get(n);if(!r)return;r.modes.push({modeId:t,name:i});let a=o??r.defaultModeId;for(let s of r.variableIds){let l=e.variables.get(s);l&&(l.valuesByMode[t]=structuredClone(l.valuesByMode[a]??Object.values(l.valuesByMode)[0]))}}function ha(e,n,t){let i=e.variableCollections.get(n);if(!(!i||i.modes.length<=1)){i.modes=i.modes.filter(o=>o.modeId!==t),i.defaultModeId===t&&(i.defaultModeId=i.modes[0].modeId);for(let o of i.variableIds){let r=e.variables.get(o);r&&(r.valuesByMode=Q(r.valuesByMode,[t]))}e.activeMode.get(n)===t&&e.activeMode.set(n,i.defaultModeId)}}function Ia(e,n,t,i){let o=e.variableCollections.get(n);if(!o)return;let r=o.modes.find(a=>a.modeId===t);r&&(r.name=i)}function Ta(e,n,t){let i=e.variableCollections.get(n);i&&i.modes.some(o=>o.modeId===t)&&(i.defaultModeId=t)}function Oe(e,n,t,i){if(i?.has(n))return;let o=e.variables.get(n);if(!o)return;let r=e.variableCollections.get(o.collectionId),a=t??ft(e,o.collectionId),s=r?.defaultModeId,l=Object.hasOwn(o.valuesByMode,a)?o.valuesByMode[a]:void 0;if(l===void 0&&s&&Object.hasOwn(o.valuesByMode,s)&&(l=o.valuesByMode[s]),l??=Object.values(o.valuesByMode)[0],l&&typeof l=="object"&&"aliasId"in l){let u=i??new Set;return u.add(n),Oe(e,l.aliasId,a,u)}return l}function ya(e,n){let t=Oe(e,n);if(t&&typeof t=="object"&&"r"in t)return t}function Sa(e,n){let t=Oe(e,n);return typeof t=="number"?t:void 0}function Ea(e,n,t){let i=e.variables.get(t);if(!i)return;let o=Oe(e,t,gt(e,n,i.collectionId));if(o&&typeof o=="object"&&"r"in o)return o}function Aa(e,n,t){let i=e.variables.get(t);if(!i)return;let o=Oe(e,t,gt(e,n,i.collectionId));return typeof o=="number"?o:void 0}function Na(e,n){let t=e.variableCollections.get(n);return t?t.variableIds.map(i=>e.variables.get(i)).filter(i=>i!==void 0):[]}function Da(e,n){return[...e.variables.values()].filter(t=>t.type===n)}var Hi=new Set(["opacity","width","height","cornerRadius","fontSize","letterSpacing","lineHeight","itemSpacing","strokeWeight","paddingLeft","paddingRight","paddingTop","paddingBottom","counterAxisSpacing","topLeftRadius","topRightRadius","bottomLeftRadius","bottomRightRadius","rotation","x","y","minWidth","maxWidth","minHeight","maxHeight","borderTopWeight","borderBottomWeight","borderLeftWeight","borderRightWeight","gridRowGap","gridColumnGap"]),zi=new Set(["fontFamily"]),Wi=new Set(["visible"]);function Ca(e,n,t,i){let o=e.nodes.get(n);if(!o)return;let r=e.variables.get(i);if(!r)throw new Error(`Variable "${i}" not found`);let a=t.match(/^(fills|strokes)\/(\d+)\/color$/);if(a){if(r.type!=="COLOR")throw new Error(`Cannot bind ${r.type} variable to color field "${t}"`);let s=a[1],l=Number.parseInt(a[2],10),u=o[s]?.length??0;if(l>=u)throw new Error(`Index ${l} out of range for ${s} (length ${u})`);let c=a[1];c in o.boundVariables&&(o.boundVariables=Q(o.boundVariables,[c]))}if(Hi.has(t)&&r.type!=="FLOAT")throw new Error(`Cannot bind ${r.type} variable to scalar field "${t}"`);if(zi.has(t)&&r.type!=="STRING")throw new Error(`Cannot bind ${r.type} variable to string field "${t}"`);if(Wi.has(t)&&r.type!=="BOOLEAN")throw new Error(`Cannot bind ${r.type} variable to boolean field "${t}"`);if(!(Hi.has(t)||zi.has(t)||Wi.has(t)||a))throw new Error(`Unknown binding field "${t}"`);o.boundVariables={...o.boundVariables,[t]:i},e.emitter.emit("node:updated",n,{boundVariables:{...o.boundVariables}}),pt(e,n)}function Ra(e,n,t){let i=e.nodes.get(n);i&&t in i.boundVariables&&(i.boundVariables=Q(i.boundVariables,[t]),e.emitter.emit("node:updated",n,{boundVariables:{...i.boundVariables}}),pt(e,n))}function pt(e,n){let t=e.nodes.get(n);if(!t)return;if(t.type==="INSTANCE"){t.overrides.boundVariables=!0;return}let i=t;for(;i.parentId;){let o=e.nodes.get(i.parentId);if(!o)break;if(o.type==="INSTANCE"){o.overrides[`${n}:boundVariables`]=!0;break}i=o}}var Oa=1;function Re(){return`0:${Oa++}`}var mt=class Ji{nodes=new Map;images=new Map;variables=new Map;variableCollections=new Map;activeMode=new Map;rootId;figKiwiVersion=null;figSchemaDeflated=null;documentColorSpace="display-p3";emitter=Bi();absPosCache=new Map;previewMutationDepth=0;sourceMetadataPreservationDepth=0;layoutMutationDepth=0;positionPreviewVersion=0;instanceIndex=new Map;constructor(){let n=pn(Re,"FRAME",{name:"Document",width:0,height:0});this.rootId=n.id,this.nodes.set(n.id,n),this.addPage("Page 1")}addPage(n){return this.createNode("CANVAS",this.rootId,{name:n,width:0,height:0})}getPages(n=!1){return this.getChildren(this.rootId).filter(t=>t.type==="CANVAS"&&(n||!t.internalOnly))}getAllNodes(){return this.nodes.values()}getNode(n){return this.nodes.get(n)}onNodeEvents(n){return Vi(this.emitter,n)}countDescendants(n){let t=this.nodes.get(n);if(!t)return 0;let i=0,o=[...t.childIds];for(;o.length>0;){let r=o.pop();if(r===void 0)break;i++;let a=this.nodes.get(r);if(a)for(let s of a.childIds)o.push(s)}return i}addVariable(n){ji(this,n)}removeVariable(n){$i(this,n)}addCollection(n){Zi(this,n)}createVariable(n,t,i,o){return da(this,Re,n,t,i,o)}createCollection(n){return fa(this,Re,n)}removeCollection(n){ga(this,n)}getActiveModeId(n){return ft(this,n)}getNodeVariableModeId(n,t){return gt(this,n,t)}setActiveMode(n,t){pa(this,n,t)}addMode(n,t,i,o){ma(this,n,t,i,o)}removeMode(n,t){ha(this,n,t)}renameMode(n,t,i){Ia(this,n,t,i)}setDefaultMode(n,t){Ta(this,n,t)}resolveVariable(n,t,i){return Oe(this,n,t,i)}resolveColorVariable(n){return ya(this,n)}resolveNumberVariable(n){return Sa(this,n)}resolveColorVariableForNode(n,t){return Ea(this,n,t)}resolveNumberVariableForNode(n,t){return Aa(this,n,t)}getVariablesForCollection(n){return Na(this,n)}getVariablesByType(n){return Da(this,n)}bindVariable(n,t,i){Ca(this,n,t,i)}unbindVariable(n,t){Ra(this,n,t)}getChildren(n){let t=this.nodes.get(n);return t?t.childIds.map(i=>this.nodes.get(i)).filter(i=>i!==void 0):[]}isContainer(n){let t=this.nodes.get(n);return t?Ci.has(t.type):!1}isDescendant(n,t){let i=this.nodes.get(n);for(;i;){if(i.id===t)return!0;i=i.parentId?this.nodes.get(i.parentId):void 0}return!1}clearAbsPosCache(){this.absPosCache.clear()}getAbsolutePosition(n){let t=this.absPosCache.get(n);if(t)return t;let i=this.getNode(n);if(!i)return{x:0,y:0};let o=st(i,this);return this.absPosCache.set(n,o),o}getAbsoluteBounds(n){let t=this.getAbsolutePosition(n),i=this.nodes.get(n);return{x:t.x,y:t.y,width:i?.width??0,height:i?.height??0}}generateNodeId(){let n=Re();for(;this.nodes.has(n);)n=Re();return n}registerNode(n,t){if(n.parentId=t,this.nodes.set(n.id,n),n.type==="INSTANCE"&&n.componentId){let i=this.instanceIndex.get(n.componentId);i||(i=new Set,this.instanceIndex.set(n.componentId,i)),i.add(n.id)}return this.emitter.emit("node:created",n),n}createNode(n,t,i={}){let o=pn(()=>this.generateNodeId(),n,i);return this.nodes.get(t)?.childIds.push(o.id),this.registerNode(o,t)}createNodeWithId(n,t,i,o={}){let r=pn(()=>n,t,o);r.id=n;let a=i?this.nodes.get(i):void 0;return a&&!a.childIds.includes(n)&&a.childIds.push(n),this.registerNode(r,i)}static TEXT_PICTURE_KEYS=ct;static GLYPH_AFFECTING_KEYS=dt;static LAYOUT_AFFECTING_KEYS=new Set(["x","y","width","height","rotation","flipX","flipY","layoutMode","layoutDirection","itemSpacing","counterAxisSpacing","paddingLeft","paddingRight","paddingTop","paddingBottom","primaryAxisAlign","counterAxisAlign","counterAxisAlignContent","layoutWrap","primaryAxisSizing","counterAxisSizing","layoutPositioning","layoutGrow","layoutAlignSelf","strokesIncludedInLayout","horizontalConstraint","verticalConstraint","gridTemplateColumns","gridTemplateRows","gridColumnGap","gridRowGap","gridPosition","minWidth","maxWidth","minHeight","maxHeight"]);runPreviewUpdates(n){this.previewMutationDepth++;try{n()}finally{this.previewMutationDepth--}}preserveSourceMetadataDuring(n){this.sourceMetadataPreservationDepth++;try{n()}finally{this.sourceMetadataPreservationDepth--}}withLayoutMutations(n){this.layoutMutationDepth++;try{n()}finally{this.layoutMutationDepth--}}get isApplyingLayout(){return this.layoutMutationDepth>0}updateNodePositionPreview(n,t,i){this.updateNodePreview(n,{x:t,y:i})}updateNodePreview(n,t){let i=la(this,n,t);i&&this.emitter.emit("node:previewUpdated",n,i)}updateNode(n,t){if(this.previewMutationDepth>0){this.updateNodePreview(n,t);return}let i=this.nodes.get(n);if(!i)return;let o=Object.entries(t);if(t=Object.fromEntries(o.filter(([,r])=>r!==void 0)),t=Xi(i,t),o=Object.entries(t),t=Object.fromEntries(o.filter(([,r])=>r!==void 0)),Object.keys(t).some(r=>Ji.LAYOUT_AFFECTING_KEYS.has(r))&&this.absPosCache.clear(),i.type==="INSTANCE"&&"componentId"in t&&t.componentId!==i.componentId&&(i.componentId&&this.instanceIndex.get(i.componentId)?.delete(n),t.componentId)){let r=this.instanceIndex.get(t.componentId);r||(r=new Set,this.instanceIndex.set(t.componentId,r)),r.add(n)}if(i.type==="TEXT"){let r=Object.keys(t).some(s=>ct.has(s));i.textPicture&&r&&(i.textPicture=null);let a=Object.keys(t).some(s=>dt.has(s));i.figmaDerivedTextGlyphs&&a&&(i.figmaDerivedTextGlyphs=null)}this.sourceMetadataPreservationDepth===0&&ua(i,Object.keys(t)),t.vectorNetwork&&(t={...t,vectorNetwork:hn(t.vectorNetwork)}),Object.assign(i,t),t.fills&&ut(i,"fills",t),t.strokes&&ut(i,"strokes",t),this.emitter.emit("node:updated",n,t)}reparentNode(n,t){let i=this.nodes.get(n);if(!i||n===this.rootId||this.isDescendant(t,n))return;let o=i.parentId?this.nodes.get(i.parentId):void 0,r=this.nodes.get(t);if(!r||i.parentId===t)return;let a=i.parentId;this.absPosCache.clear();let s=this.getAbsolutePosition(n),l=this.nodes.get(t),u=t===this.rootId||l?.type==="CANVAS"?{x:0,y:0}:this.getAbsolutePosition(t);o&&(o.childIds=o.childIds.filter(c=>c!==n)),i.parentId=t,r.childIds.push(n),i.x=s.x-u.x,i.y=s.y-u.y,this.emitter.emit("node:reparented",n,a,t)}reorderChild(n,t,i){let o=this.nodes.get(n);if(!o)return;let r=o.parentId?this.nodes.get(o.parentId):void 0,a=this.nodes.get(t);if(!a)return;r&&(r.childIds=r.childIds.filter(l=>l!==n));let s=i;r===a&&s>(r.childIds.includes(n)?r.childIds.length:s),o.parentId=t,s=Math.min(s,a.childIds.length),a.childIds.splice(s,0,n),this.emitter.emit("node:reordered",n,t,s)}insertChildAt(n,t,i){let o=this.getNode(this.getNode(n)?.parentId??"");o&&(o.childIds=o.childIds.filter(s=>s!==n));let r=this.getNode(t);if(!r)return;r.childIds=r.childIds.filter(s=>s!==n),r.childIds.splice(i,0,n);let a=this.getNode(n);a&&(a.parentId=t),this.clearAbsPosCache(),this.emitter.emit("node:reordered",n,t,i)}deleteNode(n){let t=this.nodes.get(n);if(!(!t||n===this.rootId)){if(t.parentId){let i=this.nodes.get(t.parentId);i&&(i.childIds=i.childIds.filter(o=>o!==n))}for(let i of Array.from(t.childIds))this.deleteNode(i);t.type==="INSTANCE"&&t.componentId&&this.instanceIndex.get(t.componentId)?.delete(n),this.nodes.delete(n),this.emitter.emit("node:deleted",n)}}hitTest(n,t,i){return ki(this,n,t,i)}hitTestDeep(n,t,i){return Fi(this,n,t,i)}hitTestFrame(n,t,i,o){return Ui(this,n,t,i,o)}cloneTree(n,t,i={}){let o=this.nodes.get(n);if(!o)return null;let r=Ke(o,null);r.source={...r.source,id:null,orderKey:null};let a=this.createNode(o.type,t,{...r,...i});for(let s of o.childIds)this.cloneTree(s,a.id);return a}createInstance(n,t,i={}){return ea(this,n,t,i)}populateInstanceChildren(n,t,i="deep"){na(this,n,t,i)}swapInstanceComponent(n,t){ta(this,n,t)}syncInstances(n){ia(this,n)}detachInstance(n){oa(this,n)}getMainComponent(n){return ra(this,n)}getInstances(n){return Yi(this,n)}flattenTree(n,t=0){let i=n??this.rootId,o=this.nodes.get(i);if(!o)return[];let r=[];for(let a of o.childIds){let s=this.nodes.get(a);s&&(r.push({node:s,depth:t}),s.childIds.length>0&&r.push(...this.flattenTree(a,t+1)))}return r}};function qi(e){let n={};for(let t of e.split(",").map(i=>i.trim())){let i=t.indexOf("=");i!==-1&&(n[t.slice(0,i).trim()]=t.slice(i+1).trim())}return n}function Nn(e,n){return(e?.glyphs??[]).map(t=>t.commandsBlob===void 0?null:{commandsBlob:n[t.commandsBlob],x:t.position.x,y:t.position.y,fontSize:t.fontSize}).filter(t=>!!t)}var ao=[["fontVariantCommonLigatures","LIGA"],["fontVariantContextualLigatures","CALT"],["fontVariantDiscretionaryLigatures","DLIG"],["fontVariantHistoricalLigatures","HLIG"],["fontVariantOrdinal","ORDN"],["fontVariantSlashedZero","ZERO"]],La=[["fontVariantNumericFigure",{LINING:"LNUM",OLDSTYLE:"ONUM"}],["fontVariantNumericSpacing",{PROPORTIONAL:"PNUM",TABULAR:"TNUM"}],["fontVariantNumericFraction",{DIAGONAL:"FRAC",STACKED:"AFRC"}],["fontVariantCaps",{SMALL:"SMCP",PETITE:"PCAP",ALL_SMALL:["SMCP","C2SC"],ALL_PETITE:["PCAP","C2PC"],UNICASE:"UNIC",TITLING:"TITL"}]],If=Object.fromEntries(ao.map(([e,n])=>[n,e]));function Je(e,n,t){let i=n.toUpperCase();e.some(o=>o.tag===i)||e.push({tag:i,enabled:t})}function It(e){let n=[];for(let[t,i]of ao){let o=e[t];o!==void 0&&Je(n,i,o)}for(let[t,i]of La){let o=i[String(e[t])];if(Array.isArray(o))for(let r of o)Je(n,r,!0);else o&&Je(n,o,!0)}for(let t of e.toggledOnOTFeatures??[])Je(n,t,!0);for(let t of e.toggledOffOTFeatures??[])Je(n,t,!1);return n}function so(e){return String.fromCharCode(e>>24&255,e>>16&255,e>>8&255,e&255)}function Tt(e){let n=[];for(let t of e.fontVariations??[]){if(typeof t.value!="number")continue;let i=typeof t.axisTag=="number"?so(t.axisTag):t.axisName||"";i&&n.push({axis:i,value:t.value})}return n}var Tf=Array.from({length:256},(e,n)=>n.toString(16).padStart(2,"0"));function yt(e){return e?{r:e.r??0,g:e.g??0,b:e.b??0,a:e.a??1}:{...Te}}function Ma(e){return Object.keys(e).sort((n,t)=>Number(n)-Number(t)).map(n=>e[Number(n)]).map(n=>n.toString(16).padStart(2,"0")).join("")}function lo(e){if(e)return{m00:e.m00,m01:e.m01,m02:e.m02,m10:e.m10,m11:e.m11,m12:e.m12}}var ht=null;function Dn(e){ht=e}function _a(e){let n=e.colorVar?.value?.alias;if(!(!n||!ht))return ht(n)??void 0}function uo(e){let n=_a(e);return n?{color:{...n,a:e.color?.a??1},opacity:e.opacity??n.a}:{color:yt(e.color),opacity:e.opacity??1}}function Va(e){let{color:n,opacity:t}=uo(e);return{type:e.type,color:n,opacity:t,visible:e.visible??!0,blendMode:e.blendMode??"NORMAL"}}function xa(e,n){!n.type.startsWith("GRADIENT")||!n.stops||(e.gradientStops=n.stops.map(t=>({color:yt(t.color),position:t.position})),n.transform&&(e.gradientTransform=lo(n.transform)))}function Ga(e,n){if(n.type==="IMAGE"){if(n.image&&typeof n.image=="object"){let t=n.image;typeof t.hash=="object"?e.imageHash=Ma(t.hash):typeof t.hash=="string"&&(e.imageHash=t.hash)}e.imageScaleMode=n.imageScaleMode??"FILL",n.transform&&(e.imageTransform=lo(n.transform))}}function ka(e,n){n.sourceNodeId&&(e.sourceNodeId=T(n.sourceNodeId)),n.scale&&(e.scale=n.scale),n.spacing&&(e.spacing=n.spacing),n.patternSpacing&&(e.patternSpacing=n.patternSpacing),n.patternTileType&&(e.patternTileType=n.patternTileType),n.verticalAlignment&&(e.verticalAlignment=n.verticalAlignment),n.horizontalAlignment&&(e.horizontalAlignment=n.horizontalAlignment),n.noiseType&&(e.noiseType=n.noiseType),n.density!==void 0&&(e.density=n.density),n.noiseSize&&(e.noiseSize=n.noiseSize),n.customEffectId?.guid&&(e.customEffectId=T(n.customEffectId.guid))}function fe(e){return e?e.map(n=>{let t=Va(n);return xa(t,n),Ga(t,n),ka(t,n),t}):[]}function Cn(e,n,t,i,o,r){if(!e)return[];let a="CENTER";return t==="INSIDE"?a="INSIDE":t==="OUTSIDE"&&(a="OUTSIDE"),e.map(s=>{let{color:l,opacity:u}=uo(s);return{color:l,weight:n??1,opacity:u,visible:s.visible??!0,align:a,cap:i??"NONE",join:o??"MITER",dashPattern:r??[]}})}function Rn(e){return e?e.map(n=>({type:n.type,color:yt(n.color),offset:n.offset??{x:0,y:0},radius:n.radius??0,spread:n.spread??0,visible:n.visible??!0,blendMode:n.blendMode??"NORMAL",showShadowBehindNode:n.showShadowBehindNode??!0})):[]}var co={cornerRadius:"CORNER_RADIUS",topLeftRadius:"RECTANGLE_TOP_LEFT_CORNER_RADIUS",topRightRadius:"RECTANGLE_TOP_RIGHT_CORNER_RADIUS",bottomLeftRadius:"RECTANGLE_BOTTOM_LEFT_CORNER_RADIUS",bottomRightRadius:"RECTANGLE_BOTTOM_RIGHT_CORNER_RADIUS",strokeWeight:"STROKE_WEIGHT",borderTopWeight:"BORDER_TOP_WEIGHT",borderBottomWeight:"BORDER_BOTTOM_WEIGHT",borderLeftWeight:"BORDER_LEFT_WEIGHT",borderRightWeight:"BORDER_RIGHT_WEIGHT",itemSpacing:"STACK_SPACING",paddingLeft:"STACK_PADDING_LEFT",paddingTop:"STACK_PADDING_TOP",paddingRight:"STACK_PADDING_RIGHT",paddingBottom:"STACK_PADDING_BOTTOM",counterAxisSpacing:"STACK_COUNTER_SPACING",gridRowGap:"GRID_ROW_GAP",gridColumnGap:"GRID_COLUMN_GAP",visible:"VISIBLE",opacity:"OPACITY",width:"WIDTH",height:"HEIGHT",minWidth:"MIN_WIDTH",maxWidth:"MAX_WIDTH",minHeight:"MIN_HEIGHT",maxHeight:"MAX_HEIGHT",x:"X_POSITION",y:"Y_POSITION",rotation:"ROTATION",fontSize:"FONT_SIZE",letterSpacing:"LETTER_SPACING",lineHeight:"LINE_HEIGHT",fontFamily:"FONT_FAMILY"},On=Object.fromEntries(Object.entries(co).map(([e,n])=>[n,e]));function bn(e){let n=e.variableField?On[e.variableField]:void 0,t=e.variableData?.value?.alias?.guid;return n&&t?{field:n,variableId:T(t)}:void 0}var Fa=new Set(["cornerRadius","topLeftRadius","topRightRadius","bottomLeftRadius","bottomRightRadius","strokeWeight","borderTopWeight","borderBottomWeight","borderLeftWeight","borderRightWeight","itemSpacing","paddingLeft","paddingTop","paddingRight","paddingBottom","counterAxisSpacing","gridRowGap","gridColumnGap","width","height","minWidth","maxWidth","minHeight","maxHeight","x","y","rotation","fontSize","letterSpacing","lineHeight"]);function St(e,n){return e==="opacity"?{opacity:Math.max(0,Math.min(1,n/100))}:Fa.has(e)?{[e]:n}:void 0}var fo="boundVariables",go="exportSettings",wa={PNG:"png",JPEG:"jpg",SVG:"svg",PDF:"pdf"};function Ua(e){if(!e)return{};try{let n=JSON.parse(e);return!n||typeof n!="object"||Array.isArray(n)?{}:Object.fromEntries(Object.entries(n).filter(t=>typeof t[0]=="string"&&typeof t[1]=="string"))}catch{return{}}}function vn(e){let n=Ua(Le(e,fo));for(let t of e.variableConsumptionMap?.entries??[]){let i=bn(t);i&&(n[i.field]=i.variableId)}return e.fillPaints?.forEach((t,i)=>{let o=t.colorVariableBinding?.variableID??t.colorVar?.value?.alias?.guid;o&&(n[`fills/${i}/color`]=T(o))}),e.strokePaints?.forEach((t,i)=>{let o=t.colorVariableBinding?.variableID??t.colorVar?.value?.alias?.guid;o&&(n[`strokes/${i}/color`]=T(o))}),n}function Ba(e){return e==="png"||e==="jpg"||e==="webp"||e==="svg"||e==="pdf"}function Ha(e){if(!e)return null;try{let n=JSON.parse(e);if(!Array.isArray(n))return null;let t=n.flatMap(i=>{if(!i||typeof i!="object"||Array.isArray(i))return[];let o=i.scale,r=i.format;return typeof o!="number"||!Number.isFinite(o)||!Ba(r)?[]:[{scale:Tn(o),format:r}]});return t.length===n.length?t:null}catch{return null}}function za(e){return typeof e=="string"?wa[e]??null:e===0?"png":e===1?"jpg":e===2?"svg":e===3?"pdf":null}function Wa(e){if(!e||typeof e!="object"||Array.isArray(e))return 1;let n=e.type;if(n!=="CONTENT_SCALE"&&n!==0)return 1;let t=e.value;return typeof t=="number"&&Number.isFinite(t)?Tn(t):1}function po(e){let n=Ha(Le(e,go));return n||(e.exportSettings??[]).flatMap(t=>{if(!t||typeof t!="object"||Array.isArray(t))return[];let i=za(t.imageType);return i?[{scale:Wa(t.constraint),format:i}]:[]})}function mo(e){return(e.pluginData??[]).map(n=>({pluginId:n.pluginID,key:n.key,value:n.value}))}function Le(e,n){return e.pluginData?.find(t=>t.pluginID==="open-pencil"&&t.key===n)?.value??null}function ho(e){return(e.pluginRelaunchData??[]).map(n=>({pluginId:n.pluginID,command:n.command,message:n.message,isDeleted:n.isDeleted}))}function en(e){switch(e){case"UNDERLINE":return"UNDERLINE";case"STRIKETHROUGH":return"STRIKETHROUGH";default:return"NONE"}}function Me(e,n){return e?e.units==="PIXELS"?e.value:e.units==="PERCENT"?e.value/100*(n??14):e.units==="RAW"?e.value*(n??14):null:null}function _e(e,n){return e?e.units==="PIXELS"?e.value:e.units==="PERCENT"?e.value/100*(n??14):e.value:0}function Ka(e,n){let t=n.textDecoration;if(t&&(e.textDecoration=en(t)),n.textDecorationStyle&&(e.textDecorationStyle=n.textDecorationStyle),n.textDecorationThickness&&(e.textDecorationThickness=n.textDecorationThickness.value??null),n.textDecorationSkipInk!==void 0&&(e.textDecorationSkipInk=n.textDecorationSkipInk),n.textUnderlineOffset&&(e.textUnderlineOffset=n.textUnderlineOffset.value??null),n.textDecorationFillPaints){let i=fe(n.textDecorationFillPaints);i.length>0&&(e.textDecorationFills=i)}}function Ya(e,n){let t={};e.fontName&&(t.fontFamily=e.fontName.family,t.fontWeight=Ce(e.fontName.style),t.italic=e.fontName.style.toLowerCase().includes("italic")),e.fontSize!==void 0&&(t.fontSize=e.fontSize);let i=Tt(e);i.length>0&&(t.fontVariations=i);let o=It(e);if(o.length>0&&(t.fontFeatures=o),e.letterSpacing&&(t.letterSpacing=_e(e.letterSpacing,e.fontSize??n)),e.lineHeight){let r=Me(e.lineHeight,e.fontSize??n);r!=null&&(t.lineHeight=r)}if(Ka(t,e),e.fillPaints){let r=fe(e.fillPaints);r.length>0&&(t.fills=r)}return t}function Xa(e,n){let t=new Map;for(let i of e){let o=i.styleID;if(o===void 0)continue;let r=Ya(i,n);Object.keys(r).length>0&&t.set(o,r)}return t}function ja(e,n){let t=[],i=e[0],o=0;for(let r=1;r<=e.length;r++)if(r===e.length||e[r]!==i){if(i!==0){let a=n.get(i);a&&t.push({start:o,length:r-o,style:a})}r<e.length&&(i=e[r],o=r)}return t}function Pn(e){let n=e.textData;if(!n?.characterStyleIDs||!n.styleOverrideTable)return[];let t=n.characterStyleIDs;if(t.length===0||n.styleOverrideTable.length===0)return[];let i=Xa(n.styleOverrideTable,e.fontSize);return i.size===0?[]:ja(t,i)}function Io(e,n){let t=new DataView(e.buffer,e.byteOffset,e.byteLength),i=0,o=t.getUint32(i,!0);i+=4;let r=t.getUint32(i,!0);i+=4;let a=t.getUint32(i,!0);i+=4;let s=new Map;for(let d of n??[])s.set(d.styleID,d);let l=[];for(let d=0;d<o;d++){let f=t.getUint32(i,!0);i+=4;let g=t.getFloat32(i,!0);i+=4;let m=t.getFloat32(i,!0);i+=4,l.push({x:g,y:m,handleMirroring:s.get(f)?.handleMirroring??"NONE"})}let u=[];for(let d=0;d<r;d++){i+=4;let f=t.getUint32(i,!0);i+=4;let g=t.getFloat32(i,!0);i+=4;let m=t.getFloat32(i,!0);i+=4;let p=t.getUint32(i,!0);i+=4;let h=t.getFloat32(i,!0);i+=4;let I=t.getFloat32(i,!0);i+=4,u.push({start:f,end:p,tangentStart:{x:g,y:m},tangentEnd:{x:h,y:I}})}let c=[];for(let d=0;d<a;d++){let f=t.getUint32(i,!0)===0?"EVENODD":"NONZERO";i+=4;let g=t.getUint32(i,!0);i+=4;let m=[];for(let p=0;p<g;p++){let h=t.getUint32(i,!0);i+=4;let I=[];for(let y=0;y<h;y++)I.push(t.getUint32(i,!0)),i+=4;m.push(I)}c.push({windingRule:f,loops:m})}return{vertices:l,segments:u,regions:c}}function Ln(e,n){let t=n?.regions??[];return e.length===t.length?e.map((i,o)=>({...i,windingRule:t[o].windingRule})):e.length===1&&t.length>0&&t.every(i=>i.windingRule===t[0].windingRule)?[{...e[0],windingRule:t[0].windingRule}]:e}function To(e,n){let t=e.vectorData;if(t?.vectorNetworkBlob===void 0)return null;let i=t.vectorNetworkBlob;if(i<0||i>=n.length)return null;try{let o=Io(n[i],t.styleOverrideTable),r=t.normalizedSize,a=e.size?.x??0,s=e.size?.y??0;if(r&&a>0&&s>0&&(r.x!==a||r.y!==s)){let l=a/r.x,u=s/r.y;for(let c of o.vertices)c.x*=l,c.y*=u;for(let c of o.segments)c.tangentStart={x:c.tangentStart.x*l,y:c.tangentStart.y*u},c.tangentEnd={x:c.tangentEnd.x*l,y:c.tangentEnd.y*u}}return o}catch{return null}}function yo(e){let n=new Map;for(let t of e??[])t.fillPaints&&t.fillPaints.length>0&&n.set(t.styleID,fe(t.fillPaints));return n}function Mn(e){let n=e.vectorData;return yo(n?.styleOverrideTable)}function ve(e,n,t){if(!e||e.length===0)return[];let i=[];for(let o of e){if(o.commandsBlob===void 0||o.commandsBlob<0||o.commandsBlob>=n.length)continue;let r=n[o.commandsBlob];if(r.length===0)continue;let a=o.styleID?t?.get(o.styleID):void 0;i.push({windingRule:o.windingRule==="EVENODD"?"EVENODD":"NONZERO",commandsBlob:r,fills:a&&a.length>0?W(a):void 0})}return i}function $a(e){let n={},t=e.variableModeBySetMap;for(let i of t?.entries??[]){let o=i.variableSetID?.guid,r=i.variableModeID;!o||!r||(n[T(o)]=T(r))}return n}var Za={DOCUMENT:"DOCUMENT",VARIABLE:"VARIABLE",CANVAS:"CANVAS",FRAME:"FRAME",RECTANGLE:"RECTANGLE",ROUNDED_RECTANGLE:"ROUNDED_RECTANGLE",ELLIPSE:"ELLIPSE",TEXT:"TEXT",LINE:"LINE",STAR:"STAR",REGULAR_POLYGON:"POLYGON",VECTOR:"VECTOR",BOOLEAN_OPERATION:"BOOLEAN_OPERATION",GROUP:"GROUP",SECTION:"SECTION",COMPONENT:"COMPONENT",COMPONENT_SET:"COMPONENT_SET",INSTANCE:"INSTANCE",SYMBOL:"COMPONENT",CONNECTOR:"CONNECTOR",SHAPE_WITH_TEXT:"SHAPE_WITH_TEXT"};function Ja(e){return e?Za[e]??"RECTANGLE":"RECTANGLE"}function qa(e){if(e.type!=="BOOLEAN_OPERATION")return;let n=e.booleanOperation;switch(n){case"SUBTRACT":case"INTERSECT":return n;case"EXCLUDE":case"XOR":return"EXCLUDE";default:return"UNION"}}function Qa(e){switch(e){case"HORIZONTAL":return"HORIZONTAL";case"VERTICAL":return"VERTICAL";default:return"NONE"}}function Pe(e){switch(e){case"RESIZE_TO_FIT":case"RESIZE_TO_FIT_WITH_IMPLICIT_SIZE":return"HUG";case"FILL":return"FILL";default:return"FIXED"}}function _n(e){switch(e){case"CENTER":return"CENTER";case"MAX":return"MAX";case"SPACE_BETWEEN":case"SPACE_EVENLY":return"SPACE_BETWEEN";default:return"MIN"}}function Vn(e){switch(e){case"CENTER":return"CENTER";case"MAX":return"MAX";case"STRETCH":return"STRETCH";case"BASELINE":return"BASELINE";default:return"MIN"}}function xn(e){switch(e){case"MIN":return"MIN";case"CENTER":return"CENTER";case"MAX":return"MAX";case"STRETCH":return"STRETCH";case"BASELINE":return"BASELINE";default:return"AUTO"}}function Qi(e){switch(e){case"CENTER":return"CENTER";case"MAX":return"MAX";case"STRETCH":return"STRETCH";case"SCALE":return"SCALE";default:return"MIN"}}function Gn(e){return e?{startingAngle:e.startingAngle??0,endingAngle:e.endingAngle??2*Math.PI,innerRadius:e.innerRadius??0}:null}function kn(e){let n=e.size?.x??100,t=e.size?.y??100,i=e.transform?.m02??0,o=e.transform?.m12??0,r=0,a=!1;if(e.transform){let s=e.transform;s.m00*s.m11-s.m01*s.m10<0&&(a=!0),r=Math.atan2(s.m10,a?s.m11:s.m00)*(180/Math.PI);let l=r*Math.PI/180,u=Math.cos(l),c=Math.sin(l),d=n/2,f=t/2,g=a?-u:u,m=a?c:-c,p=c,h=u;i=s.m02-d+g*d+m*f,o=s.m12-f+p*d+h*f}return{x:i,y:o,width:n,height:t,rotation:r,flipX:a,flipY:!1}}function es(e){return{cornerRadius:e.cornerRadius??0,topLeftRadius:e.rectangleTopLeftCornerRadius??e.cornerRadius??0,topRightRadius:e.rectangleTopRightCornerRadius??e.cornerRadius??0,bottomRightRadius:e.rectangleBottomRightCornerRadius??e.cornerRadius??0,bottomLeftRadius:e.rectangleBottomLeftCornerRadius??e.cornerRadius??0,independentCorners:e.rectangleCornerRadiiIndependent??!1,cornerSmoothing:e.cornerSmoothing??0}}function ns(e){let n=e.derivedTextData?.baselines?.[0]?.lineHeight;return n!==void 0&&Number.isFinite(n)?n:Me(e.lineHeight,e.fontSize)}function ts(e){return{textDecoration:en(e.textDecoration),textDecorationStyle:e.textDecorationStyle??"SOLID",textDecorationThickness:e.textDecorationThickness?.value??null,textDecorationFills:fe(e.textDecorationFillPaints),textDecorationSkipInk:e.textDecorationSkipInk??!0,textUnderlineOffset:e.textUnderlineOffset?.value??null}}function is(e,n){return{text:e.textData?.characters??"",fontSize:e.fontSize??14,fontFamily:e.fontName?.family??He,fontWeight:Ce(e.fontName?.style??""),italic:e.fontName?.style.toLowerCase().includes("italic")??!1,textAlignHorizontal:e.textAlignHorizontal??"LEFT",textAlignVertical:e.textAlignVertical??"TOP",textAutoResize:e.textAutoResize??"NONE",textCase:e.textCase??"ORIGINAL",...ts(e),leadingTrim:e.leadingTrim??"NONE",lineHeight:ns(e),letterSpacing:_e(e.letterSpacing,e.fontSize),maxLines:e.maxLines??null,styleRuns:Pn(e),fontVariations:Tt(e),fontFeatures:It(e),textTruncation:e.textTruncation==="ENDING"?"ENDING":"DISABLED",textDirection:Le(e,"textDirection")||"AUTO",figmaDerivedLayout:e.derivedTextData?.layoutSize?{width:e.derivedTextData.layoutSize.x,height:e.derivedTextData.layoutSize.y}:null,figmaDerivedTextGlyphs:Nn(e.derivedTextData,n)}}function os(e){let n=e.stackPadding??0;return{paddingTop:e.stackVerticalPadding??n,paddingBottom:e.stackPaddingBottom??n,paddingLeft:e.stackHorizontalPadding??n,paddingRight:e.stackPaddingRight??n}}function rs(e,n,t,i){let o=t==="HUG"||i==="HUG",r=(e.fillPaints?.some(a=>a.visible!==!1)??!1)||(e.strokePaints?.some(a=>a.visible!==!1)??!1);if(!(n==="NONE"||!o||!r))return{x:e.transform?.m02??0,y:e.transform?.m12??0,width:e.size?.x??100,height:e.size?.y??100}}function eo(e,n){let t=e?.value?.[n];return typeof t=="number"&&Number.isFinite(t)&&t>0?t:null}function no(e,n){let t=e?.value?.[n];return typeof t=="number"&&Number.isFinite(t)&&t>=0?t:null}function as(e){let n=Qa(e.stackMode),t=Pe(e.stackPrimarySizing),i=Pe(e.stackCounterSizing),o=rs(e,n,t,i);return{layoutMode:n,itemSpacing:e.stackSpacing??0,...os(e),primaryAxisSizing:t,counterAxisSizing:i,primaryAxisAlign:_n(e.stackPrimaryAlignItems??e.stackJustify),counterAxisAlign:Vn(e.stackCounterAlignItems??e.stackCounterAlign),layoutWrap:e.stackWrap==="WRAP"?"WRAP":"NO_WRAP",counterAxisSpacing:e.stackCounterSpacing??0,layoutPositioning:e.stackPositioning==="ABSOLUTE"?"ABSOLUTE":"AUTO",layoutGrow:e.stackChildPrimaryGrow??0,layoutAlignSelf:xn(e.stackChildAlignSelf),counterAxisAlignContent:e.stackCounterAlignContent==="SPACE_BETWEEN"?"SPACE_BETWEEN":"AUTO",itemReverseZIndex:e.stackReverseZIndex??!1,strokesIncludedInLayout:e.strokesIncludedInLayout??!1,layoutDirection:Le(e,"layoutDirection")||"AUTO",...o?{figmaDerivedLayout:o}:{}}}function ss(e,n){return e.strokeCap??n?.vertices.find(t=>t.strokeCap)?.strokeCap??"NONE"}function ls(e,n){return e.strokeJoin??n?.vertices.find(t=>t.strokeJoin)?.strokeJoin??"MITER"}function qe(e){if(!e||typeof e!="object"||!("guid"in e))return null;let n=e.guid;return!n||typeof n!="object"?null:T(n)}function us(e){return e==="FILL"||e==="TEXT"||e==="EFFECT"||e==="GRID"?e:null}function cs(e){return Array.isArray(e)?structuredClone(e):[]}function ds(e,n){let t=To(e,n),i=ss(e,t),o=ls(e,t);return{vectorNetwork:t,fillGeometry:Ln(ve(e.fillGeometry,n,Mn(e)),t),strokeGeometry:ve(e.strokeGeometry,n),arcData:Gn(e.arcData),strokeCap:i,strokeJoin:o,dashPattern:e.dashPattern??[],borderTopWeight:e.borderTopWeight??0,borderRightWeight:e.borderRightWeight??0,borderBottomWeight:e.borderBottomWeight??0,borderLeftWeight:e.borderLeftWeight??0,independentStrokeWeights:e.borderStrokeWeightsIndependent??!1,strokeMiterLimit:e.miterLimit??qn}}function fs(e){let n=Ja(e.type);return n==="FRAME"&&Ss(e)||Le(e,"nodeType")==="COMPONENT_SET"?"COMPONENT_SET":n==="FRAME"&&e.resizeToFit===!0&&(e.stackMode===void 0||e.stackMode==="NONE")?"GROUP":n}function to(e,n){return Math.abs((e??0)-(n??0))<=.5}function Et(e,n){if(e.type!=="TEXT"||e.textAutoResize!=="NONE"||n?.stackMode!=="HORIZONTAL"&&n?.stackMode!=="VERTICAL"||!e.textData?.characters)return!1;let t=e.derivedTextData?.layoutSize;return!t||!e.size?!1:to(t.x,e.size.x)&&to(t.y,e.size.y)}function At(e,n){let t=fs(e),i=ds(e,n);return{nodeType:t,name:e.name??t,source:As(e,n),...kn(e),opacity:e.opacity??1,visible:e.visible??!0,locked:e.locked??!1,blendMode:e.blendMode??"PASS_THROUGH",booleanOperation:qa(e),fills:fe(e.fillPaints),strokes:Cn(e.strokePaints,e.strokeWeight,e.strokeAlign,i.strokeCap,i.strokeJoin,e.dashPattern??[]),effects:Rn(e.effects),layoutGrids:cs(e.layoutGrids),fillStyleId:qe(e.styleIdForFill),strokeStyleId:qe(e.styleIdForStrokeFill),textStyleId:qe(e.styleIdForText),effectStyleId:qe(e.styleIdForEffect),gridStyleId:qe(e.styleIdForGrid),sharedStyleType:us(e.styleType),...es(e),...is(e,n),horizontalConstraint:Qi(e.horizontalConstraint),verticalConstraint:Qi(e.verticalConstraint),...as(e),...i,minWidth:eo(e.minSize,"x"),maxWidth:no(e.maxSize,"x"),minHeight:eo(e.minSize,"y"),maxHeight:no(e.maxSize,"y"),isMask:e.mask??!1,maskType:e.maskType??"ALPHA",maskIsOutline:e.maskIsOutline??!1,expanded:!0,autoRename:e.autoRename??!0,boundVariables:vn(e),variableModes:$a(e),exportSettings:po(e),pluginData:mo(e),pluginRelaunchData:ho(e),clipsContent:e.frameMaskDisabled===!1&&e.resizeToFit!==!0,componentId:Cs(e),componentPropertyDefinitions:Eo(e),componentPropertyReferences:ps(e),componentPropertyAssignments:hs(e),componentPropertyValues:Is(e),...ys(e)}}var gs={VARIANT:"VARIANT",TEXT:"TEXT",BOOL:"BOOLEAN",BOOLEAN:"BOOLEAN",INSTANCE_SWAP:"INSTANCE_SWAP"};function So(e){if(!e||typeof e!="object")return"";let n=e;return typeof n.boolValue=="boolean"?String(n.boolValue):typeof n.textValue=="string"?n.textValue:n.textValue&&typeof n.textValue=="object"?n.textValue.characters??"":n.guidValue?T(n.guidValue):""}function Eo(e){let n=e.componentPropDefs;if(!n?.length)return[];let t=[];for(let i of n){if(!i.id||!i.name)continue;let o=gs[i.type??""]??"VARIANT";t.push({id:T(i.id),name:i.name,type:o,defaultValue:So(i.initialValue),variantOptions:o==="VARIANT"?i.preferredValues?.stringValues:void 0,preferredValues:o==="INSTANCE_SWAP"?i.preferredValues?.instanceSwapValues?.map(r=>r.key).filter(r=>r!==void 0):void 0})}return t}function ps(e){let n=e.componentPropRefs;if(!n?.length)return[];let t={0:"VISIBLE",1:"TEXT",2:"INSTANCE_SWAP",VISIBLE:"VISIBLE",TEXT_DATA:"TEXT",OVERRIDDEN_SYMBOL_ID:"INSTANCE_SWAP"};return n.flatMap(i=>{let o=t[String(i.componentPropNodeField)];return i.defID&&o&&!i.isDeleted?[{propertyId:T(i.defID),field:o}]:[]})}function ms(e){if(e.value&&(e.value.boolValue!==void 0||e.value.textValue!==void 0||e.value.guidValue!==void 0))return So(e.value);let n=e.varValue?.value;return n?.symbolIdValue?.guid?T(n.symbolIdValue.guid):n?.boolValue!==void 0?String(n.boolValue):n?.textValue!==void 0?n.textValue:n?.textDataValue?.characters??""}function hs(e){let n=e.componentPropAssignments;return n?.length?Object.fromEntries(n.flatMap(t=>t.defID?[[T(t.defID),ms(t)]]:[])):{}}function Ao(e){let n=e.variantPropSpecs;return n?.length?n.filter(t=>!!t.propDefId).map(t=>({propDefId:T(t.propDefId),value:t.value??""})):[]}function Is(e){let n=Ao(e),t=new Map(Eo(e).map(o=>[o.id,o.name]));if(n.length>0&&t.size>0){let o={};for(let r of n)o[t.get(r.propDefId)??r.propDefId]=r.value;return o}let i=e.name;return i?.includes("=")?qi(i):{}}function io(e){if(!e||typeof e!="object")return null;let n=e;return typeof n.sessionID!="number"||typeof n.localID!="number"?null:T({sessionID:n.sessionID,localID:n.localID})}function An(e){return typeof e=="string"?e:null}function Ts(e){return typeof e=="string"?e:""}function oo(e){return typeof e=="boolean"?e:!1}function ys(e){let n=e.symbolLinks??[];return{componentKey:An(e.componentKey),sourceLibraryKey:An(e.sourceLibraryKey),publishId:io(e.publishID),overrideKey:io(e.overrideKey),sharedSymbolVersion:An(e.sharedSymbolVersion),publishedVersion:An(e.publishedVersion),isPublishable:oo(e.isPublishable),isSymbolPublishable:oo(e.isSymbolPublishable),symbolDescription:Ts(e.symbolDescription),symbolLinks:n.filter(t=>typeof t.uri=="string").map(t=>({uri:t.uri,displayName:t.displayName,displayText:t.displayText})),variantPropSpecs:Ao(e)}}function Ss(e){let n=e.componentPropDefs;return n?.length?n.some(t=>t.type==="VARIANT"):!1}function Es(e){return{stackMode:e.stackMode,stackSpacing:e.stackSpacing,stackPadding:e.stackPadding,stackPaddingRight:e.stackPaddingRight,stackPaddingBottom:e.stackPaddingBottom,stackCounterAlign:e.stackCounterAlign,stackJustify:e.stackJustify,stackCounterAlignItems:e.stackCounterAlignItems,stackPrimaryAlignItems:e.stackPrimaryAlignItems,stackPrimarySizing:e.stackPrimarySizing,stackCounterSizing:e.stackCounterSizing,stackVerticalPadding:e.stackVerticalPadding,stackHorizontalPadding:e.stackHorizontalPadding,stackWrap:e.stackWrap,stackPositioning:e.stackPositioning,stackChildPrimaryGrow:e.stackChildPrimaryGrow,stackChildAlignSelf:e.stackChildAlignSelf,stackCounterSpacing:e.stackCounterSpacing,bordersTakeSpace:e.bordersTakeSpace,stackReverseZIndex:e.stackReverseZIndex}}function As(e,n){return{format:"fig",id:e.guid?T(e.guid):null,orderKey:e.parentIndex?.position??null,editedFields:[],fig:{...Ns(e,n),...Ds(e,n),layout:Es(e)}}}function Nt(e,n,t){let i=n.stackMode,o=i==="HORIZONTAL",r=i==="VERTICAL";e.sort((a,s)=>{let l=t.get(a)?.parentIndex?.position??"",u=t.get(s)?.parentIndex?.position??"";if(l<u)return-1;if(l>u)return 1;if(o||r){let c=o?"m02":"m12",d=t.get(a)?.transform?.[c]??0,f=t.get(s)?.transform?.[c]??0;if(d!==f)return d-f}return 0})}function be(e,n){if(e instanceof Uint8Array)return e;if(Array.isArray(e))return e.map(i=>be(i,n));if(!e||typeof e!="object")return e;let t={};for(let[i,o]of Object.entries(e))if((i==="commandsBlob"||i==="vectorNetworkBlob")&&typeof o=="number"){let r=n[o];r==null?t[i]=o:t[i]={__openPencilFigmaBlob:r instanceof Uint8Array?r:new Uint8Array(Object.values(r))}}else t[i]=be(o,n);return t}var No=["styleIdForFill","styleIdForStrokeFill","styleIdForText","styleIdForEffect","styleIdForGrid","styleType","componentPropAssignments","backgroundPaints","layoutGrids","exportSettings","componentPropDefs","componentPropRefs","variantPropSpecs","stateGroupPropertyValueOrders","isStateGroup","version","sourceLibraryKey","userFacingVersion","description","key","sortPosition","detachedSymbolId","documentColorProfile","variableConsumptionMap","variableModeBySetMap","parameterConsumptionMap","editInfo","backgroundColor","pageType","isPageDivider","guides","handoffStatusMap","annotationCategories","miterLimit","mask","maskType","maskIsOutline","strokeWeight","strokeJoin","borderStrokeWeightsIndependent","borderTopWeight","borderRightWeight","borderBottomWeight","borderLeftWeight","minSize","maxSize","targetAspectRatio","gridRows","gridColumns","gridRowAnchor","gridColumnAnchor","gridColumnsSizing","gridRowsSizing","gridChildVerticalAlign","gridChildHorizontalAlign","textAutoResize","textData","lineHeight","fontName","fontSize","letterSpacing","textTracking","fontVersion","textUserLayoutVersion","textExplicitLayoutVersion","fontVariations","fontVariantCommonLigatures","fontVariantContextualLigatures","toggledOnOTFeatures","toggledOffOTFeatures","leadingTrim","textDecorationFillPaints","textUnderlineOffset","textDecorationThickness","textDecorationStyle","semanticWeight","semanticItalic","maxLines","textPathStart","derivedTextData","fillPaints","strokePaints","effects","sectionStatusInfo","prototypeStartNodeID","prototypeInteractions","transitionInfo","codeSyntax","lockMode","slideThemeMap","isSoftDeleted","brushType","scatterStrokeSettings","vectorOperationVersion","vectorData","fillGeometry","strokeGeometry"];function Ns(e,n){let t={};for(let i of No){let o=e[i];o!==void 0&&(t[i]=be(o,n))}return{rawSize:e.size?{...e.size}:null,rawTransform:e.transform?{...e.transform}:null,rawNodeFields:t}}function Ds(e,n){let t=e.symbolData;return{symbolOverrides:be(t?.symbolOverrides??[],n),componentPropAssignments:be(e.componentPropAssignments??[],n),derivedSymbolData:be(e.derivedSymbolData??[],n),derivedSymbolDataLayoutVersion:typeof e.derivedSymbolDataLayoutVersion=="number"?e.derivedSymbolDataLayoutVersion:null,uniformScaleFactor:typeof t?.uniformScaleFactor=="number"?t.uniformScaleFactor:null}}function Cs(e){let n=e.symbolData;return n?.symbolID?T(n.symbolID):""}var Rs=["fontSize","fontName","lineHeight","letterSpacing","textDecoration","textCase"];function Qe(e,n,t){if(n?.guid)return e.get(T(n.guid));if(!n?.assetRef||!t)return;let{key:i,version:o}=n.assetRef,r=(o?t.get(`${i}@${o}`):void 0)??t.get(i);return r?e.get(r):void 0}function Os(e,n,t){let i=Qe(e,n.styleIdForFill,t);i?.styleType==="FILL"&&i.fillPaints&&(n.fillPaints=i.fillPaints);let o=Qe(e,n.styleIdForStrokeFill,t);o?.styleType==="FILL"&&o.fillPaints&&(n.strokePaints=o.fillPaints)}function bs(e,n,t){let i=Qe(e,n.styleIdForEffect,t);i?.styleType==="EFFECT"&&i.effects&&(n.effects=i.effects);let o=Qe(e,n.styleIdForGrid,t);o?.styleType==="GRID"&&o.layoutGrids&&(n.layoutGrids=o.layoutGrids)}function vs(e,n,t){let i=Qe(e,n.styleIdForText,t);if(!(i?.type!=="TEXT"||i.styleType!=="TEXT"))for(let o of Rs)o==="textDecoration"?n.textDecoration=i.textDecoration:i[o]!==void 0&&Object.assign(n,{[o]:i[o]})}function nn(e,n,t){Os(e,n,t),bs(e,n,t),vs(e,n,t)}function Do(e,n,t,i,o){let r=i-t;if(o==="MAX")return{position:e+r,size:n};if(o==="CENTER")return{position:e+r/2,size:n};if(o==="STRETCH")return{position:e,size:Math.max(1,n+r)};if(o==="SCALE"&&t>0){let a=i/t;return{position:e*a,size:Math.max(1,n*a)}}return{position:e,size:n}}function Co(e,n,t,i,o){let r=Do(e.x,e.width,n.width,t.width,i),a=Do(e.y,e.height,n.height,t.height,o);return{x:Math.round(r.position),y:Math.round(a.position),width:Math.round(r.size),height:Math.round(a.size)}}function Ps(e,n,t){let i={},o=ve(e.fillGeometry,t,Mn(e)),r=ve(e.strokeGeometry,t);if(o.length>0?i.fillGeometry=Ln(o,n.vectorNetwork):e.size&&n.fillGeometry.length>0&&n.width>0&&n.height>0&&(i.fillGeometry=De(n.fillGeometry,e.size.x/n.width,e.size.y/n.height)),r.length>0?i.strokeGeometry=r:e.size&&n.strokeGeometry.length>0&&n.width>0&&n.height>0&&(i.strokeGeometry=De(n.strokeGeometry,e.size.x/n.width,e.size.y/n.height)),e.size&&n.vectorNetwork?.vertices.length){let a=mn(n.vectorNetwork),s=Math.min(...a.vertices.map(({x:p})=>p)),l=Math.min(...a.vertices.map(({y:p})=>p)),u=a.vertices.map(({x:p})=>p),c=a.vertices.map(({y:p})=>p),d=Math.max(...u)-Math.min(...u),f=Math.max(...c)-Math.min(...c),g=d===0?1:e.size.x/d,m=f===0?1:e.size.y/f;for(let p of a.vertices)p.x=s+(p.x-s)*g,p.y=l+(p.y-l)*m;for(let p of a.segments)p.tangentStart.x*=g,p.tangentStart.y*=m,p.tangentEnd.x*=g,p.tangentEnd.y*=m;i.vectorNetwork=a}return i}function Ls(e,n,t){let i=n.get(t);if(i!==void 0)return i;let o=e.graph.getChildren(t).filter(r=>r.visible).length;return n.set(t,o),o}function Ms(e,n,t){if(!t.parentId||Ls(e,n,t.parentId)!==1||!t.componentId)return null;let i=e.graph.getNode(t.componentId),o=e.graph.getNode(t.parentId);return!i||!o?null:i.x>=0&&i.y>=0&&i.x+i.width<=o.width+.01&&i.y+i.height<=o.height+.01?{x:i.x,y:i.y}:null}function _s(e,n,t){if(e.rotation===0&&!e.flipX&&!e.flipY)return null;let i=Sn(e),o=n/2,r=t/2;return{x:i[2]-o+i[0]*o+i[1]*r,y:i[5]-r+i[3]*o+i[4]*r}}function Vs(e,n,t){let i={};e.fontSize!==void 0&&(i.fontSize=e.fontSize),e.lineHeight!==void 0&&(i.lineHeight=Me(e.lineHeight,e.fontSize)),e.letterSpacing!==void 0&&(i.letterSpacing=_e(e.letterSpacing,e.fontSize)),e.strokeWeight!==void 0&&t.strokes.length>0&&(i.strokes=t.strokes.map(r=>({...r,weight:e.strokeWeight})));let o=Nn(e.derivedTextData,n);return o.length>0&&(i.figmaDerivedTextGlyphs=o),i}function xs(e,n,t,i){let o=Vs(t,e.blobs,i),r={};if(t.size&&(o.width=t.size.x,o.height=t.size.y,r.width=t.size.x,r.height=t.size.y),t.transform){let a=kn({transform:t.transform,size:t.size??{x:i.width,y:i.height}});o.x=a.x,o.y=a.y,o.rotation=a.rotation,o.flipX=a.flipX,o.flipY=a.flipY,r.x=a.x,r.y=a.y}else if(t.size){let a=_s(i,t.size.x,t.size.y)??Ms(e,n,i);a&&(o.x=a.x,o.y=a.y,r.x=a.x,r.y=a.y)}return Object.keys(r).length>0&&(o.figmaDerivedLayout=r),Object.assign(o,Ps(t,i,e.blobs)),{updates:o,hasSize:t.size!==void 0}}function*pe(e,n){if(!n){yield*e.getAllNodes();return}for(let t of n){let i=e.getNode(t);i&&(yield i)}}function ko(e,n,t={}){return{...Ze(e),componentId:n,figmaDerivedLayout:e.figmaDerivedLayout?{...e.figmaDerivedLayout}:null,...t}}var Ro=new WeakSet,Oo=new WeakMap;function vt(e){let n=Oo.get(e);return n||(n=new Map([...e].map(([t,i])=>[t,new Set(i)])),Oo.set(e,n)),n}function Gs(e,n,t){if(Ro.has(n))return;let i=vt(n);for(let o of pe(e,t)){if(!o.componentId)continue;let r=i.get(o.componentId);r||(r=new Set,i.set(o.componentId,r),n.set(o.componentId,[])),!r.has(o.id)&&(r.add(o.id),n.get(o.componentId)?.push(o.id))}Ro.add(n)}function Fo(e,n,t){let i=vt(t);for(let o of n){let r=e.getNode(o);if(!r?.componentId)continue;let a=i.get(r.componentId);if(a||(a=new Set,i.set(r.componentId,a)),a.has(r.id))continue;a.add(r.id);let s=t.get(r.componentId);s?s.push(r.id):t.set(r.componentId,[r.id])}}function Pt(e,n,t){let i=[],o=[n],r=0;for(;r<o.length;){let a=e.getNode(o[r]);r++,a&&(i.push(a.id),o.push(...a.childIds))}Fo(e,i,t)}function Lt(e,n){let t=[],i=e.getNode(n);if(!i)return t;let o=(r,a)=>{let s=e.getNode(r);s&&(t.push({id:s.id,path:a,type:s.type}),s.childIds.forEach((l,u)=>o(l,[...a,u])))};return i.childIds.forEach((r,a)=>o(r,[a])),t}function ks(e,n,t){let i=e.getNode(n);if(!i)return null;for(let o of t){let r=i.childIds[o];if(!r||(i=e.getNode(r),!i))return null}return i}function Fs(e,n,t,i){return new Set([...i?.get(n)??[],...i?.get(t)??[],...e.instanceIndex.get(n)??[],...e.instanceIndex.get(t)??[]])}function ws(e,n,t){if(!e)return;let i=vt(e),o=i.get(n);if(o||(o=new Set,i.set(n,o)),o.has(t))return;o.add(t);let r=e.get(n);r||(r=[],e.set(n,r)),r.push(t)}function Mt(e,n,t,i,o){i&&Gs(e,i,o);for(let r of t){let a=ks(e,n,r.path);if(!a||a.type!==r.type)continue;let s=Fs(e,r.id,a.id,i);for(let l of s){let u=e.getNode(l);u?.componentId!==r.id&&u?.componentId!==a.id||(e.updateNode(l,ko(a,a.id)),ws(i,a.id,l))}}}var wo=20,bo=new WeakMap,vo=new WeakMap,Rt=new WeakMap,Ot=new WeakMap,Po=new WeakMap,Lo=new WeakMap;function Us(e){function n(t,i=0){let o=e.preComputedRoot.get(t);if(o!==void 0)return o;if(i>wo)return t;let r=e.graph.getNode(t);if(r?.componentId&&r.componentId!==t){let a=n(r.componentId,i+1);return e.preComputedRoot.set(t,a),a}return e.preComputedRoot.set(t,t),t}for(let t of pe(e.graph,e.activeNodeIds)){if(!t.componentId)continue;n(t.id);let i=e.preComputedClones.get(t.componentId);i?i.push(t.id):e.preComputedClones.set(t.componentId,[t.id])}}function ge(e,n,t=0){let i=e.componentIdRoot.get(n);if(i!==void 0)return i;if(t>wo)return e.componentIdRoot.set(n,n),n;let o=e.graph.getNode(n);if(o?.componentId){let a=ge(e,o.componentId,t+1);return e.componentIdRoot.set(n,a),a}let r=e.nodeIdToGuid.get(n);if(r){let a=e.changeMap.get(r)?.symbolData?.symbolID;if(a){let s=e.guidToNodeId.get(T(a));if(s&&s!==n){let l=ge(e,s,t+1);return e.componentIdRoot.set(n,l),l}}}return e.componentIdRoot.set(n,n),n}function Bs(e){let n=new Map;for(let[t,i]of e.changeMap){let o=i.parentIndex?.guid?T(i.parentIndex.guid):null,r=i.symbolData?.symbolID?T(i.symbolData.symbolID):null;if(!o||!r)continue;let a=`${o}\0${r}`,s=n.get(a);s?s.push(t):n.set(a,[t])}for(let t of n.values())t.sort((i,o)=>{let r=e.changeMap.get(i),a=e.changeMap.get(o);return(r?.transform?.m12??0)-(a?.transform?.m12??0)||(r?.transform?.m02??0)-(a?.transform?.m02??0)});return n}function Hs(e){let n=vo.get(e);if(n)return n;let t=Bs(e);return vo.set(e,t),t}function zs(e,n){let t=bo.get(e);if(t||(t=new Map,bo.set(e,t)),t.has(n))return t.get(n)??null;let i=e.changeMap.get(n),o=i?.parentIndex?.guid?T(i.parentIndex.guid):null,r=i?.symbolData?.symbolID?T(i.symbolData.symbolID):null;if(!i||!o||!r)return t.set(n,null),null;let a=(Hs(e).get(`${o}\0${r}`)??[]).indexOf(n),s=a!==-1?a:null;return t.set(n,s),s}function Ws(e,n,t){let i=Po.get(e);i||(i=new Map,Po.set(e,i));let o=`${n}\0${t}`;if(i.has(o))return i.get(o)??null;let r=(s,l)=>{let u=e.graph.getNode(s);if(!u)return null;if(s===t||u.componentId===t)return l;for(let c=0;c<u.childIds.length;c++){let d=r(u.childIds[c],[...l,c]);if(d)return d}return null},a=r(n,[]);return i.set(o,a),a}function Ks(e,n,t){let i=e.graph.getNode(n);if(!i?.componentId)return null;let o=Ws(e,i.componentId,t);if(!o)return null;let r=i;for(let a of o){let s=r.childIds[a];if(!s)return null;let l=e.graph.getNode(s);if(!l)return null;r=l}return r.id}function Mo(e,n,t,i){if(!t||!i)return null;let o=null,r=0,a=s=>{if(r>1)return;let l=e.graph.getNode(s);if(l){l.name===t&&l.type===i&&(r++,o=s);for(let u of l.childIds)a(u)}};return a(n),r===1?o:null}function Ys(e,n,t,i){let o=zs(e,i);if(o==null)return null;let r=e.preComputedRoot.get(t)??ge(e,t),a=Rt.get(e);a||(a=new Map,Rt.set(e,a));let s=`${n}\0${r}`,l=a.get(s);if(!l){l=[];let u=c=>{let d=e.graph.getNode(c);if(d){d.componentId&&(e.preComputedRoot.get(d.componentId)??ge(e,d.componentId))===r&&l?.push(c);for(let f of d.childIds)u(f)}};u(n),l.sort((c,d)=>{let f=e.graph.getNode(c),g=e.graph.getNode(d);return(f?.y??0)-(g?.y??0)||(f?.x??0)-(g?.x??0)}),a.set(s,l)}return l[o]??null}function Uo(e,n,t){let i=Ot.get(e);i||(i=new Map,Ot.set(e,i));let o=`${n}\0${t}`;if(i.has(o))return i.get(o)??null;let r=e.graph.getNode(n);if(!r)return null;for(let s of r.childIds)if(e.graph.getNode(s)?.componentId===t)return i.set(o,s),s;let a=e.preComputedRoot.get(t)??ge(e,t);if(a){let s=null,l=!1;for(let u of r.childIds){let c=e.graph.getNode(u);if(c?.componentId&&(e.preComputedRoot.get(c.componentId)??ge(e,c.componentId))===a){if(s){l=!0;break}s=u}}if(s&&!l)return i.set(o,s),s}for(let s of r.childIds){let l=Uo(e,s,t);if(l)return i.set(o,l),l}return null}function Xs(e,n,t,i,o){return i?e.graph.getNode(n)?.componentId===i?n:Ks(e,n,i)??Uo(e,n,i)??Ys(e,n,i,t)??Mo(e,n,o?.name,o?.type):Mo(e,n,o?.name,o?.type)}function _t(e,n,t){let i=Lo.get(e);i||(i=new Map,Lo.set(e,i));let o=n,r=[];for(let a=0;a<t.length;a++){let s=T(t[a]);r.push(s);let l=`${n}\0${r.join("/")}`,u=i.get(l);if(u&&e.graph.getNode(u)){o=u;continue}u&&i.delete(l);let c=e.overrideKeyToGuid.get(s)??s,d=e.changeMap.get(c),f=d?.symbolData?.symbolID?T(d.symbolData.symbolID):null,g=e.guidToNodeId.get(c)??(f?e.guidToNodeId.get(f):void 0),m=Xs(e,o,c,g,d);if(m){o=m,i.set(l,m);continue}let p=e.graph.getNode(o);if(p?.childIds.length===1){o=p.childIds[0],a--,r.pop();continue}return null}return o}function js(e,n){let t=[],i=o=>{let r=e.graph.getNode(o);if(r){r.strokes.length>0&&t.push(ue(r.strokes));for(let a of r.childIds)i(a)}};return i(n),t}function $s(e,n,t){let i=0,o=r=>{let a=e.graph.getNode(r);if(a){a.strokes.length>0&&(i<t.length&&e.graph.preserveSourceMetadataDuring(()=>{e.graph.updateNode(r,{strokes:ue(t[i])})}),i++);for(let s of a.childIds)o(s)}};o(n)}function _o(e,n){if(!n)return"";let t=n.parentId?e.graph.getNode(n.parentId):void 0;return t?.type==="COMPONENT_SET"?t.name:n.name}function Zs(e,n){let t=Ze(n);t.width=e.width,t.height=e.height,t.boundVariables={...t.boundVariables};for(let i of["width","height"]){let o=e.boundVariables[i];o&&(t.boundVariables[i]=o)}return t}function Js(e,n,t){let i=e.graph.getNode(n);if(i?.type!=="INSTANCE")return;let o=js(e,n),r=Lt(e.graph,n),a=i.componentId?ge(e,i.componentId):void 0,s=a?e.graph.getNode(a):void 0;for(let f of Array.from(i.childIds))e.graph.deleteNode(f);let l=e.graph.getNode(t),u=l?{...Zs(i,l),componentId:t}:{componentId:t},c=_o(e,s),d=_o(e,l);d&&c&&(i.name===c||i.name===s?.name)&&(u.name=d),e.graph.preserveSourceMetadataDuring(()=>e.graph.updateNode(n,u)),l&&l.childIds.length>0&&(e.graph.populateInstanceChildren(n,t,"fig-import"),Pt(e.graph,n,e.preComputedClones),$s(e,n,o)),Mt(e.graph,n,r,e.preComputedClones,e.activeNodeIds),e.swappedInstances.add(n),e.componentIdRoot.clear(),Rt.delete(e),Ot.delete(e)}var qs={text:"text",visible:"visible",opacity:"opacity",fills:"fills",strokes:"strokes",effects:"effects",styleRuns:"styleRuns",layoutGrow:"layoutGrow",textAutoResize:"textAutoResize",locked:"locked",x:"x",y:"y",width:"width",height:"height",figmaDerivedLayout:"figmaDerivedLayout",fontSize:"fontSize",lineHeight:"lineHeight",letterSpacing:"letterSpacing",fillGeometry:"fillGeometry",strokeGeometry:"strokeGeometry"};function Bo(e,n,t){let i=e.get(n);i?i.add(t):e.set(n,new Set([t]))}function Qs(e,n,t){for(let i of Object.keys(t)){let o=qs[i];o&&Bo(e,n,o)}}function tn(e,n,t){return e?.get(n)?.has(t)===!0}function el(e,n){n.strokes&&(n.strokes=n.strokes.map((t,i)=>{if(i>=e.strokes.length)return{...t,cap:e.strokeCap,join:e.strokeJoin,dashPattern:e.dashPattern};let o=e.strokes[i];return{...t,cap:o.cap,join:o.join,dashPattern:o.dashPattern}}))}function Vt(e,n){let t=!1;if(n.swapComponentId&&(Js(e,n.targetId,n.swapComponentId),Bo(e.protectedFields,n.targetId,"structure"),t=!0),n.props&&Object.keys(n.props).length>0){let i=e.graph.getNode(n.targetId);if(i){let o=n.props;o.boundVariables&&(o.boundVariables={...i.boundVariables,...o.boundVariables}),el(i,o),e.graph.preserveSourceMetadataDuring(()=>e.graph.updateNode(n.targetId,o)),Qs(e.protectedFields,n.targetId,o),t=!0}}return t}function Ho(e,n,t){return!tn(e,n,t)}function nl(e,n,t){switch(e){case"text":t.text=n.text;break;case"visible":t.visible=n.visible;break;case"opacity":t.opacity=n.opacity;break;case"locked":t.locked=n.locked;break;case"layoutGrow":t.layoutGrow=n.layoutGrow;break;case"textAutoResize":t.textAutoResize=n.textAutoResize;break}}function Ve(e,n){return(t,i,o,r)=>{t[e]!==i[e]&&Ho(r,i.id,n)&&nl(e,t,o)}}var tl=[Ve("text","text"),Ve("visible","visible"),Ve("opacity","opacity"),Ve("locked","locked"),Ve("layoutGrow","layoutGrow"),Ve("textAutoResize","textAutoResize")];function il(e,n,t){switch(e){case"fills":t.fills=Y(n.fills,W(n.fills));break;case"strokes":t.strokes=Y(n.strokes,ue(n.strokes));break;case"effects":t.effects=Y(n.effects,Ne(n.effects));break;case"styleRuns":t.styleRuns=Y(n.styleRuns,ce(n.styleRuns));break}}function ol(e,n,t,i){let o=`${e}/`,r=i.boundVariables??t.boundVariables,a=Q(r,Object.keys(r).filter(s=>s.startsWith(o)));for(let[s,l]of Object.entries(n.boundVariables))s.startsWith(o)&&(a[s]=l);i.boundVariables=a}function Fn(e,n){return(t,i,o,r)=>{!In(t[e],i[e])&&Ho(r,i.id,n)&&(il(e,t,o),(e==="fills"||e==="strokes")&&ol(e,t,i,o))}}var rl=[Fn("fills","fills"),Fn("strokes","strokes"),Fn("effects","effects"),Fn("styleRuns","styleRuns")];function al(e,n,t,i){let o=n.boundVariables[e];if(t.boundVariables[e]===o)return;let r={...i.boundVariables??t.boundVariables};o&&(r[e]=o),i.boundVariables=o?r:Q(r,[e])}function sl(e,n,t,i){for(let o of tl)o(e,n,t,i);for(let o of rl)o(e,n,t,i);al("opacity",e,n,t)}function Un(e,n,t,i){let o={};sl(n,t,o,i),Object.keys(o).length>0&&e.updateNode(t.id,o)}function ll(e,n,t,i,o,r,a){let s=e.getNode(n);if(!s)return;let l=r??xe(e,a),u=Lt(e,t.id);for(let c of Array.from(t.childIds))e.deleteNode(c);e.updateNode(t.id,ko(s,s.componentId,{name:s.name})),Un(e,s,t,o),s.childIds.length>0&&(e.populateInstanceChildren(t.id,n,"fig-import"),Pt(e,t.id,l)),Mt(e,t.id,u,l,a),i.add(t.id)}function zo(e,n,t,i,o,r,a,s){let l=e.getNode(n),u=e.getNode(t);if(!l||!u)return;let c=a??xe(e,s),d=Math.min(l.childIds.length,u.childIds.length);for(let f=0;f<d;f++){if(o?.has(u.childIds[f]))continue;let g=e.getNode(l.childIds[f]),m=e.getNode(u.childIds[f]);if(!(!g||!m||g.type!==m.type)){if(g.type==="INSTANCE"&&g.componentId!==m.componentId){ll(e,l.childIds[f],m,i,r,c,s);continue}Un(e,g,m,r),zo(e,l.childIds[f],u.childIds[f],i,o,r,c,s)}}}function xe(e,n){let t=new Map;for(let i of pe(e,n)){if(!i.componentId)continue;let o=t.get(i.componentId);o||(o=[],t.set(i.componentId,o)),o.push(i.id)}return t}function ul(e,n){let t=new Set(n);for(let i of n){let o=e.getNode(i);for(;o?.parentId;){let r=e.getNode(o.parentId);if(!r)break;(r.type==="INSTANCE"||r.type==="COMPONENT")&&t.add(r.id),o=r}}return t}function cl(e,n){let t=new Set,i=[...e];for(let o=i.pop();o!==void 0;o=i.pop()){let r=n.get(o);if(r)for(let a of r)t.has(a)||(t.add(a),i.push(a))}return t}function dl(e,n){if(!n)return e;let t=new Map;for(let i of[n,e])for(let[o,r]of i){let a=t.get(o);if(a)for(let s of r)a.includes(s)||a.push(s);else t.set(o,[...r])}return t}function fl(e,n,t,i,o){if(n.size===0)return;let r=dl(xe(e,t),o),a=new Set(n),s=[...n].map(u=>({lineageId:u,sourceId:u})),l=0;for(;l<s.length;){let{lineageId:u,sourceId:c}=s[l];l++;let d=e.getNode(c);if(d)for(let f of r.get(u)??[]){if(a.has(f))continue;a.add(f);let g=e.getNode(f);g&&Un(e,d,g,i),s.push({lineageId:f,sourceId:g?.id??c})}}}function Dt(e,n,t,i,o,r,a){if(n.size===0)return;i.clear();let s=xe(e,r),l=ul(e,n),u=cl(l,s),c=o&&o.size>0?new Set([...n,...o]):n,d=new Set,f=[...l],g=0;for(;g<f.length;){let m=f[g];g++;let p=s.get(m);if(!p)continue;let h=e.getNode(m);if(h)for(let I of p){if(!u.has(I)||d.has(I))continue;d.add(I);let y=e.getNode(I);if(y){if(c.has(I)){f.push(I);continue}if(Un(e,h,y,a),h.childIds.length!==y.childIds.length){let E=Lt(e,y.id);for(let b of Array.from(y.childIds))e.deleteNode(b);h.childIds.length>0&&(e.populateInstanceChildren(y.id,m,"fig-import"),Pt(e,y.id,s)),Mt(e,y.id,E,s,r)}else h.childIds.length>0&&y.childIds.length>0&&zo(e,m,y.id,t,c,a,s,r);f.push(I)}}}}function gl(e,n){if(n.type!=="INSTANCE"||!e.figmaDerivedLayout)return{};let t=e.figmaDerivedLayout;return{...t.x===void 0?{}:{x:t.x},...t.y===void 0?{}:{y:t.y},figmaDerivedLayout:{...t,...n.figmaDerivedLayout,x:t.x??n.figmaDerivedLayout?.x,y:t.y??n.figmaDerivedLayout?.y}}}function pl(e,n,t,i,o){let r={};return o.has(i)?gl(n,t):(n.width!==t.width&&(r.width=n.width),n.height!==t.height&&(r.height=n.height),n.x!==t.x&&(r.x=n.x),n.y!==t.y&&(r.y=n.y),e.geometryOverrideNodes.has(i)||(n.fillGeometry!==t.fillGeometry&&(r.fillGeometry=ie(n.fillGeometry)),n.strokeGeometry!==t.strokeGeometry&&(r.strokeGeometry=ie(n.strokeGeometry))),n.text===t.text&&n.figmaDerivedTextGlyphs&&(r.figmaDerivedTextGlyphs=structuredClone(n.figmaDerivedTextGlyphs)),n.text===t.text&&n.figmaDerivedLayout&&(r.figmaDerivedLayout={...n.figmaDerivedLayout}),r)}function ml(e,n){hl(e,n),yl(e)}function hl(e,n){for(let t of n){let i=e.graph.getNode(t);if(i?.layoutMode!=="NONE"||i.childIds.length!==1)continue;let o=e.graph.getNode(i.childIds[0]);if(!o||o.childIds.length>0||o.horizontalConstraint!=="SCALE"||o.verticalConstraint!=="SCALE")continue;let r=o.figmaDerivedLayout?.width,a=o.figmaDerivedLayout?.height,s=r!==void 0&&a!==void 0,l=!s&&o.type==="ROUNDED_RECTANGLE"&&o.fills.some(d=>d.type==="IMAGE");if(!s&&!l)continue;let u=r??i.width,c=a??i.height;o.width===u&&o.height===c||e.graph.updateNode(o.id,{width:u,height:c})}}function Il(e,n){return e.counterAxisAlign!=="CENTER"?!1:e.layoutMode==="HORIZONTAL"?n.height<=1&&n.width>n.height:e.layoutMode==="VERTICAL"?n.width<=1&&n.height>n.width:!1}function Tl(e,n){if(n.source.format!==null||!n.componentId||!n.name.endsWith("Divider")||!n.parentId||n.figmaDerivedLayout?.x!==void 0||n.figmaDerivedLayout?.y!==void 0)return null;let t=e.getNode(n.parentId),i=e.getNode(n.componentId),o=i?.figmaDerivedLayout;return!t||!i||o?.x===void 0||o.y===void 0||n.width!==i.width||n.height!==i.height||!Il(t,n)?null:t.layoutMode==="HORIZONTAL"?{axis:"y",position:o.y}:{axis:"x",position:o.x}}function yl(e){for(let n of pe(e.graph,e.activeNodeIds)){let t=Tl(e.graph,n);t&&e.graph.updateNode(n.id,{figmaDerivedLayout:{...n.figmaDerivedLayout,[t.axis]:t.position}})}}function Sl(e){for(let n of pe(e.graph,e.activeNodeIds)){if(n.source.format==="fig"||!n.figmaDerivedLayout||!n.parentId||n.layoutPositioning==="ABSOLUTE")continue;let t=e.graph.getNode(n.parentId);if(!t||t.source.format==="fig"||t.layoutMode!=="NONE"||!t.figmaDerivedLayout)continue;let i={};n.horizontalConstraint==="STRETCH"&&n.figmaDerivedLayout.width!==void 0&&n.figmaDerivedLayout.width===t.figmaDerivedLayout.width&&(i.width=n.figmaDerivedLayout.width),n.verticalConstraint==="STRETCH"&&n.figmaDerivedLayout.height!==void 0&&n.figmaDerivedLayout.height===t.figmaDerivedLayout.height&&(i.height=n.figmaDerivedLayout.height),Object.keys(i).length>0&&e.graph.updateNode(n.id,i)}}function El(e,n,t){if(n.size===0)return;let i=xe(e.graph,e.activeNodeIds),o=[...n],r=new Set,a=0;for(;a<o.length;){let s=o[a];a++;let l=e.graph.getNode(s);if(!l)continue;let u=i.get(s);if(u)for(let c of u){if(r.has(c))continue;r.add(c);let d=e.graph.getNode(c);if(!d)continue;let f=pl(e,l,d,c,t);Object.keys(f).length>0&&e.graph.preserveSourceMetadataDuring(()=>e.graph.updateNode(c,f)),o.push(c)}}}function Al(e){let n=new Map;for(let[t,i]of e.graph.instanceIndex)for(let o of i){if(e.activeNodeIds&&!e.activeNodeIds.has(o)||e.graph.getNode(o)?.type!=="INSTANCE")continue;let r=n.get(t);r?r.push(o):n.set(t,[o])}return n}function Nl(e,n,t){let i=t.get(e);if(i)return i;let o=[],r=new Set,a=s=>{if(!r.has(s)){r.add(s),o.push(s);for(let l of n.get(s)??[])a(l)}};return a(e),t.set(e,o),o}function Vo(e){return e.toLowerCase().replace(/[^a-z0-9]/g,"")}function Dl(e){let[n,t]=e.split(":").map(Number);return{sessionID:n,localID:t}}function Wo(e){return typeof e.textValue=="string"?e.textValue:e.textValue?.characters??e.textDataValue?.characters}function Cl(e){return e.boolValue===void 0&&e.textValue===void 0&&e.textDataValue===void 0&&e.guidValue===void 0}function Rl(e,n,t,i){if(!Cl(n.value))return n.value;let o=n.varValue?.value;return o?.symbolIdValue?.guid?{guidValue:o.symbolIdValue.guid}:o?.boolValue!==void 0?{boolValue:o.boolValue}:o?.textValue!==void 0?{textValue:o.textValue}:o?.textDataValue!==void 0?{textDataValue:o.textDataValue}:i?e.propDefaults.get(t)??n.value:n.value}function Ko(e,n,t=!1){let i=new Map;for(let o of n){if(!o.defID)continue;let r=T(o.defID);i.set(r,Rl(e,o,r,t))}return i}function xt(e,n,t,i){Vt(e,t)&&i?.add(n)}function Ol(e,n,t,i){t.boolValue!==void 0&&xt(e,n,{targetId:n,source:"component-prop",props:{visible:t.boolValue}},i)}function bl(e,n,t,i){let o=e.graph.getNode(n),r=Wo(t);if(r===void 0||o?.type!=="TEXT")return;let a=o.componentId?e.graph.getNode(o.componentId):null,s={text:r};a?.type==="TEXT"&&a.text===r&&(s.width=a.width,s.height=a.height,s.fills=W(a.fills),s.styleRuns=ce(a.styleRuns),s.figmaDerivedTextGlyphs=a.figmaDerivedTextGlyphs?structuredClone(a.figmaDerivedTextGlyphs):void 0),xt(e,n,{targetId:n,source:"component-prop",props:s},i)}function vl(e,n,t,i){let o=Wo(t)??(t.guidValue?T(t.guidValue):void 0),r=o?e.guidToNodeId.get(o):void 0;r&&xt(e,n,{targetId:n,source:"component-prop",swapComponentId:ge(e,r)},i)}function Pl(e,n,t,i,o){switch(t.componentPropNodeField){case"VISIBLE":Ol(e,n,i,o);break;case"TEXT_DATA":bl(e,n,i,o);break;case"OVERRIDDEN_SYMBOL_ID":vl(e,n,i,o);break}}function bt(e,n,t){let i=n;for(let o=0;i&&o<10;o++){let r=e.graph.getNode(i),a=r?.overrideKey?e.overrideKeyToGuid.get(r.overrideKey)??r.overrideKey:void 0,s=e.nodeIdToGuid.get(i)??a;if(s){let u=t.get(s);if(u)return u}let l=r?.componentId??void 0;if(l===i)break;i=l}}function Ll(e,n,t){let i=Vo(n),o=[];for(let r of t.keys()){let a=e.propNames.get(r);a&&Vo(a)===i&&o.push({defID:Dl(r),componentPropNodeField:"VISIBLE"})}return o.length>0?o:void 0}function Ml(e,n){return e.defID?n.get(T(e.defID)):void 0}function _l(e,n,t,i,o){if(t)for(let r of t){let a=Ml(r,i);a&&Pl(e,n,r,a,o)}}function Vl(e,n,t,i){if(!n)return;let o=e.graph.getNode(n);if(!o)return;let r;for(let a of o.childIds){let s=e.graph.getNode(a);if(s){if(s.id===t.componentId||s.componentId&&s.componentId===t.componentId)return bt(e,s.id,i)??[];!r&&s.name===t.name&&s.type===t.type&&(r=s.id)}}return r?bt(e,r,i):void 0}function wn(e,n,t,i,o){let r=e.graph.getNode(n);if(r)for(let a of r.childIds){let s=e.graph.getNode(a);if(!s?.componentId){wn(e,a,t,i,o);continue}_l(e,a,Vl(e,r.componentId,s,i)??bt(e,s.componentId,i)??Ll(e,s.name,t),t,o),wn(e,a,t,i,o)}}function xl(e,n,t,i){for(let[o,r]of n){let a=e.guidToNodeId.get(o);!a||e.activeNodeIds&&!e.activeNodeIds.has(a)||e.graph.getNode(a)?.type==="INSTANCE"&&wn(e,a,Ko(e,r),t,i)}}function Gl(e,n,t){let i=Al(e),o=new Map;for(let[r,a]of e.changeMap){let s=e.guidToNodeId.get(r);if(!s||e.activeNodeIds&&!e.activeNodeIds.has(s)||e.graph.getNode(s)?.type!=="INSTANCE")continue;let l=a.symbolData?.symbolOverrides;if(l)for(let u of l){if(!u.componentPropAssignments?.length)continue;let c=u.guidPath?.guids;if(!c?.length)continue;let d=Ko(e,u.componentPropAssignments,!0);for(let f of Nl(s,i,o)){let g=_t(e,f,c);g&&wn(e,g,d,n,t)}}}}function kl(e){if(e.componentPropRefsMap)return e.componentPropRefsMap;let n=new Map;for(let[t,i]of e.changeMap)i.componentPropRefs?.length&&n.set(t,i.componentPropRefs);return e.componentPropRefsMap=n,n}function Fl(e){if(e.componentPropAssignmentsMap)return e.componentPropAssignmentsMap;let n=new Map;for(let[t,i]of e.changeMap)i.componentPropAssignments?.length&&n.set(t,i.componentPropAssignments);return e.componentPropAssignmentsMap=n,n}function Ct(e){let n=new Set,t=kl(e);return t.size===0||(xl(e,Fl(e),t,n),Gl(e,t,n)),n}var Yo=10;function wl(e){let{graph:n}=e,t=new Set;for(let i of pe(n,e.activeNodeIds)){if(i.type!=="INSTANCE"||!i.componentId)continue;let o=n.getNode(i.componentId);if(!o||o.width<=0||o.height<=0)continue;let r=Ul(n,i,o);if(!r||(Yl(e,i,r.basis),i.layoutMode!=="NONE"))continue;let{sx:a,sy:s}=r;if(Math.abs(a-1)<.001&&Math.abs(s-1)<.001)continue;let l=e.nodeIdToGuid.get(i.id),u=l?e.changeMap.get(l)?.strokeWeight:void 0;jo(n,i,o,a,s,t,e.geometryOverrideNodes,r.useCurrentChildAsSource,u,r.scaleThroughFixedWrappers)}t.size>0&&ql(e,t)}function Ul(e,n,t){let i=Bl(n),o=Xl(e,n,t);if(!i&&!o)return null;let r=o??t;return{basis:r,scaleThroughFixedWrappers:i!==null,sx:n.width/r.width,sy:n.height/r.height,useCurrentChildAsSource:r!==t}}function Bl(e){let n=zt(e,"targetAspectRatio");if(!n||typeof n!="object"||!("value"in n))return null;let t=n.value;if(!t||typeof t!="object"||!("x"in t)||!("y"in t))return null;let{x:i,y:o}=t;return typeof i!="number"||typeof o!="number"||!Number.isFinite(i)||!Number.isFinite(o)||i<=0||o<=0?null:{width:i,height:o}}function Hl(e,n,t){let i=n;for(let o=0;o<Yo&&i?.componentId;o++){if(i.componentId===t)return!0;i=e.getNode(i.componentId)}return!1}function zl(e,n,t){let i={},o=n.horizontalConstraint==="MAX"||n.horizontalConstraint==="CENTER",r=n.verticalConstraint==="MAX"||n.verticalConstraint==="CENTER";return o&&n.figmaDerivedLayout?.x===void 0&&!tn(e.protectedFields,n.id,"x")&&n.x!==t.x&&(i.x=t.x),r&&n.figmaDerivedLayout?.y===void 0&&!tn(e.protectedFields,n.id,"y")&&n.y!==t.y&&(i.y=t.y),i}function Wl(e,n,t){let i={};return n.horizontalConstraint==="STRETCH"&&n.figmaDerivedLayout?.width===void 0&&!tn(e.protectedFields,n.id,"width")&&n.width!==t.width&&(i.width=t.width),n.verticalConstraint==="STRETCH"&&n.figmaDerivedLayout?.height===void 0&&!tn(e.protectedFields,n.id,"height")&&n.height!==t.height&&(i.height=t.height),i}function Kl(e,n,t){return{...zl(e,n,t),...Wl(e,n,t)}}function Yl(e,n,t){let i=Math.min(n.childIds.length,t.childIds.length);for(let o=0;o<i;o++){let r=e.graph.getNode(n.childIds[o]),a=e.graph.getNode(t.childIds[o]);if(!r||!a||r.layoutPositioning!=="ABSOLUTE"||r.componentId&&!Hl(e.graph,r,a.id))continue;let s=Kl(e,r,Co(a,t,n,r.horizontalConstraint,r.verticalConstraint));Object.keys(s).length>0&&e.graph.updateNode(r.id,s)}}function Xl(e,n,t){if(n.width!==t.width||n.height!==t.height)return t;let i=t;for(let o=0;o<Yo&&i.type==="INSTANCE"&&i.componentId;o++){let r=e.getNode(i.componentId);if(!r||r.width<=0||r.height<=0)break;if(n.width!==r.width||n.height!==r.height)return r;i=r}return null}function jl(e,n,t){return e?{vertices:e.vertices.map(i=>({...i,x:i.x*n,y:i.y*t})),segments:e.segments.map(i=>({...i,tangentStart:{x:i.tangentStart.x*n,y:i.tangentStart.y*t},tangentEnd:{x:i.tangentEnd.x*n,y:i.tangentEnd.y*t}})),regions:structuredClone(e.regions)}:null}function $l(e,n,t,i,o){if(e.strokes.length!==n.strokes.length||Math.abs(t-i)>=.001)return;let r=o??1;return n.strokes.map((a,s)=>({...a,weight:e.strokes[s].weight*r}))}function Zl(e,n,t,i){let o={};return!i&&e.fillGeometry.length>0&&(o.fillGeometry=De(e.fillGeometry,n,t)),!i&&e.strokeGeometry.length>0&&(o.strokeGeometry=De(e.strokeGeometry,n,t)),e.vectorNetwork&&(o.vectorNetwork=jl(e.vectorNetwork,n,t)),o}function Xo(e,n,t){let i=t.get(n.id);if(i)return i;let o={horizontal:!1,vertical:!1};for(let r of e.getChildren(n.id)){let a=Xo(e,r,t);if(o.horizontal||=r.horizontalConstraint==="SCALE"||a.horizontal,o.vertical||=r.verticalConstraint==="SCALE"||a.vertical,o.horizontal&&o.vertical)break}return t.set(n.id,o),o}function Jl(e,n,t,i){let o=Xo(e,n,i);return{horizontal:n.horizontalConstraint==="SCALE"||t&&o.horizontal,vertical:n.verticalConstraint==="SCALE"||t&&o.vertical}}function jo(e,n,t,i,o,r,a,s=!1,l,u=!1,c=new Map){let d=Math.min(n.childIds.length,t.childIds.length);for(let f=0;f<d;f++){let g=e.getNode(n.childIds[f]),m=e.getNode(t.childIds[f]);if(!g||!m)continue;let p=Jl(e,g,u,c),h=p.horizontal,I=p.vertical;if(!h&&!I)continue;let y={},E=s?g:m;h&&(y.x=E.x*i,y.width=E.width*i),I&&(y.y=E.y*o,y.height=E.height*o);let b=h?i:1,C=I?o:1;Object.assign(y,Zl(E,b,C,a.has(g.id))),y.strokes=$l(E,g,b,C,l),e.updateNode(g.id,y),r.add(g.id),g.childIds.length>0&&m.childIds.length>0&&jo(e,g,m,h?i:1,I?o:1,r,a,s,l,u,c)}}function ql(e,n){let{graph:t}=e,i=xe(t,e.activeNodeIds),o=[...n],r=new Set,a=0;for(;a<o.length;){let s=o[a];a++;let l=t.getNode(s);if(!l)continue;let u=i.get(s);if(u)for(let c of u){if(r.has(c))continue;r.add(c);let d=t.getNode(c);if(!d)continue;let f={};d.width!==l.width&&(f.width=l.width),d.height!==l.height&&(f.height=l.height),d.x!==l.x&&(f.x=l.x),d.y!==l.y&&(f.y=l.y),e.geometryOverrideNodes.has(c)||(l.fillGeometry.length>0&&(f.fillGeometry=ie(l.fillGeometry)),l.strokeGeometry.length>0&&(f.strokeGeometry=ie(l.strokeGeometry)),l.vectorNetwork&&(f.vectorNetwork=structuredClone(l.vectorNetwork))),l.strokes.length===d.strokes.length&&(f.strokes=d.strokes.map((g,m)=>({...g,weight:l.strokes[m].weight}))),Object.keys(f).length>0&&t.updateNode(c,f),o.push(c)}}}function Ql(e,n,t,i,o,r){let a=i.guidPath?.guids;if(!a?.length)return;let s=_t(e,t,a);if(!s)return;if(s===t){r.add(t);return}let l=e.graph.getNode(s);if(!l)return;let{updates:u,hasSize:c}=xs(e,n,i,l);(i.fillGeometry?.length||i.strokeGeometry?.length)&&e.geometryOverrideNodes.add(s),Object.keys(u).length!==0&&(Vt(e,{targetId:s,source:"derived-symbol-data",props:u})&&o.add(s),c&&r.add(s))}function eu(e){let n=new Set,t=new Set,i=new Map;for(let[o,r]of e.changeMap){if(r.type!=="INSTANCE")continue;let a=r.derivedSymbolData;if(!a?.length)continue;let s=e.guidToNodeId.get(o);if(!(!s||e.activeNodeIds&&!e.activeNodeIds.has(s)))for(let l of a)Ql(e,i,s,l,n,t)}return{modified:n,sizeSet:t}}function nu(e){let{modified:n,sizeSet:t}=eu(e);El(e,n,t)}function tu(e,n){let t=new Set,i=[...n],o=0;for(;o<i.length;){let r=i[o];if(o++,t.has(r))continue;t.add(r);let a=e.getNode(r);a&&i.push(...a.childIds)}return t}function xo(e,n){let t=new Set;function i(s){let l=e.getNode(s);if(l?.type!=="INSTANCE"||!l.componentId||l.childIds.length>0||t.has(s))return;t.add(s);let u=e.getNode(l.componentId);if(u){u.type==="INSTANCE"&&u.componentId&&u.childIds.length===0&&i(u.id);for(let c of u.childIds){let d=e.getNode(c);d?.type==="INSTANCE"&&d.componentId&&d.childIds.length===0&&i(c)}u.childIds.length>0&&l.childIds.length===0&&e.populateInstanceChildren(s,l.componentId,"fig-import")}}if(!n){for(let s of e.nodes.values())s.type==="INSTANCE"&&s.componentId&&s.childIds.length===0&&i(s.id);return}let o=[...n],r=new Set,a=0;for(;a<o.length;){let s=o[a];if(a++,!s||r.has(s))continue;r.add(s),i(s);let l=e.getNode(s);l&&o.push(...l.childIds)}return tu(e,n)}function iu(e,n){if(e.textData!=null){let t=e.textData;t.characters!=null&&(n.text=t.characters);let i=Pn(e);i.length>0&&(n.styleRuns=i)}if(e.fillPaints!=null&&(n.fills=fe(e.fillPaints)),e.strokePaints!=null&&(n.strokes=Cn(e.strokePaints,e.strokeWeight,e.strokeAlign)),e.fillPaints!=null||e.strokePaints!=null){let t=vn(e);Object.keys(t).length>0&&(n.boundVariables=t)}e.effects!=null&&(n.effects=Rn(e.effects)),e.visible!=null&&(n.visible=e.visible),e.opacity!=null&&(n.opacity=e.opacity),e.name!=null&&(n.name=e.name),e.locked!=null&&(n.locked=e.locked)}function ou(e,n){if(e.size!=null){let t=e.size;t.x!=null&&(n.width=t.x),t.y!=null&&(n.height=t.y)}e.cornerRadius!=null&&(n.cornerRadius=e.cornerRadius),e.rectangleTopLeftCornerRadius!=null&&(n.topLeftRadius=e.rectangleTopLeftCornerRadius),e.rectangleTopRightCornerRadius!=null&&(n.topRightRadius=e.rectangleTopRightCornerRadius),e.rectangleBottomRightCornerRadius!=null&&(n.bottomRightRadius=e.rectangleBottomRightCornerRadius),e.rectangleBottomLeftCornerRadius!=null&&(n.bottomLeftRadius=e.rectangleBottomLeftCornerRadius),e.rectangleCornerRadiiIndependent!=null&&(n.independentCorners=e.rectangleCornerRadiiIndependent),e.arcData!=null&&(n.arcData=Gn(e.arcData)),e.frameMaskDisabled!=null&&(n.clipsContent=e.frameMaskDisabled===!1)}function ru(e,n){e.stackSpacing!=null&&(n.itemSpacing=e.stackSpacing),e.stackPrimarySizing!=null&&(n.primaryAxisSizing=Pe(e.stackPrimarySizing)),e.stackCounterSizing!=null&&(n.counterAxisSizing=Pe(e.stackCounterSizing)),e.stackPrimaryAlignItems!=null&&(n.primaryAxisAlign=_n(e.stackPrimaryAlignItems)),e.stackCounterAlignItems!=null&&(n.counterAxisAlign=Vn(e.stackCounterAlignItems)),e.stackChildPrimaryGrow!=null&&(n.layoutGrow=e.stackChildPrimaryGrow),e.stackChildAlignSelf!=null&&(n.layoutAlignSelf=xn(e.stackChildAlignSelf)),e.stackPositioning!=null&&(n.layoutPositioning=e.stackPositioning==="ABSOLUTE"?"ABSOLUTE":"AUTO"),e.stackVerticalPadding!=null&&(n.paddingTop=e.stackVerticalPadding,e.stackPaddingBottom==null&&(n.paddingBottom=e.stackVerticalPadding)),e.stackHorizontalPadding!=null&&(n.paddingLeft=e.stackHorizontalPadding,e.stackPaddingRight==null&&(n.paddingRight=e.stackHorizontalPadding)),e.stackPaddingBottom!=null&&(n.paddingBottom=e.stackPaddingBottom),e.stackPaddingRight!=null&&(n.paddingRight=e.stackPaddingRight)}function au(e,n){if(e.strokeWeight!=null&&!e.strokePaints&&n.strokes)for(let t of n.strokes)t.weight=e.strokeWeight;if(e.strokeAlign!=null&&n.strokes){let t="CENTER";e.strokeAlign==="INSIDE"?t="INSIDE":e.strokeAlign==="OUTSIDE"&&(t="OUTSIDE");for(let i of n.strokes)i.align=t}e.borderTopWeight!=null&&(n.borderTopWeight=e.borderTopWeight),e.borderRightWeight!=null&&(n.borderRightWeight=e.borderRightWeight),e.borderBottomWeight!=null&&(n.borderBottomWeight=e.borderBottomWeight),e.borderLeftWeight!=null&&(n.borderLeftWeight=e.borderLeftWeight),e.borderStrokeWeightsIndependent!=null&&(n.independentStrokeWeights=e.borderStrokeWeightsIndependent)}function su(e,n){if(e.fontName!=null){let t=e.fontName;t.family&&(n.fontFamily=t.family),t.style&&(n.fontWeight=Ce(t.style),n.italic=t.style.toLowerCase().includes("italic"))}e.fontSize!=null&&(n.fontSize=e.fontSize),e.textAlignHorizontal!=null&&(n.textAlignHorizontal=e.textAlignHorizontal),e.textAutoResize!=null&&(n.textAutoResize=e.textAutoResize),e.lineHeight!=null&&(n.lineHeight=Me(e.lineHeight,e.fontSize)),e.letterSpacing!=null&&(n.letterSpacing=_e(e.letterSpacing,e.fontSize)),e.maxLines!=null&&(n.maxLines=e.maxLines),e.textTruncation!=null&&(n.textTruncation=e.textTruncation==="ENDING"?"ENDING":"DISABLED"),e.textDecoration!=null&&(n.textDecoration=en(e.textDecoration))}function lu(e){let n={};return iu(e,n),ou(e,n),ru(e,n),au(e,n),su(e,n),n}var uu=new Set(["RECTANGLE_TOP_LEFT_CORNER_RADIUS","RECTANGLE_TOP_RIGHT_CORNER_RADIUS","RECTANGLE_BOTTOM_LEFT_CORNER_RADIUS","RECTANGLE_BOTTOM_RIGHT_CORNER_RADIUS"]);function cu(e){return e.version?`${e.key}@${e.version}`:e.key}function $o(e,n){if(e.guid)return T(e.guid);let t=e.assetRef;if(t?.key)return n.get(cu(t))??n.get(t.key)}function Zo(e,n,t,i=0){if(i>10)return;let o=e.changeMap.get(n)?.variableDataValues?.entries?.[0];if(!o)return;let r=o.variableData.value;if(!r)return;if(typeof r.floatValue=="number")return r.floatValue;let a=r.alias,s=a?$o(a,t):void 0;return s?Zo(e,s,t,i+1):void 0}function du(e,n,t){let i=n.variableConsumptionMap?.entries;if(!i?.length)return;let o=e.assetRefToGuid;for(let r of i){let a=r.variableField;if(!a||!uu.has(a))continue;let s=r.variableData?.value?.alias,l=s?$o(s,o):void 0,u=l?Zo(e,l,o):void 0;if(typeof u!="number")continue;let c=On[a];c==="topLeftRadius"?t.topLeftRadius=u:c==="topRightRadius"?t.topRightRadius=u:c==="bottomRightRadius"?t.bottomRightRadius=u:c==="bottomLeftRadius"&&(t.bottomLeftRadius=u)}}function fu(e,n,t){let i={targetId:n,source:"symbol-override"};if(t.overriddenSymbolID){let r=T(t.overriddenSymbolID);i.swapComponentId=e.guidToNodeId.get(r)}let o={...t};if(delete o.guidPath,delete o.overriddenSymbolID,delete o.componentPropAssignments,Object.keys(o).length>0){nn(e.changeMap,o);let r=lu(o);du(e,o,r),Object.keys(r).length>0&&(i.props=r)}return i.swapComponentId||i.props?i:null}function gu(e,n){return n!==void 0&&(!e.activeNodeIds||e.activeNodeIds.has(n))}function pu(e,n,t,i){!e||t!==n||!i?.props||(delete i.props.width,delete i.props.height)}function Go(e,n=!1){let t=new Set;e.componentIdRoot.clear();for(let[i,o]of e.changeMap){if(o.type!=="INSTANCE")continue;let r=o.symbolData?.symbolOverrides;if(!r?.length)continue;let a=e.guidToNodeId.get(i);if(gu(e,a))for(let s of r){let l=s.guidPath?.guids;if(!l?.length)continue;let u=_t(e,a,l);if(!u||u===a&&e.kiwiPropertyNodes.has(a))continue;let c=fu(e,u,s);c&&(pu(o.size!==void 0,a,u,c),n&&(c.swapComponentId=void 0),!(!c.swapComponentId&&!c.props)&&(t.add(u),Vt(e,c)))}}return t}function*Jo(e,n){for(let[t,i]of n){let o=e.get(t);o&&(yield[i,o])}}function mu(e,n,t){let i=new Set;for(let[o,r]of Jo(n,t)){let a=r,s=e.getNode(o);if(!s?.componentId)continue;let l=e.getNode(s.componentId);if(!l)continue;let u=(a.cornerRadius!==void 0||a.rectangleCornerRadiiIndependent!==void 0)&&s.cornerRadius!==l.cornerRadius,c=a.visible===!1&&l.visible,d=a.fillPaints!==void 0&&!q(s.fills,l.fills),f=a.strokePaints!==void 0&&!q(s.strokes,l.strokes),g=a.textData!==void 0&&s.type==="TEXT"&&l.type==="TEXT"&&s.text!==l.text;(u||c||d||f||g)&&i.add(o)}return i}function hu(e,n){let t=new Set;for(let[i,o]of Jo(e,n))(o.fillGeometry?.length||o.strokeGeometry?.length)&&t.add(i);return t}function Iu(e){let n=[];for(let t of e.getAllNodes())t.componentId&&n.push(t);return n}function Tu(e){let n=[];for(let t of e.getAllNodes()){if(t.type!=="INSTANCE"||!t.componentId)continue;let i=e.getNode(t.componentId);if(!(!i||i.childIds.length!==t.childIds.length))for(let o=0;o<t.childIds.length;o++)n.push({sourceChildId:i.childIds[o],childId:t.childIds[o]})}return n}function yu(e,n,t=Iu(e)){for(let i=0;i<10;i++){let o=!1;for(let r of t){if(!r.componentId)continue;let a=e.getNode(r.componentId);!a||q(a.fills,r.fills)||n.has(r.id)&&!n.has(a.id)||(e.updateNode(r.id,{fills:W(a.fills)}),o=!0)}if(!o)return}}function Su(e,n=Tu(e)){for(let t=0;t<10;t++){let i=!1;for(let o of n){let r=e.getNode(o.sourceChildId),a=e.getNode(o.childId);if(!r||!a||r.overrideKey&&a.overrideKey&&r.overrideKey!==a.overrideKey)continue;let s={};!r.visible&&a.visible&&(s.visible=!1),r.x!==a.x&&(s.x=r.x),r.y!==a.y&&(s.y=r.y),Object.keys(s).length!==0&&(e.updateNode(a.id,s),i=!0)}if(!i)return}}function Eu(e,n){return e===n?!0:!e||!n?!1:In(e,n)}function Au(e,n){let t=[],i=new Set,o=new Set,r=a=>{if(i.has(a.id)||o.has(a.id))return;o.add(a.id);let s=a.componentId?e.getNode(a.componentId):void 0;s?.type==="TEXT"&&r(s),o.delete(a.id),i.add(a.id),a.type==="TEXT"&&a.componentId&&t.push(a)};for(let a of n??e.nodes.keys()){let s=e.getNode(a);s?.type==="TEXT"&&s.componentId&&r(s)}for(let a of t){let s=a.componentId?e.getNode(a.componentId):void 0;s?.type!=="TEXT"||s.text!==a.text||s.width===a.width&&s.height===a.height&&q(s.fills,a.fills)&&q(s.styleRuns,a.styleRuns)&&Eu(s.figmaDerivedTextGlyphs,a.figmaDerivedTextGlyphs)||e.updateNode(a.id,{width:s.width,height:s.height,fills:W(s.fills),styleRuns:ce(s.styleRuns),figmaDerivedTextGlyphs:s.figmaDerivedTextGlyphs?Y(s.figmaDerivedTextGlyphs,structuredClone(s.figmaDerivedTextGlyphs)):void 0})}}function Nu(e,n,t,i,o){let r=new Map,a=new Map;for(let[f,g]of n)g.overrideKey&&r.set(T(g.overrideKey),f),typeof g.key=="string"&&(a.set(g.key,f),typeof g.version=="string"&&a.set(`${g.key}@${g.version}`,f));let s=new Map,l=new Map;for(let[,f]of n)if(f.componentPropDefs?.length)for(let g of f.componentPropDefs){if(!g.id)continue;let m=T(g.id);g.initialValue&&s.set(m,g.initialValue),g.name&&l.set(m,g.name)}let u=new Map;for(let[f,g]of t)u.set(g,f);let c=mu(e,n,t),d=hu(n,t);return{graph:e,changeMap:n,guidToNodeId:t,blobs:i,overrideKeyToGuid:r,assetRefToGuid:a,nodeIdToGuid:u,propDefaults:s,propNames:l,preComputedRoot:new Map,preComputedClones:new Map,componentIdRoot:new Map,swappedInstances:new Set,protectedFields:new Map,kiwiPropertyNodes:c,geometryOverrideNodes:d,activeNodeIds:o}}function Du(e,n){for(let t of pe(e,n)){let i={};for(let[o,r]of Object.entries(t.boundVariables)){if(Array.isArray(r))continue;let a=e.resolveNumberVariableForNode(t.id,r);a!==void 0&&Object.assign(i,St(o,a))}Object.keys(i).length>0&&e.updateNode(t.id,i)}}function Bn(e,n,t,i=[],o){let r=Nu(e,n,t,i,xo(e,o));Us(r);let a=Go(r);for(let u of r.kiwiPropertyNodes)a.add(u);Dt(e,a,r.swappedInstances,r.componentIdRoot,void 0,r.activeNodeIds,r.protectedFields);let s=Ct(r);if(s.size>0&&Dt(e,s,r.swappedInstances,r.componentIdRoot,a,r.activeNodeIds,r.protectedFields),o){let u=xo(e,o);u&&(r.activeNodeIds=u,Fo(e,u,r.preComputedClones));let c=Ct(r),d=new Set([...a,...s,...c]);d.size>0&&Dt(e,d,r.swappedInstances,r.componentIdRoot,a,r.activeNodeIds,r.protectedFields),Su(e)}nu(r),yu(e,new Set([...r.kiwiPropertyNodes,...a])),Au(e,r.activeNodeIds),wl(r);let l=new Set;for(let u of pe(e,r.activeNodeIds)){if(u.type!=="INSTANCE"||!u.componentId)continue;let c=e.getNode(u.componentId);c&&(u.width!==c.width||u.height!==c.height)&&l.add(u.id)}Ct(r),fl(e,Go(r,!0),r.activeNodeIds,r.protectedFields,r.preComputedClones),ml(r,l),Du(e,r.activeNodeIds),Sl(r)}var qo=new WeakMap;function Gt(e,n){qo.set(e,n)}function on(e){return qo.get(e)}function Cu(e,n,t){e.preserveSourceMetadataDuring(()=>{Bn(e,n.changeMap,n.guidToNodeId,n.blobs,t)});let i=t??e.getPages(!0).map(o=>o.id);for(let o of i)n.populatedRootIds.add(o)}function Ru(e,n,t){let i=[...t].filter(o=>o&&!n.populatedRootIds.has(o));return i.length===0?!1:(Cu(e,n,i),!0)}function Qo(e,n){let t=on(e);return t?Ru(e,t,n):!1}function er(e){let n=new Set(e.nodes.keys()),t=new Map,i=new Set,o=new Set,r={createNode:e.createNode.bind(e),createNodeWithId:e.createNodeWithId.bind(e),updateNode:e.updateNode.bind(e),deleteNode:e.deleteNode.bind(e)};function a(s,l){if(!s||i.has(s))return;let u=e.getNode(s);if(!u)return;let c=t.get(s)??{};t.set(s,c);for(let d of l)d in c||Object.assign(c,{[d]:structuredClone(u[d])})}return e.createNode=((s,l,u)=>{a(l,["childIds"]);let c=r.createNode(s,l,u);return i.add(c.id),c}),e.createNodeWithId=((s,l,u,c)=>{a(u,["childIds"]);let d=r.createNodeWithId(s,l,u,c);return i.add(d.id),d}),e.updateNode=((s,l)=>{let u=e.getNode(s);if(u){let c=Object.keys(l).filter(d=>!q(u[d],l[d]));c.length>0&&c.push("source"),"componentId"in l&&c.push("componentId"),("fills"in l||"strokes"in l)&&c.push("boundVariables"),a(s,c)}r.updateNode(s,l)}),e.deleteNode=(s=>{let l=e.getNode(s);a(l?.parentId,["childIds"]);let u=l?[s]:[];for(;u.length>0;){let c=u.pop();if(!c)continue;let d=e.getNode(c);d&&u.push(...d.childIds),n.has(c)?o.add(c):(i.delete(c),t.delete(c))}r.deleteNode(s)}),{before:t,created:i,deleted:o,stop(){e.createNode=r.createNode,e.createNodeWithId=r.createNodeWithId,e.updateNode=r.updateNode,e.deleteNode=r.deleteNode}}}function nr(e,n,t){let i=[];for(let[o,r]of n.before){let a=e.getNode(o);if(!a||n.deleted.has(o))continue;let s={};for(let l of Object.keys(r))q(r[l],a[l])||Object.assign(s,{[l]:structuredClone(a[l])});Object.keys(s).length>0&&i.push([o,s])}return{created:[...n.created].map(o=>e.getNode(o)).filter(o=>o!==void 0).map(o=>[o.id,structuredClone(o)]),updated:i,deleted:[...n.deleted],instanceIndex:[...e.instanceIndex].map(([o,r])=>[o,[...r]]),populatedRootIds:[...t]}}function tr(e){let n=on(e);return{rootId:e.rootId,nodes:[...e.nodes],images:[...e.images],variables:[...e.variables],variableCollections:[...e.variableCollections],activeMode:[...e.activeMode],instanceIndex:[...e.instanceIndex].map(([t,i])=>[t,[...i]]),figKiwiVersion:e.figKiwiVersion,figSchemaDeflated:e.figSchemaDeflated,documentColorSpace:e.documentColorSpace,lazyFigImport:n?{changeMap:[...n.changeMap],guidToNodeId:[...n.guidToNodeId],blobs:n.blobs,populatedRootIds:[...n.populatedRootIds]}:void 0}}function ir(e){let n=new Set;for(let[,t]of e.images)t.buffer instanceof ArrayBuffer&&t.byteOffset===0&&t.byteLength===t.buffer.byteLength&&n.add(t.buffer);for(let t of e.lazyFigImport?.blobs??[])t.buffer instanceof ArrayBuffer&&t.byteOffset===0&&t.byteLength===t.buffer.byteLength&&n.add(t.buffer);return e.figSchemaDeflated&&e.figSchemaDeflated.buffer instanceof ArrayBuffer&&e.figSchemaDeflated.byteOffset===0&&e.figSchemaDeflated.byteLength===e.figSchemaDeflated.buffer.byteLength&&n.add(e.figSchemaDeflated.buffer),[...n]}var Ou=typeof window<"u",Hf=Ou&&"__TAURI_INTERNALS__"in window,or={r:0,g:0,b:0,a:1};var bu=[{id:"openrouter",name:"OpenRouter",keyPlaceholder:"sk-or-\u2026",keyURL:"https://openrouter.ai/keys",defaultModel:"anthropic/claude-sonnet-4.6",supportsCustomModel:!0,models:[{id:"anthropic/claude-sonnet-4.6",name:"Claude Sonnet 4.6",tag:"Best for design"},{id:"anthropic/claude-opus-4.6",name:"Claude Opus 4.6",tag:"Smartest"},{id:"moonshotai/kimi-k2.5",name:"Kimi K2.5",tag:"Vision + code"},{id:"google/gemini-3.1-pro-preview",name:"Gemini 3.1 Pro",tag:"1M context"},{id:"openai/gpt-5.3-codex",name:"GPT-5.3 Codex"},{id:"google/gemini-3-flash-preview",name:"Gemini 3 Flash",tag:"Fast"},{id:"deepseek/deepseek-v3.2",name:"DeepSeek V3.2",tag:"Cheap"},{id:"qwen/qwen3.5-flash-02-23",name:"Qwen 3.5 Flash",tag:"Cheap"},{id:"qwen/qwen3-coder:free",name:"Qwen3 Coder",tag:"Free"},{id:"openai/gpt-oss-120b:free",name:"GPT-OSS 120B",tag:"Free"}]},{id:"anthropic",name:"Anthropic",keyPlaceholder:"sk-ant-\u2026",keyURL:"https://console.anthropic.com/settings/keys",defaultModel:"claude-sonnet-4-6-20260301",models:[{id:"claude-sonnet-4-6-20260301",name:"Claude Sonnet 4.6",tag:"Best for design"},{id:"claude-opus-4-6-20260301",name:"Claude Opus 4.6",tag:"Smartest"}]},{id:"openai",name:"OpenAI",keyPlaceholder:"sk-\u2026",keyURL:"https://platform.openai.com/api-keys",defaultModel:"gpt-5.3-codex",models:[{id:"gpt-5.3-codex",name:"GPT-5.3 Codex"},{id:"gpt-4.1",name:"GPT-4.1"},{id:"o3",name:"o3",tag:"Reasoning"},{id:"o4-mini",name:"o4-mini",tag:"Fast reasoning"}]},{id:"google",name:"Google AI",keyPlaceholder:"AIza\u2026",keyURL:"https://aistudio.google.com/apikey",defaultModel:"gemini-3.1-pro-preview",models:[{id:"gemini-3.1-pro-preview",name:"Gemini 3.1 Pro",tag:"1M context"},{id:"gemini-3-flash-preview",name:"Gemini 3 Flash",tag:"Fast"}]},{id:"deepseek",name:"DeepSeek",keyPlaceholder:"sk-\u2026",keyURL:"https://platform.deepseek.com/api_keys",defaultModel:"deepseek-v4-flash",models:[{id:"deepseek-v4-flash",name:"DeepSeek V4 Flash",tag:"Fast"},{id:"deepseek-v4-pro",name:"DeepSeek V4 Pro",tag:"Reasoning"}]},{id:"zai",name:"Z.ai",keyPlaceholder:"API key",keyURL:"https://docs.z.ai/devpack/quick-start",defaultModel:"glm-5.1",models:[{id:"glm-5.1",name:"GLM-5.1",tag:"Best"},{id:"glm-5",name:"GLM-5"},{id:"glm-5-code",name:"GLM-5-Code"},{id:"glm-4.7",name:"GLM-4.7"},{id:"glm-4.7-flashx",name:"GLM-4.7-FlashX"},{id:"glm-4.6",name:"GLM-4.6"},{id:"glm-4.5",name:"GLM-4.5"},{id:"glm-4.5-x",name:"GLM-4.5-X"},{id:"glm-4.5-air",name:"GLM-4.5-Air"},{id:"glm-4.5-airx",name:"GLM-4.5-AirX"},{id:"glm-4-32b-0414-128k",name:"GLM-4-32B-0414-128K"},{id:"glm-4.7-flash",name:"GLM-4.7-Flash",tag:"Free"},{id:"glm-4.5-flash",name:"GLM-4.5-Flash",tag:"Free"}]},{id:"minimax",name:"MiniMax",keyPlaceholder:"API key",keyURL:"https://platform.minimax.io/user-center/basic-information/interface-key",defaultModel:"MiniMax-M3",models:[{id:"MiniMax-M3",name:"MiniMax-M3",tag:"Best"},{id:"MiniMax-M2.7",name:"MiniMax-M2.7"},{id:"MiniMax-M2.7-highspeed",name:"MiniMax-M2.7-highspeed",tag:"Fast"},{id:"MiniMax-M2.5",name:"MiniMax-M2.5"},{id:"MiniMax-M2.5-highspeed",name:"MiniMax-M2.5 Highspeed",tag:"Fast"},{id:"MiniMax-M2.1",name:"MiniMax-M2.1"},{id:"MiniMax-M2.1-highspeed",name:"MiniMax-M2.1 Highspeed",tag:"Fast"},{id:"MiniMax-M2",name:"MiniMax-M2"}]},{id:"openai-compatible",name:"OpenAI-compatible",keyPlaceholder:"API key",keyURL:"",defaultModel:"",models:[],supportsCustomBaseURL:!0,supportsCustomModel:!0},{id:"anthropic-compatible",name:"Anthropic-compatible",keyPlaceholder:"API key",keyURL:"",defaultModel:"",models:[],supportsCustomBaseURL:!0,supportsCustomModel:!0}];var zf=bu.find(e=>e.id==="openai-compatible")?.defaultModel??"";function vu(e,n){e.source.format="fig",e.source.orderKey=n.parentIndex?.position??null,n.backgroundColor&&(e.source.fig.rawNodeFields.backgroundColor=structuredClone(n.backgroundColor)),n.backgroundPaints&&(e.source.fig.rawNodeFields.backgroundPaints=structuredClone(n.backgroundPaints)),n.guides&&(e.source.fig.rawNodeFields.guides=structuredClone(n.guides)),e.source.fig.rawNodeFields.strokeJoin=n.strokeJoin,e.source.fig.rawNodeFields.strokeWeight=n.strokeWeight,n.pageType&&(e.source.fig.rawNodeFields.pageType=n.pageType)}function Pu(e,n){let t=e.getNode(e.rootId);!n||!t||(t.source.format="fig",t.source.fig.rawNodeFields.strokeJoin=n.strokeJoin,t.source.fig.rawNodeFields.strokeWeight=n.strokeWeight)}function Hn(e){return e.version?`${e.key}@${e.version}`:e.key}function Lu(e){let n=new Map;for(let[t,i]of e)typeof i.key=="string"&&((typeof i.version!="string"||!n.has(i.key))&&n.set(i.key,t),typeof i.version=="string"&&n.set(Hn({key:i.key,version:i.version}),t),typeof i.userFacingVersion=="string"&&n.set(Hn({key:i.key,version:i.userFacingVersion}),t));return n}function kt(e,n){if(e.guid)return T(e.guid);if(e.assetRef)return n.get(Hn(e.assetRef))??n.get(e.assetRef.key)}function Mu(e,n){let t=new Map,i=new Map;for(let[a,s]of e){if(s.type!=="VARIABLE")continue;t.set(a,s.variableDataValues?.entries??[]);let l=s.variableSetID?.guid?T(s.variableSetID.guid):void 0,u=s.parentIndex?.guid?T(s.parentIndex.guid):void 0;l?i.set(a,l):u&&i.set(a,u)}let o=new Map;for(let[a,s]of e){if(s.type!=="VARIABLE_SET")continue;let l=s.variableSetModes??[];l.length>0&&o.set(a,T(l[0].id))}function r(a,s,l){if(l>10)return null;let u=t.get(a);if(!u?.length)return null;let c=i.get(a),d=c?o.get(c):void 0,f=s?u.find(m=>T(m.modeID)===s):void 0;!f&&d&&(f=u.find(m=>T(m.modeID)===d)),f||(f=u[0]);let g=f.variableData.value;if(!g)return null;if(g.colorValue)return g.colorValue;if(g.alias){let m=kt(g.alias,n);if(m)return r(m,T(f.modeID),l+1)}return null}return function(s){let l=kt(s,n);return l?r(l,void 0,0):null}}function _u(e){let n=new Map,t=new Map,i=new Map;for(let o of e){if(!o.guid||o.phase==="REMOVED")continue;let r=T(o.guid);if(n.set(r,o),o.parentIndex?.guid){let a=T(o.parentIndex.guid);t.set(r,a);let s=i.get(a);s||(s=[],i.set(a,s)),s.push(r)}}for(let[o,r]of i){let a=n.get(o);a&&Nt(r,a,n)}return{changeMap:n,parentMap:t,childrenMap:i}}function Vu(e){return e==="COLOR"?"COLOR":e==="BOOLEAN"?"BOOLEAN":e==="STRING"?"STRING":"FLOAT"}function xu(e,n){let t=e.variableData;if(!t.value)return;let i=t.dataType??t.resolvedDataType;if(i==="COLOR"&&t.value.colorValue){let o=t.value.colorValue;return{r:o.r,g:o.g,b:o.b,a:o.a}}if(i==="BOOLEAN")return t.value.boolValue??!1;if(i==="STRING")return t.value.textValue??"";if(i==="ALIAS"&&t.value.alias){let o=kt(t.value.alias,n);return o?{aliasId:o}:void 0}return t.value.floatValue??0}function Gu(e){return e==="BOOLEAN"?!1:e==="STRING"?"":e==="COLOR"?{...or}:0}function ku(e,n){for(let[t,i]of e){if(i.type!=="VARIABLE_SET")continue;let o=(i.variableSetModes??[]).map(r=>({modeId:T(r.id),name:r.name}));o.length===0&&o.push({modeId:"default",name:"Default"}),n.addCollection({id:t,name:i.name??"Variables",modes:o,defaultModeId:o[0].modeId,variableIds:[]})}}function Fu(e,n,t,i){if(e.variableSetID?.guid)return T(e.variableSetID.guid);let o=e.variableSetID?.assetRef;return o?i.get(Hn(o))??i.get(o.key)??"":t.get(n)??""}function wu(e,n,t){if(n.variableCollections.has(t))return;let i=e.get(t);n.addCollection({id:t,name:i?.name??"Variables",modes:[{modeId:"default",name:"Default"}],defaultModeId:"default",variableIds:[]})}function Uu(e,n,t,i){for(let[o,r]of e){if(r.type!=="VARIABLE")continue;let a=Fu(r,o,n,i);wu(e,t,a);let s=Vu(r.variableResolvedType),l={};if(r.variableDataValues?.entries)for(let u of r.variableDataValues.entries){let c=xu(u,i);c!==void 0&&(l[T(u.modeID)]=c)}if(Object.keys(l).length===0){let u=t.variableCollections.get(a)?.defaultModeId??"default";l[u]=Gu(s)}t.addVariable({id:o,name:r.name??"Variable",type:s,collectionId:a,valuesByMode:l,description:"",hiddenFromPublishing:!1,key:typeof r.key=="string"?r.key:void 0,version:typeof r.version=="string"?r.version:void 0})}}function Bu(e,n,t,i,o,r,a){let s=null;for(let[l,u]of n)if(u.type==="DOCUMENT"||l==="0:0"){s=l;break}if(s){Pu(e,n.get(s));for(let l of i.get(s)??[]){let u=n.get(l);if(u)if(u.type==="CANVAS"){let c=e.addPage(u.name??"Page");c.source.id=l,vu(c,u),r.set(l,c.id),u.internalOnly&&(c.internalOnly=!0),o.add(l);for(let d of i.get(l)??[])a(d,c.id)}else a(l,e.getPages()[0]?.id??e.rootId)}}else{let l=[];for(let[c]of n){let d=t.get(c);(!d||!n.has(d))&&l.push(c)}let u=e.getPages()[0]??e.addPage("Page 1");for(let c of l)a(c,u.id)}}function Hu(e,n,t){for(let[i,o]of e){if(!o.variableConsumptionMap?.entries?.length)continue;let r=n.get(i);if(r)for(let a of o.variableConsumptionMap.entries){let s=bn(a);s&&t.bindVariable(r,s.field,s.variableId)}}}function zu(e,n){for(let t of e.getAllNodes()){if(t.type!=="INSTANCE"||!t.componentId)continue;let i=n.get(t.componentId);i&&(t.componentId=i)}}function Wu(e){for(let n of e.getAllNodes()){if(n.type!=="COMPONENT"||n.variantPropSpecs.length===0||!n.parentId)continue;let t=e.getNode(n.parentId);if(t?.type!=="COMPONENT_SET")continue;let i=new Map(t.componentPropertyDefinitions.map(r=>[r.id,r.name])),o={};for(let r of n.variantPropSpecs)o[i.get(r.propDefId)??r.propDefId]=r.value;e.updateNode(n.id,{componentPropertyValues:o})}}function Ku(e){return e.find(n=>n.type==="DOCUMENT")?.documentColorProfile==="DISPLAY_P3"?"display-p3":"srgb"}function Yu(e,n){for(let t of e.values())nn(e,t,n)}function Xu(e,n,t,i,o){Gt(e,{changeMap:n,guidToNodeId:t,blobs:i,populatedRootIds:new Set(o)})}function ju(e){let n=new Set;for(let t of e.getAllNodes()){if(t.type!=="COMPONENT"&&t.type!=="COMPONENT_SET")continue;let i=t.parentId?e.getNode(t.parentId):void 0;for(;i?.parentId&&i.type!=="CANVAS";)i=e.getNode(i.parentId);i?.type==="CANVAS"&&n.add(i.id)}return n}function rr(e,n=[],t,i={}){let o=new mt;if(o.documentColorSpace=Ku(e),t)for(let[I,y]of t)o.images.set(I,y);for(let I of o.getPages(!0))o.deleteNode(I.id);let{changeMap:r,parentMap:a,childrenMap:s}=_u(e),l=Lu(r);Yu(r,l),Dn(Mu(r,l));let u=new Map,c=new Set,d=new Map,f=I=>s.get(I)??[];function g(I,y){if(c.has(I))return;c.add(I);let E=r.get(I);if(!E)return;let{nodeType:b,...C}=At(E,n);if(C.sharedStyleType&&(C.internalOnly=!0),b==="DOCUMENT"||b==="VARIABLE"||E.type==="VARIABLE_SET")return;Et(E,r.get(a.get(I)??""))&&(C.textAutoResize="WIDTH_AND_HEIGHT");let S=u.get(y)??y,L=o.createNode(b,S,C);d.set(I,L.id);for(let x of f(I))g(x,L.id)}Bu(o,r,a,s,c,u,g),ku(r,o),Uu(r,a,o,l),Hu(r,d,o),zu(o,d),Wu(o);let m=o.getPages()[0]?.id,p=i.populate==="first-page"?ju(o):new Set,h=i.populate==="first-page"?[m,...p].filter(rt):void 0;return i.populate!=="none"&&o.preserveSourceMetadataDuring(()=>{Bn(o,r,d,n,h)}),h&&Xu(o,r,d,n,h),Dn(null),o.getPages(!0).length===0&&o.addPage("Page 1"),o}var Bt=new Int32Array(1),cr=new Float32Array(Bt.buffer),cc=new TextDecoder,ln=class{_data;_index;length;constructor(e){if(e&&!(e instanceof Uint8Array))throw new Error("Must initialize a ByteBuffer with a Uint8Array");this._data=e||new Uint8Array(256),this._index=0,this.length=e?e.length:0}toUint8Array(){return this._data.subarray(0,this.length)}readByte(){return this._data[this._index++]}readByteArray(){let e=this.readVarUint(),n=this._index;return this._index=n+e,this._data.slice(n,n+e)}readVarFloat(){let e=this._index,n=this._data,t=n[e];if(t===0)return this._index=e+1,0;let i=t|n[e+1]<<8|n[e+2]<<16|n[e+3]<<24;return this._index=e+4,i=i<<23|i>>>9,Bt[0]=i,cr[0]}readVarUint(){let e=this._data,n=this._index,t=e[n++],i=t&127;return t<128?(this._index=n,i):(t=e[n++],i|=(t&127)<<7,t<128?(this._index=n,i):(t=e[n++],i|=(t&127)<<14,t<128?(this._index=n,i):(t=e[n++],i|=(t&127)<<21,t<128?(this._index=n,i):(t=e[n++],i|=(t&127)<<28,this._index=n,i>>>0))))}readVarInt(){let e=this.readVarUint()|0;return e&1?~(e>>>1):e>>>1}readVarUint64(){let e=BigInt(0),n=BigInt(0),t=BigInt(7),i;for(;(i=this.readByte())&128&&n<56;)e|=BigInt(i&127)<<n,n+=t;return e|=BigInt(i)<<n,e}readVarInt64(){let e=this.readVarUint64(),n=BigInt(1),t=e&n;return e>>=n,t?~e:e}readString(){let e=this._data,n=this._index,t=n;for(;e[t]!==0;)t++;return this._index=t+1,cc.decode(e.subarray(n,t))}_growBy(e){if(this.length+e>this._data.length){let n=new Uint8Array(this.length+e<<1);n.set(this._data),this._data=n}this.length+=e}writeByte(e){let n=this.length;this._growBy(1),this._data[n]=e}writeByteArray(e){this.writeVarUint(e.length);let n=this.length;this._growBy(e.length),this._data.set(e,n)}writeVarFloat(e){let n=this.length;cr[0]=e;let t=Bt[0];if(t=t>>>23|t<<9,(t&255)===0){this.writeByte(0);return}this._growBy(4);let i=this._data;i[n]=t,i[n+1]=t>>8,i[n+2]=t>>16,i[n+3]=t>>24}writeVarUint(e){if(e<0||e>4294967295)throw new Error("Outside uint range: "+e);do{let n=e&127;e>>>=7,this.writeByte(e?n|128:n)}while(e)}writeVarInt(e){if(e<-2147483648||e>2147483647)throw new Error("Outside int range: "+e);this.writeVarUint((e<<1^e>>31)>>>0)}writeVarUint64(e){if(typeof e=="string")e=BigInt(e);else if(typeof e!="bigint")throw new Error(`Expected bigint but got ${typeof e}: ${String(e)}`);if(e<0||e>BigInt("0xFFFFFFFFFFFFFFFF"))throw new Error("Outside uint64 range: "+e);let n=BigInt(127),t=BigInt(7);for(let i=0;e>n&&i<8;i++)this.writeByte(Number(e&n)|128),e>>=t;this.writeByte(Number(e))}writeVarInt64(e){if(typeof e=="string")e=BigInt(e);else if(typeof e!="bigint")throw new Error(`Expected bigint but got ${typeof e}: ${String(e)}`);if(e<-BigInt("0x8000000000000000")||e>BigInt("0x7FFFFFFFFFFFFFFF"))throw new Error("Outside int64 range: "+e);let n=BigInt(1);this.writeVarUint64(e<0?~(e<<n):e<<n)}writeString(e){let n;for(let t=0;t<e.length;t++){let i=e.charCodeAt(t);if(t+1===e.length||i<55296||i>=56320)n=i;else{let o=e.charCodeAt(++t);n=(i<<10)+o+-56613888}if(n===0)throw new Error("Cannot encode a string containing the null character");n<128?this.writeByte(n):(n<2048?this.writeByte(n>>6&31|192):(n<65536?this.writeByte(n>>12&15|224):(this.writeByte(n>>18&7|240),this.writeByte(n>>12&63|128)),this.writeByte(n>>6&63|128)),this.writeByte(n&63|128))}this.writeByte(0)}};function N(e){return JSON.stringify(e)}function F(e,n,t){var i=new Error(e);throw i.line=n,i.column=t,i}function dc(e,n){let t=[],i="  ";t.push("function (bb) {"),t.push("  var result = {};"),t.push("  if (!(bb instanceof this.ByteBuffer)) {"),t.push("    bb = new this.ByteBuffer(bb);"),t.push("  }"),t.push(""),e.kind==="MESSAGE"&&(t.push("  while (true) {"),t.push("    switch (bb.readVarUint()) {"),t.push("      case 0:"),t.push("        return result;"),t.push(""),i="        ");for(let o=0;o<e.fields.length;o++){let r=e.fields[o],a;switch(r.type){case"bool":a="!!bb.readByte()";break;case"byte":a="bb.readByte()";break;case"int":a="bb.readVarInt()";break;case"uint":a="bb.readVarUint()";break;case"float":a="bb.readVarFloat()";break;case"string":a="bb.readString()";break;case"int64":a="bb.readVarInt64()";break;case"uint64":a="bb.readVarUint64()";break;default:{let s=n[r.type];s?s.kind==="ENUM"?a="this["+N(s.name)+"][bb.readVarUint()]":a="this["+N("decode"+s.name)+"](bb)":F("Invalid type "+N(r.type)+" for field "+N(r.name),r.line,r.column)}}e.kind==="MESSAGE"&&t.push("      case "+r.value+":"),r.isArray?r.isDeprecated?r.type==="byte"?t.push(i+"bb.readByteArray();"):(t.push(i+"var length = bb.readVarUint();"),t.push(i+"while (length-- > 0) "+a+";")):r.type==="byte"?t.push(i+"result["+N(r.name)+"] = bb.readByteArray();"):(t.push(i+"var length = bb.readVarUint();"),t.push(i+"var values = result["+N(r.name)+"] = Array(length);"),t.push(i+"for (var i = 0; i < length; i++) values[i] = "+a+";")):r.isDeprecated?t.push(i+a+";"):t.push(i+"result["+N(r.name)+"] = "+a+";"),e.kind==="MESSAGE"&&(t.push("        break;"),t.push(""))}return e.kind==="MESSAGE"?(t.push("      default:"),t.push('        throw new Error("Attempted to parse invalid message");'),t.push("    }"),t.push("  }")):t.push("  return result;"),t.push("}"),t.join(`
`)}function fc(e,n){let t=[];t.push("function (message, bb) {"),t.push("  var isTopLevel = !bb;"),t.push("  if (isTopLevel) bb = new this.ByteBuffer();");for(let i=0;i<e.fields.length;i++){let o=e.fields[i],r;if(!o.isDeprecated){switch(o.type){case"bool":r="bb.writeByte(value);";break;case"byte":r="bb.writeByte(value);";break;case"int":r="bb.writeVarInt(value);";break;case"uint":r="bb.writeVarUint(value);";break;case"float":r="bb.writeVarFloat(value);";break;case"string":r="bb.writeString(value);";break;case"int64":r="bb.writeVarInt64(value);";break;case"uint64":r="bb.writeVarUint64(value);";break;default:{let a=n[o.type];if(a)a.kind==="ENUM"?r="var encoded = this["+N(a.name)+'][value]; if (encoded === void 0) throw new Error("Invalid value " + JSON.stringify(value) + '+N(" for enum "+N(a.name))+"); bb.writeVarUint(encoded);":r="this["+N("encode"+a.name)+"](value, bb);";else throw new Error("Invalid type "+N(o.type)+" for field "+N(o.name))}}t.push(""),t.push("  var value = message["+N(o.name)+"];"),t.push("  if (value != null) {"),e.kind==="MESSAGE"&&t.push("    bb.writeVarUint("+o.value+");"),o.isArray?o.type==="byte"?t.push("    bb.writeByteArray(value);"):(t.push("    var values = value, n = values.length;"),t.push("    bb.writeVarUint(n);"),t.push("    for (var i = 0; i < n; i++) {"),t.push("      value = values[i];"),t.push("      "+r),t.push("    }")):t.push("    "+r),e.kind==="STRUCT"&&(t.push("  } else {"),t.push("    throw new Error("+N("Missing required field "+N(o.name))+");")),t.push("  }")}}return e.kind==="MESSAGE"&&t.push("  bb.writeVarUint(0);"),t.push(""),t.push("  if (isTopLevel) return bb.toUint8Array();"),t.push("}"),t.join(`
`)}function gc(e){let n={},t=e.package,i=[];t!==null?i.push("var "+t+" = exports || "+t+" || {}, exports;"):(i.push("var exports = exports || {};"),t="exports"),i.push(t+".ByteBuffer = "+t+'.ByteBuffer || require("kiwi-schema").ByteBuffer;');for(let o=0;o<e.definitions.length;o++){let r=e.definitions[o];n[r.name]=r}for(let o=0;o<e.definitions.length;o++){let r=e.definitions[o];switch(r.kind){case"ENUM":{let a={};for(let s=0;s<r.fields.length;s++){let l=r.fields[s];a[l.name]=l.value,a[l.value]=l.name}i.push(t+"["+N(r.name)+"] = "+JSON.stringify(a,null,2)+";");break}case"STRUCT":case"MESSAGE":i.push(""),i.push(t+"["+N("decode"+r.name)+"] = "+dc(r,n)+";"),i.push(""),i.push(t+"["+N("encode"+r.name)+"] = "+fc(r,n)+";");break;default:F("Invalid definition kind "+N(r.kind),r.line,r.column);break}}return i.push(""),i.join(`
`)}function pr(e){let n={ByteBuffer:ln};return new Function("exports",gc(e))(n),n}var dr=["bool","byte","int","uint","float","string","int64","uint64"],fr=["ENUM","STRUCT","MESSAGE"];function mr(e){let n=e instanceof ln?e:new ln(e),t=n.readVarUint(),i=[];for(let o=0;o<t;o++){let r=n.readString(),a=n.readByte(),s=n.readVarUint(),l=[];for(let u=0;u<s;u++){let c=n.readString(),d=n.readVarInt(),f=!!(n.readByte()&1),g=n.readVarUint();l.push({name:c,line:0,column:0,type:fr[a]==="ENUM"?null:d,isArray:f,isDeprecated:!1,value:g})}i.push({name:r,line:0,column:0,kind:fr[a],fields:l})}for(let o=0;o<t;o++){let r=i[o].fields;for(let a=0;a<r.length;a++){let s=r[a],l=s.type;if(l!==null&&l<0){if(~l>=dr.length)throw new Error("Invalid type "+l);s.type=dr[~l]}else{if(l!==null&&l>=i.length)throw new Error("Invalid type "+l);s.type=l===null?null:i[l].name}}}return{package:null,definitions:i}}var pc=["bool","byte","float","int","int64","string","uint","uint64"],mc=["ByteBuffer","package"],hc=/((?:-|\b)\d+\b|[=;{}]|\[\]|\[deprecated\]|\b[A-Za-z_][A-Za-z0-9_]*\b|\/\/.*|\s+)/g,Kn=/^[A-Za-z_][A-Za-z0-9_]*$/,Ic=/^\/\/.*|\s+$/,Tc=/^=$/,yc=/^$/,gr=/^;$/,Sc=/^-?\d+$/,Ec=/^\{$/,Ac=/^\}$/,Nc=/^\[\]$/,Dc=/^enum$/,Cc=/^struct$/,Rc=/^message$/,Oc=/^package$/,bc=/^\[deprecated\]$/;function vc(e){let n=e.split(hc),t=[],i=0,o=0;for(let r=0;r<n.length;r++){let a=n[r];r&1?Ic.test(a)||t.push({text:a,line:o+1,column:i+1}):a!==""&&F("Syntax error "+N(a),o+1,i+1);let s=a.split(`
`);s.length>1&&(i=0),o+=s.length-1,i+=s[s.length-1].length}return t.push({text:"",line:o,column:i}),t}function Pc(e){function n(){return e[s]}function t(l){return l.test(n().text)?(s++,!0):!1}function i(l,u){if(!t(l)){let c=n();F("Expected "+u+" but found "+N(c.text),c.line,c.column)}}function o(){let l=n();F("Unexpected token "+N(l.text),l.line,l.column)}let r=[],a=null,s=0;for(t(Oc)&&(a=n().text,i(Kn,"identifier"),i(gr,'";"'));s<e.length&&!t(yc);){let l=[],u;t(Dc)?u="ENUM":t(Cc)?u="STRUCT":t(Rc)?u="MESSAGE":o();let c=n();for(i(Kn,"identifier"),i(Ec,'"{"');!t(Ac);){let d=null,f=!1,g=!1;u!=="ENUM"&&(d=n().text,i(Kn,"identifier"),f=t(Nc));let m=n();i(Kn,"identifier");let p=null;u!=="STRUCT"&&(i(Tc,'"="'),p=n(),i(Sc,"integer"),(+p.text|0)+""!==p.text&&F("Invalid integer "+N(p.text),p.line,p.column));let h=n();t(bc)&&(u!=="MESSAGE"&&F("Cannot deprecate this field",h.line,h.column),g=!0),i(gr,'";"'),l.push({name:m.text,line:m.line,column:m.column,type:d,isArray:f,isDeprecated:g,value:p!==null?+p.text|0:l.length+1})}r.push({name:c.text,line:c.line,column:c.column,kind:u,fields:l})}return{package:a,definitions:r}}function Lc(e){let n=pc.slice(),t={};for(let r=0;r<e.definitions.length;r++){let a=e.definitions[r];n.includes(a.name)&&F("The type "+N(a.name)+" is defined twice",a.line,a.column),mc.includes(a.name)&&F("The type name "+N(a.name)+" is reserved",a.line,a.column),n.push(a.name),t[a.name]=a}for(let r=0;r<e.definitions.length;r++){let a=e.definitions[r],s=a.fields;if(a.kind==="ENUM"||s.length===0)continue;for(let u=0;u<s.length;u++){let c=s[u];n.includes(c.type)||F("The type "+N(c.type)+" is not defined for field "+N(c.name),c.line,c.column)}let l=[];for(let u=0;u<s.length;u++){let c=s[u];l.includes(c.value)&&F("The id for field "+N(c.name)+" is used twice",c.line,c.column),c.value<=0&&F("The id for field "+N(c.name)+" must be positive",c.line,c.column),l.push(c.value)}}let i={},o=r=>{let a=t[r];if(a&&a.kind==="STRUCT"&&(i[r]===1&&F("Recursive nesting of "+N(r)+" is not allowed",a.line,a.column),i[r]!==2&&a)){i[r]=1;let s=a.fields;for(let l=0;l<s.length;l++){let u=s[l];u.isArray||o(u.type)}i[r]=2}return!0};for(let r=0;r<e.definitions.length;r++)o(e.definitions[r].name)}function Mc(e){let n=Pc(vc(e));return Lc(n),n}function _c(e){for(let n of e.definitions)Vc(n),n.kind==="ENUM"&&xc(n)}function Vc(e){let n=new Set;for(let t of e.fields)n.has(t.name)&&F(`The field ${N(t.name)} is defined twice in ${N(e.name)}`,t.line,t.column),n.add(t.name)}function xc(e){let n=new Set;for(let t of e.fields)n.has(t.value)&&F(`The enum value ${t.value} is used twice in ${N(e.name)}`,t.line,t.column),n.add(t.value)}var Gc=Mc(`enum MessageType {
  JOIN_START = 0;
  NODE_CHANGES = 1;
  USER_CHANGES = 2;
  JOIN_END = 3;
  SIGNAL = 4;
  STYLE = 5;
  STYLE_SET = 6;
  JOIN_START_SKIP_RELOAD = 7;
  NOTIFY_SHOULD_UPGRADE = 8;
  UPGRADE_DONE = 9;
  UPGRADE_REFRESH = 10;
  SCENE_GRAPH_QUERY = 11;
  SCENE_GRAPH_REPLY = 12;
  DIFF = 13;
  CLIENT_BROADCAST = 14;
  JOIN_START_JOURNALED = 15;
  STREAM_START = 16;
  STREAM_END = 17;
  INTERACTIVE_SLIDE_CHANGE = 18;
  RECONNECT_SCENE_GRAPH_QUERY = 19;
  RECONNECT_SCENE_GRAPH_REPLY = 20;
  JOIN_END_INCREMENTAL_RECONNECT = 21;
  NODE_STATUS_CHANGE = 22;
  CLIENT_RENDERED = 23;
  BUZZ_APPROVAL_CHANGE = 24;
}

enum Axis {
  X = 0;
  Y = 1;
}

enum Access {
  READ_ONLY = 0;
  READ_WRITE = 1;
}

enum NodePhase {
  CREATED = 0;
  REMOVED = 1;
}

enum WindingRule {
  NONZERO = 0;
  ODD = 1;
}

enum NodeType {
  NONE = 0;
  DOCUMENT = 1;
  CANVAS = 2;
  GROUP = 3;
  FRAME = 4;
  BOOLEAN_OPERATION = 5;
  VECTOR = 6;
  STAR = 7;
  LINE = 8;
  ELLIPSE = 9;
  RECTANGLE = 10;
  REGULAR_POLYGON = 11;
  ROUNDED_RECTANGLE = 12;
  TEXT = 13;
  SLICE = 14;
  SYMBOL = 15;
  INSTANCE = 16;
  STICKY = 17;
  SHAPE_WITH_TEXT = 18;
  CONNECTOR = 19;
  CODE_BLOCK = 20;
  WIDGET = 21;
  STAMP = 22;
  MEDIA = 23;
  HIGHLIGHT = 24;
  SECTION = 25;
  SECTION_OVERLAY = 26;
  WASHI_TAPE = 27;
  VARIABLE = 28;
  TABLE = 29;
  TABLE_CELL = 30;
  VARIABLE_SET = 31;
  SLIDE = 32;
  ASSISTED_LAYOUT = 33;
  INTERACTIVE_SLIDE_ELEMENT = 34;
  VARIABLE_OVERRIDE = 35;
  MODULE = 36;
  SLIDE_GRID = 37;
  SLIDE_ROW = 38;
  RESPONSIVE_SET = 39;
  CODE_COMPONENT = 40;
  TEXT_PATH = 41;
  CODE_INSTANCE = 42;
  CODE_LIBRARY = 43;
  CODE_FILE = 44;
  CODE_LAYER = 45;
  BRUSH = 46;
  MANAGED_STRING = 47;
  TRANSFORM = 48;
  CMS_RICH_TEXT = 49;
  REPEATER = 50;
  JSX = 51;
  EMBEDDED_PROTOTYPE = 52;
  REACT_FIBER = 53;
  RESPONSIVE_NODE_SET = 54;
  WEBPAGE = 55;
  KEYFRAME = 56;
  KEYFRAME_TRACK = 57;
  ANIMATION_PRESET_INSTANCE = 58;
  CODE_EMBED = 59;
  BINARY_FILE = 60;
  SPEC_BLOCK = 61;
  TOOL_INSTANCE = 62;
  CUSTOM_EFFECT_INSTANCE = 63;
  NATIVE_CODE_LAYER_INSTANCE = 64;
}

enum ShapeWithTextType {
  SQUARE = 0;
  ELLIPSE = 1;
  DIAMOND = 2;
  TRIANGLE_UP = 3;
  TRIANGLE_DOWN = 4;
  ROUNDED_RECTANGLE = 5;
  PARALLELOGRAM_RIGHT = 6;
  PARALLELOGRAM_LEFT = 7;
  ENG_DATABASE = 8;
  ENG_QUEUE = 9;
  ENG_FILE = 10;
  ENG_FOLDER = 11;
  TRAPEZOID = 12;
  PREDEFINED_PROCESS = 13;
  SHIELD = 14;
  DOCUMENT_SINGLE = 15;
  DOCUMENT_MULTIPLE = 16;
  MANUAL_INPUT = 17;
  HEXAGON = 18;
  CHEVRON = 19;
  PENTAGON = 20;
  OCTAGON = 21;
  STAR = 22;
  PLUS = 23;
  ARROW_LEFT = 24;
  ARROW_RIGHT = 25;
  SUMMING_JUNCTION = 26;
  OR = 27;
  SPEECH_BUBBLE = 28;
  INTERNAL_STORAGE = 29;
}

enum BlendMode {
  PASS_THROUGH = 0;
  NORMAL = 1;
  DARKEN = 2;
  MULTIPLY = 3;
  LINEAR_BURN = 4;
  COLOR_BURN = 5;
  LIGHTEN = 6;
  SCREEN = 7;
  LINEAR_DODGE = 8;
  COLOR_DODGE = 9;
  OVERLAY = 10;
  SOFT_LIGHT = 11;
  HARD_LIGHT = 12;
  DIFFERENCE = 13;
  EXCLUSION = 14;
  HUE = 15;
  SATURATION = 16;
  COLOR = 17;
  LUMINOSITY = 18;
}

enum PaintType {
  SOLID = 0;
  GRADIENT_LINEAR = 1;
  GRADIENT_RADIAL = 2;
  GRADIENT_ANGULAR = 3;
  GRADIENT_DIAMOND = 4;
  IMAGE = 5;
  EMOJI = 6;
  VIDEO = 7;
  PATTERN = 8;
  NOISE = 9;
  CUSTOM = 10;
}

enum ImageScaleMode {
  STRETCH = 0;
  FIT = 1;
  FILL = 2;
  TILE = 3;
}

enum EffectType {
  INNER_SHADOW = 0;
  DROP_SHADOW = 1;
  FOREGROUND_BLUR = 2;
  BACKGROUND_BLUR = 3;
  REPEAT = 4;
  SYMMETRY = 5;
  GRAIN = 6;
  NOISE = 7;
  GLASS = 8;
  CUSTOM = 9;
}

enum TextCase {
  ORIGINAL = 0;
  UPPER = 1;
  LOWER = 2;
  TITLE = 3;
  SMALL_CAPS = 4;
  SMALL_CAPS_FORCED = 5;
}

enum TextDecoration {
  NONE = 0;
  UNDERLINE = 1;
  STRIKETHROUGH = 2;
}

enum TextDecorationStyle {
  SOLID = 0;
  DOTTED = 1;
  WAVY = 2;
}

enum LeadingTrim {
  NONE = 0;
  CAP_HEIGHT = 1;
}

enum NumberUnits {
  RAW = 0;
  PIXELS = 1;
  PERCENT = 2;
}

enum ConstraintType {
  MIN = 0;
  CENTER = 1;
  MAX = 2;
  STRETCH = 3;
  SCALE = 4;
  FIXED_MIN = 5;
  FIXED_MAX = 6;
}

enum StrokeAlign {
  CENTER = 0;
  INSIDE = 1;
  OUTSIDE = 2;
  OFFSET = 3;
}

enum StrokeCap {
  NONE = 0;
  ROUND = 1;
  SQUARE = 2;
  ARROW_LINES = 3;
  ARROW_EQUILATERAL = 4;
  DIAMOND_FILLED = 5;
  TRIANGLE_FILLED = 6;
  HIGHLIGHT = 7;
  WASHI_TAPE_1 = 8;
  WASHI_TAPE_2 = 9;
  WASHI_TAPE_3 = 10;
  WASHI_TAPE_4 = 11;
  WASHI_TAPE_5 = 12;
  WASHI_TAPE_6 = 13;
  CIRCLE_FILLED = 14;
  ERD_ZERO_OR_ONE = 15;
  ERD_EXACTLY_ONE = 16;
  ERD_ZERO_OR_MORE = 17;
  ERD_ONE_OR_MORE = 18;
  ERD_ONE = 19;
  ERD_MANY = 20;
}

enum StrokeJoin {
  MITER = 0;
  BEVEL = 1;
  ROUND = 2;
}

enum BooleanOperation {
  UNION = 0;
  INTERSECT = 1;
  SUBTRACT = 2;
  XOR = 3;
}

enum TextAlignHorizontal {
  LEFT = 0;
  CENTER = 1;
  RIGHT = 2;
  JUSTIFIED = 3;
}

enum TextAlignVertical {
  TOP = 0;
  CENTER = 1;
  BOTTOM = 2;
}

enum MouseCursor {
  DEFAULT = 0;
  CROSSHAIR = 1;
  EYEDROPPER = 2;
  HAND = 3;
  PAINT_BUCKET = 4;
  PEN = 5;
  PENCIL = 6;
  MARKER = 7;
  ERASER = 8;
  HIGHLIGHTER = 9;
  LASSO = 10;
}

enum VectorMirror {
  NONE = 0;
  ANGLE = 1;
  ANGLE_AND_LENGTH = 2;
}

enum DashMode {
  CLIP = 0;
  STRETCH = 1;
}

enum ImageType {
  PNG = 0;
  JPEG = 1;
  SVG = 2;
  PDF = 3;
  MP4 = 4;
  GIF = 5;
}

enum ExportConstraintType {
  CONTENT_SCALE = 0;
  CONTENT_WIDTH = 1;
  CONTENT_HEIGHT = 2;
}

enum LayoutGridType {
  MIN = 0;
  CENTER = 1;
  STRETCH = 2;
  MAX = 3;
}

enum LayoutGridPattern {
  STRIPES = 0;
  GRID = 1;
}

enum TextAutoResize {
  NONE = 0;
  WIDTH_AND_HEIGHT = 1;
  HEIGHT = 2;
}

enum TextTruncation {
  DISABLED = 0;
  ENDING = 1;
}

enum StyleSetType {
  PERSONAL = 0;
  TEAM = 1;
  CUSTOM = 2;
  FREQUENCY = 3;
  TEMPORARY = 4;
}

enum StyleSetContentType {
  SOLID = 0;
  GRADIENT = 1;
  IMAGE = 2;
}

enum StackMode {
  NONE = 0;
  HORIZONTAL = 1;
  VERTICAL = 2;
  GRID = 3;
}

enum StackAlign {
  MIN = 0;
  CENTER = 1;
  MAX = 2;
  BASELINE = 3;
}

enum StackCounterAlign {
  MIN = 0;
  CENTER = 1;
  MAX = 2;
  STRETCH = 3;
  AUTO = 4;
  BASELINE = 5;
}

enum StackJustify {
  MIN = 0;
  CENTER = 1;
  MAX = 2;
  SPACE_EVENLY = 3;
  SPACE_BETWEEN = 4;
}

enum GridChildAlign {
  AUTO = 0;
  MIN = 1;
  CENTER = 2;
  MAX = 3;
}

enum GridAutoTracks {
  NONE = 0;
  ROWS = 1;
}

enum StackSize {
  FIXED = 0;
  RESIZE_TO_FIT = 1;
  RESIZE_TO_FIT_WITH_IMPLICIT_SIZE = 2;
}

enum StackPositioning {
  AUTO = 0;
  ABSOLUTE = 1;
}

enum StackWrap {
  NO_WRAP = 0;
  WRAP = 1;
}

enum StackCounterAlignContent {
  AUTO = 0;
  SPACE_BETWEEN = 1;
}

enum ConnectionType {
  NONE = 0;
  INTERNAL_NODE = 1;
  URL = 2;
  BACK = 3;
  CLOSE = 4;
  SET_VARIABLE = 5;
  UPDATE_MEDIA_RUNTIME = 6;
  CONDITIONAL = 7;
  SET_VARIABLE_MODE = 8;
  OBJECT_ANIMATION = 9;
  UPDATE_ANIMATION_TIMELINE_STATE = 10;
}

enum InteractionType {
  ON_CLICK = 0;
  AFTER_TIMEOUT = 1;
  MOUSE_IN = 2;
  MOUSE_OUT = 3;
  ON_HOVER = 4;
  MOUSE_DOWN = 5;
  MOUSE_UP = 6;
  ON_PRESS = 7;
  NONE = 8;
  DRAG = 9;
  ON_KEY_DOWN = 10;
  ON_VOICE = 11;
  ON_MEDIA_HIT = 12;
  ON_MEDIA_END = 13;
  MOUSE_ENTER = 14;
  MOUSE_LEAVE = 15;
}

enum TransitionType {
  INSTANT_TRANSITION = 0;
  DISSOLVE = 1;
  FADE = 2;
  SLIDE_FROM_LEFT = 3;
  SLIDE_FROM_RIGHT = 4;
  SLIDE_FROM_TOP = 5;
  SLIDE_FROM_BOTTOM = 6;
  PUSH_FROM_LEFT = 7;
  PUSH_FROM_RIGHT = 8;
  PUSH_FROM_TOP = 9;
  PUSH_FROM_BOTTOM = 10;
  MOVE_FROM_LEFT = 11;
  MOVE_FROM_RIGHT = 12;
  MOVE_FROM_TOP = 13;
  MOVE_FROM_BOTTOM = 14;
  SLIDE_OUT_TO_LEFT = 15;
  SLIDE_OUT_TO_RIGHT = 16;
  SLIDE_OUT_TO_TOP = 17;
  SLIDE_OUT_TO_BOTTOM = 18;
  MOVE_OUT_TO_LEFT = 19;
  MOVE_OUT_TO_RIGHT = 20;
  MOVE_OUT_TO_TOP = 21;
  MOVE_OUT_TO_BOTTOM = 22;
  MAGIC_MOVE = 23;
  SMART_ANIMATE = 24;
  SCROLL_ANIMATE = 25;
}

enum EasingType {
  IN_CUBIC = 0;
  OUT_CUBIC = 1;
  INOUT_CUBIC = 2;
  LINEAR = 3;
  IN_BACK_CUBIC = 4;
  OUT_BACK_CUBIC = 5;
  INOUT_BACK_CUBIC = 6;
  CUSTOM_CUBIC = 7;
  SPRING = 8;
  GENTLE_SPRING = 9;
  CUSTOM_SPRING = 10;
  SPRING_PRESET_ONE = 11;
  SPRING_PRESET_TWO = 12;
  SPRING_PRESET_THREE = 13;
  HOLD = 14;
}

enum ScrollDirection {
  NONE = 0;
  HORIZONTAL = 1;
  VERTICAL = 2;
  BOTH = 3;
}

enum ScrollContractedState {
  EXPANDED = 0;
  CONTRACTED = 1;
}

struct GUID {
  uint sessionID;
  uint localID;
}

struct Color {
  float r;
  float g;
  float b;
  float a;
}

struct Vector {
  float x;
  float y;
}

struct Rect {
  float x;
  float y;
  float w;
  float h;
}

struct ColorStop {
  Color color;
  float position;
}

message ColorStopVar {
  Color color = 1;
  VariableData colorVar = 2;
  float position = 3;
}

struct Matrix {
  float m00;
  float m01;
  float m02;
  float m10;
  float m11;
  float m12;
}

struct ParentIndex {
  GUID guid;
  string position;
}

struct Number {
  float value;
  NumberUnits units;
}

struct FontName {
  string family;
  string style;
  string postscript;
}

enum FontVariantNumericFigure {
  NORMAL = 0;
  LINING = 1;
  OLDSTYLE = 2;
}

enum FontVariantNumericSpacing {
  NORMAL = 0;
  PROPORTIONAL = 1;
  TABULAR = 2;
}

enum FontVariantNumericFraction {
  NORMAL = 0;
  DIAGONAL = 1;
  STACKED = 2;
}

enum FontVariantCaps {
  NORMAL = 0;
  SMALL = 1;
  ALL_SMALL = 2;
  PETITE = 3;
  ALL_PETITE = 4;
  UNICASE = 5;
  TITLING = 6;
}

enum FontVariantPosition {
  NORMAL = 0;
  SUB = 1;
  SUPER = 2;
}

enum FontStyle {
  NORMAL = 0;
  ITALIC = 1;
}

enum SemanticWeight {
  NORMAL = 0;
  BOLD = 1;
}

enum SemanticItalic {
  NORMAL = 0;
  ITALIC = 1;
}

enum CodeSnapshotState {
  INITIAL = 0;
  SNAPSHOTTING = 1;
  OK = 2;
  SNAPSHOT_ERROR = 3;
  LLM_IN_PROGRESS = 4;
}

enum SnapshotCaptureMode {
  FULL = 0;
  PARTIAL = 1;
}

message CodeSourceInfo {
  string originReferenceId = 1;
  GUID originNodeId = 2;
  GUID linkedSnapshotId = 3;
  SnapshotCaptureMode captureMode = 4;
  string sourceBlobRef = 5;
  string sourceElementId = 6;
}

enum CodeObjectType {
  WEB_LAYER = 0;
  WEB_INTERACTION = 1;
  NATIVE_LAYER = 2;
  ANIMATION_PRESET = 3;
  TOOL = 4;
  CUSTOM_EFFECT = 5;
  PLUGIN = 6;
  WEB_LAYER_GENERIC = 7;
  CUSTOM_FILL = 8;
}

message CustomToolArtifactRef {
  string customToolId = 1;
  string customToolVersion = 2;
  string publishedCustomToolId = 3;
  string publishedCustomToolVersionId = 4;
}

enum LockMode {
  NONE = 0;
  ALL = 1;
  BACKGROUND_ONLY = 2;
}

enum OpenTypeFeature {
  PCAP = 0;
  C2PC = 1;
  CASE = 2;
  CPSP = 3;
  TITL = 4;
  UNIC = 5;
  ZERO = 6;
  SINF = 7;
  ORDN = 8;
  AFRC = 9;
  DNOM = 10;
  NUMR = 11;
  LIGA = 12;
  CLIG = 13;
  DLIG = 14;
  HLIG = 15;
  RLIG = 16;
  AALT = 17;
  CALT = 18;
  RCLT = 19;
  SALT = 20;
  RVRN = 21;
  VERT = 22;
  SWSH = 23;
  CSWH = 24;
  NALT = 25;
  CCMP = 26;
  STCH = 27;
  HIST = 28;
  SIZE = 29;
  ORNM = 30;
  ITAL = 31;
  RAND = 32;
  DTLS = 33;
  FLAC = 34;
  MGRK = 35;
  SSTY = 36;
  KERN = 37;
  FWID = 38;
  HWID = 39;
  HALT = 40;
  TWID = 41;
  QWID = 42;
  PWID = 43;
  JUST = 44;
  LFBD = 45;
  OPBD = 46;
  RTBD = 47;
  PALT = 48;
  PKNA = 49;
  LTRA = 50;
  LTRM = 51;
  RTLA = 52;
  RTLM = 53;
  ABRV = 54;
  ABVM = 55;
  ABVS = 56;
  VALT = 57;
  VHAL = 58;
  BLWF = 59;
  BLWM = 60;
  BLWS = 61;
  AKHN = 62;
  CJCT = 63;
  CFAR = 64;
  CPCT = 65;
  CURS = 66;
  DIST = 67;
  EXPT = 68;
  FALT = 69;
  FINA = 70;
  FIN2 = 71;
  FIN3 = 72;
  HALF = 73;
  HALN = 74;
  HKNA = 75;
  HNGL = 76;
  HOJO = 77;
  INIT = 78;
  ISOL = 79;
  JP78 = 80;
  JP83 = 81;
  JP90 = 82;
  JP04 = 83;
  LJMO = 84;
  LOCL = 85;
  MARK = 86;
  MEDI = 87;
  MED2 = 88;
  MKMK = 89;
  NLCK = 90;
  NUKT = 91;
  PREF = 92;
  PRES = 93;
  VPAL = 94;
  PSTF = 95;
  PSTS = 96;
  RKRF = 97;
  RPHF = 98;
  RUBY = 99;
  SMPL = 100;
  TJMO = 101;
  TNAM = 102;
  TRAD = 103;
  VATU = 104;
  VJMO = 105;
  VKNA = 106;
  VKRN = 107;
  VRTR = 108;
  VRT2 = 109;
  SS01 = 110;
  SS02 = 111;
  SS03 = 112;
  SS04 = 113;
  SS05 = 114;
  SS06 = 115;
  SS07 = 116;
  SS08 = 117;
  SS09 = 118;
  SS10 = 119;
  SS11 = 120;
  SS12 = 121;
  SS13 = 122;
  SS14 = 123;
  SS15 = 124;
  SS16 = 125;
  SS17 = 126;
  SS18 = 127;
  SS19 = 128;
  SS20 = 129;
  CV01 = 130;
  CV02 = 131;
  CV03 = 132;
  CV04 = 133;
  CV05 = 134;
  CV06 = 135;
  CV07 = 136;
  CV08 = 137;
  CV09 = 138;
  CV10 = 139;
  CV11 = 140;
  CV12 = 141;
  CV13 = 142;
  CV14 = 143;
  CV15 = 144;
  CV16 = 145;
  CV17 = 146;
  CV18 = 147;
  CV19 = 148;
  CV20 = 149;
  CV21 = 150;
  CV22 = 151;
  CV23 = 152;
  CV24 = 153;
  CV25 = 154;
  CV26 = 155;
  CV27 = 156;
  CV28 = 157;
  CV29 = 158;
  CV30 = 159;
  CV31 = 160;
  CV32 = 161;
  CV33 = 162;
  CV34 = 163;
  CV35 = 164;
  CV36 = 165;
  CV37 = 166;
  CV38 = 167;
  CV39 = 168;
  CV40 = 169;
  CV41 = 170;
  CV42 = 171;
  CV43 = 172;
  CV44 = 173;
  CV45 = 174;
  CV46 = 175;
  CV47 = 176;
  CV48 = 177;
  CV49 = 178;
  CV50 = 179;
  CV51 = 180;
  CV52 = 181;
  CV53 = 182;
  CV54 = 183;
  CV55 = 184;
  CV56 = 185;
  CV57 = 186;
  CV58 = 187;
  CV59 = 188;
  CV60 = 189;
  CV61 = 190;
  CV62 = 191;
  CV63 = 192;
  CV64 = 193;
  CV65 = 194;
  CV66 = 195;
  CV67 = 196;
  CV68 = 197;
  CV69 = 198;
  CV70 = 199;
  CV71 = 200;
  CV72 = 201;
  CV73 = 202;
  CV74 = 203;
  CV75 = 204;
  CV76 = 205;
  CV77 = 206;
  CV78 = 207;
  CV79 = 208;
  CV80 = 209;
  CV81 = 210;
  CV82 = 211;
  CV83 = 212;
  CV84 = 213;
  CV85 = 214;
  CV86 = 215;
  CV87 = 216;
  CV88 = 217;
  CV89 = 218;
  CV90 = 219;
  CV91 = 220;
  CV92 = 221;
  CV93 = 222;
  CV94 = 223;
  CV95 = 224;
  CV96 = 225;
  CV97 = 226;
  CV98 = 227;
  CV99 = 228;
}

struct ExportConstraint {
  ExportConstraintType type;
  float value;
}

struct GUIDMapping {
  GUID from;
  GUID to;
}

struct Blob {
  byte[] bytes;
}

message Image {
  byte[] hash = 1;
  string name = 2;
  uint dataBlob = 3;
}

message Video {
  byte[] hash = 1;
  string s3Url = 2;
}

message PasteSource {
  string srcFile = 1;
  GUID srcNode = 2;
}

struct FilterColorAdjust {
  float tint;
  float shadows;
  float highlights;
  float detail;
  float exposure;
  float vignette;
  float temperature;
  float vibrance;
}

message PaintFilterMessage {
  float tint = 1;
  float shadows = 2;
  float highlights = 3;
  float detail = 4;
  float exposure = 5;
  float vignette = 6;
  float temperature = 7;
  float vibrance = 8;
  float contrast = 9;
  float brightness = 10;
}

message Paint {
  PaintType type = 1;
  Color color = 2;
  float opacity = 3;
  bool visible = 4;
  BlendMode blendMode = 5;
  ColorStop[] stops = 6;
  Matrix transform = 7;
  Image image = 8;
  Image imageThumbnail = 9;
  Image animatedImage = 16;
  uint animationFrame = 17;
  ImageScaleMode imageScaleMode = 10;
  bool imageShouldColorManage = 22;
  float rotation = 11;
  float scale = 12;
  FilterColorAdjust filterColorAdjust = 13;
  PaintFilterMessage paintFilter = 14;
  uint[] emojiCodePoints = 15;
  Video video = 18;
  uint originalImageWidth = 19;
  uint originalImageHeight = 20;
  VariableData opacityVar = 38;
  VariableData colorVar = 21;
  VariableData imageVar = 31;
  ColorStopVar[] stopsVar = 23;
  string thumbHashBase64 = 24;
  byte[] thumbHash = 25;
  GUID sourceNodeId = 26;
  float spacing = 27;
  Vector patternSpacing = 37;
  PatternTileType patternTileType = 28;
  PatternAlignment verticalAlignment = 29;
  PatternAlignment horizontalAlignment = 30;
  GUID id = 32;
  string altText = 33;
  NoiseType noiseType = 34;
  float density = 35;
  Vector noiseSize = 36;
  CodeComponentId customEffectId = 39;
  ComponentPropAssignment[] componentPropAssignments = 40;
}

enum NoiseType {
  MULTITONE = 0;
  MONOTONE = 1;
  DUOTONE = 2;
}

enum PatternTileType {
  RECTANGULAR = 0;
  HORIZONTAL_HEXAGONAL = 1;
  VERTICAL_HEXAGONAL = 2;
}

enum PatternAlignment {
  START = 0;
  CENTER = 1;
  END = 2;
}

message FontMetaData {
  FontName key = 1;
  float fontLineHeight = 2;
  byte[] fontDigest = 3;
  FontStyle fontStyle = 4;
  int fontWeight = 5;
}

message FontVariation {
  uint axisTag = 1;
  string axisName = 2;
  float value = 3;
}

message TextData {
  string characters = 1;
  uint[] characterStyleIDs = 2;
  NodeChange[] styleOverrideTable = 3;
  TextLineData[] lines = 12;
  uint layoutVersion = 8;
  FontName[] fallbackFonts = 10;
  float minContentHeight = 17;
  Vector layoutSize = 4;
  Baseline[] baselines = 5;
  Glyph[] glyphs = 6;
  Decoration[] decorations = 7;
  Blockquote[] blockquotes = 16;
  FontMetaData[] fontMetaData = 9;
  HyperlinkBox[] hyperlinkBoxes = 11;
  int truncationStartIndex = 13;
  float truncatedHeight = 14;
  float[] logicalIndexToCharacterOffsetMap = 15;
  MentionBox[] mentionBoxes = 18;
  DerivedTextLineData[] derivedLines = 19;
}

message DerivedTextData {
  Vector layoutSize = 1;
  Baseline[] baselines = 2;
  Glyph[] glyphs = 3;
  Decoration[] decorations = 4;
  Blockquote[] blockquotes = 5;
  FontMetaData[] fontMetaData = 6;
  HyperlinkBox[] hyperlinkBoxes = 7;
  int truncationStartIndex = 8;
  float truncatedHeight = 9;
  float[] logicalIndexToCharacterOffsetMap = 10;
  MentionBox[] mentionBoxes = 11;
  DerivedTextLineData[] derivedLines = 12;
}

message HyperlinkBox {
  Rect bounds = 1;
  string url = 2;
  GUID guid = 3;
  CMSItemPageTarget cmsTarget = 5;
  bool openInNewTab = 6;
  int hyperlinkID = 4;
}

message MentionBox {
  Rect bounds = 1;
  uint startIndex = 2;
  uint endIndex = 3;
  bool isValid = 4;
  uint mentionKey = 5;
}

message Baseline {
  Vector position = 1;
  float width = 2;
  float lineY = 3;
  float lineHeight = 4;
  float lineAscent = 7;
  float ignoreLeadingTrim = 8;
  uint firstCharacter = 5;
  uint endCharacter = 6;
}

message Glyph {
  uint commandsBlob = 1;
  Vector position = 2;
  uint styleID = 3;
  float fontSize = 4;
  uint firstCharacter = 5;
  float advance = 6;
  uint[] emojiCodePoints = 7;
  EmojiImageSet emojiImageSet = 8;
  float rotation = 9;
}

message Decoration {
  Rect[] rects = 1;
  uint styleID = 2;
}

message Blockquote {
  Rect verticalBar = 1;
  Rect quoteMarkBounds = 2;
  uint styleID = 3;
}

message VectorData {
  uint vectorNetworkBlob = 1;
  Vector normalizedSize = 2;
  NodeChange[] styleOverrideTable = 3;
}

message TextPathStart {
  float tValue = 1;
  bool forward = 2;
}

message GUIDPath {
  GUID[] guids = 1;
}

message SymbolData {
  GUID symbolID = 1;
  NodeChange[] symbolOverrides = 2;
  float uniformScaleFactor = 3;
}

message GUIDPathMapping {
  GUID id = 1;
  GUIDPath path = 2;
}

message DerivedBreakpointData {
  NodeChange[] overrides = 1;
}

message NodeGenerationData {
  NodeChange[] overrides = 1;
  bool useFineGrainedSyncing = 2;
  NodeChange[] diffOnlyRemovals = 3;
}

message DerivedImmutableFrameData {
  NodeChange[] overrides = 1;
  uint version = 2;
}

message JsxData {
  NodeChange[] overrides = 1;
}

message DerivedJsxData {
  NodeChange[] overrides = 1;
}

message AssetIdMap {
  AssetIdEntry[] entries = 1;
}

message AssetIdEntry {
  string assetKey = 1;
  AssetId assetId = 2;
}

message AssetRef {
  string key = 1;
  string version = 2;
}

message AssetId {
  GUID guid = 1;
  AssetRef assetRef = 2;
  StateGroupId stateGroupId = 3;
  StyleId styleId = 4;
  SymbolId symbolId = 5;
  VariableID variableId = 6;
  VariableSetID variableSetId = 7;
}

message StateGroupId {
  GUID guid = 1;
  AssetRef assetRef = 2;
}

message StyleId {
  GUID guid = 1;
  AssetRef assetRef = 2;
}

message SymbolId {
  GUID guid = 1;
  AssetRef assetRef = 2;
}

message VariableID {
  GUID guid = 1;
  AssetRef assetRef = 2;
}

message VariableOverrideId {
  GUID guid = 1;
  AssetRef assetRef = 2;
}

message VariableSetID {
  GUID guid = 1;
  AssetRef assetRef = 2;
}

message ModuleId {
  GUID guid = 1;
  AssetRef assetRef = 2;
}

message ResponsiveSetId {
  GUID guid = 1;
  AssetRef assetRef = 2;
}

message WebpageId {
  GUID guid = 1;
  AssetRef assetRef = 2;
}

message ThemeID {
  GUID guid = 1;
  AssetRef assetRef = 2;
}

message CodeLibraryId {
  GUID guid = 1;
  AssetRef assetRef = 2;
}

message CodeFileId {
  GUID guid = 1;
  AssetRef assetRef = 2;
}

message CodeComponentId {
  GUID guid = 1;
  AssetRef assetRef = 2;
}

message CanvasNodeId {
  GUID guid = 1;
  SymbolId symbolId = 2;
  StateGroupId stateGroupId = 3;
}

struct IndexRange {
  uint startIndex;
  uint endIndexExclusive;
}

struct CollaborativeTextOpID {
  uint sessionID;
  uint counterID;
}

enum CollaborativeTextOpType {
  INSERT = 0;
  DELETE = 1;
}

message CollaborativeTextStrippedOpRunWithIDs {
  CollaborativeTextOpID firstId = 1;
  uint runLength = 2;
  CollaborativeTextOpID[] parentIds = 3;
  CollaborativeTextOpID[] rebasedOnOpIds = 4;
}

message CollaborativeTextStrippedOpRunWithLoc {
  CollaborativeTextOpType type = 1;
  IndexRange range = 2;
  bool rangeShouldBeIteratedInReverse = 3;
  IndexRange contentBytesInBuffer = 4;
  IndexRange rebasedRange = 5;
}

message CollaborativeTextOpRun {
  CollaborativeTextOpID id = 1;
  CollaborativeTextOpID[] parentIds = 2;
  CollaborativeTextOpType type = 3;
  IndexRange range = 4;
  bool rangeShouldBeIteratedInReverse = 5;
  string content = 6;
  CollaborativeTextOpID[] rebasedOnOpIds = 7;
  IndexRange rebasedRange = 8;
}

message CollaborativePlainText {
  CollaborativeTextStrippedOpRunWithIDs[] historyOpsWithIds = 1;
  CollaborativeTextStrippedOpRunWithLoc[] historyOpsWithLoc = 2;
  byte[] historyStringContentBuffer = 3;
  CollaborativeTextOpRun[] changesToAppend = 4;
}

message CollaborativeTextSelection {
  GUID node = 1;
  uint field = 2;
  IndexRange selectedRange = 3;
  bool caretAtFront = 4;
  CollaborativeTextOpID[] textVersion = 5;
}

message ResponsiveTextStyleVariant {
  float minWidth = 1;
  NodeChange fields = 2;
  VariableData variableFontSize = 3;
  VariableData variableLineHeight = 4;
  VariableData variableLetterSpacing = 5;
  VariableData variableParagraphSpacing = 6;
  string name = 7;
}

enum FlappType {
  POLL = 0;
  EMBED = 1;
  FACEPILE = 2;
  ALIGNMENT = 3;
  YOUTUBE = 4;
}

message SlideThemeProps {
  string themeVersion = 1;
  VariableSetID variableSetId = 2;
  StyleId[] textStyleIds = 3;
  bool isTextColorManuallySelected = 4;
  bool isBorderColorManuallySelected = 5;
  AssetRef subscribedThemeRef = 6;
  uint schemaVersion = 7;
  bool isGeneratedFromDesign = 8;
}

message SlideThemeMap {
  SlideThemeMapEntry[] entries = 1;
}

message SlideThemeMapEntry {
  ThemeID themeId = 1;
  SlideThemeProps themeProps = 2;
}

message SharedSymbolReference {
  string fileKey = 1;
  GUID symbolID = 2;
  string versionHash = 3;
  GUIDPathMapping[] guidPathMappings = 4;
  byte[] bytes = 5;
  GUIDMapping[] libraryGUIDToSubscribingGUID = 6;
  string componentKey = 7;
  GUIDPathMapping[] unflatteningMappings = 8;
  bool isUnflattened = 9;
}

message SharedComponentMasterData {
  string componentKey = 1;
  GUIDPathMapping[] publishingGUIDPathToTeamLibraryGUID = 2;
  bool isUnflattened = 3;
}

message InstanceOverrideStash {
  GUIDPath overridePathOfSwappedInstance = 1;
  string componentKey = 2;
  NodeChange[] overrides = 3;
}

message InstanceOverrideStashV2 {
  GUIDPath overridePathOfSwappedInstance = 1;
  GUID localSymbolID = 2;
  NodeChange[] overrides = 3;
}

message ImportedCodeFileEntry {
  CodeFileId codeFileId = 1;
}

message ImportedCodeFiles {
  ImportedCodeFileEntry[] entries = 1;
}

enum BlurOpType {
  NORMAL = 0;
  PROGRESSIVE = 1;
}

enum RepeatType {
  LINEAR = 0;
  RADIAL = 1;
}

enum UnitType {
  PIXELS = 0;
  RELATIVE = 1;
}

enum RepeatOrder {
  FORWARD = 0;
  REVERSE = 1;
}

enum EffectAxis {
  X = 0;
  Y = 1;
  X_AND_Y = 2;
}

message Effect {
  EffectType type = 1;
  Vector offset = 3;
  float radius = 4;
  bool visible = 5;
  BlendMode blendMode = 6;
  float spread = 7;
  bool showShadowBehindNode = 8;
  VariableData radiusVar = 9;
  VariableData colorVar = 10;
  VariableData spreadVar = 11;
  VariableData xVar = 12;
  VariableData yVar = 13;
  uint count = 14;
  RepeatType repeatType = 15;
  EffectAxis axis = 16;
  UnitType unitType = 17;
  RepeatOrder order = 18;
  BlurOpType blurOpType = 19;
  Vector startOffset = 20;
  Vector endOffset = 28;
  float startRadius = 21;
  Color color = 2;
  Color secondaryColor = 24;
  Vector noiseSize = 22;
  uint seed = 29;
  bool clipToShape = 23;
  float density = 25;
  NoiseType noiseType = 26;
  float opacity = 27;
  float refractionRadius = 30;
  float specularAngle = 31;
  float specularIntensity = 32;
  float bevelSize = 33;
  float chromaticAberration = 34;
  float reflectionDistance = 35;
  float refractionIntensity = 36;
  VariableData refractionRadiusVar = 37;
  VariableData specularAngleVar = 38;
  VariableData specularIntensityVar = 39;
  VariableData chromaticAberrationVar = 40;
  VariableData splayVar = 41;
  VariableData refractionIntensityVar = 42;
  CodeComponentId customEffectId = 43;
  ComponentPropAssignment[] componentPropAssignments = 44;
  VariableData startRadiusVar = 45;
  VariableData startOffsetXVar = 46;
  VariableData startOffsetYVar = 47;
  VariableData endOffsetXVar = 48;
  VariableData endOffsetYVar = 49;
  VariableData noiseSizeXVar = 50;
  VariableData noiseSizeYVar = 51;
  VariableData densityVar = 52;
  VariableData effectOpacityVar = 53;
  VariableData secondaryColorVar = 54;
  GUID id = 55;
}

enum TransformModifierType {
  REPEAT = 0;
  SYMMETRY = 1;
  SKEW = 2;
}

message TransformModifier {
  TransformModifierType type = 1;
  Vector offset = 2;
  bool visible = 3;
  uint count = 4;
  RepeatType repeatType = 5;
  EffectAxis axis = 6;
  UnitType unitType = 7;
  RepeatOrder order = 8;
  float skewX = 9;
  float skewY = 10;
}

enum TransformSchemaType {
  NONE = 0;
  FIXED_ORDER = 1;
  FREEFORM = 2;
}

struct Matrix4f {
  float m00;
  float m01;
  float m02;
  float m03;
  float m10;
  float m11;
  float m12;
  float m13;
  float m20;
  float m21;
  float m22;
  float m23;
  float m30;
  float m31;
  float m32;
  float m33;
}

message FixedOrderTransform3d {
  float perspective = 1;
  float translateZ = 2;
  float rotateX = 3;
  float rotateY = 4;
  float rotateZ = 5;
}

enum TransformFnType {
  NONE = 0;
  MATRIX_3D = 1;
  PERSPECTIVE = 2;
  TRANSLATE_Z = 3;
  ROTATE_X = 4;
  ROTATE_Y = 5;
  ROTATE_Z = 6;
}

message TransformFnValue {
  Matrix4f matrix3d = 1;
  float perspective = 2;
  float rotateAngle = 3;
  float translateValue = 4;
}

message TransformFn {
  TransformFnType type = 1;
  TransformFnValue value = 2;
}

message TransformSchemaValue {
  FixedOrderTransform3d fixedOrderTransform3d = 1;
  TransformFn[] transformFunctions = 2;
}

message Transform3d {
  TransformSchemaType type = 1;
  TransformSchemaValue value = 2;
  bool backfaceHidden = 3;
}

struct NumberVector2D {
  Number x;
  Number y;
}

message Scene3d {
  float perspective = 1;
  NumberVector2D perspectiveOrigin = 2;
  bool preserve3d = 3;
}

message TransformOrigin {
  Number x = 1;
  Number y = 2;
}

message TransitionInfo {
  TransitionType type = 1;
  float duration = 2;
}

enum PrototypeDeviceType {
  NONE = 0;
  PRESET = 1;
  CUSTOM = 2;
  PRESENTATION = 3;
}

enum DeviceRotation {
  NONE = 0;
  CCW_90 = 1;
}

message PrototypeDevice {
  PrototypeDeviceType type = 1;
  Vector size = 2;
  string presetIdentifier = 3;
  DeviceRotation rotation = 4;
}

enum OverlayPositionType {
  CENTER = 0;
  TOP_LEFT = 1;
  TOP_CENTER = 2;
  TOP_RIGHT = 3;
  BOTTOM_LEFT = 4;
  BOTTOM_CENTER = 5;
  BOTTOM_RIGHT = 6;
  MANUAL = 7;
}

enum OverlayBackgroundInteraction {
  NONE = 0;
  CLOSE_ON_CLICK_OUTSIDE = 1;
}

enum OverlayBackgroundType {
  NONE = 0;
  SOLID_COLOR = 1;
}

message OverlayBackgroundAppearance {
  OverlayBackgroundType backgroundType = 1;
  Color backgroundColor = 2;
}

enum NavigationType {
  NAVIGATE = 0;
  OVERLAY = 1;
  SWAP = 2;
  SWAP_STATE = 3;
  SCROLL_TO = 4;
}

enum ExportColorProfile {
  DOCUMENT = 0;
  SRGB = 1;
  DISPLAY_P3_V4 = 2;
  CMYK = 3;
}

enum ExportBackgroundType {
  SOLID = 0;
  TRANSPARENT = 1;
  GRID = 2;
}

message ExportSettings {
  string suffix = 1;
  ImageType imageType = 2;
  ExportConstraint constraint = 3;
  bool svgDataName = 4;
  ExportSVGIDMode svgIDMode = 5;
  bool svgOutlineText = 6;
  bool contentsOnly = 7;
  bool svgForceStrokeMasks = 8;
  bool useAbsoluteBounds = 9;
  ExportColorProfile colorProfile = 10;
  float quality = 11;
  bool useBicubicSampler = 12;
  int frameRate = 13;
  int loopCount = 14;
  ExportBackgroundType backgroundType = 15;
}

enum ExportSVGIDMode {
  IF_NEEDED = 0;
  ALWAYS = 1;
}

message LayoutGrid {
  LayoutGridType type = 1;
  Axis axis = 2;
  bool visible = 3;
  int numSections = 4;
  float offset = 5;
  float sectionSize = 6;
  float gutterSize = 7;
  Color color = 8;
  LayoutGridPattern pattern = 9;
  VariableData numSectionsVar = 10;
  VariableData offsetVar = 11;
  VariableData sectionSizeVar = 12;
  VariableData gutterSizeVar = 13;
}

message Guide {
  Axis axis = 1;
  float offset = 2;
  GUID guid = 3;
}

message Path {
  WindingRule windingRule = 1;
  uint commandsBlob = 2;
  uint styleID = 3;
}

enum StyleType {
  NONE = 0;
  FILL = 1;
  STROKE = 2;
  TEXT = 3;
  EFFECT = 4;
  EXPORT = 5;
  GRID = 6;
  ANIMATION = 7;
}

enum BrushOrientation {
  FORWARD = 0;
  REVERSE = 1;
}

enum BrushType {
  STRETCH = 0;
  SCATTER = 1;
}

message DynamicStrokeSettings {
  float frequency = 1;
  float wiggle = 2;
  float smoothen = 3;
}

message ScatterStrokeSettings {
  float gap = 1;
  float wiggle = 2;
  float angularJitter = 3;
  float rotation = 4;
  float sizeJitter = 5;
}

message StretchStrokeSettings {
  BrushOrientation orientation = 1;
}

message StrokeData {
  Stroke[] strokes = 1;
  uint version = 2;
}

message Stroke {
  int strokeId = 1;
  float strokeWeight = 2;
  VariableData strokeWeightVar = 3;
  Paint[] strokePaint = 4;
  StyleId styleIdForStrokeFill = 5;
  StrokeAlign strokeAlign = 6;
  StrokeCap strokeCap = 7;
  Number strokeCapSize = 8;
  StrokeJoin strokeJoin = 9;
  float miterLimit = 10;
  float[] dashPattern = 11;
  OptionalVector pathTrim = 12;
  float strokeOffset = 13;
  bool isDeleted = 14;
}

message VariableWidthPoint {
  float position = 1;
  float ascent = 2;
  float descent = 3;
  int segmentId = 4;
}

message SharedStyleReference {
  string styleKey = 1;
  string versionHash = 2;
}

message SharedStyleMasterData {
  string styleKey = 1;
  string sortPosition = 2;
  string fileKey = 3;
}

enum ScrollBehavior {
  SCROLLS = 0;
  FIXED_WHEN_CHILD_OF_SCROLLING_FRAME = 1;
  STICKY_SCROLLS = 2;
}

message ArcData {
  float startingAngle = 1;
  float endingAngle = 2;
  float innerRadius = 3;
}

message SymbolLink {
  string uri = 1;
  string displayName = 2;
  string displayText = 3;
}

message PluginData {
  string pluginID = 1;
  string value = 2;
  string key = 3;
}

message PluginRelaunchData {
  string pluginID = 1;
  string message = 2;
  string command = 3;
  bool isDeleted = 4;
  CodeComponentId customToolId = 5;
}

message MultiplayerFieldVersion {
  uint counter = 1;
  uint sessionID = 2;
}

enum ConnectorMagnet {
  NONE = 0;
  AUTO = 1;
  TOP = 2;
  LEFT = 3;
  BOTTOM = 4;
  RIGHT = 5;
  CENTER = 6;
  AUTO_HORIZONTAL = 7;
  EDGE = 8;
  ABSOLUTE = 9;
}

message ConnectorEndpoint {
  GUID endpointNodeID = 1;
  Vector position = 2;
  ConnectorMagnet magnet = 3;
  Vector relativePosition = 4;
}

message ConnectorControlPoint {
  Vector position = 1;
  Vector axis = 2;
}

enum ConnectorTextSection {
  MIDDLE_TO_START = 0;
  MIDDLE_TO_END = 1;
}

enum ConnectorOffAxisOffset {
  NONE = 0;
  ABOVE = 1;
  BELOW = 2;
}

message ConnectorTextMidpoint {
  ConnectorTextSection section = 1;
  float offset = 2;
  ConnectorOffAxisOffset offAxisOffset = 3;
}

enum ConnectorLineStyle {
  ELBOWED = 0;
  STRAIGHT = 1;
  CURVED = 2;
}

enum ConnectorType {
  MANUAL = 0;
  DIAGRAM = 1;
}

enum AnnotationPropertyType {
  FILL = 0;
  STROKE = 1;
  WIDTH = 2;
  HEIGHT = 3;
  MIN_WIDTH = 4;
  MIN_HEIGHT = 5;
  MAX_WIDTH = 6;
  MAX_HEIGHT = 7;
  STROKE_WIDTH = 8;
  CORNER_RADIUS = 9;
  EFFECT = 10;
  TEXT_STYLE = 11;
  TEXT_ALIGN_HORIZONTAL = 12;
  FONT_FAMILY = 13;
  FONT_SIZE = 14;
  FONT_WEIGHT = 15;
  LINE_HEIGHT = 16;
  LETTER_SPACING = 17;
  STACK_SPACING = 18;
  STACK_PADDING = 19;
  STACK_MODE = 20;
  STACK_ALIGNMENT = 21;
  OPACITY = 22;
  COMPONENT = 23;
  FONT_STYLE = 24;
  GRID_ROW_GAP = 25;
  GRID_COLUMN_GAP = 26;
  GRID_ROW_COUNT = 27;
  GRID_COLUMN_COUNT = 28;
  GRID_ROW_ANCHOR_INDEX = 29;
  GRID_COLUMN_ANCHOR_INDEX = 30;
  GRID_ROW_SPAN = 31;
  GRID_COLUMN_SPAN = 32;
}

message AnnotationProperty {
  AnnotationPropertyType type = 1;
}

enum AnnotationCategoryPreset {
  NONE = 0;
  ACCESSIBILITY = 1;
  BEHAVIOR = 2;
  CONTENT = 3;
  DEVELOPMENT = 4;
  INTERACTION = 5;
}

enum AnnotationCategoryColor {
  YELLOW = 0;
  ORANGE = 1;
  RED = 2;
  PINK = 3;
  VIOLET = 4;
  BLUE = 5;
  TEAL = 6;
  GREEN = 7;
}

message AnnotationCategoryCustom {
  AnnotationCategoryColor color = 1;
  Color customColor = 2;
  string label = 3;
}

message AnnotationCategory {
  GUID id = 1;
  AnnotationCategoryPreset preset = 2;
  AnnotationCategoryCustom custom = 3;
}

message AnnotationCategories {
  uint version = 1;
  AnnotationCategory[] items = 2;
}

message Annotation {
  string label = 1;
  AnnotationProperty[] properties = 2;
  string labelV2 = 3;
  GUID categoryId = 4;
}

enum AnnotationMeasurementNodeSide {
  TOP = 0;
  BOTTOM = 1;
  LEFT = 2;
  RIGHT = 3;
}

message AnnotationMeasurement {
  GUID id = 1;
  GUID fromNode = 2;
  GUID toNode = 3;
  AnnotationMeasurementNodeSide fromNodeSide = 4;
  bool toSameSide = 5;
  float innerOffsetRelative = 6;
  float outerOffsetFixed = 7;
  GUIDPath toNodeStablePath = 8;
  string freeText = 9;
}

message LibraryMoveInfo {
  string oldKey = 1;
  string pasteFileKey = 2;
}

message LibraryMoveHistoryItem {
  GUID sourceNodeId = 1;
  string sourceComponentKey = 2;
}

message DeveloperRelatedLink {
  string nodeId = 1;
  string fileKey = 2;
  string linkName = 3;
  string linkUrl = 4;
}

message WidgetPointer {
  GUID nodeId = 1;
}

message EditInfo {
  string timestampIso8601 = 1;
  string userId = 2;
  uint lastEditedAt = 3;
  uint createdAt = 4;
}

enum EditorType {
  DESIGN = 0;
  WHITEBOARD = 1;
  SLIDES = 2;
  DEV_HANDOFF = 3;
  SITES = 4;
  COOPER = 5;
  ILLUSTRATION = 6;
  FIGMAKE = 7;
  FIGSPEC = 8;
}

enum MaskType {
  ALPHA = 0;
  OUTLINE = 1;
  LUMINANCE = 2;
}

enum ModuleType {
  NONE = 0;
  SINGLE_NODE = 1;
  MULTI_NODE = 2;
}

enum SectionStatus {
  NONE = 0;
  BUILD = 1;
  COMPLETED = 2;
}

message SectionStatusInfo {
  SectionStatus status = 1;
  uint lastUpdateUnixTimestamp = 2;
  string description = 3;
  string userId = 4;
  SectionStatus prevStatus = 5;
}

message BuzzApprovalRequestInfo {
  string requestId = 1;
  string requesterUserId = 2;
  uint requestedAt = 3;
  string[] reviewerUserIds = 4;
  string title = 5;
  string note = 6;
  GUID[] assetsInRequest = 7;
}

message BuzzApprovalRequests {
  BuzzApprovalRequestInfo[] requests = 1;
}

enum BuzzApprovalNodeStatus {
  NONE = 0;
  IN_REVIEW = 1;
  APPROVED = 2;
  CHANGES_REQUESTED = 3;
}

message BuzzApprovalNodeStatusInfo {
  BuzzApprovalNodeStatus currentStatus = 1;
  bool wasPreviouslyApproved = 2;
  uint[] approvalRevokedAtHistory = 3;
}

message CodeEmbedInfo {
  string url = 1;
  string srcUrl = 2;
  string title = 3;
  string thumbnailImageHash = 4;
  bool isPublishedSite = 5;
}

enum VariableTimingDisplayUnit {
  MILLISECONDS = 0;
  SECONDS = 1;
}

message NodeChange {
  GUID guid = 1;
  uint guidTag = 53;
  NodePhase phase = 2;
  uint phaseTag = 54;
  ParentIndex parentIndex = 3;
  uint parentIndexTag = 55;
  NodeType type = 4;
  uint typeTag = 56;
  string name = 5;
  uint nameTag = 57;
  bool isPublishable = 174;
  string description = 318;
  LibraryMoveInfo libraryMoveInfo = 256;
  LibraryMoveHistoryItem[] libraryMoveHistory = 281;
  string key = 319;
  AssetIdMap fileAssetIds = 383;
  uint styleID = 49;
  uint styleIDTag = 101;
  bool isFillStyle = 157;
  bool isStrokeStyle = 161;
  bool isOverrideOverTextStyle = 376;
  StyleType styleType = 163;
  string styleDescription = 191;
  string version = 171;
  string userFacingVersion = 399;
  string sortPosition = 320;
  SharedStyleMasterData ojansSuperSecretNodeField = 345;
  SharedStyleMasterData sevMoonlitLilyData = 348;
  bool isSoftDeletedStyle = 176;
  bool isNonUpdateable = 177;
  SharedStyleMasterData sharedStyleMasterData = 172;
  SharedStyleReference sharedStyleReference = 173;
  GUID inheritFillStyleID = 158;
  GUID inheritStrokeStyleID = 162;
  GUID inheritTextStyleID = 167;
  GUID inheritExportStyleID = 168;
  GUID inheritEffectStyleID = 169;
  GUID inheritGridStyleID = 170;
  GUID inheritFillStyleIDForStroke = 185;
  StyleId styleIdForFill = 332;
  StyleId styleIdForStrokeFill = 333;
  StyleId styleIdForText = 334;
  StyleId styleIdForEffect = 335;
  StyleId styleIdForGrid = 336;
  StyleAnimation[] styleAnimations = 580;
  Paint[] backgroundPaints = 193;
  GUID inheritFillStyleIDForBackground = 194;
  bool isStateGroup = 225;
  StateGroupPropertyValueOrder[] stateGroupPropertyValueOrders = 238;
  PartialPasteAnnotation partialPasteAnnotation = 581;
  SharedSymbolReference sharedSymbolReference = 122;
  bool isSymbolPublishable = 123;
  GUIDPathMapping[] sharedSymbolMappings = 124;
  string sharedSymbolVersion = 126;
  SharedComponentMasterData sharedComponentMasterData = 152;
  string symbolDescription = 144;
  GUIDPathMapping[] unflatteningMappings = 164;
  GUIDPathMapping[] forceUnflatteningMappings = 228;
  string publishFile = 214;
  string sourceLibraryKey = 395;
  GUID publishID = 215;
  string componentKey = 216;
  bool isC2 = 217;
  string publishedVersion = 218;
  string originComponentKey = 252;
  ComponentPropDef[] componentPropDefs = 266;
  ComponentPropRef[] componentPropRefs = 267;
  VariantPropSpec[] variantPropSpecs = 483;
  SymbolData symbolData = 113;
  uint symbolDataTag = 114;
  NodeChange[] derivedSymbolData = 125;
  bool nestedInstanceResizeEnabled = 394;
  GUID overriddenSymbolID = 143;
  ComponentPropAssignment[] componentPropAssignments = 268;
  bool propsAreBubbled = 305;
  InstanceOverrideStash[] overrideStash = 248;
  InstanceOverrideStashV2[] overrideStashV2 = 250;
  GUIDPath guidPath = 111;
  uint guidPathTag = 112;
  int overrideLevel = 321;
  ModuleType moduleType = 382;
  bool isSlot = 463;
  bool isSlotContent = 495;
  float fontSize = 21;
  uint fontSizeTag = 73;
  float paragraphIndent = 22;
  uint paragraphIndentTag = 74;
  float paragraphSpacing = 23;
  uint paragraphSpacingTag = 75;
  TextAlignHorizontal textAlignHorizontal = 32;
  uint textAlignHorizontalTag = 84;
  TextAlignVertical textAlignVertical = 33;
  uint textAlignVerticalTag = 85;
  TextCase textCase = 34;
  uint textCaseTag = 86;
  TextDecoration textDecoration = 35;
  uint textDecorationTag = 87;
  Number lineHeight = 40;
  uint lineHeightTag = 92;
  FontName fontName = 41;
  uint fontNameTag = 93;
  TextData textData = 42;
  uint textDataTag = 94;
  DerivedTextData derivedTextData = 359;
  bool fontVariantCommonLigatures = 127;
  bool fontVariantContextualLigatures = 128;
  bool fontVariantDiscretionaryLigatures = 129;
  bool fontVariantHistoricalLigatures = 130;
  bool fontVariantOrdinal = 131;
  bool fontVariantSlashedZero = 132;
  FontVariantNumericFigure fontVariantNumericFigure = 133;
  FontVariantNumericSpacing fontVariantNumericSpacing = 134;
  FontVariantNumericFraction fontVariantNumericFraction = 135;
  FontVariantCaps fontVariantCaps = 136;
  FontVariantPosition fontVariantPosition = 137;
  Number letterSpacing = 165;
  string fontVersion = 202;
  LeadingTrim leadingTrim = 322;
  bool hangingPunctuation = 337;
  bool hangingList = 339;
  bool fallbackGlyphs = 550;
  int maxLines = 351;
  ResponsiveTextStyleVariant[] responsiveTextStyleVariants = 417;
  SectionStatus sectionStatus = 352;
  SectionStatusInfo sectionStatusInfo = 355;
  uint textUserLayoutVersion = 203;
  uint textExplicitLayoutVersion = 396;
  OpenTypeFeature[] toggledOnOTFeatures = 205;
  OpenTypeFeature[] toggledOffOTFeatures = 206;
  Hyperlink hyperlink = 223;
  Mention mention = 340;
  FontVariation[] fontVariations = 260;
  uint textBidiVersion = 279;
  TextTruncation textTruncation = 280;
  bool hasHadRTLText = 292;
  EmojiImageSet emojiImageSet = 391;
  string slideThumbnailHash = 392;
  bool visible = 6;
  uint visibleTag = 58;
  bool locked = 7;
  uint lockedTag = 59;
  LockMode lockMode = 434;
  float opacity = 8;
  uint opacityTag = 60;
  BlendMode blendMode = 9;
  uint blendModeTag = 61;
  Vector size = 11;
  uint sizeTag = 63;
  Matrix transform = 12;
  uint transformTag = 64;
  float[] dashPattern = 13;
  uint dashPatternTag = 65;
  bool mask = 16;
  uint maskTag = 68;
  Vector rotationOrigin = 424;
  bool maskIsOutline = 18;
  uint maskIsOutlineTag = 70;
  MaskType maskType = 317;
  float backgroundOpacity = 19;
  uint backgroundOpacityTag = 71;
  float cornerRadius = 20;
  uint cornerRadiusTag = 72;
  float strokeWeight = 26;
  uint strokeWeightTag = 78;
  StrokeAlign strokeAlign = 29;
  uint strokeAlignTag = 81;
  StrokeCap strokeCap = 30;
  uint strokeCapTag = 82;
  Number strokeCapSize = 497;
  StrokeJoin strokeJoin = 31;
  uint strokeJoinTag = 83;
  Paint[] fillPaints = 38;
  uint fillPaintsTag = 90;
  Paint[] strokePaints = 39;
  uint strokePaintsTag = 91;
  Effect[] effects = 43;
  uint effectsTag = 95;
  Color backgroundColor = 50;
  uint backgroundColorTag = 102;
  Path[] fillGeometry = 51;
  uint fillGeometryTag = 103;
  Path[] strokeGeometry = 52;
  uint strokeGeometryTag = 104;
  Path[] offsetFillMaskGeometry = 564;
  Paint[] textDecorationFillPaints = 411;
  bool textDecorationSkipInk = 412;
  Number textUnderlineOffset = 413;
  Number textDecorationThickness = 415;
  TextDecorationStyle textDecorationStyle = 416;
  TransformModifier[] transformModifiers = 455;
  Transform3d transform3d = 570;
  StrokeData strokeData = 571;
  Scene3d scene3d = 572;
  TransformOrigin transformOrigin = 587;
  float rectangleTopLeftCornerRadius = 145;
  float rectangleTopRightCornerRadius = 146;
  float rectangleBottomLeftCornerRadius = 147;
  float rectangleBottomRightCornerRadius = 148;
  bool rectangleCornerRadiiIndependent = 149;
  bool rectangleCornerToolIndependent = 150;
  bool proportionsConstrained = 151;
  OptionalVector targetAspectRatio = 423;
  bool useAbsoluteBounds = 258;
  bool borderTopHidden = 287;
  bool borderBottomHidden = 288;
  bool borderLeftHidden = 289;
  bool borderRightHidden = 290;
  bool bordersTakeSpace = 294;
  float borderTopWeight = 295;
  float borderBottomWeight = 296;
  float borderLeftWeight = 297;
  float borderRightWeight = 298;
  bool borderStrokeWeightsIndependent = 299;
  ConstraintType horizontalConstraint = 28;
  uint horizontalConstraintTag = 80;
  StackMode stackMode = 105;
  uint stackModeTag = 106;
  float stackSpacing = 107;
  uint stackSpacingTag = 108;
  float stackPadding = 109;
  uint stackPaddingTag = 110;
  StackCounterAlign stackCounterAlign = 120;
  StackJustify stackJustify = 121;
  StackAlign stackAlign = 208;
  float stackHorizontalPadding = 209;
  float stackVerticalPadding = 210;
  StackSize stackWidth = 211;
  StackSize stackHeight = 212;
  StackSize stackPrimarySizing = 229;
  StackJustify stackPrimaryAlignItems = 230;
  StackAlign stackCounterAlignItems = 231;
  float stackChildPrimaryGrow = 232;
  float stackPaddingRight = 233;
  float stackPaddingBottom = 234;
  StackCounterAlign stackChildAlignSelf = 236;
  StackPositioning stackPositioning = 269;
  bool stackReverseZIndex = 271;
  StackWrap stackWrap = 323;
  float stackCounterSpacing = 324;
  OptionalVector minSize = 325;
  OptionalVector maxSize = 326;
  StackCounterAlignContent stackCounterAlignContent = 343;
  int[] sortedMovingChildIndices = 406;
  uint stackLayoutVersion = 574;
  GUIDPositionMap gridRows = 435;
  GUIDPositionMap gridColumns = 436;
  float gridRowGap = 437;
  float gridColumnGap = 438;
  GUID gridRowAnchor = 439;
  GUID gridColumnAnchor = 440;
  uint gridRowSpan = 441;
  uint gridColumnSpan = 442;
  GUIDGridTrackSizeMap gridColumnsSizing = 474;
  GUIDGridTrackSizeMap gridRowsSizing = 475;
  GridChildAlign gridChildVerticalAlign = 476;
  GridChildAlign gridChildHorizontalAlign = 477;
  GridAutoTracks gridAutoTracks = 555;
  bool gridReflowEnabled = 556;
  bool isSnakeGameBoard = 344;
  GUID transitionNodeID = 139;
  GUID prototypeStartNodeID = 140;
  Color prototypeBackgroundColor = 141;
  TransitionInfo transitionInfo = 153;
  TransitionType transitionType = 154;
  float transitionDuration = 155;
  EasingType easingType = 156;
  bool transitionPreserveScroll = 181;
  ConnectionType connectionType = 182;
  string connectionURL = 183;
  PrototypeDevice prototypeDevice = 184;
  InteractionType interactionType = 187;
  float transitionTimeout = 188;
  bool interactionMaintained = 189;
  float interactionDuration = 190;
  bool destinationIsOverlay = 192;
  bool transitionShouldSmartAnimate = 207;
  PrototypeInteraction[] prototypeInteractions = 226;
  PrototypeInteraction[] objectAnimations = 426;
  PrototypeStartingPoint prototypeStartingPoint = 249;
  PluginData[] pluginData = 204;
  PluginRelaunchData[] pluginRelaunchData = 219;
  ConnectorEndpoint connectorStart = 242;
  ConnectorEndpoint connectorEnd = 243;
  ConnectorLineStyle connectorLineStyle = 244;
  StrokeCap connectorStartCap = 245;
  StrokeCap connectorEndCap = 246;
  ConnectorControlPoint[] connectorControlPoints = 253;
  ConnectorControlPoint[] connectorBezierControlPoints = 479;
  ConnectorTextMidpoint connectorTextMidpoint = 255;
  ConnectorType connectorType = 373;
  int connectorVersion = 533;
  Annotation[] annotations = 369;
  AnnotationMeasurement[] measurements = 384;
  AnnotationCategories annotationCategories = 453;
  ShapeWithTextType shapeWithTextType = 241;
  float shapeUserHeight = 247;
  bool isStrokePaintDerived = 530;
  DerivedImmutableFrameData derivedImmutableFrameData = 254;
  MultiplayerFieldVersion derivedImmutableFrameDataVersion = 338;
  NodeGenerationData nodeGenerationData = 240;
  JsxData jsxData = 491;
  DerivedJsxData derivedJsxData = 492;
  string stableKey = 493;
  CodeBlockLanguage codeBlockLanguage = 259;
  CodeBlockTheme codeBlockTheme = 433;
  LinkPreviewData linkPreviewData = 278;
  bool shapeTruncates = 282;
  bool sectionContentsHidden = 283;
  VideoPlayback videoPlayback = 300;
  StampData stampData = 301;
  SectionPresetInfo sectionPresetInfo = 370;
  PlatformShapeDefinition platformShapeDefinition = 409;
  MultiplayerMap widgetSyncedState = 273;
  uint widgetSyncCursor = 274;
  WidgetDerivedSubtreeCursor widgetDerivedSubtreeCursor = 275;
  WidgetPointer widgetCachedAncestor = 276;
  WidgetInputBehavior widgetInputBehavior = 285;
  string widgetTooltip = 286;
  WidgetHoverStyle widgetHoverStyle = 291;
  bool isWidgetStickable = 293;
  bool shouldHideCursorsOnWidgetHover = 360;
  WidgetMetadata widgetMetadata = 262;
  WidgetEvent[] widgetEvents = 263;
  WidgetPropertyMenuItem[] widgetPropertyMenuItems = 265;
  WidgetInputTextNodeType widgetInputTextNodeType = 401;
  MultiplayerMap jsxProps = 489;
  TableRowColumnPositionMap tableRowPositions = 308;
  TableRowColumnPositionMap tableColumnPositions = 309;
  TableRowColumnSizeMap tableRowHeights = 310;
  TableRowColumnSizeMap tableColumnWidths = 311;
  TableMergedCellMap tableMergedCells = 538;
  MultiplayerMap interactiveSlideConfigData = 371;
  MultiplayerMap interactiveSlideParticipantData = 372;
  FlappType flappType = 402;
  bool isEmbeddedPrototype = 486;
  string slideSpeakerNotes = 389;
  bool isSkippedSlide = 410;
  MultiplayerMap presentationOutlines = 573;
  ThemeID themeID = 379;
  SlideThemeData slideThemeData = 381;
  SlideThemeMap slideThemeMap = 390;
  string slideTemplateFileKey = 393;
  SlideNumber slideNumber = 443;
  string slideNumberSeparator = 456;
  GUID diagramParentId = 363;
  GUID layoutRoot = 362;
  string layoutPosition = 364;
  DiagramLayoutRuleType diagramLayoutRuleType = 366;
  DiagramParentIndex diagramParentIndex = 367;
  DiagramLayoutPaused diagramLayoutPaused = 368;
  bool isPageDivider = 380;
  InternalEnumForTest internalEnumForTest = 251;
  InternalDataForTest internalDataForTest = 257;
  bool autoRename = 14;
  uint autoRenameTag = 66;
  bool backgroundEnabled = 15;
  uint backgroundEnabledTag = 67;
  bool exportContentsOnly = 17;
  uint exportContentsOnlyTag = 69;
  float miterLimit = 25;
  uint miterLimitTag = 77;
  float textTracking = 27;
  uint textTrackingTag = 79;
  ConstraintType verticalConstraint = 37;
  uint verticalConstraintTag = 89;
  ExportSettings[] exportSettings = 45;
  uint exportSettingsTag = 97;
  TextAutoResize textAutoResize = 46;
  uint textAutoResizeTag = 98;
  LayoutGrid[] layoutGrids = 47;
  uint layoutGridsTag = 99;
  bool frameMaskDisabled = 115;
  uint frameMaskDisabledTag = 116;
  bool resizeToFit = 117;
  uint resizeToFitTag = 118;
  BooleanOperation booleanOperation = 36;
  uint booleanOperationTag = 88;
  VectorMirror handleMirroring = 44;
  uint handleMirroringTag = 96;
  uint count = 10;
  uint countTag = 62;
  float starInnerScale = 24;
  uint starInnerScaleTag = 76;
  ArcData arcData = 195;
  VectorData vectorData = 48;
  uint vectorDataTag = 100;
  uint vectorOperationVersion = 425;
  TextPathStart textPathStart = 432;
  bool exportBackgroundDisabled = 119;
  Guide[] guides = 138;
  bool internalOnly = 142;
  ScrollDirection scrollDirection = 159;
  float cornerSmoothing = 160;
  Vector scrollOffset = 166;
  bool exportTextAsSVGText = 175;
  ScrollContractedState scrollContractedState = 178;
  Vector contractedSize = 179;
  string fixedChildrenDivider = 180;
  ScrollBehavior scrollBehavior = 186;
  int derivedSymbolDataLayoutVersion = 196;
  NavigationType navigationType = 197;
  OverlayPositionType overlayPositionType = 198;
  Vector overlayRelativePosition = 199;
  OverlayBackgroundInteraction overlayBackgroundInteraction = 200;
  OverlayBackgroundAppearance overlayBackgroundAppearance = 201;
  GUID overrideKey = 213;
  bool containerSupportsFillStrokeAndCorners = 220;
  StackSize stackCounterSizing = 221;
  bool containersSupportFillStrokeAndCorners = 222;
  KeyTrigger keyTrigger = 224;
  string voiceEventPhrase = 227;
  GUID[] ancestorPathBeforeDeletion = 235;
  SymbolLink[] symbolLinks = 237;
  TextListData textListData = 239;
  bool detachOpticalSizeFromFontSize = 261;
  float listSpacing = 264;
  EmbedData embedData = 270;
  RichMediaData richMediaData = 272;
  MultiplayerMap renderedSyncedState = 277;
  bool simplifyInstancePanels = 284;
  HTMLTag accessibleHTMLTag = 302;
  ARIARole ariaRole = 303;
  ARIAAttributesMap ariaAttributes = 357;
  string accessibleLabel = 304;
  bool isDecorativeImage = 490;
  VariableData variableData = 306;
  VariableDataMap variableConsumptionMap = 307;
  VariableModeBySetMap variableModeBySetMap = 316;
  VariableSetMode[] variableSetModes = 312;
  VariableSetID variableSetID = 313;
  VariableResolvedDataType variableResolvedType = 314;
  VariableDataValues variableDataValues = 315;
  string variableTokenName = 350;
  VariableTimingDisplayUnit timingDisplayUnit = 566;
  VariableScope[] variableScopes = 353;
  VariableDataMap parameterConsumptionMap = 445;
  CodeSyntaxMap codeSyntax = 358;
  PasteSource pasteSource = 388;
  EditorType pageType = 397;
  GUID strokeBrushGuid = 446;
  uint64 strokeSeed = 482;
  VariableWidthPoint[] variableWidthPoints = 447;
  DynamicStrokeSettings dynamicStrokeSettings = 448;
  ScatterStrokeSettings scatterStrokeSettings = 449;
  StretchStrokeSettings stretchStrokeSettings = 450;
  Matrix[] scatterBrushTransforms = 488;
  BrushType brushType = 452;
  OptionalVector pathTrim = 542;
  float strokeOffset = 554;
  VariableSetID backingVariableSetId = 377;
  VariableID overriddenVariableId = 464;
  VariableIdOrVariableOverrideId backingVariableId = 378;
  bool isCollectionExtendable = 385;
  string rootVariableKey = 386;
  InheritedVariablesData inheritedVariableIds = 517;
  HandoffStatusMap handoffStatusMap = 361;
  AgendaPositionMap agendaPositionMap = 327;
  AgendaMetadataMap agendaMetadataMap = 328;
  MigrationStatus migrationStatus = 329;
  bool isSoftDeleted = 330;
  EditInfo editInfo = 331;
  ColorProfile colorProfile = 341;
  SymbolId detachedSymbolId = 342;
  ChildReadingDirection childReadingDirection = 346;
  string readingIndex = 347;
  DocumentColorProfile documentColorProfile = 349;
  DeveloperRelatedLink[] developerRelatedLinks = 354;
  string slideActiveThemeLibKey = 356;
  EditScopeInfo editScopeInfo = 365;
  SemanticWeight semanticWeight = 374;
  SemanticItalic semanticItalic = 375;
  bool areSlidesManuallyIndented = 403;
  bool isResponsiveSet = 387;
  DerivedBreakpointData derivedBreakpointData = 500;
  GUID defaultResponsiveSetId = 398;
  bool isPrimaryBreakpoint = 458;
  GUID primaryResponsiveNodeId = 457;
  GUID multiEditGlueId = 462;
  float breakpointMinWidth = 501;
  bool isBreakpointInFocus = 522;
  ResponsiveSetSettings responsiveSetSettings = 400;
  NodeBehaviors behaviors = 404;
  string sourceCode = 414;
  CollaborativeTextOpID[] sourceCodeCollaborativeTextVersion = 534;
  CollaborativePlainText collaborativeSourceCode = 444;
  CodeLibraryId belongsToCodeLibraryId = 427;
  ImportedCodeFiles importedCodeFiles = 467;
  CanvasNodeId codeFileCanvasNodeId = 468;
  bool isEntrypointCodeFile = 498;
  string componentOrStateGroupKey = 502;
  uint componentOrStateGroupVersion = 503;
  string sourceCodeLibraryKey = 504;
  string[] sourceCodeLibraryKeys = 515;
  UsedMakeLibrary[] usedMakeLibraries = 524;
  string makeLibraryComponentId = 518;
  bool shouldHidePreviewForMakeKitCreation = 520;
  bool isMakeKit = 551;
  PrototypeDevice codePreviewSettings = 531;
  CodeExample[] codeExamples = 525;
  CodeFileId exportedFromCodeFileId = 428;
  string codeExportName = 430;
  string codeComponentDescription = 547;
  CodeComponentId backingCodeComponentId = 429;
  bool isMainCodeComponent = 487;
  CodeSnapshotState codeSnapshotState = 431;
  NodeChatMessage[] chatMessages = 451;
  NodeChatCompressionState chatCompressionState = 485;
  AIChatThread aiChatThread = 496;
  string codeChatMessagesKey = 484;
  CodeSnapshot codeSnapshot = 459;
  CodeSnapshotLayers codeSnapshotLayers = 589;
  uint codeSnapshotInvalidatedAt = 480;
  bool isCodeBehavior = 465;
  bool autoForkCode = 469;
  bool hasBeenManuallyRenamed = 470;
  bool codeCreatedFromDesign = 471;
  CanvasNodeId codeCreatedFromDesignNodeId = 481;
  ImageImportMap imageImports = 473;
  CodeObjectType codeObjectType = 516;
  string codeFilePath = 472;
  CodeBehaviorData codeBehaviorData = 478;
  uint codeLibraryFormat = 519;
  bool isCodePreviewPlayingOnCanvas = 527;
  CodeEmbedInfo codeEmbedInfo = 532;
  bool isEmbedCodeLayer = 546;
  CodeSourceInfo codeSourceInfo = 558;
  string mimeType = 536;
  byte[] blobRef = 537;
  CMSSelector cmsSelector = 419;
  CMSConsumptionMap cmsConsumptionMap = 420;
  CMSRichTextStyleMap cmsRichTextStyleMap = 460;
  SymbolId repeaterSymbolId = 539;
  RepeaterCmsOverrideData repeaterCmsOverrideData = 540;
  RepeaterSymbolOverrideData repeaterSymbolOverrideData = 549;
  RepeaterOverrideData repeaterOverrideData = 541;
  uint[] aiEditedNodeChangeFieldNumbers = 405;
  string aiEditScopeLabel = 408;
  FirstDraftData firstDraftData = 407;
  FirstDraftKitElementData firstDraftKitElementData = 418;
  CooperRevertData cooperRevertData = 421;
  CooperTemplateData cooperTemplateData = 461;
  BuzzApprovalRequests buzzApprovalRequests = 528;
  BuzzApprovalNodeStatusInfo buzzApprovalNodeStatusInfo = 529;
  HubFileAttribution hubFileAttribution = 422;
  ManagedStringData managedStringData = 454;
  ThumbnailInfo thumbnailInfo = 466;
  AiCanvasPrompt aiCanvasPrompt = 494;
  CanvasNodeId backingNodeId = 499;
  string pageStatus = 548;
  TRSSTransform2D motionTransform = 523;
  int64 timelinePosition = 506;
  KeyframeValueData keyframeValue = 507;
  VariableData keyframeValueRef = 586;
  InterpolationType interpolationType = 505;
  BezierHandles bezierHandles = 508;
  EasingData easingData = 535;
  KeyframeOperation keyframeOperation = 509;
  TimelinePositionType timelinePositionType = 510;
  bool isClip = 545;
  GUID clipId = 511;
  uint64 timelineDuration = 512;
  int64 timelineOffset = 513;
  bool timelineDisabled = 543;
  PlaybackStyle playbackStyle = 514;
  TimelineDefinitionsMap timelineDefinitions = 552;
  TimelineAssignmentsMap timelineAssignments = 553;
  AnimationPresets animationPresets = 521;
  StyleIdForAnimation[] styleIdsForAnimation = 582;
  AnimationPresetId backingAnimationPresetId = 583;
  Tools tools = 568;
  CustomEffects customEffects = 569;
  TransitionOverrideData transitionOverrides = 526;
  bool useLegacySmartAnimate = 544;
  SourceControlConfig sourceControlConfig = 557;
  SpecBlockType specBlockType = 559;
  CollaborativePlainText specBlockContent = 560;
  string specCodeBlockLanguage = 561;
  string specBlockTableAlignment = 562;
  int specBlockIndentLevel = 563;
  string specImageHash = 575;
  int specWidth = 576;
  int specHeight = 577;
  TableRowColumnSizeMap specBlockTableRowHeights = 578;
  TableRowColumnSizeMap specBlockTableColumnWidths = 579;
  string specEmbedUrl = 590;
  bool placeholder = 565;
  string placeholderClientLifecycleId = 584;
  int placeholderInvalidateAt = 585;
  bool disableJitDst = 567;
  CustomToolArtifactRef customToolArtifactRef = 588;
}

enum GitRepoRefProvider {
  UGIT = 0;
  GITHUB = 1;
  OTHER = 2;
}

message GitRepoRef {
  GitRepoRefProvider provider = 1;
  string gitRepo = 2;
  string gitRef = 3;
}

message SourceControlConfig {
  GitRepoRef origin = 1;
  GitRepoRef upstream = 2;
}

message CodeSnapshot {
  CodeSnapshotState state = 6;
  uint invalidatedAt = 7;
  Paint[] paints = 1;
  Vector offset = 2;
  Vector layoutSize = 3;
  Vector canvasSize = 5;
  uint devicePixelRatio = 4;
}

message CodeOutputLayer {
  NodeChange node = 1;
}

message CodeSnapshotLayers {
  CodeSnapshotState state = 1;
  uint invalidatedAt = 2;
  CodeOutputLayer[] layers = 3;
}

message CodeBehaviorData {
  string name = 1;
  string icon = 2;
  string[] nodeTypes = 3;
  string category = 4;
  uint apiVersion = 5;
}

message CodeExample {
  string exampleName = 1;
  string codeExportName = 2;
}

message UsedMakeLibrary {
  string makeLibraryId = 1;
}

message CookieBannerText {
  string bannerHeader = 1;
  string bannerDisclaimerExplicit = 2;
  string bannerDisclaimerImplicit = 3;
  string policyLabel = 4;
  string acceptText = 5;
  string acknowledgeText = 6;
  string manageText = 7;
  string rejectText = 8;
  string necessaryText = 9;
  string necessaryDescription = 10;
  string analyticsText = 11;
  string analyticsDescription = 12;
  string preferencesText = 13;
  string preferencesDescription = 14;
  string marketingText = 15;
  string marketingDescription = 16;
  string saveLabel = 17;
  string triggerLabel = 18;
}

message CookieBannerSettings {
  bool enabled = 1;
  CookieBannerComponentType componentType = 2;
  CookieXAlignment xAlignment = 3;
  CookieYAlignment yAlignment = 4;
  CookieXAlignment triggerXAlignment = 5;
  CookieYAlignment triggerYAlignment = 6;
  TriggerComponentType triggerComponentType = 7;
  string policyUrl = 8;
  CookieBannerText text = 9;
  GUID policyLink = 10;
  string locale = 11;
}

enum CookieBannerComponentType {
  BANNER = 0;
  MODAL = 1;
}

enum TriggerComponentType {
  BANNER = 0;
  TAG = 1;
}

enum CookieXAlignment {
  LEFT = 0;
  CENTER = 1;
  RIGHT = 2;
}

enum CookieYAlignment {
  TOP = 0;
  CENTER = 1;
  BOTTOM = 2;
}

message ResponsiveSetSettings {
  string title = 1;
  string description = 2;
  ResponsiveScalingMode scalingMode = 3;
  float scalingMinFontSize = 4;
  float scalingMaxFontSize = 5;
  float scalingMinLayoutWidth = 6;
  float scalingMaxLayoutWidth = 7;
  string lang = 8;
  string faviconHash = 9;
  string socialImageHash = 10;
  string googleAnalyticsID = 11;
  bool blockSearchIndexing = 12;
  string customCodeHeadStart = 13;
  string customCodeHeadEnd = 14;
  string customCodeBodyStart = 15;
  string customCodeBodyEnd = 16;
  GUID faviconID = 17;
  GUID socialImageID = 18;
  bool addBypassLinks = 19;
  bool ignoreReducedMotion = 20;
  CookieBannerSettings cookieBanner = 21;
}

enum ResponsiveScalingMode {
  REFLOW = 0;
  SCALE = 1;
}

message CMSSelector {
  string cmsCollectionId = 1;
  CMSFilterCritera filterCriteria = 2;
  CMSSelectorSort[] sorts = 3;
  uint limit = 4;
}

message CMSFilterCritera {
  CMSFilterCriteriaMatchType matchType = 1;
  CMSSelectorFilter[] filters = 2;
}

enum CMSFilterCriteriaMatchType {
  MATCH_ALL = 0;
  MATCH_ANY = 1;
}

message CMSSelectorFilter {
  string cmsFieldId = 1;
  CMSSelectorFilterOperator op = 2;
  string comparisonValue = 3;
}

enum CMSSelectorFilterOperator {
  EQUALS = 0;
}

message CMSSelectorSort {
  string cmsFieldId = 1;
  CMSFieldOrderBy orderBy = 2;
}

enum CMSFieldOrderBy {
  ASCENDING = 0;
  DESCENDING = 1;
}

message CMSConsumptionMap {
  CMSConsumptionMapEntry[] entries = 1;
}

message CMSConsumptionMapEntry {
  CMSConsumptionField consumptionField = 1;
  string cmsFieldId = 2;
}

enum CMSConsumptionField {
  MISSING = 0;
  TEXT_DATA = 1;
}

message CMSRichTextStyleMap {
  CMSRichTextStyleEntry[] entries = 1;
}

message CMSRichTextStyleEntry {
  CMSRichTextStyleClass styleClass = 1;
  CMSRichTextDescriptor textDescriptor = 2;
}

enum CMSRichTextStyleClass {
  HEADING1 = 0;
  HEADING2 = 1;
  HEADING3 = 2;
  HEADING4 = 3;
  HEADING5 = 4;
  HEADING6 = 5;
  PARAGRAPH = 6;
  LINK = 7;
  BLOCKQUOTE = 8;
}

message CMSRichTextDescriptor {
  StyleId textStyleId = 1;
  FontName[] fontNameVariants = 2;
}

message RepeaterCmsOverrideData {
  NodeChange[] overrides = 1;
}

message RepeaterOverrideData {
  NodeChange[] parentIndexOverrides = 1;
}

message RepeaterSymbolOverrideData {
  RepeaterPositionOverrides[] overridesByPosition = 1;
}

message RepeaterPositionOverrides {
  ParentIndex position = 1;
  NodeChange[] overrides = 2;
}

message InheritedVariablesData {
  InheritedVariableEntry[] variableIds = 1;
}

message InheritedVariableEntry {
  VariableID variableId = 1;
}

message HubFileAttribution {
  string hubFileId = 1;
  string hubFileName = 2;
}

message ManagedStringData {
  string key = 1;
  string context = 2;
  string locale = 3;
  ManagedStringNode content = 4;
  ManagedStringContentSchema contentSchema = 5;
}

enum ManagedStringContentSchema {
  V0 = 0;
}

enum ManagedStringNodeType {
  TEXT = 0;
  CONCATENATE = 1;
  PLURAL = 2;
  PLACEHOLDER = 3;
}

message ManagedStringNode {
  ManagedStringNodeType type = 1;
  ManagedStringTextNodeData textNodeData = 2;
  ManagedStringConcatenateAstNodeData concatenateNodeData = 3;
  ManagedStringPluralAstNodeData pluralNodeData = 4;
  ManagedStringPlaceholderAstNodeData placeholderNodeData = 5;
}

message ManagedStringTextNodeData {
  string value = 1;
}

message ManagedStringConcatenateAstNodeData {
  ManagedStringNode[] values = 1;
}

enum ManagedStringPluralType {
  ZERO = 0;
  ONE = 1;
  TWO = 2;
  FEW = 3;
  MANY = 4;
  OTHER = 5;
}

message ManagedStringPluralAstNodeData {
  string identifier = 1;
  ManagedStringPluralTypeMapEntry[] conditions = 2;
}

message ManagedStringPluralTypeMapEntry {
  ManagedStringPluralType key = 1;
  ManagedStringNode value = 2;
}

enum ManagedStringFormatType {
  TEXT = 0;
  DATE = 1;
  TIME = 2;
  NUMBER = 3;
}

message ManagedStringPlaceholderAstNodeData {
  string identifier = 1;
  ManagedStringFormatType formatType = 2;
  string formatPattern = 3;
}

message CooperRevertData {
  NodeChange originalValues = 1;
}

message VideoPlayback {
  bool autoplay = 1;
  bool mediaLoop = 2;
  bool muted = 3;
  bool showControls = 4;
  uint startTimeMs = 5;
  uint endTimeMs = 6;
}

enum MediaAction {
  PLAY = 0;
  PAUSE = 1;
  TOGGLE_PLAY_PAUSE = 2;
  MUTE = 3;
  UNMUTE = 4;
  TOGGLE_MUTE_UNMUTE = 5;
  SKIP_FORWARD = 6;
  SKIP_BACKWARD = 7;
  SKIP_TO = 8;
  SET_PLAYBACK_RATE = 9;
}

enum AnimationTimelineAction {
  PLAY = 0;
  PAUSE = 1;
  TOGGLE_PLAY_PAUSE = 2;
  SET_PLAYHEAD = 3;
}

message WidgetHoverStyle {
  Paint[] fillPaints = 1;
  Paint[] strokePaints = 2;
  float opacity = 3;
  bool areFillPaintsSet = 4;
  bool areStrokePaintsSet = 5;
  bool isOpacitySet = 6;
}

message WidgetDerivedSubtreeCursor {
  uint sessionID = 1;
  uint counter = 2;
}

message MultiplayerMap {
  MultiplayerMapEntry[] entries = 1;
}

message MultiplayerMapEntry {
  string key = 1;
  string value = 2;
}

message VariableDataMap {
  VariableDataMapEntry[] entries = 1;
}

message VariableDataMapEntry {
  uint nodeField = 1;
  VariableData variableData = 2;
  VariableField variableField = 3;
}

enum VariableField {
  MISSING = 0;
  CORNER_RADIUS = 1;
  PARAGRAPH_SPACING = 2;
  PARAGRAPH_INDENT = 3;
  STROKE_WEIGHT = 4;
  STACK_SPACING = 5;
  STACK_PADDING_LEFT = 6;
  STACK_PADDING_TOP = 7;
  STACK_PADDING_RIGHT = 8;
  STACK_PADDING_BOTTOM = 9;
  VISIBLE = 10;
  TEXT_DATA = 11;
  WIDTH = 12;
  HEIGHT = 13;
  RECTANGLE_TOP_LEFT_CORNER_RADIUS = 14;
  RECTANGLE_TOP_RIGHT_CORNER_RADIUS = 15;
  RECTANGLE_BOTTOM_LEFT_CORNER_RADIUS = 16;
  RECTANGLE_BOTTOM_RIGHT_CORNER_RADIUS = 17;
  BORDER_TOP_WEIGHT = 18;
  BORDER_BOTTOM_WEIGHT = 19;
  BORDER_LEFT_WEIGHT = 20;
  BORDER_RIGHT_WEIGHT = 21;
  VARIANT_PROPERTIES = 22;
  STACK_COUNTER_SPACING = 23;
  MIN_WIDTH = 24;
  MAX_WIDTH = 25;
  MIN_HEIGHT = 26;
  MAX_HEIGHT = 27;
  FONT_FAMILY = 28;
  FONT_STYLE = 29;
  FONT_VARIATIONS = 30;
  OPACITY = 31;
  FONT_SIZE = 32;
  LETTER_SPACING = 34;
  LINE_HEIGHT = 36;
  OVERRIDDEN_SYMBOL_ID = 37;
  HYPERLINK = 38;
  CMS_SERIALIZED_RICH_TEXT_DATA = 39;
  SLOT_CONTENT_ID = 40;
  GRID_ROW_GAP = 41;
  GRID_COLUMN_GAP = 42;
  X_POSITION = 43;
  Y_POSITION = 44;
  ROTATION = 45;
  MOTION_TRANSLATION_X = 46;
  MOTION_TRANSLATION_Y = 47;
  MOTION_ROTATION = 48;
  MOTION_SCALE_X = 49;
  MOTION_SCALE_Y = 50;
  MOTION_SHEAR = 51;
  SCROLL_OFFSET_X = 52;
  SCROLL_OFFSET_Y = 53;
  PATH_TRIM_START = 54;
  PATH_TRIM_END = 55;
  DISSOLVE_PROGRESS = 56;
  EASING_DATA = 57;
  MEDIA_CURRENT_TIME = 58;
  TRANSFORM_3D_PERSPECTIVE = 59;
  TRANSFORM_3D_TRANSLATION_Z = 60;
  TRANSFORM_3D_ROTATION_X = 61;
  TRANSFORM_3D_ROTATION_Y = 62;
  TRANSFORM_3D_ROTATION_Z = 63;
  POLYGON_COUNT = 64;
  ARC_DATA_STARTING_ANGLE = 65;
  ARC_DATA_ENDING_ANGLE = 66;
  ARC_DATA_INNER_RADIUS = 67;
}

message VariableModeBySetMap {
  VariableModeBySetMapEntry[] entries = 1;
}

message VariableModeBySetMapEntry {
  VariableSetID variableSetID = 1;
  GUID variableModeID = 2;
  VariableSetID variableSetExtensionID = 3;
}

message CodeSyntaxMap {
  CodeSyntaxMapEntry[] entries = 1;
}

message CodeSyntaxMapEntry {
  CodeSyntaxPlatform platform = 1;
  string value = 2;
}

message TableMergedCellMap {
  TableMergedCellMapEntry[] entries = 1;
}

message TableMergedCellMapEntry {
  GUID rowId = 1;
  GUID colId = 2;
  int rowSpan = 3;
  int colSpan = 4;
}

message TableRowColumnPositionMap {
  TableRowColumnPositionMapEntry[] entries = 1;
}

message TableRowColumnPositionMapEntry {
  GUID id = 1;
  string position = 2;
}

message GUIDPositionMap {
  GUIDPositionMapEntry[] entries = 1;
}

message GUIDPositionMapEntry {
  GUID id = 1;
  string position = 2;
}

message GUIDGridTrackSizeMap {
  GUIDGridTrackSizeMapEntry[] entries = 1;
}

message GUIDGridTrackSizeMapEntry {
  GUID id = 1;
  GridTrackSize trackSize = 2;
}

message ObjectAnimationList {
  ObjectAnimationListItem[] entries = 1;
}

message ObjectAnimationListItem {
  GUID targetNodeId = 1;
  PrototypeAction animation = 2;
}

message GridTrackSize {
  GridTrackSizingFunction minSizing = 1;
  GridTrackSizingFunction maxSizing = 2;
}

message GridTrackSizingFunction {
  GridTrackSizingType type = 1;
  float value = 2;
}

enum GridTrackSizingType {
  FLEX = 0;
  FIXED = 1;
  HUG = 2;
}

message TableRowColumnSizeMap {
  TableRowColumnSizeMapEntry[] entries = 1;
}

message TableRowColumnSizeMapEntry {
  GUID id = 1;
  float size = 2;
}

message AgendaPositionMap {
  AgendaPositionMapEntry[] entries = 1;
}

message AgendaPositionMapEntry {
  GUID id = 1;
  string position = 2;
}

enum AgendaItemType {
  NODE = 0;
  BLOCK = 1;
}

message AgendaMetadataMap {
  AgendaMetadataMapEntry[] entries = 1;
}

message AgendaMetadataMapEntry {
  GUID id = 1;
  AgendaMetadata data = 2;
}

message AgendaMetadata {
  string name = 1;
  AgendaItemType type = 2;
  GUID targetNodeID = 3;
  AgendaTimerInfo timerInfo = 4;
  AgendaVoteInfo voteInfo = 5;
  AgendaMusicInfo musicInfo = 6;
}

message AgendaTimerInfo {
  uint timerLength = 1;
}

message AgendaVoteInfo {
  uint voteCount = 1;
}

message AgendaMusicInfo {
  string songID = 1;
  uint startTimeMs = 2;
}

enum DiagramLayoutRuleType {
  NONE = 0;
  TREE = 1;
}

struct DiagramParentIndex {
  GUID guid;
  string position;
}

enum DiagramLayoutPaused {
  NO = 0;
  YES = 1;
}

message ComponentPropRef {
  uint nodeField = 1;
  GUID defID = 2;
  string zombieFallbackName = 3;
  ComponentPropNodeField componentPropNodeField = 4;
  bool isDeleted = 5;
}

enum ComponentPropNodeField {
  VISIBLE = 0;
  TEXT_DATA = 1;
  OVERRIDDEN_SYMBOL_ID = 2;
  INHERIT_FILL_STYLE_ID = 3;
  SLOT_CONTENT_ID = 4;
}

message ComponentPropAssignment {
  GUID defID = 1;
  ComponentPropValue value = 2;
  VariableData varValue = 3;
  DerivedTextData legacyDerivedTextData = 4;
}

message ComponentPropDef {
  GUID id = 1;
  string name = 2;
  ComponentPropValue initialValue = 3;
  string sortPosition = 4;
  GUID parentPropDefId = 5;
  ComponentPropType type = 6;
  bool isDeleted = 7;
  ComponentPropPreferredValues preferredValues = 8;
  VariableData varValue = 9;
  ParameterConfig parameterConfig = 10;
  string description = 11;
  SlotPropConfig slotPropConfig = 12;
  ColorArrayConfig colorArrayConfig = 13;
}

message ComponentPropValue {
  bool boolValue = 1;
  TextData textValue = 2;
  GUID guidValue = 3;
  float floatValue = 4;
  EasingData easingData = 5;
  Vector vectorValue = 6;
  Line lineValue = 7;
  Circle circleValue = 8;
  Rotation3D rotation3DValue = 9;
  CirclePoint circlePointValue = 10;
  Gradient gradientValue = 11;
  ColorPoint colorPointValue = 12;
}

message TimelineData {
  uint64 durationUs = 1;
  bool defaultTimeline = 2;
  GUID parentTimelineDefId = 3;
  PlaybackStyle playbackStyle = 4;
}

message TimelineDefinitionsMap {
  TimelineDefinitionsMapEntry[] entries = 1;
}

message TimelineDefinitionsMapEntry {
  GUID id = 1;
  TimelineData data = 2;
}

message TimelineAssignmentKey {
  GUID assignedTimelineId = 1;
  GUID containingTimelineId = 2;
}

message TimelineBindingData {
  int64 offsetUs = 1;
  bool disabled = 2;
}

message TimelineAssignmentsMap {
  TimelineAssignmentsMapEntry[] entries = 1;
}

message TimelineAssignmentsMapEntry {
  TimelineAssignmentKey key = 1;
  TimelineBindingData value = 2;
}

enum ComponentPropType {
  BOOL = 0;
  TEXT = 1;
  COLOR = 2;
  INSTANCE_SWAP = 3;
  VARIANT = 4;
  NUMBER = 5;
  IMAGE = 6;
  SLOT = 7;
  EASING = 8;
  COLOR_ARRAY = 9;
  VECTOR = 10;
  LINE = 11;
  CIRCLE = 12;
  ROTATION_3D = 13;
  CIRCLE_POINT = 14;
  GRADIENT = 15;
  COLOR_POINT = 16;
}

message ComponentPropPreferredValues {
  string[] stringValues = 1;
  InstanceSwapPreferredValue[] instanceSwapValues = 2;
}

message ParameterConfig {
  NumberPropConfig numberPropConfig = 1;
  ParameterConfigControl control = 2;
  SliderConfig sliderConfig = 3;
  VariableData label = 4;
  InputConfig inputConfig = 5;
  SelectConfig selectConfig = 6;
  PointConfig pointConfig = 7;
  LineConfig lineConfig = 8;
  PointRadiusConfig pointRadiusConfig = 9;
  Rotation3DConfig rotation3DConfig = 10;
  CirclePointConfig circlePointConfig = 11;
  ColorPointConfig colorPointConfig = 12;
  bool showDividerAbove = 13;
}

enum ParameterConfigControl {
  DEFAULT = 0;
  SLIDER = 1;
  INPUT = 2;
  SELECT = 3;
}

message InputConfig {
  VariableData unit = 1;
  VariableData min = 2;
  VariableData max = 3;
}

message SliderConfig {
  VariableData min = 1;
  VariableData max = 2;
  VariableData step = 3;
  VariableData unit = 4;
}

enum PointMode {
  CANVAS_AND_UI = 0;
  CANVAS = 1;
  UI = 2;
}

message PointConfig {
  PointMode mode = 1;
  NumberUnits unit = 2;
}

message Line {
  Vector a = 1;
  Vector b = 2;
}

message LineConfig {
  PointMode mode = 1;
  NumberUnits unit = 2;
}

message Circle {
  Vector center = 1;
  float radius = 2;
}

message PointRadiusConfig {
  PointMode mode = 1;
  NumberUnits positionUnit = 2;
  NumberUnits radiusUnit = 3;
  float minRadius = 4;
  float maxRadius = 5;
}

message Rotation3D {
  float x = 1;
  float y = 2;
  float z = 3;
  float translateZ = 4;
}

message Rotation3DConfig {
  PointMode mode = 1;
}

message CirclePoint {
  Vector center = 1;
  float radius = 2;
  float angle = 3;
}

message CirclePointConfig {
  PointMode mode = 1;
  NumberUnits positionUnit = 2;
  NumberUnits radiusUnit = 3;
  float minRadius = 4;
  float maxRadius = 5;
}

message ColorPoint {
  Vector point = 1;
  VariableData color = 2;
}

message ColorPointConfig {
  PointMode mode = 1;
  NumberUnits unit = 2;
}

message Gradient {
  GradientStop[] stops = 1;
}

message GradientStop {
  float position = 1;
  VariableData color = 2;
}

message SelectOption {
  VariableData value = 1;
  string label = 2;
}

message SelectConfig {
  SelectOption[] options = 1;
}

message ColorArrayConfig {
  uint minLength = 1;
  uint maxLength = 2;
}

message SlotPropConfig {
  bool stretchChildOnInsert = 1;
  bool displayByDefault = 2;
  uint minChildren = 3;
  uint maxChildren = 4;
  bool allowPreferredValuesOnly = 5;
}

message NumberPropConfig {
  ParameterConfigControl control = 1;
  VariableData min = 2;
  VariableData max = 3;
  VariableData step = 4;
}

message InstanceSwapPreferredValue {
  InstanceSwapPreferredValueType type = 1;
  string key = 2;
}

enum InstanceSwapPreferredValueType {
  COMPONENT = 0;
  STATE_GROUP = 1;
}

enum WidgetEvent {
  MOUSE_DOWN = 0;
  CLICK = 1;
  TEXT_EDIT_END = 2;
  ATTACHED_STICKABLES_CHANGED = 3;
  STUCK_STATUS_CHANGED = 4;
}

enum WidgetInputBehavior {
  WRAP = 0;
  TRUNCATE = 1;
  MULTILINE = 2;
}

message WidgetMetadata {
  string pluginID = 1;
  string pluginVersionID = 2;
  string widgetName = 3;
  bool isResizable = 4;
  bool isRotatable = 5;
}

enum WidgetPropertyMenuItemType {
  ACTION = 0;
  SEPARATOR = 1;
  COLOR = 2;
  DROPDOWN = 3;
  COLOR_SELECTOR = 4;
  TOGGLE = 5;
  LINK = 6;
}

message WidgetPropertyMenuSelectorOption {
  string option = 1;
  string tooltip = 2;
}

enum WidgetInputTextNodeType {
  WIDGET_CONTROLLED = 0;
  RICH_TEXT = 1;
}

message WidgetPropertyMenuItem {
  string propertyName = 1;
  string tooltip = 2;
  WidgetPropertyMenuItemType itemType = 3;
  string icon = 4;
  WidgetPropertyMenuSelectorOption[] options = 5;
  string selectedOption = 6;
  bool isToggled = 7;
  string href = 8;
  bool allowCustomColor = 9;
}

enum CodeBlockLanguage {
  TYPESCRIPT = 0;
  CPP = 1;
  RUBY = 2;
  CSS = 3;
  JAVASCRIPT = 4;
  HTML = 5;
  JSON = 6;
  GRAPHQL = 7;
  PYTHON = 8;
  GO = 9;
  SQL = 10;
  SWIFT = 11;
  KOTLIN = 12;
  RUST = 13;
  BASH = 14;
  PLAINTEXT = 15;
  MARKDOWN = 16;
}

enum CodeBlockTheme {
  FIGJAM_DARK = 0;
  DRACULA = 1;
  DUOTONE_SEA = 2;
  DUOTONE_SPACE = 3;
  DUOTONE_EARTH = 4;
  DUOTONE_FOREST = 5;
  DUOTONE_LIGHT = 6;
}

enum SpecBlockType {
  DEFAULT = 0;
  PARAGRAPH = 1;
  HEADING_1 = 2;
  HEADING_2 = 3;
  HEADING_3 = 4;
  HEADING_4 = 5;
  HEADING_5 = 6;
  HEADING_6 = 7;
  CODE_BLOCK = 8;
  BLOCK_QUOTE = 9;
  HORIZONTAL_RULE = 10;
  ORDERED_LIST_ITEM = 11;
  UNORDERED_LIST_ITEM = 12;
  DOCUMENT = 13;
  TABLE = 14;
  TABLE_ROW = 15;
  TABLE_CELL = 16;
  TODO_LIST_ITEM_UNCHECKED = 17;
  TODO_LIST_ITEM_CHECKED = 18;
  IMAGE = 19;
  EMBED = 20;
}

enum InternalEnumForTest {
  OLD = 1;
}

message InternalDataForTest {
  int testFieldA = 1;
}

message StateGroupPropertyValueOrder {
  string property = 1;
  string[] values = 2;
}

enum BackfillError {
  NONE = 0;
  TRANSIENT_RETRYING = 1;
  PERMANENTLY_FAILED = 2;
  PASTE_FAILED = 3;
}

message PartialPasteAnnotation {
  bool isPartial = 1;
  uint64 annotatedAt = 2;
  BackfillError errorState = 3;
}

message VariantPropSpec {
  GUID propDefId = 1;
  string value = 2;
}

message TextListData {
  int listID = 1;
  BulletType bulletType = 2;
  int indentationLevel = 3;
  int lineNumber = 4;
}

enum BulletType {
  ORDERED = 0;
  UNORDERED = 1;
  INDENT = 2;
  NO_LIST = 3;
}

message TextLineData {
  LineType lineType = 1;
  int styleId = 10;
  int indentationLevel = 2;
  SourceDirectionality sourceDirectionality = 9;
  Directionality directionality = 3;
  DirectionalityIntent directionalityIntent = 4;
  int downgradeStyleId = 5;
  int consistencyStyleId = 6;
  int listStartOffset = 7;
  bool isFirstLineOfList = 8;
}

message DerivedTextLineData {
  Directionality directionality = 1;
}

enum LineType {
  PLAIN = 0;
  ORDERED_LIST = 1;
  UNORDERED_LIST = 2;
  BLOCKQUOTE = 3;
  HEADER = 4;
}

enum SourceDirectionality {
  AUTO = 0;
  LTR = 1;
  RTL = 2;
}

enum Directionality {
  LTR = 0;
  RTL = 1;
}

enum DirectionalityIntent {
  IMPLICIT = 0;
  EXPLICIT = 1;
}

message PrototypeInteraction {
  GUID id = 1;
  PrototypeEvent event = 2;
  PrototypeAction[] actions = 3;
  bool isDeleted = 4;
  int stateManagementVersion = 5;
}

message PrototypeEvent {
  InteractionType interactionType = 1;
  bool interactionMaintained = 2;
  float interactionDuration = 3;
  KeyTrigger keyTrigger = 4;
  string voiceEventPhrase = 5;
  float transitionTimeout = 6;
  float mediaHitTime = 7;
}

message PrototypeVariableTarget {
  VariableID id = 1;
  NodeFieldAlias nodeFieldAlias = 2;
}

message ConditionalActions {
  PrototypeAction[] actions = 1;
  VariableData condition = 2;
}

message PrototypeAction {
  GUID transitionNodeID = 1;
  TransitionType transitionType = 2;
  float transitionDuration = 3;
  EasingType easingType = 4;
  float transitionTimeout = 5;
  bool transitionShouldSmartAnimate = 6;
  ConnectionType connectionType = 7;
  Vector overlayRelativePosition = 9;
  NavigationType navigationType = 10;
  bool transitionPreserveScroll = 11;
  float[] easingFunction = 12;
  Vector extraScrollOffset = 13;
  bool transitionResetScrollPosition = 25;
  bool transitionResetInteractiveComponents = 26;
  bool transitionOverridesEnabled = 42;
  string connectionURL = 8;
  bool openUrlInNewTab = 18;
  VariableData linkParam = 34;
  CMSItemPageTarget cmsTarget = 35;
  GUID targetVariableID = 14;
  VariableAnyValue targetVariableValue = 15;
  PrototypeVariableTarget targetVariable = 19;
  VariableData targetVariableData = 20;
  MediaAction mediaAction = 16;
  bool transitionResetVideoPosition = 17;
  float mediaSkipToTime = 21;
  float mediaSkipByAmount = 22;
  float mediaPlaybackRate = 36;
  VariableData[] conditions = 23;
  ConditionalActions[] conditionalActions = 24;
  VariableSetID targetVariableSetID = 27;
  GUID targetVariableModeID = 28;
  string targetVariableSetKey = 29;
  VariableSetID variableSetTargetExtensionId = 38;
  AnimationType animationType = 30;
  GUID animationTargetId = 31;
  AnimationPhase animationPhase = 32;
  AnimationState animationState = 33;
  bool simpleLink = 37;
  AnimationTimelineAction animationTimelineAction = 39;
  GUID animationTimelineDefId = 41;
  float animationSkipToTime = 40;
}

enum AnimationPhase {
  IN = 0;
  OUT = 1;
}

enum AnimationType {
  NONE = 0;
  FADE = 1;
  SLIDE_FROM_LEFT = 2;
  SLIDE_FROM_RIGHT = 3;
  SLIDE_FROM_TOP = 4;
  SLIDE_FROM_BOTTOM = 5;
}

message AnimationState {
  float opacity = 1;
  Matrix transform = 2;
}

message PrototypeStartingPoint {
  string name = 1;
  string description = 2;
  string position = 3;
}

enum TriggerDevice {
  KEYBOARD = 0;
  UNKNOWN_CONTROLLER = 1;
  XBOX_ONE = 2;
  PS4 = 3;
  SWITCH_PRO = 4;
}

message KeyTrigger {
  int[] keyCodes = 1;
  TriggerDevice triggerDevice = 2;
}

message Hyperlink {
  string url = 1;
  GUID guid = 2;
  CMSItemPageTarget cmsTarget = 4;
  bool openInNewTab = 3;
}

message CMSItemPageTarget {
  GUID nodeId = 1;
  string cmsItemId = 2;
  string fieldSchemaId = 3;
}

enum MentionSource {
  DEFAULT = 0;
  COPY_DUPLICATE = 1;
  SILENT_INSERT = 2;
}

message Mention {
  GUID id = 1;
  string mentionedUserId = 2;
  string mentionedByUserId = 3;
  string fileKey = 4;
  MentionSource source = 5;
  uint64 mentionedUserIdInt = 6;
  uint64 mentionedByUserIdInt = 7;
  string mentionedUserGroupId = 8;
}

message EmbedData {
  string url = 1;
  string srcUrl = 2;
  string title = 3;
  string thumbnailUrl = 4;
  float width = 5;
  float height = 6;
  string embedType = 7;
  string thumbnailImageHash = 8;
  string faviconImageHash = 9;
  string provider = 10;
  string originalText = 11;
  string description = 12;
  string embedVersionId = 13;
  bool isPublishedSite = 14;
}

message StampData {
  string userId = 1;
  string votingSessionId = 2;
  string stampedByUserId = 3;
}

message LinkPreviewData {
  string url = 1;
  string title = 2;
  string provider = 3;
  string description = 4;
  string thumbnailImageHash = 5;
  string faviconImageHash = 6;
  float thumbnailImageWidth = 7;
  float thumbnailImageHeight = 8;
}

message Viewport {
  Rect canvasSpaceBounds = 1;
  bool pixelPreview = 2;
  float pixelDensity = 3;
  GUID canvasGuid = 4;
}

message Mouse {
  MouseCursor cursor = 1;
  Vector canvasSpaceLocation = 2;
  Rect canvasSpaceSelectionBox = 3;
  GUID canvasGuid = 4;
  uint cursorHiddenReason = 5;
}

struct Click {
  uint id;
  Vector point;
}

struct ScrollPosition {
  GUID node;
  Vector scrollOffset;
}

struct TriggeredOverlay {
  GUID overlayGuid;
  GUID hotspotGuid;
  GUID swapGuid;
}

message TriggeredOverlayData {
  GUID overlayGuid = 1;
  GUID hotspotGuid = 2;
  GUID swapGuid = 3;
  GUID prototypeInteractionGuid = 4;
  GUIDPath hotspotBlueprintId = 5;
}

message TriggeredSetVariableActionData {
  GUID nodeForFindingTopmostScreenId = 1;
  string targetVariableId = 2;
  string targetVariableData = 3;
  string resolvedVariableModes = 4;
}

message TriggeredSetVariableModeActionData {
  GUID nodeForFindingTopmostScreenId = 1;
  string targetVariableSetKey = 2;
  string targetVariableModeId = 3;
  VariableSetID targetVariableSetId = 4;
}

message VideoStateChangeData {
  GUID targetNodeId = 1;
  bool isPlaying = 2;
  bool isPlayingSound = 3;
  uint[] currentTimes = 4;
  uint actionTakenTimestamp = 5;
}

message EmbeddedPrototypeData {
  GUID nodeId = 1;
  uint sessionId = 2;
}

message PresentedState {
  GUID baseScreenID = 1;
  TriggeredOverlayData[] overlays = 2;
}

enum TransitionDirection {
  FORWARD = 0;
  REVERSE = 1;
}

message TopLevelPlaybackChange {
  PresentedState oldState = 1;
  PresentedState newState = 2;
  GUIDPath hotspotBlueprintID = 3;
  GUID interactionID = 4;
  bool isHotspotInNewPresentedState = 5;
  TransitionDirection direction = 6;
  GUIDPath instanceStablePath = 7;
}

message InstanceStateChange {
  GUID stateID = 1;
  GUID interactionID = 2;
  GUIDPath hotspotStablePath = 3;
  GUIDPath instanceStablePath = 4;
  PlaybackChangePhase phase = 5;
}

message TextCursor {
  Rect selectionBox = 1;
  GUID canvasGuid = 2;
  GUID textNodeGuid = 3;
}

message TextSelection {
  Rect[] selectionBoxes = 1;
  GUID canvasGuid = 2;
  GUID textNodeGuid = 3;
  Vector textSelectionRange = 4;
  GUID textNodeOrContainingIfGuid = 5;
  GUID tableCellRowId = 6;
  GUID tableCellColId = 7;
}

enum PlaybackChangePhase {
  INITIATED = 0;
  ABORTED = 1;
  COMMITTED = 2;
}

message PlaybackChangeKeyframe {
  PlaybackChangePhase phase = 1;
  float progress = 2;
  float timestamp = 3;
}

message StateMapping {
  GUIDPath stablePath = 1;
  TopLevelPlaybackChange lastTopLevelChange = 2;
  PlaybackChangeKeyframe lastTopLevelChangeStatus = 3;
  float timestamp = 4;
}

message ScrollMapping {
  GUIDPath blueprintID = 1;
  uint overlayIndex = 2;
  Vector scrollOffset = 3;
}

message PlaybackUpdate {
  TopLevelPlaybackChange lastTopLevelChange = 1;
  PlaybackChangeKeyframe lastTopLevelChangeStatus = 2;
  ScrollMapping[] scrollMappings = 3;
  float timestamp = 4;
  Vector pointerLocation = 5;
  bool isTopLevelFrameChange = 6;
  StateMapping[] stateMappings = 7;
}

message ChatMessage {
  string text = 1;
  string previousText = 2;
}

message VoiceMetadata {
  string connectedCallId = 1;
}

message AprilFunCursor {
  string id = 1;
  bool trailEnabled = 2;
}

message AprilFunFigPal {
  string customization = 1;
  string name = 2;
}

enum Heartbeat {
  FOREGROUND = 0;
  BACKGROUND = 1;
}

enum SitesViewState {
  FILE = 0;
  CODE = 1;
  DAKOTA = 2;
  SETTINGS = 3;
  INSERT = 4;
  VARIABLES = 5;
}

enum DesignFullPageViewState {
  NONE = 0;
  DESIGN_SYSTEM = 1;
  VARIABLES = 2;
}

message AgentInfo {
  string name = 1;
  string logo = 2;
  string oauthClientId = 3;
}

message UserChange {
  uint sessionID = 1;
  string stableSessionID = 44;
  bool connected = 2;
  string name = 3;
  Color color = 4;
  string imageURL = 5;
  Viewport viewport = 6;
  Mouse mouse = 7;
  GUID[] selection = 8;
  uint[] observing = 9;
  string deviceName = 10;
  Click[] recentClicks = 11;
  ScrollPosition[] scrollPositions = 12;
  TriggeredOverlay[] triggeredOverlays = 13;
  string userID = 14;
  GUID lastTriggeredHotspot = 15;
  GUID lastTriggeredPrototypeInteractionID = 16;
  uint lastTriggeredObjectAnimationIndex = 38;
  TriggeredOverlayData[] triggeredOverlaysData = 17;
  PlaybackUpdate[] playbackUpdates = 18;
  ChatMessage chatMessage = 19;
  VoiceMetadata voiceMetadata = 20;
  bool canWrite = 21;
  bool highFiveStatus = 22;
  InstanceStateChange[] instanceStateChanges = 23;
  TextCursor textCursor = 24;
  TextSelection textSelection = 25;
  uint connectedAtTimeS = 26;
  bool focusOnTextCursor = 27;
  Heartbeat heartbeat = 28;
  TriggeredSetVariableActionData[] triggeredSetVariableActionData = 29;
  VideoStateChangeData[] videoStateChangeData = 30;
  string clientID = 31;
  GUID focusedSlideId = 32;
  TriggeredSetVariableModeActionData[] triggeredSetVariableModeActionData = 33;
  AprilFunCursor aprilFunCursor = 34;
  EmbeddedPrototypeData[] embeddedPrototypeData = 35;
  GUID activeSlidesEmbeddablePrototype = 36;
  GUID[] activeEmbeddedPrototypes = 43;
  GUID activeCodeComponentId = 37;
  AprilFunFigPal aprilFunFigPal = 39;
  CollaborativeTextSelection collaborativeTextSelection = 40;
  SitesViewState sitesViewState = 41;
  NodeChatExchange[] nodeChatExchanges = 42;
  DesignFullPageViewState designFullPageViewState = 45;
  AgentInfo agentInfo = 46;
}

message InteractiveSlideElementChange {
  string userID = 1;
  string anonymousUserID = 2;
  GUID nodeID = 3;
  string responseData = 4;
}

message NodeStatusChange {
  GUID[] nodeIds = 1;
  SectionStatusInfo statusInfo = 2;
}

message BuzzApprovalAssetEntry {
  GUID assetNodeId = 1;
  bool approved = 2;
}

message BuzzApprovalChange {
  BuzzApprovalAssetEntry[] assetEntries = 1;
  GUID canvasGridNodeId = 2;
  string requestId = 3;
}

enum SceneGraphQueryBehavior {
  DEFAULT = 0;
  CONTAINING_PAGE = 1;
  PLUGIN = 2;
}

enum SceneGraphQueryMode {
  ADD = 0;
  SET = 1;
}

message SceneGraphQuery {
  GUID startingNode = 1;
  uint depth = 2;
  SceneGraphQueryBehavior behavior = 3;
}

message NodeChangesMetadata {
  uint blobsFieldOffset = 1;
}

message CursorReaction {
  string imageUrl = 1;
}

message TimerInfo {
  bool isPaused = 1;
  uint timeRemainingMs = 2;
  uint totalTimeMs = 3;
  uint timerID = 4;
  string setBy = 5;
  uint songID = 6;
  uint lastReceivedSongTimestampMs = 7;
  string songUUID = 8;
}

message MusicInfo {
  bool isPaused = 1;
  uint messageID = 2;
  string songID = 3;
  uint lastReceivedSongTimestampMs = 4;
  bool isStopped = 5;
}

message PresenterNomination {
  uint sessionID = 1;
  bool isCancelled = 2;
}

message PresenterInfo {
  uint sessionID = 1;
  PresenterNomination nomination = 2;
  bool isReconnected = 3;
}

message ClientBroadcast {
  uint sessionID = 1;
  CursorReaction cursorReaction = 2;
  TimerInfo timer = 3;
  PresenterInfo presenter = 4;
  PresenterInfo prototypePresenter = 5;
  MusicInfo music = 6;
}

enum PasteAssetType {
  UNKNOWN = 0;
  VARIABLE = 1;
}

message Message {
  MessageType type = 1;
  uint sessionID = 2;
  string stableSessionID = 42;
  uint ackID = 3;
  bool isRetransmission = 37;
  NodeChange[] nodeChanges = 4;
  UserChange[] userChanges = 5;
  InteractiveSlideElementChange interactiveSlideElementChange = 32;
  NodeStatusChange nodeStatusChange = 36;
  BuzzApprovalChange buzzApprovalChange = 44;
  Blob[] blobs = 6;
  uint blobBaseIndex = 30;
  string signalName = 7;
  Access access = 8;
  string styleSetName = 9;
  StyleSetType styleSetType = 10;
  StyleSetContentType styleSetContentType = 11;
  int pasteID = 12;
  Vector pasteOffset = 13;
  string pasteFileKey = 14;
  string signalPayload = 15;
  SceneGraphQuery[] sceneGraphQueries = 16;
  NodeChangesMetadata nodeChangesMetadata = 17;
  uint fileVersion = 18;
  bool pasteIsPartiallyOutsideEnclosingFrame = 19;
  GUID pastePageId = 20;
  bool isCut = 21;
  Message[] localUndoStack = 22;
  Message[] localRedoStack = 23;
  ClientBroadcast[] broadcasts = 24;
  uint reconnectSequenceNumber = 25;
  string pasteBranchSourceFileKey = 26;
  EditorType pasteEditorType = 27;
  string postSyncActions = 28;
  GUID[] publishedAssetGuids = 29;
  bool dirtyFromInitialLoad = 31;
  ClipboardSelectionRegion[] clipboardSelectionRegions = 33;
  EncodedOffsetsIndex encodedOffsetsIndex = 34;
  bool hasRepeatingContent = 35;
  uint64 sentTimestamp = 38;
  AnnotationCategory[] annotationCategories = 39;
  ClientRenderedMetadata clientRenderedMetadata = 40;
  PasteAssetType pasteAssetType = 41;
  ObjectAnimationList objectAnimations = 43;
  SceneGraphQueryMode sceneGraphQueryMode = 45;
}

message EncodedOffsetsIndex {
  uint nodeChangesFieldOffset = 1;
  uint nodeChangesFieldLength = 2;
  uint blobsFieldOffset = 3;
  GUIDAndEncodedOffset[] nodeChangeOffsets = 4;
}

struct GUIDAndEncodedOffset {
  GUID guid;
  uint offset;
}

message DiffChunk {
  uint[] nodeChanges = 1;
  NodePhase phase = 2;
  NodeChange displayNode = 3;
  GUID canvasId = 4;
  string canvasName = 5;
  bool canvasIsInternal = 6;
  uint[] chunksAffectingThisChunk = 7;
  NodeChange[] basisParentHierarchy = 8;
  NodeChange[] parentHierarchy = 9;
  GUID[] basisParentHierarchyGuids = 10;
  GUID[] parentHierarchyGuids = 11;
}

enum DiffType {
  BRANCHING = 0;
  NODE_CHANGES_ONLY = 1;
}

message DiffPayload {
  NodeChange[] nodeChanges = 1;
  Blob[] blobs = 2;
  DiffChunk[] diffChunks = 3;
  NodeChange[] diffBasis = 4;
  NodeChange[] basisParentNodeChanges = 5;
  NodeChange[] parentNodeChanges = 6;
  DiffType diffType = 7;
}

enum RichMediaType {
  ANIMATED_IMAGE = 0;
  VIDEO = 1;
}

message RichMediaData {
  string mediaHash = 1;
  RichMediaType richMediaType = 2;
}

enum VariableDataType {
  BOOLEAN = 0;
  FLOAT = 1;
  STRING = 2;
  ALIAS = 3;
  COLOR = 4;
  EXPRESSION = 5;
  MAP = 6;
  SYMBOL_ID = 7;
  FONT_STYLE = 8;
  TEXT_DATA = 9;
  INVALID = 10;
  NODE_FIELD_ALIAS = 11;
  CMS_ALIAS = 12;
  PROP_REF = 13;
  IMAGE = 14;
  MANAGED_STRING_ALIAS = 15;
  LINK = 16;
  JS_RUNTIME_ALIAS = 17;
  SLOT_CONTENT_ID = 18;
  DATE = 19;
  KEYFRAME_TRACK_ID = 20;
  KEYFRAME_TRACK_PARAMETER_DATA = 21;
  EASING = 22;
  TIMING = 23;
  VECTOR = 24;
  COLOR_ARRAY = 25;
  LINE = 26;
  CIRCLE = 27;
  ROTATION_3D = 28;
  CIRCLE_POINT = 29;
  GRADIENT = 30;
  COLOR_POINT = 31;
}

enum VariableResolvedDataType {
  BOOLEAN = 0;
  FLOAT = 1;
  STRING = 2;
  COLOR = 4;
  MAP = 5;
  SYMBOL_ID = 6;
  FONT_STYLE = 7;
  TEXT_DATA = 8;
  IMAGE = 9;
  LINK = 10;
  JS_RUNTIME_ALIAS = 11;
  SLOT_CONTENT_ID = 12;
  KEYFRAME_TRACK_ID = 13;
  KEYFRAME_TRACK_PARAMETER_DATA = 14;
  EASING = 15;
  TIMING = 16;
  VECTOR = 17;
  COLOR_ARRAY = 18;
  LINE = 19;
  CIRCLE = 20;
  ROTATION_3D = 21;
  CIRCLE_POINT = 22;
  GRADIENT = 23;
  COLOR_POINT = 24;
}

message VariableAnyValue {
  bool boolValue = 1;
  string textValue = 2;
  float floatValue = 3;
  VariableID alias = 4;
  Color colorValue = 5;
  Expression expressionValue = 6;
  VariableMap mapValue = 7;
  SymbolId symbolIdValue = 8;
  VariableFontStyle fontStyleValue = 9;
  TextData textDataValue = 10;
  NodeFieldAlias nodeFieldAliasValue = 11;
  CMSAlias cmsAliasValue = 12;
  PropRefValue propRefValue = 13;
  ImageParameterValue imageValue = 14;
  ManagedStringAlias managedStringAliasValue = 15;
  Hyperlink linkValue = 16;
  JsRuntimeAlias jsRuntimeAliasValue = 17;
  SlotContentId slotContentIdValue = 18;
  KeyframeTrackId keyframeTrackIdValue = 19;
  KeyframeTrackParameterValue keyframeTrackParameterValue = 20;
  EasingData easingValue = 21;
  Vector vectorValue = 22;
  ColorArray colorArrayValue = 23;
  Line lineValue = 24;
  Circle circleValue = 25;
  Rotation3D rotation3DValue = 26;
  CirclePoint circlePointValue = 27;
  Gradient gradientValue = 28;
  ColorPoint colorPointValue = 29;
}

enum ExpressionFunction {
  ADDITION = 0;
  SUBTRACTION = 1;
  RESOLVE_VARIANT = 2;
  MULTIPLY = 3;
  DIVIDE = 4;
  EQUALS = 5;
  NOT_EQUAL = 6;
  LESS_THAN = 7;
  LESS_THAN_OR_EQUAL = 8;
  GREATER_THAN = 9;
  GREATER_THAN_OR_EQUAL = 10;
  AND = 11;
  OR = 12;
  NOT = 13;
  STRINGIFY = 14;
  TERNARY = 15;
  VAR_MODE_LOOKUP = 16;
  NEGATE = 17;
  IS_TRUTHY = 18;
  KEYFRAME = 19;
}

message Expression {
  ExpressionFunction expressionFunction = 1;
  VariableData[] expressionArguments = 2;
}

message VariableMapValue {
  string key = 1;
  VariableData value = 2;
  GUID guidKey = 3;
}

message VariableMap {
  VariableMapValue[] values = 1;
}

message ColorArray {
  VariableData[] colors = 1;
}

message VariableFontStyle {
  VariableData asString = 1;
  VariableData asFloat = 2;
  VariableData asVariations = 3;
}

message ImageParameterValue {
  Image image = 1;
  Image imageThumbnail = 2;
  Image animatedImage = 6;
  string altText = 3;
  uint originalImageHeight = 4;
  uint originalImageWidth = 5;
  uint animationFrame = 7;
}

message ThumbnailInfo {
  GUID nodeID = 1;
  string thumbnailVersion = 2;
}

message AiCanvasPrompt {
  string userPrompt = 1;
  string authorId = 2;
  GUID[] parentNodeIds = 3;
}

message NodeFieldAlias {
  GUIDPath stablePathToNode = 1;
  NodeFieldAliasType nodeField = 2;
  string indexOrKey = 3;
}

enum NodeFieldAliasType {
  MISSING = 0;
  COMPONENT_PROP_ASSIGNMENTS = 1;
}

message CMSAlias {
  string collectionId = 1;
  string itemId = 2;
  string fieldId = 3;
  VariableDataType type = 4;
}

message JsRuntimeAlias {
  string lookupKey = 1;
}

message PropRefValue {
  GUID defId = 1;
}

message ManagedStringId {
  GUID guid = 1;
  AssetRef assetRef = 2;
}

message ManagedStringPlaceholderMapEntry {
  string key = 1;
  string value = 2;
}

message SlotContentId {
  GUID guid = 1;
}

message ManagedStringAlias {
  ManagedStringId managedStringId = 1;
  ManagedStringPlaceholderMapEntry[] placeholderValues = 2;
}

message KeyframeTrackId {
  GUID guid = 1;
  AssetRef assetRef = 2;
}

message AnimationPresetId {
  GUID guid = 1;
  AssetRef assetRef = 2;
}

message ToolId {
  GUID guid = 1;
  AssetRef assetRef = 2;
}

message CustomEffectId {
  GUID guid = 1;
  AssetRef assetRef = 2;
}

message TRSSTransform2D {
  Vector translation = 1;
  float rotation = 2;
  Vector scale = 3;
  float shearX = 4;
}

message VariableData {
  VariableAnyValue value = 1;
  VariableDataType dataType = 2;
  VariableResolvedDataType resolvedDataType = 3;
}

message VariableSetMode {
  GUID id = 1;
  string name = 2;
  string sortPosition = 3;
  VariableSetID parentVariableSetId = 4;
  GUID parentModeId = 5;
}

message VariableDataValues {
  VariableDataValuesEntry[] entries = 1;
}

message VariableDataValuesEntry {
  GUID modeID = 1;
  VariableData variableData = 2;
}

enum VariableScope {
  ALL_SCOPES = 0;
  TEXT_CONTENT = 1;
  CORNER_RADIUS = 2;
  WIDTH_HEIGHT = 3;
  GAP = 4;
  ALL_FILLS = 5;
  FRAME_FILL = 6;
  SHAPE_FILL = 7;
  TEXT_FILL = 8;
  STROKE = 9;
  STROKE_FLOAT = 10;
  EFFECT_FLOAT = 11;
  EFFECT_COLOR = 12;
  OPACITY = 13;
  FONT_STYLE = 14;
  FONT_FAMILY = 15;
  FONT_SIZE = 16;
  LINE_HEIGHT = 17;
  LETTER_SPACING = 18;
  PARAGRAPH_SPACING = 19;
  PARAGRAPH_INDENT = 20;
  FONT_VARIATIONS = 21;
  TRANSFORM = 22;
}

message KeyframeAnyValue {
  float floatValue = 1;
  Color colorValue = 2;
  TextData textDataValue = 3;
  Vector vectorValue = 4;
}

enum KeyframeValueType {
  FLOAT = 0;
  INVALID = 1;
  COLOR = 2;
  TEXT_DATA = 3;
  VECTOR = 4;
}

message KeyframeValueData {
  KeyframeAnyValue value = 1;
  KeyframeValueType valueType = 2;
}

enum KeyframeTrackParameterType {
  INVALID = 0;
  MANUAL = 1;
  ANIMATION_PRESET = 2;
}

message ManualKeyframeTrackParameter {
  KeyframeTrackId keyframeTrackId = 1;
  GUID timelineDefId = 2;
}

message AnimationPresetKeyframeTrackParameter {
  AnimationPresetId animationPresetId = 1;
  KeyframeTrackId keyframeTrackId = 2;
  GUID timelineDefId = 3;
}

message KeyframeTrackAnyParameter {
  ManualKeyframeTrackParameter manual = 1;
  AnimationPresetKeyframeTrackParameter animationPreset = 2;
  GUID animationStyleBindingId = 3;
}

message KeyframeTrackParameter {
  KeyframeTrackAnyParameter value = 1;
  KeyframeTrackParameterType type = 2;
}

message KeyframeTrackParameterValue {
  KeyframeTrackParameter[] parameters = 1;
}

message AnimationPresets {
  AnimationPresetData[] presets = 1;
}

message AnimationPresetData {
  AnimationPresetId animationPresetId = 1;
  GUID timelineDefId = 2;
}

message StyleAnimation {
  AnimationPresetId animationPresetId = 1;
}

message StyleIdForAnimation {
  GUID id = 1;
  GUID timelineDefId = 2;
  StyleId animationStyleId = 3;
  int64 timelineOffset = 4;
}

message Tools {
  ToolData[] tools = 1;
}

message ToolData {
  ToolId toolId = 1;
  CodeComponentId backingCodeComponentId = 2;
  ComponentPropAssignment[] componentPropAssignments = 3;
}

message CustomEffects {
  CustomEffectData[] customEffects = 1;
}

message CustomEffectData {
  CustomEffectId customEffectId = 1;
}

message SpringParams {
  float stiffness = 1;
  float damping = 2;
  float mass = 3;
}

message TransitionEasingAnyValue {
  SpringParams springEasing = 1;
  BezierHandles bezierEasing = 2;
}

message EasingData {
  EasingType easingType = 1;
  TransitionEasingAnyValue easingValue = 2;
}

message TransitionOverride {
  GUID id = 1;
  float duration = 2;
  VariableData durationVar = 3;
  float delay = 4;
  VariableData delayVar = 5;
  EasingData easing = 6;
  VariableData easingVar = 7;
  uint64 createdAtMs = 8;
  GUID[] interactionIDs = 9;
  bool disabled = 10;
}

message TransitionOverrideData {
  TransitionOverride[] all = 1;
  TransitionOverridePropMap propertyOverrides = 2;
}

enum TransitionOverrideProp {
  ALL = 0;
  OPACITY = 1;
  TRANSLATION = 2;
  ROTATION = 3;
  SCALE = 4;
}

enum TransitionOverrideBindingTopLevelField {
  MISSING = 0;
  PARAMETER_CONSUMPTION_MAP = 1;
  EFFECT_DATA = 2;
  FILL_PAINT_DATA = 3;
  STROKE_PAINT_DATA = 4;
}

message TransitionOverrideBindingLocation {
  TransitionOverrideBindingTopLevelField topLevelField = 1;
  int parameterFieldValue = 2;
  int index = 3;
  int effectParametrizedFieldValue = 4;
}

enum KeyframeBindingEffectParametrizedField {
  MISSING = 0;
  OFFSET_X = 1;
  OFFSET_Y = 2;
  RADIUS = 3;
  SPREAD = 4;
  COLOR = 5;
  REFRACTION_RADIUS = 6;
  SPECULAR_ANGLE = 7;
  SPECULAR_INTENSITY = 8;
  CHROMATIC_ABERRATION = 9;
  SPLAY = 10;
  REFRACTION_INTENSITY = 11;
  START_RADIUS = 12;
  START_OFFSET_X = 13;
  START_OFFSET_Y = 14;
  END_OFFSET_X = 15;
  END_OFFSET_Y = 16;
  NOISE_SIZE_X = 17;
  NOISE_SIZE_Y = 18;
  DENSITY = 19;
  EFFECT_OPACITY = 20;
  SECONDARY_COLOR = 21;
}

message NodeContentsKeyframeBindingLocation {
  TransitionOverrideBindingTopLevelField topLevelField = 1;
  VariableField parameterFieldValue = 2;
  int index = 3;
  KeyframeBindingEffectParametrizedField effectParametrizedFieldValue = 4;
}

message TransitionOverridePropMap {
  TransitionOverridePropMapEntry[] entries = 1;
}

message TransitionOverridePropMapEntry {
  TransitionOverrideProp prop = 1;
  TransitionOverride[] overrides = 2;
  TransitionOverrideBindingLocation bindingLocation = 3;
  NodeContentsKeyframeBindingLocation nodeContentsBindingLocation = 4;
}

enum CodeSyntaxPlatform {
  WEB = 0;
  ANDROID = 1;
  iOS = 2;
}

message OptionalVector {
  Vector value = 1;
}

enum HTMLTag {
  AUTO = 0;
  ARTICLE = 1;
  SECTION = 2;
  NAV = 3;
  ASIDE = 4;
  H1 = 5;
  H2 = 6;
  H3 = 7;
  H4 = 8;
  H5 = 9;
  H6 = 10;
  HGROUP = 11;
  HEADER = 12;
  FOOTER = 13;
  ADDRESS = 14;
  P = 15;
  HR = 16;
  PRE = 17;
  BLOCKQUOTE = 18;
  OL = 19;
  UL = 20;
  MENU = 21;
  LI = 22;
  DL = 23;
  DT = 24;
  DD = 25;
  FIGURE = 26;
  FIGCAPTION = 27;
  MAIN = 28;
  DIV = 29;
  A = 30;
  EM = 31;
  STRONG = 32;
  SMALL = 33;
  S = 34;
  CITE = 35;
  Q = 36;
  DFN = 37;
  ABBR = 38;
  RUBY = 39;
  RT = 40;
  RP = 41;
  DATA = 42;
  TIME = 43;
  CODE = 44;
  VAR = 45;
  SAMP = 46;
  KBD = 47;
  SUB = 48;
  SUP = 49;
  I = 50;
  B = 51;
  U = 52;
  MARK = 53;
  BDI = 54;
  BDO = 55;
  SPAN = 56;
  BR = 57;
  WBR = 58;
  PICTURE = 59;
  SOURCE = 60;
  IMG = 61;
  FORM = 62;
  LABEL = 63;
  INPUT = 64;
  BUTTON = 65;
  SELECT = 66;
  DATALIST = 67;
  OPTGROUP = 68;
  OPTION = 69;
  TEXTAREA = 70;
  OUTPUT = 71;
  PROGRESS = 72;
  METER = 73;
  FIELDSET = 74;
  LEGEND = 75;
  VIDEO = 76;
}

enum ARIARole {
  AUTO = 0;
  NONE = 52;
  APPLICATION = 30;
  BANNER = 67;
  COMPLEMENTARY = 68;
  CONTENTINFO = 69;
  FORM = 70;
  MAIN = 71;
  NAVIGATION = 72;
  REGION = 73;
  SEARCH = 74;
  SEPARATOR = 13;
  ARTICLE = 31;
  COLUMNHEADER = 35;
  DEFINITION = 36;
  DIRECTORY = 38;
  DOCUMENT = 39;
  GROUP = 44;
  HEADING = 45;
  IMG = 46;
  LIST = 48;
  LISTITEM = 49;
  MATH = 50;
  NOTE = 53;
  PRESENTATION = 55;
  ROW = 56;
  ROWGROUP = 57;
  ROWHEADER = 58;
  TABLE = 62;
  TOOLBAR = 65;
  BUTTON = 1;
  CHECKBOX = 2;
  GRIDCELL = 3;
  LINK = 4;
  MENUITEM = 5;
  MENUITEMCHECKBOX = 6;
  MENUITEMRADIO = 7;
  OPTION = 8;
  PROGRESSBAR = 9;
  RADIO = 10;
  SCROLLBAR = 11;
  SLIDER = 14;
  SPINBUTTON = 15;
  TAB = 17;
  TABPANEL = 18;
  TEXTBOX = 19;
  TREEITEM = 20;
  COMBOBOX = 21;
  GRID = 22;
  LISTBOX = 23;
  MENU = 24;
  MENUBAR = 25;
  RADIOGROUP = 26;
  TABLIST = 27;
  TREE = 28;
  TREEGRID = 29;
  TOOLTIP = 66;
  ALERT = 75;
  LOG = 76;
  MARQUEE = 77;
  STATUS = 78;
  TIMER = 79;
  ALERTDIALOG = 80;
  DIALOG = 81;
  SEARCHBOX = 12;
  SWITCH = 16;
  BLOCKQUOTE = 32;
  CAPTION = 33;
  CELL = 34;
  DELETION = 37;
  EMPHASIS = 40;
  FEED = 41;
  FIGURE = 42;
  GENERIC = 43;
  INSERTION = 47;
  METER = 51;
  PARAGRAPH = 54;
  STRONG = 59;
  SUBSCRIPT = 60;
  SUPERSCRIPT = 61;
  TERM = 63;
  TIME = 64;
  IMAGE = 82;
  HEADING_1 = 83;
  HEADING_2 = 84;
  HEADING_3 = 85;
  HEADING_4 = 86;
  HEADING_5 = 87;
  HEADING_6 = 88;
  HEADER = 89;
  FOOTER = 90;
  SIDEBAR = 91;
  SECTION = 92;
  MAINCONTENT = 93;
  TABLE_CELL = 94;
  WIDGET = 95;
}

message MigrationStatus {
  bool dsdCleanup = 1;
}

message NodeFieldMap {
  NodeFieldMapEntry[] entries = 1;
}

message NodeFieldMapEntry {
  GUID guid = 1;
  uint field = 2;
  uint lastModifiedSequenceNumber = 3;
}

enum ColorProfile {
  SRGB = 0;
  DISPLAY_P3 = 1;
}

enum DocumentColorProfile {
  LEGACY = 0;
  SRGB = 1;
  DISPLAY_P3 = 2;
}

enum ChildReadingDirection {
  NONE = 0;
  LEFT_TO_RIGHT = 1;
  RIGHT_TO_LEFT = 2;
}

message ARIAAttributeAnyValue {
  bool boolValue = 1;
  string stringValue = 2;
  float floatValue = 3;
  int intValue = 4;
  string[] stringArrayValue = 5;
}

enum ARIAAttributeDataType {
  BOOLEAN = 0;
  STRING = 1;
  FLOAT = 2;
  INT = 3;
  STRING_LIST = 4;
}

message ARIAAttributeData {
  ARIAAttributeDataType type = 1;
  ARIAAttributeAnyValue value = 2;
}

message ARIAAttributesMap {
  ARIAAttributesMapEntry[] entries = 1;
}

message ARIAAttributesMapEntry {
  string attribute = 1;
  ARIAAttributeData value = 2;
}

message HandoffStatusMapEntry {
  GUID guid = 1;
  SectionStatusInfo handoffStatus = 2;
}

message HandoffStatusMap {
  HandoffStatusMapEntry[] entries = 1;
}

message EditScopeInfo {
  EditScopeStack[] editScopeStacks = 1;
  EditScopeSnapshot[] snapshots = 2;
}

message EditScopeSnapshot {
  EditScopeStack[] frames = 1;
  uint[] nodeChangeFieldNumbers = 2;
}

message EditScopeStack {
  EditScope[] stack = 1;
}

message EditScope {
  EditScopeType type = 1;
  string label = 2;
  EditorType editorType = 3;
}

enum EditScopeType {
  INVALID = 0;
  TEST_SETUP = 1;
  USER = 2;
  PLUGIN = 3;
  SYSTEM = 4;
  REST_API = 5;
  ONBOARDING = 6;
  AUTOSAVE = 7;
  AI = 8;
}

enum SectionPresetState {
  INSERTED = 0;
  USER_EDITED = 1;
}

enum EmojiImageSet {
  APPLE = 0;
  NOTO = 1;
}

enum SelectionRegionFocusType {
  NONE = 0;
  PRIMARY = 1;
  SECONDARY = 2;
}

message SectionPresetInfo {
  uint64 shelfId = 1;
  uint64 templateId = 2;
  string templateName = 3;
  SectionPresetState state = 4;
}

message ClipboardSelectionRegion {
  GUID parent = 1;
  GUID[] nodes = 2;
  Vector enclosingFrameOffset = 3;
  bool pasteIsPartiallyOutsideEnclosingFrame = 4;
  SelectionRegionFocusType focusType = 5;
}

enum FirstDraftKitType {
  LOCAL = 0;
  LIBRARY = 1;
  NONE = 2;
}

message FirstDraftKit {
  string key = 1;
  FirstDraftKitType type = 2;
}

message FirstDraftData {
  string generationId = 1;
  FirstDraftKit kit = 2;
}

enum FirstDraftKitElementType {
  NONE = 0;
  BUILDING_BLOCK = 1;
  GROUPED_COMPONENT = 2;
}

message FirstDraftKitElementData {
  FirstDraftKitElementType type = 1;
}

enum PlatformShapeProperty {
  FILL = 0;
  STROKE = 1;
  TEXT = 2;
  STROKE_COLOR = 3;
}

enum PlatformShapeBehaviorType {
  SHAPE = 0;
  CONTAINER = 1;
  ADVANCED_CONTAINER = 2;
}

message PlatformShapePropertyMapEntry {
  PlatformShapeProperty property = 1;
  GUIDPath[] nodePaths = 2;
}

message PlatformShapeDefinition {
  PlatformShapePropertyMapEntry[] propertyMapEntries = 1;
  PlatformShapeBehaviorType behaviorType = 2;
  GUIDPath thumbnailNode = 3;
}

message NodeBehaviors {
  LinkBehavior link = 1;
  AppearBehavior appear = 2;
  HoverBehavior hover = 3;
  PressBehavior press = 4;
  FocusBehavior focus = 5;
  ScrollParallaxBehavior scrollParallax = 6;
  ScrollTransformBehavior scrollTransform = 7;
  CursorBehavior cursor = 8;
  MarqueeBehavior marquee = 9;
  CodeBehavior[] code = 10;
}

message BehaviorTransition {
  EasingType easingType = 1;
  float[] easingFunction = 2;
  float transitionDuration = 3;
  float delay = 4;
  VariableData transitionDurationVar = 5;
  VariableData delayVar = 6;
}

enum AppearBehaviorTrigger {
  PAGE_LOAD = 1;
  THIS_LAYER_IN_VIEW = 2;
  OTHER_LAYER_IN_VIEW = 3;
  SCROLL_DIRECTION = 4;
}

enum RelativeDirection {
  UP = 1;
  DOWN = 2;
  LEFT = 3;
  RIGHT = 4;
}

message AppearBehavior {
  AppearBehaviorTrigger trigger = 1;
  RelativeDirection direction = 2;
  GUID otherLayer = 3;
  BehaviorTransition enterTransition = 4;
  NodeChange enterState = 5;
  BehaviorTransition exitTransition = 6;
  NodeChange exitState = 7;
  bool playsOnce = 8;
  VariableData playsOnceVar = 9;
  bool isDeleted = 10;
}

message HoverBehavior {
  BehaviorTransition transition = 1;
  NodeChange state = 2;
  bool isDeleted = 3;
}

message PressBehavior {
  BehaviorTransition transition = 1;
  NodeChange state = 2;
  bool isDeleted = 3;
}

message FocusBehavior {
  BehaviorTransition transition = 1;
  NodeChange state = 2;
  bool isDeleted = 3;
}

message ScrollParallaxBehavior {
  ScrollDirection axis = 1;
  float speed = 2;
  bool relativeToPage = 3;
  VariableData speedVar = 4;
  bool isDeleted = 5;
}

enum ScrollTransformBehaviorTrigger {
  PAGE_HEIGHT = 1;
  THIS_LAYER_IN_VIEW = 2;
  OTHER_LAYER_IN_VIEW = 3;
}

message ScrollTransformBehavior {
  ScrollTransformBehaviorTrigger trigger = 1;
  GUID otherLayer = 2;
  BehaviorTransition transition = 3;
  NodeChange fromState = 4;
  NodeChange toState = 5;
  bool playsOnce = 6;
  bool playsOnceVar = 7;
  VariableData playsOnceVar2 = 8;
  bool isDeleted = 9;
}

message CursorBehavior {
  float hotspotX = 1;
  float hotspotY = 2;
  GUID cursorGuid = 3;
  bool isDeleted = 4;
}

message MarqueeBehavior {
  RelativeDirection direction = 1;
  float speed = 2;
  bool shouldLoopInfinitely = 3;
  VariableData speedVar = 4;
  VariableData shouldLoopInfinitelyVar = 5;
  VariableData pauseOnHover = 6;
  bool isDeleted = 7;
}

message CodeBehavior {
  CodeComponentId codeComponentId = 1;
  ComponentPropAssignment[] componentPropAssignments = 2;
  bool isDeleted = 3;
}

message ClientRenderedMetadata {
  string loadID = 1;
  string trackingSessionId = 2;
  uint trackingSessionSequenceId = 3;
  string reconnectID = 4;
}

enum LinkBehaviorType {
  URL = 1;
  PAGE = 2;
}

message LinkBehavior {
  LinkBehaviorType type = 1;
  string url = 2;
  GUID page = 3;
  bool openInNewWindow = 4;
}

message VariableIdOrVariableOverrideId {
  VariableID variableId = 1;
  VariableOverrideId variableOverrideId = 2;
}

struct IndexFontVariationAxis {
  string tag;
  string name;
  float min;
  float max;
  float defaultValue;
}

struct IndexFontVariationAxisValue {
  string tag;
  float value;
}

message IndexFontStyle {
  string name = 1;
  string postscript = 2;
  float weight = 3;
  bool italic = 4;
  float stretch = 5;
  IndexFontVariationAxisValue[] variationAxisValues = 6;
}

message IndexFontFile {
  string filename = 1;
  uint version = 2;
  string family = 3;
  IndexFontStyle[] styles = 4;
  IndexFontVariationAxis[] variationAxes = 5;
  bool useFontOpticalSize = 6;
}

struct IndexFamilyRename {
  string oldFamily;
  string newFamily;
}

struct IndexStyleRename {
  string oldStyle;
  string newStyle;
}

struct IndexFamilyStylesRename {
  string familyName;
  IndexStyleRename[] styleRenames;
}

struct IndexRenames {
  IndexFamilyRename[] family;
  IndexFamilyStylesRename[] style;
}

struct IndexEmojiSequence {
  uint[] codepoints;
}

struct IndexEmojis {
  uint revision;
  uint[] sizes;
  IndexEmojiSequence[] sequences;
}

message FontIndex {
  uint schemaVersion = 1;
  IndexFontFile[] files = 2;
  IndexRenames renames = 3;
  IndexEmojis emojis = 4;
}

message SlideThemeData {
  ThemeID themeID = 1;
  string version = 2;
}

enum SlideNumber {
  NONE = 0;
  SLIDE = 1;
  SECTION = 2;
  SUBSECTION = 3;
  TOTAL_WITHIN_DECK = 4;
  TOTAL_WITHIN_SECTION = 5;
}

enum NodeChatMessageType {
  USER_MESSAGE = 0;
  ASSISTANT_MESSAGE = 1;
  TOOL_MESSAGE = 2;
  SYSTEM_MESSAGE = 3;
}

message NodeChatMessage {
  GUID id = 1;
  NodeChatMessageType type = 2;
  string userId = 3;
  string textContent = 4;
  uint sentAt = 5;
  NodeChatToolCall[] toolCalls = 6;
  NodeChatToolResult[] toolResults = 7;
  uint64 sentAt64 = 8;
}

message NodeChatToolCall {
  string toolCallId = 1;
  string toolName = 2;
  string argsJson = 3;
}

message NodeChatToolResult {
  string toolCallId = 1;
  string toolName = 2;
  string resultJson = 3;
}

message NodeChatExchange {
  GUID node = 1;
  NodeChatMessage[] messages = 2;
  bool isTyping = 3;
  FileUpdate[] fileUpdates = 4;
}

message NodeChatCompressionState {
  uint startIndex = 1;
  string summary = 2;
}

message FileUpdate {
  string name = 1;
  string contents = 2;
  bool isDeleted = 3;
}

message AIChatContentPart {
  AIChatContentPartType type = 1;
  AIChatContentPartAnyValue value = 2;
}

enum AIChatContentPartType {
  INVALID = 0;
  TEXT = 1;
  SELECTED_NODE_IDS = 2;
}

message AIChatContentPartAnyValue {
  string textValue = 1;
  string[] selectedNodeIds = 2;
}

enum AIChatMessageRole {
  USER = 0;
  ASSISTANT = 1;
  TOOL = 2;
  SYSTEM = 3;
}

message AIChatMessage {
  uint createdAtMs = 1;
  AIChatMessageRole role = 2;
  AIChatContentPart[] content = 3;
  string clientId = 4;
  uint64 createdAtMs64 = 5;
}

message AIChatThread {
  AIChatMessage[] messages = 1;
}

enum CooperTemplateType {
  CUSTOM = 0;
  TWITTER_POST = 1;
  LINKEDIN_POST = 2;
  INSTA_POST_SQUARE = 3;
  INSTA_POST_PORTRAIT = 4;
  INSTA_STORY = 5;
  INSTA_AD = 6;
  FACEBOOK_POST = 7;
  FACEBOOK_COVER_PHOTO = 8;
  FACEBOOK_EVENT_COVER = 9;
  FACEBOOK_AD_PORTRAIT = 10;
  FACEBOOK_AD_SQUARE = 11;
  PINTEREST_AD_PIN = 12;
  TWITTER_BANNER = 13;
  LINKEDIN_POST_SQUARE = 15;
  LINKEDIN_POST_PORTRAIT = 16;
  LINKEDIN_POST_LANDSCAPE = 17;
  LINKEDIN_PROFILE_BANNER = 18;
  LINKEDIN_ARTICLE_BANNER = 19;
  LINKEDIN_AD_LANDSCAPE = 20;
  LINKEDIN_AD_SQUARE = 21;
  LINKEDIN_AD_VERTICAL = 22;
  YOUTUBE_THUMBNAIL = 23;
  YOUTUBE_BANNER = 24;
  YOUTUBE_AD = 25;
  TWITCH_BANNER = 26;
  GOOGLE_LEADERBOARD_AD = 27;
  GOOGLE_LARGE_AD = 28;
  GOOGLE_MED_AD = 29;
  GOOGLE_MOBILE_BANNER_AD = 30;
  GOOGLE_SKYSCRAPER_AD = 31;
  CARD_HORIZONTAL = 32;
  CARD_VERTICAL = 33;
  PRINT_US_LETTER = 34;
  POSTER = 35;
  BANNER_STANDARD = 36;
  BANNER_WIDE = 37;
  BANNER_ULTRAWIDE = 38;
  NAME_TAG_PORTRAIT = 39;
  NAME_TAG_LANDSCAPE = 40;
  INSTA_REEL_COVER = 41;
  ZOOM_BACKGROUND = 42;
  TIKTOK_POST = 43;
  INSTA_AD_PORTRAIT = 44;
  INSTA_POST_TALL_PORTRAIT = 45;
  TWITTER_POST_SQUARE = 46;
  FACEBOOK_POST_SQUARE = 47;
  FACEBOOK_POST_PORTRAIT = 48;
  FACEBOOK_STORY = 49;
  GOOGLE_SQUARE_AD = 50;
  GOOGLE_SMALL_SQUARE_AD = 51;
  GOOGLE_NARROW_SKYSCRAPER_AD = 52;
  GOOGLE_HALF_PAGE_AD = 53;
  GOOGLE_LARGE_LEADERBOARD_AD = 54;
  GOOGLE_BILLBOARD_AD = 55;
  GOOGLE_BANNER_LEADERBOARD_AD = 56;
  GOOGLE_TOP_BANNER_AD = 57;
  GOOGLE_MOBILE_LEADERBOARD_BANNER_AD = 58;
  GOOGLE_LARGE_MOBILE_BANNER_AD = 59;
  GOOGLE_MOBILE_INTERSTITIAL_AD = 60;
  GOOGLE_MOBILE_MED_RECTANGLE_AD = 61;
  PINTEREST_PIN_STANDARD = 62;
  PINTEREST_PIN_SQUARE = 63;
  PINTEREST_AD_SQUARE = 64;
  PRINT_A4 = 65;
}

message CooperTemplateData {
  CooperTemplateType type = 1;
}

message ImageImportMap {
  ImageImport[] imports = 1;
}

message ImageImport {
  string name = 1;
  Image image = 2;
}

enum InterpolationType {
  HOLD = 0;
  BEZIER = 1;
  SPRING = 2;
}

message BezierHandles {
  float p1x = 1;
  float p1y = 2;
  float p2x = 3;
  float p2y = 4;
}

enum KeyframeOperation {
  SET = 0;
  SCALE = 1;
  OFFSET = 2;
}

enum TimelinePositionType {
  ABSOLUTE = 0;
  RELATIVE = 1;
}

enum PlaybackStyle {
  ONCE = 0;
  LOOP = 1;
  BOOMERANG = 2;
}
`);_c(Gc);var _g=new Uint8Array([40,181,47,253]);function hr(e){return e.length>=4&&e[0]===40&&e[1]===181&&e[2]===47&&e[3]===253}ur();function kc(e){for(let n of e){if(n.pluginData&&n.pluginData.length>1){let t=new Map;for(let i of n.pluginData)t.set(`${i.pluginID}\0${i.key}\0${i.value}`,i);t.size<n.pluginData.length&&(n.pluginData=[...t.values()])}if(n.pluginRelaunchData&&n.pluginRelaunchData.length>1){let t=new Map;for(let i of n.pluginRelaunchData)t.set(`${i.pluginID}\0${i.command}\0${i.message}\0${i.isDeleted}`,i);t.size<n.pluginRelaunchData.length&&(n.pluginRelaunchData=[...t.values()])}}}function Fc(e){if(new TextDecoder().decode(e.slice(0,8))!=="fig-kiwi")return null;let n=new DataView(e.buffer,e.byteOffset,e.byteLength),t=n.getUint32(8,!0),i=12,o=[];for(;i<e.length&&!(i+4>e.length);){let s=n.getUint32(i,!0);if(i+=4,i+s>e.length)throw new Error(`Corrupted .fig file: chunk at offset ${i-4} declares length ${s} but only ${e.length-i} bytes remain`);o.push(e.slice(i,i+s)),i+=s}if(o.length<2)return null;let r=o[1],a;return hr(r)?a=lr(r):a=Be(r),{schemaDeflated:o[0],dataRaw:a,version:t}}function Ir(e){let n=Fc(e);if(!n)throw new Error("Invalid fig-kiwi container");let t=pr(mr(new ln(Be(n.schemaDeflated)))).decodeMessage(n.dataRaw),i=t.nodeChanges;if(!i||i.length===0)throw new Error("No nodes found in .fig file");return kc(i),{nodeChanges:i,blobs:(t.blobs??[]).map(o=>o.bytes instanceof Uint8Array?o.bytes:new Uint8Array(Object.values(o.bytes))),figKiwiVersion:n.version,figSchemaDeflated:n.schemaDeflated}}function wc(e){let n=e.toLowerCase();return n.endsWith(".png")||n.endsWith(".jpg")||n.endsWith(".json")}function Uc(e){let n=e["canvas.fig"]??e.canvas;if(n)return n;let t=null;for(let[i,o]of Object.entries(e))!o||wc(i)||(!t||o.byteLength>t.byteLength)&&(t=o);return t}function Tr(e){let n=Jt(new Uint8Array(e)),t=Uc(n);if(!t)throw new Error(`No canvas data found in .fig file. Entries: ${Object.keys(n).join(", ")}`);let i=Ir(t),o=n["meta.json"],r=Object.entries(n).filter(([a])=>a.startsWith("images/")&&a!=="images/").map(([a,s])=>[a.slice(7),s]);return{...i,images:r,thumbnailPNG:n["thumbnail.png"]??null,metaJSON:Object.hasOwn(n,"meta.json")?new TextDecoder().decode(o):null}}var zg=4*1024*1024,Wg=8*1024*1024,Kg=16*1024*1024;var Yg=new Uint8Array([137,80,78,71,13,10,26,10]);var Ht=(e,n)=>{globalThis.postMessage(e,{transfer:n})},Ge;function yr(e){return!(e instanceof ArrayBuffer)&&"type"in e}self.onmessage=e=>{let n=e.data;try{if(yr(n)){if(!Ge)throw new Error("FIG parse worker has no retained graph");let d=er(Ge);try{let f=Qo(Ge,[n.pageId]),g=on(Ge);if(!g)throw new Error("FIG population worker has no lazy import context");Ht({type:"population-result",requestId:n.requestId,baseRevision:n.baseRevision,populated:f,delta:nr(Ge,d,g.populatedRootIds)},[])}finally{d.stop()}return}let t=n instanceof ArrayBuffer?{buffer:n}:n,{nodeChanges:i,blobs:o,images:r,figKiwiVersion:a,figSchemaDeflated:s}=Tr(t.buffer),l=rr(i,o,new Map(r),t.options);l.figKiwiVersion=a,l.figSchemaDeflated=s,Ge=t.options?.populate==="first-page"?l:void 0;let u=tr(l),c=t.options?.populate==="first-page"?[]:ir(u);Ht({graph:u},c)}catch(t){let i=t instanceof Error?t.message:String(t);Ht(yr(n)?{type:"population-error",error:i}:{error:i},[])}};
