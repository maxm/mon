(function() {

  var pollPulsesHours = 0
  var pollPulseMillis = 0

  var lastPulses = []

  var pollPulseEnd = null

  var pollTimer = null

  var canvas = null;
  var context = null;

  var baseLine = 50;
  var margin = 10;

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
      $('#wattsNow').text(watts.toString())
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
      x = Math.round(x * (canvas.width - margin*2) + margin) + 0.5;
      y = Math.round(canvas.height - y*(canvas.height - baseLine) - baseLine) + 0.5;
      if (i == 0) {
        context.moveTo(x,y); 
      } else {
        context.lineTo(x,y); 
      }
    };
    context.stroke();

    if (hoverX > 0) {
      var from = (pollPulseEnd - pollPulseMillis) + pollPulseMillis * hoverX / canvas.width;
      var power = averagePower(from, from + pollPulseMillis / segments);
      var y = canvas.height - power/max*(canvas.height - baseLine) - baseLine;

      if (Math.abs(y - hoverY) < 40) {
        context.beginPath();
        context.fillStyle = "#0000aa";
        
        context.arc(hoverX,y,4,0,2*Math.PI);
        context.fill();

        context.font="16px Helvetica";
        var text = Math.round(power) + "W " + moment(from).format('MMM D, HH:mm:ss');;
        var size = context.measureText(text);
        var x = hoverX + 3;
        y += 15;
        if (x + size.width > canvas.width) x = canvas.width - size.width;
        context.fillStyle = "black";
        context.fillText(text, x, y);
      }
    }
    
    context.beginPath();
    context.strokeStyle = "black";
    context.lineWidth = 1;
    context.moveTo(margin, canvas.height - baseLine + 0.5);
    context.lineTo(canvas.width - margin * 2, canvas.height - baseLine + 0.5);
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

    // var power = 0;
    // var powerCount = 0;
    // var closest = null;
    // var closestDist = 0;
    // $.each(lastPulses, function(i, p) {
    //   var dist = Math.abs(p[0] - from);
    //   if (closest == null || dist < closestDist) {
    //     closest = p;
    //     closestDist = dist;
    //   }
    //   if (p[0] >= from && p[0] <= to) {
    //     power += deltaToWatts(p[1]);
    //     powerCount++;
    //   }
    // });
    // if (powerCount > 0) return power / powerCount;
    
    // if (closest != null && closestDist < 60*60*1000/5) {
    //   return deltaToWatts(closest[1]);
    // }
    // return 0;
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