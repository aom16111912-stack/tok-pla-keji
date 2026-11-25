let ws,game=null,tab="likes",demoN=0;
const $=id=>document.getElementById(id);
function connect(){ws=new WebSocket(`${location.protocol==="https:"?"wss":"ws"}://${location.host}`);ws.onopen=()=>$("live").textContent="● เกมออนไลน์";ws.onclose=()=>{$("live").textContent="● กำลังเชื่อมใหม่";setTimeout(connect,1800)};ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.type==="state"){game=m.state;render()}}}
const labels={worm:"🪱 หนอน",shrimp:"🦐 กุ้ง",squid:"🦑 ปลาหมึก",gold:"🥇 ทอง",diamond:"💎 เพชร",dragon:"🐉 มังกร",emperor:"👑 จักรพรรดิ"};
function safe(x){return String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function pic(p,cls="avatar"){return `<div class="${cls}">${p.avatar?`<img src="${safe(p.avatar)}" referrerpolicy="no-referrer" onerror="this.remove()">`:"🎣"}</div>`}
function render(){if(!game)return;const ps=game.players;$("player-count").textContent=`${ps.length} นักตกปลา`;
$("avatars").innerHTML=ps.length?ps.slice(0,8).map((p,i)=>`<div class="angler"><div class="rod"></div>${pic(p)}<div class="seat">🪑</div><div class="name">${safe(p.name)}</div></div>`).join(""):`<div class="empty-pond">ผู้ชมเข้ามาในไลฟ์แล้วจะมานั่งตกปลาที่นี่ 🪑</div>`;
$("players").innerHTML=ps.length?ps.map(p=>`<article class="player"><div class="player-top">${pic(p,"player-pic")}<div><div class="player-name">${safe(p.name)}</div><div class="player-stats">❤️ ${p.likes} · ⭐ ${p.score} คะแนน · 🐟 ${p.species.length} ชนิด · ⚖️ ${p.biggest? p.biggest.toFixed(2)+" กก.":"—"}</div></div></div><div class="baits">${Object.entries(p.bait).map(([k,v])=>`<button class="cast" data-id="${safe(p.id)}" data-bait="${k}" ${v? "":"disabled"}>${labels[k]} ×${v}</button>`).join("")}</div><div class="player-stats">ปลาล่าสุด: ${(p.fish||[]).slice(0,2).map(f=>`${f.name} ${f.weight} กก.`).join(" · ")||"ยังไม่ได้ตกปลา"}</div></article>`).join(""):'<p class="muted">ยังไม่มีผู้เล่น — รอผู้ชมเข้ามาในไลฟ์</p>';
const rows=game.rankings[tab]||[];$("rank-list").innerHTML=Array.from({length:8},(_,i)=>rows[i]?`<li><b>${safe(rows[i].name)}</b><span>${safe(rows[i].value)}</span></li>`:`<li class="muted">รอผู้เล่น</li>`).join("");
$("feed").innerHTML=game.feed.length?game.feed.map(f=>`<div class="feed-item ${f.rare?"rare":""}"><time>${safe(f.time)}</time><b>${safe(f.title)}</b> ${safe(f.detail)}</div>`).join(""):"รอเหตุการณ์จากไลฟ์…";
}
$("players").addEventListener("click",e=>{const b=e.target.closest("button[data-bait]");if(b&&ws.readyState===1)ws.send(JSON.stringify({type:"cast",id:b.dataset.id,bait:b.dataset.bait}))});
document.querySelectorAll(".tab").forEach(b=>b.onclick=()=>{tab=b.dataset.tab;document.querySelectorAll(".tab").forEach(x=>x.classList.toggle("active",x===b));render()});
$("reset").onclick=()=>{if(confirm("ล้างผู้เล่นและคะแนนทั้งหมดเพื่อเริ่มรอบใหม่?"))ws.send(JSON.stringify({type:"reset"}))};
$("demo").onclick=()=>{demoN++;ws.send(JSON.stringify({type:"demo",n:demoN,name:"Keji_guest_"+demoN}))};
connect();
