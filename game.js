'use strict';
/* Xứ sở cổ tích – Lucky Wheel, chạy độc lập trên GitHub Pages. */
const $ = (id) => document.getElementById(id);
const DEFAULTS = () => ({
  version: 3, students: [], selectedIds: [], history: [], teacherImage: null, lastWinnerIds: [],
  prefs: { pickCount: 1, speed: 'normal', stage: 'main', viewMode: 'groups', reduceMotion: false, effectsOn: true, musicOn: false }
});
let state = DEFAULTS();
let db = null, dbReady = false, saveTimer = null, toastTimer = null;
let currentGroup = 0, groupTimer = null, animationId = 0, activeSprites = [], spinner = false;
let assignmentDraft = [], assignObjectUrls = [], pendingSingleId = null;
let audioContext = null, musicTimer = null, melodyIndex = 0, magicTimer = null;
const ease = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
const VALID_TYPES = new Set(['image/png','image/jpeg','image/webp']);
const collator = new Intl.Collator('vi', {numeric:true,sensitivity:'base'});
const SPEED = {slow: .45, normal: .85, fast: 1.45};
const nowId = () => (crypto.randomUUID ? crypto.randomUUID() : 'student-'+Date.now()+'-'+Math.random().toString(36).slice(2));
function icon(id){return `<svg aria-hidden="true"><use href="#ic-${id}"/></svg>`;}
function toast(message, error=false, position='bottom'){
  const el=$('toast');
  el.textContent=message;
  el.classList.toggle('error',error);
  // Chỉ thông báo đổi chế độ hiển thị chuyển lên dưới banner.
  // Những lỗi/thông báo khác giữ vị trí dưới màn hình như cũ.
  el.classList.toggle('view-message',position==='banner');
  el.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>el.classList.remove('visible'),3800);
}
function safeName(s){return String(s||'').trim().replace(/\s+/g,' ').slice(0,150);}
function activeStudents(){return state.students.filter(s=>s.active!==false);}
function eligibleStudents(){const chosen=new Set(state.selectedIds);return activeStudents().filter(s=>!chosen.has(s.id));}
function getStudent(id){return state.students.find(s=>s.id===id);}
function show(el){$(el).hidden=false;}
function hide(el){$(el).hidden=true;}
function modalOpen(id){show(id);document.body.style.overflow='hidden';let x=$(id).querySelector('button, input');if(x)x.focus({preventScroll:true});}
function modalClose(id){hide(id);if(!document.querySelector('.modal-backdrop:not([hidden])'))document.body.style.overflow='';}
function closeAllModals(){document.querySelectorAll('.modal-backdrop').forEach(e=>e.hidden=true);document.body.style.overflow='';}
function setTab(name){
  document.querySelectorAll('.tab').forEach(el=>{el.classList.toggle('active',el.dataset.tab===name);el.setAttribute('aria-selected',String(el.dataset.tab===name));});
  document.querySelectorAll('.tab-panel').forEach(el=>el.classList.toggle('active',el.dataset.panel===name));
  if(name==='students')renderStudentList();if(name==='photos')renderPhotoGrid();
}
function openSettings(tab='students'){setTab(tab);modalOpen('settingsModal');}

function openDb(){return new Promise((resolve,reject)=>{
  if(!('indexedDB' in window)){reject(new Error('Trình duyệt không hỗ trợ IndexedDB'));return;}
  const req=indexedDB.open('xu-so-mot-3-fantasy-game',1);
  req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains('app'))req.result.createObjectStore('app');};
  req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
});}
function readDb(){return new Promise((resolve,reject)=>{
  const tx=db.transaction('app','readonly'),req=tx.objectStore('app').get('state');
  req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
});}
function writeDb(snapshot){return new Promise((resolve,reject)=>{
  const tx=db.transaction('app','readwrite');tx.objectStore('app').put(snapshot,'state');
  tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);
});}
function persist(){
  clearTimeout(saveTimer);
  $('saveStatus').textContent='Đang lưu dữ liệu…';
  saveTimer=setTimeout(async()=>{
    if(!dbReady){$('saveStatus').textContent='Chưa thể lưu dữ liệu trong trình duyệt';return;}
    try{await writeDb(state);$('saveStatus').textContent='✓ Đã lưu vào trình duyệt';}
    catch(err){console.warn('IndexedDB:',err);$('saveStatus').textContent='Không thể lưu, hãy xuất bản sao lưu';toast('Bộ nhớ trình duyệt không đủ. Hãy xuất bản sao lưu.',true);}
  },250);
}
function normalizeState(obj){
  const base=DEFAULTS();if(!obj||typeof obj!=='object')return base;
  const students=Array.isArray(obj.students)?obj.students.slice(0,300).map(s=>({
    id:typeof s.id==='string'&&s.id?s.id:nowId(),name:safeName(s.name)||'Học sinh',
    image:typeof s.image==='string'&&/^data:image\/(png|jpeg|webp);base64,/i.test(s.image)?s.image:null,
    active:s.active!==false
  })):[];
  const ids=new Set(students.map(s=>s.id));
  const prefs={...base.prefs,...(obj.prefs||{})};
  if(!['slow','normal','fast'].includes(prefs.speed))prefs.speed='normal';
  prefs.stage='main'; // Sân khấu 2:1 thống nhất, kể cả khi mở bản sao lưu cấu hình cũ.
  prefs.viewMode=prefs.viewMode==='all'?'all':'groups'; // Tương thích dữ liệu sao lưu phiên bản cũ.
  prefs.pickCount=Math.min(5,Math.max(1,Number(prefs.pickCount)||1));
  return {version:3,students,teacherImage:typeof obj.teacherImage==='string'&&/^data:image\/(png|jpeg|webp);base64,/i.test(obj.teacherImage)?obj.teacherImage:null,
    lastWinnerIds:Array.isArray(obj.lastWinnerIds)?obj.lastWinnerIds.filter(x=>ids.has(x)).slice(0,5):[],
    selectedIds:Array.isArray(obj.selectedIds)?obj.selectedIds.filter(x=>ids.has(x)):[],
    history:Array.isArray(obj.history)?obj.history.slice(0,500).map(h=>({id:String(h.id||nowId()),at:String(h.at||''),names:Array.isArray(h.names)?h.names.map(safeName):[],ids:Array.isArray(h.ids)?h.ids:[]})):[],prefs};
}
function renderCounters(){
  const total=activeStudents().length,rem=eligibleStudents().length;
  $('totalCount').textContent=total;$('remainingCount').textContent=rem;$('poolLabel').textContent=rem+' chưa chọn';
  $('studentTableCount').textContent='('+state.students.length+')';
  $('pickCount').value=String(state.prefs.pickCount);
  const allView=state.prefs.viewMode==='all';
  $('viewBtn').classList.toggle('view-active',allView);
  $('viewBtn').setAttribute('aria-pressed',String(allView));
  $('viewBtn').title=allView?'Đang hiện tất cả – nhấn để xem theo nhóm':'Hiển thị tất cả học sinh';
  $('viewBtn').setAttribute('aria-label',allView?'Chuyển sang hiển thị theo nhóm 10 học sinh':'Hiển thị tất cả học sinh trên sân khấu');
  $('viewBtn').innerHTML=icon(allView?'eye-off':'eye');
  $('musicBtn').classList.toggle('is-off',!state.prefs.musicOn);
  $('soundBtn').classList.toggle('is-off',!state.prefs.effectsOn);
  $('musicBtn').title=state.prefs.musicOn?'Tắt nhạc nền':'Bật nhạc nền';
  $('soundBtn').title=state.prefs.effectsOn?'Tắt hiệu ứng âm thanh':'Bật hiệu ứng âm thanh';
  $('musicBtn').innerHTML=icon('music');
  $('soundBtn').innerHTML=icon(state.prefs.effectsOn?'volume':'volume-off');
}
function syncPrefs(){
  $('speedSelect').value=state.prefs.speed;
  $('reduceMotion').checked=!!state.prefs.reduceMotion;
  $('teacherCorner').classList.toggle('motion-off',!!state.prefs.reduceMotion||ease);
  $('stageLandscape').src='assets/stage_combined_2to1.png';
}
function repaint(){renderCounters();renderStage();renderPhotoGrid();renderStudentList();syncPrefs();renderTeacher();renderChosen(false);persist();}

