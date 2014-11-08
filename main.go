package main

import (
  _ "github.com/go-sql-driver/mysql"
  "database/sql"
  "net/http"
  "strconv"
  "errors"
  "encoding/json"
  "fmt"
  "os"
  "github.com/gorilla/mux"
  "compress/gzip"
  "io"
  "strings"
  "time"
)

type Configuration struct {
  DatabaseUser string
  DatabasePassword string
  DatabaseName string
  ApiKey string
}

var Conf Configuration
var db *sql.DB

type gzipResponseWriter struct {
  io.Writer
  http.ResponseWriter
}
 
func (w gzipResponseWriter) Write(b []byte) (int, error) {
  return w.Writer.Write(b)
}
 
func makeGzipHandler(fn http.HandlerFunc) http.HandlerFunc {
  return func(w http.ResponseWriter, r *http.Request) {
    if !strings.Contains(r.Header.Get("Accept-Encoding"), "gzip") {
      fn(w, r)
      return
    }
    w.Header().Set("Content-Encoding", "gzip")
    gz := gzip.NewWriter(w)
    defer gz.Close()
    gzr := gzipResponseWriter{Writer: gz, ResponseWriter: w}
    fn(gzr, r)
  }
}

func formInt(w http.ResponseWriter, r *http.Request, name string) (int64, error) {
  r.ParseForm()
  s := r.Form[name]
  if len(s) == 0 {
    w.WriteHeader(http.StatusBadRequest)
    fmt.Printf("Required parameter %v in %v\n", name, r)
    return 0, errors.New("")
  }
  i,err := strconv.ParseInt(s[0], 10, 64)
  if err != nil { w.WriteHeader(http.StatusBadRequest) }
  return i, err
}

func formString(w http.ResponseWriter, r *http.Request, name string) (string, error) {
  r.ParseForm()
  s := r.Form[name]
  if len(s) == 0 {
    w.WriteHeader(http.StatusBadRequest)
    fmt.Printf("Required parameter %v in %v\n", name, r)
    return "", errors.New("")
  }
  return s[0], nil
}

func authenticate(w http.ResponseWriter, r *http.Request) bool {
  apiKey, err := formString(w, r, "api")
  if err != nil { return false } 
  if apiKey != Conf.ApiKey {
    w.WriteHeader(http.StatusUnauthorized)
    return false
  }
  return true
}

func checkDB() bool {
  err := db.Ping()
  if err != nil {
    fmt.Println("Can't connect to database " + err.Error())
    return false
  }
  return true
}

func validName(name string) bool {
  if len(name) == 0 { return false }
  for i := 0; i < len(name); i++ {
    if name[i] < 'a' || name[i] > 'z' { return false }
  }
  return true
}

func queryRange(w http.ResponseWriter, r *http.Request) {
  name, err := formString(w, r, "name")
  if err != nil { return }
  if !validName(name) { return }

  from, err := formInt(w, r, "from")
  if err != nil { return }

  to, err := formInt(w, r, "to")
  if err != nil { return }

  if !checkDB() { return }

  rows, err := db.Query("SELECT time, value FROM " + name + " WHERE time >= ? AND time < ? ORDER BY time", from, to)
  if (err != nil) {
    fmt.Println(err)
    return
  }
  
  w.Header()["Content-Type"] = []string{"application/json"}
  w.Header()["Access-Control-Allow-Origin"] = []string{"*"}
  fmt.Fprint(w, "[")
  for i:=0; rows.Next(); i++ {
    var time, value int64
    rows.Scan(&time, &value)
    if i > 0 {fmt.Fprint(w, ",")}
    fmt.Fprint(w, "[")
    fmt.Fprint(w, time)
    fmt.Fprint(w, ",")
    fmt.Fprint(w, value)
    fmt.Fprint(w, "]")
  }
  fmt.Fprint(w, "]")
  fmt.Printf("range %v [%v, %v]\n", name, from, to)
}

func post(w http.ResponseWriter, r *http.Request) {
  if !authenticate(w, r) { return }

  name, err := formString(w, r, "name")
  if err != nil { return }
  if !validName(name) { return }

  time, err := formInt(w, r, "time")
  if err != nil { return }

  value, err := formInt(w, r, "value")
  if err != nil { return }

  Post(name, time, value)
}

func Post(name string, time int64, value int64) {
  if !checkDB() { return }

  _, err := db.Exec("CREATE TABLE IF NOT EXISTS `" + name + "` ( `time` bigint UNIQUE, `value` int )")
  if err != nil {
    fmt.Printf("Error creating table %v\n", err)
    return
  }
  
  _, err = db.Exec("INSERT INTO " + name + " (time, value) VALUES (?, ?)", time, value)
  if err != nil {
    fmt.Printf("Error inserting value %v\n", err)
    return
  }
}

func Log(message string, a ...interface{}) {
  message = fmt.Sprintf(message, a...)
  fmt.Printf("%v %v\n", time.Now().Format(time.Stamp), message)
}

func main() {
  file, err := os.Open("conf.json")
  if err != nil {
    fmt.Println(err)
    return
  }
  decoder := json.NewDecoder(file)
  decoder.Decode(&Conf)

  Log("Connect database %v as %v", Conf.DatabaseName, Conf.DatabaseUser)
  db, _ = sql.Open("mysql", Conf.DatabaseUser+":"+Conf.DatabasePassword+"@/"+Conf.DatabaseName)

  router := mux.NewRouter()
  router.HandleFunc("/feed", post).Methods("POST")
  router.HandleFunc("/feed", makeGzipHandler(queryRange)).Methods("GET")
  http.Handle("/feed", router)
  http.Handle("/", http.FileServer(http.Dir("web")))
  go StreamListen()
  http.ListenAndServe(":8080", nil)
}
