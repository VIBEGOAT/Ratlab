import{_ as j}from"./RatModel-DOxue3ve.js";import{r}from"./index-CdwGkY7b.js";import{c as w,W as P,P as H,a as O,av as L,g as X,k as R,u as q}from"./anatomy-CBSC9bqg.js";const J={uniforms:{tDiffuse:{value:null},h:{value:1/512}},vertexShader:`
      varying vec2 vUv;

      void main() {

        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

      }
  `,fragmentShader:`
    uniform sampler2D tDiffuse;
    uniform float h;

    varying vec2 vUv;

    void main() {

    	vec4 sum = vec4( 0.0 );

    	sum += texture2D( tDiffuse, vec2( vUv.x - 4.0 * h, vUv.y ) ) * 0.051;
    	sum += texture2D( tDiffuse, vec2( vUv.x - 3.0 * h, vUv.y ) ) * 0.0918;
    	sum += texture2D( tDiffuse, vec2( vUv.x - 2.0 * h, vUv.y ) ) * 0.12245;
    	sum += texture2D( tDiffuse, vec2( vUv.x - 1.0 * h, vUv.y ) ) * 0.1531;
    	sum += texture2D( tDiffuse, vec2( vUv.x, vUv.y ) ) * 0.1633;
    	sum += texture2D( tDiffuse, vec2( vUv.x + 1.0 * h, vUv.y ) ) * 0.1531;
    	sum += texture2D( tDiffuse, vec2( vUv.x + 2.0 * h, vUv.y ) ) * 0.12245;
    	sum += texture2D( tDiffuse, vec2( vUv.x + 3.0 * h, vUv.y ) ) * 0.0918;
    	sum += texture2D( tDiffuse, vec2( vUv.x + 4.0 * h, vUv.y ) ) * 0.051;

    	gl_FragColor = sum;

    }
  `},K={uniforms:{tDiffuse:{value:null},v:{value:1/512}},vertexShader:`
    varying vec2 vUv;

    void main() {

      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

    }
  `,fragmentShader:`

  uniform sampler2D tDiffuse;
  uniform float v;

  varying vec2 vUv;

  void main() {

    vec4 sum = vec4( 0.0 );

    sum += texture2D( tDiffuse, vec2( vUv.x, vUv.y - 4.0 * v ) ) * 0.051;
    sum += texture2D( tDiffuse, vec2( vUv.x, vUv.y - 3.0 * v ) ) * 0.0918;
    sum += texture2D( tDiffuse, vec2( vUv.x, vUv.y - 2.0 * v ) ) * 0.12245;
    sum += texture2D( tDiffuse, vec2( vUv.x, vUv.y - 1.0 * v ) ) * 0.1531;
    sum += texture2D( tDiffuse, vec2( vUv.x, vUv.y ) ) * 0.1633;
    sum += texture2D( tDiffuse, vec2( vUv.x, vUv.y + 1.0 * v ) ) * 0.1531;
    sum += texture2D( tDiffuse, vec2( vUv.x, vUv.y + 2.0 * v ) ) * 0.12245;
    sum += texture2D( tDiffuse, vec2( vUv.x, vUv.y + 3.0 * v ) ) * 0.0918;
    sum += texture2D( tDiffuse, vec2( vUv.x, vUv.y + 4.0 * v ) ) * 0.051;

    gl_FragColor = sum;

  }
  `},$=r.forwardRef(({scale:t=10,frames:D=1/0,opacity:I=1,width:u=1,height:n=1,blur:U=1,near:_=0,far:k=10,resolution:o=512,smooth:E=!0,color:g="#000000",depthWrite:A=!1,renderOrder:G,...W},z)=>{const l=r.useRef(null),v=w(e=>e.scene),a=w(e=>e.gl),f=r.useRef(null);u=u*(Array.isArray(t)?t[0]:t||1),n=n*(Array.isArray(t)?t[1]:t||1);const[c,F,V,i,x,d,p]=r.useMemo(()=>{const e=new P(o,o),T=new P(o,o);T.texture.generateMipmaps=e.texture.generateMipmaps=!1;const B=new H(u,n).rotateX(Math.PI/2),Z=new O(B),m=new L;m.depthTest=m.depthWrite=!1,m.onBeforeCompile=s=>{s.uniforms={...s.uniforms,ucolor:{value:new X(g)}},s.fragmentShader=s.fragmentShader.replace("void main() {",`uniform vec3 ucolor;
           void main() {
          `),s.fragmentShader=s.fragmentShader.replace("vec4( vec3( 1.0 - fragCoordZ ), opacity );","vec4( ucolor * fragCoordZ * 2.0, ( 1.0 - fragCoordZ ) * 1.0 );")};const C=new R(J),b=new R(K);return b.depthTest=C.depthTest=!1,[e,B,m,Z,C,b,T]},[o,u,n,t,g]),y=e=>{i.visible=!0,i.material=x,x.uniforms.tDiffuse.value=c.texture,x.uniforms.h.value=e*1/256,a.setRenderTarget(p),a.render(i,f.current),i.material=d,d.uniforms.tDiffuse.value=p.texture,d.uniforms.v.value=e*1/256,a.setRenderTarget(c),a.render(i,f.current),i.visible=!1};let h=0,M,S;return q(()=>{f.current&&(D===1/0||h<D)&&(h++,M=v.background,S=v.overrideMaterial,l.current.visible=!1,v.background=null,v.overrideMaterial=V,a.setRenderTarget(c),a.render(v,f.current),y(U),E&&y(U*.4),a.setRenderTarget(null),l.current.visible=!0,v.overrideMaterial=S,v.background=M)}),r.useImperativeHandle(z,()=>l.current,[]),r.createElement("group",j({"rotation-x":Math.PI/2},W,{ref:l}),r.createElement("mesh",{renderOrder:G,geometry:F,scale:[1,-1,1],rotation:[-Math.PI/2,0,0]},r.createElement("meshBasicMaterial",{transparent:!0,map:c.texture,opacity:I,depthWrite:A})),r.createElement("orthographicCamera",{ref:f,args:[-u/2,u/2,n/2,-n/2,_,k]}))});export{$ as C};
//# sourceMappingURL=ContactShadows-BfQR3n-u.js.map
