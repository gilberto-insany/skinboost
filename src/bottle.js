import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
export function initBottle(){
const container=document.querySelector('#bottle-canvas');
let renderer;
try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'low-power'});}catch{return;}
renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;container.appendChild(renderer.domElement);document.querySelector('#bottle-fallback').hidden=true;
const scene=new THREE.Scene();const camera=new THREE.PerspectiveCamera(31,1,.1,100);camera.position.set(0,0,11.3);
const pmrem=new THREE.PMREMGenerator(renderer);const room=new RoomEnvironment();const env=pmrem.fromScene(room,.04);scene.environment=env.texture;room.dispose();pmrem.dispose();
scene.add(new THREE.HemisphereLight(0xf0f5df,0x26331d,2.2));const area=new THREE.DirectionalLight(0xfffae9,4);area.position.set(-3,4,5);scene.add(area);const rim=new THREE.DirectionalLight(0xd8edbd,3);rim.position.set(4,1,-2);scene.add(rim);
const bodyTexture=document.createElement('canvas');bodyTexture.width=2048;bodyTexture.height=2048;const ctx=bodyTexture.getContext('2d');ctx.fillStyle='#ecebdc';ctx.fillRect(0,0,2048,2048);ctx.textAlign='center';ctx.fillStyle='#263527';ctx.font='500 128px Arial';ctx.fillText('skinboost',1024,700);ctx.fillStyle='#9daf4e';ctx.fillRect(949,825,150,9);ctx.fillStyle='#29372b';ctx.font='55px Arial';ctx.fillText('Balance',1024,1010);ctx.font='22px Arial';ctx.fillText('CIÊNCIA SENSÍVEL',1024,1110);ctx.fillText('CUIDADO PESSOAL',1024,1154);ctx.font='38px Arial';ctx.fillText('30 ml',1024,1640);
const texture=new THREE.CanvasTexture(bodyTexture);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=renderer.capabilities.getMaxAnisotropy();
const bodyMat=new THREE.MeshStandardMaterial({map:texture,roughness:.42,metalness:.05});const ivory=new THREE.MeshStandardMaterial({color:0xeaeadd,roughness:.33,metalness:.1});const sage=new THREE.MeshStandardMaterial({color:0x8d9b72,roughness:.25,metalness:.18});const greenGlass=new THREE.MeshPhysicalMaterial({color:0xb8c4a1,metalness:.05,roughness:.09,transmission:.6,thickness:.12,ior:1.45,transparent:true,opacity:.6,clearcoat:1});const metal=new THREE.MeshStandardMaterial({color:0xc4c9b5,metalness:.85,roughness:.18});const lime=new THREE.MeshStandardMaterial({color:0xbbce6c,metalness:.35,roughness:.22});
const bottle=new THREE.Group();scene.add(bottle);
function cyl(rt,rb,h,y,mat,seg=96){const mesh=new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,seg,1,false),mat);mesh.position.y=y;bottle.add(mesh);return mesh;}
// Geometry is a real editable WebGL product model, not a flat CSS illustration.
const body=cyl(.63,.63,2.7,-.35,bodyMat);body.rotation.y=Math.PI;
cyl(.62,.59,.12,-1.755,ivory);cyl(.627,.627,.045,-1.65,lime);cyl(.625,.625,.035,-1.7,metal);
cyl(.61,.63,.12,1.06,ivory);cyl(.58,.61,.16,1.18,sage);cyl(.5,.54,.2,1.32,sage);cyl(.22,.24,.22,1.51,sage);cyl(.34,.34,.16,1.7,sage);
const nozzle=new THREE.Mesh(new THREE.BoxGeometry(.5,.12,.3),sage);nozzle.position.set(.15,1.7,.02);bottle.add(nozzle);const outlet=new THREE.Mesh(new THREE.BoxGeometry(.013,.048,.11),new THREE.MeshStandardMaterial({color:0x34402c,roughness:.6}));outlet.position.set(.402,1.7,.02);bottle.add(outlet);
const cap=cyl(.647,.647,1.01,1.625,greenGlass);cyl(.65,.65,.028,2.143,metal);cyl(.65,.65,.025,1.11,metal);
bottle.rotation.z=-.35;bottle.rotation.y=-.15;bottle.position.set(.55,-.05,0);
let progress=0,visible=true;function render(){if(visible)renderer.render(scene,camera);}function update(){const mobile=innerWidth<701;const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;const p=reduce?.45:progress;bottle.rotation.z=-.36+p*.5;bottle.rotation.y=-.2+p*.9;bottle.rotation.x=.08*Math.sin(p*Math.PI);bottle.position.x=mobile?.15:.45+p*.25;bottle.position.y=mobile?.38:-.13;const scale=mobile?.48:1.02;bottle.scale.setScalar(scale);cap.position.y=1.625+Math.max(0,p-.5)*1.1;render();}
function resize(){const w=container.clientWidth,h=container.clientHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.position.z=innerWidth<701?10.3:10.5;camera.updateProjectionMatrix();update();}const resizeObserver=new ResizeObserver(resize);resizeObserver.observe(container);resize();
const visibilityObserver=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(visible)render();});visibilityObserver.observe(container);
const scroll=ScrollTrigger.create({trigger:'.product-story',start:'top top',end:'bottom bottom',onUpdate:self=>{progress=self.progress;update();}});
container.addEventListener('webglcontextlost',()=>{document.querySelector('#bottle-fallback').hidden=false;},{once:true});
window.addEventListener('pagehide',()=>{resizeObserver.disconnect();visibilityObserver.disconnect();scroll.kill();scene.traverse(obj=>{obj.geometry?.dispose();if(obj.material){const mats=Array.isArray(obj.material)?obj.material:[obj.material];mats.forEach(m=>m.dispose());}});texture.dispose();env.dispose();renderer.dispose();},{once:true});
}
