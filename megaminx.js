  const origin = 120;
  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');

  /* コンテキストの設定 */
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#000';

  /* 描画 */
  ctx.beginPath();
  
  ctx.moveTo(megaminx("x",100,0), megaminx("y",100,0));
  ctx.lineTo(megaminx("x",100,1), megaminx("y",100,1));
  ctx.lineTo(megaminx("x",100,2), megaminx("y",100,2));
  ctx.lineTo(megaminx("x",100,3), megaminx("y",100,3));
  ctx.lineTo(megaminx("x",100,4), megaminx("y",100,4));
  ctx.closePath();

  ctx.moveTo(megaminx("x",80,0), megaminx("y",80,0));
  ctx.lineTo(megaminx("x",80,1), megaminx("y",80,1));
  ctx.lineTo(megaminx("x",80,2), megaminx("y",80,2));
  ctx.lineTo(megaminx("x",80,3), megaminx("y",80,3));
  ctx.lineTo(megaminx("x",80,4), megaminx("y",80,4));
  ctx.closePath();

  ctx.moveTo(megaminx("x",35,0), megaminx("y",35,0));
  ctx.lineTo(megaminx("x",35,1), megaminx("y",35,1));
  ctx.lineTo(megaminx("x",35,2), megaminx("y",35,2));
  ctx.lineTo(megaminx("x",35,3), megaminx("y",35,3));
  ctx.lineTo(megaminx("x",35,4), megaminx("y",35,4));
  ctx.closePath();
  
  ctx.moveTo(megaminx("x",100,0), megaminx("y",100,0));
  ctx.lineTo(megaminx("x",80,0), megaminx("y",80,0));
  ctx.moveTo(megaminx("x",100,1), megaminx("y",100,1));
  ctx.lineTo(megaminx("x",80,1), megaminx("y",80,1));
  ctx.moveTo(megaminx("x",100,2), megaminx("y",100,2));
  ctx.lineTo(megaminx("x",80,2), megaminx("y",80,2));
  ctx.moveTo(megaminx("x",100,3), megaminx("y",100,3));
  ctx.lineTo(megaminx("x",80,3), megaminx("y",80,3));
  ctx.moveTo(megaminx("x",100,4), megaminx("y",100,4));
  ctx.lineTo(megaminx("x",80,4), megaminx("y",80,4));
  
  ctx.moveTo(megaminx_edge("x","in",0,0), megaminx_edge("y","in",0,0));
  ctx.lineTo(megaminx("x",35,0), megaminx("y",35,0));
  ctx.moveTo(megaminx_edge("x","in",0,1), megaminx_edge("y","in",0,1));
  ctx.lineTo(megaminx("x",35,1), megaminx("y",35,1));
  ctx.moveTo(megaminx_edge("x","in",1,0), megaminx_edge("y","in",1,0));
  ctx.lineTo(megaminx("x",35,1), megaminx("y",35,1));
  ctx.moveTo(megaminx_edge("x","in",1,1), megaminx_edge("y","in",1,1));
  ctx.lineTo(megaminx("x",35,2), megaminx("y",35,2));
  ctx.moveTo(megaminx_edge("x","in",2,0), megaminx_edge("y","in",2,0));
  ctx.lineTo(megaminx("x",35,2), megaminx("y",35,2));
  ctx.moveTo(megaminx_edge("x","in",2,1), megaminx_edge("y","in",2,1));
  ctx.lineTo(megaminx("x",35,3), megaminx("y",35,3));
  ctx.moveTo(megaminx_edge("x","in",3,0), megaminx_edge("y","in",3,0));
  ctx.lineTo(megaminx("x",35,3), megaminx("y",35,3));
  ctx.moveTo(megaminx_edge("x","in",3,1), megaminx_edge("y","in",3,1));
  ctx.lineTo(megaminx("x",35,4), megaminx("y",35,4));
  ctx.moveTo(megaminx_edge("x","in",4,0), megaminx_edge("y","in",4,0));
  ctx.lineTo(megaminx("x",35,4), megaminx("y",35,4));
  ctx.moveTo(megaminx_edge("x","in",4,1), megaminx_edge("y","in",4,1));
  ctx.lineTo(megaminx("x",35,0), megaminx("y",35,0));
  
  ctx.moveTo(megaminx_edge("x","in" ,0,0), megaminx_edge("y","in" ,0,0));
  ctx.lineTo(megaminx_edge("x","out",0,0), megaminx_edge("y","out",0,0));
  ctx.moveTo(megaminx_edge("x","in" ,0,1), megaminx_edge("y","in" ,0,1));
  ctx.lineTo(megaminx_edge("x","out",0,1), megaminx_edge("y","out",0,1));
  ctx.moveTo(megaminx_edge("x","in" ,1,0), megaminx_edge("y","in" ,1,0));
  ctx.lineTo(megaminx_edge("x","out",1,0), megaminx_edge("y","out",1,0));
  ctx.moveTo(megaminx_edge("x","in" ,1,1), megaminx_edge("y","in" ,1,1));
  ctx.lineTo(megaminx_edge("x","out",1,1), megaminx_edge("y","out",1,1));
  ctx.moveTo(megaminx_edge("x","in" ,2,0), megaminx_edge("y","in" ,2,0));
  ctx.lineTo(megaminx_edge("x","out",2,0), megaminx_edge("y","out",2,0));
  ctx.moveTo(megaminx_edge("x","in" ,2,1), megaminx_edge("y","in" ,2,1));
  ctx.lineTo(megaminx_edge("x","out",2,1), megaminx_edge("y","out",2,1));
  ctx.moveTo(megaminx_edge("x","in" ,3,0), megaminx_edge("y","in" ,3,0));
  ctx.lineTo(megaminx_edge("x","out",3,0), megaminx_edge("y","out",3,0));
  ctx.moveTo(megaminx_edge("x","in" ,3,1), megaminx_edge("y","in" ,3,1));
  ctx.lineTo(megaminx_edge("x","out",3,1), megaminx_edge("y","out",3,1));
  ctx.moveTo(megaminx_edge("x","in" ,4,0), megaminx_edge("y","in" ,4,0));
  ctx.lineTo(megaminx_edge("x","out",4,0), megaminx_edge("y","out",4,0));
  ctx.moveTo(megaminx_edge("x","in" ,4,1), megaminx_edge("y","in" ,4,1));
  ctx.lineTo(megaminx_edge("x","out",4,1), megaminx_edge("y","out",4,1));
  
  ctx.stroke();
  
  function megaminx(axis,r,k){
    if(axis == "x"){
      return origin + r * Math.cos((2 * Math.PI * k) / 5 + Math.PI / 2);
    }else if(axis == "y"){
      return origin - r * Math.sin((2 * Math.PI * k) / 5 + Math.PI / 2);
    }
  }
  
  function megaminx_edge(axis,side,k,l){
    var angle;
    var r;
    var gap;

    if(side == "in"){
      r = 65
      gap = 0.043
    }else if(side == "out"){
      r = 84
      gap = 0.081
    }

    if(l == 0){
      angle = 0.4 * k + 0.2 - gap
    }else if(l == 1){
      angle = 0.4 * k + 0.2 + gap
    }
  
    if(axis == "x"){
      return 120 + r * Math.cos((angle * Math.PI) + Math.PI / 2);
    }else if(axis == "y"){
      return 120 - r * Math.sin((angle * Math.PI) + Math.PI / 2);
    }
  }