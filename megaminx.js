const origin = document.getElementById('canvas').width / 2;
const radius1 = origin * 35  / 105
const radius2 = origin * 80  / 105
const radius3 = origin * 100 / 105
const radius4 = origin * 65  / 105
const radius5 = origin * 84  / 105
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

/* コンテキストの設定 */
ctx.lineWidth = 2;
ctx.strokeStyle = '#000';

ctx.fillStyle = '#3cb371';
ctx.fillRect(0, 0, origin*2, origin*2)

pentagon(radius1,'#d3d3d3') // ブロック1

upface_corner(0,"#d3d3d3") // ブロック2
upface_edge  (0,"#d3d3d3") // ブロック3
upface_corner(1,"#d3d3d3") // ブロック4
upface_edge  (1,"#d3d3d3") // ブロック5
upface_corner(2,"#d3d3d3") // ブロック6
upface_edge  (2,"#d3d3d3") // ブロック7
upface_corner(3,"#d3d3d3") // ブロック8
upface_edge  (3,"#d3d3d3") // ブロック9
upface_corner(4,"#d3d3d3") // ブロック10
upface_edge  (4,"#d3d3d3") // ブロック11

side_corner1(0,"#d3d3d3") // ブロック12
side_edge   (0,"#d3d3d3") // ブロック13
side_corner2(1,"#d3d3d3") // ブロック14
side_corner1(1,"#d3d3d3") // ブロック15
side_edge   (1,"#d3d3d3") // ブロック16
side_corner2(2,"#d3d3d3") // ブロック17
side_corner1(2,"#d3d3d3") // ブロック18
side_edge   (2,"#d3d3d3") // ブロック19
side_corner2(3,"#d3d3d3") // ブロック20
side_corner1(3,"#d3d3d3") // ブロック21
side_edge   (3,"#d3d3d3") // ブロック20
side_corner2(4,"#d3d3d3") // ブロック23
side_corner1(4,"#d3d3d3") // ブロック24
side_edge   (4,"#d3d3d3") // ブロック25
side_corner2(0,"#d3d3d3") // ブロック26

ctx.lineWidth = 4;
pentagon(radius2)
pentagon(radius3)

function pentagon(size,color){
  ctx.beginPath();
  ctx.moveTo(megaminx_corner("x",size,0), megaminx_corner("y",size,0));
  ctx.lineTo(megaminx_corner("x",size,1), megaminx_corner("y",size,1));
  ctx.lineTo(megaminx_corner("x",size,2), megaminx_corner("y",size,2));
  ctx.lineTo(megaminx_corner("x",size,3), megaminx_corner("y",size,3));
  ctx.lineTo(megaminx_corner("x",size,4), megaminx_corner("y",size,4));
  ctx.closePath();
  if(color != null){
    ctx.fillStyle = color;
    ctx.fill();
  }
  ctx.stroke();
}

function upface_corner(k,color){
  var m;
  if(k == 0){
    m = 4
  } else {
    m = k - 1
  }

  ctx.beginPath();
  ctx.moveTo(megaminx_corner("x",radius1,k), megaminx_corner("y",radius1,k));
  ctx.lineTo(megaminx_edge("x","in" ,m,1), megaminx_edge("y","in" ,m,1));
  ctx.lineTo(megaminx_corner("x",radius2,k), megaminx_corner("y",radius2,k));
  ctx.lineTo(megaminx_edge("x","in" ,k,0), megaminx_edge("y","in" ,k,0));
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.stroke();
}

function upface_edge(k,color){
  ctx.beginPath();
  ctx.moveTo(megaminx_corner("x",radius1,k), megaminx_corner("y",radius1,k))
  ctx.lineTo(megaminx_edge("x","in" ,k,0), megaminx_edge("y","in" ,k,0));
  ctx.lineTo(megaminx_edge("x","in" ,k,1), megaminx_edge("y","in" ,k,1));
  ctx.lineTo(megaminx_corner("x",radius1,k+1), megaminx_corner("y",radius1,k+1));
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.stroke();
}

function side_corner1(k,color){
  ctx.beginPath();
  ctx.lineTo(megaminx_corner("x",radius2,k), megaminx_corner("y",radius2,k))
  ctx.lineTo(megaminx_corner("x",radius3,k), megaminx_corner("y",radius3,k))
  ctx.lineTo(megaminx_edge("x","out",k,0), megaminx_edge("y","out",k,0));
  ctx.lineTo(megaminx_edge("x","in",k,0), megaminx_edge("y","in",k,0));
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.stroke();  
}

function side_corner2(k,color){
  var m;
  if(k == 0){
    m = 4
  } else {
    m = k - 1
  }

  ctx.beginPath();
  ctx.lineTo(megaminx_corner("x",radius2,k), megaminx_corner("y",radius2,k))
  ctx.lineTo(megaminx_corner("x",radius3,k), megaminx_corner("y",radius3,k))
  ctx.lineTo(megaminx_edge("x","out",m,1), megaminx_edge("y","out",m,1));
  ctx.lineTo(megaminx_edge("x","in",m,1), megaminx_edge("y","in",m,1));
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.stroke();  
}

function side_edge(k,color){
  ctx.beginPath();
  ctx.lineTo(megaminx_edge("x","in",k,0), megaminx_edge("y","in",k,0));
  ctx.lineTo(megaminx_edge("x","out",k,0), megaminx_edge("y","out",k,0));
  ctx.lineTo(megaminx_edge("x","out",k,1), megaminx_edge("y","out",k,1));
  ctx.lineTo(megaminx_edge("x","in",k,1), megaminx_edge("y","in",k,1));
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.stroke();  
}

function megaminx_corner(axis,r,k){
  if(axis == "x"){
    return origin + r * Math.cos((2 * Math.PI * k) / 5 + Math.PI / 2);
  }else if(axis == "y"){
    return origin - r * Math.sin((2 * Math.PI * k) / 5 + Math.PI / 2) + origin / 12;
  }
}

function megaminx_edge(axis,side,k,l){
  var angle;
  var r;
  var gap;

  if(side == "in"){
    r = radius4
    gap = 0.043
  }else if(side == "out"){
    r = radius5
    gap = 0.081
  }

  if(l == 0){
    angle = 0.4 * k + 0.2 - gap
  }else if(l == 1){
    angle = 0.4 * k + 0.2 + gap
  }

  if(axis == "x"){
    return origin + r * Math.cos((angle * Math.PI) + Math.PI / 2);
  }else if(axis == "y"){
    return origin - r * Math.sin((angle * Math.PI) + Math.PI / 2) + origin / 12;
  }
}