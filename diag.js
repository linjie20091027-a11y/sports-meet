var h=require('http');
// 直接测试倒计时逻辑
var targetStr='2026-10-22T08:00:00';
var now=new Date();
var target=new Date(targetStr);
var diff=target-now;
console.log('=== Countdown Diagnostic ===');
console.log('Target string:',targetStr);
console.log('Target date:',target.toISOString());
console.log('Now:',now.toISOString());
console.log('Diff ms:',diff);
console.log('Diff days:',Math.floor(diff/86400000));
console.log('Diff hours (total):',Math.floor(diff/3600000));
console.log('Hours:',Math.floor((diff%86400000)/3600000));
console.log('Minutes:',Math.floor((diff%3600000)/60000));
console.log('Seconds:',Math.floor((diff%60000)/1000));
console.log('');

// 检查API返回
h.get('http://localhost:3000/api/public/meet-info',function(r){
  var b='';r.on('data',function(c){b+=c});r.on('end',function(){
    var j=JSON.parse(b);
    console.log('API start_date:',j.data.start_date);
    console.log('API returns correctly:',!!j.data.start_date);
    var apiDate=new Date(j.data.start_date);
    console.log('Parsed API date:',apiDate.toISOString());
    console.log('Is valid date:',!isNaN(apiDate.getTime()));

    // 模拟JS倒计时
    var apiTarget=new Date(j.data.start_date+'T08:00:00');
    var apiDiff=apiTarget-new Date();
    console.log('\n=== Simulated API countdown ===');
    console.log('Target (with 8AM):',apiTarget.toISOString());
    console.log('Diff days:',Math.floor(apiDiff/86400000));
    console.log('Should show:',Math.floor(apiDiff/86400000),'days,',
      Math.floor((apiDiff%86400000)/3600000),'hours,',
      Math.floor((apiDiff%3600000)/60000),'mins');
  });
});
