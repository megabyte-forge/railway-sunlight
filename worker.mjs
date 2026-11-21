import {simulate} from './engine.mjs';
self.onmessage=({data})=>{try{self.postMessage({id:data.id,result:simulate(data.input)});}catch(e){self.postMessage({id:data.id,error:e.message});}};
