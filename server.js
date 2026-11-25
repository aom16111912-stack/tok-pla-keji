import express from "express";
import http from "node:http";
import {WebSocketServer,WebSocket} from "ws";
import path from "node:path";
import {fileURLToPath} from "node:url";

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const app=express(), server=http.createServer(app), wss=new WebSocketServer({server});
app.use(express.static(path.join(__dirname,"public")));
app.get("/health",(req,res)=>res.json({ok:true,game:"ตกปลามหาสนุก by Keji"}));

const clients=new Set(), players=new Map(), feed=[];
const baitLabels={worm:"หนอน",shrimp:"กุ้ง",squid:"ปลาหมึก",gold:"เหยื่อทอง",diamond:"เหยื่อเพชร",dragon:"เหยื่อมังกร",emperor:"เหยื่อจักรพรรดิ"};
const odds={worm:[60,22,12,5,1],shrimp:[40,30,18,8,4],squid:[20,25,25,20,10],gold:[10,15,25,30,20],diamond:[5,10,20,35,30],dragon:[2,8,15,35,40],emperor:[1,4,10,30,55]};
const fish=[
 ["ปลานิล","Common",10,.5,3,"🐟"],["ปลาตะเพียน","Common",15,.2,1.5,"🐠"],["ปลาดุก","Common",20,.3,5,"🐡"],
 ["ปลาช่อน","Uncommon",30,1,8,"🐟"],["ปลาสวาย","Uncommon",35,1,10,"🐠"],["ปลากราย","Uncommon",40,2,12,"🐟"],
 ["ปลาทองหางยาว","Rare",60,.1,1,"🐠"],["ปลาคาร์ป","Rare",70,1,15,"🎏"],["ปลามุก","Rare",80,.2,2,"🫧"],
 ["ปลาทองคำ","Epic",120,1,5,"✨"],["ปลาคริสตัล","Epic",150,1,8,"💎"],["ปลาสายรุ้ง","Epic",180,1,10,"🌈"],
 ["ปลามังกรฟ้า","Legendary",300,10,80,"🐉"],["ปลามังกรทอง","Legendary",500,10,100,"🐲"],["ปลาจักรพรรดิ","Legendary",1000,20,200,"👑"]
].map(([name,rarity,points,min,max,emoji])=>({name,rarity,points,min,max,emoji}));
function pushFeed(title,detail,rare=false){feed.unshift({title,detail,rare,time:new Date().toLocaleTimeString("th-TH",{hour:"2-digit",minute:"2-digit",second:"2-digit"})});feed.splice(15);}
function getPlayer({id,name,avatar}){
 const key=String(id||name||"guest").slice(0,100);
 if(!players.has(key)) players.set(key,{id:key,name:String(name||"นักตกปลา").slice(0,32),avatar:avatar||"",likes:0,likeRemainder:0,bait:{worm:0,shrimp:0,squid:0,gold:0,diamond:0,dragon:0,emperor:0},fish:[],species:[],score:0,biggest:0,biggestFish:"",joined:Date.now()});
 const p=players.get(key); if(name)p.name=String(name).slice(0,32); if(avatar)p.avatar=String(avatar).slice(0,500); return p;
}
function grant(p,bait,n=1){p.bait[bait]=(p.bait[bait]||0)+n;pushFeed("🎁 ได้เหยื่อ",`${p.name} ได้${baitLabels[bait]} ×${n}`);}
function roll(bait){const a=odds[bait]||odds.worm;let x=Math.random()*a.reduce((s,v)=>s+v,0);for(let i=0;i<a.length;i++){x-=a[i];if(x<0)return ["Common","Uncommon","Rare","Epic","Legendary"][i];}return "Common";}
function catchFish(p,bait){const rarity=roll(bait),pool=fish.filter(f=>f.rarity===rarity),f=pool[Math.floor(Math.random()*pool.length)],weight=Math.round((f.min+Math.random()*(f.max-f.min))*100)/100;
 p.fish.unshift({...f,weight,at:Date.now()});p.score+=f.points;if(!p.species.includes(f.name))p.species.push(f.name);if(weight>p.biggest){p.biggest=weight;p.biggestFish=f.name;}
 pushFeed(rarity==="Legendary"?"🌟 ปลาตำนานปรากฏ!":"🎣 ตกปลาได้",`${p.name} ได้${f.name} ${weight.toFixed(2)} กก.`,rarity==="Legendary");
}
function top(sort,fmt){return [...players.values()].sort(sort).slice(0,8).map((p,i)=>({rank:i+1,name:p.name,value:fmt(p)}));}
function snapshot(){const all=[...players.values()];return {players:all.map(p=>({...p,fish:p.fish.slice(0,5)})),rankings:{
 likes:top((a,b)=>b.likes-a.likes,p=>`${p.likes.toLocaleString()} ใจ`),
 species:top((a,b)=>b.species.length-a.species.length,p=>`${p.species.length} ชนิด`),
 weight:top((a,b)=>b.biggest-a.biggest,p=>p.biggest?`${p.biggest.toFixed(2)} กก. · ${p.biggestFish}`:"—")
},feed,counts:{players:all.length,likes:all.reduce((s,p)=>s+p.likes,0)}};}
function broadcast(){const msg=JSON.stringify({type:"state",state:snapshot()});for(const c of clients)if(c.readyState===WebSocket.OPEN)c.send(msg);}
function event(data){
 const type=String(data.type||"").toLowerCase(),p=getPlayer(data);
 if(type==="join"){pushFeed("👋 นักตกปลามาใหม่",`${p.name} เข้าร่วมบ่อ`);}
 else if(type==="like"){const n=Math.max(1,Math.floor(Number(data.count)||1));p.likes+=n;p.likeRemainder+=n;const bait=Math.floor(p.likeRemainder/60);p.likeRemainder%=60;if(bait)grant(p,"worm",bait);pushFeed("❤️ ได้รับไลก์",`${p.name} +${n} ใจ`);}
 else if(type==="gift"){const diamonds=Number(data.diamonds)||0;let bait="shrimp";if(diamonds>=1000)bait="emperor";else if(diamonds>=500)bait="dragon";else if(diamonds>=100)bait="diamond";else if(diamonds>=21)bait="gold";else if(diamonds>=6)bait="squid";grant(p,bait,Math.max(1,Math.floor(Number(data.count)||1)));pushFeed("🎁 ส่งของขวัญ",`${p.name} · ${data.giftName||"ของขวัญ"}`);}
 else if(type==="follow"||type==="share"){pushFeed(type==="follow"?"➕ ติดตาม":"🔁 แชร์",p.name);}
 broadcast();
}
function send(ws,obj){if(ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify(obj));}
wss.on("connection",ws=>{clients.add(ws);send(ws,{type:"state",state:snapshot()});ws.on("message",raw=>{let m;try{m=JSON.parse(raw)}catch{return}
 if(m.type==="event"){event(m.data||{});send(ws,{type:"ack",ok:true});}
 if(m.type==="cast"){const p=players.get(String(m.id));if(!p||!p.bait[m.bait])return;p.bait[m.bait]--;catchFish(p,m.bait);broadcast();}
 if(m.type==="reset"){players.clear();feed.length=0;pushFeed("🔄 เริ่มไลฟ์รอบใหม่","ล้างคะแนนและผู้เล่นแล้ว");broadcast();}
 if(m.type==="demo"){event({type:"join",id:"demo-"+m.n,name:m.name||"Keji_guest_"+m.n,avatar:""});const p=players.get("demo-"+m.n);grant(p,"worm",2);grant(p,"shrimp",1);broadcast();}
 });ws.on("close",()=>clients.delete(ws));});
const PORT=process.env.PORT||3000;server.listen(PORT,"0.0.0.0",()=>console.log(`Keji game listening on ${PORT}`));
