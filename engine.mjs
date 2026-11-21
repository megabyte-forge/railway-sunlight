// Browser implementation of route_engine.py. All wall-clock values use KST,
// represented by UTC fields so the viewer's computer timezone has no effect.
export const LABELS={left:'왼쪽',right:'오른쪽',front:'정면',back:'후면',night:'해 없음'};
export const COLORS={left:'#e89b27',right:'#2587cd',front:'#b05ac3',back:'#5b9e76',night:'#64748b'};
const rad=x=>x*Math.PI/180,deg=x=>x*180/Math.PI,mod=(a,b)=>(a%b+b)%b;
export function normalizeDate(input){
  let s=String(input).trim();
  if(/^\d{8}$/.test(s))s=`${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6)}`;
  const m=s.match(/^(\d{4})\s*[-./]\s*(\d{1,2})\s*[-./]\s*(\d{1,2})$/);
  if(!m)throw Error('날짜를 YYYYMMDD 또는 YYYY-MM-DD로 입력하세요.');
  const [y,mo,d]=m.slice(1).map(Number),date=new Date(0);
  date.setUTCFullYear(y,mo-1,d);date.setUTCHours(0,0,0,0);
  if(y<1||y>9999||date.getUTCFullYear()!==y||date.getUTCMonth()!==mo-1||date.getUTCDate()!==d)throw Error('존재하지 않는 날짜입니다.');
  return `${String(y).padStart(4,'0')}-${String(mo).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
}
export function today(){return new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul'}).format(new Date());}
export function dayStart(day){return new Date(normalizeDate(day)+'T00:00:00Z').getTime();}
export function operates(service,day){const n=new Date(dayStart(day)).getUTCDay(),rule=service.days.replace(/\s/g,'');return rule==='매일'||(/^[월화수목금토일]+$/.test(rule)&&rule.includes('일월화수목금토'[n]));}
function roundEven(n){let f=Math.floor(n),r=n-f;return r===.5?f+(f%2):Math.round(n);}
export function clockText(minute,seconds=false){let units=Math.max(0,roundEven(minute*(seconds?60:1))),day=Math.floor(units/(seconds?86400:1440));units%=seconds?86400:1440;const h=Math.floor(units/(seconds?3600:60)),m=Math.floor(units/(seconds?60:1))%60;return (day?`+${day}일 `:'')+[h,m,...(seconds?[units%60]:[])].map(n=>String(n).padStart(2,'0')).join(':');}
export function distance(a,b){const p=rad(a.lat),q=rad(b.lat),dl=rad(b.lon-a.lon),dp=q-p;const h=Math.sin(dp/2)**2+Math.cos(p)*Math.cos(q)*Math.sin(dl/2)**2;return 12742.0176*Math.asin(Math.sqrt(Math.min(1,Math.max(0,h))));}
export function bearing(a,b){const p=rad(a.lat),q=rad(b.lat),dl=rad(b.lon-a.lon);return mod(deg(Math.atan2(Math.sin(dl)*Math.cos(q),Math.cos(p)*Math.sin(q)-Math.sin(p)*Math.cos(q)*Math.cos(dl))),360);}
export function compass(a){return ['북','북동','동','남동','남','남서','서','북서'][Math.floor((mod(a,360)+22.5)/45)%8];}
export function sunAt(day,minute,lat,lon,heading,shaded=false){
  const moment=new Date(dayStart(day)+Math.floor(Math.round(minute*60*1e6)/1e6)*1000),y=moment.getUTCFullYear();
  if(y>9999||y<1)throw Error('계산 날짜가 지원 범위를 벗어났습니다.');
  const h=moment.getUTCHours()+moment.getUTCMinutes()/60+moment.getUTCSeconds()/3600;
  const jan=new Date(0);jan.setUTCFullYear(y,0,1);jan.setUTCHours(0,0,0,0);
  const ordinal=Math.floor((moment.getTime()-jan.getTime())/86400000),leap=y%4===0&&(y%100!==0||y%400===0);
  const g=2*Math.PI/(leap?366:365)*(ordinal+(h-12)/24),c=Math.cos,s=Math.sin;
  const eq=229.18*(.000075+.001868*c(g)-.032077*s(g)-.014615*c(2*g)-.040849*s(2*g));
  const dec=.006918-.399912*c(g)+.070257*s(g)-.006758*c(2*g)+.000907*s(2*g)-.002697*c(3*g)+.00148*s(3*g);
  const ha=rad((h*60+eq+4*lon-540)/4-180),p=rad(lat),east=-c(dec)*s(ha),north=c(p)*s(dec)-s(p)*c(dec)*c(ha),up=s(p)*s(dec)+c(p)*c(dec)*c(ha);
  const altitude=deg(Math.asin(Math.max(-1,Math.min(1,up)))),azimuth=mod(deg(Math.atan2(east,north)),360),relative=mod(azimuth-heading+180,360)-180;
  let state=shaded||altitude<=0?'night':Math.abs(relative)<=10?'front':Math.abs(relative)>=170?'back':relative>0?'right':'left';
  return {state,azimuth,altitude,relative,compass:shaded?'':compass(azimuth)};
}
export function segmentsFor(points){
  if(points.length<2||points.length>600)throw Error('경로 지점은 2~600개여야 합니다.');
  for(const p of points)if(!Number.isFinite(p.lat)||!Number.isFinite(p.lon)||Math.abs(p.lat)>85||Math.abs(p.lon)>180)throw Error('역 위경도를 확인하세요.');
  return points.slice(1).map((b,i)=>{const a=points[i],km=distance(a,b),names=[a.name,b.name].sort().join('|');if(km<.001)throw Error('서로 겹치는 경로 지점이 있습니다.');return {index:i,name:`${a.name} → ${b.name}`,a,b,km,bearing:bearing(a,b),lat:(a.lat+b.lat)/2,lon:(a.lon+b.lon)/2,tunnel:names===['수서','동탄'].sort().join('|')||names===['동탄','평택지제'].sort().join('|')};});
}
export function serviceRoute(data,s){return data.routes[s.route].map(name=>({name,...data.stations[name]}));}
function append(rows,start,end,sample,index){const key=sample.state+'|'+(sample.state==='night'?'':sample.compass),last=rows.at(-1);if(last&&last.segment===index&&last.key===key){last.end=end;last.azimuth_end=sample.azimuth;last.altitude_min=Math.min(last.altitude_min,sample.altitude);last.altitude_max=Math.max(last.altitude_max,sample.altitude);}else rows.push({segment:index,start,end,key,state:sample.state,compass:sample.state==='night'?'':sample.compass,azimuth_start:sample.azimuth,azimuth_end:sample.azimuth,altitude_min:sample.altitude,altitude_max:sample.altitude});}
export function dailyRows(segment,day,step=1,start=0,end=1440){const rows=[];for(let m=start;m<end;m+=step){const next=Math.min(end,m+step);append(rows,m,next,sunAt(day,(m+next)/2,segment.lat,segment.lon,segment.bearing,segment.tunnel),segment.index);}return rows;}
export function simulate({points,day,minutes=null,departure=540,speed=100,step=1}){
  day=normalizeDate(day);if(!Number.isInteger(step)||step<1||step>30)throw Error('계산 간격은 1~30분입니다.');
  const segments=segmentsFor(points);if(!minutes){if(!Number.isFinite(speed)||speed<1||speed>500||!Number.isFinite(departure)||departure<0)throw Error('출발 시각과 속도를 확인하세요.');minutes=[departure];for(const s of segments)minutes.push(minutes.at(-1)+s.km/speed*60);}
  if(minutes.length!==points.length||minutes.some((m,i)=>!Number.isFinite(m)||m<0||(i&&m<=minutes[i-1]))||minutes.at(-1)-minutes[0]>4320)throw Error('역별 시각 또는 주행 시간을 확인하세요.');
  const daily=[],journey=[],totals=Object.fromEntries(Object.keys(LABELS).map(k=>[k,0]));
  for(const s of segments){s.departure=minutes[s.index];s.arrival=minutes[s.index+1];daily.push(dailyRows(s,day,step));for(let m=s.departure;m<s.arrival-1e-9;){const end=Math.min(s.arrival,m+step),f=((m+end)/2-s.departure)/(s.arrival-s.departure),lat=s.a.lat+(s.b.lat-s.a.lat)*f,lon=s.a.lon+(s.b.lon-s.a.lon)*f,sample=sunAt(day,(m+end)/2,lat,lon,s.bearing,s.tunnel);append(journey,m,end,sample,s.index);totals[sample.state]+=end-m;m=end;}}
  return {day,segments,daily,journey,totals,departure:minutes[0],arrival:minutes.at(-1),step,km:segments.reduce((n,s)=>n+s.km,0)};
}
export function filteredServices(data,{day,line,direction,origins=null,destinations=null}){return data.services.filter(s=>s.line===line&&s.direction===direction&&operates(s,day)&&(origins===null||origins.has(s.stops[0][0]))&&(destinations===null||destinations.has(s.stops.at(-1)[0]))).sort((a,b)=>a.minutes[0]-b.minutes[0]);}
export function bounds(result){const start=Math.floor(result.departure/60)*60;return [start,start+(result.arrival>start+240?300:240)];}
export function geoFit(refs,mercator=false){
  if(refs.length!==3)throw Error('넓은 삼각형으로 기준점 3개를 지정하세요.');
  const [a,b,c]=refs,dx1=b.x-a.x,dy1=b.y-a.y,dx2=c.x-a.x,dy2=c.y-a.y,det=dx1*dy2-dx2*dy1;
  if(Math.abs(det)<Math.max(1,Math.hypot(dx1,dy1)*Math.hypot(dx2,dy2)*.01))throw Error('기준점들이 너무 가깝거나 일직선입니다.');
  const solve=values=>{const v1=values[1]-values[0],v2=values[2]-values[0],x=(v1*dy2-v2*dy1)/det,y=(dx1*v2-dx2*v1)/det;return [x,y,values[0]-x*a.x-y*a.y];};
  const lon=solve(refs.map(r=>r.lon)),north=solve(refs.map(r=>mercator?deg(Math.asinh(Math.tan(rad(r.lat)))):r.lat));
  if(Math.abs(lon[0]*north[1]-lon[1]*north[0])<1e-12)throw Error('위경도 기준점으로 지도 방향을 결정할 수 없습니다.');
  return {lon,north,mercator};
}
export function toGeo(geo,x,y){const lon=geo.lon[0]*x+geo.lon[1]*y+geo.lon[2],n=geo.north[0]*x+geo.north[1]*y+geo.north[2],lat=geo.mercator?deg(Math.atan(Math.sinh(rad(n)))):n;if(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>85||Math.abs(lon)>180)throw Error('보정된 위경도가 범위를 벗어났습니다.');return {lat,lon};}