/* Hình được lưu WebP để giảm dung lượng, giữ nền trong suốt của PNG */
function compressImage(file){return new Promise((resolve,reject)=>{
  if(!VALID_TYPES.has(file.type)){reject(new Error('Chỉ hỗ trợ ảnh PNG, JPG hoặc WebP'));return;}
  if(file.size>20*1024*1024){reject(new Error('Ảnh quá lớn (tối đa 20 MB/ảnh)'));return;}
  const url=URL.createObjectURL(file),img=new Image();
  img.onload=()=>{try{
    const max=750,ratio=Math.min(1,max/Math.max(img.naturalWidth,img.naturalHeight));
    const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.naturalWidth*ratio));canvas.height=Math.max(1,Math.round(img.naturalHeight*ratio));
    canvas.getContext('2d',{alpha:true}).drawImage(img,0,0,canvas.width,canvas.height);
    const result=canvas.toDataURL('image/webp',.91);URL.revokeObjectURL(url);resolve(result);
  }catch(e){URL.revokeObjectURL(url);reject(e);}};
  img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('Không đọc được ảnh '+file.name));};img.src=url;
});}
function parseNames(value){return value.split(/\r?\n/).map(safeName).filter(Boolean);}
function appendNames(){
  const names=parseNames($('bulkNames').value);if(!names.length){toast('Hãy nhập mỗi tên trên một dòng.',true);return;}
  if(state.students.length+names.length>300){toast('Tối đa 300 học sinh.',true);return;}
  state.students.push(...names.map(name=>({id:nowId(),name,image:null,active:true})));
  $('bulkNames').value='';repaint();toast('Đã thêm '+names.length+' học sinh.');
}
function replaceNames(){
  const names=parseNames($('bulkNames').value);if(!names.length){toast('Hãy nhập danh sách học sinh.',true);return;}
  if(names.length>300){toast('Tối đa 300 học sinh.',true);return;}
  if(state.students.length&&!confirm('Thay toàn bộ danh sách? Ảnh của các học sinh trùng tên sẽ được giữ lại; các ảnh khác có thể bị xóa.'))return;
  const old=state.students.slice(),used=new Set();
  state.students=names.map(name=>{const match=old.find(s=>!used.has(s.id)&&s.name.toLocaleLowerCase('vi')===name.toLocaleLowerCase('vi'));if(match){used.add(match.id);return {...match,name};}return {id:nowId(),name,image:null,active:true};});
  const retained=new Set(state.students.map(s=>s.id));state.selectedIds=state.selectedIds.filter(id=>retained.has(id));
  $('bulkNames').value='';repaint();toast('Đã cập nhật danh sách '+names.length+' học sinh.');
}
function buildStudentSlots(){
 const target=Math.trunc(Number($('studentAmount').value));
 if(!Number.isFinite(target)||target<1||target>300){toast('Nhập số lượng từ 1 đến 300 học sinh.',true);return;}
 if(target<state.students.length){toast('Đã có '+state.students.length+' học sinh. Tính năng này không xóa danh sách hiện tại.',true);return;}
 const extra=target-state.students.length;
 for(let i=0;i<extra;i++){const order=state.students.length+1;state.students.push({id:nowId(),name:'Học sinh '+String(order).padStart(2,'0'),image:null,active:true});}
 if(extra){repaint();toast('Đã tạo thêm '+extra+' ô tên. Bạn có thể sửa tên từng học sinh.');}else toast('Danh sách đã đủ '+target+' học sinh.');
}
function addStudent(){
  if(state.students.length>=300)return toast('Tối đa 300 học sinh.',true);
  state.students.push({id:nowId(),name:'Học sinh '+(state.students.length+1),image:null,active:true});repaint();
  $('studentsList').scrollTop=$('studentsList').scrollHeight;
}
function renderStudentList(){
  const root=$('studentsList'),query=$('studentSearch').value.trim().toLocaleLowerCase('vi');
  const arr=state.students.filter(s=>!query||s.name.toLocaleLowerCase('vi').includes(query));
  root.replaceChildren();if(!arr.length){const e=document.createElement('p');e.className='muted';e.textContent=state.students.length?'Không tìm thấy học sinh phù hợp.':'Chưa có học sinh nào. Dán danh sách vào ô phía trên.';root.append(e);return;}
  arr.forEach((s)=>{
    const row=document.createElement('div');row.className='student-row';row.dataset.id=s.id;
    const active=document.createElement('input');active.type='checkbox';active.checked=s.active!==false;active.title='Cho phép học sinh tham gia';active.setAttribute('aria-label','Cho phép '+s.name+' tham gia');active.addEventListener('change',()=>{s.active=active.checked;renderCounters();renderStage();persist();});
    const visual=s.image?document.createElement('img'):document.createElement('div');
    if(s.image){visual.src=s.image;visual.alt='Ảnh '+s.name;}else{visual.className='no-photo';visual.innerHTML=icon('image');visual.title='Chưa có ảnh';}
    const name=document.createElement('input');name.type='text';name.value=s.name;name.maxLength=150;name.setAttribute('aria-label','Tên học sinh');name.addEventListener('change',()=>{s.name=safeName(name.value)||s.name;renderCounters();persist();});
    const count=document.createElement('span');count.style.cssText='font-size:11px;font-weight:800;color:#ad609c;text-align:center';count.textContent=state.selectedIds.includes(s.id)?'✓':'•';count.title=state.selectedIds.includes(s.id)?'Đã được chọn':'Chưa được chọn';
    const buttons=document.createElement('div');buttons.className='row-tools';
    const upload=document.createElement('button');upload.className='small-icon';upload.title='Thay ảnh';upload.setAttribute('aria-label','Thay ảnh '+s.name);upload.innerHTML=icon('upload');upload.addEventListener('click',()=>{$('singlePhotoInput').value='';pendingSingleId=s.id;$('singlePhotoInput').click();});
    const del=document.createElement('button');del.className='small-icon';del.title='Xóa học sinh';del.setAttribute('aria-label','Xóa '+s.name);del.innerHTML=icon('trash');del.addEventListener('click',()=>{if(!confirm('Xóa học sinh '+s.name+' cùng ảnh chibi?'))return;state.students=state.students.filter(x=>x.id!==s.id);state.selectedIds=state.selectedIds.filter(x=>x!==s.id);repaint();});
    buttons.append(upload,del);row.append(active,visual,name,count,buttons);root.append(row);
  });
}
function renderPhotoGrid(){
  const root=$('photoGrid');root.replaceChildren();const withPhotos=state.students.filter(s=>s.image);
  $('photoSummary').textContent=`Đã có ${withPhotos.length}/${state.students.length} học sinh được gán ảnh.`;
  withPhotos.forEach(s=>{const tile=document.createElement('div');tile.className='photo-tile';const img=document.createElement('img');img.src=s.image;img.alt='Ảnh của '+s.name;const name=document.createElement('span');name.textContent=s.name;tile.append(img,name);root.append(tile);});
}
function chooseMultiPhotos(){ $('multiPhotoInput').value='';$('multiPhotoInput').click(); }
async function prepareAssignments(files){
  const list=Array.from(files).filter(f=>VALID_TYPES.has(f.type)).sort((a,b)=>collator.compare(a.name,b.name));
  if(!list.length){toast('Không có ảnh hợp lệ. Chỉ hỗ trợ PNG, JPG và WebP.',true);return;}
  if(list.length>150){toast('Mỗi lần tải tối đa 150 ảnh.',true);return;}
  assignmentDraft=[];assignObjectUrls.forEach(URL.revokeObjectURL);assignObjectUrls=[];
  const free=state.students.filter(s=>!s.image),fallback=state.students;
  for(let i=0;i<list.length;i++){
    const url=URL.createObjectURL(list[i]);assignObjectUrls.push(url);
    const suggested=free[i]||(!free.length?fallback[i]:null)||null;
    assignmentDraft.push({file:list[i],preview:url,studentId:suggested?.id||'',newName:safeName(list[i].name.replace(/\.[^.]+$/,'').replace(/^\d+[._\- ]*/,'')||'Học sinh '+(state.students.length+i+1))});
  }
  renderAssignmentGrid();modalOpen('assignModal');
}
function renderAssignmentGrid(){
  const root=$('assignmentGrid');root.replaceChildren();
  $('assignmentHint').textContent=`Có ${assignmentDraft.length} ảnh. Chọn học sinh tương ứng ở từng thẻ; với tên chưa có trong lớp, chọn “+ Tạo học sinh mới”.`;
  $('assignCount').textContent=assignmentDraft.length+' ảnh sẽ được gán';
  assignmentDraft.forEach((a,i)=>{
    const card=document.createElement('div');card.className='assignment-card';
    const img=document.createElement('img');img.src=a.preview;img.alt='Ảnh '+a.file.name;
    const label=document.createElement('div');label.className='file-label';label.textContent=(i+1)+'. '+a.file.name;
    const select=document.createElement('select');select.setAttribute('aria-label','Ghép ảnh '+a.file.name+' với học sinh');
    const opt0=new Option('— Chọn học sinh —','');select.append(opt0);
    state.students.forEach(s=>select.append(new Option(s.name,s.id)));
    select.append(new Option('+ Tạo học sinh mới','__new__'));
    select.value=a.studentId||'__new__';if(select.value==='__new__')a.studentId='__new__';
    const input=document.createElement('input');input.type='text';input.placeholder='Tên học sinh mới';input.maxLength=150;input.value=a.newName;
    input.hidden=a.studentId!=='__new__';
    select.addEventListener('change',()=>{a.studentId=select.value;input.hidden=select.value!=='__new__';});
    input.addEventListener('input',()=>{a.newName=input.value;});
    card.append(img,label,select,input);root.append(card);
  });
}
async function confirmAssignments(){
  const ids=assignmentDraft.map(a=>a.studentId).filter(x=>x&&x!=='__new__');
  if(new Set(ids).size!==ids.length){toast('Một học sinh đang bị gán nhiều ảnh trong lần tải này. Vui lòng kiểm tra lại.',true);return;}
  if(assignmentDraft.some(a=>!a.studentId)){toast('Còn ảnh chưa được ghép với học sinh.',true);return;}
  if(assignmentDraft.some(a=>a.studentId==='__new__'&&!safeName(a.newName))){toast('Vui lòng nhập tên cho các học sinh mới.',true);return;}
  const newCount=assignmentDraft.filter(a=>a.studentId==='__new__').length;
  if(state.students.length+newCount>300){toast('Danh sách tối đa 300 học sinh.',true);return;}
  const btn=$('confirmAssignmentsBtn');btn.disabled=true;btn.textContent='Đang xử lý ảnh…';
  try{
    const converted=[];for(let i=0;i<assignmentDraft.length;i++){converted.push(await compressImage(assignmentDraft[i].file));}
    assignmentDraft.forEach((a,i)=>{
      if(a.studentId==='__new__')state.students.push({id:nowId(),name:safeName(a.newName),image:converted[i],active:true});
      else {const target=getStudent(a.studentId);if(target)target.image=converted[i];}
    });
    closeAssignment();repaint();toast('Đã gán thành công '+converted.length+' ảnh chibi.');
    if($('settingsModal').hidden===false)setTab('photos');
  }catch(e){console.error(e);toast('Có lỗi khi xử lý ảnh: '+e.message,true);}finally{btn.disabled=false;btn.textContent='✓ Xác nhận và lưu';}
}
function closeAssignment(){modalClose('assignModal');assignObjectUrls.forEach(URL.revokeObjectURL);assignObjectUrls=[];assignmentDraft=[];}

