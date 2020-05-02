const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

var origin = document.getElementById('canvas').width / 2;
var radius1 = origin * 35  / 105
var radius2 = origin * 80  / 105
var radius3 = origin * 100 / 105
var radius4 = origin * 65  / 105
var radius5 = origin * 84  / 105

let bcolor = document.getElementById('canvas').getAttribute('bcolor');
let ucolor = document.getElementById('canvas').getAttribute('ucolor');
ucolor.split();
let scolor = document.getElementById('canvas').getAttribute('scolor');
scolor.split();

imageView();

function imageChange(){
  sizecheck()

  const sizeValue =  document.getElementById('imageSize').value
  canvas.width = sizeValue
  canvas.height = sizeValue

  origin = document.getElementById('imageSize').value / 2;
  radius1 = origin * 35  / 105
  radius2 = origin * 80  / 105
  radius3 = origin * 100 / 105
  radius4 = origin * 65  / 105
  radius5 = origin * 84  / 105

  ucolor = [document.getElementById('uface0').value,
            document.getElementById('uface1').value,
            document.getElementById('uface2').value,
            document.getElementById('uface3').value,
            document.getElementById('uface4').value,
            document.getElementById('uface5').value,
            document.getElementById('uface6').value,
            document.getElementById('uface7').value,
            document.getElementById('uface8').value,
            document.getElementById('uface9').value,
            document.getElementById('uface10').value]

  scolor = [document.getElementById('sface1').value,
            document.getElementById('sface2').value,
            document.getElementById('sface3').value,
            document.getElementById('sface4').value,
            document.getElementById('sface5').value,
            document.getElementById('sface6').value,
            document.getElementById('sface7').value,
            document.getElementById('sface8').value,
            document.getElementById('sface9').value,
            document.getElementById('sface10').value,
            document.getElementById('sface11').value,
            document.getElementById('sface12').value,
            document.getElementById('sface13').value,
            document.getElementById('sface14').value,
            document.getElementById('sface15').value]

  imageView()
}

function imageView(){
  /* コンテキストの設定 */
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#000';

  ctx.fillStyle = color_convert(bcolor[0]);
  ctx.fillRect(0, 0, origin*2, origin*2)

  pentagon(radius1,color_convert(ucolor[0])) // ブロック1

  upface_corner(0,color_convert(ucolor[1])) // ブロック2
  upface_edge  (0,color_convert(ucolor[2])) // ブロック3
  upface_corner(1,color_convert(ucolor[3])) // ブロック4
  upface_edge  (1,color_convert(ucolor[4])) // ブロック5
  upface_corner(2,color_convert(ucolor[5])) // ブロック6
  upface_edge  (2,color_convert(ucolor[6])) // ブロック7
  upface_corner(3,color_convert(ucolor[7])) // ブロック8
  upface_edge  (3,color_convert(ucolor[8])) // ブロック9
  upface_corner(4,color_convert(ucolor[9])) // ブロック10
  upface_edge  (4,color_convert(ucolor[10])) // ブロック11

  side_corner1(0,color_convert(scolor[0])) // ブロック12
  side_edge   (0,color_convert(scolor[1])) // ブロック13
  side_corner2(1,color_convert(scolor[2])) // ブロック14
  side_corner1(1,color_convert(scolor[3])) // ブロック15
  side_edge   (1,color_convert(scolor[4])) // ブロック16
  side_corner2(2,color_convert(scolor[5])) // ブロック17
  side_corner1(2,color_convert(scolor[6])) // ブロック18
  side_edge   (2,color_convert(scolor[7])) // ブロック19
  side_corner2(3,color_convert(scolor[8])) // ブロック20
  side_corner1(3,color_convert(scolor[9])) // ブロック21
  side_edge   (3,color_convert(scolor[10])) // ブロック20
  side_corner2(4,color_convert(scolor[11])) // ブロック23
  side_corner1(4,color_convert(scolor[12])) // ブロック24
  side_edge   (4,color_convert(scolor[13])) // ブロック25
  side_corner2(0,color_convert(scolor[14])) // ブロック26

  ctx.lineWidth = 4;
  pentagon(radius2)
  pentagon(radius3)
  ctx.moveTo(megaminx_corner("x",radius2,0), megaminx_corner("y",radius2,0));
  ctx.lineTo(megaminx_corner("x",radius3,0), megaminx_corner("y",radius3,0));
  ctx.moveTo(megaminx_corner("x",radius2,1), megaminx_corner("y",radius2,1));
  ctx.lineTo(megaminx_corner("x",radius3,1), megaminx_corner("y",radius3,1));
  ctx.moveTo(megaminx_corner("x",radius2,2), megaminx_corner("y",radius2,2));
  ctx.lineTo(megaminx_corner("x",radius3,2), megaminx_corner("y",radius3,2));
  ctx.moveTo(megaminx_corner("x",radius2,3), megaminx_corner("y",radius2,3));
  ctx.lineTo(megaminx_corner("x",radius3,3), megaminx_corner("y",radius3,3));
  ctx.moveTo(megaminx_corner("x",radius2,4), megaminx_corner("y",radius2,4));
  ctx.lineTo(megaminx_corner("x",radius3,4), megaminx_corner("y",radius3,4));
  ctx.stroke();
}

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

function color_convert(color){
  if     (color == "d"){ return "dimgray"}
  else if(color == "u"){ return "lightgray"}
  else if(color == "p"){ return "pink"}
  else if(color == "c"){ return "lemonchiffon"}
  else if(color == "a"){ return "aqua"}
  else if(color == "o"){ return "orange"}
  else if(color == "l"){ return "lawngreen"}
  else if(color == "b"){ return "dodgerblue"}
  else if(color == "y"){ return "yellow"}
  else if(color == "s"){ return "darkviolet"}
  else if(color == "g"){ return "seagreen"}
  else if(color == "r"){ return "red"}
  else if(color == "w"){ return "white"}
}

function downloadImage(){
  const format = document.getElementById('fmt').value
  let canvas = document.getElementById("canvas");
  let link = document.createElement("a");

  if(format=="png"){
    link.href = canvas.toDataURL("image/png");
    link.download = "megaminx.png";
  }else if(format=="gif"){
    link.href = canvas.toDataURL("image/gif");
    link.download = "megaminx.gif";
  }else if(format=="jpg"){
    link.href = canvas.toDataURL("image/jpg");
    link.download = "megaminx.jpg";
  }

  link.click();
}

function sizecheck(){
  let imageSize = document.getElementById('imageSize').value
  
  if(imageSize==""){
    document.getElementById('imageSize').value = 200
  }else if(imageSize < 100){
    document.getElementById('imageSize').value = 100
  }else if(imageSize > 1000){
    document.getElementById('imageSize').value = 1000
  }
}