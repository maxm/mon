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
  defer conn.Close()
  
  connbuf := bufio.NewReader(conn)
  var name string = ""
  var authorized = false
  for{
      line, err := connbuf.ReadString('\n')
      if err != nil { break }
      line = strings.TrimSpace(line)
      
      if !authorized {
        if line == Conf.ApiKey {
          Log("Connection authorized")
          authorized = true
          continue
        } else {
          Log("Connection NOT authorized")
          break
        }
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

      values := strings.Split(line, " ")
      parsed_values := make([]int64, len(values))
      for i := 0; i < len(values); i++ {
        var err error = nil
        parsed_values[i], err = strconv.ParseInt(values[i], 10, 64)
        if err != nil {
          Log("Stream got wrong value %v", line)
          break
        }
      }

      time := time.Now().UnixNano() / int64(time.Millisecond)
      Post(name, time, parsed_values)
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