/* Nhóm tối đa 10 chibi chỉ dùng để HIỂN THỊ, không dùng làm tập ứng viên để bốc chọn. */
function groupLists(){const students=eligibleStudents().filter(s=>s.image);const groups=[];for(let i=0;i<students.length;i+=10)groups.push(students.slice(i,i+10));return groups;}
function updateEmpty(){
 const arr=activeStudents(),images=arr.filter(s=>s.image),eligible=eligibleStudents();
 const empty=$('sceneEmpty');
 if(arr.length===0){empty.hidden=false;empty.querySelector('h2').textContent='Sân khấu đang chờ những bạn nhỏ!';empty.querySelector('p').textContent='Thêm tên và tải ảnh chibi trong mục Cài đặt để bắt đầu trò chơi.';}
 else if(!eligible.length){empty.hidden=false;empty.querySelector('h2').textContent='Tất cả các bạn đã được chọn! 🎉';empty.querySelector('p').textContent='Nhấn “Làm mới” để bắt đầu một vòng chọn mới.';}
 else if(!images.some(s=>eligible.some(x=>x.id===s.id))){empty.hidden=false;empty.querySelector('h2').textContent='Danh sách đã sẵn sàng!';empty.querySelector('p').textContent='Hãy tải ảnh chibi của các bạn để nhân vật xuất hiện trên sân khấu. Bạn vẫn có thể quay để chọn tên.';}
 else empty.hidden=true;
}
function clearSprites(){cancelAnimationFrame(animationId);$('chibiLayer').replaceChildren();activeSprites=[];}
/* Nút con mắt: hiển thị toàn bộ ảnh trên cùng sân khấu. Chế độ này không ảnh hưởng xác suất quay. */
function renderStage(){
 clearSprites();updateEmpty();
 const layer=$('chibiLayer');
 const allView=state.prefs.viewMode==='all';
 layer.classList.toggle('all-students',allView);
 if(allView){
   const students=activeStudents().filter(s=>s.image);
   const total=students.length;
   $('groupLabel').textContent='Hiện toàn lớp';
   layer.classList.remove('crowded','solo');
   if(!total)return;
   // 11–20 em: 2 hàng. 21–48 em: 3 hàng. Lớp đông hơn: tăng số hàng và thu nhỏ ảnh.
   const rows=total<=5?1:total<=20?2:total<=48?3:Math.max(4,Math.ceil(Math.sqrt(total/5)));
   const columns=Math.ceil(total/rows);
   const colStep=82/columns;
   const spriteWidth=Math.min(total<=5?15:total<=10?12:11.7,colStep*.87);
   const spriteHeight=rows===1?38:rows===2?24:rows===3?18:Math.min(14,53/rows);
   const startY=rows===1?83:rows===2?62:rows===3?45:35;
   const endY=86;
   const chosen=new Set(state.selectedIds);
   students.forEach((s,i)=>{
     const row=Math.floor(i/columns),col=i%columns;
     const rowCount=Math.min(columns,total-row*columns);
     const x=50+(col-(rowCount-1)/2)*colStep;
     const y=rows===1?83:startY+row*(endY-startY)/(rows-1);
     const el=document.createElement('div');el.className='chibi';el.setAttribute('aria-hidden','true');
     if(chosen.has(s.id))el.classList.add('already-picked');
     el.style.width=spriteWidth+'%';el.style.height=spriteHeight+'%';
     const img=document.createElement('img');img.src=s.image;img.alt='';img.draggable=false;el.append(img);layer.append(el);
     activeSprites.push({el,img,x,y,phase:i*2.05+Math.random(),dist:Math.min(1.1,colStep*.12),offset:Math.random()*1000});
   });
 }else{
   const groups=groupLists();
   layer.classList.remove('all-students');
   if(!groups.length){$('groupLabel').textContent='Sân khấu cổ tích';return;}
   currentGroup%=groups.length;
   const students=groups[currentGroup];$('groupLabel').textContent='Nhóm '+(currentGroup+1)+'/'+groups.length;
   const count=students.length;
   layer.classList.toggle('crowded',count>5);
   layer.classList.toggle('solo',count===1);
   students.forEach((s,i)=>{
     const twoRows=count>5,row=twoRows&&i>=5?1:0;
     const col=twoRows?i%5:i;
     const rowItems=twoRows?(row===0?5:count-5):count;
     const spread=twoRows?14.1:(count===1?0:Math.min(17,65/(count-1)));
     const x=50+(col-(rowItems-1)/2)*spread+(row?2.6:0);
     const y=twoRows?(row===0?70:85):83;
     const el=document.createElement('div');el.className='chibi';el.setAttribute('aria-hidden','true');
     const img=document.createElement('img');img.src=s.image;img.alt='';img.draggable=false;el.append(img);layer.append(el);
     activeSprites.push({el,img,x:x+Math.sin(i*27)*.65,y,phase:i*2.05+Math.random(),dist:1.6+Math.random()*1.8,offset:Math.random()*1000});
   });
 }
 // Đồng nhất cả hai chế độ về giảm chuyển động và vị trí khởi tạo.
 if(state.prefs.reduceMotion||ease){
   activeSprites.forEach(p=>{p.el.style.left=p.x+'%';p.el.style.top=p.y+'%';});
 }else{animationId=requestAnimationFrame(moveSprites);}
}
function moveSprites(time){
 const speed=SPEED[state.prefs.speed]||.85;
 for(let i=0;i<activeSprites.length;i++){
   const p=activeSprites[i],t=(time+p.offset)*.00035*speed;
   const drift=Math.sin(t*2+p.phase)*p.dist;
   const margin=state.prefs.viewMode==='all'?6:11;
   const left=Math.max(margin,Math.min(100-margin,p.x+drift));
   const bob=Math.abs(Math.sin(t*8+p.phase))*1.05;
   p.el.style.left=left+'%';p.el.style.top=(p.y-bob)+'%';
   p.img.classList.toggle('face-left',Math.cos(t*2+p.phase)<0);
 }
 animationId=requestAnimationFrame(moveSprites);
}
function advanceGroup(){if(spinner||state.prefs.viewMode==='all')return;const groups=groupLists();if(groups.length>1){currentGroup=(currentGroup+1)%groups.length;renderStage();}}
function startGroupTimer(){clearInterval(groupTimer);groupTimer=setInterval(()=>{
 if(!spinner&&!document.querySelector('.modal-backdrop:not([hidden])'))advanceGroup();
},7600);}
/* Không thiên lệch modulo: loại phần dư khi lấy mẫu số ngẫu nhiên 32 bit. */
function unbiasedIndex(n){
 if(n<2)return 0;if(crypto&&crypto.getRandomValues){
  const upper=0x100000000,limit=Math.floor(upper/n)*n,buffer=new Uint32Array(1);let x;
  do{crypto.getRandomValues(buffer);x=buffer[0];}while(x>=limit);return x%n;
 }
 return Math.floor(Math.random()*n);
}
function drawSample(list,k){const a=list.slice();for(let i=0;i<k;i++){const j=i+unbiasedIndex(a.length-i);[a[i],a[j]]=[a[j],a[i]];}return a.slice(0,k);}
function wait(ms){return new Promise(resolve=>setTimeout(resolve,ms));}
/* Trước đây nhóm ảnh bị đổi sau mỗi 240 ms nên trông giống nhấp nháy.
   Giờ mỗi DOM chibi được giữ nguyên và di chuyển liên tục trên một vòng quay.
   Thuật toán rút tên chỉ dựa trên toàn bộ học sinh CHƯA được chọn. */
