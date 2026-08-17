(()=>{
"use strict";

window.createRogueUpgrades=maxHp=>[
  {id:"split",name:"分裂弾",rarity:"RARE",desc:"壁に当たると敵へ5発の分裂弾。Lvで1発あたりのヒット回数 +1。",max:5,apply:s=>s.splitLevel++},
  {id:"pierce",name:"貫通",rarity:"RARE",desc:"ブロックを貫通できる回数 +1。",max:5,apply:s=>s.pierce++},
  {id:"damage",name:"ヘビーボール",rarity:"COMMON",desc:"ブロックへのダメージ +1。",max:8,apply:s=>s.ballDamage++},
  {id:"xp",name:"学習効率",rarity:"COMMON",desc:"獲得XP +20%。",max:8,apply:s=>s.xpMul*=1.2},
  {id:"magnet",name:"磁力",rarity:"COMMON",desc:"XP吸引距離 +45。",max:6,apply:s=>s.magnet+=45},
  {id:"heal",name:"修復",rarity:"UNCOMMON",desc:`最大HP +1（上限${maxHp}）、HPを2回復。`,max:5,apply:s=>{if(s.maxHp<maxHp)s.maxHp++;s.hp=Math.min(s.maxHp,s.hp+2)}},
  {id:"shield",name:"再生バリア",rarity:"UNCOMMON",desc:"1回防御するバリア。破壊後は自動復活。レベルで復活が早くなる。",max:5,apply:s=>{s.barrierLevel++;s.barrierActive=true;s.barrierCooldown=0}},
  {id:"poison",name:"毒球",rarity:"LEGEND",desc:"命中した敵を3秒間毒状態にする。Lvで毎秒の毒ダメージ +1。",max:5,apply:s=>s.poisonLevel++},
  {id:"fury",name:"瀕死の猛攻",rarity:"LEGEND",desc:"HP半分以下で速度と威力上昇。",max:1,apply:s=>s.fury=true},
  {id:"echo",name:"エコーショット",rarity:"LEGEND",desc:"8秒ごとに追加ボール。",max:1,apply:s=>s.echo=true}
];
})();