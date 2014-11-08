package main

import (
  "fmt"
  "time"
  "net"
  "bufio"
  "strings"
  "strconv"
)

func handleConnection(conn net.Conn) {
  Log("Stream connection from %v", conn.RemoteAddr())
  
  connbuf := bufio.NewReader(conn)
  var name string = ""
  var authorized = false
  for{
      line, err := connbuf.ReadString('\n')
      if err != nil { break }
      line = strings.TrimSpace(line)
      
      if !authorized && line != Conf.ApiKey {
        Log("Unauthorized connection")
        break
      } else {
        authorized = true
        continue
      }

      if line[0] == '#' {
        name = line[1:]
        Log("Getting stream of values for %v", name)
        continue
      }

      if len(name) == 0 {
        Log("No name received in stream connection")
        break
      }

      value, err := strconv.ParseInt(line, 10, 64)
      if err != nil {
        Log("Stream got wrong value %v", line)
        break
      }

      time := time.Now().UnixNano() / int64(time.Millisecond)
      Post(name, time, value)
  }

  Log("Stream connection from %v complete", conn.RemoteAddr())
}

func StreamListen() {
  listen, err := net.Listen("tcp", ":9002")
  if err != nil {
    fmt.Println(err)
    return
  }
  Log("Waiting for stream connections")
  for {
    conn, err := listen.Accept()
    if err != nil {
      fmt.Println(err)
      continue
    }
    go handleConnection(conn)
  }
}
