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
  assert.match(h,/Ferien, SchILF & schulfreie Tage/);
  assert.match(h,/Notenschluss/);
  assert.match(h,/2026-10-28/);
  assert.match(h,/data-v190-range-remove="s1"/);
  assert.doesNotMatch(h,/data-v190-range-remove="o1"/);
  assert.match(h,/data-v259-remove="m1"/);
  assert.match(h,/data-v190-calendar-recalc/);
  assert.equal(c.v190CalendarDraft.year,'2026/27');
});