const clamp01=t=>Math.max(0,Math.min(1,t));
const smooth=t=>{const u=clamp01(t);return u*u*(3-2*u);};
const mix=(a,b,t)=>a+(b-a)*t;

function orbitAssignments(){
 const sprites=activeSprites.slice();
 if(!sprites.length)return [];
 const lanes=[];
 if(state.prefs.viewMode==='all'&&sprites.length>10){
  // Hiện toàn lớp: các hàng chạy vòng riêng, tránh dồn 30–40 em vào một đường.
  const byRow=new Map();
  sprites.forEach((sprite,i)=>{
   const row=Math.round(sprite.y*10)/10;
   if(!byRow.has(row))byRow.set(row,[]);
   byRow.get(row).push({sprite,i});
  });
  [...byRow.entries()].sort((a,b)=>a[0]-b[0]).forEach(([y,items],row)=>{
   lanes.push({items,cy:y,rx:items.length<3?12:Math.min(36,23+items.length*1.15),ry:items.length<3?3:3.5,row});
  });
 }else{
  lanes.push({items:sprites.map((sprite,i)=>({sprite,i})),cy:sprites.length<=5?76:72,
   rx:sprites.length<=2?22:sprites.length<=5?29:35,
   ry:sprites.length<=2?7:sprites.length<=5?9:12,row:0});
 }
 const assignments=[];
 for(const lane of lanes){
  const count=lane.items.length;
  lane.items.forEach(({sprite},index)=>{
   const startX=Number.parseFloat(sprite.el.style.left);
   const startY=Number.parseFloat(sprite.el.style.top);
   assignments.push({sprite,lane,index,count,
    startX:Number.isFinite(startX)?startX:sprite.x,
    startY:Number.isFinite(startY)?startY:sprite.y});
  });
 }
 return assignments;
}
function animateOrbit(assignment,time,duration){
 const {sprite,lane,index,count,startX,startY}=assignment;
 const entry=smooth(time/540);
 const leave=smooth((time-(duration-590))/590);
 const blend=entry*(1-leave);
 // Khoảng 1.4 vòng trong toàn bộ lượt quay, mượt và vừa tốc độ.
 const rotation=2*Math.PI*1.42*smooth(time/duration*.92);
 const angle=-Math.PI/2+(index/count)*Math.PI*2+rotation;
 const orbitX=50+lane.rx*Math.cos(angle);
 const orbitY=lane.cy+lane.ry*Math.sin(angle);
 sprite.el.style.left=mix(startX,orbitX,blend).toFixed(3)+'%';
 sprite.el.style.top=mix(startY,orbitY,blend).toFixed(3)+'%';
 // Giữ ảnh thẳng đứng; đổi hướng nhìn theo chiều đi, không làm ảnh biến mất.
 if(blend>.15)sprite.img.classList.toggle('face-left',Math.sin(angle)>0);
}

