(function() {

  var pollPulsesHours = 0
  var pollPulseMillis = 0

  var lastPulses = []
  var chartsReady = false

  var pollPulseEnd = null

  var pollTimer = null

  google.load('visualization', '1.0', {'packages':['corechart']});
  google.setOnLoadCallback(function() { chartsReady = true; });

  $(document).ready(function() {
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
    if(!chartsReady) return;
    var watts = [['Time', 'Power']];
    var lastT = 0;
    var total = 0;
    $.each(lastPulses, function(i,t) {
      if (i > 0) {
        ++total;
        watts.push([new Date(t[0]), deltaToWatts(t[1])])
      }
      lastT = t;
    })
    var data = google.visualization.arrayToDataTable(watts);

    var options = {
      fontSize: 14,
      hAxis: {
        format: 'MMM d, HH:mm'
      },
      vAxis: { 
        viewWindow:{
          min: 0
        }
      },
      chartArea: {
        height: 500
      },
      legend: {position: 'none'}
    };

    var chart = new google.visualization.LineChart(document.getElementById('chart'));
    chart.draw(data, options);
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