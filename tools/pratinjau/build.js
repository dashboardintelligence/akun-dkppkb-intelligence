const fs=require('fs'),path=require('path');
const [SRC,OUT]=process.argv.slice(2);
const rd=f=>fs.readFileSync(path.join(SRC,f),'utf8');
let html=rd('Index.html')
 .replace(/\s*<base target="_top">/,'')
 .replace(/data-logo="<\?= logoUrl \?>"/,'data-logo=""')
 .replace(/data-nama="<\?= namaApp \?>"/,'data-nama="DKPPKB Sulbar"')
 .replace(/data-sub="<\?= subApp \?>"/,'data-sub="Intelligence"')
 .replace(/<\?!= include\('Stylesheet'\) \?>/,()=>rd('Stylesheet.html'))
 .replace(/<\?!= include\('Latar'\) \?>/,()=>'')
 .replace(/<\?!= include\('JavaScript'\) \?>/,()=>'<script src="mock-gas.js"></script>\n<script src="server.js"></script>\n'+rd('JavaScript.html'));
if(/<\?/.test(html)) throw new Error('template tersisa');
fs.writeFileSync(path.join(OUT,'index.html'),html);
fs.writeFileSync(path.join(OUT,'server.js'),rd('Kode.gs')+'\n'+rd('Halaman.gs')+'\nsetupAplikasi();\n');
