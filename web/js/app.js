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

  $(document).ready(function() {
    canvas = document.getElementById("canvas");
    context = canvas.getContext("2d");

    $(canvas).mousemove(mousemove)
    document.addEventListener('touchdown', function(e) {
        e.preventDefault();
        var touch = e.touches[0];
        mousemove(touch);
    }, false);

    $( window ).resize(function() {
      resizeChart();
      drawChart();
    });
    resizeChart();

    pollPulseEnd = new Date().getTime();
    
    setPulseHourSpan(6);
    pollPulses();
    updateNow();
  });

  function updateNow() {
    if (lastPulses.length > 2) {
      var lastPulse = lastPulses[lastPulses.length-1];
      var watts = deltaToWatts(lastPulse[1])
      $('#wattsNow').text(watts.toString() + "W")
      var now = new Date().getTime();
      var seconds = (now - lastPulse[0]) / 1000;
      if (seconds < 45) {
        $('#wattsNowTime').text("seconds ago")
      } else {
        var minutes = Math.round(seconds / 60);
        if (minutes == 1) {
          $('#wattsNowTime').text("one minute ago")  
        } else {
          $('#wattsNowTime').text(minutes + " minutes ago")
        }
      }
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

    var max = 0;
    $.each(lastPulses, function(i, p) {
      max = Math.max(max, deltaToWatts(p[1]));
    })

    context.beginPath();
    context.strokeStyle = "#0000aa";
    context.lineWidth = 1.5;
    var segments = canvas.width / 2;
    for (var i = 0; i < segments; ++i) {
      var x = i / segments;
      var from = (pollPulseEnd - pollPulseMillis) + pollPulseMillis * i / segments;
      var to = (pollPulseEnd - pollPulseMillis) + pollPulseMillis * (i + 1) / segments;
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
      var from = (pollPulseEnd - pollPulseMillis) + pollPulseMillis * (hoverX - marginSides) / (canvas.width - marginSides*2);
      var power = averagePower(from, from + pollPulseMillis / segments);
      var y = power/max;
      y = Math.round(canvas.height - y*(canvas.height - baseLine - marginTop) - baseLine) + 0.5;

      if (Math.abs(y - hoverY) < 40) {
        context.font="15px Helvetica";
        var text = Math.round(power) + "W " + moment(from).format('MMM D, HH:mm:ss');;
        var size = context.measureText(text);
        
        context.beginPath();
        context.strokeStyle = "#777"
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
  }

  function mousemove(event) {
    hoverX = event.pageX - $(canvas).offset().left;
    hoverY = event.pageY - $(canvas).offset().top;
    drawChart();
  }

  function averagePower(from, to) {
    var i = findClosest(lastPulses, from, 0, lastPulses.length);

    if (lastPulses[i][0] >= from && lastPulses[i][0] <= to) {
      var sum = 0;
      var count = 0;
      for(;lastPulses[i][0] <= to; ++i) {
        sum += deltaToWatts(lastPulses[i][1]);
        ++count;
      }
      return sum / count;
    }

    if (Math.abs(lastPulses[i][0] - from) < 60*60*1000/5) {
      return deltaToWatts(lastPulses[i][1]);
    }
    return 0;
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

  movePulseEndDays = function(days) {
    if (pollPulseEnd == null) {
      pollPulseEnd = new Date().getTime();
    }
    pollPulseEnd += days * 24*60*60*1000;
    if (pollPulseEnd > new Date().getTime()) {
      pollPulseEnd = null;
    }
    pollPulses();
    return false;
  }

})();