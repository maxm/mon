(function() {

  var pollPulsesHours = 0
  var pollPulseMillis = 0

  var lastPulses = []

  var pollPulseEnd = null

  var pollTimer = null

  var canvas = null;
  var context = null;

  var baseLine = 50;

  var hover = 0;

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
      drawChart();
    });

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

  function drawChart() {
    canvas.width  = window.innerWidth - 50;
    canvas.style.width = canvas.width + "px"
    
    var max = 0;
    $.each(lastPulses, function(i, p) {
      max = Math.max(max, deltaToWatts(p[1]));
    })

    context.beginPath();
    context.strokeStyle = "#0000aa";
    context.lineWidth = 1;
    var segments = canvas.width / 2;
    for (var i = 0; i < segments; ++i) {
      var x = i / segments * canvas.width;
      var from = (pollPulseEnd - pollPulseMillis) + pollPulseMillis * i / segments;
      var to = (pollPulseEnd - pollPulseMillis) + pollPulseMillis * (i + 1) / segments;
      var y = canvas.height - averagePower(from, to)/max*(canvas.height - baseLine) - baseLine;
      if (i == 0) {
        context.moveTo(x,y); 
      } else {
        context.lineTo(x,y); 
      }
    };
    context.stroke();

    {
      var from = (pollPulseEnd - pollPulseMillis) + pollPulseMillis * hover / canvas.width;
      var power = averagePower(from, from + pollPulseMillis / segments);
      context.beginPath();
      context.fillStyle = "#0000aa";
      var y = canvas.height - power/max*(canvas.height - baseLine) - baseLine;
      context.arc(hover,y,4,0,2*Math.PI);
      context.fill();

      context.font="16px Helvetica";
      var text = Math.round(power) + "W " + moment(from).format('MMM D, HH:mm:ss');;
      var size = context.measureText(text);
      var x = hover + 3;
      y += 15;
      if (x + size.width > canvas.width) x = canvas.width - size.width;
      context.fillStyle = "black";
      context.fillText(text, x, y);
    }
    
    context.beginPath();
    context.strokeStyle = "black";
    context.lineWidth = 1;
    context.moveTo(0, canvas.height - baseLine);
    context.lineTo(canvas.width, canvas.height - baseLine);
    context.stroke();
  }

  function mousemove(event) {
    hover = event.pageX - $(canvas).offset().left;
    drawChart();
  }

  function averagePower(from, to) {
    var power = 0;
    var powerCount = 0;
    var closest = null;
    var closestDist = 0;
    $.each(lastPulses, function(i, p) {
      var dist = Math.abs(p[0] - from);
      if (closest == null || dist < closestDist) {
        closest = p;
        closestDist = dist;
      }
      if (p[0] >= from && p[0] <= to) {
        power += deltaToWatts(p[1]);
        powerCount++;
      }
    });
    if (powerCount > 0) return power / powerCount;
    
    if (closest != null && closestDist < 60*60*1000/5) {
      return deltaToWatts(closest[1]);
    }
    return 0;
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