function smoothBezierPath(points){
 const lines=[`M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`];
 for(let i=0;i<points.length-1;i++){
  const p0=points[Math.max(0,i-1)],p1=points[i],p2=points[i+1],p3=points[Math.min(points.length-1,i+2)];
  const c1={x:p1.x+(p2.x-p0.x)/6,y:p1.y+(p2.y-p0.y)/6};
  const c2={x:p2.x-(p3.x-p1.x)/6,y:p2.y-(p3.y-p1.y)/6};
  lines.push(`C ${c1.x.toFixed(2)} ${c1.y.toFixed(2)}, ${c2.x.toFixed(2)} ${c2.y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`);
 }
 return lines.join(' ');
}

/* Đường bay thiết kế theo sân khấu THẬT, không dùng tọa độ cố định của ảnh chụp.
   Dạng sóng đi từ góc trái, lượn phía trên các bạn nhỏ, rồi quay ngược lại. */
function createWitchFlight(){
 if(!state.teacherImage)return null;
 const shell=$('appShell'),stage=$('stageScene'),teacher=$('teacherImage');
 const shellRect=shell.getBoundingClientRect(),stageRect=stage.getBoundingClientRect();
 const teacherRect=teacher.getBoundingClientRect();
 if(!stageRect.width||!teacherRect.width)return null;
 const px=(u,v)=>({x:stageRect.left-shellRect.left+stageRect.width*u,
                         y:stageRect.top-shellRect.top+stageRect.height*v});
 const points=[
  {x:teacherRect.left-shellRect.left+teacherRect.width*.5,
   y:teacherRect.top-shellRect.top+teacherRect.height*.52},
  px(-.055,.17),px(.07,.19),px(.17,.27),px(.29,.20),px(.41,.28),
  px(.53,.18),px(.65,.27),px(.77,.20),px(.88,.25),px(.985,.075)
 ];
 const svgNS='http://www.w3.org/2000/svg';
 const svg=document.createElementNS(svgNS,'svg');svg.classList.add('witch-route-metrics');
 svg.setAttribute('viewBox',`0 0 ${shellRect.width} ${shellRect.height}`);
 svg.setAttribute('aria-hidden','true');
 const path=document.createElementNS(svgNS,'path');path.setAttribute('d',smoothBezierPath(points));svg.append(path);
 const flyer=document.createElement('div');flyer.className='witch-flyer';
 flyer.style.width=teacherRect.width+'px';flyer.style.height=teacherRect.height+'px';
 const image=document.createElement('img');image.src=state.teacherImage;image.alt='';image.draggable=false;
 flyer.append(image);
 shell.append(svg,flyer);
 $('teacherCorner').classList.add('witch-on-route');
 const length=path.getTotalLength();
 return {path,length,flyer,svg,lastSpark:0,returning:false};
}
function moveWitch(flight,time,duration){
 if(!flight)return;
 const half=duration*.5;
 const returning=time>=half;
 // Hai hành trình dùng cùng một path, do đó lượt về khớp chính xác lượt đi.
 const portion=returning?1-smooth((time-half)/half):smooth(time/half);
 const point=flight.path.getPointAtLength(flight.length*clamp01(portion));
 flight.flyer.style.left=point.x+'px';
 flight.flyer.style.top=point.y+'px';
 if(flight.returning!==returning){flight.returning=returning;flight.flyer.classList.toggle('returning',returning);}
 if(time-flight.lastSpark>155&&time<duration-180){
  flight.lastSpark=time;
  const s=document.createElement('span');s.className='witch-trail-star';s.textContent='✦';
  s.style.left=point.x+'px';s.style.top=(point.y+15)+'px';
  s.style.setProperty('--drift-x',((Math.random()-.5)*34)+'px');
  flight.flyer.parentElement.append(s);
  setTimeout(()=>s.remove(),850);
 }
}
function finishWitchFlight(flight){
 if(!flight)return;
 flight.flyer.remove();flight.svg.remove();
 $('teacherCorner').classList.remove('witch-on-route');
}
async function playDrawSequence(){
 const reduced=!!state.prefs.reduceMotion||ease;
 if(reduced){await wait(260);return;}
 const duration=state.teacherImage?6450:4050;
 cancelAnimationFrame(animationId);
 const layer=$('chibiLayer');layer.classList.remove('is-spinning');layer.classList.add('is-orbiting');
 const assignments=orbitAssignments();
 let flight=null,frameId=0;
 try{
  flight=createWitchFlight();
  await new Promise((resolve,reject)=>{
   let started;
   const frame=now=>{
    try{
     if(started===undefined)started=now;
     const t=Math.min(duration,now-started);
     assignments.forEach(a=>animateOrbit(a,t,duration));
     if(flight)moveWitch(flight,t,duration);
     if(t>=duration){resolve();return;}
     frameId=requestAnimationFrame(frame);
    }catch(err){reject(err);}
   };
   frameId=requestAnimationFrame(frame);
  });
 }finally{
  cancelAnimationFrame(frameId);
  finishWitchFlight(flight);
  layer.classList.remove('is-orbiting');
 }
}
async function spin(){
 if(spinner)return;
 const elig=eligibleStudents(),k=Number($('pickCount').value)||1;
 if(!elig.length){toast('Không còn học sinh chưa được chọn. Nhấn Làm mới để bắt đầu vòng mới.',true);return;}
 if(k>elig.length){toast(`Chỉ còn ${elig.length} học sinh chưa được chọn. Hãy giảm số lượng hoặc Làm mới.`,true);return;}
 // Chọn NGẪU NHIÊN trước, nhưng tuyệt đối không tiết lộ cho đến khi phù thủy trở về.
 const winners=drawSample(elig,k);
 spinner=true;state.lastWinnerIds=[];renderChosen(false);$('teacherMagic').replaceChildren();
 const locks=['drawBtn','viewBtn','nextBtn','resetBtn','settingsBtn','pickCount'];
 locks.forEach(id=>$(id).disabled=true);
 $('drawBtn').classList.add('busy');playEffect('start');
 // Tiếng tích tắc chậm hơn chuyển động; không còn đổi nhóm ảnh mỗi 240 ms.
 const tickTimer=setInterval(()=>playEffect('tick'),720);
 let completed=false;
 try{
  await playDrawSequence();
  completed=true;
  winners.forEach(s=>state.selectedIds.push(s.id));
  state.history.unshift({id:nowId(),at:new Date().toISOString(),ids:winners.map(s=>s.id),names:winners.map(s=>s.name)});
  state.history=state.history.slice(0,500);
 }catch(err){console.error('Hoạt ảnh quay:',err);toast('Không chạy được hoạt ảnh. Vui lòng quay lại.',true);}
 finally{
  clearInterval(tickTimer);spinner=false;
  locks.forEach(id=>$(id).disabled=false);
  $('drawBtn').classList.remove('busy');
  $('teacherCorner').classList.remove('witch-on-route');
  $('chibiLayer').classList.remove('is-orbiting');
 }
 if(!completed){renderStage();return;}
 renderCounters();renderStage();persist();
 // Sau toàn bộ quỹ đạo đi và về mới công bố các em được chọn.
 showWinners(winners);playEffect('win');
}
// Ảnh GV và ảnh HS được chọn hiển thị trực tiếp ở góc trái, không dùng popup.
function renderTeacher(){
 const img=$('teacherImage'),add=$('teacherAdd'),edit=$('teacherEdit');
 if(state.teacherImage){img.src=state.teacherImage;img.hidden=false;add.hidden=true;edit.hidden=false;}
 else{img.removeAttribute('src');img.hidden=true;add.hidden=false;edit.hidden=true;}
}
/* Normalize only the visual result thumbnail: remove invisible PNG/WebP padding.
   The student's original photo and IndexedDB record are never modified.
   No student is singled out by name or ID; the exact same method applies to all. */
