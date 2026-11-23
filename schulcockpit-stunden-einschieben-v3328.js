/* V0.33.28 – version display for lossless insertion of new Soll hours.
 * All structural changes stay in the existing scheduling/reconciliation modules.
 */
(function(){
'use strict';
const previousRender=render;
render=function(){
 previousRender();
 const label=document.querySelector('.brand small');
 if(label)label.textContent=state.settings.schoolYear+' · V0.33.28';
};
})();
