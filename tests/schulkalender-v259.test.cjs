const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../schulcockpit-schulkalender-v259.js'),'utf8');
function calendar(){
  const state={settings:{schoolYear:'2026/27'},yearMilestonesV257:{'2026/27':[
    {id:'m1',date:'2027-01-25',title:'Notenschluss'}]}};
  const c={
    view:'school-calendar',state,v190CalendarDraft:null,
    pageTitle:()=>'',viewHtml:()=>'',render:()=>{},wire:()=>{},
    document:{querySelector:()=>null},
    v190NormYear:x=>x,v190YearOptions:()=>['2026/27'],
    v190Calendar:()=>({customRanges:[{id:'b1'}],imports:[],useCurrentTimetable:false}),
    v190YearBounds:()=>({start:'2026-08-01',end:'2027-07-31'}),
    v190YearStartNum:()=>2026,v190OfficialComplete:()=>true,
    v190PublicHolidaysForYear:()=>[],
    v190CalendarRanges:()=>[{id:'s1',start:'2026-10-28',end:'2026-10-28',name:'SchILF',type:'custom'},
      {id:'o1',start:'2026-10-19',end:'2026-10-23',name:'Herbstferien',type:'official'}],
    fmtDate:s=>s,esc:s=>String(s),uid:s=>s+'-new',
    saveState:async()=>{},render:()=>{},alert:()=>{},structuredClone,
  };
  vm.runInNewContext(source,c);
  return c;
}
test('school calendar is its own page and separates closures from grade deadlines',()=>{
  const c=calendar();
  assert.equal(c.pageTitle(),'Schulkalender');
  const h=c.viewHtml();
  assert.match(h,/Ferien, SchILF & Abwesenheiten/);
  assert.match(h,/data-v262-range-impact="s1"/);
  assert.match(h,/id="v262-new-impact"/);
  assert.match(h,/Notenschluss/);
  assert.match(h,/2026-10-28/);
  assert.match(h,/data-v190-range-remove="s1"/);
  assert.doesNotMatch(h,/data-v190-range-remove="o1"/);
  assert.match(h,/data-v259-remove="m1"/);
  assert.match(h,/data-v190-calendar-recalc/);
  assert.equal(c.v190CalendarDraft.year,'2026/27');
});
test('existing SchILF calendar row changes to substitute without deleting id or dates',async()=>{
  const c=calendar(),range={id:'s1',name:'SchILF',start:'2026-10-28',end:'2026-10-28'};
  const cal={customRanges:[range],imports:[]};let change,stored=0;
  c.v190Calendar=()=>cal;
  c.saveState=async()=>{stored++;};
  c.document={querySelector:()=>null,getElementById:()=>null,querySelectorAll:selector=>selector==='[data-v262-range-impact]'?
    [{dataset:{v262RangeImpact:'s1'},value:'substitution',addEventListener:(_,cb)=>{change=cb;}}]:[]};
  c.viewHtml();c.wire();await change();
  assert.equal(stored,1);
  assert.deepEqual(range,{id:'s1',name:'SchILF',start:'2026-10-28',end:'2026-10-28',impactV262:'substitution'});
});
