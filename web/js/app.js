(function() {

  var pollPulsesHours = 0
  var pollPulseMillis = 0

  var lastPulses = []

  var pollPulseEnd = null

  var pollTimer = null

  var canvas = null;
  var context = null;

  var baseLine = 50;
  var marginSides = 10;
  var marginTop = 50;

  var hoverX = 0;
  var hoverY = 0;

  var selectionStart = 0;
  var selectionEnd = 0;

  $(document).ready(function() {
    canvas = document.getElementById("canvas");
    context = canvas.getContext("2d");

    $( window ).resize(function() {
      resizeChart();
      drawChart();
    });
    resizeChart();

    pollPulseEnd = new Date().getTime();
    
    setPulseHourSpan(24);
    pollPulses();
    updateNow();

    var mouseDownStart = null;
    $(canvas).mousedown(function(event) {
      mouseDownStart = event.pageX - $(canvas).offset().left;
    })
    $(canvas).mousemove(function(event) {
      hoverX = event.pageX - $(canvas).offset().left;
      hoverY = event.pageY - $(canvas).offset().top;
      
      if (mouseDownStart != null) {
        if (mouseDownStart > hoverX) {
          selectionStart = hoverX;
          selectionEnd = mouseDownStart;
        } else {
          selectionStart = mouseDownStart;;
          selectionEnd = hoverX
        }
      }

      drawChart();
    })
    $(canvas).mouseup(function(event) {
      mouseDownStart = null;
    });
    document.addEventListener('touchdown', function(e) {
        e.preventDefault();
        var touch = e.touches[0];
        mousemove(touch);
    }, false);
  });

  function updateNow() {
    if (lastPulses.length > 2) {
      var lastPulse = lastPulses[lastPulses.length-1];
      var watts = deltaToWatts(lastPulse[1])
      $('#wattsNow').text(watts.toString() + "W")
      $('#wattsNowTime').text(moment(lastPulse[0]).fromNow())
    }
    setTimeout(updateNow, 5000);
  }

  function pollPulses() {
    if (pollTimer) clearTimeout(pollTimer);
    var time = pollPulseEnd ? pollPulseEnd : new Date().getTime();
    $.get("http://server.max.uy:8080/feed", { name: "power", from: time - pollPulseMillis, to: time },function(data) {
      lastPulses = data;
      drawChart();
      updateNow();
      if (pollPulseEnd == null) {
        pollTimer = setTimeout(pollPulses, 2000);
      }
    }, "json");
  }

  function resizeChart() {
    canvas.width  = window.innerWidth;
    canvas.style.width = canvas.width + "px"
  }

  function drawChart() {
    context.fillStyle="#eee";
    context.fillRect(0,0,canvas.width,canvas.height);

    var startX = (pollPulseEnd - pollPulseMillis);
    var endX = pollPulseEnd;
    var deltaX = pollPulseMillis;

    var max = 0;
    $.each(lastPulses, function(i, p) {
      max = Math.max(max, deltaToWatts(p[1]));
    })

    var timeLines = [1000*60, 
                     1000*60*5, 
                     1000*60*15, 
                     1000*60*30, 
                     1000*60*60, 
                     1000*60*60*2, 
                     1000*60*60*4, 
                     1000*60*60*8,
                     1000*60*60*12,
                     1000*60*60*24,
                     1000*60*60*24*7,
                     1000*60*60*24*14];
    for (var i = 0; i<timeLines.length; ++i) {
      if ((endX - startX) / timeLines[i] < 10) {
        drawVerticalLines(timeLines[i], startX, endX, "#666")
        break;
      }
    }
    var wattLines = [10, 20, 50, 100, 250, 500, 1000];
    for (var i = 0; i<wattLines.length; ++i) {
      if (max / wattLines[i] < 6) {
        drawHorizontalLines(wattLines[i], 0, max, "#666");
        break;
      }  
    }
    
    if (context.setLineDash) context.setLineDash([]);

    context.beginPath();
    context.strokeStyle = "#0000aa";
    context.lineWidth = 1.2;
    var segments = canvas.width / 2;
    for (var i = 0; i < segments; ++i) {
      var x = i / segments;
      var from = startX + deltaX * i / segments;
      var to = startX + deltaX * (i + 1) / segments;
      var y = averagePower(from, to) / max;
      x = Math.round(x * (canvas.width - marginSides*2) + marginSides) + 0.5;
      y = Math.round(canvas.height - y*(canvas.height - baseLine - marginTop) - baseLine) + 0.5;
      if (i == 0) {
        context.moveTo(x,y); 
      } else {
        context.lineTo(x,y); 
      }
    };
    context.stroke();

    if (hoverX > marginSides) {
      var from = timeFromX(startX, endX, hoverX);
      var power = averagePower(from, from + deltaX / segments);
      var y = power/max;
      y = Math.round(canvas.height - y*(canvas.height - baseLine - marginTop) - baseLine) + 0.5;

      if (Math.abs(y - hoverY) < 40) {
        context.font="15px Helvetica";
        var text = Math.round(power) + "W " + moment(from).format('MMM D, HH:mm:ss');
        var size = context.measureText(text);
        
        context.beginPath();
        context.strokeStyle = "#999"
        context.moveTo(hoverX, y + 0.5);
        context.lineTo(hoverX, y-5.5);
        context.lineTo(hoverX + size.width / 2 + 2, y-5.5);
        context.lineTo(hoverX - size.width / 2 - 2, y-5.5);
        context.stroke();

        context.beginPath();
        context.fillStyle = "#0000aa";
        context.arc(hoverX,y,2,0,2*Math.PI);
        context.fill();
        
        var x = hoverX + 3;
        y -= 12;
        x -= Math.round(size.width / 2) + 3;
        if (x + size.width > canvas.width) x = canvas.width - size.width;
        
        context.fillStyle = "rgba(255,255,255,0.9)"
        context.fillRect(x-2, y - 17, size.width+4, 24);

        context.fillStyle = "black";
        context.fillText(text, x, y);
      }
    }
    
    context.beginPath();
    context.strokeStyle = "black";
    context.lineWidth = 1;
    context.moveTo(marginSides, canvas.height - baseLine + 0.5);
    context.lineTo(canvas.width - marginSides * 2, canvas.height - baseLine + 0.5);
    context.stroke();

    if (selectionEnd > selectionStart) {
      context.globalAlpha = 0.1;
      context.fillStyle="blue";
      context.fillRect(selectionStart,0,selectionEnd - selectionStart,canvas.height);
      context.globalAlpha = 1;

      context.font="15px Helvetica";
      context.fillStyle="black";
      var from = timeFromX(startX, endX, selectionStart);
      var to = timeFromX(startX, endX, selectionEnd);
      var Wh = countWh(from, to);
      var duration = moment.duration(to - from);

      var midSelection = (selectionStart + selectionEnd) / 2;

      var text = Wh + "Wh";
      var size = context.measureText(text);
      context.fillText(text, midSelection - size.width / 2, canvas.height / 2 - 20);
      
      text = (duration.asDays() >= 1 ? Math.floor(duration.asDays()) + "d" : "") + 
             (duration.hours() > 0 ? duration.hours() + "h" : "") + 
             (duration.minutes() > 0 ? duration.minutes() + "m" : "") + 
             (duration.asDays() >= 1 ? "" : duration.seconds() + "s");
      size = context.measureText(text);
      context.fillText(text, midSelection - size.width / 2, canvas.height / 2);

      text = Math.round(Wh/duration.asHours()) + "W";
      size = context.measureText(text);
      context.fillText(text, midSelection - size.width / 2, canvas.height / 2 + 20)
    }
  }

  function drawVerticalLines(modulo, startT, endT, color) {
    for (var t = moment(startT).startOf('day').valueOf(); t < endT; t += modulo) {
      if (t > startT) {
        var dayLimit = moment(t).isSame(moment(t).startOf('day')) 
        if (context.setLineDash) context.setLineDash(dayLimit ? [] : [1]);
        context.beginPath();
        context.strokeStyle = color;
        context.lineWidth = 1;
        var x = (t-startT) / (endT-startT);
        x = Math.round(x * (canvas.width - marginSides*2) + marginSides) + 0.5;
        context.moveTo(x, canvas.height - baseLine);
        context.lineTo(x, marginTop);
        context.stroke();

        context.font="12px Helvetica";
        var text = moment(t).format(dayLimit ? 'MMM D' : 'MMM D, HH:mm');
        var size = context.measureText(text);
        context.fillStyle = color;
        context.fillText(text, x - size.width/2, canvas.height - baseLine + 15);
      }
    }
  }

  function drawHorizontalLines(modulo, startW, endW, color) {
    if (context.setLineDash) context.setLineDash([1]);
    for (var w = startW - startW%modulo; w < endW; w += modulo) {
      if (w > startW) {
        var y = (w-startW) / (endW-startW);
        y = Math.round(canvas.height - y*(canvas.height - baseLine - marginTop) - baseLine) + 0.5;

        context.font="12px Helvetica";
        var text = w + "W";
        var size = context.measureText(text);
        context.fillStyle = color;
        context.fillText(text, marginSides/2, y + 3);

        context.beginPath();
        context.strokeStyle = color;
        context.lineWidth = 1;
        context.moveTo(canvas.width - marginSides, y);
        context.lineTo(marginSides/2 + size.width + 3, y);
        context.stroke();
      }
    }
  }

  function timeFromX(startX, endX, x) {
    return Math.round(startX + (endX - startX) * (x - marginSides) / (canvas.width - marginSides*2));
  }

  function averagePower(from, to) {
    if (lastPulses.length == 0) return 0;
    var closest = findClosest(lastPulses, from, 0, lastPulses.length);
    
    var sum = 0;
    var count = 0;
    for(var i = closest; i < lastPulses.length && lastPulses[i][0] <= to; ++i) {
      if (lastPulses[i][0] >= from) {
        sum += deltaToWatts(lastPulses[i][1]);
        ++count;
      }
    }
    if (count > 0) {
      return sum / count;
    }
    
    if (Math.abs(lastPulses[closest][0] - from) < 60*60*1000/5) {
      return deltaToWatts(lastPulses[closest][1]);
    }
    return 0;
  }

  function countWh(from, to) {
    if (lastPulses.length == 0) return 0;
    var i = findClosest(lastPulses, from, 0, lastPulses.length);
    var count = 0;
    for(;i < lastPulses.length && lastPulses[i][0] <= to; ++i) {
      ++count;
    }
    return count;
  }

  function findClosest(array, value, min, max) {
    if (min + 1 >= max) return min;
    var mid = Math.floor((min + max) / 2);
    var midValue = array[mid][0];
    if (value  < midValue) return findClosest(array, value, min, mid);
    return findClosest(array, value, mid, max);
  }

  function deltaToWatts(delta) {
    return Math.round(60*60*1000/delta);
  }

  setPulseHourSpan = function(hours) {
    pollPulsesHours = hours
    pollPulseMillis = pollPulsesHours*60*60*1000;
    pollPulses();
    return false;
  }

  setPulseEnd = function(end) {
    pollPulseEnd = end;
    pollPulses();
    return false;
  }

  scroll = function(pages) {
    if (pollPulseEnd == null) {
      pollPulseEnd = new Date().getTime();
    }
    pollPulseEnd += pages * pollPulseMillis;
    if (pollPulseEnd > new Date().getTime()) {
      pollPulseEnd = new Date().getTime();
    }
    pollPulses();
    return false;
  }

})();