const chosenPreviewCache=new Map();
function chosenPreviewImage(student){
 if(!student?.image)return Promise.resolve(null);
 const cached=chosenPreviewCache.get(student.id);
 if(cached?.source===student.image)return cached.promise;
 const source=student.image;
 const promise=new Promise(resolve=>{
  const input=new Image();
  input.onload=()=>{
   try{
    const width=input.naturalWidth,height=input.naturalHeight;
    if(!width||!height){resolve(source);return;}
    const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
    const ctx=canvas.getContext('2d',{willReadFrequently:true});
    ctx.drawImage(input,0,0);
    const pixels=ctx.getImageData(0,0,width,height).data;
    let minX=width,minY=height,maxX=-1,maxY=-1;
    // Ignore nearly invisible antialiased fringe, but retain white sticker borders.
    for(let y=0;y<height;y++){
     for(let x=0;x<width;x++){
      if(pixels[(y*width+x)*4+3]<=18)continue;
      if(x<minX)minX=x;if(x>maxX)maxX=x;
      if(y<minY)minY=y;if(y>maxY)maxY=y;
     }
    }
    if(maxX<0){resolve(source);return;}
    const padding=Math.max(2,Math.round(Math.min(width,height)*.018));
    const left=Math.max(0,minX-padding),top=Math.max(0,minY-padding);
    const right=Math.min(width,maxX+padding+1),bottom=Math.min(height,maxY+padding+1);
    const cropW=right-left,cropH=bottom-top;
    // Preserve photos that already fill the source canvas.
    if(cropW>=width*.96&&cropH>=height*.96){resolve(source);return;}
    const cropped=document.createElement('canvas');cropped.width=cropW;cropped.height=cropH;
    cropped.getContext('2d',{alpha:true}).drawImage(input,left,top,cropW,cropH,0,0,cropW,cropH);
    resolve(cropped.toDataURL('image/webp',.94));
   }catch(err){console.warn('Ảnh hiển thị kết quả:',err);resolve(source);}
  };
  input.onerror=()=>resolve(source);
  input.src=source;
 });
 chosenPreviewCache.set(student.id,{source,promise});
 if(chosenPreviewCache.size>40){
  const oldest=chosenPreviewCache.keys().next().value;
  if(oldest!==student.id)chosenPreviewCache.delete(oldest);
 }
 return promise;
}
function renderChosen(animate=false){
 const root=$('chosenStudents'),ids=Array.isArray(state.lastWinnerIds)?state.lastWinnerIds:[];
 const winners=ids.map(getStudent).filter(Boolean);
 root.replaceChildren();
 $('chosenArea').hidden=winners.length===0;
 $('teacherCorner').classList.toggle('has-winners',winners.length>0);
 root.dataset.count=String(winners.length);
 winners.forEach((s,i)=>{
  const figure=document.createElement('figure');figure.className='chosen-student';
  // Một kích thước cố định cho từng chibi, không phụ thuộc số HS được chọn.
  // Chia wrapper để hiệu ứng bay lơ lửng không đè lên animation bay từ sân khấu vào.
  if(animate){figure.style.setProperty('--delay',(i*145)+'ms');}
  figure.style.setProperty('--float-lag',(-i*.63)+'s');
  const floating=document.createElement('div');floating.className='chosen-float';
  if(s.image){
   const img=document.createElement('img');img.src=s.image;img.alt='Ảnh chibi '+s.name;img.draggable=false;floating.append(img);
   chosenPreviewImage(s).then(preview=>{if(img.isConnected&&preview)img.src=preview;});
  }
  else {const noImg=document.createElement('span');noImg.className='chosen-no-image';noImg.textContent='⭐';floating.append(noImg);}
  const caption=document.createElement('figcaption');caption.textContent=s.name;
  figure.append(floating,caption);root.append(figure);
  if(animate&&!state.prefs.reduceMotion&&!ease){
    // Bắt ảnh từ trung tâm sân khấu về cạnh giáo viên (không phụ thuộc nhóm đang hiện).
    const stageRect=$('stageScene').getBoundingClientRect(),destRect=figure.getBoundingClientRect();
    const dx=(stageRect.left+stageRect.width*.52)-(destRect.left+destRect.width*.5);
    const dy=(stageRect.top+stageRect.height*.63)-(destRect.top+destRect.height*.5);
    figure.style.setProperty('--fly-x',Math.round(dx)+'px');
    figure.style.setProperty('--fly-y',Math.round(dy)+'px');
  }
  if(animate&&!state.prefs.reduceMotion&&!ease)figure.classList.add('just-chosen');
 });
}
function teacherStars(){
 clearTimeout(magicTimer);
 const fx=$('teacherMagic');fx.replaceChildren();
 if(state.prefs.reduceMotion||ease)return;
 const vectors=[[85,-47],[114,-28],[146,-5],[125,16],[159,35],[102,58],[58,35],[190,-17]];
 vectors.forEach(([x,y],i)=>{
  const star=document.createElement('span');star.className='teacher-star';star.textContent=i%3===0?'✧':'✦';
  star.style.setProperty('--sx',x+'px');star.style.setProperty('--sy',y+'px');
  star.style.animationDelay=(i*85)+'ms';fx.append(star);
 });
 // Remove particles after animation (no infinite animation and no accumulation).
 magicTimer=setTimeout(()=>{if(fx.isConnected)fx.replaceChildren();},2200);
}
function showWinners(winners){
 state.lastWinnerIds=winners.map(s=>s.id);
 renderChosen(true);teacherStars();persist();
}
function nextRound(){state.lastWinnerIds=[];renderChosen(false);$('teacherMagic').replaceChildren();advanceGroup();renderCounters();persist();}
function resetRound(){
 if(!state.selectedIds.length){toast('Chưa có học sinh nào được chọn trong vòng này.');return;}
 if(!confirm('Đặt lại vòng chọn? Tất cả học sinh sẽ được tham gia lại. Danh sách, ảnh và lịch sử được giữ nguyên.'))return;
 state.selectedIds=[];state.lastWinnerIds=[];currentGroup=0;renderChosen(false);renderCounters();renderStage();persist();toast('Đã bắt đầu vòng chọn mới.');
}
function renderHistory(){
 const root=$('historyContent');root.replaceChildren();
 if(!state.history.length){const p=document.createElement('p');p.className='hint';p.textContent='Chưa có lượt quay nào.';root.append(p);return;}
 state.history.forEach((h,i)=>{
  const card=document.createElement('article');card.className='history-entry';const header=document.createElement('header');
  const count=document.createElement('span');count.textContent='Lượt '+(state.history.length-i)+' · '+h.names.length+' học sinh';
  const date=document.createElement('span');const dt=new Date(h.at);date.textContent=isNaN(dt.getTime())?'':dt.toLocaleString('vi-VN');
  const line=document.createElement('p');line.textContent=h.names.join(' · ');
  header.append(count,date);card.append(header,line);root.append(card);
 });
}
function exportBackup(){
 const data={app:'xu-so-mot-3',exportedAt:new Date().toISOString(),...state};
 const blob=new Blob([JSON.stringify(data)],{type:'application/json;charset=utf-8'}),url=URL.createObjectURL(blob);
 const a=document.createElement('a');a.href=url;a.download='xu-so-mot-3-sao-luu-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Đã xuất bản sao lưu có ảnh và tên học sinh.');
}
async function importBackup(file){
 try{if(file.size>100*1024*1024)throw new Error('Tệp sao lưu quá lớn.');
  const incoming=JSON.parse(await file.text());if(incoming.app!=='xu-so-mot-3'&&!Array.isArray(incoming.students))throw new Error('Đây không phải bản sao lưu hợp lệ.');
  if(!confirm('Nhập bản sao lưu sẽ thay thế dữ liệu học sinh, ảnh và lịch sử hiện tại. Tiếp tục?'))return;
  state=normalizeState(incoming);currentGroup=0;repaint();toast('Đã khôi phục dữ liệu từ bản sao lưu.');
 }catch(err){console.error(err);toast('Không thể nhập sao lưu: '+err.message,true);}
}

