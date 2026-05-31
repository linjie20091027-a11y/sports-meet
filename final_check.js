var S=require('sql.js');var f=require('fs');
S().then(function(s){
var d=new s.Database(f.readFileSync('database/sports_meet.db'));
var r=d.exec("SELECT id,username,email,role,name FROM users WHERE email='20091027@hkms.hktedu.com'");
console.log('Found:',r[0]?r[0].values.length:0,'rows');
if(r[0]&&r[0].values.length) r[0].values.forEach(function(v){console.log(v.join(' | '))});

var allR=d.exec("SELECT email,role FROM users WHERE role='admin'");
console.log('\nAll admins:');
if(allR[0]) allR[0].values.forEach(function(v){console.log(v[0],'-',v[1])});
});
