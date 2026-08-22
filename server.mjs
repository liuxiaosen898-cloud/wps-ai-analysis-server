import http from "node:http";
const port = Number(process.env.PORT || 3000);
const key = process.env.AI_API_KEY || "";
const base = (process.env.AI_BASE_URL || "https://token173.com/v1").replace(/\/$/, "");
const model = process.env.AI_MODEL || "gemini-3.5-flash-lite";
const token = process.env.APP_TOKEN || "";
const json = (res, status, body) => { res.writeHead(status, {"Content-Type":"application/json; charset=utf-8","Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"Content-Type, Authorization","Access-Control-Allow-Methods":"POST, GET, OPTIONS"}); res.end(JSON.stringify(body)); };
const number = value => { const n = Number(String(value ?? "").replace(/[,￥$\s]/g,"")); return Number.isFinite(n) ? n : null; };
const facts = values => { const width = Math.max(0,...values.map(row => row.length)); const numericColumns=[]; for(let c=0;c<width;c++){ const ns=values.map(row=>number(row[c])).filter(n=>n!==null); if(ns.length) numericColumns.push({column:c+1,total:ns.reduce((a,b)=>a+b,0),count:ns.length,minimum:Math.min(...ns),maximum:Math.max(...ns)}); } return {numericColumns}; };
const compare = (left,right) => { const differences=[]; const rows=Math.max(left.values.length,right.values.length); for(let r=0;r<rows;r++){ const cols=Math.max(left.values[r]?.length||0,right.values[r]?.length||0); for(let c=0;c<cols;c++){ const a=String(left.values[r]?.[c]??"").trim(), b=String(right.values[r]?.[c]??"").trim(); if(a!==b && differences.length<100) differences.push(`第${r+1}行第${c+1}列：${left.sheetName||"表1"}为“${a}”，${right.sheetName||"表2"}为“${b}”`); }} return {summary:differences.length?`核对完成：发现 ${differences.length} 处不一致。`:"核对完成：两张表一致。",differences}; };
const server = http.createServer(async (req,res) => {
  if(req.method === "OPTIONS") return json(res,204,{});
  if(req.method === "GET" && req.url === "/api/health") return json(res,200,{ok:true,model});
  if(req.method !== "POST" || !["/api/analyze","/api/compare"].includes(req.url)) return json(res,404,{error:"Not found"});
  if(token && req.headers.authorization !== `Bearer ${token}`) return json(res,401,{error:"未授权"});
  try {
    let raw=""; for await(const chunk of req) raw += chunk; const data=JSON.parse(raw||"{}");
    if(req.url === "/api/compare") return json(res,200,{result:compare(data.left,data.right)});
    if(!key) throw new Error("服务端尚未配置 AI_API_KEY");
    const selection=data.selection || {}; const values=Array.isArray(selection.values)?selection.values:[]; if(!values.length) throw new Error("请先选择单元格");
    const payload={model,temperature:0.2,messages:[{role:"system",content:"你是企业表格分析助手。只输出 JSON：{summary:string,findings:string[],anomalies:string[],recommendations:string[]}。不要虚构数字。"},{role:"user",content:JSON.stringify({question:data.question||"总结数据并检查异常",sheet:selection.sheetName,address:selection.address,values,facts:facts(values)})}]};
    const response=await fetch(`${base}/chat/completions`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${key}`},body:JSON.stringify(payload)}); const output=await response.json(); if(!response.ok) throw new Error(output?.error?.message||"AI 调用失败");
    const content=String(output?.choices?.[0]?.message?.content||"{}").replace(/^\x60\x60\x60json\s*|\s*\x60\x60\x60$/g,""); let result; try{result=JSON.parse(content)}catch{result={summary:content,findings:[],anomalies:[],recommendations:[]}}; result.finance=facts(values); return json(res,200,{result});
  } catch(error) { return json(res,400,{error:error.message||"请求失败"}); }
});
server.listen(port,()=>console.log(`WPS AI server listening on ${port}`));
