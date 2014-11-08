GOOS=linux GOARCH=386 CGO_ENABLED=0 go build -o build/main.linux main.go stream.go
scp build/main.linux root@server.max.uy:/var/www/mon/main.linux.next
scp -r web/ root@server.max.uy:/var/www/mon/
scp deploy/mon.conf root@server.max.uy:/etc/init/
ssh root@server.max.uy <<'ENDSSH'
  /sbin/stop mon
  mv /var/www/mon/main.linux.next /var/www/mon/main.linux
  /sbin/start mon
ENDSSH

