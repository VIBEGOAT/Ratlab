import{r as m,j as i}from"./index-DpgDRqAh.js";import{b as ve}from"./behaviorTelemetry-BwAdt1PU.js";import{a as Se}from"./webgl-DpBQhAUt.js";import{_ as Q,H as $,C as ye,a as be,R as we,D as Me}from"./RatModel-C-ggJxEy.js";import{aw as _e,ax as F,ay as N,az as C,aA as Ee,aB as Y,aC as de,V as A,k as je,aD as ee,aE as te,l as fe,a as Ae,w as O,aF as Le,v as ze,M as k,c as ue,g as pe,p as Ue,q as Ce,u as X}from"./anatomy-Btmsu7n0.js";import{r as Be}from"./ratState-BvAFkIY9.js";import{v as he}from"./constants-BCX624au.js";const me=he>=125?"uv1":"uv2",ne=new Y,P=new A;class Z extends _e{constructor(){super(),this.isLineSegmentsGeometry=!0,this.type="LineSegmentsGeometry";const e=[-1,2,0,1,2,0,-1,1,0,1,1,0,-1,0,0,1,0,0,-1,-1,0,1,-1,0],t=[-1,2,1,2,-1,1,1,1,-1,-1,1,-1,-1,-2,1,-2],o=[0,2,1,2,3,1,2,4,3,4,5,3,4,6,5,6,7,5];this.setIndex(o),this.setAttribute("position",new F(e,3)),this.setAttribute("uv",new F(t,2))}applyMatrix4(e){const t=this.attributes.instanceStart,o=this.attributes.instanceEnd;return t!==void 0&&(t.applyMatrix4(e),o.applyMatrix4(e),t.needsUpdate=!0),this.boundingBox!==null&&this.computeBoundingBox(),this.boundingSphere!==null&&this.computeBoundingSphere(),this}setPositions(e){let t;e instanceof Float32Array?t=e:Array.isArray(e)&&(t=new Float32Array(e));const o=new N(t,6,1);return this.setAttribute("instanceStart",new C(o,3,0)),this.setAttribute("instanceEnd",new C(o,3,3)),this.computeBoundingBox(),this.computeBoundingSphere(),this}setColors(e,t=3){let o;e instanceof Float32Array?o=e:Array.isArray(e)&&(o=new Float32Array(e));const n=new N(o,t*2,1);return this.setAttribute("instanceColorStart",new C(n,t,0)),this.setAttribute("instanceColorEnd",new C(n,t,t)),this}fromWireframeGeometry(e){return this.setPositions(e.attributes.position.array),this}fromEdgesGeometry(e){return this.setPositions(e.attributes.position.array),this}fromMesh(e){return this.fromWireframeGeometry(new Ee(e.geometry)),this}fromLineSegments(e){const t=e.geometry;return this.setPositions(t.attributes.position.array),this}computeBoundingBox(){this.boundingBox===null&&(this.boundingBox=new Y);const e=this.attributes.instanceStart,t=this.attributes.instanceEnd;e!==void 0&&t!==void 0&&(this.boundingBox.setFromBufferAttribute(e),ne.setFromBufferAttribute(t),this.boundingBox.union(ne))}computeBoundingSphere(){this.boundingSphere===null&&(this.boundingSphere=new de),this.boundingBox===null&&this.computeBoundingBox();const e=this.attributes.instanceStart,t=this.attributes.instanceEnd;if(e!==void 0&&t!==void 0){const o=this.boundingSphere.center;this.boundingBox.getCenter(o);let n=0;for(let s=0,r=e.count;s<r;s++)P.fromBufferAttribute(e,s),n=Math.max(n,o.distanceToSquared(P)),P.fromBufferAttribute(t,s),n=Math.max(n,o.distanceToSquared(P));this.boundingSphere.radius=Math.sqrt(n),isNaN(this.boundingSphere.radius)&&console.error("THREE.LineSegmentsGeometry.computeBoundingSphere(): Computed radius is NaN. The instanced position data is likely to have NaN values.",this)}}toJSON(){}applyMatrix(e){return console.warn("THREE.LineSegmentsGeometry: applyMatrix() has been renamed to applyMatrix4()."),this.applyMatrix4(e)}}class xe extends Z{constructor(){super(),this.isLineGeometry=!0,this.type="LineGeometry"}setPositions(e){const t=e.length-3,o=new Float32Array(2*t);for(let n=0;n<t;n+=3)o[2*n]=e[n],o[2*n+1]=e[n+1],o[2*n+2]=e[n+2],o[2*n+3]=e[n+3],o[2*n+4]=e[n+4],o[2*n+5]=e[n+5];return super.setPositions(o),this}setColors(e,t=3){const o=e.length-t,n=new Float32Array(2*o);if(t===3)for(let s=0;s<o;s+=t)n[2*s]=e[s],n[2*s+1]=e[s+1],n[2*s+2]=e[s+2],n[2*s+3]=e[s+3],n[2*s+4]=e[s+4],n[2*s+5]=e[s+5];else for(let s=0;s<o;s+=t)n[2*s]=e[s],n[2*s+1]=e[s+1],n[2*s+2]=e[s+2],n[2*s+3]=e[s+3],n[2*s+4]=e[s+4],n[2*s+5]=e[s+5],n[2*s+6]=e[s+6],n[2*s+7]=e[s+7];return super.setColors(n,t),this}fromLine(e){const t=e.geometry;return this.setPositions(t.attributes.position.array),this}}class J extends je{constructor(e){super({type:"LineMaterial",uniforms:ee.clone(ee.merge([te.common,te.fog,{worldUnits:{value:1},linewidth:{value:1},resolution:{value:new fe(1,1)},dashOffset:{value:0},dashScale:{value:1},dashSize:{value:1},gapSize:{value:1}}])),vertexShader:`
				#include <common>
				#include <fog_pars_vertex>
				#include <logdepthbuf_pars_vertex>
				#include <clipping_planes_pars_vertex>

				uniform float linewidth;
				uniform vec2 resolution;

				attribute vec3 instanceStart;
				attribute vec3 instanceEnd;

				#ifdef USE_COLOR
					#ifdef USE_LINE_COLOR_ALPHA
						varying vec4 vLineColor;
						attribute vec4 instanceColorStart;
						attribute vec4 instanceColorEnd;
					#else
						varying vec3 vLineColor;
						attribute vec3 instanceColorStart;
						attribute vec3 instanceColorEnd;
					#endif
				#endif

				#ifdef WORLD_UNITS

					varying vec4 worldPos;
					varying vec3 worldStart;
					varying vec3 worldEnd;

					#ifdef USE_DASH

						varying vec2 vUv;

					#endif

				#else

					varying vec2 vUv;

				#endif

				#ifdef USE_DASH

					uniform float dashScale;
					attribute float instanceDistanceStart;
					attribute float instanceDistanceEnd;
					varying float vLineDistance;

				#endif

				void trimSegment( const in vec4 start, inout vec4 end ) {

					// trim end segment so it terminates between the camera plane and the near plane

					// conservative estimate of the near plane
					float a = projectionMatrix[ 2 ][ 2 ]; // 3nd entry in 3th column
					float b = projectionMatrix[ 3 ][ 2 ]; // 3nd entry in 4th column
					float nearEstimate = - 0.5 * b / a;

					float alpha = ( nearEstimate - start.z ) / ( end.z - start.z );

					end.xyz = mix( start.xyz, end.xyz, alpha );

				}

				void main() {

					#ifdef USE_COLOR

						vLineColor = ( position.y < 0.5 ) ? instanceColorStart : instanceColorEnd;

					#endif

					#ifdef USE_DASH

						vLineDistance = ( position.y < 0.5 ) ? dashScale * instanceDistanceStart : dashScale * instanceDistanceEnd;
						vUv = uv;

					#endif

					float aspect = resolution.x / resolution.y;

					// camera space
					vec4 start = modelViewMatrix * vec4( instanceStart, 1.0 );
					vec4 end = modelViewMatrix * vec4( instanceEnd, 1.0 );

					#ifdef WORLD_UNITS

						worldStart = start.xyz;
						worldEnd = end.xyz;

					#else

						vUv = uv;

					#endif

					// special case for perspective projection, and segments that terminate either in, or behind, the camera plane
					// clearly the gpu firmware has a way of addressing this issue when projecting into ndc space
					// but we need to perform ndc-space calculations in the shader, so we must address this issue directly
					// perhaps there is a more elegant solution -- WestLangley

					bool perspective = ( projectionMatrix[ 2 ][ 3 ] == - 1.0 ); // 4th entry in the 3rd column

					if ( perspective ) {

						if ( start.z < 0.0 && end.z >= 0.0 ) {

							trimSegment( start, end );

						} else if ( end.z < 0.0 && start.z >= 0.0 ) {

							trimSegment( end, start );

						}

					}

					// clip space
					vec4 clipStart = projectionMatrix * start;
					vec4 clipEnd = projectionMatrix * end;

					// ndc space
					vec3 ndcStart = clipStart.xyz / clipStart.w;
					vec3 ndcEnd = clipEnd.xyz / clipEnd.w;

					// direction
					vec2 dir = ndcEnd.xy - ndcStart.xy;

					// account for clip-space aspect ratio
					dir.x *= aspect;
					dir = normalize( dir );

					#ifdef WORLD_UNITS

						// get the offset direction as perpendicular to the view vector
						vec3 worldDir = normalize( end.xyz - start.xyz );
						vec3 offset;
						if ( position.y < 0.5 ) {

							offset = normalize( cross( start.xyz, worldDir ) );

						} else {

							offset = normalize( cross( end.xyz, worldDir ) );

						}

						// sign flip
						if ( position.x < 0.0 ) offset *= - 1.0;

						float forwardOffset = dot( worldDir, vec3( 0.0, 0.0, 1.0 ) );

						// don't extend the line if we're rendering dashes because we
						// won't be rendering the endcaps
						#ifndef USE_DASH

							// extend the line bounds to encompass  endcaps
							start.xyz += - worldDir * linewidth * 0.5;
							end.xyz += worldDir * linewidth * 0.5;

							// shift the position of the quad so it hugs the forward edge of the line
							offset.xy -= dir * forwardOffset;
							offset.z += 0.5;

						#endif

						// endcaps
						if ( position.y > 1.0 || position.y < 0.0 ) {

							offset.xy += dir * 2.0 * forwardOffset;

						}

						// adjust for linewidth
						offset *= linewidth * 0.5;

						// set the world position
						worldPos = ( position.y < 0.5 ) ? start : end;
						worldPos.xyz += offset;

						// project the worldpos
						vec4 clip = projectionMatrix * worldPos;

						// shift the depth of the projected points so the line
						// segments overlap neatly
						vec3 clipPose = ( position.y < 0.5 ) ? ndcStart : ndcEnd;
						clip.z = clipPose.z * clip.w;

					#else

						vec2 offset = vec2( dir.y, - dir.x );
						// undo aspect ratio adjustment
						dir.x /= aspect;
						offset.x /= aspect;

						// sign flip
						if ( position.x < 0.0 ) offset *= - 1.0;

						// endcaps
						if ( position.y < 0.0 ) {

							offset += - dir;

						} else if ( position.y > 1.0 ) {

							offset += dir;

						}

						// adjust for linewidth
						offset *= linewidth;

						// adjust for clip-space to screen-space conversion // maybe resolution should be based on viewport ...
						offset /= resolution.y;

						// select end
						vec4 clip = ( position.y < 0.5 ) ? clipStart : clipEnd;

						// back to clip space
						offset *= clip.w;

						clip.xy += offset;

					#endif

					gl_Position = clip;

					vec4 mvPosition = ( position.y < 0.5 ) ? start : end; // this is an approximation

					#include <logdepthbuf_vertex>
					#include <clipping_planes_vertex>
					#include <fog_vertex>

				}
			`,fragmentShader:`
				uniform vec3 diffuse;
				uniform float opacity;
				uniform float linewidth;

				#ifdef USE_DASH

					uniform float dashOffset;
					uniform float dashSize;
					uniform float gapSize;

				#endif

				varying float vLineDistance;

				#ifdef WORLD_UNITS

					varying vec4 worldPos;
					varying vec3 worldStart;
					varying vec3 worldEnd;

					#ifdef USE_DASH

						varying vec2 vUv;

					#endif

				#else

					varying vec2 vUv;

				#endif

				#include <common>
				#include <fog_pars_fragment>
				#include <logdepthbuf_pars_fragment>
				#include <clipping_planes_pars_fragment>

				#ifdef USE_COLOR
					#ifdef USE_LINE_COLOR_ALPHA
						varying vec4 vLineColor;
					#else
						varying vec3 vLineColor;
					#endif
				#endif

				vec2 closestLineToLine(vec3 p1, vec3 p2, vec3 p3, vec3 p4) {

					float mua;
					float mub;

					vec3 p13 = p1 - p3;
					vec3 p43 = p4 - p3;

					vec3 p21 = p2 - p1;

					float d1343 = dot( p13, p43 );
					float d4321 = dot( p43, p21 );
					float d1321 = dot( p13, p21 );
					float d4343 = dot( p43, p43 );
					float d2121 = dot( p21, p21 );

					float denom = d2121 * d4343 - d4321 * d4321;

					float numer = d1343 * d4321 - d1321 * d4343;

					mua = numer / denom;
					mua = clamp( mua, 0.0, 1.0 );
					mub = ( d1343 + d4321 * ( mua ) ) / d4343;
					mub = clamp( mub, 0.0, 1.0 );

					return vec2( mua, mub );

				}

				void main() {

					#include <clipping_planes_fragment>

					#ifdef USE_DASH

						if ( vUv.y < - 1.0 || vUv.y > 1.0 ) discard; // discard endcaps

						if ( mod( vLineDistance + dashOffset, dashSize + gapSize ) > dashSize ) discard; // todo - FIX

					#endif

					float alpha = opacity;

					#ifdef WORLD_UNITS

						// Find the closest points on the view ray and the line segment
						vec3 rayEnd = normalize( worldPos.xyz ) * 1e5;
						vec3 lineDir = worldEnd - worldStart;
						vec2 params = closestLineToLine( worldStart, worldEnd, vec3( 0.0, 0.0, 0.0 ), rayEnd );

						vec3 p1 = worldStart + lineDir * params.x;
						vec3 p2 = rayEnd * params.y;
						vec3 delta = p1 - p2;
						float len = length( delta );
						float norm = len / linewidth;

						#ifndef USE_DASH

							#ifdef USE_ALPHA_TO_COVERAGE

								float dnorm = fwidth( norm );
								alpha = 1.0 - smoothstep( 0.5 - dnorm, 0.5 + dnorm, norm );

							#else

								if ( norm > 0.5 ) {

									discard;

								}

							#endif

						#endif

					#else

						#ifdef USE_ALPHA_TO_COVERAGE

							// artifacts appear on some hardware if a derivative is taken within a conditional
							float a = vUv.x;
							float b = ( vUv.y > 0.0 ) ? vUv.y - 1.0 : vUv.y + 1.0;
							float len2 = a * a + b * b;
							float dlen = fwidth( len2 );

							if ( abs( vUv.y ) > 1.0 ) {

								alpha = 1.0 - smoothstep( 1.0 - dlen, 1.0 + dlen, len2 );

							}

						#else

							if ( abs( vUv.y ) > 1.0 ) {

								float a = vUv.x;
								float b = ( vUv.y > 0.0 ) ? vUv.y - 1.0 : vUv.y + 1.0;
								float len2 = a * a + b * b;

								if ( len2 > 1.0 ) discard;

							}

						#endif

					#endif

					vec4 diffuseColor = vec4( diffuse, alpha );
					#ifdef USE_COLOR
						#ifdef USE_LINE_COLOR_ALPHA
							diffuseColor *= vLineColor;
						#else
							diffuseColor.rgb *= vLineColor;
						#endif
					#endif

					#include <logdepthbuf_fragment>

					gl_FragColor = diffuseColor;

					#include <tonemapping_fragment>
					#include <${he>=154?"colorspace_fragment":"encodings_fragment"}>
					#include <fog_fragment>
					#include <premultiplied_alpha_fragment>

				}
			`,clipping:!0}),this.isLineMaterial=!0,this.onBeforeCompile=function(){this.transparent?this.defines.USE_LINE_COLOR_ALPHA="1":delete this.defines.USE_LINE_COLOR_ALPHA},Object.defineProperties(this,{color:{enumerable:!0,get:function(){return this.uniforms.diffuse.value},set:function(t){this.uniforms.diffuse.value=t}},worldUnits:{enumerable:!0,get:function(){return"WORLD_UNITS"in this.defines},set:function(t){t===!0?this.defines.WORLD_UNITS="":delete this.defines.WORLD_UNITS}},linewidth:{enumerable:!0,get:function(){return this.uniforms.linewidth.value},set:function(t){this.uniforms.linewidth.value=t}},dashed:{enumerable:!0,get:function(){return"USE_DASH"in this.defines},set(t){!!t!="USE_DASH"in this.defines&&(this.needsUpdate=!0),t===!0?this.defines.USE_DASH="":delete this.defines.USE_DASH}},dashScale:{enumerable:!0,get:function(){return this.uniforms.dashScale.value},set:function(t){this.uniforms.dashScale.value=t}},dashSize:{enumerable:!0,get:function(){return this.uniforms.dashSize.value},set:function(t){this.uniforms.dashSize.value=t}},dashOffset:{enumerable:!0,get:function(){return this.uniforms.dashOffset.value},set:function(t){this.uniforms.dashOffset.value=t}},gapSize:{enumerable:!0,get:function(){return this.uniforms.gapSize.value},set:function(t){this.uniforms.gapSize.value=t}},opacity:{enumerable:!0,get:function(){return this.uniforms.opacity.value},set:function(t){this.uniforms.opacity.value=t}},resolution:{enumerable:!0,get:function(){return this.uniforms.resolution.value},set:function(t){this.uniforms.resolution.value.copy(t)}},alphaToCoverage:{enumerable:!0,get:function(){return"USE_ALPHA_TO_COVERAGE"in this.defines},set:function(t){!!t!="USE_ALPHA_TO_COVERAGE"in this.defines&&(this.needsUpdate=!0),t===!0?(this.defines.USE_ALPHA_TO_COVERAGE="",this.extensions.derivatives=!0):(delete this.defines.USE_ALPHA_TO_COVERAGE,this.extensions.derivatives=!1)}}}),this.setValues(e)}}const I=new O,ie=new A,se=new A,v=new O,S=new O,_=new O,H=new A,W=new ze,y=new Le,oe=new A,T=new Y,R=new de,E=new O;let j,z;function re(a,e,t){return E.set(0,0,-e,1).applyMatrix4(a.projectionMatrix),E.multiplyScalar(1/E.w),E.x=z/t.width,E.y=z/t.height,E.applyMatrix4(a.projectionMatrixInverse),E.multiplyScalar(1/E.w),Math.abs(Math.max(E.x,E.y))}function Oe(a,e){const t=a.matrixWorld,o=a.geometry,n=o.attributes.instanceStart,s=o.attributes.instanceEnd,r=Math.min(o.instanceCount,n.count);for(let l=0,c=r;l<c;l++){y.start.fromBufferAttribute(n,l),y.end.fromBufferAttribute(s,l),y.applyMatrix4(t);const f=new A,d=new A;j.distanceSqToSegment(y.start,y.end,d,f),d.distanceTo(f)<z*.5&&e.push({point:d,pointOnLine:f,distance:j.origin.distanceTo(d),object:a,face:null,faceIndex:l,uv:null,[me]:null})}}function De(a,e,t){const o=e.projectionMatrix,s=a.material.resolution,r=a.matrixWorld,l=a.geometry,c=l.attributes.instanceStart,f=l.attributes.instanceEnd,d=Math.min(l.instanceCount,c.count),u=-e.near;j.at(1,_),_.w=1,_.applyMatrix4(e.matrixWorldInverse),_.applyMatrix4(o),_.multiplyScalar(1/_.w),_.x*=s.x/2,_.y*=s.y/2,_.z=0,H.copy(_),W.multiplyMatrices(e.matrixWorldInverse,r);for(let h=0,b=d;h<b;h++){if(v.fromBufferAttribute(c,h),S.fromBufferAttribute(f,h),v.w=1,S.w=1,v.applyMatrix4(W),S.applyMatrix4(W),v.z>u&&S.z>u)continue;if(v.z>u){const p=v.z-S.z,x=(v.z-u)/p;v.lerp(S,x)}else if(S.z>u){const p=S.z-v.z,x=(S.z-u)/p;S.lerp(v,x)}v.applyMatrix4(o),S.applyMatrix4(o),v.multiplyScalar(1/v.w),S.multiplyScalar(1/S.w),v.x*=s.x/2,v.y*=s.y/2,S.x*=s.x/2,S.y*=s.y/2,y.start.copy(v),y.start.z=0,y.end.copy(S),y.end.z=0;const w=y.closestPointToPointParameter(H,!0);y.at(w,oe);const L=k.lerp(v.z,S.z,w),M=L>=-1&&L<=1,U=H.distanceTo(oe)<z*.5;if(M&&U){y.start.fromBufferAttribute(c,h),y.end.fromBufferAttribute(f,h),y.start.applyMatrix4(r),y.end.applyMatrix4(r);const p=new A,x=new A;j.distanceSqToSegment(y.start,y.end,x,p),t.push({point:x,pointOnLine:p,distance:j.origin.distanceTo(x),object:a,face:null,faceIndex:h,uv:null,[me]:null})}}}class ge extends Ae{constructor(e=new Z,t=new J({color:Math.random()*16777215})){super(e,t),this.isLineSegments2=!0,this.type="LineSegments2"}computeLineDistances(){const e=this.geometry,t=e.attributes.instanceStart,o=e.attributes.instanceEnd,n=new Float32Array(2*t.count);for(let r=0,l=0,c=t.count;r<c;r++,l+=2)ie.fromBufferAttribute(t,r),se.fromBufferAttribute(o,r),n[l]=l===0?0:n[l-1],n[l+1]=n[l]+ie.distanceTo(se);const s=new N(n,2,1);return e.setAttribute("instanceDistanceStart",new C(s,1,0)),e.setAttribute("instanceDistanceEnd",new C(s,1,1)),this}raycast(e,t){const o=this.material.worldUnits,n=e.camera;n===null&&!o&&console.error('LineSegments2: "Raycaster.camera" needs to be set in order to raycast against LineSegments2 while worldUnits is set to false.');const s=e.params.Line2!==void 0&&e.params.Line2.threshold||0;j=e.ray;const r=this.matrixWorld,l=this.geometry,c=this.material;z=c.linewidth+s,l.boundingSphere===null&&l.computeBoundingSphere(),R.copy(l.boundingSphere).applyMatrix4(r);let f;if(o)f=z*.5;else{const u=Math.max(n.near,R.distanceToPoint(j.origin));f=re(n,u,c.resolution)}if(R.radius+=f,j.intersectsSphere(R)===!1)return;l.boundingBox===null&&l.computeBoundingBox(),T.copy(l.boundingBox).applyMatrix4(r);let d;if(o)d=z*.5;else{const u=Math.max(n.near,T.distanceToPoint(j.origin));d=re(n,u,c.resolution)}T.expandByScalar(d),j.intersectsBox(T)!==!1&&(o?Oe(this,t):De(this,n,t))}onBeforeRender(e){const t=this.material.uniforms;t&&t.resolution&&(e.getViewport(I),this.material.uniforms.resolution.value.set(I.z,I.w))}}class Pe extends ge{constructor(e=new xe,t=new J({color:Math.random()*16777215})){super(e,t),this.isLine2=!0,this.type="Line2"}}const V=m.forwardRef(function({points:e,color:t=16777215,vertexColors:o,linewidth:n,lineWidth:s,segments:r,dashed:l,...c},f){var d,u;const h=ue(M=>M.size),b=m.useMemo(()=>r?new ge:new Pe,[r]),[g]=m.useState(()=>new J),w=(o==null||(d=o[0])==null?void 0:d.length)===4?4:3,L=m.useMemo(()=>{const M=r?new Z:new xe,U=e.map(p=>{const x=Array.isArray(p);return p instanceof A||p instanceof O?[p.x,p.y,p.z]:p instanceof fe?[p.x,p.y,0]:x&&p.length===3?[p[0],p[1],p[2]]:x&&p.length===2?[p[0],p[1],0]:p});if(M.setPositions(U.flat()),o){t=16777215;const p=o.map(x=>x instanceof pe?x.toArray():x);M.setColors(p.flat(),w)}return M},[e,r,o,w]);return m.useLayoutEffect(()=>{b.computeLineDistances()},[e,b]),m.useLayoutEffect(()=>{l?g.defines.USE_DASH="":delete g.defines.USE_DASH,g.needsUpdate=!0},[l,g]),m.useEffect(()=>()=>{L.dispose(),g.dispose()},[L]),m.createElement("primitive",Q({object:b,ref:f},c),m.createElement("primitive",{object:L,attach:"geometry"}),m.createElement("primitive",Q({object:g,attach:"material",color:t,vertexColors:!!o,resolution:[h.width,h.height],linewidth:(u=n??s)!==null&&u!==void 0?u:1,dashed:l,transparent:w===4},c)))}),Te={...Me,xray:!1,labels:!1,tumor:!0},Re=.3;function B({bundle:a,day:e,pose:t,color:o,label:n,labelVisible:s=!0}){const r=m.useRef(null),l=m.useRef(0),c=m.useMemo(()=>Be(a,e),[a,e]);return X(({clock:f},d)=>{const u=t(f.elapsedTime);r.current&&(r.current.position.x=k.damp(r.current.position.x,u.x,14,d),r.current.position.z=k.damp(r.current.position.z,u.z,14,d),r.current.rotation.y+=Math.atan2(Math.sin(u.heading-r.current.rotation.y),Math.cos(u.heading-r.current.rotation.y))*(1-Math.exp(-d*12))),l.current=Math.min(1,u.speed)}),i.jsxs("group",{ref:r,children:[i.jsx(we,{v:c,layers:Te,walk:l,scale:Re,quality:"low"}),i.jsx($,{center:!0,position:[0,1.1,0],distanceFactor:9,style:{pointerEvents:"none",display:s?void 0:"none"},children:i.jsx("div",{style:{font:"600 11px 'IBM Plex Sans', sans-serif",padding:"1px 6px",borderRadius:4,background:"rgba(10,20,19,0.8)",color:o,border:`1px solid ${o}`,whiteSpace:"nowrap"},children:n})})]})}function K(a,e,t=0){return Math.abs(a)+Math.abs(e)<1e-6?t:Math.atan2(-e,a)}function q(a,e,t){const o=a.track.x.length;let n=0;return s=>{const r=s*a.track.hz*e%(o-1),l=Math.floor(r),c=r-l,f=(a.track.x[l]-.5)*t,d=(a.track.y[l]-.5)*t,u=(a.track.x[l+1]-.5)*t,h=(a.track.y[l+1]-.5)*t,b=u-f,g=h-d;return n=K(b,g,n),{x:f+b*c,z:d+g*c,heading:n,speed:Math.hypot(b,g)*a.track.hz*e*.8}}}function ae(a,e,t){const o=a.waterMaze.lastRoute,n=8;let s=0;return r=>{const l=Math.min(o.length-1.001,r*t%(o.length+4)),c=Math.max(0,Math.floor(l)),f=Math.max(0,l-c),d=o[c],u=o[Math.min(o.length-1,c+1)],h=w=>((w+.5)/n-.5)*e,b=h(d[0])+(h(u[0])-h(d[0]))*f,g=h(d[1])+(h(u[1])-h(d[1]))*f;return s=K(h(u[0])-h(d[0]),h(u[1])-h(d[1]),s),{x:b,z:g,heading:s,speed:c>=o.length-1?0:.8}}}function le(a,e,t,o){const n=[[-2.4,-1],[2.4,-1],[0,1.1],[-.6,0],[1.4,.4]],s=a.homeCage[Math.min(e,a.days)].activity;let r=0,l=1.1,c=0,f=0;return d=>{const u=Math.min(.1,d-f);f=d;const h=t(d),b=Math.min(95,Math.floor(h*4)),g=Math.min(1,(s[b]??0)/25),w=Math.floor(d/2.5)+o,L=Math.abs(Math.sin(w*12.9898)*43758.5453)%1,M=g<.12||L>.4+.6*g,U=M?n[2]:n[Math.floor(L*5)%5],p=U[0]-r,x=U[1]-l,D=Math.hypot(p,x),G=M?.5:.8+1.2*g;return D>.08&&(r+=p/D*G*u,l+=x/D*G*u,c=K(p,x,c)),{x:r,z:l,heading:c,speed:D>.08?G/1.6:0}}}function ce({bundle:a,color:e,size:t}){const o=m.useRef(null),n=m.useMemo(()=>{const r=new Ue;r.setAttribute("position",new Ce(new Float32Array(48*6),3));const l=new pe(e),c=[];for(let f=0;f<48;f++)for(let d=0;d<2;d++)c.push(l.r*(1-f/48),l.g*(1-f/48),l.b*(1-f/48));return r.setAttribute("color",new F(c,3)),r},[e]);m.useEffect(()=>()=>n.dispose(),[n]);const s=m.useMemo(()=>q(a,4,t),[a,t]);return X(({clock:r})=>{const l=n.attributes.position;for(let c=0;c<48;c++){const f=s(Math.max(0,r.elapsedTime-c*.045)),d=s(Math.max(0,r.elapsedTime-(c+1)*.045)),u=Math.hypot(f.x-d.x,f.z-d.z)>.6;l.setXYZ(c*2,f.x,.025,f.z),l.setXYZ(c*2+1,u?f.x:d.x,.025,u?f.z:d.z)}l.needsUpdate=!0}),i.jsx("lineSegments",{ref:o,geometry:n,frustumCulled:!1,children:i.jsx("lineBasicMaterial",{vertexColors:!0,transparent:!0,opacity:.7})})}function Ge({t:a,u:e,day:t}){const n=m.useMemo(()=>q(a,4,5),[a]),s=m.useMemo(()=>q(e,4,5.6-.6),[e]),[r,l]=m.useState(!1),c=m.useMemo(()=>ve(r?e:a),[r,a,e]);return i.jsxs(i.Fragment,{children:[i.jsxs("mesh",{rotation:[-Math.PI/2,0,0],position:[0,-.01,0],children:[i.jsx("planeGeometry",{args:[5.6,5.6]}),i.jsx("meshStandardMaterial",{color:"#24211d"})]}),i.jsx(V,{points:[[-5.6/4,.01,-5.6/4],[5.6/4,.01,-5.6/4],[5.6/4,.01,5.6/4],[-5.6/4,.01,5.6/4],[-5.6/4,.01,-5.6/4]],color:"#9c978b",dashed:!0,dashSize:.15,gapSize:.1,lineWidth:1}),[[0,-5.6/2,5.6,.2],[0,5.6/2,5.6,.2],[-5.6/2,0,.2,5.6],[5.6/2,0,.2,5.6]].map(([f,d,u,h],b)=>i.jsxs("mesh",{position:[f,.15,d],children:[i.jsx("boxGeometry",{args:[u,.3,h]}),i.jsx("meshStandardMaterial",{color:"#444037"})]},b)),i.jsx("group",{visible:!r,children:i.jsx(ce,{bundle:a,color:"#e8a855",size:5.6-.6})}),i.jsx("group",{visible:r,children:i.jsx(ce,{bundle:e,color:"#78c679",size:5.6-.6})}),i.jsx("group",{visible:!r,children:i.jsx(B,{bundle:a,day:t,pose:n,color:"#e8a855",label:"Dosed",labelVisible:!r})}),i.jsx("group",{visible:r,children:i.jsx(B,{bundle:e,day:t,pose:s,color:"#78c679",label:"Control",labelVisible:r})}),i.jsx($,{fullscreen:!0,calculatePosition:(f,d,u)=>[u.width/2,u.height/2],style:{pointerEvents:"none"},children:i.jsxs("div",{className:"arena-readout",children:[i.jsxs("div",{role:"group","aria-label":"Open field comparison",children:[i.jsx("button",{"aria-pressed":!r,onClick:()=>l(!1),children:"Dosed"}),i.jsx("button",{"aria-pressed":r,onClick:()=>l(!0),children:"Control"})]}),i.jsxs("div",{className:"arena-kpis",children:[i.jsxs("span",{children:["Velocity",i.jsxs("strong",{children:[c.velocity.toFixed(1)," cm/s"]})]}),i.jsxs("span",{children:["Exploration",i.jsxs("strong",{children:[c.exploration.toFixed(1)," entries/min"]})]}),i.jsxs("span",{children:["Rest",i.jsxs("strong",{children:[(c.rest*100).toFixed(0),"%"]})]})]}),i.jsx("small",{children:"50 cm arena calibration · center-entry proxy · rearing not modelled"})]})})]})}function Ie({t:a,u:e,day:t}){const r=a.waterMaze.platform;return i.jsxs(i.Fragment,{children:[i.jsxs("mesh",{rotation:[-Math.PI/2,0,0],position:[0,-.01,0],children:[i.jsx("planeGeometry",{args:[6,6]}),i.jsx("meshStandardMaterial",{color:"#24211d"})]}),Array.from({length:9},(l,c)=>i.jsx(V,{points:[[-6/2+c*.75,.005,-6/2],[-6/2+c*.75,.005,6/2]],color:"#665f51",lineWidth:1},`a${c}`)),Array.from({length:9},(l,c)=>i.jsx(V,{points:[[-6/2,.005,-6/2+c*.75],[6/2,.005,-6/2+c*.75]],color:"#665f51",lineWidth:1},`b${c}`)),i.jsxs("mesh",{position:[((r[0]+.5)/8-.5)*6,.03,((r[1]+.5)/8-.5)*6],children:[i.jsx("cylinderGeometry",{args:[.75*.35,.75*.35,.06,20]}),i.jsx("meshStandardMaterial",{color:"#e0a050"})]}),i.jsx(B,{bundle:a,day:t,pose:ae(a,6,3),color:"#e8a855",label:"Treated"}),i.jsx(B,{bundle:e,day:t,pose:ae(e,6,3),color:"#78c679",label:"Untreated twin"})]})}function He({t:a,u:e,day:t,hoursPerSec:o}){const n=l=>l*o%24,s=m.useRef(null),r=m.useRef(null);return X(({clock:l})=>{const c=n(l.elapsedTime);s.current&&(s.current.intensity=c>=12?.35:.85),r.current&&(r.current.textContent=`${String(Math.floor(c)).padStart(2,"0")}:${String(Math.floor(c%1*60)).padStart(2,"0")} · ${c>=12?"lights off":"lights on"}`)}),i.jsxs(i.Fragment,{children:[i.jsx("ambientLight",{ref:s,intensity:.85}),i.jsxs("mesh",{rotation:[-Math.PI/2,0,0],position:[0,-.01,0],children:[i.jsx("planeGeometry",{args:[6.4,3.8]}),i.jsx("meshStandardMaterial",{color:"#8a7355"})]}),[[0,-1.9,6.4,.1],[0,1.9,6.4,.1],[-3.2,0,.1,3.8],[3.2,0,.1,3.8]].map(([l,c,f,d],u)=>i.jsxs("mesh",{position:[l,.4,c],children:[i.jsx("boxGeometry",{args:[f,.8,d]}),i.jsx("meshStandardMaterial",{color:"#9fb3b1",transparent:!0,opacity:.25})]},u)),i.jsxs("mesh",{position:[-2.6,.15,-1.2],children:[i.jsx("boxGeometry",{args:[.7,.3,.5]}),i.jsx("meshStandardMaterial",{color:"#a0522d"})]}),i.jsxs("mesh",{position:[2.6,.35,-1.2],children:[i.jsx("cylinderGeometry",{args:[.15,.15,.7,12]}),i.jsx("meshStandardMaterial",{color:"#6db3ff",transparent:!0,opacity:.7})]}),i.jsxs("mesh",{position:[0,.1,1.3],children:[i.jsx("torusGeometry",{args:[.6,.15,8,20]}),i.jsx("meshStandardMaterial",{color:"#c9b98a"})]}),i.jsx($,{position:[0,1.6,-1.8],center:!0,children:i.jsx("div",{ref:r,style:{font:"500 12px 'IBM Plex Mono', monospace",padding:"2px 8px",background:"rgba(10,20,19,0.85)",color:"#e3efed",borderRadius:4,whiteSpace:"nowrap"},children:"00:00"})}),i.jsx(B,{bundle:a,day:t,pose:le(a,t,n,0),color:"#e8a855",label:"Treated"}),i.jsx(B,{bundle:e,day:t,pose:le(e,t,n,7),color:"#78c679",label:"Untreated twin"})]})}function We(){const a=ue(e=>e.gl);return m.useEffect(()=>{const e=requestAnimationFrame(()=>{a.domElement.style.touchAction="pan-y"});return()=>cancelAnimationFrame(e)},[a]),null}function Xe({mode:a,treated:e,untreated:t,day:o,hoursPerSec:n}){return i.jsxs(ye,{onCreated:Se,camera:{position:[0,6.5,6.5],fov:40},dpr:[1,2],gl:{antialias:!0,alpha:!0},style:{touchAction:"pan-y"},children:[i.jsx("ambientLight",{intensity:.8}),i.jsx("directionalLight",{position:[3,8,4],intensity:.9}),a==="open"&&i.jsx(Ge,{t:e,u:t,day:o}),a==="maze"&&i.jsx(Ie,{t:e,u:t,day:o}),a==="home"&&i.jsx(He,{t:e,u:t,day:o,hoursPerSec:n}),i.jsx(We,{}),i.jsx(be,{enableZoom:!1,makeDefault:!0,enabled:a!=="open",enableDamping:!0,target:[0,0,0],minDistance:3,maxDistance:16,maxPolarAngle:Math.PI*.49})]},a)}export{Xe as A,Ge as O};
//# sourceMappingURL=ArenaScene-l0BW1dRM.js.map