/* Âm thanh tự tổng hợp, không sử dụng tệp nhạc có bản quyền */
function getAudio(){
 try{if(!audioContext)audioContext=new (window.AudioContext||window.webkitAudioContext)();if(audioContext.state==='suspended')audioContext.resume();return audioContext;}catch{return null;}
}
function tone(frequency=440,duration=.13,volume=.025,style='sine'){
 const ctx=getAudio();if(!ctx)return;const osc=ctx.createOscillator(),gain=ctx.createGain(),t=ctx.currentTime;
 osc.type=style;osc.frequency.setValueAtTime(frequency,t);gain.gain.setValueAtTime(.0001,t);gain.gain.exponentialRampToValueAtTime(volume,t+.015);gain.gain.exponentialRampToValueAtTime(.0001,t+duration);
 osc.connect(gain);gain.connect(ctx.destination);osc.start(t);osc.stop(t+duration+.02);
}
function playEffect(type){if(!state.prefs.effectsOn)return;
 if(type==='tick')tone(500+.5*100,.055,.009);
 if(type==='start'){tone(523,.2,.032);setTimeout(()=>tone(659,.18,.028),150);}
 if(type==='win'){[523,659,784,1046].forEach((f,i)=>setTimeout(()=>tone(f,.26,.035,'triangle'),i*120));}
}
function stopMusic(){clearInterval(musicTimer);musicTimer=null;}
function toggleMusic(){
 state.prefs.musicOn=!state.prefs.musicOn;
 if(state.prefs.musicOn){getAudio();startMusic();}else stopMusic();renderCounters();persist();
}
function startMusic(){
 stopMusic();const notes=[261.63,329.63,392,523.25,392,329.63,293.66,392,440,587.33,440,392,261.63,329.63,392,523.25];
 musicTimer=setInterval(()=>{if(state.prefs.musicOn){tone(notes[melodyIndex%notes.length],.27,.012,'sine');melodyIndex++;}},350);
}
async function toggleFullScreen(){try{if(!document.fullscreenElement)await $('appShell').requestFullscreen();else await document.exitFullscreen();}catch{toast('Trình duyệt không cho phép chế độ toàn màn hình.',true);}}

