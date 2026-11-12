function o(e){const s=(e.treatedGroups+1)*e.animalsPerGroup,r=e.studiesPerYear*s,t=e.studiesPerYear*(1-e.screenedOutShare),n=e.treatedGroups*e.animalsPerGroup+e.animalsPerGroup*(1-e.virtualControlShare),a=t*n;return{baselineAnimals:r,withTool:a,spared:r-a,sparedShare:r>0?(r-a)/r:0}}export{o as a};
//# sourceMappingURL=virtualControl-BB1COJsX.js.map
