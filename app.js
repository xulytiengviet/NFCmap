/* GeoContext NFC × GPS Lab — standalone demonstration (MIT-friendly sample code).
 * Web NFC exchanges NDEF only. No cryptographic authentication or hardware unlocking.
 * Geolocation is opt-in. Coordinates and events stay in memory unless exported.
 */
'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const presetTags = {
    museum: { id: 'TAG-INFO-01', name: 'Trạm thông tin du lịch · Demo', lat: 10.77689, lon: 106.70087 },
    park: { id: 'TAG-PARK-02', name: 'Trạm khám phá đô thị · Demo', lat: 10.78091, lon: 106.70417 },
    checkpoint: { id: 'TAG-HUNT-03', name: 'Điểm săn kho báu · Demo', lat: 10.77342, lon: 106.69546 },
    gate: { id: 'TAG-GATE-01', name: 'Cửa kiểm soát · Demo', lat: 10.77945, lon: 106.69873 }
  };
  const gateTag = {...presetTags.gate};
  const state = {
    scenario: 'geotag', tag: {...presetTags.museum}, anchor: {...presetTags.museum},
    gpsLive: false, gpsWatchId: null, userPos: null, gpsAccuracy: null,
    rawPos: null, corrected: false, correctionPos: null,
    gate: {...gateTag}, lastRead: null, log: [],
    nfcReader: null, scanController: null, leaflet: null, mapLayers: [], mapTilesLoaded: false
  };
  const clamp = (v,a,b) => Math.min(Math.max(v,a),b);
  const number = n => Number.isFinite(n) ? Number(n).toFixed(6) : '—';
  const str = value => String(value ?? '');
  const escapeHtml = value => str(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const validCoords = (lat, lon) => Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat)<=90 && Math.abs(lon)<=180;
  const toRad = v => v * Math.PI / 180;
  const distanceMeters = (a,b) => {
    if (!a || !b || !validCoords(a.lat,a.lon) || !validCoords(b.lat,b.lon)) return NaN;
    const dLat=toRad(b.lat-a.lat),dLon=toRad(b.lon-a.lon), la1=toRad(a.lat),la2=toRad(b.lat);
    const h=Math.sin(dLat/2)**2 + Math.cos(la1)*Math.cos(la2)*Math.sin(dLon/2)**2;
    return 6371000 * 2*Math.atan2(Math.sqrt(h),Math.sqrt(Math.max(0,1-h)));
  };
  const positionAt = (p, meters, bearingDeg=65) => {
    // Spherical direct geodesic: accurate enough for small distances in this demo.
    const bearing=toRad(bearingDeg),delta=meters/6371000,lat1=toRad(p.lat),lon1=toRad(p.lon);
    const lat2=Math.asin(Math.sin(lat1)*Math.cos(delta)+Math.cos(lat1)*Math.sin(delta)*Math.cos(bearing));
    const lon2=lon1+Math.atan2(Math.sin(bearing)*Math.sin(delta)*Math.cos(lat1),Math.cos(delta)-Math.sin(lat1)*Math.sin(lat2));
    return {lat:lat2*180/Math.PI,lon:lon2*180/Math.PI};
  };
  const notify = text => {
    $('toast').textContent=text;
    $('toast').classList.add('visible');
    clearTimeout(notify.timer);
    notify.timer=setTimeout(()=>$('toast').classList.remove('visible'),3600);
  };
  const log = (kind,message) => {
    const entry={time:new Date().toISOString(),kind,message};state.log.unshift(entry);state.log.length=Math.min(state.log.length,120);
    renderEvents();
  };
  const renderEvents = () => {
    $('events').replaceChildren();
    if (!state.log.length) { const p=document.createElement('p');p.className='panel-help';p.textContent='Chưa có sự kiện.';$('events').append(p);return; }
    for (const evt of state.log.slice(0,24)) {
      const item=document.createElement('div');item.className='event '+(evt.kind==='WARN'?'warn':evt.kind==='DENY'?'error':'');
      const time=document.createElement('time');time.dateTime=evt.time;time.textContent=new Date(evt.time).toLocaleTimeString('vi-VN',{hour12:false});
      const code=document.createElement('span');code.className='event-code';code.textContent=evt.kind;
      const desc=document.createElement('p');desc.textContent=evt.message;
      item.append(time,code,desc);$('events').append(item);
    }
  };
  const getTarget = () => state.scenario==='access'?state.gate:state.tag;
  const devicePos = () => {
    if (state.gpsLive && state.userPos) return state.userPos;
    if (state.scenario==='access') return positionAt(state.gate,Number($('distanceRange').value),56);
    if (state.scenario==='anchor') return state.rawPos || positionAt(state.tag,Number($('noiseRange').value),52);
    return positionAt(state.tag,62,72);
  };
  const payload = () => ({version:1,kind:'nfc-geo',id:state.tag.id,name:state.tag.name,lat:state.tag.lat,lon:state.tag.lon});
  const refreshPayload = () => {
    $('ndefPreview').textContent=JSON.stringify(payload(),null,2);
    $('anchorCoords').textContent=`${number(state.tag.lat)}, ${number(state.tag.lon)}`;
  };
  const syncTagFields = () => {
    $('tagLabel').value=state.tag.name;$('tagLat').value=state.tag.lat;$('tagLon').value=state.tag.lon;
    refreshPayload();
  };
  const setTag = (tag) => {
    if (!tag || !validCoords(tag.lat,tag.lon)) return false;
    state.tag={id:str(tag.id||'TAG-CUSTOM-01').slice(0,80),name:str(tag.name||'Thẻ NFC tùy chỉnh').slice(0,80),lat:tag.lat,lon:tag.lon};
    state.anchor={...state.tag};state.corrected=false;state.correctionPos=null;
    state.rawPos=positionAt(state.tag,Number($('noiseRange').value),52);
    syncTagFields();render();return true;
  };
  const updatePositionSource = () => {
    const p=devicePos();$('devicePosition').textContent=`${number(p.lat)}, ${number(p.lon)}`;
    $('positionSource').textContent=state.gpsLive?`VỊ TRÍ TRÌNH DUYỆT · ±${Math.round(state.gpsAccuracy??0)} m`:'VỊ TRÍ GIẢ LẬP';
    const d=distanceMeters(getTarget(),p);$('currentDistance').textContent=Number.isFinite(d)?`${d.toFixed(1)} m`:'— m';
    $('readerStatus').textContent=state.scanController?'ĐANG CHỜ THẺ NFC':(state.lastRead?.source==='real'?'ĐÃ ĐỌC THẺ THẬT':'CHẾ ĐỘ MÔ PHỎNG');
    $('readerDetails').textContent=state.lastRead?`${state.lastRead.id} · ${state.lastRead.source==='real'?'thiết bị':'giả lập'}`:'Chưa quét phần cứng';
  };
  const markerIcon = className => L.divIcon({html:`<span class="point-marker ${className}"></span>`,className:'',iconSize:[25,25],iconAnchor:[12,12]});
  const createLeaflet = () => {
    if (typeof L==='undefined') {
      $('map').style.display='none'; log('WARN','Không nạp được Leaflet; chuyển sang sơ đồ vị trí dự phòng.');
      return;
    }
    try {
      const map=L.map('map',{zoomControl:true,scrollWheelZoom:true,attributionControl:true}).setView([state.tag.lat,state.tag.lon],16);
      state.leaflet=map;
      const tileLayer=L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
        maxZoom:19,attribution:'© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors'
      });
      tileLayer.on('tileload',()=>{
        if (!state.mapTilesLoaded) {state.mapTilesLoaded=true;$('fallbackMap').hidden=true;}
      });
      tileLayer.on('tileerror',()=>{if(!state.mapTilesLoaded)$('fallbackMap').hidden=false;});
      tileLayer.addTo(map);setTimeout(()=>map.invalidateSize(),150);
    } catch(e) {state.leaflet=null;$('map').style.display='none';log('WARN','Bản đồ nền không khởi tạo được: '+e.message);}
  };
  const updateFallback = (points,center) => {
    const layer=$('fallbackMarkers');layer.replaceChildren();
    // Relative schematic only: do not construe as real geographic basemap.
    for(const p of points){
      const dx=(p.pos.lon-center.lon)*16000,dy=(center.lat-p.pos.lat)*16000;
      const e=document.createElement('span');e.className='fallback-point '+(p.className||'');
      e.style.left=`${clamp(50+dx,5,95)}%`;e.style.top=`${clamp(50+dy,6,94)}%`;
      e.dataset.label=p.name;layer.append(e);
    }
  };
  const renderMap = () => {
    const target=getTarget(), current=devicePos(), points=[];
    const add=(pos,name,className)=>{if(validCoords(pos.lat,pos.lon)) points.push({pos,name,className});};
    add(target,state.scenario==='access'?'Điểm kiểm soát':(state.scenario==='anchor'?'Mốc NFC':'Thẻ GeoTag'),'target');
    if(state.scenario==='anchor'){
      add(current,'GPS đo được','raw');
      if(state.corrected&&state.correctionPos)add(state.correctionPos,'Ước lượng theo NFC','corrected');
    } else add(current,'Thiết bị','device');
    const activeCenter=target;
    updateFallback(points,activeCenter);
    const map=state.leaflet;
    if(map){
      state.mapLayers.forEach(l=>map.removeLayer(l));state.mapLayers=[];
      for(const p of points){
        const isTarget=p.className==='target';
        const marker=L.marker([p.pos.lat,p.pos.lon],{icon:markerIcon(isTarget?'':p.className)}).bindPopup(`<b>${escapeHtml(p.name)}</b><br>${number(p.pos.lat)}, ${number(p.pos.lon)}`);
        marker.addTo(map);state.mapLayers.push(marker);
      }
      if(state.scenario==='access'){
        const circle=L.circle([target.lat,target.lon],{radius:Number($('radiusRange').value),color:'#9ef7c0',fillColor:'#77d9a8',fillOpacity:.12,weight:2,dashArray:'5 6'}).addTo(map);
        state.mapLayers.push(circle);
      }
      if(state.scenario==='anchor'){
        const line=L.polyline([[target.lat,target.lon],[current.lat,current.lon]],{color:'#ffba72',dashArray:'7 8',weight:2,opacity:.9}).addTo(map);state.mapLayers.push(line);
      }
      // Keep focus on the selected asset. User can pan/zoom freely until next update.
      map.setView([target.lat,target.lon],state.scenario==='access'?16:16,{animate:false});
    }
    $('osmLink').href=`https://www.openstreetmap.org/?mlat=${target.lat}&mlon=${target.lon}#map=17/${target.lat}/${target.lon}`;
    $('mapMode').textContent={geotag:'GEO TAG ACTIVE',anchor:'POSITION ANCHOR',access:'GEO ACCESS ZONE'}[state.scenario];
  };
  const render = () => {refreshPayload();updatePositionSource();renderMap();};
  const showScenario = scenario => {
    if(!['geotag','anchor','access'].includes(scenario))return;
    state.scenario=scenario;
    for(const name of ['geotag','anchor','access']){
      const selected=name===scenario;
      $('tab-'+name).classList.toggle('active',selected);
      $('tab-'+name).setAttribute('aria-selected',String(selected));
      $('tab-'+name).tabIndex=selected?0:-1;$('panel-'+name).hidden=!selected;
    }
    if (scenario==='anchor') updateAnchorStats();
    render(); log('MODE',`Chuyển sang mô hình ${ {geotag:'NFC GeoTag',anchor:'NFC Position Anchor',access:'NFC GeoAccess'}[scenario] }.`);
  };
  const updateTagFromInput = () => {
    const lat=$('tagLat').value.trim()===''?NaN:Number($('tagLat').value);
    const lon=$('tagLon').value.trim()===''?NaN:Number($('tagLon').value);
    if(!validCoords(lat,lon)) {notify('Tọa độ không hợp lệ. Vĩ độ ±90, kinh độ ±180.');return false;}
    const name=$('tagLabel').value.trim()||'Thẻ NFC tùy chỉnh';
    state.tag={...state.tag,name,lat,lon};state.corrected=false;state.correctionPos=null;
    state.rawPos=positionAt(state.tag,Number($('noiseRange').value),52);
    render();return true;
  };
  const simulateTap = () => {
    if(!updateTagFromInput())return;
    state.lastRead={id:state.tag.id,source:'sim',at:Date.now()};
    render();log('NFC',`Chạm thẻ ${state.tag.id} → hiển thị ${state.tag.name} (${number(state.tag.lat)}, ${number(state.tag.lon)}).`);
    notify('Đã đọc thẻ NFC giả lập và định vị trên bản đồ.');
  };
  const generateNoise = () => {
    const radius=Number($('noiseRange').value);
    state.rawPos=positionAt(state.tag,radius,Math.random()*360);state.corrected=false;state.correctionPos=null;
    updateAnchorStats();render();log('GPS',`Giả lập phép đo GPS sai lệch ${radius} m so với mốc NFC.`);
  };
  const updateAnchorStats = () => {
    const before=distanceMeters(state.tag,devicePos());
    $('beforeMetric').innerHTML=Number.isFinite(before)?`${before.toFixed(1)} <i>m</i>`:'—';
    $('afterMetric').innerHTML=state.corrected?'0.0 <i>m*</i>':'—';
  };
  const correctWithNfc = () => {
    state.corrected=true;state.correctionPos={lat:state.tag.lat,lon:state.tag.lon};
    state.lastRead={id:state.tag.id,source:'sim',at:Date.now()};
    updateAnchorStats();render();log('ANCHOR',`Áp mốc NFC ${state.tag.id} làm ước lượng vị trí trong ứng dụng; không điều khiển GPS hệ thống.`);
    notify('Đã áp vị trí mốc NFC trong mô phỏng.');
  };
  const resetAccessVerdict = () => {
    $('verification').className='verification';$('verifyTitle').textContent='Chưa xác minh';
    $('verifyDetails').textContent='Chạm thẻ rồi chọn Xác minh.';
    for(const id of ['checkTag','checkDistance','checkFresh'])$(id).className='';
  };
  const accessTap = () => {
    const selected=$('accessTag').value;
    state.lastRead=selected==='none'?null:{id:selected==='valid'?gateTag.id:'UNKNOWN-00',source:'sim',at:Date.now()};
    resetAccessVerdict();render();
    log(selected==='invalid'?'WARN':'NFC',selected==='none'?'Chưa có thẻ NFC để quét.':`Chạm thẻ mô phỏng ${state.lastRead.id}.`);
    notify(selected==='none'?'Chọn một thẻ hợp lệ hoặc không hợp lệ.':`Đã chạm ${state.lastRead.id}.`);
  };
  const verifyAccess = () => {
    const now=Date.now(),maxAge=30_000;
    const isValid=state.lastRead?.id===gateTag.id;
    const age=state.lastRead?now-state.lastRead.at:Infinity;
    const fresh=age>=0&&age<=maxAge;
    const gap=distanceMeters(state.gate,devicePos());
    const radius=Number($('radiusRange').value);
    const inRange=Number.isFinite(gap)&&gap<=radius;
    const items=[['checkTag',isValid,'Thẻ được nhận diện'],['checkDistance',inRange,`Khoảng cách ${gap.toFixed(1)} m ≤ ${radius} m`],['checkFresh',fresh,'Bản đọc NFC còn hiệu lực 30 giây']];
    for(const [id,ok,label] of items){$(id).className=ok?'pass':'fail';$(id).textContent=(ok?'✓ ':'✕ ')+label;}
    const granted=Boolean(isValid&&inRange&&fresh);$('verification').className='verification '+(granted?'success':'denied');
    $('verification').querySelector('.verify-symbol').textContent=granted?'✓':'×';
    $('verifyTitle').textContent=granted?'CẤP QUYỀN GIẢ LẬP':'TỪ CHỐI TRUY CẬP';
    $('verifyDetails').textContent=granted?'Các điều kiện demo đã đạt. Không mở khóa thật.':'Ít nhất một điều kiện không đạt.';
    log(granted?'ALLOW':'DENY',`GeoAccess ${granted?'cho phép':'từ chối'} (mô phỏng): NFC=${isValid}, mới=${fresh}, khoảng cách=${gap.toFixed(1)}m, bán kính=${radius}m.`);
    notify(granted?'Điều kiện demo đạt — không mở khóa phần cứng.':'Điều kiện demo không đạt, từ chối truy cập.');
  };
  const startOrStopGPS = () => {
    if(state.gpsWatchId!==null){
      navigator.geolocation.clearWatch(state.gpsWatchId);state.gpsWatchId=null;state.gpsLive=false;state.userPos=null;state.gpsAccuracy=null;
      $('gpsBtn').textContent='◎ Bật GPS thật';updateAnchorStats();resetAccessVerdict();render();log('GPS','Đã tắt nhận vị trí thiết bị.');return;
    }
    if(!navigator.geolocation||!window.isSecureContext){notify('GPS thật cần trình duyệt hỗ trợ Geolocation trong HTTPS hoặc localhost.');log('WARN','Không thể sử dụng Geolocation trong ngữ cảnh này.');return;}
    $('gpsBtn').disabled=true;$('gpsBtn').textContent='Đang xin quyền GPS…';
    // getCurrentPosition first to handle errors before opening a continuous watcher.
    navigator.geolocation.getCurrentPosition(pos=>{
      state.userPos={lat:pos.coords.latitude,lon:pos.coords.longitude};state.gpsAccuracy=pos.coords.accuracy;state.gpsLive=true;
      $('gpsBtn').disabled=false;$('gpsBtn').textContent='◉ Tắt GPS thật';
      state.gpsWatchId=navigator.geolocation.watchPosition(p=>{
        state.userPos={lat:p.coords.latitude,lon:p.coords.longitude};state.gpsAccuracy=p.coords.accuracy;
        updateAnchorStats();resetAccessVerdict();render();
      },err=>log('WARN','Cập nhật GPS: '+err.message),{enableHighAccuracy:true,maximumAge:1000,timeout:15000});
      updateAnchorStats();resetAccessVerdict();render();
      log('GPS',`Đã nhận vị trí trình duyệt (độ chính xác báo cáo ±${Math.round(pos.coords.accuracy)} m).`);
      notify('GPS trình duyệt đã bật. Dữ liệu chưa gửi lên máy chủ.');
    },err=>{
      $('gpsBtn').disabled=false;$('gpsBtn').textContent='◎ Bật GPS thật';
      log('WARN','Không nhận được vị trí: '+err.message);notify('Không lấy được GPS: '+err.message);
    },{enableHighAccuracy:true,timeout:15000,maximumAge:0});
  };
  const parseGeoRecord = text => {
    if(typeof text!=='string')return null;
    let data;
    try {data=JSON.parse(text);} catch(_){
      const m=text.trim().match(/^geo:\s*(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/i);
      if(!m)return null;
      data={lat:Number(m[1]),lon:Number(m[2]),name:'Tọa độ từ geo: URI',id:'TAG-GEO-URI'};
    }
    const lat=Number(data.lat??data.latitude),lon=Number(data.lon??data.longitude);
    if(!validCoords(lat,lon))return null;
    return {id:str(data.id||'TAG-IMPORTED').slice(0,80),name:str(data.name||data.label||'Vị trí từ thẻ NFC').slice(0,80),lat,lon};
  };
  const handleRealRead = evt => {
    let imported=null; const decoder=new TextDecoder();
    for(const record of evt.message.records){
      if(!['text','url','mime','absolute-url'].includes(record.recordType))continue;
      try {const raw=decoder.decode(record.data); imported=parseGeoRecord(raw);if(imported)break;}catch(e){log('WARN','Không đọc được bản ghi NDEF: '+e.message);}
    }
    if(!imported){log('WARN','Đã phát hiện thẻ NFC nhưng không có JSON vị trí hoặc geo: URI được hỗ trợ.');notify('Đã quét NFC; không tìm thấy tọa độ hợp lệ.');return;}
    state.lastRead={id:imported.id,source:'real',at:Date.now()};
    if(state.scenario!=='access')setTag(imported);
    resetAccessVerdict();render();
    log('NFC',`Đọc NDEF thật từ ${imported.id}: ${number(imported.lat)}, ${number(imported.lon)}.`);
    notify(`Đã đọc NFC thật: ${imported.name}.`);
  };
  const scanNFC = async () => {
    if(state.scanController){state.scanController.abort();state.scanController=null;$('scanBtn').textContent='⌁ Quét NFC thật';render();log('NFC','Đã dừng quét NFC.');return;}
    if(!window.NDEFReader||!window.isSecureContext){notify('Web NFC cần Chrome Android hỗ trợ NFC và HTTPS. Có thể dùng mô phỏng trên máy tính.');return;}
    try{
      const controller=new AbortController();const reader=new NDEFReader();
      await reader.scan({signal:controller.signal});
      state.scanController=controller;state.nfcReader=reader;
      reader.addEventListener('reading',handleRealRead);
      reader.addEventListener('readingerror',()=>log('WARN','Phát hiện NFC nhưng không đọc được NDEF.'));
      $('scanBtn').textContent='■ Dừng quét NFC';render();
      log('NFC','Đang đợi thẻ NDEF gần điện thoại.');notify('Đưa thẻ NFC NDEF đến gần mặt sau điện thoại.');
    }catch(e){state.scanController=null;$('scanBtn').textContent='⌁ Quét NFC thật';render();notify('Quét NFC không khả dụng: '+e.message);log('WARN','Lỗi Web NFC: '+e.message);}
  };
  const writeNFC = async () => {
    if(!updateTagFromInput())return;
    if(!window.NDEFReader||!window.isSecureContext){notify('Ghi thẻ thật cần Chrome Android có Web NFC và HTTPS.');return;}
    const ok=window.confirm('Ghi dữ liệu tọa độ mẫu lên thẻ NFC NDEF ở gần? Thao tác này có thể ghi đè nội dung hiện có.');
    if(!ok)return;
    try{
      const writer=new NDEFReader();
      await writer.write({records:[{recordType:'text',lang:'vi',data:JSON.stringify(payload())}]});
      log('NFC',`Đã ghi NDEF lên thẻ: ${state.tag.id}.`);notify('Đã ghi thẻ NFC thành công.');
    }catch(e){log('WARN','Không ghi được NFC: '+e.message);notify('Không ghi được thẻ NFC: '+e.message);}
  };
  const exportLog = () => {
    const result={application:'GeoContext NFC × GPS Lab',version:'1.0',exportedAt:new Date().toISOString(),mode:state.scenario,devicePosition:devicePos(),positionSource:state.gpsLive?'browser-geolocation':'simulation',accuracyReportedMeters:state.gpsAccuracy,selectedTag:state.tag,events:state.log.slice().reverse(),disclaimer:'All access/accuracy actions are simulations. Never use frontend-only NFC/GPS checks as physical access control.'};
    const blob=new Blob([JSON.stringify(result,null,2)],{type:'application/json;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download='nfc-gps-lab-log-'+new Date().toISOString().slice(0,10)+'.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);
    log('FILE','Đã xuất nhật ký JSON cục bộ.');
  };
  const copyNDEF = async () => {
    if(!updateTagFromInput())return;
    const data=JSON.stringify(payload(),null,2);
    try{await navigator.clipboard.writeText(data);notify('Đã sao chép nội dung NDEF JSON.');}
    catch(e){
      const area=document.createElement('textarea');area.value=data;area.style.position='fixed';area.style.opacity='0';document.body.append(area);area.select();
      try{document.execCommand('copy');notify('Đã sao chép dữ liệu NDEF.');}catch(_){notify('Clipboard bị chặn; hãy chọn và sao chép dữ liệu JSON hiển thị.');}finally{area.remove();}
    }
  };
  const connectEvents = () => {
    for(const tab of document.querySelectorAll('.scenario-tab')){
      tab.addEventListener('click',()=>showScenario(tab.dataset.scenario));
      tab.addEventListener('keydown',e=>{
        if(!['ArrowDown','ArrowRight','ArrowUp','ArrowLeft'].includes(e.key))return;
        const tabs=[...document.querySelectorAll('.scenario-tab')],index=tabs.indexOf(tab),delta=['ArrowDown','ArrowRight'].includes(e.key)?1:-1;
        const next=tabs[(index+delta+tabs.length)%tabs.length];e.preventDefault();showScenario(next.dataset.scenario);next.focus();
      });
    }
    $('presetTag').addEventListener('change',e=>{setTag(presetTags[e.target.value]);log('TAG',`Đã chọn dữ liệu mẫu ${state.tag.id}.`);});
    for(const id of ['tagLabel','tagLat','tagLon'])$(id).addEventListener('change',updateTagFromInput);
    $('tapTagBtn').addEventListener('click',simulateTap);
    $('copyPayloadBtn').addEventListener('click',copyNDEF);
    $('noiseRange').addEventListener('input',e=>{$('noiseValue').textContent=e.target.value+' m';state.rawPos=positionAt(state.tag,Number(e.target.value),52);state.corrected=false;state.correctionPos=null;updateAnchorStats();render();});
    $('generateNoiseBtn').addEventListener('click',generateNoise);
    $('correctBtn').addEventListener('click',correctWithNfc);
    $('accessTag').addEventListener('change',resetAccessVerdict);
    $('distanceRange').addEventListener('input',e=>{$('distanceValue').textContent=e.target.value+' m';resetAccessVerdict();render();});
    $('radiusRange').addEventListener('input',e=>{$('radiusValue').textContent=e.target.value+' m';resetAccessVerdict();render();});
    $('accessTapBtn').addEventListener('click',accessTap);
    $('verifyBtn').addEventListener('click',verifyAccess);
    $('gateCurrentBtn').addEventListener('click',()=>{
      if(!state.gpsLive||!state.userPos){notify('Hãy bật GPS thật và cấp quyền vị trí trước.');return;}
      state.gate={...state.gate,lat:state.userPos.lat,lon:state.userPos.lon};resetAccessVerdict();render();
      log('GATE','Đã chuyển mốc kiểm soát mô phỏng sang GPS hiện tại (đặt mốc chỉ trong phiên).');notify('Đã đặt mốc demo tại vị trí hiện tại.');
    });
    $('gpsBtn').addEventListener('click',startOrStopGPS);
    $('scanBtn').addEventListener('click',scanNFC);
    $('writeBtn').addEventListener('click',writeNFC);
    $('downloadLogBtn').addEventListener('click',exportLog);
    $('clearLogBtn').addEventListener('click',()=>{state.log=[];renderEvents();notify('Đã xóa nhật ký trong phiên.');});
    window.addEventListener('beforeunload',()=>{
      if(state.scanController)state.scanController.abort();
      if(state.gpsWatchId!==null)navigator.geolocation.clearWatch(state.gpsWatchId);
    });
  };
  const init = () => {
    $('nfcSupport').textContent=window.NDEFReader?'Web NFC: có API':'Web NFC: mô phỏng';
    $('nfcSupport').classList.toggle('error',!window.NDEFReader);
    $('nfcSupport').title=window.NDEFReader?'Trình duyệt có giao diện Web NFC; còn tùy thiết bị và quyền truy cập.':'Trình duyệt không cung cấp giao diện Web NFC.';
    state.rawPos=positionAt(state.tag,Number($('noiseRange').value),52);
    connectEvents();createLeaflet();syncTagFields();updateAnchorStats();render();renderEvents();
    log('SYS','Đã khởi động NFC × GPS Lab ở chế độ giả lập. Tọa độ mẫu chỉ phục vụ minh họa.');
  };
  init();
})();