function wireEvents(){
 $('teacherUploadBtn').addEventListener('click',()=>{if(!spinner){$('teacherPhotoInput').value='';$('teacherPhotoInput').click();}});
 $('teacherPhotoInput').addEventListener('change',async e=>{
  const file=e.target.files?.[0];if(!file)return;
  try{state.teacherImage=await compressImage(file);renderTeacher();persist();toast('Đã lưu ảnh chibi giáo viên.');}
  catch(err){toast('Không thể tải ảnh giáo viên: '+err.message,true);}
  e.target.value='';
 });
 $('settingsBtn').addEventListener('click',()=>openSettings('students'));
 $('startSetupBtn').addEventListener('click',()=>openSettings('students'));
 $('helpBtn').addEventListener('click',()=>modalOpen('helpModal'));
 $('historyBtn').addEventListener('click',()=>{renderHistory();modalOpen('historyModal');});
 $('fullscreenBtn').addEventListener('click',toggleFullScreen);
 $('viewBtn').addEventListener('click',()=>{
   if(spinner)return;
   state.prefs.viewMode=state.prefs.viewMode==='all'?'groups':'all';
   currentGroup=0;renderCounters();renderStage();persist();
   toast(state.prefs.viewMode==='all'?'Đang hiển thị tất cả học sinh có ảnh.':'Đang hiển thị luân phiên theo nhóm 10 học sinh.',false,'banner');
 });
 $('musicBtn').addEventListener('click',toggleMusic);
 $('soundBtn').addEventListener('click',()=>{state.prefs.effectsOn=!state.prefs.effectsOn;renderCounters();persist();if(state.prefs.effectsOn)playEffect('tick');});
 $('drawBtn').addEventListener('click',spin);$('nextBtn').addEventListener('click',nextRound);
 $('resetBtn').addEventListener('click',resetRound);
 $('pickCount').addEventListener('change',e=>{state.prefs.pickCount=Math.max(1,Math.min(5,Number(e.target.value)||1));persist();});
 document.querySelectorAll('[data-close]').forEach(btn=>btn.addEventListener('click',()=>{
   if(btn.dataset.close==='assignModal')closeAssignment();else modalClose(btn.dataset.close);
 }));
 document.querySelectorAll('.modal-backdrop').forEach(el=>el.addEventListener('pointerdown',e=>{
   if(e.target===el){if(el.id==='assignModal')closeAssignment();else modalClose(el.id);}
 }));
 document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(!$('assignModal').hidden)closeAssignment();else closeAllModals();}});
 document.querySelectorAll('.tab').forEach(btn=>btn.addEventListener('click',()=>setTab(btn.dataset.tab)));
 $('makeSlotsBtn').addEventListener('click',buildStudentSlots);$('appendNamesBtn').addEventListener('click',appendNames);$('replaceNamesBtn').addEventListener('click',replaceNames);$('addStudentBtn').addEventListener('click',addStudent);
 $('studentSearch').addEventListener('input',renderStudentList);
 $('uploadManyBtn').addEventListener('click',e=>{e.stopPropagation();chooseMultiPhotos();});
 $('imageDropZone').addEventListener('click',e=>{if(e.target.closest('#uploadManyBtn'))return;chooseMultiPhotos();});
 $('imageDropZone').addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();chooseMultiPhotos();}});
 $('imageDropZone').addEventListener('dragover',e=>{e.preventDefault();$('imageDropZone').classList.add('drag-over');});
 $('imageDropZone').addEventListener('dragleave',()=>{$('imageDropZone').classList.remove('drag-over');});
 $('imageDropZone').addEventListener('drop',e=>{e.preventDefault();$('imageDropZone').classList.remove('drag-over');prepareAssignments(e.dataTransfer.files);});
 $('multiPhotoInput').addEventListener('change',e=>{if(e.target.files.length)prepareAssignments(e.target.files);});
 $('confirmAssignmentsBtn').addEventListener('click',confirmAssignments);
 $('singlePhotoInput').addEventListener('change',async e=>{
  const file=e.target.files[0],s=getStudent(pendingSingleId);if(!file||!s)return;
  try{s.image=await compressImage(file);repaint();toast('Đã cập nhật ảnh của '+s.name);}catch(err){toast(err.message,true);}pendingSingleId=null;
 });
 $('speedSelect').addEventListener('change',e=>{state.prefs.speed=e.target.value;persist();});
 $('reduceMotion').addEventListener('change',e=>{state.prefs.reduceMotion=e.target.checked;$('teacherCorner').classList.toggle('motion-off',!!state.prefs.reduceMotion||ease);renderStage();persist();});
 $('exportBtn').addEventListener('click',exportBackup);$('importBtn').addEventListener('click',()=>$('importInput').click());
 $('importInput').addEventListener('change',e=>{if(e.target.files[0])importBackup(e.target.files[0]);e.target.value='';});
 $('clearHistoryBtn').addEventListener('click',()=>{if(!state.history.length){toast('Lịch sử đang trống.');return;}if(!confirm('Xóa toàn bộ lịch sử lựa chọn? Trạng thái chưa/đã chọn vẫn được giữ nguyên.'))return;state.history=[];persist();toast('Đã xóa lịch sử.');});
 $('eraseAllBtn').addEventListener('click',()=>{if(!confirm('Xóa TOÀN BỘ học sinh, ảnh, trạng thái chọn và lịch sử? Hãy xuất sao lưu trước khi thực hiện.'))return;if(!confirm('Xác nhận lần cuối: không thể hoàn tác khi chưa có bản sao lưu.'))return;state=DEFAULTS();currentGroup=0;closeAllModals();repaint();toast('Đã xóa tất cả dữ liệu trên thiết bị.');});
 window.addEventListener('pagehide',()=>{if(dbReady){clearTimeout(saveTimer);try{const tx=db.transaction('app','readwrite');tx.objectStore('app').put(state,'state');}catch{}}});
}
async function boot(){
 wireEvents();
 try{db=await openDb();dbReady=true;const saved=await readDb();if(saved)state=normalizeState(saved);}
 catch(err){console.warn(err);toast('Không thể sử dụng bộ nhớ cục bộ. Hãy dùng trình duyệt Chrome/Edge và xuất sao lưu.',true);}
 renderCounters();syncPrefs();renderStage();renderStudentList();renderPhotoGrid();renderTeacher();renderChosen(false);startGroupTimer();
 // Nhạc mặc định tắt để tránh tự phát trước thao tác người dùng.
 state.prefs.musicOn=false;renderCounters();
}
boot();
